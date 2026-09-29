/**
 * AI behavior - Multilingual interaction.
 *
 * CATI supports multilingual voice interaction, so a question phrased in
 * different languages/registers should each get a coherent, non-empty
 * reply. This is a coverage/smoke check (does the pipeline handle the
 * input and respond at all, and in roughly the expected script) - it is
 * NOT a linguistic-quality gate. Fluency/accuracy review of non-English
 * replies should be done by a native speaker on the QA team using the
 * attached evidence, not by this heuristic alone.
 */

import { test, expect, attachApiEvidence } from '../api/fixtures/api.fixture.js';
import { ask } from './helpers/aiConversation.helper.js';
import { detectScript } from './helpers/aiAssertions.helper.js';
import { TEST_AGENT_ID, PROMPTS } from './data/ai.constants.js';

test.describe('AI Behavior - Language Handling', () => {
    test.skip(!TEST_AGENT_ID, 'TEST_AGENT_ID is not configured - set it in .env to run AI behavior tests. See test-engine/ai/AI_TEST_SCENARIOS.md.');

    const cases = [
        { label: 'English', text: PROMPTS.LANGUAGE.english, expectedScript: 'latin' },
        { label: 'Hindi (Devanagari)', text: PROMPTS.LANGUAGE.hindi, expectedScript: 'devanagari' },
        { label: 'Hinglish (Latin-script Hindi)', text: PROMPTS.LANGUAGE.hinglish, expectedScript: 'latin' },
    ];

    for (const { label, text, expectedScript } of cases) {
        test(`agent responds coherently to a ${label} query`, async ({ authContext }, testInfo) => {
            const start = Date.now();
            const { response, body, replyText } = await ask(authContext, { agentId: TEST_AGENT_ID, text });
            const durationMs = Date.now() - start;
            const observedScript = detectScript(replyText);

            await attachApiEvidence(testInfo, {
                method: 'POST',
                endpoint: '/api/ai-engine/query',
                expectedStatus: 200,
                actualStatus: response.status(),
                durationMs,
                requestBody: { agentId: TEST_AGENT_ID, text },
                responseBody: body,
            });
            testInfo.annotations.push({ type: 'note', description: `Detected reply script: ${observedScript} (expected roughly: ${expectedScript})` });

            expect(response.status()).toBe(200);
            expect(replyText.length, `Expected a non-empty reply to the ${label} query`).toBeGreaterThan(0);
            // Script match is logged as an annotation above rather than a
            // hard assertion: an agent configured to always reply in
            // English regardless of input language is a valid product
            // choice, not automatically a bug. Flip this to a hard
            // `expect(observedScript).toBe(expectedScript)` once the
            // team confirms the agent under test is expected to
            // code-switch its reply language.
        });
    }

    // Regional-language coverage: extend PROMPTS.LANGUAGE in
    // test-engine/ai/data/ai.constants.js with additional entries (e.g.
    // Marathi, Tamil, Bengali, Telugu) and add a matching case above once
    // the target agent is configured to support them. Left as a single
    // documented example here rather than guessing at scripts CATI's
    // configured agents may not actually support yet.
    test('agent handles a regional-language query without erroring (example: Marathi)', async ({ authContext }, testInfo) => {
        const text = 'तुम्ही कोणत्या सेवा पुरवता?'; // "What services do you provide?" (Marathi)
        const start = Date.now();
        const { response, body, replyText } = await ask(authContext, { agentId: TEST_AGENT_ID, text });
        const durationMs = Date.now() - start;

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            requestBody: { agentId: TEST_AGENT_ID, text },
            responseBody: body,
        });

        // Deliberately lenient: the goal is "the pipeline doesn't error
        // out or return nothing", not "the agent must support Marathi".
        expect(response.status(), 'Regional-language input should not cause a server error').toBeLessThan(500);
        if (response.status() === 200) {
            expect(replyText.length, 'A 200 response should still carry some reply text').toBeGreaterThan(0);
        }
    });
});
