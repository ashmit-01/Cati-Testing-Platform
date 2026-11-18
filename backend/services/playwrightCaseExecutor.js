import { request, chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
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

let cachedToken = null;

/**
 * Variable substitution for API cases.
 *   {{name}}      -> definition.variables.name
 *   {{env.NAME}}  -> CATI_VAR_NAME from the platform .env (only this prefix is
 *                    readable, so secrets such as JWT_SECRET cannot leak)
 *   /users/:id    -> definition.variables.id (path parameters)
 * Applied to the endpoint, headers, body and custom auth values.
 */
const VAR_PATTERN = /\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g;

function createResolver(rawVariables) {
    const missing = new Set();
    const lookup = (name, vars) => {
        if (name.startsWith('env.')) return process.env[`CATI_VAR_${name.slice(4)}`];
        return vars[name];
    };
    const own = {};
    const resolveString = (text, vars) =>
        text.replace(VAR_PATTERN, (match, name) => {
            const value = lookup(name, vars);
            if (value === undefined || value === null || value === '') {
                missing.add(name);
                return match;
            }
            return String(value);
        });
    // Variable values may themselves reference {{env.X}}.
    for (const [name, value] of Object.entries(rawVariables || {})) {
        own[name] = typeof value === 'string' ? resolveString(value, {}) : value;
    }
    const resolve = (value) => {
        if (typeof value === 'string') return resolveString(value, own);
        if (Array.isArray(value)) return value.map(resolve);
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
        }
        return value;
    };
    const resolvePath = (target) =>
        resolve(target).replace(/\/:([A-Za-z_]\w*)/g, (match, name) => {
            const value = own[name];
            if (value === undefined || value === null || value === '') {
                missing.add(`:${name}`);
                return match;
            }
            return `/${encodeURIComponent(String(value))}`;
        });
    return { resolve, resolvePath, missing };
}

/**
 * Resolves the credentials a case needs. Secrets come from the platform
 * environment (or the case's own custom entry), never from imported data.
 *   public        -> none
 *   jwt / admin   -> Bearer token from POST /api/auth/login
 *   internal-key  -> x-internal-api-key header from INTERNAL_API_KEY
 *   custom        -> definition.authCustom: bearer token, header, or login
 */
async function loginForToken(base, email, password) {
    const key = `${base}|${email}`;
    if (!cachedToken || cachedToken.key !== key) {
        const ctx = await request.newContext();
        try {
            const res = await ctx.post(joinUrl(base, '/api/auth/login'), {
                data: { email, password },
                timeout: 30000
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok() || !body.token) throw new Error(`Login failed with status ${res.status()}`);
            cachedToken = { key, token: body.token };
        } finally {
            await ctx.dispose();
        }
    }
    return { Authorization: `Bearer ${cachedToken.token}` };
}

async function authHeadersFor(definition, base, resolve) {
    const kind = definition.auth;
    if (kind === 'internal-key') {
        if (!process.env.INTERNAL_API_KEY) throw new Error('INTERNAL_API_KEY is not set in .env');
        return { 'x-internal-api-key': process.env.INTERNAL_API_KEY };
    }
    if (kind === 'custom') {
        const custom = resolve(definition.authCustom || {});
        if (custom.type === 'bearer') {
            if (!custom.token) throw new Error('Custom auth needs a token');
            return { Authorization: `Bearer ${custom.token}` };
        }
        if (custom.type === 'header') {
            if (!custom.name || !custom.value) throw new Error('Custom auth needs a header name and value');
            return { [custom.name]: custom.value };
        }
        if (custom.type === 'login') {
            if (!custom.email || !custom.password) throw new Error('Custom login needs an email and password');
            return loginForToken(base, custom.email, custom.password);
        }
        throw new Error('Custom auth type must be bearer, header or login');
    }
    if (kind !== 'jwt' && kind !== 'admin') return {};

    const admin = kind === 'admin';
    const email = (admin && process.env.TEST_ADMIN_EMAIL) || process.env.TEST_EMAIL;
    const password = (admin && process.env.TEST_ADMIN_PASSWORD) || process.env.TEST_PASSWORD;
    if (!email || !password) throw new Error('TEST_EMAIL / TEST_PASSWORD are not set in .env');
    return loginForToken(base, email, password);
}

const ajv = addFormats(new Ajv2020({ strict: false, allErrors: true, validateSchema: false }));
const validators = new Map();

/** Validates a response body against a stored JSON schema; returns error lines. */
export function validateAgainstSchema(schema, body) {
    const key = JSON.stringify(schema);
    let validate = validators.get(key);
    if (!validate) {
        validate = ajv.compile(schema);
        if (validators.size > 500) validators.clear();
        validators.set(key, validate);
    }
    if (validate(body)) return [];
    return (validate.errors || []).map(
        (e) => `${e.instancePath || 'body'} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`
    );
}

function readJsonPath(body, jsonPath) {
    return String(jsonPath || '')
        .replace(/^\$\.?/, '')
        .split('.')
        .filter(Boolean)
        .reduce((value, key) => (value == null ? undefined : value[key]), body);
}

/**
 * Evaluates the assertion list built by the test case designer
 * ([{kind, expected, path}]) against an API response.
 * Kinds: status, statusBelow, jsonPath, schema (body matches
 * definition.responseSchema, e.g. imported from OpenAPI).
 */
export function evaluateApiAssertions(assertions, status, body, definition = {}) {
    const expectedLines = [];
    const failures = [];
    for (const a of assertions) {
        if (a.kind === 'status') {
            expectedLines.push(`status ${a.expected}`);
            if (String(status) !== String(a.expected).trim()) failures.push(`status ${status}`);
        } else if (a.kind === 'statusBelow') {
            expectedLines.push(`status below ${a.expected}`);
            if (!(status < Number(a.expected))) failures.push(`status ${status}`);
        } else if (a.kind === 'jsonPath') {
            const actual = readJsonPath(body, a.path);
            expectedLines.push(`${a.path} = ${a.expected}`);
            if (String(actual) !== String(a.expected)) failures.push(`${a.path} = ${actual}`);
        } else if (a.kind === 'schema') {
            expectedLines.push('body matches response schema');
            if (!definition.responseSchema) {
                failures.push('no response schema stored on this case');
            } else {
                let errors;
                try {
                    errors = validateAgainstSchema(definition.responseSchema, body);
                } catch (schemaError) {
                    errors = [`invalid response schema: ${schemaError.message}`];
                }
                if (errors.length) {
                    const shown = errors.slice(0, 5).join(', ');
                    failures.push(`schema mismatch: ${shown}${errors.length > 5 ? ` (+${errors.length - 5} more)` : ''}`);
                }
            }
        }
    }
    const expectedText = expectedLines.join('; ');
    return { expectedText, actualText: failures.length ? failures.join('; ') : expectedText };
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

async function executeApiCase(testCase, { apiBaseUrl } = {}) {
    const result = baseResult(testCase);
    const input = parseMaybeJson(testCase.input) || {};
    // A run may target any deployment (branch preview, local machine);
    // otherwise fall back to the platform default.
    const base = apiBaseUrl || process.env.CATI_API_URL || process.env.BACKEND_URL;
    const target = input.url || input.endpoint;

    if (!target) {
        result.error = 'API test case needs input.endpoint or input.url';
        return result;
    }
    if (!/^https?:\/\//i.test(target) && !base) {
        result.error = 'Relative endpoint given but CATI_API_URL / BACKEND_URL is not set in .env';
        return result;
    }

    const definition = parseMaybeJson(testCase.definition) || {};
    const { resolve, resolvePath, missing } = createResolver(definition.variables);
    const resolvedTarget = resolvePath(target);
    const resolvedHeaders = resolve(input.headers || {});
    let resolvedBody = resolve(input.body);
    if (typeof resolvedBody === 'string' && /^\s*[{[]/.test(resolvedBody)) {
        try {
            resolvedBody = JSON.parse(resolvedBody);
        } catch {
            /* keep as raw text */
        }
    }

    const url = joinUrl(base, resolvedTarget);
    const method = String(input.method || 'GET').toUpperCase();
    result.endpoint = `${method} ${url}`;

    if (missing.size > 0) {
        result.error = `Missing value for variable(s): ${[...missing].join(', ')}. Set them in the case's variables or .env (CATI_VAR_*).`;
        result.actual = 'not sent';
        return result;
    }

    const started = Date.now();
    const ctx = await request.newContext();
    try {
        let authHeaders = {};
        try {
            authHeaders = await authHeadersFor(definition, base, resolve);
        } catch (authError) {
            result.error = `Auth setup failed: ${authError.message}`;
            result.actual = 'no response';
            return result;
        }
        if (missing.size > 0) {
            result.error = `Missing value for variable(s): ${[...missing].join(', ')}.`;
            result.actual = 'not sent';
            return result;
        }
        const headers = { ...authHeaders, ...resolvedHeaders };
        const response = await ctx.fetch(url, {
            method,
            headers,
            // `data: null` makes Playwright send a JSON "null" body, which servers reject with 400 on GET.
            ...(resolvedBody === null || resolvedBody === undefined ? {} : { data: resolvedBody }),
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
        if (Array.isArray(expected)) {
            const evaluated = evaluateApiAssertions(expected, response.status(), body, definition);
            result.expected = evaluated.expectedText;
            actual = evaluated.actualText;
        } else if (typeof expected === 'string' && /^\d{3}$/.test(expected.trim())) {
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
            request: { method, url, headers: input.headers || null, auth: definition.auth || null, body: input.body ?? null },
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

function resolveLocator(page, loc = {}) {
    const value = String(loc.value ?? '');
    switch (loc.strategy) {
        case 'testId': return page.getByTestId(value);
        case 'label': return page.getByLabel(value).first();
        case 'role': return page.getByRole(loc.role || 'button', { name: value }).first();
        case 'text': return page.getByText(value).first();
        default: return page.locator(value).first();
    }
}

function describeStep(action) {
    const loc = action.locator ? `${action.locator.strategy}=${action.locator.value}` : '';
    return [action.kind, loc, action.value].filter(Boolean).join(' ');
}

async function runAction(page, action, base) {
    const timeout = 10000;
    switch (action.kind) {
        case 'navigate':
            await page.goto(joinUrl(base, action.value || '/'), { waitUntil: 'domcontentloaded', timeout: 30000 });
            break;
        case 'click':
            await resolveLocator(page, action.locator).click({ timeout });
            break;
        case 'fill':
            await resolveLocator(page, action.locator).fill(String(action.value ?? ''), { timeout });
            break;
        case 'select':
            await resolveLocator(page, action.locator).selectOption({ label: String(action.value ?? '') }, { timeout });
            break;
        case 'press':
            await resolveLocator(page, action.locator).press(action.value || 'Enter', { timeout });
            break;
        case 'wait':
            if (action.waitFor === 'networkidle') {
                await page.waitForLoadState('networkidle', { timeout: action.timeout || 10000 });
            } else {
                await resolveLocator(page, action.locator).waitFor({
                    state: action.waitFor === 'hidden' ? 'hidden' : 'visible',
                    timeout: action.timeout || 10000
                });
            }
            break;
        default:
            throw new Error(`Unsupported step type "${action.kind}"`);
    }
}

async function runAssertion(page, assertion) {
    const expected = String(assertion.expected ?? '');
    switch (assertion.kind) {
        case 'visibleText':
            await page.getByText(expected).first().waitFor({ state: 'visible', timeout: 10000 });
            return;
        case 'visible': {
            const sel = /^[#.\[]/.test(expected) ? page.locator(expected).first() : page.getByText(expected).first();
            await sel.waitFor({ state: 'visible', timeout: 10000 });
            return;
        }
        case 'url':
            await page.waitForURL((u) => u.toString().includes(expected), { timeout: 10000 });
            return;
        default:
            throw new Error(`Assertion "${assertion.kind}" is not supported for browser tests`);
    }
}

/**
 * Runs a UI case authored with the designer / recorder:
 * definition.actions are replayed in order, then definition.assertions.
 */
async function executeUiDefinitionCase(testCase, runId) {
    const result = baseResult(testCase);
    const input = parseMaybeJson(testCase.input) || {};
    const { actions = [], assertions = [] } = testCase.definition;
    const base = process.env.FRONTEND_URL;
    const start = input.url || input.path || '/';

    const needsBase = !/^https?:\/\//i.test(start) || actions.some((a) => a.kind === 'navigate' && !/^https?:\/\//i.test(a.value || ''));
    if (needsBase && !base) {
        result.error = 'FRONTEND_URL is not set in .env (needed for relative pages)';
        return result;
    }

    result.page = joinUrl(base, start);
    result.expected = assertions.map((a) => `${a.kind}: ${a.expected}`).join('; ') || `${actions.length} steps complete`;

    const started = Date.now();
    let browser;
    let page;
    let current = 'open start page';
    try {
        browser = await chromium.launch();
        const context = await browser.newContext(existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {});
        page = await context.newPage();

        // Recorded flows begin with a navigate step; otherwise open the start page.
        if (actions[0]?.kind !== 'navigate') {
            await page.goto(result.page, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
        for (const [index, action] of actions.entries()) {
            current = `step ${index + 1} (${describeStep(action)})`;
            await runAction(page, action, base);
        }
        for (const assertion of assertions) {
            current = `check "${assertion.kind}: ${assertion.expected}"`;
            await runAssertion(page, assertion);
        }
        result.status = 'PASS';
        result.actual = result.expected;
    } catch (err) {
        const hint = /Executable doesn't exist/i.test(err.message)
            ? ' - Chromium is not installed; run "npx playwright install" once.'
            : '';
        result.status = 'FAIL';
        result.error = `Failed at ${current}: ${err.message.split('\n')[0]}${hint}`;
        result.actual = `failed at ${current}`;
        if (page) {
            try {
                const dir = path.join(REPO_ROOT, 'artifacts', 'generated', runId);
                await mkdir(dir, { recursive: true });
                const shot = path.join(dir, `${String(testCase.testCaseId)}.png`);
                await page.screenshot({ path: shot, fullPage: true });
                result.evidence = { screenshot: path.relative(REPO_ROOT, shot) };
            } catch {
                /* screenshot is best-effort */
            }
        }
    } finally {
        result.duration = Date.now() - started;
        await browser?.close();
    }
    return result;
}

async function executeUiCase(testCase, runId) {
    if (Array.isArray(testCase.definition?.actions) && testCase.definition.actions.length > 0) {
        return executeUiDefinitionCase(testCase, runId);
    }
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
export async function executeTestCaseWithPlaywright(testCase, runId, options = {}) {
    if (testCase.type === 'API') return executeApiCase(testCase, options);
    if (testCase.type === 'UI' || testCase.type === 'E2E') return executeUiCase(testCase, runId);
    return null;
}
