import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as authHelper from '../helpers/auth.helper.js';

test.describe('Auth API - Registration & Signup Flow', () => {
    test('POST /api/auth/signup - should reject signup with missing email', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { password: 'ValidPassword123!', name: 'Test User' };
        const response = await authHelper.signup(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/signup - should reject signup with missing password', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { email: 'valid.user@example.com', name: 'Test User' };
        const response = await authHelper.signup(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/signup - should reject signup with missing name', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { email: 'valid.user@example.com', password: 'ValidPassword123!' };
        const response = await authHelper.signup(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/signup - should reject invalid email format', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { email: 'not-an-email', password: 'ValidPassword123!', name: 'Test User' };
        const response = await authHelper.signup(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/signup - should reject weak password lacking uppercase or numbers', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { email: 'weak.password@example.com', password: 'alllowercase', name: 'Test User' };
        const response = await authHelper.signup(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/signup - should reject name when formatted as email address', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { email: 'name.check@example.com', password: 'ValidPassword123!', name: 'emailasname@example.com' };
        const response = await authHelper.signup(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/signup - should reject empty request body with 400', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = {};
        const response = await authHelper.signup(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/signup - should reject duplicate registration for existing verified email with 409', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = {
            email: process.env.TEST_EMAIL || 'test@example.com',
            password: 'ValidPassword123!',
            name: 'Duplicate Test User',
        };
        const response = await authHelper.signup(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup',
            expectedStatus: 409,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        // Controller returns 409 "User already exists with this email" when email is verified
        expect(response.status()).toBe(409);
    });

    test('POST /api/auth/signup/verify-otp - should reject verification with missing OTP', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { email: 'test@example.com' };
        const response = await authHelper.verifySignupOtp(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup/verify-otp',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/signup/verify-otp - should return 404 for non-existent user email', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { email: 'nonexistent-user-12345@example.com', otp: '123456' };
        const response = await authHelper.verifySignupOtp(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup/verify-otp',
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('POST /api/auth/signup/resend-otp - should reject resend without email', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = {};
        const response = await authHelper.resendSignupOtp(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/signup/resend-otp',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });
});

test.describe('Auth API - Login & Google Flow', () => {
    test('POST /api/auth/login - should reject missing credentials', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = {};
        const response = await authHelper.login(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/login',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/login - should reject malformed email request with 400', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = {
            email: 'not-a-valid-email',
            password: 'SomePassword123!',
        };
        const response = await authHelper.login(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/login',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/login - should reject incorrect password', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = {
            email: process.env.TEST_EMAIL || 'test@example.com',
            password: 'WrongPassword999!',
        };
        const response = await authHelper.login(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/login',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('POST /api/auth/login - should reject unknown email with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = {
            email: 'completely-unknown-user-99999@example.com',
            password: 'Password123!',
        };
        const response = await authHelper.login(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/login',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('POST /api/auth/login - should authenticate successfully with valid credentials and return JWT token', async ({ apiContext }, testInfo) => {
        test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'Skipped: TEST_EMAIL and TEST_PASSWORD not configured');

        const start = Date.now();
        const payload = {
            email: process.env.TEST_EMAIL,
            password: process.env.TEST_PASSWORD,
        };
        const response = await authHelper.login(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/login',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('token');
        expect(typeof body.token).toBe('string');
        expect(body.token.length).toBeGreaterThan(20);
        expect(body).toHaveProperty('user');
        expect(body.user).toHaveProperty('id');
        expect(body.user).toHaveProperty('email');
    });

    test('POST /api/auth/google - should reject missing credential payload with 400', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.googleLogin(apiContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/google',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });
});

test.describe('Auth API - Password Reset Lifecycle', () => {
    test('POST /api/auth/forgot-password - should reject missing or invalid email with 400', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.forgotPassword(apiContext, { email: 'invalid-email' });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/forgot-password',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/forgot-password - should safely respond 200 for email inquiry', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.forgotPassword(apiContext, { email: 'user.inquiry@example.com' });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/forgot-password',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        // Controller returns 200 "If an account exists, an OTP has been sent"
        expect(response.status()).toBe(200);
    });

    test('POST /api/auth/forgot-password/verify-otp - should reject missing parameters with 400', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.verifyForgotPasswordOtp(apiContext, { email: 'user@example.com' });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/forgot-password/verify-otp',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/forgot-password/resend-otp - should reject missing email with 400', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.resendForgotPasswordOtp(apiContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/forgot-password/resend-otp',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/reset-password - should reject missing parameters with 400', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.resetPassword(apiContext, { email: 'user@example.com' });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/reset-password',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });
});

test.describe('Auth API - Current User (/api/auth/me) & Authorization', () => {
    test('GET /api/auth/me - should reject request without token with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.getMe(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/auth/me',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/auth/me - should reject invalid Bearer token with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.getMe(apiContext, {
            headers: { Authorization: 'Bearer invalid.jwt.token' },
        });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/auth/me',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/auth/me - should return user profile when authenticated', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.getMe(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/auth/me',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('user');
        expect(body.user).toHaveProperty('id');
        expect(body.user).toHaveProperty('email');
    });
});

test.describe('Auth API - Refresh Token & Logout Lifecycle', () => {
    test('POST /api/auth/refresh - should reject request without refresh token', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.refreshToken(apiContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/refresh',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/auth/refresh - should reject malformed refresh token with 400 or 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await authHelper.refreshToken(apiContext, { refreshToken: 'invalid-refresh-token' });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/auth/refresh',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect([400, 401]).toContain(response.status());
    });

    test('POST /api/auth/logout - should successfully logout and invalidate token', async ({ playwright, freshAuthToken }, testInfo) => {
        const baseURL = process.env.BACKEND_URL || 'http://localhost:5000';
        // Create an isolated context using this test's unique freshAuthToken
        const isolatedContext = await playwright.request.newContext({
            baseURL,
            extraHTTPHeaders: {
                Authorization: `Bearer ${freshAuthToken}`,
            },
        });

        try {
            // Verify token works first
            const beforeLogout = await authHelper.getMe(isolatedContext);
            expect(beforeLogout.status()).toBe(200);

            // Execute logout
            const start = Date.now();
            const logoutResp = await authHelper.logout(isolatedContext);
            const durationMs = Date.now() - start;
            const logoutBody = await logoutResp.json().catch(() => ({}));

            await attachApiEvidence(testInfo, {
                method: 'POST',
                endpoint: '/api/auth/logout',
                expectedStatus: 200,
                actualStatus: logoutResp.status(),
                durationMs,
                responseBody: logoutBody,
            });

            expect(logoutResp.status()).toBe(200);

            // Attempt to reuse blacklisted token
            const afterLogout = await authHelper.getMe(isolatedContext);
            expect(afterLogout.status()).toBe(401);
        } finally {
            await isolatedContext.dispose();
        }
    });
});
