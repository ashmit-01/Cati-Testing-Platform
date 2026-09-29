import TestRun, { TEST_RUN_STATUS } from '../models/TestRun.js';
import Failure from '../models/Failure.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { generateRunId } from '../utils/idService.js';
import { runTests } from '../services/testRunnerService.js';
import { processResults } from '../services/resultService.js';
import { processFailures } from '../services/failureService.js';
import { logger } from '../utils/logger.js';


/**
 * Normalize a TestRun document before sending it to the frontend.
 *
 * This keeps the frontend independent from MongoDB field names.
 */
function normalizeRun(run) {
    if (!run) {
        return null;
    }

    return {
        id: run.runId,
        runId: run.runId,

        mongoId: run._id,

        environment: run.environment,

        suites: run.suites || [],
        suiteId: run.suiteId || null,
        testCaseIds: run.testCaseIds || [],

        status: run.status,

        startedAt: run.startedAt,
        completedAt: run.completedAt || null,

        date: run.startedAt,

        totalTests: run.totalTests || 0,
        total: run.totalTests || 0,

        passed: run.passed || 0,
        passedTests: run.passed || 0,

        failed: run.failed || 0,
        failedTests: run.failed || 0,

        skipped: run.skipped || 0,
        skippedTests: run.skipped || 0,

        duration: run.duration || 0,

        executionMode: run.executionMode || 'unknown',

        error: run.error || null
    };
}


/**
 * Runs the full test execution pipeline.
 *
 * IMPORTANT:
 * This is currently executed in the background.
 * For local development this is fine.
 *
 * For production/serverless deployment, this should eventually
 * be moved to a real worker/queue system.
 */
async function executeInBackground(
    runId,
    environment,
    { suites, suiteId, testCaseIds }
) {
    try {
        logger.info('Starting background test execution', {
            runId,
            environment,
            suites,
            suiteId,
            testCaseIds
        });

        const outcome = await runTests({
            runId,
            environment,
            suites,
            suiteId,
            testCaseIds
        });

        logger.info('Test execution finished', {
            runId,
            totalTests: outcome.totalTests,
            passed: outcome.passed,
            failed: outcome.failed,
            skipped: outcome.skipped,
            duration: outcome.duration
        });

        const { savedResults } = await processResults(
            runId,
            outcome.results,
            environment
        );

        await processFailures(
            savedResults,
            runId
        );

        await TestRun.findOneAndUpdate(
            { runId },
            {
                status: TEST_RUN_STATUS.COMPLETED,
                completedAt: new Date(),

                totalTests: outcome.totalTests || 0,
                passed: outcome.passed || 0,
                failed: outcome.failed || 0,
                skipped: outcome.skipped || 0,

                duration: outcome.duration || 0,

                executionMode: (
                    process.env.TEST_EXECUTION_MODE || 'mock'
                ).toLowerCase()
            }
        );

        logger.info('Test run completed successfully', {
            runId
        });

    } catch (err) {

        logger.error(
            'Test run failed unexpectedly',
            {
                runId,
                message: err.message,
                stack: err.stack
            }
        );

        await TestRun.findOneAndUpdate(
            { runId },
            {
                status: TEST_RUN_STATUS.FAILED,
                completedAt: new Date(),
                error: err.message
            }
        ).catch((updateErr) => {

            logger.error(
                'Could not mark test run as FAILED',
                {
                    runId,
                    message: updateErr.message
                }
            );

        });
    }
}


/**
 * POST /api/test-runs
 *
 * Creates a new test run.
 */
export const createTestRun = asyncHandler(
    async (req, res) => {

        const {
            environment,
            suites,
            suiteId,
            testCaseIds
        } = req.body;

        const runId = await generateRunId();

        const testRun = await TestRun.create({
            runId,

            environment,

            suites: Array.isArray(suites)
                ? suites.map((suite) =>
                    String(suite).toUpperCase()
                )
                : [],

            suiteId: suiteId || null,

            testCaseIds: Array.isArray(testCaseIds)
                ? testCaseIds
                : [],

            status: TEST_RUN_STATUS.RUNNING,

            startedAt: new Date(),

            totalTests: 0,
            passed: 0,
            failed: 0,
            skipped: 0,

            duration: 0,

            executionMode: (
                process.env.TEST_EXECUTION_MODE || 'mock'
            ).toLowerCase()
        });

        logger.info(
            'Test run created',
            {
                runId,
                environment,
                suites: testRun.suites
            }
        );


        /*
         * Start execution.
         *
         * LOCAL:
         * This works because the Node process remains alive.
         *
         * PRODUCTION:
         * On Vercel/serverless this is NOT reliable.
         * A queue/worker should eventually handle this.
         */
        executeInBackground(
            runId,
            environment,
            {
                suites: testRun.suites,
                suiteId: testRun.suiteId,
                testCaseIds: testRun.testCaseIds
            }
        ).catch((err) => {

            logger.error(
                'Unexpected error launching background execution',
                {
                    runId,
                    message: err.message
                }
            );

        });


        res.status(202).json({
            success: true,

            message: 'Test run started',

            runId,

            status: TEST_RUN_STATUS.RUNNING,

            run: normalizeRun(
                testRun.toObject()
            )
        });
    }
);


/**
 * GET /api/test-runs
 *
 * Returns recent test runs.
 */
export const listTestRuns = asyncHandler(
    async (req, res) => {

        const {
            environment,
            status
        } = req.query;

        const filter = {};

        if (environment) {
            filter.environment = environment;
        }

        if (status) {
            filter.status = status.toUpperCase();
        }

        const limit = Math.min(
            parseInt(req.query.limit, 10) || 50,
            200
        );

        const runs = await TestRun.find(filter)
            .sort({ startedAt: -1 })
            .limit(limit)
            .lean();


        const normalizedRuns = runs.map(
            normalizeRun
        );


        res.json({
            success: true,

            count: normalizedRuns.length,

            runs: normalizedRuns
        });
    }
);


/**
 * GET /api/test-runs/:id
 *
 * :id is the external runId.
 *
 * Example:
 *
 * /api/test-runs/RUN-20260929-002
 */
export const getTestRunById = asyncHandler(
    async (req, res) => {

        const { id } = req.params;

        if (!id || id === 'undefined') {
            throw new ApiError(
                400,
                'Invalid test run ID.'
            );
        }


        const run = await TestRun.findOne({
            runId: id
        }).lean();


        if (!run) {
            throw new ApiError(
                404,
                `No test run found with runId "${id}"`
            );
        }


        const recentFailures =
            await Failure.find({
                runId: id
            })
                .sort({
                    createdAt: -1
                })
                .limit(10)
                .select(
                    'title description severity category status createdAt'
                )
                .lean();


        res.json({
            success: true,

            run: normalizeRun(run),

            recentFailures
        });
    }
);