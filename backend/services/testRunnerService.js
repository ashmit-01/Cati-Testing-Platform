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

/**
 * Maps the platform's suite enum to the corresponding folder inside the
 * existing test-engine/ directory. This is the integration point with the
 * Playwright suite the repo already has (test-engine/ui/*.spec.js etc).
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
    if (!requestedSuites || requestedSuites.length === 0) return ALL_SUITES;
    return requestedSuites
        .map((suite) => suite.toUpperCase())
        .filter((suite) => SUITE_DIRS[suite]);
}

async function findSpecFiles(relativeDir) {
    const absoluteDir = path.join(REPO_ROOT, relativeDir);
    try {
        const entries = await readdir(absoluteDir, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.js'))
            .map((entry) => path.join(relativeDir, entry.name));
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------
// MOCK EXECUTION MODE
// ---------------------------------------------------------------------

/**
 * Extracts test() titles out of a spec file with a simple regex so mock
 * mode can produce realistic test names even when it isn't really
 * launching a browser. Falls back gracefully if parsing fails.
 */
async function extractTestNames(specFilePath) {
    try {
        const content = await readFile(path.join(REPO_ROOT, specFilePath), 'utf-8');
        const matches = [...content.matchAll(/test(?:\.\w+)?\(\s*['"](.+?)['"]/g)];
        return matches.map((match) => match[1]);
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
    if (roll < 0.72) return 'PASS';
    if (roll < 0.90) return 'FAIL';
    return 'SKIPPED';
}

async function generateMockResultsForSuite(suite, runId) {
    const dir = SUITE_DIRS[suite];
    const specFiles = await findSpecFiles(dir);

    let testNames = [];
    for (const specFile of specFiles) {
        // eslint-disable-next-line no-await-in-loop
        const names = await extractTestNames(specFile);
        testNames.push(...names);
    }

    if (testNames.length === 0) {
        // No real spec files for this suite yet (e.g. api/e2e/websocket/ai
        // currently only contain README stubs) — synthesize a single
        // placeholder test so the suite still shows up in results.
        testNames = [`${suite} suite smoke check`];
    }

    return testNames.map((testName) => {
        const status = weightedRandomStatus();
        const duration = Math.floor(200 + Math.random() * 2500);

        const result = {
            testName,
            suite,
            status,
            duration,
            error: null,
            expected: null,
            actual: null,
            endpoint: suite === 'API' ? '/api/mock-endpoint' : null,
            page: suite === 'UI' || suite === 'E2E' ? '/mock-page' : null,
            evidence: {}
        };

        if (status === 'FAIL') {
            const reasons = MOCK_FAIL_REASONS_BY_SUITE[suite] || ['Unexpected failure'];
            result.error = reasons[Math.floor(Math.random() * reasons.length)];
            result.expected = 'expected behavior';
            result.actual = 'observed behavior did not match';
            result.evidence = {
                screenshot: `artifacts/${runId}/${slugify(testName)}.png`,
                trace: `artifacts/${runId}/${slugify(testName)}.zip`,
                video: null
            };
        }

        return result;
    });
}

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

async function runMock({ runId, suites }) {
    const startedAt = Date.now();
    const results = [];

    for (const suite of suites) {
        // eslint-disable-next-line no-await-in-loop
        const suiteResults = await generateMockResultsForSuite(suite, runId);
        results.push(...suiteResults);
    }

    const duration = Date.now() - startedAt;
    return buildSummary(results, duration);
}

// ---------------------------------------------------------------------
// REAL PLAYWRIGHT EXECUTION MODE
// ---------------------------------------------------------------------

function mapPlaywrightStatus(status) {
    if (status === 'passed') return 'PASS';
    if (status === 'failed' || status === 'timedOut' || status === 'interrupted') return 'FAIL';
    return 'SKIPPED'; // 'skipped'
}

/**
 * Parses Playwright's JSON reporter output into the platform's normalized
 * result shape. Playwright's JSON schema nests specs inside suites inside
 * files, each spec containing one or more "tests", each test containing
 * one or more "results" (retries). We use the last result per test.
 */
function parsePlaywrightJson(json, suite) {
    const results = [];

    function walkSuite(node, filePath) {
        if (node.specs) {
            for (const spec of node.specs) {
                for (const test of spec.tests || []) {
                    const lastResult = test.results?.[test.results.length - 1];
                    const status = mapPlaywrightStatus(lastResult?.status || test.status);
                    const errorMessage = lastResult?.error?.message || lastResult?.errors?.[0]?.message || null;

                    const attachments = lastResult?.attachments || [];
                    const screenshot = attachments.find((a) => a.name === 'screenshot')?.path || null;
                    const trace = attachments.find((a) => a.name === 'trace')?.path || null;
                    const video = attachments.find((a) => a.name === 'video')?.path || null;

                    results.push({
                        testName: spec.title,
                        suite,
                        status,
                        duration: lastResult?.duration || 0,
                        error: errorMessage,
                        expected: null,
                        actual: null,
                        endpoint: null,
                        page: filePath || null,
                        evidence: { screenshot, trace, video }
                    });
                }
            }
        }

        for (const child of node.suites || []) {
            walkSuite(child, node.file || filePath);
        }
    }

    for (const suiteNode of json.suites || []) {
        walkSuite(suiteNode, suiteNode.file);
    }

    return results;
}

async function runPlaywrightForSuite({ suite, environment }) {
    const dir = SUITE_DIRS[suite];
    const specFiles = await findSpecFiles(dir);

    if (specFiles.length === 0) {
        logger.warn(`No Playwright spec files found for suite ${suite}, skipping execution`, {
            dir
        });
        return [
            {
                testName: `${suite} suite`,
                suite,
                status: 'SKIPPED',
                duration: 0,
                error: `No test files found under ${dir}. Add .spec.js files to enable this suite.`,
                expected: null,
                actual: null,
                endpoint: null,
                page: null,
                evidence: {}
            }
        ];
    }

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'qa-playwright-'));
    const outputFile = path.join(tmpDir, 'result.json');

    try {
        await new Promise((resolve, reject) => {
            const child = spawn(
                'npx',
                ['playwright', 'test', dir, '--reporter=json'],
                {
                    cwd: REPO_ROOT,
                    env: {
                        ...process.env,
                        TEST_ENV: environment,
                        PLAYWRIGHT_JSON_OUTPUT_NAME: outputFile
                    }
                }
            );

            let stderr = '';
            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });

            child.on('error', reject);
            child.on('close', () => {
                // Playwright exits non-zero when tests fail — that is a
                // normal outcome for us (we still want the JSON report),
                // so we don't reject on a non-zero exit code here.
                if (stderr) logger.debug(`Playwright stderr for ${suite}`, { stderr });
                resolve();
            });
        });

        const raw = await readFile(outputFile, 'utf-8');
        const json = JSON.parse(raw);
        return parsePlaywrightJson(json, suite);
    } catch (err) {
        logger.error(`Playwright execution failed for suite ${suite}`, {
            message: err.message
        });
        return [
            {
                testName: `${suite} suite execution`,
                suite,
                status: 'FAIL',
                duration: 0,
                error: `Suite execution error: ${err.message}`,
                expected: null,
                actual: null,
                endpoint: null,
                page: null,
                evidence: {}
            }
        ];
    } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
}

async function runPlaywright({ environment, suites }) {
    const startedAt = Date.now();
    const results = [];

    for (const suite of suites) {
        // Suites run sequentially to keep resource usage predictable;
        // this can be parallelized later if run times become an issue.
        // eslint-disable-next-line no-await-in-loop
        const suiteResults = await runPlaywrightForSuite({ suite, environment });
        results.push(...suiteResults);
    }

    const duration = Date.now() - startedAt;
    return buildSummary(results, duration);
}

function buildSummary(results, duration) {
    const summary = results.reduce(
        (acc, result) => {
            acc.totalTests += 1;
            if (result.status === 'PASS') acc.passed += 1;
            else if (result.status === 'FAIL') acc.failed += 1;
            else if (result.status === 'SKIPPED') acc.skipped += 1;
            return acc;
        },
        { totalTests: 0, passed: 0, failed: 0, skipped: 0 }
    );

    return { ...summary, duration, results };
}

// ---------------------------------------------------------------------
// STORED TEST CASE EXECUTION (TestCase / TestSuite driven)
// ---------------------------------------------------------------------

async function resolveTestCases({ suiteId, testCaseIds }) {
    if (testCaseIds && testCaseIds.length > 0) {
        return TestCase.find({ _id: { $in: testCaseIds }, active: true }).lean();
    }
    if (suiteId) {
        return TestCase.find({ suiteId, active: true }).lean();
    }
    return [];
}

/**
 * Mock-mode executor for stored test cases. Synthesizes an "actual" value
 * that matches the case's expectedResult most of the time, then runs it
 * through the shared Result Checker — this is what actually exercises
 * checkResult() end-to-end without needing a real API/WebSocket/AI
 * engine yet.
 */
function runTestCaseMock(testCase, runId) {
    const shouldPass = Math.random() < 0.75;
    const actual = shouldPass
        ? testCase.expectedResult
        : `unexpected result for ${testCase.testCaseId}`;

    const { status, reason } = checkResult(testCase.expectedResult, actual);
    const duration = Math.floor(150 + Math.random() * 1800);

    const result = {
        testCaseId: testCase._id,
        testName: testCase.name,
        suite: testCase.type,
        duration,
        expected: testCase.expectedResult,
        actual,
        status,
        error: reason,
        endpoint: null,
        page: null,
        evidence: {}
    };

    if (status === 'FAIL') {
        result.evidence = {
            screenshot: `artifacts/${runId}/${slugify(testCase.testCaseId)}.png`,
            trace: `artifacts/${runId}/${slugify(testCase.testCaseId)}.zip`,
            video: null
        };
    }

    return result;
}

/**
 * Placeholder for real (non-mock) execution of a stored test case. No
 * dedicated API/WebSocket/AI-voice test client exists yet (see README) —
 * UI-type stored cases also aren't wired to a specific Playwright spec
 * per case yet, only per suite folder. Rather than pretending to execute
 * these, we record an honest SKIPPED result explaining what's missing.
 */
function runTestCasePlaceholder(testCase) {
    return {
        testCaseId: testCase._id,
        testName: testCase.name,
        suite: testCase.type,
        duration: 0,
        expected: testCase.expectedResult,
        actual: null,
        status: 'SKIPPED',
        error: `No real execution engine exists yet for ${testCase.type} test cases ` +
            '(API and UI/E2E run on real Playwright; WEBSOCKET and AI_VOICE are not built yet).',
        endpoint: null,
        page: null,
        evidence: {}
    };
}

async function runStoredTestCases({ runId, environment, suiteId, testCaseIds }) {
    const startedAt = Date.now();
    const testCases = await resolveTestCases({ suiteId, testCaseIds });

    if (testCases.length === 0) {
        logger.warn('No matching active test cases found for this run', { runId, suiteId, testCaseIds });
    }

    const mode = (process.env.TEST_EXECUTION_MODE || 'mock').toLowerCase();
    const results = [];
    for (const testCase of testCases) {
        if (mode === 'mock') {
            results.push(runTestCaseMock(testCase, runId));
            continue;
        }
        // Real mode: API and UI/E2E cases run through real Playwright.
        // Types without an executor yet (WEBSOCKET, AI_VOICE) stay SKIPPED.
        // eslint-disable-next-line no-await-in-loop
        const real = await executeTestCaseWithPlaywright(testCase, runId);
        results.push(real || runTestCasePlaceholder(testCase));
    }

    const duration = Date.now() - startedAt;
    return buildSummary(results, duration);
}

// ---------------------------------------------------------------------
// PUBLIC ENTRY POINT
// ---------------------------------------------------------------------

/**
 * Executes a test run and returns a normalized result structure. This is
 * the ONLY place Playwright-specific logic should live — controllers must
 * never import child_process or Playwright directly.
 *
 * Two execution paths:
 *  - DB-driven (preferred): pass `suiteId` and/or `testCaseIds` to execute
 *    stored TestCase documents through the shared Result Checker.
 *  - Legacy suite-folder (kept for backward compatibility): pass `suites`
 *    (an array of API/UI/E2E/WEBSOCKET/AI_VOICE) to run whatever
 *    Playwright spec files already exist under test-engine/<suite>/, or
 *    mock data shaped the same way.
 *
 * @param {Object} options
 * @param {string} options.runId
 * @param {string} options.environment
 * @param {string[]} [options.suites] - legacy: subset of API/UI/E2E/WEBSOCKET/AI_VOICE
 * @param {string} [options.suiteId] - DB-driven: a TestSuite _id
 * @param {string[]} [options.testCaseIds] - DB-driven: specific TestCase _ids
 * @returns {Promise<{totalTests:number, passed:number, failed:number, skipped:number, duration:number, results:Array}>}
 */
export async function runTests({ runId, environment, suites, suiteId, testCaseIds }) {
    const mode = (process.env.TEST_EXECUTION_MODE || 'mock').toLowerCase();
    const dbDriven = Boolean(suiteId || (testCaseIds && testCaseIds.length > 0));

    logger.info('Starting test execution', {
        runId,
        environment,
        mode,
        dbDriven,
        suites: dbDriven ? undefined : resolveSuites(suites),
        suiteId,
        testCaseIds
    });

    const outcome = dbDriven
        ? await runStoredTestCases({ runId, environment, suiteId, testCaseIds })
        : mode === 'mock'
            ? await runMock({ runId, suites: resolveSuites(suites) })
            : await runPlaywright({ environment, suites: resolveSuites(suites) });

    logger.info('Test execution finished', {
        runId,
        totalTests: outcome.totalTests,
        passed: outcome.passed,
        failed: outcome.failed,
        skipped: outcome.skipped,
        duration: outcome.duration
    });

    return outcome;
}

export const AVAILABLE_SUITES = ALL_SUITES;
