/**
 * AI behavior - RAG (retrieval-augmented generation) grounding.
 *
 * Tests observable outcome: a question that maps to configured knowledge-base
 * content should produce a reply grounded in that content or a graceful
 * domain answer, not a generic hallucinated error or 500 crash.
 */

import { test, expect } from '../fixtures/agent.fixture.js';
import { ask } from './helpers/aiConversation.helper.js';
import { containsAny } from './helpers/aiAssertions.helper.js';
import { TEST_KB_KEYWORD, PROMPTS } from './data/ai.constants.js';
import { captureAiHttpEvidence } from '../shared/aiErrorCapture.js';

test.describe('AI Behavior - RAG Grounding', () => {
    test('reply to a knowledge-base question is grounded in configured content', async ({ authContext, testAgent }, testInfo) => {
        const agentId = testAgent.id;
        const start = Date.now();
        const { response, body, replyText } = await ask(authContext, {
            agentId,
            text: PROMPTS.RAG_SERVICES_QUESTION,
        });
        const durationMs = Date.now() - start;

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            requestPayload: { agentId, text: PROMPTS.RAG_SERVICES_QUESTION },
            responseBody: body,
            expected: false,
        });

        expect(response.status()).toBe(200);
        expect(replyText.length, 'Expected non-empty response for RAG query').toBeGreaterThan(0);

        if (TEST_KB_KEYWORD) {
            expect(
                containsAny(replyText, [TEST_KB_KEYWORD]),
                `Reply did not mention the configured knowledge-base keyword "${TEST_KB_KEYWORD}". Reply: "${replyText}"`
            ).toBe(true);
        } else {
            testInfo.annotations.push({
                type: 'note',
                description: 'TEST_KB_KEYWORD not configured. Verified successful response generation without crash.',
            });
        }
    });
});
