/**
 * AI behavior - Intent recognition.
 *
 * Expected: when the caller expresses an appointment-booking intent, the
 * agent's reply demonstrates it understood that intent (asks for a date,
 * confirms it can help book one, asks which service, etc.) rather than
 * giving an unrelated or generic fallback answer.
 */

import { test, expect } from '../fixtures/agent.fixture.js';
import { ask } from './helpers/aiConversation.helper.js';
import { containsAny } from './helpers/aiAssertions.helper.js';
import { PROMPTS } from './data/ai.constants.js';
import { captureAiHttpEvidence } from '../shared/aiErrorCapture.js';

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
    'help',
    'confirm',
];

test.describe('AI Behavior - Intent Recognition', () => {
    test('agent recognizes an appointment-booking intent', async ({ authContext, testAgent }, testInfo) => {
        const agentId = testAgent.id;
        const start = Date.now();
        const { response, body, replyText } = await ask(authContext, {
            agentId,
            text: PROMPTS.INTENT_BOOK_APPOINTMENT,
        });
        const durationMs = Date.now() - start;

        await captureAiHttpEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/ai-engine/query',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            requestPayload: { agentId, text: PROMPTS.INTENT_BOOK_APPOINTMENT },
            responseBody: body,
            expected: false,
        });

        expect(response.status()).toBe(200);
        expect(replyText.length).toBeGreaterThan(0);
        expect(
            containsAny(replyText, APPOINTMENT_INTENT_SIGNALS),
            `Reply did not show signs of recognizing an appointment-booking intent: "${replyText}"`
        ).toBe(true);
    });
});
