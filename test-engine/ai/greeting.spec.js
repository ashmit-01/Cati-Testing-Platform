/**
 * AI behavior - Greeting.
 *
 * Expected: the agent greets the caller according to its configuration
 * when a session/conversation starts, before any real user input.
 *
 * Implements:
 * - Dynamic testAgent fixture support (Phase 12)
 * - Structured AI Engine Error Evidence capture (Phase 7, 9)
 * - Real observable behavior assertion (Phase 13)
 * - Negative boundary validation (Phase 8)
 */

import { test, expect } from '../fixtures/agent.fixture.js';
import * as aiEngineHelper from '../api/helpers/aiEngine.helper.js';
import { extractReplyText } from './helpers/aiConversation.helper.js';
import { TEST_GREETING_FRAGMENT } from './data/ai.constants.js';
import { captureAiHttpEvidence } from '../shared/aiErrorCapture.js';
import { VALID_FAKE_OBJ_ID } from '../api/data/constants.js';

test.describe('AI Behavior - Greeting', () => {
    test('agent greets the caller when a conversation starts', async ({ authContext, testAgent }, testInfo) => {
        const agentId = testAgent.id;
        const start = Date.now();
        const response = await aiEngineHelper.startConversation(authContext, { agentId });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));
        const reply = extractReplyText(body);

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/conversation',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            requestPayload: { agentId },
            responseBody: body,
            expected: false,
        });

        expect(response.status()).toBe(200);
        expect(reply.length, 'Expected a non-empty opening message from the agent').toBeGreaterThan(0);

        if (TEST_GREETING_FRAGMENT) {
            expect(
                reply.toLowerCase(),
                `Expected the greeting to include configured fragment "${TEST_GREETING_FRAGMENT}"`
            ).toContain(TEST_GREETING_FRAGMENT.toLowerCase());
        } else {
            const lower = reply.toLowerCase();
            const looksLikeGreeting = /hi|hello|hey|welcome|namaste|good morning|good afternoon|good evening|support|assist/i.test(lower);
            expect(looksLikeGreeting, `Reply did not contain observable greeting markers: "${reply}"`).toBe(true);
        }
    });

    test('conversation initiation with invalid agent returns 404 (observable negative behavior)', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await aiEngineHelper.startConversation(authContext, { agentId: VALID_FAKE_OBJ_ID });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/conversation',
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            requestPayload: { agentId: VALID_FAKE_OBJ_ID },
            responseBody: body,
            expected: true, // Expected negative test
        });

        expect(response.status()).toBe(404);
    });
});
