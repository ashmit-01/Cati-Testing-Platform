import TestRun, { TEST_RUN_STATUS } from "../models/TestRun.js";

function finiteNonNegative(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function getHistoricalAverageDuration(runId, suites = []) {
  const filter = {
    runId: { $ne: runId },
    status: TEST_RUN_STATUS.COMPLETED,
    totalTests: { $gt: 0 },
    duration: { $gt: 0 },
  };

  // Use suite-specific history when the run targets one suite. For "all",
  // use the recent overall average as the initial estimate.
  if (Array.isArray(suites) && suites.length === 1) {
    filter.suites = suites[0];
  }

  const history = await TestRun.find(filter)
    .sort({ completedAt: -1 })
    .limit(20)
    .select("totalTests duration")
    .lean();

  const totals = history.reduce(
    (sum, item) => ({
      tests: sum.tests + (Number(item.totalTests) || 0),
      duration: sum.duration + (Number(item.duration) || 0),
    }),
    { tests: 0, duration: 0 },
  );

  return totals.tests > 0 ? totals.duration / totals.tests : 0;
}

/**
 * Stores reporter progress and recalculates ETA from observed test durations,
 * with recent completed runs as a fallback/prior for the first few tests.
 */
export async function updateTestRunProgress(runId, payload) {
  const run = await TestRun.findOne({ runId }).lean();
  if (!run) {
    return null;
  }

  if (run.status !== TEST_RUN_STATUS.RUNNING) {
    return { run, ignored: true };
  }

  const totalTests = Math.max(
    Number(run.totalTests) || 0,
    Math.floor(finiteNonNegative(payload.totalTests)),
  );
  const completedTests = Math.min(
    totalTests || Math.floor(finiteNonNegative(payload.completedTests)),
    Math.max(
      Number(run.completedTests) || 0,
      Math.floor(finiteNonNegative(payload.completedTests)),
    ),
  );

  const passed = Math.floor(finiteNonNegative(payload.passed));
  const failed = Math.floor(finiteNonNegative(payload.failed));
  const skipped = Math.floor(finiteNonNegative(payload.skipped));
  const completedDurationMs = finiteNonNegative(payload.completedDurationMs);
  const remainingTests = Math.max(0, totalTests - completedTests);
  const now = new Date();
  const executionStartedAt = run.executionStartedAt || now;
  const wallElapsedMs = Math.max(
    0,
    now.getTime() - new Date(executionStartedAt).getTime(),
  );

  let averageDurationPerTest = 0;
  const observedTestAverage =
    completedTests > 0 ? completedDurationMs / completedTests : 0;
  const observedWallAverage =
    completedTests > 0 ? wallElapsedMs / completedTests : 0;
  const observedAverage = Math.max(observedTestAverage, observedWallAverage);

  if (observedAverage > 0) {
    // Historical data is useful as a prior for the first three completed
    // cases. After that, use the current run's observed average directly
    // and avoid querying history on every progress heartbeat.
    if (completedTests <= 3) {
      const historicalAverage = await getHistoricalAverageDuration(
        runId,
        run.suites,
      );

      averageDurationPerTest =
        historicalAverage > 0
          ? (observedAverage * completedTests + historicalAverage * 3) /
            (completedTests + 3)
          : observedAverage;
    } else {
      averageDurationPerTest = observedAverage;
    }
  } else {
    averageDurationPerTest = await getHistoricalAverageDuration(
      runId,
      run.suites,
    );
  }

  const estimatedRemainingMs =
    averageDurationPerTest > 0
      ? Math.max(0, Math.round(remainingTests * averageDurationPerTest))
      : null;

  const progressPercent =
    totalTests > 0
      ? Math.min(100, Math.round((completedTests / totalTests) * 100))
      : 0;

  const etaAt =
    estimatedRemainingMs === null
      ? null
      : new Date(now.getTime() + estimatedRemainingMs);

  const updatedRun = await TestRun.findOneAndUpdate(
    { runId, status: TEST_RUN_STATUS.RUNNING },
    {
      $set: {
        totalTests,
        completedTests,
        passed,
        failed,
        skipped,
        completedDurationMs,
        progressPercent,
        estimatedRemainingMs,
        etaAt,
        executionStartedAt,
        lastProgressAt: now,
      },
    },
    { new: true },
  ).lean();

  return { run: updatedRun || run, ignored: !updatedRun };
}
