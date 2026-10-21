import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as paymentsHelper from '../helpers/payments.helper.js';

test.describe('Payments API - Unauthorized Boundaries', () => {
    test('POST /api/payments/create-order - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await paymentsHelper.createOrder(apiContext, { amount: 500 });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/payments/create-order',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            requestBody: { amount: 500 },
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('POST /api/payments/verify - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { orderId: 'order_123', paymentId: 'pay_123', signature: 'sig_123' };
        const response = await paymentsHelper.verifyPayment(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/payments/verify',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/payments/:paymentId - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await paymentsHelper.getPaymentDetails(apiContext, 'pay_test123');
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/payments/pay_test123',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });
});

test.describe('Payments API - Input Validation & Order Safety', () => {
    test('POST /api/payments/create-order - should reject missing amount with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = {};
        const response = await paymentsHelper.createOrder(authContext, payload);
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

    test('POST /api/payments/create-order - should reject amount below minimum (100 INR) with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = { amount: 50 }; // Minimum is 100 INR
        const response = await paymentsHelper.createOrder(authContext, payload);
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

    test('POST /api/payments/create-order - should reject amount exceeding maximum (100,000 INR) with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = { amount: 200000 };
        const response = await paymentsHelper.createOrder(authContext, payload);
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

    test('POST /api/payments/verify - should reject missing signature fields with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = { orderId: 'order_123' };
        const response = await paymentsHelper.verifyPayment(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/payments/verify',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/payments/verify - should reject invalid forged signature with 400 or 401', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = {
            orderId: 'order_fake_123',
            paymentId: 'pay_fake_456',
            signature: 'invalid_forged_signature_hash',
        };
        const response = await paymentsHelper.verifyPayment(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/payments/verify',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect([400, 401]).toContain(response.status());
    });
});

test.describe('Payments API - Admin Authorization Boundaries', () => {
    test('POST /api/payments/:paymentId/refund - should reject non-admin refund attempt with 403 Forbidden', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = { amount: 100, reason: 'Test unauthorized refund' };
        const response = await paymentsHelper.refundPayment(authContext, 'pay_test_payment_id', payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/payments/pay_test_payment_id/refund',
            expectedStatus: 403,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        // The controller explicitly asserts req.user.role === 'admin', throwing 403 for standard users
        expect(response.status()).toBe(403);
    });

    test('GET /api/payments/:paymentId - should return 400 for non-existent payment ID on authenticated lookup', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const paymentId = 'pay_nonexistent_123456';
        const response = await paymentsHelper.getPaymentDetails(authContext, paymentId);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/payments/${paymentId}`,
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        // Controller throws error when razorpayService cannot fetch payment details
        expect(response.status()).toBe(400);
        expect(body).toHaveProperty('success', false);
    });
});

test.describe('Payments API - Webhook Security & Signature Validation', () => {
    test('POST /api/payments/webhook - should reject webhook request missing valid Razorpay signature with 400', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = JSON.stringify({
            entity: 'event',
            event: 'payment.captured',
        });
        const response = await paymentsHelper.handleWebhook(apiContext, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const durationMs = Date.now() - start;
        const body = await response.text().catch(() => '');

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/payments/webhook',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
        expect(body).toContain('Webhook Error');
    });
});
