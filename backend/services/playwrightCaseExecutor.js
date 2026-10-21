import { request, chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkResult } from './resultCheckerService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AUTH_STATE = path.join(REPO_ROOT, 'playwright', '.auth', 'user.json');

/**
 * Executes ONE stored TestCase with real Playwright and returns a
 * normalized result. Supported types:
 *
 *  API  - uses Playwright's APIRequestContext (real HTTP, no browser needed).
 *         input:          { method?, endpoint | url, headers?, body? }
 *         expectedResult: a status code ("200"), or an object such as
 *                         {"status":200,"body":{"ok":true}} - only the keys
 *                         given are compared (subset match on body).
 *  UI   - uses a real Chromium browser.
 *         input:          { path | url }  (path is joined to FRONTEND_URL)
 *         expectedResult: text that must be visible on the page.
 *
 * WEBSOCKET / AI_VOICE have no executor yet and are reported as SKIPPED
 * by the caller.
 */

function parseMaybeJson(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return value;
        }
    }
    return value;
}

function joinUrl(base, endpoint) {
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    return `${String(base).replace(/\/+$/, '')}/${String(endpoint).replace(/^\/+/, '')}`;
}

function pickSubset(expected, actual) {
    if (expected === null || typeof expected !== 'object' || Array.isArray(expected)) return actual;
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return actual;
    return Object.keys(expected).reduce((acc, key) => {
        acc[key] = pickSubset(expected[key], actual[key]);
        return acc;
    }, {});
}

function baseResult(testCase) {
    return {
        testCaseId: testCase._id,
        testName: testCase.name,
        suite: testCase.type,
        duration: 0,
        expected: testCase.expectedResult,
        actual: null,
        status: 'FAIL',
        error: null,
        endpoint: null,
        page: null,
        evidence: {}
    };
}

async function executeApiCase(testCase) {
    const result = baseResult(testCase);
    const input = parseMaybeJson(testCase.input) || {};
    const base = process.env.CATI_API_URL || process.env.BACKEND_URL;
    const target = input.url || input.endpoint;

    if (!target) {
        result.error = 'API test case needs input.endpoint or input.url';
        return result;
    }
    if (!/^https?:\/\//i.test(target) && !base) {
        result.error = 'Relative endpoint given but CATI_API_URL / BACKEND_URL is not set in .env';
        return result;
    }

    const url = joinUrl(base, target);
    const method = String(input.method || 'GET').toUpperCase();
    result.endpoint = `${method} ${url}`;

    const started = Date.now();
    const ctx = await request.newContext();
    try {
        const response = await ctx.fetch(url, {
            method,
            headers: input.headers,
            data: input.body,
            timeout: 30000
        });
        const text = await response.text();
        let body = text;
        try {
            body = JSON.parse(text);
        } catch {
            /* non-JSON body stays as text */
        }

        const expected = parseMaybeJson(testCase.expectedResult);
        let actual;
        if (typeof expected === 'string' && /^\d{3}$/.test(expected.trim())) {
            actual = String(response.status());
            result.expected = expected.trim();
        } else if (typeof expected === 'number') {
            actual = response.status();
        } else if (expected && typeof expected === 'object') {
            actual = pickSubset(expected, { status: response.status(), body });
            result.expected = expected;
        } else {
            actual = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const verdict = checkResult(result.expected, actual);
        result.actual = actual;
        result.status = verdict.status;
        result.error = verdict.reason;
        result.evidence = {
            request: { method, url, headers: input.headers || null, body: input.body ?? null },
            response: { status: response.status(), body: typeof body === 'string' ? body.slice(0, 2000) : body }
        };
    } catch (err) {
        result.error = `Request failed: ${err.message}`;
        result.actual = 'no response';
    } finally {
        result.duration = Date.now() - started;
        await ctx.dispose();
    }
    return result;
}

async function executeUiCase(testCase, runId) {
    const result = baseResult(testCase);
    const input = parseMaybeJson(testCase.input) || {};
    const base = process.env.FRONTEND_URL;
    const target = input.url || input.path || '/';

    if (!/^https?:\/\//i.test(target) && !base) {
        result.error = 'FRONTEND_URL is not set in .env';
        return result;
    }

    const url = joinUrl(base, target);
    result.page = url;
    const expectedText = String(testCase.expectedResult);

    const started = Date.now();
    let browser;
    try {
        browser = await chromium.launch();
        const context = await browser.newContext(
            existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}
        );
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        try {
            await page.getByText(expectedText).first().waitFor({ state: 'visible', timeout: 10000 });
            result.actual = expectedText;
        } catch {
            result.actual = `text not visible (page title: "${await page.title()}")`;
        }

        const verdict = checkResult(expectedText, result.actual);
        result.status = verdict.status;
        result.error = verdict.reason;

        if (result.status === 'FAIL') {
            const dir = path.join(REPO_ROOT, 'artifacts', 'generated', runId);
            await mkdir(dir, { recursive: true });
            const shot = path.join(dir, `${String(testCase.testCaseId)}.png`);
            await page.screenshot({ path: shot, fullPage: true });
            result.evidence = { screenshot: path.relative(REPO_ROOT, shot) };
        }
    } catch (err) {
        const hint = /Executable doesn't exist/i.test(err.message)
            ? ' - Chromium is not installed; run "npx playwright install" once.'
            : '';
        result.error = `Browser execution failed: ${err.message.split('\n')[0]}${hint}`;
        result.actual = 'page not reached';
    } finally {
        result.duration = Date.now() - started;
        await browser?.close();
    }
    return result;
}

/**
 * @returns {Promise<object|null>} normalized result, or null when this
 * test case type has no real executor yet.
 */
export async function executeTestCaseWithPlaywright(testCase, runId) {
    if (testCase.type === 'API') return executeApiCase(testCase);
    if (testCase.type === 'UI' || testCase.type === 'E2E') return executeUiCase(testCase, runId);
    return null;
}
