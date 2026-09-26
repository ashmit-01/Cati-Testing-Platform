import { test as base, expect as baseExpect } from '@playwright/test';

/**
 * Cache auth token per worker process to prevent triggering login rate limits
 * during parallel test suite runs.
 */
let cachedWorkerToken = null;

/**
 * Sanitize object to prevent secrets, tokens, and passwords from leaking into reports
 */
export function sanitizeEvidence(data) {
    if (!data) return data;
    if (typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(sanitizeEvidence);

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (/password|token|secret|authorization|cookie|apikey/i.test(key)) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeEvidence(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

/**
 * Safely attach API request/response metadata to the Playwright HTML report
 */
export async function attachApiEvidence(testInfo, {
    method,
    endpoint,
    expectedStatus,
    actualStatus,
    durationMs,
    requestBody,
    responseBody
}) {
    if (!testInfo) return;
    try {
        await testInfo.attach('API Call Evidence', {
            contentType: 'application/json',
            body: JSON.stringify({
                method,
                endpoint,
                expectedStatus,
                actualStatus,
                durationMs: durationMs !== undefined ? `${durationMs}ms` : undefined,
                request: sanitizeEvidence(requestBody),
                response: sanitizeEvidence(responseBody),
            }, null, 2),
        });
    } catch {
        // Safe fallback if attachment fails
    }
}

async function obtainToken(playwright) {
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;

    if (!email || !password) {
        throw new Error(
            'Missing TEST_EMAIL or TEST_PASSWORD in environment. Please configure .env before running authenticated tests.'
        );
    }

    const baseURL = process.env.BACKEND_URL || 'http://localhost:5000';
    const loginContext = await playwright.request.newContext({ baseURL });

    try {
        const response = await loginContext.post('/api/auth/login', {
            data: { email, password },
            headers: { 'Content-Type': 'application/json' },
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
    authToken: async ({ playwright }, use) => {
        if (!cachedWorkerToken) {
            cachedWorkerToken = await obtainToken(playwright);
        }
        await use(cachedWorkerToken);
    },

    // Dedicated fresh token for tests that invalidate or blacklist tokens (e.g. logout)
    freshAuthToken: async ({ playwright }, use) => {
        const token = await obtainToken(playwright);
        await use(token);
    },

    // Authenticated context using the Bearer token
    authContext: async ({ playwright, authToken }, use) => {
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
