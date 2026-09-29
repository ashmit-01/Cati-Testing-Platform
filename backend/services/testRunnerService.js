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

/*
 * backend/services
 *      ↓
 * backend
 *      ↓
 * repo root
 */
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/*
 * Maximum time allowed for one Playwright suite.
 *
 * Default = 2 minutes.
 *
 * You can increase this:
 *
 * PLAYWRIGHT_TIMEOUT_MS=180000
 */
const PLAYWRIGHT_TIMEOUT_MS = Number(
    process.env.PLAYWRIGHT_TIMEOUT_MS || 120000
);

/*
 * Additional safety timeout around the complete suite execution.
 *
 * This protects against cases where spawn() itself or some filesystem
 * operation gets stuck and the child-process timeout is never reached.
 */
const SUITE_TOTAL_TIMEOUT_MS = Number(
    process.env.SUITE_TOTAL_TIMEOUT_MS ||
    PLAYWRIGHT_TIMEOUT_MS + 10000
);


// ============================================================================
// SUITE CONFIGURATION
// ============================================================================

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


// ============================================================================
// FILE HELPERS
// ============================================================================

async function findSpecFiles(relativeDir) {
    const absoluteDir = path.join(REPO_ROOT, relativeDir);

    logger.info('Looking for Playwright specs', {
        relativeDir,
        absoluteDir
    });

    try {
        const entries = await readdir(
            absoluteDir,
            { withFileTypes: true }
        );

        const files = entries
            .filter(
                (entry) =>
                    entry.isFile() &&
                    entry.name.endsWith('.spec.js')
            )
            .map(
                (entry) =>
                    path.join(relativeDir, entry.name)
            );

        logger.info('Playwright spec discovery completed', {
            relativeDir,
            count: files.length,
            files
        });

        return files;

    } catch (error) {

        logger.warn(
            'Could not read Playwright suite directory',
            {
                relativeDir,
                absoluteDir,
                message: error.message
            }
        );

        return [];
    }
}


/**
 * Extract test titles from a spec file.
 *
 * This is only used by mock mode.
 */
async function extractTestNames(specFilePath) {
    try {

        const content = await readFile(
            path.join(REPO_ROOT, specFilePath),
            'utf-8'
        );

        const matches = [
            ...content.matchAll(
                /test(?:\.\w+)?\s*\(\s*['"`]([^'"`]+)['"`]/g
            )
        ];

        return matches.map(
            (match) => match[1]
        );

    } catch {

        return [];
    }
}


function slugify(text) {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}


// ============================================================================
// MOCK EXECUTION
// ============================================================================

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


// ============================================================================
// PLAYWRIGHT STATUS
// ============================================================================

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


// ============================================================================
// PLAYWRIGHT JSON PARSER
// ============================================================================

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
                            (attachment) =>
                                attachment.name ===
                                'screenshot'
                        )?.path || null;

                    const trace =
                        attachments.find(
                            (attachment) =>
                                attachment.name ===
                                'trace'
                        )?.path || null;

                    const video =
                        attachments.find(
                            (attachment) =>
                                attachment.name ===
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


// ============================================================================
// PROCESS TERMINATION
// ============================================================================

function killProcessTree(child) {

    if (!child || !child.pid) {
        return;
    }

    logger.warn(
        'Attempting to terminate Playwright process',
        {
            pid: child.pid,
            platform: process.platform
        }
    );

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

                try {
                    child.kill('SIGKILL');
                } catch {
                    // Already dead.
                }
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
            // Already dead.
        }
    }
}


// ============================================================================
// PLAYWRIGHT SUITE EXECUTION
// ============================================================================

async function runPlaywrightForSuite({
    suite,
    environment
}) {

    const dir =
        SUITE_DIRS[suite];

    logger.info(
        'Starting Playwright suite',
        {
            suite,
            dir,
            environment,
            repoRoot: REPO_ROOT
        }
    );

    const specFiles =
        await findSpecFiles(dir);

    /*
     * No spec files is NOT a runner crash.
     * Return a skipped result so the TestRun can complete.
     */
    if (specFiles.length === 0) {

        logger.warn(
            `No Playwright spec files found for suite ${suite}`,
            {
                dir,
                repoRoot: REPO_ROOT
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


    logger.info(
        'Playwright spec files found',
        {
            suite,
            count: specFiles.length,
            specFiles
        }
    );


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


    logger.info(
        'Created Playwright temporary directory',
        {
            suite,
            tmpDir,
            outputFile
        }
    );


    try {

        await new Promise(
            (resolve, reject) => {

                const npxCommand =
                    process.platform === 'win32'
                        ? 'npx.cmd'
                        : 'npx';


                /*
                 * IMPORTANT:
                 *
                 * --no-install prevents npx from trying to download
                 * Playwright in production.
                 *
                 * CI=1 prevents interactive prompts.
                 */
                const args = [

                    '--no-install',

                    'playwright',

                    'test',

                    dir,

                    '--reporter=json'
                ];


                logger.info(
                    'Launching Playwright process',
                    {
                        suite,
                        command:
                            `${npxCommand} ${args.join(' ')}`,

                        cwd:
                            REPO_ROOT,

                        timeoutMs:
                            PLAYWRIGHT_TIMEOUT_MS
                    }
                );


                let stdout = '';

                let stderr = '';

                let settled = false;


                const child =
                    spawn(
                        npxCommand,
                        args,
                        {
                            cwd:
                                REPO_ROOT,

                            env: {
                                ...process.env,

                                CI: '1',

                                TEST_ENV:
                                    environment,

                                PLAYWRIGHT_JSON_OUTPUT_NAME:
                                    outputFile,

                                FORCE_COLOR:
                                    '0'
                            },

                            /*
                             * Linux:
                             * detached=true allows us to kill the
                             * complete process group.
                             *
                             * Windows:
                             * taskkill /T handles the process tree.
                             */
                            detached:
                                process.platform !== 'win32',

                            windowsHide:
                                true,

                            shell:
                                false
                        }
                    );


                logger.info(
                    'Playwright process spawned',
                    {
                        suite,
                        pid: child.pid
                    }
                );


                const finishWithError =
                    (error) => {

                        if (settled) {
                            return;
                        }

                        settled = true;

                        clearTimeout(
                            timeout
                        );

                        reject(error);
                    };


                const timeout =
                    setTimeout(
                        () => {

                            if (settled) {
                                return;
                            }

                            logger.error(
                                'Playwright suite timeout reached',
                                {
                                    suite,
                                    environment,
                                    pid: child.pid,
                                    timeoutMs:
                                        PLAYWRIGHT_TIMEOUT_MS
                                }
                            );

                            killProcessTree(
                                child
                            );

                            finishWithError(
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

                        /*
                         * Do not log the entire Playwright JSON.
                         */
                        logger.debug(
                            'Playwright stdout received',
                            {
                                suite,
                                bytes:
                                    chunk.length
                            }
                        );
                    }
                );


                child.stderr?.on(
                    'data',
                    (chunk) => {

                        stderr +=
                            chunk.toString();

                        logger.debug(
                            'Playwright stderr received',
                            {
                                suite,
                                bytes:
                                    chunk.length
                            }
                        );
                    }
                );


                child.on(
                    'error',
                    (error) => {

                        logger.error(
                            'Playwright child process error',
                            {
                                suite,
                                pid: child.pid,
                                message:
                                    error.message
                            }
                        );

                        finishWithError(
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

                        settled = true;

                        clearTimeout(
                            timeout
                        );


                        logger.info(
                            'Playwright process closed',
                            {
                                suite,
                                pid: child.pid,
                                code,
                                signal,
                                stdoutLength:
                                    stdout.length,
                                stderrLength:
                                    stderr.length
                            }
                        );


                        /*
                         * Playwright uses a non-zero exit code when
                         * tests fail.
                         *
                         * Therefore code !== 0 is NOT automatically
                         * considered a runner error.
                         */
                        resolve();
                    }
                );
            }
        );


        logger.info(
            'Playwright process finished, reading JSON report',
            {
                suite,
                outputFile
            }
        );


        /*
         * The reporter should have written result.json.
         */
        let raw;

        try {

            raw =
                await readFile(
                    outputFile,
                    'utf-8'
                );

        } catch (error) {

            /*
             * Sometimes the JSON reporter may return JSON through
             * stdout but fail to create the output file.
             *
             * Try stdout as a fallback.
             */
            logger.warn(
                'Playwright JSON file could not be read',
                {
                    suite,
                    outputFile,
                    message:
                        error.message,
                    stdoutLength:
                        stdout.length
                }
            );

            if (stdout.trim()) {
                raw = stdout;
            } else {

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
                            `Playwright finished but no JSON report ` +
                            `was produced. ${error.message}`,

                        expected: null,

                        actual: null,

                        endpoint: null,

                        page: null,

                        evidence: {}
                    }
                ];
            }
        }


        let json;

        try {

            json =
                JSON.parse(
                    raw
                );

        } catch (error) {

            logger.error(
                'Could not parse Playwright JSON report',
                {
                    suite,
                    message:
                        error.message,

                    rawLength:
                        raw.length,

                    stderr:
                        stderr.slice(
                            -4000
                        )
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
                        `Invalid Playwright JSON report: ` +
                        `${error.message}`,

                    expected: null,

                    actual: null,

                    endpoint: null,

                    page: null,

                    evidence: {}
                }
            ];
        }


        const results =
            parsePlaywrightJson(
                json,
                suite
            );


        logger.info(
            `Playwright results parsed for ${suite}`,
            {
                suite,

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
         * Never allow a successful Playwright process with an empty
         * report to leave the TestRun at zero tests.
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
                suite,
                environment,
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

        await rm(
            tmpDir,
            {
                recursive: true,
                force: true
            }
        ).catch(
            (error) => {

                logger.debug(
                    'Could not remove Playwright temporary directory',
                    {
                        tmpDir,
                        message:
                            error.message
                    }
                );
            }
        );
    }
}


// ============================================================================
// COMPLETE SUITE SAFETY TIMEOUT
// ============================================================================

async function runSuiteWithTotalTimeout({
    suite,
    environment
}) {

    let timer;

    try {

        const timeoutPromise =
            new Promise(
                (_, reject) => {

                    timer =
                        setTimeout(
                            () => {

                                reject(
                                    new Error(
                                        `Complete suite "${suite}" ` +
                                        `execution exceeded ` +
                                        `${SUITE_TOTAL_TIMEOUT_MS} ms`
                                    )
                                );

                            },
                            SUITE_TOTAL_TIMEOUT_MS
                        );
                }
            );


        return await Promise.race([

            runPlaywrightForSuite({
                suite,
                environment
            }),

            timeoutPromise

        ]);

    } finally {

        if (timer) {
            clearTimeout(timer);
        }
    }
}


// ============================================================================
// PLAYWRIGHT EXECUTION
// ============================================================================

async function runPlaywright({
    environment,
    suites
}) {

    const startedAt =
        Date.now();

    const results = [];


    logger.info(
        'Starting Playwright execution',
        {
            environment,
            suites
        }
    );


    for (
        const suite
        of suites
    ) {

        logger.info(
            'Beginning Playwright suite',
            {
                suite,
                environment
            }
        );


        try {

            const suiteResults =
                await runSuiteWithTotalTimeout({
                    suite,
                    environment
                });


            results.push(
                ...suiteResults
            );


            logger.info(
                'Playwright suite completed',
                {
                    suite,
                    resultCount:
                        suiteResults.length
                }
            );


        } catch (error) {

            logger.error(
                `Suite ${suite} caused an unexpected runner error`,
                {
                    suite,
                    message:
                        error.message,

                    stack:
                        error.stack
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


    logger.info(
        'All Playwright suites completed',
        {
            suites,
            resultCount:
                results.length,
            duration
        }
    );


    return buildSummary(
        results,
        duration
    );
}


// ============================================================================
// SUMMARY
// ============================================================================

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


// ============================================================================
// STORED TEST CASES
// ============================================================================

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
            `test cases. API and UI/E2E use Playwright. ` +
            `WEBSOCKET and AI_VOICE are not built yet.`,

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


// ============================================================================
// PUBLIC ENTRY POINT
// ============================================================================

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


    const resolvedSuites =
        dbDriven
            ? []
            : resolveSuites(suites);


    logger.info(
        'Starting test execution',
        {
            runId,

            environment,

            mode,

            dbDriven,

            suites:
                resolvedSuites,

            suiteId,

            testCaseIds,

            playwrightTimeoutMs:
                PLAYWRIGHT_TIMEOUT_MS,

            suiteTotalTimeoutMs:
                SUITE_TOTAL_TIMEOUT_MS,

            repoRoot:
                REPO_ROOT
        }
    );


    let outcome;


    if (dbDriven) {

        outcome =
            await runStoredTestCases({
                runId,
                environment,
                suiteId,
                testCaseIds
            });

    } else if (mode === 'mock') {

        outcome =
            await runMock({
                runId,

                suites:
                    resolvedSuites
            });

    } else {

        outcome =
            await runPlaywright({
                environment,

                suites:
                    resolvedSuites
            });
    }


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