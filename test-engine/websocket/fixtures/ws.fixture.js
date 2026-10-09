import { test as base, expect as baseExpect } from '@playwright/test';
import { obtainAuthToken } from '../../shared/authToken.helper.js';

/**
 * Cache the auth token per worker process to avoid hammering the login
 * endpoint when tests run concurrently.
 */
let cachedWorkerToken = null;

export const test = base.extend({
    // Bearer token used to authenticate WebSocket handshakes.
    wsAuthToken: async ({ playwright }, use, testInfo) => {
        const email = process.env.TEST_EMAIL;
        const password = process.env.TEST_PASSWORD;

        if (!email || !password) {
            testInfo.skip(
                true,
                'Missing TEST_EMAIL or TEST_PASSWORD in environment. Please configure .env before running authenticated WebSocket tests.'
            );
            return;
        }

        if (!cachedWorkerToken) {
            try {
                cachedWorkerToken = await obtainAuthToken(playwright);
            } catch (err) {
                testInfo.skip(
                    true,
                    `WebSocket authentication setup failed: ${err.message}. Ensure backend is running.`
                );
                return;
            }
        }

        await use(cachedWorkerToken);
    },
});

export const expect = baseExpect;
