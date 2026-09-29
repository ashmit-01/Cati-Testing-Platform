/**
 * AI behavior - RAG (retrieval-augmented generation) grounding.
 *
 * CATI retrieves per-agent knowledge with FAISS + MiniLM embeddings and
 * feeds the matched chunks to the LLM. This test does not re-test FAISS
 * or MiniLM directly (that's a component/unit-level concern for the AI
 * engine repo) - it checks the OBSERVABLE outcome: a question that maps
 * to configured knowledge-base content should produce a reply grounded
 * in that content, not a generic or hallucinated answer.
 *
 * Requires TEST_KB_KEYWORD to be set to something that actually appears
 * in TEST_AGENT_ID's knowledge base (e.g. a configured service name), so
 * the test can check the reply mentions it.
 */

import { test, expect, attachApiEvidence } from '../api/fixtures/api.fixture.js';
import { ask } from './helpers/aiConversation.helper.js';
import { containsAny } from './helpers/aiAssertions.helper.js';
import { TEST_AGENT_ID, TEST_KB_KEYWORD, PROMPTS } from './data/ai.constants.js';

test.describe('AI Behavior - RAG Grounding', () => {
    test.skip(!TEST_AGENT_ID, 'TEST_AGENT_ID is not configured - set it in .env to run AI behavior tests. See test-engine/ai/AI_TEST_SCENARIOS.md.');
    test.skip(
        !TEST_KB_KEYWORD,
        'TEST_KB_KEYWORD is not configured - set it to a phrase known to exist in the agent\'s knowledge base. See test-engine/ai/AI_TEST_SCENARIOS.md.'
    );

    test('reply to a knowledge-base question is grounded in configured content', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const { response, body, replyText } = await ask(authContext, {
            agentId: TEST_AGENT_ID,
            text: PROMPTS.RAG_SERVICES_QUESTION,
        });
        const durationMs = Date.now() - start;

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            requestBody: { agentId: TEST_AGENT_ID, text: PROMPTS.RAG_SERVICES_QUESTION },
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(
            containsAny(replyText, [TEST_KB_KEYWORD]),
            `Reply did not mention the configured knowledge-base keyword "${TEST_KB_KEYWORD}". This can mean retrieval missed the relevant chunk, or the LLM answered generically instead of using it. Reply: "${replyText}"`
        ).toBe(true);
    });
});
