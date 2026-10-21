/**
 * AI behavior - Context / short-term memory.
 *
 * Expected: information given earlier in the SAME session (e.g. the
 * caller's name) is still available to the agent later in that session.
 */

import { test, expect } from '../fixtures/agent.fixture.js';
import { ask, newConversationId } from './helpers/aiConversation.helper.js';
import { containsAny } from './helpers/aiAssertions.helper.js';
import { PROMPTS } from './data/ai.constants.js';
import { captureAiHttpEvidence } from '../shared/aiErrorCapture.js';

test.describe('AI Behavior - Context Retention', () => {
    test('agent remembers a name given earlier in the same session', async ({ authContext, testAgent }, testInfo) => {
        const agentId = testAgent.id;
        const conversationId = newConversationId();

        const turn1Start = Date.now();
        const turn1 = await ask(authContext, {
            agentId,
            text: PROMPTS.CONTEXT_INTRODUCE_NAME,
            conversationId,
        });
        const turn1DurationMs = Date.now() - turn1Start;

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: turn1.response.status(),
            durationMs: turn1DurationMs,
            requestPayload: { agentId, text: PROMPTS.CONTEXT_INTRODUCE_NAME, conversationId },
            responseBody: turn1.body,
            expected: false,
        });

        expect(turn1.response.status(), 'First turn (introducing the name) should succeed').toBe(200);

        const turn2Start = Date.now();
        const turn2 = await ask(authContext, {
            agentId,
            text: PROMPTS.CONTEXT_RECALL_NAME,
            conversationId,
        });
        const turn2DurationMs = Date.now() - turn2Start;

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: turn2.response.status(),
            durationMs: turn2DurationMs,
            requestPayload: { agentId, text: PROMPTS.CONTEXT_RECALL_NAME, conversationId },
            responseBody: turn2.body,
            expected: false,
        });

        expect(turn2.response.status(), 'Second turn (recalling the name) should succeed').toBe(200);
        expect(
            containsAny(turn2.replyText, ['ashmit']),
            `Agent did not recall the name given earlier in the session. Reply: "${turn2.replyText}"`
        ).toBe(true);
    });
});
