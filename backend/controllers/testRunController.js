import TestRun, { TEST_RUN_STATUS } from '../models/TestRun.js';
import Failure from '../models/Failure.js';

import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { generateRunId } from '../utils/idService.js';

import { runTests } from '../services/testRunnerService.js';
import { processResults } from '../services/resultService.js';
import { processFailures } from '../services/failureService.js';

import { logger } from '../utils/logger.js';


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
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

        suites: Array.isArray(run.suites)
            ? run.suites
            : [],

        suiteId: run.suiteId || null,

        testCaseIds: Array.isArray(run.testCaseIds)
            ? run.testCaseIds
            : [],

        status: run.status,

        startedAt: run.startedAt || null,

        completedAt: run.completedAt || null,

        date: run.startedAt || null,

        totalTests: Number(run.totalTests || 0),
        total: Number(run.totalTests || 0),

        passed: Number(run.passed || 0),
        passedTests: Number(run.passed || 0),

        failed: Number(run.failed || 0),
        failedTests: Number(run.failed || 0),

        skipped: Number(run.skipped || 0),
        skippedTests: Number(run.skipped || 0),

        duration: Number(run.duration || 0),

        executionMode:
            run.executionMode ||
            process.env.TEST_EXECUTION_MODE ||
            'unknown',

        error: run.error || null
    };
}


/*
|--------------------------------------------------------------------------
| Timeout wrapper
|--------------------------------------------------------------------------
|
| This is important.
|
| If Playwright hangs, the MongoDB document must NOT remain RUNNING forever.
|
*/

function withTimeout(promise, timeoutMs, message) {
    let timer;

    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(message));
        }, timeoutMs);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => {
        clearTimeout(timer);
    });
}


/*
|--------------------------------------------------------------------------
| Background Test Execution
|--------------------------------------------------------------------------
*/

async function executeInBackground(
    runId,
    environment,
    {
        suites,
        suiteId,
        testCaseIds
    }
) {
    const startedAt = Date.now();

    try {
        logger.info(
            'Starting background test execution',
            {
                runId,
                environment,
                suites,
                suiteId,
                testCaseIds
            }
        );


        /*
        |--------------------------------------------------------------------------
        | Run Playwright / API tests
        |--------------------------------------------------------------------------
        |
        | IMPORTANT:
        | runTests MUST eventually resolve with:
        |
        | {
        |   totalTests,
        |   passed,
        |   failed,
        |   skipped,
        |   duration,
        |   results
        | }
        |
        */

        const outcome = await withTimeout(
            runTests({
                runId,
                environment,
                suites,
                suiteId,
                testCaseIds
            }),

            /*
             * 15 minutes maximum.
             *
             * Increase this later if your complete test suite genuinely
             * requires more time.
             */
            15 * 60 * 1000,

            `Test execution timed out for run ${runId}`
        );


        logger.info(
            'Test execution returned',
            {
                runId,
                totalTests: outcome?.totalTests,
                passed: outcome?.passed,
                failed: outcome?.failed,
                skipped: outcome?.skipped,
                duration: outcome?.duration,
                resultCount: Array.isArray(outcome?.results)
                    ? outcome.results.length
                    : 0
            }
        );


        /*
        |--------------------------------------------------------------------------
        | Validate runner result
        |--------------------------------------------------------------------------
        */

        if (!outcome) {
            throw new Error(
                'Test runner returned no outcome.'
            );
        }


        const results = Array.isArray(outcome.results)
            ? outcome.results
            : [];


        const totalTests = Number(
            outcome.totalTests ?? results.length ?? 0
        );

        const passed = Number(
            outcome.passed ?? 0
        );

        const failed = Number(
            outcome.failed ?? 0
        );

        const skipped = Number(
            outcome.skipped ?? 0
        );

        const duration = Number(
            outcome.duration ??
            (Date.now() - startedAt)
        );


        /*
        |--------------------------------------------------------------------------
        | Save test results
        |--------------------------------------------------------------------------
        */

        let savedResults = [];

        if (results.length > 0) {

            const processed =
                await processResults(
                    runId,
                    results,
                    environment
                );

            savedResults =
                processed?.savedResults || [];
        }


        /*
        |--------------------------------------------------------------------------
        | Process failures
        |--------------------------------------------------------------------------
        */

        if (savedResults.length > 0) {

            await processFailures(
                savedResults,
                runId
            );
        }


        /*
        |--------------------------------------------------------------------------
        | IMPORTANT:
        | Mark MongoDB run COMPLETED
        |--------------------------------------------------------------------------
        */

        const updatedRun =
            await TestRun.findOneAndUpdate(
                { runId },

                {
                    $set: {
                        status:
                            TEST_RUN_STATUS.COMPLETED,

                        completedAt:
                            new Date(),

                        totalTests,

                        passed,

                        failed,

                        skipped,

                        duration,

                        executionMode:
                            (
                                process.env.TEST_EXECUTION_MODE ||
                                'playwright'
                            ).toLowerCase(),

                        error: null
                    }
                },

                {
                    new: true
                }
            );


        if (!updatedRun) {

            throw new Error(
                `Could not find TestRun ${runId} while completing the run.`
            );
        }


        logger.info(
            'Test run completed successfully',
            {
                runId,
                totalTests,
                passed,
                failed,
                skipped,
                duration
            }
        );

    } catch (err) {

        logger.error(
            'Test run failed unexpectedly',
            {
                runId,
                message: err.message,
                stack: err.stack
            }
        );


        /*
        |--------------------------------------------------------------------------
        | NEVER leave the run stuck in RUNNING
        |--------------------------------------------------------------------------
        */

        try {

            await TestRun.findOneAndUpdate(
                { runId },

                {
                    $set: {
                        status:
                            TEST_RUN_STATUS.FAILED,

                        completedAt:
                            new Date(),

                        duration:
                            Date.now() - startedAt,

                        error:
                            err.message
                    }
                },

                {
                    new: true
                }
            );

        } catch (updateError) {

            logger.error(
                'Could not mark test run as FAILED',
                {
                    runId,
                    message:
                        updateError.message,
                    stack:
                        updateError.stack
                }
            );
        }
    }
}


/*
|--------------------------------------------------------------------------
| POST /api/test-runs
|--------------------------------------------------------------------------
*/

export const createTestRun = asyncHandler(
    async (req, res) => {

        const {
            environment,
            suites,
            suiteId,
            testCaseIds
        } = req.body;


        /*
        |--------------------------------------------------------------------------
        | Validate request
        |--------------------------------------------------------------------------
        */

        if (!environment) {

            throw new ApiError(
                400,
                'Environment is required.'
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Generate external run ID
        |--------------------------------------------------------------------------
        */

        const runId =
            await generateRunId();


        /*
        |--------------------------------------------------------------------------
        | Normalize suites
        |--------------------------------------------------------------------------
        */

        const normalizedSuites =
            Array.isArray(suites)
                ? suites.map(
                    suite =>
                        String(suite).toUpperCase()
                )
                : [];


        /*
        |--------------------------------------------------------------------------
        | Create MongoDB TestRun
        |--------------------------------------------------------------------------
        */

        const testRun =
            await TestRun.create({

                runId,

                environment,

                suites:
                    normalizedSuites,

                suiteId:
                    suiteId || null,

                testCaseIds:
                    Array.isArray(testCaseIds)
                        ? testCaseIds
                        : [],

                status:
                    TEST_RUN_STATUS.RUNNING,

                startedAt:
                    new Date(),

                completedAt:
                    null,

                totalTests:
                    0,

                passed:
                    0,

                failed:
                    0,

                skipped:
                    0,

                duration:
                    0,

                executionMode:
                    (
                        process.env.TEST_EXECUTION_MODE ||
                        'playwright'
                    ).toLowerCase(),

                error:
                    null
            });


        logger.info(
            'Test run created',
            {
                runId,
                environment,
                suites:
                    testRun.suites
            }
        );


        /*
        |--------------------------------------------------------------------------
        | Start test execution
        |--------------------------------------------------------------------------
        |
        | Do NOT await here.
        |
        | The API immediately responds with RUNNING.
        |
        */

        executeInBackground(
            runId,

            environment,

            {
                suites:
                    testRun.suites,

                suiteId:
                    testRun.suiteId,

                testCaseIds:
                    testRun.testCaseIds
            }

        ).catch((err) => {

            /*
             * This should normally never execute because
             * executeInBackground already catches its own errors.
             */

            logger.error(
                'Unexpected background execution error',
                {
                    runId,
                    message:
                        err.message,
                    stack:
                        err.stack
                }
            );
        });


        /*
        |--------------------------------------------------------------------------
        | Return immediately
        |--------------------------------------------------------------------------
        */

        res.status(202).json({

            success:
                true,

            message:
                'Test run started',

            runId,

            status:
                TEST_RUN_STATUS.RUNNING,

            run:
                normalizeRun(
                    testRun.toObject()
                )
        });
    }
);


/*
|--------------------------------------------------------------------------
| GET /api/test-runs
|--------------------------------------------------------------------------
*/

export const listTestRuns =
    asyncHandler(
        async (req, res) => {

            const {
                environment,
                status
            } = req.query;


            const filter = {};


            if (environment) {

                filter.environment =
                    environment;
            }


            if (status) {

                filter.status =
                    status.toUpperCase();
            }


            const limit =
                Math.min(
                    parseInt(
                        req.query.limit,
                        10
                    ) || 50,

                    200
                );


            const runs =
                await TestRun
                    .find(filter)
                    .sort({
                        startedAt: -1
                    })
                    .limit(limit)
                    .lean();


            const normalizedRuns =
                runs.map(
                    normalizeRun
                );


            res.json({

                success:
                    true,

                count:
                    normalizedRuns.length,

                runs:
                    normalizedRuns
            });
        }
    );


/*
|--------------------------------------------------------------------------
| GET /api/test-runs/:id
|--------------------------------------------------------------------------
*/

export const getTestRunById =
    asyncHandler(
        async (req, res) => {

            const {
                id
            } = req.params;


            if (
                !id ||
                id === 'undefined'
            ) {

                throw new ApiError(
                    400,
                    'Invalid test run ID.'
                );
            }


            const run =
                await TestRun
                    .findOne({
                        runId: id
                    })
                    .lean();


            if (!run) {

                throw new ApiError(
                    404,
                    `No test run found with runId "${id}"`
                );
            }


            const recentFailures =
                await Failure
                    .find({
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

                success:
                    true,

                run:
                    normalizeRun(run),

                recentFailures
            });
        }
    );