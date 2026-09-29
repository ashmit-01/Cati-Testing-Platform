import { spawn } from 'child_process';
import { readdir, readFile, mkdtemp, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import { logger } from '../utils/logger.js';
import TestCase from '../models/TestCase.js';
import { checkResult } from './resultCheckerService.js';
import { executeTestCaseWithPlaywright } from './playwrightCaseExecutor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// backend/services -> repo root is two levels up.
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/*
 * Maximum amount of time a single Playwright suite is allowed to run.
 *
 * Default:
 *   2 minutes
 *
 * You can override this with:
 *
 * PLAYWRIGHT_TIMEOUT_MS=180000
 *
 * which would give Playwright 3 minutes.
 */
const PLAYWRIGHT_TIMEOUT_MS = Number(
    process.env.PLAYWRIGHT_TIMEOUT_MS || 120000
);

// ---------------------------------------------------------------------
// SUITE CONFIGURATION
// ---------------------------------------------------------------------

/**
 * Maps the platform's suite enum to the corresponding folder inside
 * test-engine/.
 */
const SUITE_DIRS = Object.freeze({
    API: 'test-engine/api',
    UI: 'test-engine/ui',
    E2E: 'test-engine/e2e',
    WEBSOCKET: 'test-engine/websocket',
    AI_VOICE: 'test-engine/ai'
});

const ALL_SUITES = Object.keys(SUITE_DIRS);

function resolveSuites(requestedSuites) {
    if (!requestedSuites || requestedSuites.length === 0) {
        return ALL_SUITES;
    }

    return requestedSuites
        .map((suite) => String(suite).toUpperCase())
        .filter((suite) => SUITE_DIRS[suite]);
}

async function findSpecFiles(relativeDir) {
    const absoluteDir = path.join(REPO_ROOT, relativeDir);

    try {
        const entries = await readdir(
            absoluteDir,
            { withFileTypes: true }
        );

        return entries
            .filter(
                (entry) =>
                    entry.isFile() &&
                    entry.name.endsWith('.spec.js')
            )
            .map(
                (entry) =>
                    path.join(relativeDir, entry.name)
            );

    } catch (error) {

        logger.debug(
            'Could not read Playwright suite directory',
            {
                relativeDir,
                message: error.message
            }
        );

        return [];
    }
}

// ---------------------------------------------------------------------
// MOCK EXECUTION MODE
// ---------------------------------------------------------------------

/**
 * Extracts test() titles from a spec file.
 */
async function extractTestNames(specFilePath) {

    try {

        const content = await readFile(
            path.join(REPO_ROOT, specFilePath),
            'utf-8'
        );

        const matches = [
            ...content.matchAll(
                /test(?:\.\w+)?\(\s*['"](.+?)['"]/g
            )
        ];

        return matches.map(
            (match) => match[1]
        );

    } catch {

        return [];
    }
}

const MOCK_FAIL_REASONS_BY_SUITE = {

    API: [
        'Expected status code 200 but received 500 from endpoint',
        'Request failed: response body did not match schema',
        'Authentication token was rejected (401 Unauthorized)'
    ],

    UI: [
        "Expected element to be visible: locator('button >> text=Create Agent') not found",
        'Timed out waiting for navigation to /dashboard',
        'Text assertion failed: expected page to contain "0 Credits"'
    ],

    E2E: [
        'Workflow step "Create Agent" failed: draft was not created',
        'End-to-end flow interrupted: dashboard did not reflect new agent'
    ],

    WEBSOCKET: [
        'WebSocket connection closed unexpectedly (code 1006)',
        'Timed out waiting for AI engine socket handshake'
    ],

    AI_VOICE: [
        'Intent recognition returned an unexpected intent',
        'Voice session did not complete the expected conversation goal'
    ]

};

function weightedRandomStatus() {

    const roll = Math.random();

    if (roll < 0.72) {
        return 'PASS';
    }

    if (roll < 0.90) {
        return 'FAIL';
    }

    return 'SKIPPED';
}

async function generateMockResultsForSuite(
    suite,
    runId
) {

    const dir = SUITE_DIRS[suite];

    const specFiles =
        await findSpecFiles(dir);

    let testNames = [];

    for (const specFile of specFiles) {

        // eslint-disable-next-line no-await-in-loop
        const names =
            await extractTestNames(specFile);

        testNames.push(...names);
    }

    if (testNames.length === 0) {

        testNames = [
            `${suite} suite smoke check`
        ];
    }

    return testNames.map(
        (testName) => {

            const status =
                weightedRandomStatus();

            const duration =
                Math.floor(
                    200 +
                    Math.random() * 2500
                );

            const result = {

                testName,

                suite,

                status,

                duration,

                error: null,

                expected: null,

                actual: null,

                endpoint:
                    suite === 'API'
                        ? '/api/mock-endpoint'
                        : null,

                page:
                    suite === 'UI' ||
                    suite === 'E2E'
                        ? '/mock-page'
                        : null,

                evidence: {}

            };

            if (status === 'FAIL') {

                const reasons =
                    MOCK_FAIL_REASONS_BY_SUITE[suite] ||
                    ['Unexpected failure'];

                result.error =
                    reasons[
                        Math.floor(
                            Math.random() *
                            reasons.length
                        )
                    ];

                result.expected =
                    'expected behavior';

                result.actual =
                    'observed behavior did not match';

                result.evidence = {

                    screenshot:
                        `artifacts/${runId}/${slugify(testName)}.png`,

                    trace:
                        `artifacts/${runId}/${slugify(testName)}.zip`,

                    video: null

                };
            }

            return result;
        }
    );
}

function slugify(text) {

    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

async function runMock({
    runId,
    suites
}) {

    const startedAt =
        Date.now();

    const results = [];

    for (const suite of suites) {

        // eslint-disable-next-line no-await-in-loop
        const suiteResults =
            await generateMockResultsForSuite(
                suite,
                runId
            );

        results.push(
            ...suiteResults
        );
    }

    const duration =
        Date.now() - startedAt;

    return buildSummary(
        results,
        duration
    );
}

// ---------------------------------------------------------------------
// REAL PLAYWRIGHT EXECUTION MODE
// ---------------------------------------------------------------------

function mapPlaywrightStatus(status) {

    if (status === 'passed') {
        return 'PASS';
    }

    if (
        status === 'failed' ||
        status === 'timedOut' ||
        status === 'interrupted'
    ) {
        return 'FAIL';
    }

    return 'SKIPPED';
}

/**
 * Parses Playwright JSON reporter output.
 */
function parsePlaywrightJson(
    json,
    suite
) {

    const results = [];

    function walkSuite(
        node,
        filePath
    ) {

        if (node.specs) {

            for (const spec of node.specs) {

                for (const test of spec.tests || []) {

                    const lastResult =
                        test.results?.[
                            test.results.length - 1
                        ];

                    const status =
                        mapPlaywrightStatus(
                            lastResult?.status ||
                            test.status
                        );

                    const errorMessage =
                        lastResult?.error?.message ||
                        lastResult?.errors?.[0]?.message ||
                        null;

                    const attachments =
                        lastResult?.attachments ||
                        [];

                    const screenshot =
                        attachments.find(
                            (a) =>
                                a.name ===
                                'screenshot'
                        )?.path || null;

                    const trace =
                        attachments.find(
                            (a) =>
                                a.name ===
                                'trace'
                        )?.path || null;

                    const video =
                        attachments.find(
                            (a) =>
                                a.name ===
                                'video'
                        )?.path || null;

                    results.push({

                        testName:
                            spec.title,

                        suite,

                        status,

                        duration:
                            lastResult?.duration ||
                            0,

                        error:
                            errorMessage,

                        expected: null,

                        actual: null,

                        endpoint: null,

                        page:
                            filePath ||
                            null,

                        evidence: {

                            screenshot,

                            trace,

                            video

                        }

                    });
                }
            }
        }

        for (
            const child
            of node.suites || []
        ) {

            walkSuite(
                child,
                node.file ||
                filePath
            );
        }
    }

    for (
        const suiteNode
        of json.suites || []
    ) {

        walkSuite(
            suiteNode,
            suiteNode.file
        );
    }

    return results;
}

// ---------------------------------------------------------------------
// PROCESS TERMINATION HELPERS
// ---------------------------------------------------------------------

/**
 * Kill a Playwright process safely.
 *
 * Windows:
 *   taskkill kills the whole process tree.
 *
 * Linux/macOS:
 *   kill the process group first.
 */
function killProcessTree(child) {

    if (!child || !child.pid) {
        return;
    }

    try {

        if (process.platform === 'win32') {

            spawn(
                'taskkill',
                [
                    '/pid',
                    String(child.pid),
                    '/T',
                    '/F'
                ],
                {
                    windowsHide: true
                }
            );

        } else {

            try {

                process.kill(
                    -child.pid,
                    'SIGKILL'
                );

            } catch {

                child.kill(
                    'SIGKILL'
                );
            }
        }

    } catch (error) {

        logger.warn(
            'Failed to kill Playwright process tree',
            {
                pid: child.pid,
                message: error.message
            }
        );

        try {
            child.kill('SIGKILL');
        } catch {
            // Process may already be dead.
        }
    }
}

// ---------------------------------------------------------------------
// REAL PLAYWRIGHT SUITE EXECUTION
// ---------------------------------------------------------------------

async function runPlaywrightForSuite({
    suite,
    environment
}) {

    const dir =
        SUITE_DIRS[suite];

    const specFiles =
        await findSpecFiles(dir);

    if (specFiles.length === 0) {

        logger.warn(
            `No Playwright spec files found for suite ${suite}`,
            {
                dir
            }
        );

        return [

            {

                testName:
                    `${suite} suite`,

                suite,

                status:
                    'SKIPPED',

                duration:
                    0,

                error:
                    `No test files found under ${dir}. ` +
                    `Add .spec.js files to enable this suite.`,

                expected: null,

                actual: null,

                endpoint: null,

                page: null,

                evidence: {}

            }

        ];
    }

    const tmpDir =
        await mkdtemp(
            path.join(
                os.tmpdir(),
                'qa-playwright-'
            )
        );

    const outputFile =
        path.join(
            tmpDir,
            'result.json'
        );

    try {

        await new Promise(
            (resolve, reject) => {

                /*
                 * Windows requires npx.cmd.
                 * Linux/macOS use npx.
                 */
                const npxCommand =
                    process.platform === 'win32'
                        ? 'npx.cmd'
                        : 'npx';

                const child =
                    spawn(
                        npxCommand,
                        [
                            'playwright',
                            'test',
                            dir,
                            '--reporter=json'
                        ],
                        {
                            cwd:
                                REPO_ROOT,

                            env: {
                                ...process.env,

                                TEST_ENV:
                                    environment,

                                PLAYWRIGHT_JSON_OUTPUT_NAME:
                                    outputFile
                            },

                            /*
                             * Create a process group so we can
                             * terminate child processes as well.
                             */
                            detached:
                                process.platform !== 'win32',

                            windowsHide:
                                true
                        }
                    );

                let stderr = '';

                let stdout = '';

                let settled =
                    false;

                /*
                 * Hard timeout.
                 *
                 * This is the important fix for the
                 * "RUNNING forever" problem.
                 */
                const timeout =
                    setTimeout(
                        () => {

                            if (settled) {
                                return;
                            }

                            settled =
                                true;

                            logger.error(
                                `Playwright suite timed out: ${suite}`,
                                {
                                    timeoutMs:
                                        PLAYWRIGHT_TIMEOUT_MS,

                                    suite,

                                    environment,

                                    pid:
                                        child.pid
                                }
                            );

                            killProcessTree(
                                child
                            );

                            reject(
                                new Error(
                                    `Playwright suite "${suite}" ` +
                                    `timed out after ` +
                                    `${PLAYWRIGHT_TIMEOUT_MS} ms`
                                )
                            );

                        },
                        PLAYWRIGHT_TIMEOUT_MS
                    );

                child.stdout?.on(
                    'data',
                    (chunk) => {

                        stdout +=
                            chunk.toString();
                    }
                );

                child.stderr?.on(
                    'data',
                    (chunk) => {

                        stderr +=
                            chunk.toString();
                    }
                );

                child.on(
                    'error',
                    (error) => {

                        if (settled) {
                            return;
                        }

                        settled =
                            true;

                        clearTimeout(
                            timeout
                        );

                        reject(
                            error
                        );
                    }
                );

                child.on(
                    'close',
                    (
                        code,
                        signal
                    ) => {

                        if (settled) {
                            return;
                        }

                        settled =
                            true;

                        clearTimeout(
                            timeout
                        );

                        /*
                         * Playwright returns a non-zero exit code
                         * when tests fail.
                         *
                         * That is NOT a runner error.
                         *
                         * We still parse the JSON report.
                         */
                        logger.info(
                            `Playwright process closed for ${suite}`,
                            {
                                suite,

                                code,

                                signal,

                                stdoutLength:
                                    stdout.length,

                                stderrLength:
                                    stderr.length
                            }
                        );

                        if (stderr) {

                            logger.debug(
                                `Playwright stderr for ${suite}`,
                                {
                                    stderr
                                }
                            );
                        }

                        resolve();
                    }
                );
            }
        );

        /*
         * The Playwright process finished.
         * Now read the generated JSON report.
         */
        const raw =
            await readFile(
                outputFile,
                'utf-8'
            );

        const json =
            JSON.parse(raw);

        const results =
            parsePlaywrightJson(
                json,
                suite
            );

        logger.info(
            `Playwright execution completed for suite ${suite}`,
            {
                tests:
                    results.length,

                passed:
                    results.filter(
                        (result) =>
                            result.status ===
                            'PASS'
                    ).length,

                failed:
                    results.filter(
                        (result) =>
                            result.status ===
                            'FAIL'
                    ).length,

                skipped:
                    results.filter(
                        (result) =>
                            result.status ===
                            'SKIPPED'
                    ).length
            }
        );

        /*
         * If Playwright produced no results,
         * return an explicit failure instead of
         * silently returning zero tests.
         */
        if (results.length === 0) {

            return [

                {

                    testName:
                        `${suite} suite execution`,

                    suite,

                    status:
                        'FAIL',

                    duration:
                        0,

                    error:
                        `Playwright completed but produced ` +
                        `no test results.`,

                    expected: null,

                    actual: null,

                    endpoint: null,

                    page: null,

                    evidence: {}

                }

            ];
        }

        return results;

    } catch (error) {

        logger.error(
            `Playwright execution failed for suite ${suite}`,
            {
                message:
                    error.message,

                stack:
                    error.stack
            }
        );

        return [

            {

                testName:
                    `${suite} suite execution`,

                suite,

                status:
                    'FAIL',

                duration:
                    0,

                error:
                    `Suite execution error: ${error.message}`,

                expected: null,

                actual: null,

                endpoint: null,

                page: null,

                evidence: {}

            }

        ];

    } finally {

        /*
         * Always clean temporary files.
         */
        await rm(
            tmpDir,
            {
                recursive: true,
                force: true
            }
        ).catch(
            () => {}
        );
    }
}

// ---------------------------------------------------------------------
// PLAYWRIGHT EXECUTION
// ---------------------------------------------------------------------

async function runPlaywright({
    environment,
    suites
}) {

    const startedAt =
        Date.now();

    const results = [];

    for (
        const suite
        of suites
    ) {

        try {

            /*
             * Suites intentionally run sequentially.
             */
            const suiteResults =
                await runPlaywrightForSuite({
                    suite,
                    environment
                });

            results.push(
                ...suiteResults
            );

        } catch (error) {

            /*
             * Final safety net.
             */
            logger.error(
                `Suite ${suite} caused an unexpected runner error`,
                {
                    message:
                        error.message
                }
            );

            results.push({

                testName:
                    `${suite} suite execution`,

                suite,

                status:
                    'FAIL',

                duration:
                    0,

                error:
                    `Suite runner error: ${error.message}`,

                expected: null,

                actual: null,

                endpoint: null,

                page: null,

                evidence: {}

            });
        }
    }

    const duration =
        Date.now() -
        startedAt;

    return buildSummary(
        results,
        duration
    );
}

// ---------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------

function buildSummary(
    results,
    duration
) {

    const safeResults =
        Array.isArray(results)
            ? results
            : [];

    const summary =
        safeResults.reduce(
            (
                acc,
                result
            ) => {

                acc.totalTests += 1;

                if (
                    result.status ===
                    'PASS'
                ) {

                    acc.passed += 1;

                } else if (
                    result.status ===
                    'FAIL'
                ) {

                    acc.failed += 1;

                } else {

                    acc.skipped += 1;
                }

                return acc;

            },
            {
                totalTests: 0,
                passed: 0,
                failed: 0,
                skipped: 0
            }
        );

    return {

        ...summary,

        duration:
            Number(duration) || 0,

        results:
            safeResults

    };
}

// ---------------------------------------------------------------------
// STORED TEST CASE EXECUTION
// ---------------------------------------------------------------------

async function resolveTestCases({
    suiteId,
    testCaseIds
}) {

    if (
        testCaseIds &&
        testCaseIds.length > 0
    ) {

        return TestCase.find(
            {
                _id: {
                    $in:
                        testCaseIds
                },

                active:
                    true
            }
        ).lean();
    }

    if (suiteId) {

        return TestCase.find(
            {
                suiteId,

                active:
                    true
            }
        ).lean();
    }

    return [];
}

/**
 * Mock-mode executor for stored test cases.
 */
function runTestCaseMock(
    testCase,
    runId
) {

    const shouldPass =
        Math.random() <
        0.75;

    const actual =
        shouldPass
            ? testCase.expectedResult
            : `unexpected result for ${testCase.testCaseId}`;

    const {
        status,
        reason
    } =
        checkResult(
            testCase.expectedResult,
            actual
        );

    const duration =
        Math.floor(
            150 +
            Math.random() *
            1800
        );

    const result = {

        testCaseId:
            testCase._id,

        testName:
            testCase.name,

        suite:
            testCase.type,

        duration,

        expected:
            testCase.expectedResult,

        actual,

        status,

        error:
            reason,

        endpoint:
            null,

        page:
            null,

        evidence:
            {}

    };

    if (
        status ===
        'FAIL'
    ) {

        result.evidence = {

            screenshot:
                `artifacts/${runId}/${slugify(testCase.testCaseId)}.png`,

            trace:
                `artifacts/${runId}/${slugify(testCase.testCaseId)}.zip`,

            video:
                null

        };
    }

    return result;
}

/**
 * Placeholder for real execution of stored test cases
 * that do not yet have a dedicated executor.
 */
function runTestCasePlaceholder(
    testCase
) {

    return {

        testCaseId:
            testCase._id,

        testName:
            testCase.name,

        suite:
            testCase.type,

        duration:
            0,

        expected:
            testCase.expectedResult,

        actual:
            null,

        status:
            'SKIPPED',

        error:
            `No real execution engine exists yet for ${testCase.type} ` +
            `test cases (API and UI/E2E run on real Playwright; ` +
            `WEBSOCKET and AI_VOICE are not built yet).`,

        endpoint:
            null,

        page:
            null,

        evidence:
            {}

    };
}

async function runStoredTestCases({
    runId,
    environment,
    suiteId,
    testCaseIds
}) {

    const startedAt =
        Date.now();

    const testCases =
        await resolveTestCases({
            suiteId,
            testCaseIds
        });

    if (
        testCases.length ===
        0
    ) {

        logger.warn(
            'No matching active test cases found for this run',
            {
                runId,
                suiteId,
                testCaseIds
            }
        );
    }

    const mode =
        (
            process.env.TEST_EXECUTION_MODE ||
            'mock'
        ).toLowerCase();

    const results = [];

    for (
        const testCase
        of testCases
    ) {

        if (
            mode ===
            'mock'
        ) {

            results.push(
                runTestCaseMock(
                    testCase,
                    runId
                )
            );

            continue;
        }

        /*
         * Real mode.
         *
         * API and UI/E2E cases use the real Playwright
         * case executor.
         *
         * WEBSOCKET and AI_VOICE currently remain skipped
         * until their dedicated executors exist.
         */
        try {

            // eslint-disable-next-line no-await-in-loop
            const real =
                await executeTestCaseWithPlaywright(
                    testCase,
                    runId
                );

            results.push(
                real ||
                runTestCasePlaceholder(
                    testCase
                )
            );

        } catch (error) {

            logger.error(
                'Stored test case execution failed',
                {
                    runId,

                    testCaseId:
                        testCase._id,

                    testName:
                        testCase.name,

                    message:
                        error.message
                }
            );

            results.push({

                testCaseId:
                    testCase._id,

                testName:
                    testCase.name,

                suite:
                    testCase.type,

                duration:
                    0,

                expected:
                    testCase.expectedResult,

                actual:
                    null,

                status:
                    'FAIL',

                error:
                    `Test execution error: ${error.message}`,

                endpoint:
                    null,

                page:
                    null,

                evidence:
                    {}

            });
        }
    }

    const duration =
        Date.now() -
        startedAt;

    return buildSummary(
        results,
        duration
    );
}

// ---------------------------------------------------------------------
// PUBLIC ENTRY POINT
// ---------------------------------------------------------------------

/**
 * Executes a test run and returns a normalized result structure.
 *
 * Two execution paths:
 *
 * 1. DB-driven:
 *    suiteId and/or testCaseIds
 *
 * 2. Legacy suite-folder:
 *    API/UI/E2E/WEBSOCKET/AI_VOICE
 */
export async function runTests({
    runId,
    environment,
    suites,
    suiteId,
    testCaseIds
}) {

    const mode =
        (
            process.env.TEST_EXECUTION_MODE ||
            'mock'
        ).toLowerCase();

    const dbDriven =
        Boolean(
            suiteId ||
            (
                testCaseIds &&
                testCaseIds.length > 0
            )
        );

    logger.info(
        'Starting test execution',
        {
            runId,

            environment,

            mode,

            dbDriven,

            suites:
                dbDriven
                    ? undefined
                    : resolveSuites(suites),

            suiteId,

            testCaseIds,

            playwrightTimeoutMs:
                PLAYWRIGHT_TIMEOUT_MS
        }
    );

    const outcome =
        dbDriven

            ? await runStoredTestCases({
                runId,
                environment,
                suiteId,
                testCaseIds
            })

            : mode === 'mock'

                ? await runMock({
                    runId,
                    suites:
                        resolveSuites(
                            suites
                        )
                })

                : await runPlaywright({
                    environment,
                    suites:
                        resolveSuites(
                            suites
                        )
                });

    logger.info(
        'Test execution finished',
        {
            runId,

            totalTests:
                outcome.totalTests,

            passed:
                outcome.passed,

            failed:
                outcome.failed,

            skipped:
                outcome.skipped,

            duration:
                outcome.duration
        }
    );

    return outcome;
}

export const AVAILABLE_SUITES =
    ALL_SUITES;