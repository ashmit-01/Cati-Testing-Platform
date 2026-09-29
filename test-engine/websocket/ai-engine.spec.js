/**
 * /api/ws/ai-engine - real-time bridge into the AI engine (LLM turn
 * exchange used mid-call).
 *
 * Covers: connection, authentication, message, response, disconnect,
 * reconnect. See connection.spec.js for the shared cross-socket matrix
 * (session creation, timeout, invalid messages) that also runs against
 * this endpoint.
 */

import { test, expect } from './fixtures/ws.fixture.js';
import {
    openSocket,
    sendJson,
    waitForMessage,
    closeSocket,
    attachWsEvidence,
} from './helpers/wsClient.helper.js';
import { WS_ENDPOINTS, TIMEOUTS, buildStartEvent, buildTextMessageEvent, newSessionId } from './data/ws.config.js';

const URL = WS_ENDPOINTS.AI_ENGINE;

test.describe('WS /api/ws/ai-engine', () => {
    test('connection - opens successfully with a valid token', async ({ wsAuthToken }, testInfo) => {
        const { ws, handshakeStatus } = await openSocket(URL, { token: wsAuthToken });
        await attachWsEvidence(testInfo, { endpoint: URL, step: 'connection', handshakeStatus });
        expect(ws.readyState).toBe(ws.OPEN);
        await closeSocket(ws);
    });

    test('authentication - an invalid/garbage token is not treated as valid', async ({}, testInfo) => {
        let outcome = 'opened';
        let error = null;
        let ws = null;
        try {
            const result = await openSocket(URL, { token: 'not-a-real-jwt.invalid.token' });
            ws = result.ws;
        } catch (err) {
            outcome = 'rejected';
            error = { message: err.message, handshakeStatus: err.handshakeStatus, closeCode: err.closeCode };
        }

        await attachWsEvidence(testInfo, { endpoint: URL, step: 'auth-invalid-token', outcome, error });

        if (outcome === 'opened') {
            // If the handshake itself doesn't reject bad tokens, a
            // subsequent start event must not be allowed to succeed.
            sendJson(ws, buildStartEvent());
            let sessionAccepted = false;
            try {
                const msg = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message });
                sessionAccepted = Boolean(msg.json?.sessionId || msg.json?.session_id) && !msg.json?.error;
            } catch {
                sessionAccepted = false;
            }
            await closeSocket(ws);
            expect(sessionAccepted, 'An invalid token must not be able to start a session').toBe(false);
        } else {
            expect(outcome).toBe('rejected');
        }
    });

    test('message / response - a text turn gets an AI-engine reply', async ({ wsAuthToken }, testInfo) => {
        const sessionId = newSessionId();
        const { ws } = await openSocket(URL, { token: wsAuthToken });
        sendJson(ws, buildStartEvent(sessionId));
        await waitForMessage(ws, { timeoutMs: TIMEOUTS.message }).catch(() => null);

        sendJson(ws, buildTextMessageEvent(sessionId, 'What are your operating hours?'));

        let response;
        let error = null;
        try {
            response = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message });
        } catch (err) {
            error = err.message;
        }

        await attachWsEvidence(testInfo, {
            endpoint: URL,
            step: 'message-response',
            sessionId,
            response: response?.json ?? response?.raw ?? null,
            error,
        });

        await closeSocket(ws);
        expect(error, `Expected an AI-engine reply, got error: ${error}`).toBeNull();
    });

    test('disconnect / reconnect - a clean close is followed by a working reconnect', async ({ wsAuthToken }, testInfo) => {
        const first = await openSocket(URL, { token: wsAuthToken });
        const closeResult = await closeSocket(first.ws);

        let reconnectError = null;
        let second;
        try {
            second = await openSocket(URL, { token: wsAuthToken });
        } catch (err) {
            reconnectError = err.message;
        }

        await attachWsEvidence(testInfo, { endpoint: URL, step: 'disconnect-reconnect', closeResult, reconnectError });

        expect(closeResult.code).toBe(1000);
        expect(reconnectError, `Reconnect failed: ${reconnectError}`).toBeNull();
        await closeSocket(second.ws);
    });
});
