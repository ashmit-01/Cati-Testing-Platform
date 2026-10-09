import { spawn } from 'child_process';
import {
    readdir,
    readFile,
    mkdtemp,
    rm
} from 'fs/promises';
import path from 'path';
import os from 'os';
import {
    fileURLToPath
} from 'url';

import { logger } from '../utils/logger.js';
import TestCase from '../models/TestCase.js';
import { checkResult } from './resultCheckerService.js';
import {
    executeTestCaseWithPlaywright
} from './playwrightCaseExecutor.js';

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

// backend/services -> repo root
const REPO_ROOT = path.resolve(
    __dirname,
    '..',
    '..'
);

// ---------------------------------------------------------
// TIMEOUT CONFIGURATION
// ---------------------------------------------------------

const PLAYWRIGHT_TIMEOUT_MS = Number(
    process.env.PLAYWRIGHT_TIMEOUT_MS || 60000
);

const SPEC_TIMEOUT_MS = Number(
    process.env.PLAYWRIGHT_SPEC_TIMEOUT_MS || 600000
);

// ---------------------------------------------------------
// SUITE CONFIGURATION
// ---------------------------------------------------------

const SUITE_DIRS = Object.freeze({
    API: 'test-engine/api',
    UI: 'test-engine/ui',
    E2E: 'test-engine/e2e',

    // AI + WebSocket integration
    WEBSOCKET: 'test-engine/websocket',
    AI_VOICE: 'test-engine/ai'
});

const ALL_SUITES = Object.keys(SUITE_DIRS);

// ---------------------------------------------------------
// SUITE HELPERS
// ---------------------------------------------------------

function resolveSuites(requestedSuites) {
    if (
        !requestedSuites ||
        requestedSuites.length === 0
    ) {
        return ALL_SUITES;
    }

    return requestedSuites
        .map((suite) => String(suite).toUpperCase())
        .filter((suite) => SUITE_DIRS[suite]);
}

// ---------------------------------------------------------
// FIND PLAYWRIGHT SPEC FILES
// ---------------------------------------------------------

function resolvePlaywrightProject(suite, specFile) {
    const normalized = String(specFile).replace(/\\/g, '/').toLowerCase();
    const suiteUpper = String(suite || '').toUpperCase();
    if (suiteUpper === 'API' || normalized.includes('/api/')) {
        return 'api';
    }
    if (suiteUpper === 'WEBSOCKET' || normalized.includes('/websocket/')) {
        return 'websocket';
    }
    if (suiteUpper === 'AI_VOICE' || normalized.includes('/ai/')) {
        return 'ai';
    }
    if (normalized.includes('login.spec.js') || normalized.includes('landing.spec.js')) {
        return 'unauthenticated';
    }
    return 'chromium';
}

async function findSpecFiles(relativeDir) {
    const absoluteDir = path.join(
        REPO_ROOT,
        relativeDir
    );

    async function scan(currentRelative) {
        const currentAbsolute = path.join(REPO_ROOT, currentRelative);
        try {
            const entries = await readdir(currentAbsolute, { withFileTypes: true });
            const found = [];
            for (const entry of entries) {
                const subRelative = path.join(currentRelative, entry.name);
                if (entry.isDirectory()) {
                    if (!['node_modules', '.git', 'data', 'fixtures', 'helpers'].includes(entry.name)) {
                        const nested = await scan(subRelative);
                        found.push(...nested);
                    }
                } else if (entry.isFile() && entry.name.endsWith('.spec.js')) {
                    found.push(subRelative);
                }
            }
            return found;
        } catch {
            return [];
        }
    }

    try {
        logger.info(
            'Looking for Playwright specs',
            {
                relativeDir,
                absoluteDir
            }
        );

        const files = await scan(relativeDir);

        logger.info(
            'Playwright spec discovery completed',
            {
                relativeDir,
                count: files.length,
                files
            }
        );

        return files;
    } catch (error) {
        logger.error(
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

// ---------------------------------------------------------
// SLUGIFY
// ---------------------------------------------------------

function slugify(text) {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// ---------------------------------------------------------
// PLAYWRIGHT RESULT STATUS
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// PARSE PLAYWRIGHT JSON
// ---------------------------------------------------------

function parsePlaywrightJson(
    json,
    suite,
    specFile
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
                        lastResult?.attachments || [];

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
                            spec.title ||
                            test.title ||
                            path.basename(specFile),

                        suite,

                        status,

                        duration:
                            lastResult?.duration || 0,

                        error: errorMessage,

                        expected: null,

                        actual: null,

                        endpoint: null,

                        page:
                            filePath ||
                            specFile ||
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

        for (const child of node.suites || []) {
            walkSuite(
                child,
                node.file || filePath
            );
        }
    }

    for (const suiteNode of json.suites || []) {
        walkSuite(
            suiteNode,
            suiteNode.file || specFile
        );
    }

    return results;
}

// ---------------------------------------------------------
// BUILD SUMMARY
// ---------------------------------------------------------

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
            (acc, result) => {
                acc.totalTests += 1;

                if (
                    result.status === 'PASS'
                ) {
                    acc.passed += 1;
                } else if (
                    result.status === 'FAIL'
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
        results: safeResults
    };
}

// ---------------------------------------------------------
// KILL PLAYWRIGHT PROCESS TREE
// ---------------------------------------------------------

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
                try {
                    child.kill('SIGKILL');
                } catch {
                    // Already stopped.
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
            // Already stopped.
        }
    }
}

// =========================================================
// REAL PLAYWRIGHT EXECUTION
// =========================================================

// ---------------------------------------------------------
// RUN ONE SPEC FILE
// ---------------------------------------------------------

async function runSinglePlaywrightSpec({
    suite,
    environment,
    specFile
}) {
    const startedAt = Date.now();

    const tmpDir = await mkdtemp(
        path.join(
            os.tmpdir(),
            'qa-playwright-'
        )
    );

    const outputFile = path.join(
        tmpDir,
        'result.json'
    );

    logger.info(
        'Starting individual Playwright spec',
        {
            suite,
            specFile,
            environment,
            timeoutMs:
                SPEC_TIMEOUT_MS
        }
    );

    try {
        await new Promise(
            (resolve, reject) => {
                const command =
                    process.platform === 'win32'
                        ? 'npx.cmd'
                        : 'npx';

                /*
                 * IMPORTANT:
                 *
                 * This specFile MUST be included here.
                 *
                 * Previously the runner created `args`
                 * containing specFile but then ignored `args`
                 * and launched the whole Playwright suite.
                 *
                 * That is what caused:
                 *
                 * agents.spec.js
                 *      -> Running 41 tests
                 *
                 * bulk-calling.spec.js
                 *      -> Running 41 tests
                 *
                 * calls.spec.js
                 *      -> Running 41 tests
                 */
                const targetProject = resolvePlaywrightProject(suite, specFile);
                const args = [
                    'playwright',
                    'test',
                    specFile,
                    `--project=${targetProject}`,
                    '--reporter=json',
                    '--workers=1',
                    '--timeout=30000'
                ];

                logger.info(
                    'Launching individual Playwright spec',
                    {
                        suite,
                        specFile,
                        command:
                            `${command} ${args.join(' ')}`,
                        cwd: REPO_ROOT
                    }
                );

                const child = spawn(
                    command,
                    args,
                    {
                        cwd: REPO_ROOT,

                        env: {
                            ...process.env,

                            CI: 'true',

                            TEST_ENV:
                                environment,

                            PLAYWRIGHT_JSON_OUTPUT_FILE:
                                outputFile,

                            PLAYWRIGHT_BROWSERS_PATH:
                                process.env
                                    .PLAYWRIGHT_BROWSERS_PATH ||
                                '0'
                        },

                        detached:
                            process.platform !==
                            'win32',

                        windowsHide: true
                    }
                );

                let stdout = '';
                let stderr = '';
                let settled = false;

                const timeout =
                    setTimeout(
                        () => {
                            if (settled) {
                                return;
                            }

                            settled = true;

                            logger.error(
                                'Individual Playwright spec timed out',
                                {
                                    suite,
                                    specFile,
                                    timeoutMs:
                                        SPEC_TIMEOUT_MS,
                                    pid:
                                        child.pid,
                                    stdout,
                                    stderr
                                }
                            );

                            killProcessTree(
                                child
                            );

                            reject(
                                new Error(
                                    `Playwright spec "${specFile}" ` +
                                    `timed out after ` +
                                    `${SPEC_TIMEOUT_MS} ms`
                                )
                            );
                        },
                        SPEC_TIMEOUT_MS
                    );

                child.stdout?.on(
                    'data',
                    (chunk) => {
                        const text =
                            chunk.toString();

                        stdout += text;

                        logger.debug(
                            'Playwright stdout received',
                            {
                                suite,
                                specFile,
                                bytes:
                                    Buffer.byteLength(
                                        text
                                    )
                            }
                        );
                    }
                );

                child.stderr?.on(
                    'data',
                    (chunk) => {
                        const text =
                            chunk.toString();

                        stderr += text;

                        logger.warn(
                            'Playwright stderr received',
                            {
                                suite,
                                specFile,
                                message:
                                    text.trim()
                            }
                        );
                    }
                );

                child.on(
                    'error',
                    (error) => {
                        if (settled) {
                            return;
                        }

                        settled = true;

                        clearTimeout(
                            timeout
                        );

                        reject(error);
                    }
                );

                child.on(
                    'close',
                    (code, signal) => {
                        if (settled) {
                            return;
                        }

                        settled = true;

                        clearTimeout(
                            timeout
                        );

                        logger.info(
                            'Playwright spec process closed',
                            {
                                suite,
                                specFile,
                                code,
                                signal,
                                stdoutLength:
                                    stdout.length,
                                stderrLength:
                                    stderr.length
                            }
                        );

                        /*
                         * A non-zero Playwright exit code
                         * normally means one or more tests failed.
                         *
                         * The process itself completed correctly,
                         * so we still parse the JSON report.
                         */
                        resolve();
                    }
                );
            }
        );

        // -------------------------------------------------
        // READ JSON REPORT
        // -------------------------------------------------

        let raw;

        try {
            raw = await readFile(
                outputFile,
                'utf-8'
            );
        } catch (error) {
            logger.error(
                'Playwright JSON report was not generated',
                {
                    suite,
                    specFile,
                    message:
                        error.message
                }
            );

            return [
                {
                    testName:
                        `${path.basename(
                            specFile
                        )} execution`,

                    suite,

                    status: 'FAIL',

                    duration:
                        Date.now() -
                        startedAt,

                    error:
                        `Playwright finished without ` +
                        `producing JSON report. ` +
                        `${error.message}`,

                    expected: null,

                    actual: null,

                    endpoint: null,

                    page: specFile,

                    evidence: {}
                }
            ];
        }

        // -------------------------------------------------
        // PARSE JSON
        // -------------------------------------------------

        let json;

        try {
            json = JSON.parse(raw);
        } catch (error) {
            logger.error(
                'Invalid Playwright JSON report',
                {
                    suite,
                    specFile,
                    message:
                        error.message
                }
            );

            return [
                {
                    testName:
                        `${path.basename(
                            specFile
                        )} execution`,

                    suite,

                    status: 'FAIL',

                    duration:
                        Date.now() -
                        startedAt,

                    error:
                        `Invalid Playwright JSON report: ` +
                        `${error.message}`,

                    expected: null,

                    actual: null,

                    endpoint: null,

                    page: specFile,

                    evidence: {}
                }
            ];
        }

        const results =
            parsePlaywrightJson(
                json,
                suite,
                specFile
            );

        if (results.length === 0) {
            return [
                {
                    testName:
                        `${path.basename(
                            specFile
                        )} execution`,

                    suite,

                    status: 'FAIL',

                    duration:
                        Date.now() -
                        startedAt,

                    error:
                        'Playwright completed but returned ' +
                        'no test results.',

                    expected: null,

                    actual: null,

                    endpoint: null,

                    page: specFile,

                    evidence: {}
                }
            ];
        }

        logger.info(
            'Individual Playwright spec completed',
            {
                suite,
                specFile,
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

        return results;
    } catch (error) {
        logger.error(
            'Individual Playwright spec failed',
            {
                suite,
                specFile,
                message:
                    error.message,
                stack:
                    error.stack
            }
        );

        return [
            {
                testName:
                    `${path.basename(
                        specFile
                    )} execution`,

                suite,

                status: 'FAIL',

                duration:
                    Date.now() -
                    startedAt,

                error:
                    error.message,

                expected: null,

                actual: null,

                endpoint: null,

                page: specFile,

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
        ).catch(() => {});
    }
}

// ---------------------------------------------------------
// RUN ONE SUITE
// ---------------------------------------------------------

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
            'No Playwright spec files found',
            {
                suite,
                dir
            }
        );

        return buildSummary(
            [
                {
                    testName:
                        `${suite} suite`,

                    suite,

                    status: 'SKIPPED',

                    duration: 0,

                    error:
                        `No Playwright spec files found ` +
                        `under ${dir}.`,

                    expected: null,

                    actual: null,

                    endpoint: null,

                    page: null,

                    evidence: {}
                }
            ],
            0
        );
    }

    logger.info(
        'Playwright spec files found',
        {
            suite,
            count:
                specFiles.length,
            specFiles
        }
    );

    const startedAt = Date.now();

    const results = [];

    /*
     * Sequential execution.
     *
     * If one spec fails/times out,
     * the next spec still runs.
     */
    for (const specFile of specFiles) {
        const specResults =
            await runSinglePlaywrightSpec(
                {
                    suite,
                    environment,
                    specFile
                }
            );

        results.push(
            ...specResults
        );
    }

    return buildSummary(
        results,
        Date.now() -
            startedAt
    );
}

// ---------------------------------------------------------
// RUN ALL PLAYWRIGHT SUITES
// ---------------------------------------------------------

async function runPlaywright({
    environment,
    suites
}) {
    const startedAt = Date.now();

    const results = [];

    logger.info(
        'Starting Playwright execution',
        {
            environment,
            suites
        }
    );

    for (const suite of suites) {
        try {
            logger.info(
                'Beginning Playwright suite',
                {
                    suite,
                    environment
                }
            );

            const suiteOutcome =
                await runPlaywrightForSuite(
                    {
                        suite,
                        environment
                    }
                );

            results.push(
                ...(suiteOutcome.results || [])
            );
        } catch (error) {
            logger.error(
                'Suite execution failed',
                {
                    suite,
                    message:
                        error.message
                }
            );

            results.push({
                testName:
                    `${suite} suite execution`,

                suite,

                status: 'FAIL',

                duration: 0,

                error:
                    error.message,

                expected: null,

                actual: null,

                endpoint: null,

                page: null,

                evidence: {}
            });
        }
    }

    return buildSummary(
        results,
        Date.now() -
            startedAt
    );
}

// =========================================================
// MOCK EXECUTION
// =========================================================

// ---------------------------------------------------------
// EXTRACT TEST NAMES
// ---------------------------------------------------------

async function extractTestNames(
    specFilePath
) {
    try {
        const content =
            await readFile(
                path.join(
                    REPO_ROOT,
                    specFilePath
                ),
                'utf-8'
            );

        const matches = [
            ...content.matchAll(
                /test(?:\.\w+)?\s*\(\s*['"`](.+?)['"`]/g
            )
        ];

        return matches.map(
            (match) => match[1]
        );
    } catch {
        return [];
    }
}

// ---------------------------------------------------------
// MOCK FAILURE REASONS
// ---------------------------------------------------------

const MOCK_FAIL_REASONS_BY_SUITE = {
    API: [
        'Expected status code 200 but received 500 from endpoint',
        'Request failed: response body did not match schema',
        'Authentication token was rejected (401 Unauthorized)'
    ],

    UI: [
        'Expected element to be visible',
        'Timed out waiting for navigation',
        'Text assertion failed'
    ],

    E2E: [
        'Workflow step failed',
        'End-to-end flow interrupted'
    ],

    WEBSOCKET: [
        'WebSocket connection closed unexpectedly',
        'Timed out waiting for socket handshake'
    ],

    AI_VOICE: [
        'Intent recognition returned unexpected intent',
        'Voice session did not complete expected goal'
    ]
};

// ---------------------------------------------------------
// MOCK STATUS
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// GENERATE MOCK RESULTS
// ---------------------------------------------------------

async function generateMockResultsForSuite(
    suite,
    runId
) {
    const specFiles =
        await findSpecFiles(
            SUITE_DIRS[suite]
        );

    let testNames = [];

    for (const specFile of specFiles) {
        const names =
            await extractTestNames(
                specFile
            );

        testNames.push(
            ...names
        );
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
                    MOCK_FAIL_REASONS_BY_SUITE[
                        suite
                    ] || [
                        'Unexpected failure'
                    ];

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
                        `artifacts/${runId}/` +
                        `${slugify(
                            testName
                        )}.png`,

                    trace:
                        `artifacts/${runId}/` +
                        `${slugify(
                            testName
                        )}.zip`,

                    video: null
                };
            }

            return result;
        }
    );
}

// ---------------------------------------------------------
// RUN MOCK
// ---------------------------------------------------------

async function runMock({
    runId,
    suites
}) {
    const startedAt =
        Date.now();

    const results = [];

    for (const suite of suites) {
        const suiteResults =
            await generateMockResultsForSuite(
                suite,
                runId
            );

        results.push(
            ...suiteResults
        );
    }

    return buildSummary(
        results,
        Date.now() -
            startedAt
    );
}

// =========================================================
// STORED TEST CASE EXECUTION
// =========================================================

// ---------------------------------------------------------
// RESOLVE TEST CASES
// ---------------------------------------------------------

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
                    $in: testCaseIds
                },
                active: true
            }
        ).lean();
    }

    if (suiteId) {
        return TestCase.find(
            {
                suiteId,
                active: true
            }
        ).lean();
    }

    return [];
}

// ---------------------------------------------------------
// MOCK STORED TEST CASE
// ---------------------------------------------------------

function runTestCaseMock(
    testCase,
    runId
) {
    const shouldPass =
        Math.random() < 0.75;

    const actual =
        shouldPass
            ? testCase.expectedResult
            : `unexpected result for ${testCase.testCaseId}`;

    const {
        status,
        reason
    } = checkResult(
        testCase.expectedResult,
        actual
    );

    const result = {
        testCaseId:
            testCase._id,

        testName:
            testCase.name,

        suite:
            testCase.type,

        duration:
            Math.floor(
                150 +
                Math.random() * 1800
            ),

        expected:
            testCase.expectedResult,

        actual,

        status,

        error:
            reason,

        endpoint: null,

        page: null,

        evidence: {}
    };

    if (status === 'FAIL') {
        result.evidence = {
            screenshot:
                `artifacts/${runId}/` +
                `${slugify(
                    testCase.testCaseId
                )}.png`,

            trace:
                `artifacts/${runId}/` +
                `${slugify(
                    testCase.testCaseId
                )}.zip`,

            video: null
        };
    }

    return result;
}

// ---------------------------------------------------------
// STORED TEST CASE PLACEHOLDER
// ---------------------------------------------------------

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

        duration: 0,

        expected:
            testCase.expectedResult,

        actual: null,

        status: 'SKIPPED',

        error:
            `No real execution engine exists yet for ${testCase.type}.`,

        endpoint: null,

        page: null,

        evidence: {}
    };
}

// ---------------------------------------------------------
// RUN STORED TEST CASES
// ---------------------------------------------------------

async function runStoredTestCases({
    runId,
    environment,
    suiteId,
    testCaseIds
}) {
    const startedAt =
        Date.now();

    const testCases =
        await resolveTestCases(
            {
                suiteId,
                testCaseIds
            }
        );

    if (testCases.length === 0) {
        logger.warn(
            'No matching active test cases found',
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

    for (const testCase of testCases) {
        if (mode === 'mock') {
            results.push(
                runTestCaseMock(
                    testCase,
                    runId
                )
            );

            continue;
        }

        try {
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

                duration: 0,

                expected:
                    testCase.expectedResult,

                actual: null,

                status: 'FAIL',

                error:
                    `Test execution error: ${error.message}`,

                endpoint: null,

                page: null,

                evidence: {}
            });
        }
    }

    return buildSummary(
        results,
        Date.now() -
            startedAt
    );
}

// =========================================================
// PUBLIC ENTRY POINT
// =========================================================

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
        resolveSuites(suites);

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
                    : resolvedSuites,

            suiteId,

            testCaseIds,

            playwrightTimeoutMs:
                PLAYWRIGHT_TIMEOUT_MS,

            specTimeoutMs:
                SPEC_TIMEOUT_MS,

            repoRoot:
                REPO_ROOT
        }
    );

    let outcome;

    // -----------------------------------------------------
    // DATABASE-DRIVEN EXECUTION
    // -----------------------------------------------------

    if (dbDriven) {
        outcome =
            await runStoredTestCases(
                {
                    runId,
                    environment,
                    suiteId,
                    testCaseIds
                }
            );
    }

    // -----------------------------------------------------
    // MOCK EXECUTION
    // -----------------------------------------------------

    else if (mode === 'mock') {
        outcome =
            await runMock(
                {
                    runId,
                    suites:
                        resolvedSuites
                }
            );
    }

    // -----------------------------------------------------
    // REAL PLAYWRIGHT EXECUTION
    // -----------------------------------------------------

    else {
        outcome =
            await runPlaywright(
                {
                    environment,
                    suites:
                        resolvedSuites
                }
            );
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

// =========================================================
// AVAILABLE SUITES
// =========================================================

export const AVAILABLE_SUITES =
    ALL_SUITES;