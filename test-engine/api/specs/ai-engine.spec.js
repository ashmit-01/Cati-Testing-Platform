import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as aiHelper from '../helpers/aiEngine.helper.js';
import { VALID_FAKE_OBJ_ID, INVALID_OBJ_ID, SAFE_AI_QUERY } from '../data/constants.js';

test.describe('AI Engine API - Unauthorized Boundaries', () => {
    test('GET /api/ai-engine/providers - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await aiHelper.getProviders(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/ai-engine/providers',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('POST /api/ai-engine/query - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await aiHelper.query(apiContext, { agentId: VALID_FAKE_OBJ_ID, text: 'Hello' });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('POST /api/ai-engine/conversation - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await aiHelper.startConversation(apiContext, { agentId: VALID_FAKE_OBJ_ID });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/conversation',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });
});

test.describe('AI Engine API - Providers Catalog Schema', () => {
    test('GET /api/ai-engine/providers - should return provider catalog with engines, STT, LLM, TTS models', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await aiHelper.getProviders(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/ai-engine/providers',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('engines');
        expect(body.data).toHaveProperty('sttProviders');
        expect(body.data).toHaveProperty('llmProviders');
        expect(body.data).toHaveProperty('ttsProviders');
        expect(body.data).toHaveProperty('models');
        expect(Array.isArray(body.data.engines)).toBe(true);
        expect(Array.isArray(body.data.llmProviders)).toBe(true);
    });
});

test.describe('AI Engine API - Query & Conversation Input Validation', () => {
    test('POST /api/ai-engine/query - should reject missing text field with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = { agentId: VALID_FAKE_OBJ_ID };
        const response = await aiHelper.query(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/ai-engine/query - should reject missing agentId with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = { text: 'Hello' };
        const response = await aiHelper.query(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/ai-engine/query - should reject malformed agentId with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = { agentId: INVALID_OBJ_ID, text: 'Hello' };
        const response = await aiHelper.query(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/ai-engine/query - should return 404 for valid non-existent agentId', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = { agentId: VALID_FAKE_OBJ_ID, text: SAFE_AI_QUERY.text };
        const response = await aiHelper.query(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('POST /api/ai-engine/conversation - should reject missing agentId with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await aiHelper.startConversation(authContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/conversation',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });
});
