import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as vobizHelper from '../helpers/vobiz.helper.js';
import { VALID_FAKE_OBJ_ID, INVALID_OBJ_ID } from '../data/constants.js';

test.describe('VoBiz Telephony API - Public Config & Unauthorized Boundaries', () => {
    test('GET /api/vobiz/config - should return public telephony configuration', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await vobizHelper.getConfig(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/vobiz/config',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('configured');
        expect(typeof body.configured).toBe('boolean');
    });

    test('GET /api/vobiz/numbers - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await vobizHelper.getUserNumbers(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/vobiz/numbers',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/vobiz/numbers/available - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await vobizHelper.getAvailableNumbers(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/vobiz/numbers/available',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });
});

test.describe('VoBiz Telephony API - Authenticated Numbers Endpoints', () => {
    test('GET /api/vobiz/numbers - should return numbers list for authenticated user', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await vobizHelper.getUserNumbers(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/vobiz/numbers',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
    });

    test('GET /api/vobiz/numbers/:id - should return 404 for non-existent number ID', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await vobizHelper.getUserNumberById(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/vobiz/numbers/${VALID_FAKE_OBJ_ID}`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('PATCH /api/vobiz/numbers/:id/routing - should return 404 for non-existent number ID', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await vobizHelper.updateNumberRouting(authContext, VALID_FAKE_OBJ_ID, { agentId: VALID_FAKE_OBJ_ID });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'PATCH',
            endpoint: `/api/vobiz/numbers/${VALID_FAKE_OBJ_ID}/routing`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('POST /api/vobiz/numbers/buy - should reject missing areaCode with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await vobizHelper.purchaseNumber(authContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/vobiz/numbers/buy',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('DELETE /api/vobiz/numbers/:id - should return 404 for non-existent number ID', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await vobizHelper.releaseNumber(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'DELETE',
            endpoint: `/api/vobiz/numbers/${VALID_FAKE_OBJ_ID}`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });
});

test.describe('VoBiz Telephony API - Outbound Call Safety Guard', () => {
    test('POST /api/vobiz/call - validation rejects missing fields without triggering a phone call', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = {};
        const response = await vobizHelper.makeCall(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/vobiz/call',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/vobiz/call - live call initiation is safely skipped by default', async () => {
        test.skip(
            process.env.ALLOW_REAL_CALLS !== 'true',
            'Skipped: Real phone call tests require explicit authorization (ALLOW_REAL_CALLS=true)'
        );

        // This block only executes when user explicitly passes ALLOW_REAL_CALLS=true
    });
});
