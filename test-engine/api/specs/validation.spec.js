import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import { VALID_FAKE_OBJ_ID, INVALID_OBJ_ID } from '../data/constants.js';

test.describe('Cross-Domain Validation & Boundary Tests', () => {
    test.describe('401 Unauthorized - Missing / Invalid Authentication Across Endpoints', () => {
        const protectedGetEndpoints = [
            { name: 'Agents List', path: '/api/agents' },
            { name: 'Single Agent', path: `/api/agents/${VALID_FAKE_OBJ_ID}` },
            { name: 'Calls List', path: '/api/calls' },
            { name: 'Analytics Overview', path: '/api/analytics/overview' },
            { name: 'Billing Balance', path: '/api/billing/balance' },
            { name: 'Billing Transactions', path: '/api/billing/transactions' },
            { name: 'Wallet Info', path: '/api/wallet' },
            { name: 'AI Engine Providers', path: '/api/ai-engine/providers' },
        ];

        for (const ep of protectedGetEndpoints) {
            test(`GET ${ep.path} - should return 401 when no token is provided`, async ({ apiContext }, testInfo) => {
                const start = Date.now();
                const response = await apiContext.get(ep.path);
                const durationMs = Date.now() - start;
                const body = await response.json().catch(() => ({}));

                await attachApiEvidence(testInfo, {
                    method: 'GET',
                    endpoint: ep.path,
                    expectedStatus: 401,
                    actualStatus: response.status(),
                    durationMs,
                    responseBody: body,
                });

                expect(response.status()).toBe(401);
            });

            test(`GET ${ep.path} - should return 401 when invalid Bearer token is provided`, async ({ apiContext }, testInfo) => {
                const start = Date.now();
                const response = await apiContext.get(ep.path, {
                    headers: { Authorization: 'Bearer invalid.garbage.token' },
                });
                const durationMs = Date.now() - start;
                const body = await response.json().catch(() => ({}));

                await attachApiEvidence(testInfo, {
                    method: 'GET',
                    endpoint: ep.path,
                    expectedStatus: 401,
                    actualStatus: response.status(),
                    durationMs,
                    responseBody: body,
                });

                expect(response.status()).toBe(401);
            });
        }
    });

    test.describe('400 Bad Request - Malformed MongoDB ObjectId Across Resource Endpoints', () => {
        const idEndpoints = [
            { method: 'GET', path: `/api/agents/${INVALID_OBJ_ID}` },
            { method: 'GET', path: `/api/calls/${INVALID_OBJ_ID}` },
            { method: 'GET', path: `/api/agents/${INVALID_OBJ_ID}/system-prompt` },
            { method: 'GET', path: `/api/agents/${INVALID_OBJ_ID}/knowledge` },
        ];

        for (const ep of idEndpoints) {
            test(`${ep.method} ${ep.path} - should return 400 for malformed ObjectId`, async ({ authContext }, testInfo) => {
                const start = Date.now();
                const response = await authContext.fetch(ep.path, { method: ep.method });
                const durationMs = Date.now() - start;
                const body = await response.json().catch(() => ({}));

                await attachApiEvidence(testInfo, {
                    method: ep.method,
                    endpoint: ep.path,
                    expectedStatus: 400,
                    actualStatus: response.status(),
                    durationMs,
                    responseBody: body,
                });

                expect(response.status()).toBe(400);
            });
        }
    });

    test.describe('404 Not Found - Valid-Format Non-Existent ObjectId Across Resource Endpoints', () => {
        const notFoundEndpoints = [
            { method: 'GET', path: `/api/agents/${VALID_FAKE_OBJ_ID}` },
            { method: 'GET', path: `/api/calls/${VALID_FAKE_OBJ_ID}` },
            { method: 'GET', path: `/api/agents/${VALID_FAKE_OBJ_ID}/knowledge` },
            { method: 'DELETE', path: `/api/agents/${VALID_FAKE_OBJ_ID}` },
        ];

        for (const ep of notFoundEndpoints) {
            test(`${ep.method} ${ep.path} - should return 404 for valid non-existent ID`, async ({ authContext }, testInfo) => {
                const start = Date.now();
                const response = await authContext.fetch(ep.path, { method: ep.method });
                const durationMs = Date.now() - start;
                const body = await response.json().catch(() => ({}));

                await attachApiEvidence(testInfo, {
                    method: ep.method,
                    endpoint: ep.path,
                    expectedStatus: 404,
                    actualStatus: response.status(),
                    durationMs,
                    responseBody: body,
                });

                expect(response.status()).toBe(404);
            });
        }
    });

    test.describe('400 Bad Request - Invalid Query Parameter Types', () => {
        test('GET /api/billing/transactions - should reject negative page number with 400', async ({ authContext }, testInfo) => {
            const start = Date.now();
            const response = await authContext.get('/api/billing/transactions', {
                params: { page: -1 },
            });
            const durationMs = Date.now() - start;
            const body = await response.json().catch(() => ({}));

            await attachApiEvidence(testInfo, {
                method: 'GET',
                endpoint: '/api/billing/transactions?page=-1',
                expectedStatus: 400,
                actualStatus: response.status(),
                durationMs,
                responseBody: body,
            });

            expect(response.status()).toBe(400);
        });

        test('GET /api/billing/transactions - should reject limit exceeding maximum (100) with 400', async ({ authContext }, testInfo) => {
            const start = Date.now();
            const response = await authContext.get('/api/billing/transactions', {
                params: { limit: 500 },
            });
            const durationMs = Date.now() - start;
            const body = await response.json().catch(() => ({}));

            await attachApiEvidence(testInfo, {
                method: 'GET',
                endpoint: '/api/billing/transactions?limit=500',
                expectedStatus: 400,
                actualStatus: response.status(),
                durationMs,
                responseBody: body,
            });

            expect(response.status()).toBe(400);
        });
    });

    test.describe('400 Bad Request - Empty / Missing Payloads for Mutating Endpoints', () => {
        test('POST /api/agents - should reject empty JSON object with 400', async ({ authContext }, testInfo) => {
            const start = Date.now();
            const response = await authContext.post('/api/agents', { data: {} });
            const durationMs = Date.now() - start;
            const body = await response.json().catch(() => ({}));

            await attachApiEvidence(testInfo, {
                method: 'POST',
                endpoint: '/api/agents',
                expectedStatus: 400,
                actualStatus: response.status(),
                durationMs,
                requestBody: {},
                responseBody: body,
            });

            expect(response.status()).toBe(400);
        });

        test('POST /api/payments/create-order - should reject invalid payment amount with 400', async ({ authContext }, testInfo) => {
            const start = Date.now();
            const payload = { amount: -50 };
            const response = await authContext.post('/api/payments/create-order', { data: payload });
            const durationMs = Date.now() - start;
            const body = await response.json().catch(() => ({}));

            await attachApiEvidence(testInfo, {
                method: 'POST',
                endpoint: '/api/payments/create-order',
                expectedStatus: 400,
                actualStatus: response.status(),
                durationMs,
                requestBody: payload,
                responseBody: body,
            });

            expect(response.status()).toBe(400);
        });
    });
});
