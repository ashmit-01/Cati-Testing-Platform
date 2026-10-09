/**
 * AI behavior - Multilingual interaction.
 *
 * CATI supports multilingual voice interaction, so a question phrased in
 * different languages/registers should each get a coherent, non-empty
 * reply.
 */

import { test, expect } from '../fixtures/agent.fixture.js';
import { ask } from './helpers/aiConversation.helper.js';
import { detectScript } from './helpers/aiAssertions.helper.js';
import { PROMPTS } from './data/ai.constants.js';
import { captureAiHttpEvidence } from '../shared/aiErrorCapture.js';

test.describe('AI Behavior - Language Handling', () => {
    const cases = [
        { label: 'English', text: PROMPTS.LANGUAGE.english, expectedScript: 'latin' },
        { label: 'Hindi (Devanagari)', text: PROMPTS.LANGUAGE.hindi, expectedScript: 'devanagari' },
        { label: 'Hinglish (Latin-script Hindi)', text: PROMPTS.LANGUAGE.hinglish, expectedScript: 'latin' },
    ];

    for (const { label, text, expectedScript } of cases) {
        test(`agent responds coherently to a ${label} query`, async ({ authContext, testAgent }, testInfo) => {
            const agentId = testAgent.id;
            const start = Date.now();
            const { response, body, replyText } = await ask(authContext, { agentId, text });
            const durationMs = Date.now() - start;
            const observedScript = detectScript(replyText);

            await captureAiHttpEvidence(testInfo, {
                method: 'POST',
                endpoint: '/api/ai-engine/query',
                expectedStatus: 200,
                actualStatus: response.status(),
                durationMs,
                requestPayload: { agentId, text },
                responseBody: body,
                expected: false,
            });

            testInfo.annotations.push({
                type: 'note',
                description: `Detected reply script: ${observedScript} (expected roughly: ${expectedScript})`,
            });

            expect(response.status()).toBe(200);
            expect(replyText.length, `Expected a non-empty reply to the ${label} query`).toBeGreaterThan(0);
        });
    }

    test('agent handles a regional-language query without erroring (example: Marathi)', async ({ authContext, testAgent }, testInfo) => {
        const agentId = testAgent.id;
        const text = 'तुम्ही कोणत्या सेवा पुरवता?'; // "What services do you provide?" (Marathi)
        const start = Date.now();
        const { response, body, replyText } = await ask(authContext, { agentId, text });
        const durationMs = Date.now() - start;

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            requestPayload: { agentId, text },
            responseBody: body,
            expected: false,
        });

        expect(response.status()).toBe(200);
        expect(replyText.length).toBeGreaterThan(0);
    });
});
