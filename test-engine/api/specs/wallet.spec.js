import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as walletHelper from '../helpers/wallet.helper.js';

test.describe('Wallet API - Unauthorized Boundaries', () => {
    test('GET /api/wallet - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await walletHelper.getWallet(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/wallet',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/wallet/phone-renewal-alerts - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await walletHelper.getPhoneRenewalAlerts(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/wallet/phone-renewal-alerts',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/wallet/transactions - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await walletHelper.getWalletTransactions(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/wallet/transactions',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });
});

test.describe('Wallet API - Authenticated Endpoints & Schema Validation', () => {
    test('GET /api/wallet - should return wallet object with balance and stats structure', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await walletHelper.getWallet(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/wallet',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('wallet');
        expect(body.wallet).toHaveProperty('balance');
        expect(body.wallet).toHaveProperty('currency');
        expect(body.wallet).toHaveProperty('credits');
        expect(body.wallet).toHaveProperty('stats');
        expect(typeof body.wallet.balance).toBe('number');
        expect(body.wallet.currency).toBe('INR');
        expect(typeof body.wallet.stats.totalSpentThisMonth).toBe('number');
        expect(typeof body.wallet.stats.callsThisMonth).toBe('number');
    });

    test('GET /api/wallet/phone-renewal-alerts - should return alerts list', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await walletHelper.getPhoneRenewalAlerts(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/wallet/phone-renewal-alerts',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
    });

    test('GET /api/wallet/transactions - should return user wallet transactions list', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await walletHelper.getWalletTransactions(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/wallet/transactions',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
    });

    test('POST /api/wallet/create-checkout-session - should reject missing amount with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await walletHelper.createCheckoutSession(authContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/wallet/create-checkout-session',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/wallet/add-funds - should reject missing paymentMethodId with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await walletHelper.addFunds(authContext, { amount: 100 });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/wallet/add-funds',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/wallet/debit - should reject missing description with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await walletHelper.debitWallet(authContext, { amount: 10 });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/wallet/debit',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/wallet/reconcile-calls - should process call reconciliation for user', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await walletHelper.reconcileCalls(authContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/wallet/reconcile-calls',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
    });
});
