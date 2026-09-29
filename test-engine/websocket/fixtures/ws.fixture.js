import { test as base, expect as baseExpect } from '@playwright/test';
import { obtainAuthToken } from '../../shared/authToken.helper.js';

/**
 * Cache the auth token per worker process, same rationale as
 * test-engine/api/fixtures/api.fixture.js: avoid hammering the login
 * endpoint (and any rate limiting on it) when many WS tests run in
 * parallel.
 */
let cachedWorkerToken = null;

export const test = base.extend({
    // Bearer token used to authenticate WebSocket handshakes.
    wsAuthToken: async ({ playwright }, use) => {
        if (!cachedWorkerToken) {
            cachedWorkerToken = await obtainAuthToken(playwright);
        }
        await use(cachedWorkerToken);
    },
});

export const expect = baseExpect;
