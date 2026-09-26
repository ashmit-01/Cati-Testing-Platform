import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as kbHelper from '../helpers/agent-kb.helper.js';
import { VALID_FAKE_OBJ_ID, INVALID_OBJ_ID } from '../data/constants.js';

test.describe('Agent Knowledge Base API - Unauthorized Boundaries', () => {
    test('GET /api/agents/:id/knowledge - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await kbHelper.getKnowledge(apiContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/agents/${VALID_FAKE_OBJ_ID}/knowledge`,
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('POST /api/agents/ingest-text - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await kbHelper.ingestText(apiContext, { agentId: VALID_FAKE_OBJ_ID, text: 'Sample' });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents/ingest-text',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('POST /api/agents/ingest-url - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await kbHelper.ingestUrl(apiContext, { agentId: VALID_FAKE_OBJ_ID, url: 'https://example.com' });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents/ingest-url',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('POST /api/agents/refresh-all-kb - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await kbHelper.refreshAllKnowledgeBase(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents/refresh-all-kb',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });
});

test.describe('Agent Knowledge Base API - Schema & Input Validation', () => {
    test('GET /api/agents/:id/knowledge - should reject malformed ObjectId with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await kbHelper.getKnowledge(authContext, INVALID_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/agents/${INVALID_OBJ_ID}/knowledge`,
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('GET /api/agents/:id/knowledge - should return 404 for valid non-existent agent ID', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await kbHelper.getKnowledge(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/agents/${VALID_FAKE_OBJ_ID}/knowledge`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('DELETE /api/agents/:id/knowledge - should return 404 for valid non-existent agent ID', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await kbHelper.clearKnowledge(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'DELETE',
            endpoint: `/api/agents/${VALID_FAKE_OBJ_ID}/knowledge`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('POST /api/agents/:id/knowledge/remove - should reject missing chunkHash with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await kbHelper.removeKnowledgeChunk(authContext, VALID_FAKE_OBJ_ID, '');
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: `/api/agents/${VALID_FAKE_OBJ_ID}/knowledge/remove`,
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/agents/ingest-text - should reject missing agentId or text with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await kbHelper.ingestText(authContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents/ingest-text',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/agents/ingest-url - should reject missing agentId or url with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await kbHelper.ingestUrl(authContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents/ingest-url',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/agents/upload - should reject missing file with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await authContext.post('/api/agents/upload');
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents/upload',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/agents/ingest-image - should reject missing image with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await authContext.post('/api/agents/ingest-image');
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents/ingest-image',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });
});
