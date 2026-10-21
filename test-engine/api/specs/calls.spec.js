import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as callsHelper from '../helpers/calls.helper.js';
import { VALID_FAKE_OBJ_ID, INVALID_OBJ_ID } from '../data/constants.js';

test.describe('Calls API - Unauthorized Boundaries', () => {
    test('GET /api/calls - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await callsHelper.getCalls(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/calls',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/calls/:id - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await callsHelper.getCall(apiContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/calls/${VALID_FAKE_OBJ_ID}`,
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/calls/:id/recording/stream - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await callsHelper.getRecordingStream(apiContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/calls/${VALID_FAKE_OBJ_ID}/recording/stream`,
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/calls/:id/recording/download - should reject malformed ID with 400', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await callsHelper.getRecordingDownload(apiContext, INVALID_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/calls/${INVALID_OBJ_ID}/recording/download`,
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('GET /api/calls/:id/recording/download - should return 404 for non-existent call ID', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await callsHelper.getRecordingDownload(apiContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/calls/${VALID_FAKE_OBJ_ID}/recording/download`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });
});

test.describe('Calls API - Authenticated Read-Only & Query Endpoints', () => {
    test('GET /api/calls - should return list of calls for authenticated user', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callsHelper.getCalls(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/calls',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('calls');
        expect(Array.isArray(body.calls)).toBe(true);
    });

    test('GET /api/calls/:id - should return 404 for non-existent call', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callsHelper.getCall(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/calls/${VALID_FAKE_OBJ_ID}`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('GET /api/calls/:id/recording/stream - should return 404 for non-existent recording', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callsHelper.getRecordingStream(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/calls/${VALID_FAKE_OBJ_ID}/recording/stream`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('DELETE /api/calls/:id/terminate - should return 404 for non-existent call', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callsHelper.terminateCall(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'DELETE',
            endpoint: `/api/calls/${VALID_FAKE_OBJ_ID}/terminate`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('POST /api/calls/:id/follow-up-insights - should return 404 for non-existent call', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callsHelper.generateFollowUpInsights(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: `/api/calls/${VALID_FAKE_OBJ_ID}/follow-up-insights`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });
});

test.describe('Calls API - Telephony Call Creation Safety Guard', () => {
    test('POST /api/calls - validation rejects missing fields without triggering a phone call', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = {};
        const response = await callsHelper.createCall(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calls',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/calls/demo - validation rejects missing fields without triggering a call', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = {};
        const response = await callsHelper.createDemoCall(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calls/demo',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/calls - live call trigger is safely skipped by default', async () => {
        test.skip(
            process.env.ALLOW_REAL_CALLS !== 'true',
            'Skipped: Real phone call tests require explicit authorization (ALLOW_REAL_CALLS=true)'
        );

        // This block only executes when user explicitly passes ALLOW_REAL_CALLS=true
    });
});
