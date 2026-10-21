/**
 * AI conversation helper.
 *
 * AI/voice *behavioral* testing (greeting, intent, context, RAG,
 * language, guardrails) does not need to go over a live audio socket —
 * the same LLM turn-taking is reachable synchronously through the
 * existing REST endpoint (test-engine/api/helpers/aiEngine.helper.js ->
 * POST /api/ai-engine/query), which is faster and far less flaky than
 * driving VAD/STT/TTS just to check what the agent said.
 *
 * ASSUMPTION: multi-turn tests (context/memory) need the server to keep
 * short-term memory scoped to a conversation. This helper threads a
 * client-generated `conversationId` through every call on that
 * assumption. If the real /api/ai-engine/query contract uses a different
 * field name (e.g. `sessionId`) or doesn't support threading turns at
 * all yet, `ask()` is the one place to update — and the context.spec.js
 * failure itself is a legitimate finding to report either way.
 *
 * Contains NO assertions. Spec files decide pass/fail.
 */

import { randomUUID } from 'crypto';
import * as aiEngineHelper from '../../api/helpers/aiEngine.helper.js';

export function newConversationId() {
    return randomUUID();
}

/**
 * Sends one turn to the agent and returns both the raw response and a
 * best-effort extracted reply string.
 *
 * @param {import('@playwright/test').APIRequestContext} context - authenticated context
 * @param {object} params
 * @param {string} params.agentId
 * @param {string} params.text
 * @param {string} [params.conversationId] - threads multi-turn context, see ASSUMPTION above
 */
export async function ask(context, { agentId, text, conversationId }) {
    const payload = { agentId, text };
    if (conversationId) {
        payload.conversationId = conversationId;
    }

    const response = await aiEngineHelper.query(context, payload);
    const body = await response.json().catch(() => ({}));

    return { response, body, replyText: extractReplyText(body) };
}

/**
 * Response shape isn't confirmed for this black-box target, so this
 * checks the handful of field names an agent-reply endpoint like this
 * commonly uses and returns the first string it finds.
 */
export function extractReplyText(body) {
    const candidates = [
        body?.data?.reply,
        body?.data?.text,
        body?.data?.answer,
        body?.data?.message,
        body?.data?.response,
        body?.reply,
        body?.text,
        body?.answer,
        body?.message,
        body?.response,
    ];
    const found = candidates.find((c) => typeof c === 'string' && c.length > 0);
    return found || '';
}
