/**
 * AI behavior - Context / short-term memory.
 *
 * Expected: information given earlier in the SAME session (e.g. the
 * caller's name) is still available to the agent later in that session.
 *
 * ASSUMPTION: turns are threaded via a client-generated conversationId
 * field on /api/ai-engine/query - see the header comment in
 * aiConversation.helper.js. If this test fails, first confirm whether
 * the real API actually supports multi-turn threading before treating it
 * as a memory defect.
 */

import { test, expect, attachApiEvidence } from '../api/fixtures/api.fixture.js';
import { ask, newConversationId } from './helpers/aiConversation.helper.js';
import { containsAny } from './helpers/aiAssertions.helper.js';
import { TEST_AGENT_ID, PROMPTS } from './data/ai.constants.js';

test.describe('AI Behavior - Context Retention', () => {
    test.skip(!TEST_AGENT_ID, 'TEST_AGENT_ID is not configured - set it in .env to run AI behavior tests. See test-engine/ai/AI_TEST_SCENARIOS.md.');

    test('agent remembers a name given earlier in the same session', async ({ authContext }, testInfo) => {
        const conversationId = newConversationId();

        const turn1Start = Date.now();
        const turn1 = await ask(authContext, {
            agentId: TEST_AGENT_ID,
            text: PROMPTS.CONTEXT_INTRODUCE_NAME,
            conversationId,
        });
        const turn1DurationMs = Date.now() - turn1Start;

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: turn1.response.status(),
            durationMs: turn1DurationMs,
            requestBody: { agentId: TEST_AGENT_ID, text: PROMPTS.CONTEXT_INTRODUCE_NAME, conversationId },
            responseBody: turn1.body,
        });

        expect(turn1.response.status(), 'First turn (introducing the name) should succeed').toBe(200);

        const turn2Start = Date.now();
        const turn2 = await ask(authContext, {
            agentId: TEST_AGENT_ID,
            text: PROMPTS.CONTEXT_RECALL_NAME,
            conversationId,
        });
        const turn2DurationMs = Date.now() - turn2Start;

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: turn2.response.status(),
            durationMs: turn2DurationMs,
            requestBody: { agentId: TEST_AGENT_ID, text: PROMPTS.CONTEXT_RECALL_NAME, conversationId },
            responseBody: turn2.body,
        });

        expect(turn2.response.status(), 'Second turn (recalling the name) should succeed').toBe(200);
        expect(
            containsAny(turn2.replyText, ['ashmit']),
            `Agent did not recall the name given earlier in the session. Reply: "${turn2.replyText}"`
        ).toBe(true);
    });
});
