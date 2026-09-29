/**
 * AI behavior - Greeting.
 *
 * Expected: the agent greets the caller according to its configuration
 * when a session/conversation starts, before any real user input.
 *
 * This drives the same REST entry point a call session start would use
 * (POST /api/ai-engine/conversation) rather than a full voice round-trip,
 * since the thing under test is "what does the agent say first", not the
 * audio pipeline itself (that's covered in test-engine/websocket/).
 */

import { test, expect, attachApiEvidence } from '../api/fixtures/api.fixture.js';
import * as aiEngineHelper from '../api/helpers/aiEngine.helper.js';
import { extractReplyText } from './helpers/aiConversation.helper.js';
import { TEST_AGENT_ID, TEST_GREETING_FRAGMENT } from './data/ai.constants.js';

test.describe('AI Behavior - Greeting', () => {
    test.skip(!TEST_AGENT_ID, 'TEST_AGENT_ID is not configured - set it in .env to run AI behavior tests. See test-engine/ai/AI_TEST_SCENARIOS.md.');

    test('agent greets the caller when a conversation starts', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await aiEngineHelper.startConversation(authContext, { agentId: TEST_AGENT_ID });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));
        const reply = extractReplyText(body);

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/conversation',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            requestBody: { agentId: TEST_AGENT_ID },
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(reply.length, 'Expected a non-empty opening message from the agent').toBeGreaterThan(0);

        if (TEST_GREETING_FRAGMENT) {
            expect(
                reply.toLowerCase(),
                `Expected the greeting to include the configured fragment "${TEST_GREETING_FRAGMENT}"`
            ).toContain(TEST_GREETING_FRAGMENT.toLowerCase());
        } else {
            // No exact greeting configured to check against - fall back
            // to a loose "this reads like a greeting" heuristic so the
            // test still catches an obviously broken/empty opening line.
            const lower = reply.toLowerCase();
            const looksLikeGreeting = /hi|hello|hey|welcome|namaste|good morning|good afternoon|good evening/i.test(lower);
            testInfo.annotations.push({
                type: 'note',
                description: 'TEST_GREETING_FRAGMENT not set - using a loose greeting-word heuristic instead of an exact configured match.',
            });
            expect(looksLikeGreeting, `Reply did not look like a greeting: "${reply}"`).toBe(true);
        }
    });
});
