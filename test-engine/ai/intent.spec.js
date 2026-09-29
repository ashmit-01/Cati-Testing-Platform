/**
 * AI behavior - Intent recognition.
 *
 * Expected: when the caller expresses an appointment-booking intent, the
 * agent's reply demonstrates it understood that intent (asks for a date,
 * confirms it can help book one, asks which service, etc.) rather than
 * giving an unrelated or generic fallback answer.
 */

import { test, expect, attachApiEvidence } from '../api/fixtures/api.fixture.js';
import { ask } from './helpers/aiConversation.helper.js';
import { containsAny } from './helpers/aiAssertions.helper.js';
import { TEST_AGENT_ID, PROMPTS } from './data/ai.constants.js';

const APPOINTMENT_INTENT_SIGNALS = [
    'appointment',
    'book',
    'booking',
    'schedule',
    'date',
    'time',
    'slot',
    'available',
    'reservation',
    'reserve',
];

test.describe('AI Behavior - Intent Recognition', () => {
    test.skip(!TEST_AGENT_ID, 'TEST_AGENT_ID is not configured - set it in .env to run AI behavior tests. See test-engine/ai/AI_TEST_SCENARIOS.md.');

    test('agent recognizes an appointment-booking intent', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const { response, body, replyText } = await ask(authContext, {
            agentId: TEST_AGENT_ID,
            text: PROMPTS.INTENT_BOOK_APPOINTMENT,
        });
        const durationMs = Date.now() - start;

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            requestBody: { agentId: TEST_AGENT_ID, text: PROMPTS.INTENT_BOOK_APPOINTMENT },
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(replyText.length).toBeGreaterThan(0);
        expect(
            containsAny(replyText, APPOINTMENT_INTENT_SIGNALS),
            `Reply did not show signs of recognizing an appointment-booking intent: "${replyText}"`
        ).toBe(true);
    });
});
