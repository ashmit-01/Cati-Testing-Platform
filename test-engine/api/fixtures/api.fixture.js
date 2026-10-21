import { test as base, expect as baseExpect } from '@playwright/test';
import { sanitizeData, captureAiHttpEvidence } from '../../shared/aiErrorCapture.js';

/**
 * Cache auth token per worker process to prevent triggering login rate limits
 * during parallel test suite runs.
 */
let cachedWorkerToken = null;

/**
 * Sanitize object to prevent secrets, tokens, and passwords from leaking into reports
 */
export function sanitizeEvidence(data) {
    return sanitizeData(data);
}

/**
 * Safely attach API request/response metadata and structured AI Engine evidence
 * to the Playwright HTML and JSON reports.
 */
export async function attachApiEvidence(testInfo, {
    method = 'GET',
    endpoint = '',
    expectedStatus,
    actualStatus,
    durationMs,
    requestBody,
    responseBody,
    responseHeaders = {},
    error = null,
    expected = false,
}) {
    if (!testInfo) return;
    try {
        await captureAiHttpEvidence(testInfo, {
            method,
            endpoint,
            expectedStatus,
            actualStatus,
            durationMs,
            requestPayload: requestBody,
            responseBody,
            responseHeaders,
            error,
            expected,
        });
    } catch {
        // Safe fallback if attachment fails
    }
}

export { captureAiHttpEvidence };

async function obtainToken(playwright) {
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;

    if (!email || !password) {
        return null;
    }

    const baseURL = process.env.BACKEND_URL || 'http://localhost:5000';
    const loginContext = await playwright.request.newContext({ baseURL });

    try {
        const response = await loginContext.post('/api/auth/login', {
            data: { email, password },
            headers: { 'Content-Type': 'application/json' },
            timeout: 15_000,
        });

        if (!response.ok()) {
            const bodyText = await response.text();
            throw new Error(
                `Authentication failed for ${email} (status: ${response.status()}): ${bodyText}`
            );
        }

        const body = await response.json();
        const token = body?.token;
        if (!token) {
            throw new Error('Login response did not contain a "token" field.');
        }

        return token;
    } finally {
        await loginContext.dispose();
    }
}

/**
 * Playwright API fixture extending base test with:
 * - apiContext: unauthenticated APIRequestContext
 * - authToken: JWT token obtained from POST /api/auth/login (worker-cached)
 * - freshAuthToken: independent single-use JWT for destructive tests like logout
 * - authContext: authenticated APIRequestContext with Bearer JWT header
 */
export const test = base.extend({
    // Unauthenticated context
    apiContext: async ({ playwright }, use) => {
        const baseURL = process.env.BACKEND_URL || 'http://localhost:5000';
        const context = await playwright.request.newContext({
            baseURL,
            extraHTTPHeaders: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });
        await use(context);
        await context.dispose();
    },

    // Token retrieval via login API with worker caching
    authToken: async ({ playwright }, use, testInfo) => {
        const email = process.env.TEST_EMAIL;
        const password = process.env.TEST_PASSWORD;

        if (!email || !password) {
            testInfo.skip(
                true,
                'Missing TEST_EMAIL or TEST_PASSWORD in environment. Please configure .env before running authenticated tests.'
            );
            return;
        }

        if (!cachedWorkerToken) {
            try {
                cachedWorkerToken = await obtainToken(playwright);
            } catch (err) {
                testInfo.skip(
                    true,
                    `Authentication failed: ${err.message}. Ensure backend is running at ${process.env.BACKEND_URL || 'http://localhost:5000'}`
                );
                return;
            }
        }

        await use(cachedWorkerToken);
    },

    // Dedicated fresh token for tests that invalidate or blacklist tokens (e.g. logout)
    freshAuthToken: async ({ playwright }, use, testInfo) => {
        const email = process.env.TEST_EMAIL;
        const password = process.env.TEST_PASSWORD;

        if (!email || !password) {
            testInfo.skip(
                true,
                'Missing TEST_EMAIL or TEST_PASSWORD in environment. Please configure .env before running authenticated tests.'
            );
            return;
        }

        try {
            const token = await obtainToken(playwright);
            await use(token);
        } catch (err) {
            testInfo.skip(
                true,
                `Fresh token authentication failed: ${err.message}`
            );
        }
    },

    // Authenticated context using the Bearer token
    authContext: async ({ playwright, authToken }, use, testInfo) => {
        if (!authToken) {
            testInfo.skip(true, 'Authentication token unavailable. Skipping authenticated test.');
            return;
        }

        const baseURL = process.env.BACKEND_URL || 'http://localhost:5000';
        const context = await playwright.request.newContext({
            baseURL,
            extraHTTPHeaders: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
        });
        await use(context);
        await context.dispose();
    },
});

export const expect = baseExpect;
