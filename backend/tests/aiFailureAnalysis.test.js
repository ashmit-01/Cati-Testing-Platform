import { test, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { Query } from 'mingo';

import Failure from '../models/Failure.js';
import TestResult from '../models/TestResult.js';
import {
    analyzeFailure,
    buildEvidence,
    buildPrompt,
    claimAnalysis,
    parseAnalysisResponse,
    queueFailureAnalysis,
    redactSecrets
} from '../services/aiFailureAnalysisService.js';

// ---------------------------------------------------------------------
// In-memory stand-ins for the Mongo collections. Filters are evaluated
// with mingo so `null`, `$or`, `$in`, `$lt` behave like real MongoDB.
// ---------------------------------------------------------------------

let failures;
let results;

function setPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (const key of keys.slice(0, -1)) {
        if (cur[key] === undefined || cur[key] === null) cur[key] = {};
        cur = cur[key];
    }
    cur[keys.at(-1)] = value;
}

function getPath(obj, path) {
    return path.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}

const original = {};

function installFakeDb() {
    original.failureFOAU = Failure.findOneAndUpdate;
    original.resultFindById = TestResult.findById;

    Failure.findOneAndUpdate = (filter, update) => ({
        lean: async () => {
            const query = new Query(filter);
            const doc = [...failures.values()].find((d) => query.test(d));
            if (!doc) return null;

            for (const [path, value] of Object.entries(update.$set || {})) setPath(doc, path, value);
            for (const [path, by] of Object.entries(update.$inc || {})) {
                setPath(doc, path, (getPath(doc, path) || 0) + by);
            }
            return structuredClone(doc);
        }
    });

    TestResult.findById = (id) => ({
        lean: () => ({
            catch: async () => structuredClone(results.get(String(id)) || null),
            then: (resolve) => resolve(structuredClone(results.get(String(id)) || null))
        })
    });
}

function restoreDb() {
    Failure.findOneAndUpdate = original.failureFOAU;
    TestResult.findById = original.resultFindById;
}

// ---------------------------------------------------------------------
// Fake LLM server (Anthropic + OpenAI response shapes)
// ---------------------------------------------------------------------

let server;
let baseUrl;
let llmCalls;
let llmBehavior;

const GOOD_ANALYSIS = {
    probableCause: 'Login endpoint crashed with a server error',
    supportingEvidence: 'Actual result shows HTTP 500 and message Internal Server Error',
    suggestedFix: 'Check the auth service logs and fix the unhandled exception in the login handler',
    confidence: 'High',
    additionalInfoNeeded: ''
};

function startServer() {
    return new Promise((resolve) => {
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', async () => {
                const parsed = JSON.parse(body || '{}');
                llmCalls.push({ url: req.url, headers: req.headers, body: parsed });

                const behavior = llmBehavior;
                if (behavior.delayMs) await new Promise((r) => setTimeout(r, behavior.delayMs));

                if (behavior.status && behavior.status !== 200) {
                    res.writeHead(behavior.status, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'boom' }));
                }

                const text = behavior.text ?? JSON.stringify(GOOD_ANALYSIS);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                if (req.url.endsWith('/chat/completions')) {
                    res.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
                } else {
                    res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
                }
            });
        });
        server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });
}

// ---------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------

function addFailure({ resultOverrides = {}, noResult = false } = {}) {
    const resultId = new mongoose.Types.ObjectId().toString();
    const failureId = new mongoose.Types.ObjectId().toString();

    if (!noResult) {
        results.set(resultId, {
            _id: resultId,
            runId: 'RUN-1',
            testName: 'User login with valid credentials',
            suite: 'UI',
            status: 'FAIL',
            environment: 'staging',
            error: 'Internal Server Error',
            stackTrace: 'Error: Internal Server Error\n    at login (auth.js:10:5)',
            expected: 'User should reach dashboard',
            actual: 'Login request returned 500',
            endpoint: null,
            page: 'test-engine/ui/login.spec.js',
            createdAt: new Date('2026-10-18T10:00:00Z'),
            evidence: { screenshot: '/tmp/shot.png', video: '/tmp/v.webm', consoleLogs: 'POST /login 500' },
            ...resultOverrides
        });
    }

    failures.set(failureId, {
        _id: failureId,
        runId: 'RUN-1',
        testResultId: resultId,
        title: 'User login with valid credentials',
        description: 'Suite: UI | Error: Internal Server Error',
        severity: 'HIGH',
        category: 'UI',
        status: 'OPEN',
        evidence: {},
        aiAnalysis: {}
    });

    return { failureId, resultId };
}

function config(overrides = {}) {
    return {
        enabled: true,
        provider: 'anthropic',
        rawProvider: 'anthropic',
        apiKey: 'test-key-123',
        model: 'test-model',
        baseUrl,
        timeoutMs: 2000,
        concurrency: 2,
        ...overrides
    };
}

beforeEach(async () => {
    failures = new Map();
    results = new Map();
    llmCalls = [];
    llmBehavior = {};
    installFakeDb();
    if (!server) await startServer();
});

afterEach(() => restoreDb());

after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

test('failed test with useful error: analysis saved against the correct failure', async () => {
    const a = addFailure();
    const b = addFailure({ resultOverrides: { testName: 'Other test' } });

    const updated = await analyzeFailure(a.failureId, { config: config() });

    assert.equal(updated.aiAnalysis.status, 'COMPLETED');
    assert.equal(updated.aiAnalysis.probableCause, GOOD_ANALYSIS.probableCause);
    assert.equal(updated.aiAnalysis.suggestedFix, GOOD_ANALYSIS.suggestedFix);
    assert.equal(updated.aiAnalysis.confidence, 'High');
    assert.equal(updated.aiAnalysis.provider, 'anthropic');

    // Stored on failure A only.
    assert.equal(failures.get(a.failureId).aiAnalysis.status, 'COMPLETED');
    assert.notEqual(failures.get(b.failureId).aiAnalysis.status, 'COMPLETED');

    // Original statuses untouched by the AI step.
    assert.equal(failures.get(a.failureId).status, 'OPEN');
    assert.equal(results.get(a.resultId).status, 'FAIL');

    // Prompt contained the real evidence; Anthropic request shape is right.
    assert.equal(llmCalls.length, 1);
    assert.equal(llmCalls[0].url, '/v1/messages');
    assert.equal(llmCalls[0].headers['x-api-key'], 'test-key-123');
    const prompt = llmCalls[0].body.messages[0].content;
    assert.match(prompt, /User login with valid credentials/);
    assert.match(prompt, /Module: UI/);
    assert.match(prompt, /Login request returned 500/);
    assert.match(prompt, /Internal Server Error/);
    assert.match(prompt, /at login \(auth\.js/);
    // Text evidence only: no screenshot/video paths are sent.
    assert.doesNotMatch(prompt, /shot\.png|v\.webm/);
});

test('OpenAI-compatible provider request/response shape works', async () => {
    const a = addFailure();
    const updated = await analyzeFailure(a.failureId, {
        config: config({ provider: 'openai', rawProvider: 'openai', baseUrl })
    });

    assert.equal(updated.aiAnalysis.status, 'COMPLETED');
    assert.equal(llmCalls[0].url, '/chat/completions');
    assert.equal(llmCalls[0].headers.authorization, 'Bearer test-key-123');
    assert.equal(llmCalls[0].body.messages[0].role, 'system');
});

test('incomplete evidence: prompt says Not available and Low confidence is stored', async () => {
    const a = addFailure({
        resultOverrides: { error: null, stackTrace: null, expected: null, actual: null, evidence: {} }
    });
    llmBehavior = {
        text: JSON.stringify({
            probableCause: 'Insufficient evidence to determine a cause',
            supportingEvidence: 'No error message, expected or actual values were provided',
            suggestedFix: 'Re-run the test with logging enabled',
            confidence: 'Low',
            additionalInfoNeeded: 'Error message, response body and server logs'
        })
    };

    const updated = await analyzeFailure(a.failureId, { config: config() });

    const prompt = llmCalls[0].body.messages[0].content;
    assert.match(prompt, /Error message: Not available/);
    assert.match(prompt, /Stack trace: Not available/);
    assert.equal(updated.aiAnalysis.confidence, 'Low');
    assert.match(updated.aiAnalysis.additionalInfoNeeded, /server logs/);
});

test('LLM HTTP error: failure kept, analysis ERROR, retry then works', async () => {
    const a = addFailure();
    llmBehavior = { status: 500 };

    const updated = await analyzeFailure(a.failureId, { config: config() });

    assert.equal(updated.aiAnalysis.status, 'ERROR');
    assert.match(updated.aiAnalysis.error, /HTTP 500/);
    assert.ok(failures.has(a.failureId));
    assert.equal(failures.get(a.failureId).status, 'OPEN');
    assert.equal(results.get(a.resultId).status, 'FAIL');

    // Automatic path does NOT call the LLM again for an ERROR analysis.
    assert.equal(await analyzeFailure(a.failureId, { config: config() }), null);
    assert.equal(llmCalls.length, 1);

    // Explicit retry does.
    llmBehavior = {};
    const retried = await analyzeFailure(a.failureId, { config: config(), force: true });
    assert.equal(retried.aiAnalysis.status, 'COMPLETED');
    assert.equal(retried.aiAnalysis.attempts, 2);
    assert.equal(retried.aiAnalysis.error, null);
    assert.equal(llmCalls.length, 2);
});

test('LLM timeout: analysis ERROR, failure still saved', async () => {
    const a = addFailure();
    llmBehavior = { delayMs: 500 };

    const updated = await analyzeFailure(a.failureId, { config: config({ timeoutMs: 100 }) });

    assert.equal(updated.aiAnalysis.status, 'ERROR');
    assert.match(updated.aiAnalysis.error, /timed out/);
    assert.ok(failures.has(a.failureId));
});

test('malformed LLM output becomes ERROR, not a blank completed analysis', async () => {
    const a = addFailure();
    llmBehavior = { text: 'Sorry, I cannot help with that.' };

    const updated = await analyzeFailure(a.failureId, { config: config() });

    assert.equal(updated.aiAnalysis.status, 'ERROR');
    assert.equal(updated.aiAnalysis.probableCause, null);
});

test('missing API key: ERROR with clear message and no HTTP call', async () => {
    const a = addFailure();

    const updated = await analyzeFailure(a.failureId, { config: config({ apiKey: '' }) });

    assert.equal(updated.aiAnalysis.status, 'ERROR');
    assert.match(updated.aiAnalysis.error, /LLM_API_KEY/);
    assert.equal(llmCalls.length, 0);
});

test('passed test result is never sent to the LLM', async () => {
    const a = addFailure({ resultOverrides: { status: 'PASS' } });

    const updated = await analyzeFailure(a.failureId, { config: config() });

    assert.equal(llmCalls.length, 0);
    assert.equal(updated.aiAnalysis.status, 'ERROR');
    assert.match(updated.aiAnalysis.error, /only failed tests/);
});

test('repeated and concurrent processing of the same failure calls the LLM once', async () => {
    const a = addFailure();
    llmBehavior = { delayMs: 150 };

    const outcomes = await Promise.all([
        analyzeFailure(a.failureId, { config: config() }),
        analyzeFailure(a.failureId, { config: config() }),
        analyzeFailure(a.failureId, { config: config() })
    ]);

    assert.equal(llmCalls.length, 1);
    assert.equal(outcomes.filter(Boolean).length, 1);

    // Already COMPLETED: automatic processing does nothing more.
    assert.equal(await analyzeFailure(a.failureId, { config: config() }), null);
    assert.equal(llmCalls.length, 1);

    // A live PENDING analysis can't be claimed again even with force.
    failures.get(a.failureId).aiAnalysis = { status: 'PENDING', requestedAt: new Date() };
    assert.equal(await claimAnalysis(a.failureId, { force: true, config: config() }), null);
});

test('abandoned (stale) PENDING analysis can be claimed again', async () => {
    const a = addFailure();
    failures.get(a.failureId).aiAnalysis = {
        status: 'PENDING',
        requestedAt: new Date(Date.now() - 60 * 60 * 1000)
    };

    const claimed = await claimAnalysis(a.failureId, { config: config() });
    assert.ok(claimed);
    assert.equal(claimed.aiAnalysis.status, 'PENDING');
});

test('failure documents created before this feature (no aiAnalysis) are handled', async () => {
    const a = addFailure();
    delete failures.get(a.failureId).aiAnalysis;

    const updated = await analyzeFailure(a.failureId, { config: config() });
    assert.equal(updated.aiAnalysis.status, 'COMPLETED');
});

test('disabled feature or invalid id: no claim, no LLM call', async () => {
    const a = addFailure();

    assert.equal(await analyzeFailure(a.failureId, { config: config({ enabled: false }) }), null);
    assert.equal(await analyzeFailure('not-an-object-id', { config: config() }), null);
    assert.equal(llmCalls.length, 0);
});

test('different modules send their own module label and evidence', async () => {
    const suites = { API: 'API', E2E: 'E2E', WEBSOCKET: 'WebSocket', AI_VOICE: 'AI / Voice' };

    for (const [suite, label] of Object.entries(suites)) {
        const a = addFailure({
            resultOverrides: { suite, testName: `${suite} test`, endpoint: `/api/${suite.toLowerCase()}` }
        });
        await analyzeFailure(a.failureId, { config: config() });
        const prompt = llmCalls.at(-1).body.messages[0].content;
        assert.match(prompt, new RegExp(`Test name: ${suite} test`));
        assert.match(prompt, new RegExp(`Module: ${label.replace('/', '\\/')}`));
        assert.match(prompt, new RegExp(`Endpoint: /api/${suite.toLowerCase()}`));
    }
});

test('queueFailureAnalysis returns immediately, ignores junk, and completes in background', async () => {
    const a = addFailure();
    const original = { ...process.env };
    process.env.LLM_API_KEY = 'test-key-123';
    process.env.LLM_BASE_URL = baseUrl;
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.AI_ANALYSIS_ENABLED = 'true';

    try {
        assert.equal(queueFailureAnalysis(null), 0);
        assert.equal(queueFailureAnalysis([null, {}, undefined]), 0);

        const queued = queueFailureAnalysis([{ _id: a.failureId }]);
        assert.equal(queued, 1);
        assert.equal(llmCalls.length, 0); // not run synchronously

        for (let i = 0; i < 50 && failures.get(a.failureId).aiAnalysis.status !== 'COMPLETED'; i += 1) {
            await new Promise((r) => setTimeout(r, 20));
        }
        assert.equal(failures.get(a.failureId).aiAnalysis.status, 'COMPLETED');
    } finally {
        process.env = original;
    }
});

test('evidence builder: redacts secrets, truncates, omits media paths', () => {
    const long = 'x'.repeat(10000);
    const evidence = buildEvidence(
        { title: 'T', description: 'd', createdAt: new Date('2026-10-18T00:00:00Z') },
        {
            testName: 'T',
            suite: 'API',
            status: 'FAIL',
            error: `Request failed with Authorization: Bearer abc.def.ghi and "password": "hunter2" ${long}`,
            actual: { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlMTIz' },
            evidence: { screenshot: '/a.png', trace: '/b.zip', video: '/c.webm', response: { ok: false } }
        }
    );

    assert.doesNotMatch(evidence.errorMessage, /hunter2|abc\.def\.ghi/);
    assert.match(evidence.errorMessage, /\[truncated\]/);
    assert.ok(evidence.errorMessage.length < 4100);
    assert.doesNotMatch(evidence.actual, /eyJhbGci/);
    assert.equal(evidence.module, 'API');
    assert.ok(!('screenshot' in evidence) && !('video' in evidence) && !('trace' in evidence));
    assert.match(evidence.response, /"ok": false/);
    assert.equal(evidence.expected, null);

    assert.match(redactSecrets('sk-abcdefghijklmnopqrstuvwx'), /REDACTED/);
    assert.doesNotMatch(buildPrompt(evidence), /undefined|\bnull\b/);
});

test('response parser: fences, arrays, confidence normalization, and rejection', () => {
    const fenced =
        '```json\n' +
        JSON.stringify({
            probableCause: 'c',
            supportingEvidence: ['one', 'two'],
            suggestedFix: 'f',
            confidence: 'medium'
        }) +
        '\n```';
    const parsed = parseAnalysisResponse(`Here you go:\n${fenced}`);
    assert.equal(parsed.confidence, 'Medium');
    assert.equal(parsed.supportingEvidence, '- one\n- two');
    assert.equal(parsed.additionalInfoNeeded, null);

    assert.equal(
        parseAnalysisResponse('{"probableCause":"c","suggestedFix":"f","confidence":"???"}').confidence,
        'Low'
    );
    assert.throws(() => parseAnalysisResponse('no json here'), /JSON/);
    assert.throws(() => parseAnalysisResponse('{"probableCause":"c"}'), /missing/);
});

test('mongoose accepts the model and the claim query shapes', () => {
    const doc = new Failure({
        runId: 'R',
        testResultId: new mongoose.Types.ObjectId(),
        title: 't',
        severity: 'HIGH'
    });
    assert.equal(doc.validateSync(), undefined);
    assert.equal(doc.aiAnalysis.status, null);

    doc.aiAnalysis.status = 'PENDING';
    doc.aiAnalysis.confidence = 'High';
    assert.equal(doc.validateSync(), undefined);

    doc.aiAnalysis.status = 'NOPE';
    assert.ok(doc.validateSync());

    const filter = {
        _id: new mongoose.Types.ObjectId().toString(),
        $or: [
            { 'aiAnalysis.status': null },
            { 'aiAnalysis.status': 'PENDING', 'aiAnalysis.requestedAt': { $lt: new Date() } },
            { 'aiAnalysis.status': { $in: ['ERROR', 'COMPLETED'] } }
        ]
    };
    const cast = Failure.find(filter).cast(Failure);
    assert.ok(cast.$or.length === 3);
});
