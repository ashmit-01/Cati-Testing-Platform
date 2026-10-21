/**
 * Shared authentication helper.
 *
 * Both the WebSocket suite (test-engine/websocket) and the AI/Voice suite
 * (test-engine/ai) need an authenticated bearer token from the same
 * backend login endpoint the API suite already uses
 * (test-engine/api/fixtures/api.fixture.js). This module duplicates just
 * the token-fetch logic in a dependency-free form so those suites don't
 * have to import Playwright's `test` object from the api/ package (which
 * would couple unrelated suites together).
 *
 * Contains NO assertions. Callers decide how to react to failures.
 */

/**
 * Logs in with TEST_EMAIL / TEST_PASSWORD against BACKEND_URL and returns
 * the JWT from the response body.
 *
 * @param {import('@playwright/test').PlaywrightTestArgs['playwright']} playwright
 * @returns {Promise<string>} bearer token
 */
export async function obtainAuthToken(playwright) {
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
