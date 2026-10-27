
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
    analyzeManualError,
    parseImageInput,
    parseManualResponse
} from '../services/aiFailureAnalysisService.js';

// 1x1 transparent PNG
const PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const MODEL_JSON = JSON.stringify({
    whatHappened: 'HTTP 500 from /api/calls',
    whereFrom: 'Backend API, calls controller',
    suggestedFix: 'Check the server log for the stack trace',
    confidence: 'medium'
});

let lastRequest = null;

const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
        lastRequest = { url: req.url, headers: req.headers, body: JSON.parse(body) };
        res.setHeader('Content-Type', 'application/json');
        if (req.url.includes('/v1/messages')) {
            res.end(JSON.stringify({ content: [{ type: 'text', text: MODEL_JSON }] }));
        } else if (req.url.includes('generateContent')) {
            res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: MODEL_JSON }] } }] }));
        } else {
            res.end(JSON.stringify({ choices: [{ message: { content: MODEL_JSON } }] }));
        }
    });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

const cfg = (provider) => ({
    enabled: true,
    provider,
    rawProvider: provider,
    apiKey: 'test-key',
    model: 'test-model',
    baseUrl,
    timeoutMs: 5000,
    maxTokens: 512,
    retries: 0,
    retryDelayMs: 0
});

test('anthropic: sends the screenshot as an image block and parses the answer', async () => {
    const out = await analyzeManualError({ text: 'Error 500', image: `data:image/png;base64,${PNG}` }, cfg('anthropic'));
    const content = lastRequest.body.messages[0].content;
    assert.equal(content[0].type, 'image');
    assert.equal(content[0].source.media_type, 'image/png');
    assert.equal(content[0].source.data, PNG);
    assert.match(content[1].text, /Error 500/);
    assert.equal(out.confidence, 'Medium');
    assert.equal(out.whereFrom, 'Backend API, calls controller');
});

test('gemini: sends inlineData', async () => {
    await analyzeManualError({ image: PNG, imageType: 'image/png' }, cfg('gemini'));
    const parts = lastRequest.body.contents[0].parts;
    assert.equal(parts[1].inlineData.mimeType, 'image/png');
    assert.equal(parts[1].inlineData.data, PNG);
});

test('openai: sends image_url data URL', async () => {
    await analyzeManualError({ image: PNG, imageType: 'image/png' }, cfg('openai'));
    const content = lastRequest.body.messages[1].content;
    assert.equal(content[1].type, 'image_url');
    assert.ok(content[1].image_url.url.startsWith('data:image/png;base64,'));
});

test('text only: no image is sent and secrets are redacted', async () => {
    await analyzeManualError({ text: 'failed with Bearer abc.def.ghi123 token' }, cfg('anthropic'));
    const content = lastRequest.body.messages[0].content;
    assert.equal(typeof content, 'string');
    assert.match(content, /Bearer \[REDACTED\]/);
    assert.doesNotMatch(content, /abc\.def\.ghi123/);
});

test('rejects empty input, bad image type, oversized text', async () => {
    await assert.rejects(analyzeManualError({}, cfg('anthropic')), { status: 400 });
    await assert.rejects(analyzeManualError({ image: PNG, imageType: 'image/bmp' }, cfg('anthropic')), { status: 400 });
    await assert.rejects(analyzeManualError({ text: 'x'.repeat(8001) }, cfg('anthropic')), { status: 400 });
});

test('missing API key gives 503, provider failure gives 502', async () => {
    await assert.rejects(analyzeManualError({ text: 'x' }, { ...cfg('anthropic'), apiKey: '' }), { status: 503 });
    await assert.rejects(
        analyzeManualError({ text: 'x' }, { ...cfg('anthropic'), baseUrl: 'http://127.0.0.1:1' }),
        { status: 502 }
    );
});

test('parse helpers', () => {
    assert.throws(() => parseManualResponse('nope'));
    assert.throws(() => parseManualResponse('{"whatHappened":"a"}'));
    assert.deepEqual(parseImageInput(`data:image/jpeg;base64,${PNG}`), { mimeType: 'image/jpeg', data: PNG });
});

test('openai-compatible (Groq): strips <think> blocks before parsing', async () => {
    const thinking = http.createServer((req, res) => {
        req.resume();
        req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                choices: [{ message: { content: `<think>maybe {"a":1} hmm</think>\n${MODEL_JSON}` } }]
            }));
        });
    });
    await new Promise((resolve) => thinking.listen(0, '127.0.0.1', resolve));
    try {
        const out = await analyzeManualError(
            { text: 'Error 500' },
            { ...cfg('openai'), baseUrl: `http://127.0.0.1:${thinking.address().port}` }
        );
        assert.equal(out.whatHappened, 'HTTP 500 from /api/calls');
    } finally {
        thinking.close();
    }
});