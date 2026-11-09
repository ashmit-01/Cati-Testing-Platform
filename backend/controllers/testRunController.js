import TestRun, { TEST_RUN_STATUS } from "../models/TestRun.js";
import Failure from "../models/Failure.js";
import TestResult from "../models/TestResult.js";
import { asyncHandler, ApiError } from "../utils/asyncHandler.js";
import { generateRunId } from "../utils/idService.js";
import { runTests } from "../services/testRunnerService.js";
import { processResults } from "../services/resultService.js";
import { processFailures } from "../services/failureService.js";
import { queueFailureAnalysis } from "../services/aiFailureAnalysisService.js";
import { logger } from "../utils/logger.js";
import { adaptCiReport } from "../services/ciResultAdapter.js";
import { updateTestRunProgress } from "../services/testRunProgressService.js";
import {
  buildTestRunLog,
  getTestLogExpiresAt,
  isTestLogAvailable,
} from "../services/testRunLogService.js";

/**
 * Runs the full test execution pipeline in the background and updates the
 * TestRun document when it finishes. Intentionally not awaited by the
 * request handler — POST /api/test-runs must return immediately.
 */
async function executeInBackground(
  runId,
  environment,
  { suites, suiteId, testCaseIds },
) {
  try {
    const outcome = await runTests({
      runId,
      environment,
      suites,
      suiteId,
      testCaseIds,
    });

    const { savedResults } = await processResults(
      runId,
      outcome.results,
      environment,
    );
    const failures = await processFailures(savedResults, runId);

    // AI analysis of the failures' text evidence runs in the
    // background AFTER results and failures are saved. It is not
    // awaited and cannot throw, so an LLM problem can never fail or
    // delay the run or erase a saved failure.
    queueFailureAnalysis(failures);

    await TestRun.findOneAndUpdate(
      { runId },
      {
        status: TEST_RUN_STATUS.COMPLETED,
        completedAt: new Date(),
        totalTests: outcome.totalTests,
        passed: outcome.passed,
        failed: outcome.failed,
        skipped: outcome.skipped,
        duration: outcome.duration,
        completedTests: outcome.totalTests,
        progressPercent: 100,
        estimatedRemainingMs: 0,
        etaAt: new Date(),
        completedDurationMs: outcome.duration,
        executionMode: (
          process.env.TEST_EXECUTION_MODE || "mock"
        ).toLowerCase(),
      },
    );

    logger.info("Test run completed", {
      runId,
      ...outcome,
      results: undefined,
    });
  } catch (err) {
    logger.error("Test run failed unexpectedly", {
      runId,
      message: err.message,
    });

    await TestRun.findOneAndUpdate(
      { runId },
      {
        status: TEST_RUN_STATUS.FAILED,
        completedAt: new Date(),
        error: err.message,
      },
    ).catch((updateErr) => {
      // If we can't even record the failure, log loudly — this run
      // would otherwise be stuck in RUNNING forever.
      logger.error("Could not mark test run as FAILED after an error", {
        runId,
        message: updateErr.message,
      });
    });
  }
}

/**
 * POST /api/test-runs
 * Creates a TestRun (status RUNNING) and immediately returns. Test
 * execution continues in the background.
 */
export const createTestRun = asyncHandler(async (req, res) => {
  const { environment, suites, suiteId, testCaseIds } = req.body;

  const runId = await generateRunId();

  const testRun = await TestRun.create({
    runId,
    environment,
    suites: suites ? suites.map((suite) => suite.toUpperCase()) : [],
    suiteId: suiteId || null,
    testCaseIds: testCaseIds || [],
    status: TEST_RUN_STATUS.RUNNING,
    startedAt: new Date(),
  });

  // Fire-and-forget: do not await. Errors are handled inside
  // executeInBackground so they can never become an unhandled rejection.
  executeInBackground(runId, environment, {
    suites: testRun.suites,
    suiteId: testRun.suiteId,
    testCaseIds: testRun.testCaseIds,
  }).catch((err) => {
    logger.error("Unexpected error launching background test execution", {
      runId,
      message: err.message,
    });
  });

  logger.info("Test run created", {
    runId,
    environment,
    suites: testRun.suites,
    suiteId,
    testCaseIds,
  });

  res.status(202).json({
    message: "Test run started",
    runId,
    status: TEST_RUN_STATUS.RUNNING,
  });
});

/**
 * GET /api/test-runs?environment=&status=
 * Returns recent runs first.
 */
export const listTestRuns = asyncHandler(async (req, res) => {
  const { environment, status } = req.query;
  const filter = {};
  if (environment) filter.environment = environment;
  if (status) filter.status = status.toUpperCase();

  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

  const runs = await TestRun.find(filter)
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();

  const now = new Date();
  const runsWithLogStatus = runs.map((run) => ({
    ...run,
    logExpiresAt: getTestLogExpiresAt(run),
    logAvailable: isTestLogAvailable(run, now),
  }));

  res.json({ success: true, count: runs.length, runs: runsWithLogStatus });
});

/**
 * GET /api/test-runs/:id
 * :id is treated as runId (the external identifier), per the spec's
 * preference for runId over Mongo's _id in the public API.
 */
export const getTestRunById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const run = await TestRun.findOne({ runId: id }).lean();
  if (!run) {
    throw new ApiError(404, `No test run found with runId "${id}"`);
  }

  const recentFailures = await Failure.find({ runId: id })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("title severity category status createdAt")
    .lean();

  res.json({
    success: true,
    run: {
      ...run,
      logExpiresAt: getTestLogExpiresAt(run),
      logAvailable: isTestLogAvailable(run),
    },
    recentFailures,
  });
});

/**
 * GET /api/test-runs/:id/log
 * Builds a downloadable text log from persisted test-run and test-result data.
 * The log is available for 30 days after the run completes; the test history
 * itself is retained after the download window expires.
 */
export const downloadTestRunLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const run = await TestRun.findOne({ runId: id }).lean();

  if (!run) {
    throw new ApiError(404, `No test run found with runId "${id}"`);
  }

  if (String(run.status).toUpperCase() === TEST_RUN_STATUS.RUNNING) {
    throw new ApiError(
      409,
      "The test execution log will be available after this run finishes.",
    );
  }

  const logExpiresAt = getTestLogExpiresAt(run);
  if (!isTestLogAvailable(run)) {
    throw new ApiError(
      410,
      "This test execution log has expired after its 30-day retention period.",
    );
  }

  const [results, failures] = await Promise.all([
    TestResult.find({ runId: id }).sort({ createdAt: 1 }).lean(),
    Failure.find({ runId: id }).sort({ createdAt: 1 }).lean(),
  ]);

  const content = buildTestRunLog({ run, results, failures });
  const safeRunId = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="cati-test-run-${safeRunId}.txt"`,
  );
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Log-Expires-At", logExpiresAt.toISOString());
  return res.status(200).send(content);
});

/**
 * POST /api/test-runs/:runId/progress
 * Receives authenticated per-test progress updates from the Playwright
 * reporter running inside GitHub Actions.
 */
export const reportCiProgress = asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const {
    totalTests,
    completedTests,
    passed,
    failed,
    skipped,
    completedDurationMs,
  } = req.body || {};

  const values = {
    totalTests,
    completedTests,
    passed,
    failed,
    skipped,
    completedDurationMs,
  };

  for (const [field, value] of Object.entries(values)) {
    if (
      value === undefined ||
      !Number.isFinite(Number(value)) ||
      Number(value) < 0
    ) {
      throw new ApiError(
        400,
        `Invalid progress value: ${field} must be a non-negative number.`,
      );
    }
  }

  const result = await updateTestRunProgress(runId, values);
  if (!result) {
    throw new ApiError(404, `No running test run found with runId "${runId}"`);
  }

  return res.status(200).json({
    success: true,
    ignored: Boolean(result.ignored),
    progress: result.run
      ? {
          runId: result.run.runId,
          totalTests: result.run.totalTests,
          completedTests: result.run.completedTests,
          passed: result.run.passed,
          failed: result.run.failed,
          skipped: result.run.skipped,
          progressPercent: result.run.progressPercent,
          estimatedRemainingMs: result.run.estimatedRemainingMs,
          etaAt: result.run.etaAt,
          executionStartedAt: result.run.executionStartedAt,
        }
      : null,
  });
});

/**
 * POST /api/test-runs/:runId/failure
 * Marks a dashboard-triggered run failed when GitHub Actions cannot generate
 * or ingest the final QA report (for example, a runner/setup failure).
 */
export const reportCiFailure = asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const message = String(
    req.body?.message || "GitHub Actions did not produce a final QA report.",
  ).slice(0, 2000);

  const run = await TestRun.findOne({ runId });
  if (!run) {
    throw new ApiError(404, `No test run found with runId "${runId}"`);
  }

  if (run.status !== TEST_RUN_STATUS.RUNNING) {
    return res.status(200).json({ success: true, ignored: true });
  }

  run.status = TEST_RUN_STATUS.FAILED;
  run.completedAt = new Date();
  run.error = message;
  run.estimatedRemainingMs = null;
  run.etaAt = null;
  run.lastProgressAt = run.completedAt;
  await run.save();

  logger.error("GitHub Actions did not complete the dashboard test run", {
    runId,
    message,
  });

  return res.status(200).json({ success: true, status: run.status });
});

/**
 * POST /api/test-runs/ci
 * Receives a completed Playwright report from GitHub Actions.
 * Authenticated separately using the CI ingestion token.
 */
export const ingestCiReport = asyncHandler(async (req, res) => {
  const report = req.body;
  const ci = report?.ci || {};

  // GitHub Actions run ID is required for duplicate protection.
  if (!ci.runId) {
    throw new ApiError(400, "Missing CI metadata: ci.runId is required.");
  }

  const adapted = adaptCiReport(report);

  const existingCiRun = await TestRun.findOne({ "ci.runId": String(ci.runId) })
    .select("runId status")
    .lean();

  if (existingCiRun) {
    throw new ApiError(
      409,
      `GitHub Actions run "${ci.runId}" has already been imported.`,
    );
  }

  // Runs triggered from the dashboard are created before dispatch so that
  // progress can be shown immediately. Manual workflow_dispatch runs do not
  // carry platformRunId and retain the legacy post-completion import flow.
  const platformRunId = ci.platformRunId ? String(ci.platformRunId) : null;
  let testRun = platformRunId
    ? await TestRun.findOne({ runId: platformRunId })
    : null;

  if (platformRunId && !testRun) {
    throw new ApiError(
      404,
      `Dashboard test run "${platformRunId}" was not found.`,
    );
  }

  if (testRun && testRun.status !== TEST_RUN_STATUS.RUNNING) {
    throw new ApiError(
      409,
      `Dashboard test run "${platformRunId}" is no longer running.`,
    );
  }

  const runId = testRun?.runId || (await generateRunId());
  const startedAt = testRun?.startedAt || new Date();
  const results = adapted.results;
  const reportSummary = adapted.summary || {};

  const getSummaryCount = (key, fallback) => {
    const value = Number(reportSummary[key]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };

  const summary = {
    totalTests: getSummaryCount("total", results.length),
    passed: getSummaryCount(
      "passed",
      results.filter((item) => item.status === "PASS").length,
    ),
    failed: getSummaryCount(
      "failed",
      results.filter((item) => item.status === "FAIL").length,
    ),
    skipped: getSummaryCount(
      "skipped",
      results.filter((item) => item.status === "SKIPPED").length,
    ),
  };

  const totalDuration =
    Number(adapted.totalAttemptDuration) ||
    results.reduce((total, item) => total + (Number(item.duration) || 0), 0);

  const ciMetadata = {
    provider: "github-actions",
    workflow: ci.workflow || null,
    branch: ci.branch || null,
    commit: ci.commit || null,
    runNumber: ci.runNumber != null ? String(ci.runNumber) : null,
    runId: String(ci.runId),
    runUrl: ci.runUrl || null,
  };

  if (!testRun) {
    testRun = await TestRun.create({
      runId,
      environment: adapted.environment,
      suites: [...new Set(results.map((item) => item.suite))],
      status: TEST_RUN_STATUS.RUNNING,
      startedAt,
      executionMode: "playwright-ci",
      ci: ciMetadata,
    });
  } else {
    testRun = await TestRun.findOneAndUpdate(
      { runId },
      {
        $set: {
          environment: adapted.environment,
          suites: [...new Set(results.map((item) => item.suite))],
          executionMode: "playwright-ci",
          ci: ciMetadata,
        },
      },
      { new: true },
    );
  }

  try {
    const { savedResults } = await processResults(
      runId,
      results,
      adapted.environment,
    );

    if (savedResults.length !== results.length) {
      throw new Error(
        `Result persistence incomplete: expected ${results.length}, saved ${savedResults.length}.`,
      );
    }

    const failures = await processFailures(savedResults, runId);
    queueFailureAnalysis(failures);

    const completedAt = new Date();
    const completedRun = await TestRun.findOneAndUpdate(
      { runId },
      {
        $set: {
          status: TEST_RUN_STATUS.COMPLETED,
          completedAt,
          totalTests: summary.totalTests,
          completedTests: summary.totalTests,
          passed: summary.passed,
          failed: summary.failed,
          skipped: summary.skipped,
          duration: totalDuration,
          completedDurationMs: totalDuration,
          progressPercent: 100,
          estimatedRemainingMs: 0,
          etaAt: completedAt,
          lastProgressAt: completedAt,
        },
      },
      { new: true },
    ).lean();

    logger.info("GitHub Actions test run imported", {
      runId,
      githubRunId: String(ci.runId),
      ...summary,
    });

    return res.status(201).json({
      success: true,
      message: "CI test report imported successfully.",
      run: {
        runId,
        status: TEST_RUN_STATUS.COMPLETED,
        environment: adapted.environment,
        ...summary,
        duration: totalDuration,
        ci: completedRun?.ci || testRun.ci,
      },
    });
  } catch (error) {
    await TestRun.findOneAndUpdate(
      { runId },
      {
        $set: {
          status: TEST_RUN_STATUS.FAILED,
          completedAt: new Date(),
          error: error.message,
        },
      },
    );

    logger.error("GitHub Actions report ingestion failed", {
      runId,
      githubRunId: String(ci.runId),
      message: error.message,
    });

    throw error;
  }
});
