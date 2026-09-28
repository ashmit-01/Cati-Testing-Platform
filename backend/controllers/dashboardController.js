import TestRun from '../models/TestRun.js';
import Failure from '../models/Failure.js';
import TestResult from '../models/TestResult.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const SUITE_NAMES = [
    'API',
    'UI',
    'E2E',
    'WEBSOCKET',
    'AI_VOICE'
];

function normalizeSuite(suite) {
    if (!suite) {
        return 'UNKNOWN';
    }

    const value = String(suite)
        .trim()
        .toUpperCase();

    if (value === 'AI/VOICE') {
        return 'AI_VOICE';
    }

    if (value === 'WEBSOCKET') {
        return 'WEBSOCKET';
    }

    if (SUITE_NAMES.includes(value)) {
        return value;
    }

    return value;
}

function displaySuiteName(suite) {
    switch (suite) {
        case 'AI_VOICE':
            return 'AI / Voice';

        case 'WEBSOCKET':
            return 'WebSocket';

        default:
            return suite;
    }
}

export const getDashboard = asyncHandler(
    async (req, res) => {

        // ---------------------------------------------------------
        // TEST RUNS
        // ---------------------------------------------------------

        const runs = await TestRun.find()
            .sort({ startedAt: -1 })
            .lean();

        const totalRuns =
            runs.length;

        const totalTests =
            runs.reduce(
                (sum, run) =>
                    sum +
                    (Number(run.totalTests) || 0),
                0
            );

        const passedTests =
            runs.reduce(
                (sum, run) =>
                    sum +
                    (Number(run.passed) || 0),
                0
            );

        const failedTests =
            runs.reduce(
                (sum, run) =>
                    sum +
                    (Number(run.failed) || 0),
                0
            );

        const skippedTests =
            runs.reduce(
                (sum, run) =>
                    sum +
                    (Number(run.skipped) || 0),
                0
            );

        const completedRuns =
            runs.filter(
                (run) =>
                    run.status === 'COMPLETED'
            ).length;

        const failedRuns =
            runs.filter(
                (run) =>
                    run.status === 'FAILED'
            ).length;

        const runningRuns =
            runs.filter(
                (run) =>
                    run.status === 'RUNNING'
            ).length;

        const passRate =
            totalTests > 0
                ? Number(
                    (
                        (passedTests /
                            totalTests) *
                        100
                    ).toFixed(2)
                )
                : 0;

        const recentRuns =
            runs.slice(0, 10);

        // ---------------------------------------------------------
        // FAILURE COUNTS
        // ---------------------------------------------------------

        const [
            totalFailures,
            openFailures,
            criticalFailures,
            highFailures
        ] = await Promise.all([
            Failure.countDocuments(),

            Failure.countDocuments({
                status: 'OPEN'
            }),

            Failure.countDocuments({
                severity: 'CRITICAL',
                status: 'OPEN'
            }),

            Failure.countDocuments({
                severity: 'HIGH',
                status: 'OPEN'
            })
        ]);

        // ---------------------------------------------------------
        // RECENT FAILURES
        // ---------------------------------------------------------

        const rawFailures =
            await Failure.find()
                .sort({
                    createdAt: -1
                })
                .limit(10)
                .select(
                    [
                        'runId',
                        'testResultId',
                        'title',
                        'description',
                        'severity',
                        'category',
                        'status',
                        'evidence',
                        'createdAt'
                    ].join(' ')
                )
                .lean();

        /*
         * The Failure document contains testResultId.
         *
         * The TestResult document contains:
         *
         * - testName
         * - suite
         * - status
         * - duration
         * - expected
         * - actual
         * - evidence
         *
         * Therefore we use testResultId to recover the real
         * suite instead of incorrectly using Failure.category.
         */

        const resultIds =
            rawFailures
                .map(
                    (failure) =>
                        failure.testResultId
                )
                .filter(Boolean);

        const testResults =
            resultIds.length > 0
                ? await TestResult.find({
                    _id: {
                        $in: resultIds
                    }
                })
                    .select(
                        [
                            'runId',
                            'testName',
                            'suite',
                            'status',
                            'duration',
                            'expected',
                            'actual',
                            'endpoint',
                            'page',
                            'evidence'
                        ].join(' ')
                    )
                    .lean()
                : [];

        const resultMap =
            new Map(
                testResults.map(
                    (result) => [
                        String(result._id),
                        result
                    ]
                )
            );

        const recentFailures =
            rawFailures.map(
                (failure) => {

                    const result =
                        failure.testResultId
                            ? resultMap.get(
                                String(
                                    failure.testResultId
                                )
                            )
                            : null;

                    return {
                        ...failure,

                        id:
                            failure._id,

                        test:
                            result?.testName ||
                            failure.title ||
                            'Unnamed test',

                        testName:
                            result?.testName ||
                            failure.title ||
                            'Unnamed test',

                        suite:
                            normalizeSuite(
                                result?.suite
                            ),

                        suiteName:
                            displaySuiteName(
                                normalizeSuite(
                                    result?.suite
                                )
                            ),

                        category:
                            failure.category ||
                            'OTHER',

                        severity:
                            failure.severity ||
                            'MEDIUM',

                        status:
                            failure.status ||
                            'OPEN',

                        description:
                            failure.description ||
                            'No failure description available.',

                        expected:
                            result?.expected ??
                            null,

                        actual:
                            result?.actual ??
                            null,

                        endpoint:
                            result?.endpoint ??
                            null,

                        page:
                            result?.page ??
                            null,

                        evidence:
                            failure.evidence ||
                            result?.evidence ||
                            {}
                    };
                }
            );

        // ---------------------------------------------------------
        // SUITE STATISTICS
        // ---------------------------------------------------------

        /*
         * Use TestResult instead of TestRun because TestRun only
         * stores aggregate totals and selected suite names.
         *
         * This gives us real:
         *
         * API
         * UI
         * E2E
         * WebSocket
         * AI / Voice
         *
         * counts.
         */

        const suiteAggregation =
            await TestResult.aggregate([
                {
                    $group: {
                        _id: '$suite',

                        total: {
                            $sum: 1
                        },

                        passed: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$status',
                                            'PASS'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        failed: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$status',
                                            'FAIL'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        skipped: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$status',
                                            'SKIPPED'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

        const suiteMap =
            new Map();

        for (
            const suite of suiteAggregation
        ) {
            const normalized =
                normalizeSuite(
                    suite._id
                );

            suiteMap.set(
                normalized,
                {
                    id: normalized,

                    name:
                        displaySuiteName(
                            normalized
                        ),

                    total:
                        Number(
                            suite.total
                        ) || 0,

                    passed:
                        Number(
                            suite.passed
                        ) || 0,

                    failed:
                        Number(
                            suite.failed
                        ) || 0,

                    skipped:
                        Number(
                            suite.skipped
                        ) || 0
                }
            );
        }

        /*
         * Return all known suites.
         *
         * Even if a suite has never run, it appears with zero
         * values instead of disappearing from the dashboard.
         */

        const suites =
            SUITE_NAMES.map(
                (suite) => {

                    const existing =
                        suiteMap.get(
                            suite
                        );

                    if (existing) {
                        return {
                            ...existing,

                            passRate:
                                existing.total >
                                0
                                    ? Number(
                                        (
                                            (
                                                existing.passed /
                                                existing.total
                                            ) *
                                            100
                                        ).toFixed(2)
                                    )
                                    : 0
                        };
                    }

                    return {
                        id: suite,

                        name:
                            displaySuiteName(
                                suite
                            ),

                        total: 0,

                        passed: 0,

                        failed: 0,

                        skipped: 0,

                        passRate: 0
                    };
                }
            );

        // ---------------------------------------------------------
        // RESPONSE
        // ---------------------------------------------------------

        res.json({
            success: true,

            totalRuns,

            totalTests,

            passedTests,

            failedTests,

            skippedTests,

            passRate,

            completedRuns,

            failedRuns,

            runningRuns,

            totalFailures,

            openFailures,

            criticalFailures,

            highFailures,

            recentRuns,

            recentFailures,

            suites
        });
    }
);