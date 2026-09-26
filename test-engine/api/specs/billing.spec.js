import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as billingHelper from '../helpers/billing.helper.js';

test.describe('Billing API - Unauthorized Boundaries', () => {
    test('GET /api/billing/balance - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await billingHelper.getBalance(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/billing/balance',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/billing/transactions - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await billingHelper.getTransactions(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/billing/transactions',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });
});

test.describe('Billing API - Authenticated Endpoints & Pagination', () => {
    test('GET /api/billing/balance - should return balance object with numeric value', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await billingHelper.getBalance(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/billing/balance',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('balance');
        expect(typeof body.balance).toBe('number');
    });

    test('GET /api/billing/transactions - should return default paginated transactions structure', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await billingHelper.getTransactions(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/billing/transactions',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('transactions');
        expect(body).toHaveProperty('totalPages');
        expect(body).toHaveProperty('currentPage');
        expect(body).toHaveProperty('totalTransactions');
        expect(Array.isArray(body.transactions)).toBe(true);
        expect(body.currentPage).toBe(1);
    });

    test('GET /api/billing/transactions - should support custom page and limit parameters', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await billingHelper.getTransactions(authContext, { page: 2, limit: 10 });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/billing/transactions?page=2&limit=10',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body.currentPage).toBe(2);
        expect(body.transactions.length).toBeLessThanOrEqual(10);
    });

    test('GET /api/billing/transactions - should reject limit exceeding max allowed (100) with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await billingHelper.getTransactions(authContext, { limit: 101 });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/billing/transactions?limit=101',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });
});
