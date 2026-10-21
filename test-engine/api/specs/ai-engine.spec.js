import { test, expect } from '../../fixtures/agent.fixture.js';
import * as aiHelper from '../helpers/aiEngine.helper.js';
import { VALID_FAKE_OBJ_ID, INVALID_OBJ_ID, SAFE_AI_QUERY } from '../data/constants.js';
import { captureAiHttpEvidence } from '../../shared/aiErrorCapture.js';

test.describe('AI Engine API - Unauthorized Boundaries (Expected 401)', () => {
    test('GET /api/ai-engine/providers - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.getProviders(apiContext));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/ai-engine/providers',
            expectedStatus: 401,
            actualStatus: status,
            durationMs,
            responseBody: body,
            error,
            expected: true, // Expected negative error response
        });

        if (error) {
            expect(error, `Network failure connecting to backend: ${error.message}`).toBeNull();
        }
        expect(status).toBe(401);
    });

    test('POST /api/ai-engine/query - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const payload = { agentId: VALID_FAKE_OBJ_ID, text: 'Hello' };
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.query(apiContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 401,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: true,
        });

        if (error) {
            expect(error, `Network failure connecting to backend: ${error.message}`).toBeNull();
        }
        expect(status).toBe(401);
    });

    test('POST /api/ai-engine/conversation - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const payload = { agentId: VALID_FAKE_OBJ_ID };
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.startConversation(apiContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/conversation',
            expectedStatus: 401,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: true,
        });

        if (error) {
            expect(error, `Network failure connecting to backend: ${error.message}`).toBeNull();
        }
        expect(status).toBe(401);
    });
});

test.describe('AI Engine API - Providers Catalog Schema', () => {
    test('GET /api/ai-engine/providers - should return provider catalog with engines, STT, LLM, TTS models', async ({ authContext }, testInfo) => {
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.getProviders(authContext));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/ai-engine/providers',
            expectedStatus: 200,
            actualStatus: status,
            durationMs,
            responseBody: body,
            error,
            expected: false,
        });

        if (error) {
            expect(error, `Network failure connecting to backend: ${error.message}`).toBeNull();
        }
        expect(status).toBe(200);
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

test.describe('AI Engine API - Input Validation & Negative Boundaries (Expected 400/404)', () => {
    test('POST /api/ai-engine/query - should reject missing text field with 400', async ({ authContext }, testInfo) => {
        const payload = { agentId: VALID_FAKE_OBJ_ID };
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.query(authContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 400,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: true,
        });

        if (error) {
            expect(error, `Network failure: ${error.message}`).toBeNull();
        }
        expect(status).toBe(400);
    });

    test('POST /api/ai-engine/query - should reject missing agentId with 400', async ({ authContext }, testInfo) => {
        const payload = { text: 'Hello' };
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.query(authContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 400,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: true,
        });

        if (error) {
            expect(error, `Network failure: ${error.message}`).toBeNull();
        }
        expect(status).toBe(400);
    });

    test('POST /api/ai-engine/query - should reject malformed agentId with 400', async ({ authContext }, testInfo) => {
        const payload = { agentId: INVALID_OBJ_ID, text: 'Hello' };
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.query(authContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 400,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: true,
        });

        if (error) {
            expect(error, `Network failure: ${error.message}`).toBeNull();
        }
        expect(status).toBe(400);
    });

    test('POST /api/ai-engine/query - should return 404 for valid non-existent agentId', async ({ authContext }, testInfo) => {
        const payload = { agentId: VALID_FAKE_OBJ_ID, text: SAFE_AI_QUERY.text };
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.query(authContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 404,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: true,
        });

        if (error) {
            expect(error, `Network failure: ${error.message}`).toBeNull();
        }
        expect(status).toBe(404);
    });

    test('POST /api/ai-engine/conversation - should reject missing agentId with 400', async ({ authContext }, testInfo) => {
        const payload = {};
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.startConversation(authContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/conversation',
            expectedStatus: 400,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: true,
        });

        if (error) {
            expect(error, `Network failure: ${error.message}`).toBeNull();
        }
        expect(status).toBe(400);
    });

    test('POST /api/ai-engine/conversation - should reject malformed agentId with 400', async ({ authContext }, testInfo) => {
        const payload = { agentId: INVALID_OBJ_ID };
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.startConversation(authContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/conversation',
            expectedStatus: 400,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: true,
        });

        if (error) {
            expect(error, `Network failure: ${error.message}`).toBeNull();
        }
        expect(status).toBe(400);
    });

    test('POST /api/ai-engine/conversation - should return 404 for valid non-existent agentId', async ({ authContext }, testInfo) => {
        const payload = { agentId: VALID_FAKE_OBJ_ID };
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.startConversation(authContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/conversation',
            expectedStatus: 404,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: true,
        });

        if (error) {
            expect(error, `Network failure: ${error.message}`).toBeNull();
        }
        expect(status).toBe(404);
    });
});

test.describe('AI Engine API - Valid Agent Execution Flows', () => {
    test('POST /api/ai-engine/query - should succeed with valid owned agent', async ({ authContext, testAgent }, testInfo) => {
        const payload = {
            agentId: testAgent.id,
            text: 'Hello, what are your service operating hours?',
        };

        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.query(authContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: false,
        });

        if (error) {
            expect(error, `Network failure: ${error.message}`).toBeNull();
        }
        expect(status).toBe(200);
        expect(body).toHaveProperty('success', true);
    });

    test('POST /api/ai-engine/conversation - should start session with valid owned agent', async ({ authContext, testAgent }, testInfo) => {
        const payload = {
            agentId: testAgent.id,
        };

        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.startConversation(authContext, payload));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/conversation',
            expectedStatus: 200,
            actualStatus: status,
            durationMs,
            requestPayload: payload,
            responseBody: body,
            error,
            expected: false,
        });

        if (error) {
            expect(error, `Network failure: ${error.message}`).toBeNull();
        }
        expect(status).toBe(200);
    });
});

test.describe('AI Engine API - Live External AI Host Verification', () => {
    test('GET /health - external AI Engine host is reachable and warm', async ({ apiContext }, testInfo) => {
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.checkDirectEngineHealth(apiContext));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'GET',
            endpoint: '/health (direct AI engine)',
            expectedStatus: 200,
            actualStatus: status,
            durationMs,
            responseBody: body,
            error,
            expected: false,
        });

        if (error) {
            expect(error, `Direct AI engine health check failed: ${error.message}`).toBeNull();
        }
        expect(status).toBe(200);
        expect(body).toHaveProperty('status', 'ok');
    });

    test('GET /api/tts/voices - external AI Engine exposes voice models', async ({ apiContext }, testInfo) => {
        const { response, durationMs, error } = await aiHelper.timedCall(() => aiHelper.getDirectEngineVoices(apiContext));
        const status = response?.status() ?? null;
        const body = await response?.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/tts/voices (direct AI engine)',
            expectedStatus: 200,
            actualStatus: status,
            durationMs,
            responseBody: body,
            error,
            expected: false,
        });

        if (error) {
            expect(error, `Direct AI engine voices endpoint failed: ${error.message}`).toBeNull();
        }
        expect(status).toBe(200);
    });
});
