import TestRun, { TEST_RUN_STATUS } from '../models/TestRun.js';
import Failure from '../models/Failure.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { generateRunId } from '../utils/idService.js';
import { runTests } from '../services/testRunnerService.js';
import { processResults } from '../services/resultService.js';
import { processFailures } from '../services/failureService.js';
import { logger } from '../utils/logger.js';

/**
 * Runs the full test execution pipeline in the background and updates the
 * TestRun document when it finishes. Intentionally not awaited by the
 * request handler — POST /api/test-runs must return immediately.
 */
async function executeInBackground(runId, environment, { suites, suiteId, testCaseIds }) {
    try {
        const outcome = await runTests({ runId, environment, suites, suiteId, testCaseIds });

        const { savedResults } = await processResults(runId, outcome.results, environment);
        await processFailures(savedResults, runId);

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
                executionMode: (process.env.TEST_EXECUTION_MODE || 'mock').toLowerCase()
            }
        );

        logger.info('Test run completed', { runId, ...outcome, results: undefined });
    } catch (err) {
        logger.error('Test run failed unexpectedly', { runId, message: err.message });

        await TestRun.findOneAndUpdate(
            { runId },
            {
                status: TEST_RUN_STATUS.FAILED,
                completedAt: new Date(),
                error: err.message
            }
        ).catch((updateErr) => {
            // If we can't even record the failure, log loudly — this run
            // would otherwise be stuck in RUNNING forever.
            logger.error('Could not mark test run as FAILED after an error', {
                runId,
                message: updateErr.message
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
        startedAt: new Date()
    });

    // Fire-and-forget: do not await. Errors are handled inside
    // executeInBackground so they can never become an unhandled rejection.
    executeInBackground(runId, environment, {
        suites: testRun.suites,
        suiteId: testRun.suiteId,
        testCaseIds: testRun.testCaseIds
    }).catch((err) => {
        logger.error('Unexpected error launching background test execution', {
            runId,
            message: err.message
        });
    });

    logger.info('Test run created', { runId, environment, suites: testRun.suites, suiteId, testCaseIds });

    res.status(202).json({
        message: 'Test run started',
        runId,
        status: TEST_RUN_STATUS.RUNNING
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

    res.json({ success: true, count: runs.length, runs });
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
        .select('title severity category status createdAt')
        .lean();

    res.json({
        success: true,
        run,
        recentFailures
    });
});
