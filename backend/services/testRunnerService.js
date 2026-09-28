import { spawn } from 'child_process';
import { readdir, readFile, mkdtemp, rm, access } from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

import { logger } from '../utils/logger.js';
import TestCase from '../models/TestCase.js';
import { checkResult } from './resultCheckerService.js';
import { executeTestCaseWithPlaywright } from './playwrightCaseExecutor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/*
 * backend/services -> repository root
 */
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/*
 * ---------------------------------------------------------------
 * SUITE CONFIGURATION
 * ---------------------------------------------------------------
 */

const SUITE_DIRS = Object.freeze({
    API: 'test-engine/api',
    UI: 'test-engine/ui',
    E2E: 'test-engine/e2e',
    WEBSOCKET: 'test-engine/websocket',
    AI_VOICE: 'test-engine/ai'
});

const ALL_SUITES = Object.keys(SUITE_DIRS);

/*
 * ---------------------------------------------------------------
 * GENERAL HELPERS
 * ---------------------------------------------------------------
 */

function resolveSuites(requestedSuites) {
    if (!Array.isArray(requestedSuites) || requestedSuites.length === 0) {
        return ALL_SUITES;
    }

    const normalized = requestedSuites
        .map((suite) => String(suite).trim().toUpperCase())
        .map((suite) => {
            if (suite === 'WEBSOCKET') return 'WEBSOCKET';
            if (suite === 'AI/VOICE') return 'AI_VOICE';
            if (suite === 'AI_VOICE') return 'AI_VOICE';
            return suite;
        })
        .filter((suite) => SUITE_DIRS[suite]);

    return normalized.length > 0 ? [...new Set(normalized)] : ALL_SUITES;
}

/*
 * Recursively find Playwright spec files.
 *
 * Example:
 *
 * test-engine/api/
 * ├── specs/
 * │   ├── auth.spec.js
 * │   ├── billing.spec.js
 * │   └── agents.spec.js
 *
 * The old implementation only checked the first directory level.
 * This implementation walks all subdirectories.
 */
async function findSpecFiles(relativeDir) {
    const absoluteDir = path.resolve(REPO_ROOT, relativeDir);
    const files = [];

    async function walk(currentDir) {
        let entries;

        try {
            entries = await readdir(currentDir, {
                withFileTypes: true
            });
        } catch (error) {
            logger.warn('Unable to read test directory', {
                directory: currentDir,
                message: error.message
            });

            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                await walk(fullPath);
                continue;
            }

            if (
                entry.isFile() &&
                (
                    entry.name.endsWith('.spec.js') ||
                    entry.name.endsWith('.spec.mjs') ||
                    entry.name.endsWith('.spec.cjs') ||
                    entry.name.endsWith('.test.js') ||
                    entry.name.endsWith('.test.mjs') ||
                    entry.name.endsWith('.test.cjs')
                )
            ) {
                files.push(path.relative(REPO_ROOT, fullPath));
            }
        }
    }

    await walk(absoluteDir);

    return files.sort();
}

async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

/*
 * ---------------------------------------------------------------
 * PLAYWRIGHT CLI RESOLUTION
 * ---------------------------------------------------------------
 *
 * IMPORTANT:
 *
 * We intentionally DO NOT use:
 *
 *     npx playwright test
 *
 * This avoids Windows npx.cmd / spawn ENOENT / spawn EINVAL issues.
 *
 * Instead, Node directly executes Playwright's CLI JavaScript file.
 */

function resolvePlaywrightCli() {
    const candidates = [
        'playwright/cli.js',
        '@playwright/test/cli.js'
    ];

    for (const candidate of candidates) {
        try {
            const resolved = require.resolve(candidate);

            if (resolved) {
                return resolved;
            }
        } catch {
            // Try next candidate.
        }
    }

    /*
     * Additional fallback locations.
     */
    const fallbackPaths = [
        path.join(
            REPO_ROOT,
            'node_modules',
            'playwright',
            'cli.js'
        ),

        path.join(
            REPO_ROOT,
            'node_modules',
            '@playwright',
            'test',
            'cli.js'
        ),

        path.join(
            __dirname,
            '..',
            'node_modules',
            'playwright',
            'cli.js'
        ),

        path.join(
            __dirname,
            '..',
            'node_modules',
            '@playwright',
            'test',
            'cli.js'
        )
    ];

    return fallbackPaths.find((candidate) => {
        try {
            return require.resolve(candidate) && candidate;
        } catch {
            return false;
        }
    }) || null;
}

/*
 * ---------------------------------------------------------------
 * MOCK EXECUTION
 * ---------------------------------------------------------------
 */

async function extractTestNames(specFilePath) {
    try {
        const absolutePath = path.resolve(REPO_ROOT, specFilePath);

        const content = await readFile(
            absolutePath,
            'utf-8'
        );

        const names = [];

        /*
         * Matches:
         *
         * test('name')
         * test("name")
         * test.describe(...)
         * test.only(...)
         * test.skip(...)
         */
        const regex =
            /test(?:\.[a-zA-Z]+)?\s*\(\s*['"`]([^'"`]+)['"`]/g;

        for (const match of content.matchAll(regex)) {
            if (match[1]) {
                names.push(match[1]);
            }
        }

        return [...new Set(names)];
    } catch (error) {
        logger.debug('Unable to extract test names', {
            file: specFilePath,
            message: error.message
        });

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
        "Expected element to be visible but locator was not found",
        'Timed out waiting for navigation',
        'Text assertion failed'
    ],

    E2E: [
        'Workflow step failed',
        'End-to-end flow did not complete successfully'
    ],

    WEBSOCKET: [
        'WebSocket connection closed unexpectedly',
        'Timed out waiting for WebSocket handshake'
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

async function generateMockResultsForSuite(suite, runId) {
    const dir = SUITE_DIRS[suite];

    const specFiles = await findSpecFiles(dir);

    let testNames = [];

    for (const specFile of specFiles) {
        try {
            const names = await extractTestNames(specFile);
            testNames.push(...names);
        } catch {
            // Ignore individual extraction failures.
        }
    }

    if (testNames.length === 0) {
        testNames = [`${suite} suite smoke check`];
    }

    return testNames.map((testName) => {
        const status = weightedRandomStatus();

        const duration = Math.floor(
            200 + Math.random() * 2500
        );

        const result = {
            testName,
            suite,
            status,
            duration,
            error: null,
            expected: null,
            actual: null,
            endpoint: suite === 'API'
                ? '/api/mock-endpoint'
                : null,
            page:
                suite === 'UI' || suite === 'E2E'
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
                        Math.random() * reasons.length
                    )
                ];

            result.expected = 'expected behavior';

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
    });
}

async function runMock({ runId, suites }) {
    const startedAt = Date.now();

    const results = [];

    for (const suite of suites) {
        try {
            const suiteResults =
                await generateMockResultsForSuite(
                    suite,
                    runId
                );

            results.push(...suiteResults);
        } catch (error) {
            logger.error(
                `Mock execution failed for suite ${suite}`,
                {
                    message: error.message
                }
            );

            results.push({
                testName: `${suite} suite execution`,
                suite,
                status: 'FAIL',
                duration: 0,
                error: error.message,
                expected: null,
                actual: null,
                endpoint: null,
                page: null,
                evidence: {}
            });
        }
    }

    const duration = Date.now() - startedAt;

    return buildSummary(results, duration);
}

/*
 * ---------------------------------------------------------------
 * PLAYWRIGHT RESULT PARSING
 * ---------------------------------------------------------------
 */

function mapPlaywrightStatus(status) {
    switch (status) {
        case 'passed':
            return 'PASS';

        case 'failed':
        case 'timedOut':
        case 'interrupted':
            return 'FAIL';

        case 'skipped':
        case 'pending':
        case 'disabled':
            return 'SKIPPED';

        default:
            return 'SKIPPED';
    }
}

function extractErrorMessage(result) {
    if (!result) {
        return null;
    }

    if (result.error) {
        if (typeof result.error === 'string') {
            return result.error;
        }

        if (result.error.message) {
            return result.error.message;
        }
    }

    if (Array.isArray(result.errors) && result.errors.length > 0) {
        const first = result.errors[0];

        if (typeof first === 'string') {
            return first;
        }

        if (first?.message) {
            return first.message;
        }
    }

    return null;
}

function extractAttachments(result) {
    const attachments =
        Array.isArray(result?.attachments)
            ? result.attachments
            : [];

    let screenshot = null;
    let trace = null;
    let video = null;

    for (const attachment of attachments) {
        if (!attachment) {
            continue;
        }

        const name = String(
            attachment.name || ''
        ).toLowerCase();

        const attachmentPath =
            attachment.path ||
            attachment.body ||
            null;

        if (name.includes('screenshot')) {
            screenshot = attachmentPath;
        }

        if (name.includes('trace')) {
            trace = attachmentPath;
        }

        if (name.includes('video')) {
            video = attachmentPath;
        }
    }

    return {
        screenshot,
        trace,
        video
    };
}

/*
 * Parse Playwright JSON reporter output.
 */
function parsePlaywrightJson(json, suite) {
    const results = [];

    if (!json || typeof json !== 'object') {
        return results;
    }

    function walkSuite(node, filePath = null) {
        if (!node || typeof node !== 'object') {
            return;
        }

        const currentFile =
            node.file ||
            filePath ||
            null;

        if (Array.isArray(node.specs)) {
            for (const spec of node.specs) {
                if (!spec) {
                    continue;
                }

                const tests =
                    Array.isArray(spec.tests)
                        ? spec.tests
                        : [];

                for (const test of tests) {
                    if (!test) {
                        continue;
                    }

                    const testResults =
                        Array.isArray(test.results)
                            ? test.results
                            : [];

                    const lastResult =
                        testResults.length > 0
                            ? testResults[
                                testResults.length - 1
                            ]
                            : null;

                    const rawStatus =
                        lastResult?.status ||
                        test.status ||
                        'skipped';

                    const status =
                        mapPlaywrightStatus(rawStatus);

                    const error =
                        extractErrorMessage(
                            lastResult
                        );

                    const evidence =
                        extractAttachments(
                            lastResult
                        );

                    results.push({
                        testName:
                            spec.title ||
                            test.title ||
                            'Unnamed Playwright test',

                        suite,

                        status,

                        duration:
                            Number(
                                lastResult?.duration || 0
                            ),

                        error,

                        expected: null,

                        actual: null,

                        endpoint: null,

                        page:
                            currentFile,

                        evidence
                    });
                }
            }
        }

        if (Array.isArray(node.suites)) {
            for (const child of node.suites) {
                walkSuite(
                    child,
                    currentFile
                );
            }
        }
    }

    if (Array.isArray(json.suites)) {
        for (const suiteNode of json.suites) {
            walkSuite(
                suiteNode,
                suiteNode?.file || null
            );
        }
    }

    return results;
}

/*
 * ---------------------------------------------------------------
 * REAL PLAYWRIGHT EXECUTION
 * ---------------------------------------------------------------
 */

async function executePlaywrightProcess({
    cliPath,
    directory,
    outputFile,
    environment,
    suite
}) {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let settled = false;

        const finish = (result) => {
            if (settled) {
                return;
            }

            settled = true;
            resolve(result);
        };

        /*
         * IMPORTANT:
         *
         * Instead of:
         *
         * spawn('npx', ...)
         *
         * we execute Node directly:
         *
         * node <playwright-cli> test ...
         *
         *
         * This avoids Windows:
         *
         * spawn npx ENOENT
         * spawn EINVAL
         */

        let child;

        try {
            child = spawn(
                process.execPath,
                [
                    cliPath,
                    'test',
                    directory,
                    '--reporter=json'
                ],
                {
                    cwd: REPO_ROOT,

                    env: {
                        ...process.env,

                        TEST_ENV:
                            environment || 'staging',

                        PLAYWRIGHT_JSON_OUTPUT_NAME:
                            outputFile
                    },

                    shell: false,

                    windowsHide: true,

                    stdio: [
                        'ignore',
                        'pipe',
                        'pipe'
                    ]
                }
            );
        } catch (error) {
            finish({
                ok: false,
                exitCode: null,
                stdout,
                stderr,
                error
            });

            return;
        }

        child.stdout?.on(
            'data',
            (chunk) => {
                stdout += chunk.toString();
            }
        );

        child.stderr?.on(
            'data',
            (chunk) => {
                stderr += chunk.toString();
            }
        );

        child.on(
            'error',
            (error) => {
                finish({
                    ok: false,
                    exitCode: null,
                    stdout,
                    stderr,
                    error
                });
            }
        );

        child.on(
            'close',
            (code, signal) => {
                /*
                 * IMPORTANT:
                 *
                 * A non-zero Playwright exit code DOES NOT mean
                 * the runner crashed.
                 *
                 * Playwright returns non-zero when tests fail.
                 *
                 * Therefore we inspect the JSON report instead.
                 */

                if (stderr) {
                    logger.debug(
                        `Playwright stderr for ${suite}`,
                        {
                            stderr
                        }
                    );
                }

                finish({
                    ok: true,
                    exitCode: code,
                    signal,
                    stdout,
                    stderr,
                    error: null
                });
            }
        );
    });
}

async function runPlaywrightForSuite({
    suite,
    environment
}) {
    const directory =
        SUITE_DIRS[suite];

    /*
     * Safety check.
     */
    if (!directory) {
        return [
            {
                testName:
                    `${suite} suite execution`,

                suite,

                status: 'FAIL',

                duration: 0,

                error:
                    `Unknown test suite: ${suite}`,

                expected: null,

                actual: null,

                endpoint: null,

                page: null,

                evidence: {}
            }
        ];
    }

    const absoluteDirectory =
        path.resolve(
            REPO_ROOT,
            directory
        );

    /*
     * Find specs recursively.
     */
    const specFiles =
        await findSpecFiles(directory);

    logger.info(
        `Found ${specFiles.length} Playwright spec file(s) for suite ${suite}`,
        {
            directory,
            files: specFiles
        }
    );

    /*
     * No tests = SKIPPED, not a crash.
     */
    if (specFiles.length === 0) {
        return [
            {
                testName:
                    `${suite} suite`,

                suite,

                status: 'SKIPPED',

                duration: 0,

                error:
                    `No Playwright spec files found under ${directory}.`,

                expected: null,

                actual: null,

                endpoint: null,

                page: null,

                evidence: {}
            }
        ];
    }

    /*
     * Find Playwright CLI.
     */
    const cliPath =
        resolvePlaywrightCli();

    if (!cliPath) {
        logger.error(
            'Playwright CLI could not be resolved'
        );

        return [
            {
                testName:
                    `${suite} suite execution`,

                suite,

                status: 'FAIL',

                duration: 0,

                error:
                    'Playwright CLI could not be found. Run npm install in the backend directory.',

                expected: null,

                actual: null,

                endpoint: null,

                page: null,

                evidence: {}
            }
        ];
    }

    logger.info(
        'Playwright CLI resolved',
        {
            cliPath
        }
    );

    let tmpDir = null;

    try {
        /*
         * Temporary directory for JSON report.
         */
        tmpDir =
            await mkdtemp(
                path.join(
                    os.tmpdir(),
                    'cati-qa-playwright-'
                )
            );

        const outputFile =
            path.join(
                tmpDir,
                'result.json'
            );

        /*
         * Execute Playwright.
         */
        logger.info(
            `Starting Playwright execution for suite ${suite}`,
            {
                directory: absoluteDirectory,
                environment,
                outputFile
            }
        );

        const processResult =
            await executePlaywrightProcess({
                cliPath,
                directory,
                outputFile,
                environment,
                suite
            });

        /*
         * Spawn/process-level failure.
         */
        if (!processResult.ok) {
            const message =
                processResult.error?.message ||
                'Unknown Playwright process error';

            logger.error(
                `Playwright process failed for suite ${suite}`,
                {
                    message
                }
            );

            return [
                {
                    testName:
                        `${suite} suite execution`,

                    suite,

                    status: 'FAIL',

                    duration: 0,

                    error:
                        `Playwright process error: ${message}`,

                    expected: null,

                    actual: null,

                    endpoint: null,

                    page: null,

                    evidence: {}
                }
            ];
        }

        /*
         * Wait briefly for reporter output to become available.
         *
         * Usually it already exists when the child process closes.
         */
        let reportExists =
            await fileExists(outputFile);

        if (!reportExists) {
            await new Promise(
                (resolve) =>
                    setTimeout(resolve, 100)
            );

            reportExists =
                await fileExists(outputFile);
        }

        /*
         * No JSON report.
         */
        if (!reportExists) {
            logger.error(
                `Playwright did not produce a JSON report for suite ${suite}`,
                {
                    exitCode:
                        processResult.exitCode,

                    stderr:
                        processResult.stderr?.slice(
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
                        processResult.exitCode === 0
                            ? 'SKIPPED'
                            : 'FAIL',

                    duration: 0,

                    error:
                        processResult.exitCode === 0
                            ? 'Playwright completed but no JSON report was generated.'
                            : `Playwright exited with code ${processResult.exitCode} without producing a JSON report.`,

                    expected: null,

                    actual: null,

                    endpoint: null,

                    page: null,

                    evidence: {}
                }
            ];
        }

        /*
         * Read JSON report.
         */
        const raw =
            await readFile(
                outputFile,
                'utf-8'
            );

        if (!raw.trim()) {
            return [
                {
                    testName:
                        `${suite} suite execution`,

                    suite,

                    status: 'FAIL',

                    duration: 0,

                    error:
                        'Playwright generated an empty JSON report.',

                    expected: null,

                    actual: null,

                    endpoint: null,

                    page: null,

                    evidence: {}
                }
            ];
        }

        let json;

        try {
            json =
                JSON.parse(raw);
        } catch (error) {
            logger.error(
                `Invalid Playwright JSON report for suite ${suite}`,
                {
                    message: error.message
                }
            );

            return [
                {
                    testName:
                        `${suite} suite execution`,

                    suite,

                    status: 'FAIL',

                    duration: 0,

                    error:
                        `Unable to parse Playwright JSON report: ${error.message}`,

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

        /*
         * JSON report existed but parser found nothing.
         */
        if (results.length === 0) {
            logger.warn(
                `Playwright JSON report contained no parsed tests for suite ${suite}`
            );

            return [
                {
                    testName:
                        `${suite} suite execution`,

                    suite,

                    status:
                        processResult.exitCode === 0
                            ? 'SKIPPED'
                            : 'FAIL',

                    duration: 0,

                    error:
                        processResult.exitCode === 0
                            ? 'No individual tests were found in the Playwright report.'
                            : `Playwright exited with code ${processResult.exitCode}, but no individual test results could be parsed.`,

                    expected: null,

                    actual: null,

                    endpoint: null,

                    page: null,

                    evidence: {}
                }
            ];
        }

        logger.info(
            `Playwright execution completed for suite ${suite}`,
            {
                tests: results.length,

                passed:
                    results.filter(
                        (r) =>
                            r.status === 'PASS'
                    ).length,

                failed:
                    results.filter(
                        (r) =>
                            r.status === 'FAIL'
                    ).length,

                skipped:
                    results.filter(
                        (r) =>
                            r.status === 'SKIPPED'
                    ).length
            }
        );

        return results;
    } catch (error) {
        /*
         * NEVER allow a suite-level exception to crash the backend.
         */
        logger.error(
            `Unexpected Playwright error for suite ${suite}`,
            {
                message: error.message,
                stack: error.stack
            }
        );

        return [
            {
                testName:
                    `${suite} suite execution`,

                suite,

                status: 'FAIL',

                duration: 0,

                error:
                    `Unexpected Playwright error: ${error.message}`,

                expected: null,

                actual: null,

                endpoint: null,

                page: null,

                evidence: {}
            }
        ];
    } finally {
        /*
         * Always clean temporary report directory.
         */
        if (tmpDir) {
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
}

async function runPlaywright({
    environment,
    suites
}) {
    const startedAt =
        Date.now();

    const results = [];

    for (const suite of suites) {
        try {
            /*
             * Sequential execution is intentional.
             * It prevents API/UI suites from competing for
             * resources while we are stabilizing the runner.
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
                    message: error.message
                }
            );

            results.push({
                testName:
                    `${suite} suite execution`,

                suite,

                status: 'FAIL',

                duration: 0,

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
        Date.now() - startedAt;

    return buildSummary(
        results,
        duration
    );
}

/*
 * ---------------------------------------------------------------
 * SUMMARY
 * ---------------------------------------------------------------
 */

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

        results: safeResults
    };
}

/*
 * ---------------------------------------------------------------
 * STORED TEST CASE EXECUTION
 * ---------------------------------------------------------------
 */

async function resolveTestCases({
    suiteId,
    testCaseIds
}) {
    try {
        if (
            Array.isArray(testCaseIds) &&
            testCaseIds.length > 0
        ) {
            return await TestCase.find({
                _id: {
                    $in: testCaseIds
                },

                active: true
            }).lean();
        }

        if (suiteId) {
            return await TestCase.find({
                suiteId,

                active: true
            }).lean();
        }

        return [];
    } catch (error) {
        logger.error(
            'Unable to resolve stored test cases',
            {
                message: error.message
            }
        );

        return [];
    }
}

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

    const checked =
        checkResult(
            testCase.expectedResult,
            actual
        );

    const duration =
        Math.floor(
            150 +
            Math.random() * 1800
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

        status:
            checked.status,

        error:
            checked.reason,

        endpoint: null,

        page: null,

        evidence: {}
    };

    if (
        result.status ===
        'FAIL'
    ) {
        result.evidence = {
            screenshot:
                `artifacts/${runId}/${slugify(testCase.testCaseId)}.png`,

            trace:
                `artifacts/${runId}/${slugify(testCase.testCaseId)}.zip`,

            video: null
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

        duration: 0,

        expected:
            testCase.expectedResult,

        actual: null,

        status: 'SKIPPED',

        error:
            `No real execution engine exists yet for ${testCase.type} test cases.`,

        endpoint: null,

        page: null,

        evidence: {}
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

    if (testCases.length === 0) {
        logger.warn(
            'No matching active test cases found for this run',
            {
                runId,
                environment,
                suiteId,
                testCaseIds
            }
        );

        return buildSummary(
            [],
            Date.now() - startedAt
        );
    }

    const mode =
        String(
            process.env.TEST_EXECUTION_MODE ||
            'mock'
        ).toLowerCase();

    const results = [];

    for (const testCase of testCases) {
        try {
            if (mode === 'mock') {
                results.push(
                    runTestCaseMock(
                        testCase,
                        runId
                    )
                );

                continue;
            }

            /*
             * Real stored-test execution.
             */
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

                duration: 0,

                expected:
                    testCase.expectedResult,

                actual: null,

                status: 'FAIL',

                error:
                    `Test case execution error: ${error.message}`,

                endpoint: null,

                page: null,

                evidence: {}
            });
        }
    }

    const duration =
        Date.now() - startedAt;

    return buildSummary(
        results,
        duration
    );
}

/*
 * ---------------------------------------------------------------
 * PUBLIC ENTRY POINT
 * ---------------------------------------------------------------
 */

export async function runTests({
    runId,
    environment,
    suites,
    suiteId,
    testCaseIds
}) {
    const mode =
        String(
            process.env.TEST_EXECUTION_MODE ||
            'mock'
        ).toLowerCase();

    const dbDriven =
        Boolean(
            suiteId ||
            (
                Array.isArray(testCaseIds) &&
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

            suiteId:
                suiteId || null,

            testCaseIds:
                testCaseIds || []
        }
    );

    try {
        let outcome;

        if (dbDriven) {
            outcome =
                await runStoredTestCases({
                    runId,
                    environment,
                    suiteId,
                    testCaseIds
                });
        } else if (
            mode === 'mock'
        ) {
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

        /*
         * Safety fallback.
         */
        if (
            !outcome ||
            typeof outcome !== 'object'
        ) {
            outcome =
                buildSummary(
                    [],
                    0
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
    } catch (error) {
        /*
         * CRITICAL:
         *
         * Nothing from the test runner should crash
         * the Express backend.
         */
        logger.error(
            'Fatal test execution error',
            {
                runId,

                message:
                    error.message,

                stack:
                    error.stack
            }
        );

        const failureResult = {
            testName:
                'Test execution',

            suite:
                'SYSTEM',

            status:
                'FAIL',

            duration: 0,

            error:
                `Test runner error: ${error.message}`,

            expected: null,

            actual: null,

            endpoint: null,

            page: null,

            evidence: {}
        };

        return buildSummary(
            [failureResult],
            0
        );
    }
}

export const AVAILABLE_SUITES =
    ALL_SUITES;