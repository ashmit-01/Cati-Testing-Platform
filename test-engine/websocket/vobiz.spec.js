/**
 * /ws/vobiz - telephony-bridge socket.
 *
 * Happy path mirrors the flow documented for this endpoint:
 *   Connect -> Send start event -> Send audio/message -> Receive response -> Close
 *
 * Negative flows: invalid session ID, missing parameters, malformed
 * message, unexpected disconnect.
 */

import { test, expect } from './fixtures/ws.fixture.js';
import {
    openSocket,
    sendJson,
    waitForMessage,
    closeSocket,
    killSocket,
    attachWsEvidence,
} from './helpers/wsClient.helper.js';
import {
    WS_ENDPOINTS,
    WS_PROTOCOL,
    TIMEOUTS,
    buildStartEvent,
    buildTextMessageEvent,
    buildAudioChunkEvent,
    newSessionId,
    INVALID_SESSION_ID,
} from './data/ws.config.js';

const URL = WS_ENDPOINTS.VOBIZ;

test.describe('WS /ws/vobiz - happy path', () => {
    test('connect -> start -> message -> response -> close', async ({ wsAuthToken }, testInfo) => {
        const sessionId = newSessionId();
        const evidence = { endpoint: URL, sessionId, steps: [] };

        const { ws } = await openSocket(URL, { token: wsAuthToken });
        evidence.steps.push({ step: 'connect', ok: true });

        sendJson(ws, buildStartEvent(sessionId));
        const startAck = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message }).catch((err) => ({ error: err.message }));
        evidence.steps.push({ step: 'start', response: startAck?.json ?? startAck?.raw ?? startAck?.error });

        sendJson(ws, buildTextMessageEvent(sessionId, 'Hello, I would like to check my appointment.'));
        let response;
        let responseError = null;
        try {
            response = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message });
        } catch (err) {
            responseError = err.message;
        }
        evidence.steps.push({ step: 'message', response: response?.json ?? response?.raw ?? null, error: responseError });

        const closeResult = await closeSocket(ws);
        evidence.steps.push({ step: 'close', ...closeResult });

        await attachWsEvidence(testInfo, evidence);

        expect(responseError, `Expected a response after sending a message: ${responseError}`).toBeNull();
        expect(response).toBeTruthy();
    });

    test('connect -> start -> audio chunk -> response -> close', async ({ wsAuthToken }, testInfo) => {
        const sessionId = newSessionId();
        const evidence = { endpoint: URL, sessionId, steps: [] };

        const { ws } = await openSocket(URL, { token: wsAuthToken });
        sendJson(ws, buildStartEvent(sessionId));
        await waitForMessage(ws, { timeoutMs: TIMEOUTS.message }).catch(() => null);

        sendJson(ws, buildAudioChunkEvent(sessionId));
        let response;
        let responseError = null;
        try {
            response = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message });
        } catch (err) {
            responseError = err.message;
        }
        evidence.steps.push({ step: 'audio-chunk', response: response?.json ?? response?.raw ?? null, error: responseError });

        await closeSocket(ws);
        await attachWsEvidence(testInfo, evidence);

        expect(responseError, `Expected a response after sending an audio chunk: ${responseError}`).toBeNull();
    });
});

test.describe('WS /ws/vobiz - negative flows', () => {
    test('invalid session ID is rejected, not silently accepted', async ({ wsAuthToken }, testInfo) => {
        const { ws } = await openSocket(URL, { token: wsAuthToken });
        sendJson(ws, buildStartEvent(INVALID_SESSION_ID));

        let observed;
        let rejected = false;
        try {
            const msg = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message });
            observed = msg.json ?? msg.raw;
            const text = JSON.stringify(observed).toLowerCase();
            rejected = text.includes(WS_PROTOCOL.errorField) || text.includes('invalid') || text.includes('reject');
        } catch (err) {
            rejected = Boolean(err.closeCode);
            observed = { closeCode: err.closeCode, closeReason: err.closeReason };
        }

        await attachWsEvidence(testInfo, { endpoint: URL, step: 'invalid-session-id', sentSessionId: INVALID_SESSION_ID, observed, rejected });
        await closeSocket(ws).catch(() => killSocket(ws));

        expect(rejected, 'Server should flag an invalid session ID rather than proceeding as if it were valid').toBe(true);
    });

    test('missing required parameters on start event is rejected', async ({ wsAuthToken }, testInfo) => {
        const { ws } = await openSocket(URL, { token: wsAuthToken });
        // Start event with no sessionId at all.
        sendJson(ws, { [WS_PROTOCOL.eventField]: WS_PROTOCOL.startEventName });

        let observed;
        let rejected = false;
        try {
            const msg = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message });
            observed = msg.json ?? msg.raw;
            const text = JSON.stringify(observed).toLowerCase();
            rejected = text.includes(WS_PROTOCOL.errorField) || text.includes('required') || text.includes('missing');
        } catch (err) {
            rejected = Boolean(err.closeCode);
            observed = { closeCode: err.closeCode, closeReason: err.closeReason };
        }

        await attachWsEvidence(testInfo, { endpoint: URL, step: 'missing-parameters', observed, rejected });
        await closeSocket(ws).catch(() => killSocket(ws));

        expect(rejected, 'Server should flag a start event missing sessionId rather than accepting it').toBe(true);
    });

    test('malformed message does not crash or hang the session', async ({ wsAuthToken }, testInfo) => {
        const { ws } = await openSocket(URL, { token: wsAuthToken });
        const sessionId = newSessionId();
        sendJson(ws, buildStartEvent(sessionId));
        await waitForMessage(ws, { timeoutMs: TIMEOUTS.message }).catch(() => null);

        // Not valid JSON at all.
        ws.send('{"event": "message", this is not valid json');

        let handled = false;
        let observed;
        try {
            const msg = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message });
            observed = msg.json ?? msg.raw;
            handled = true;
        } catch (err) {
            handled = Boolean(err.closeCode);
            observed = { closeCode: err.closeCode, closeReason: err.closeReason };
        }

        await attachWsEvidence(testInfo, { endpoint: URL, step: 'malformed-message', observed, handled });
        await closeSocket(ws).catch(() => killSocket(ws));

        expect(handled, 'Server should respond with an error or close cleanly on malformed JSON, not hang').toBe(true);
    });

    test('unexpected disconnect mid-session leaves the socket free for reconnect', async ({ wsAuthToken }, testInfo) => {
        const sessionId = newSessionId();
        const { ws } = await openSocket(URL, { token: wsAuthToken });
        sendJson(ws, buildStartEvent(sessionId));
        await waitForMessage(ws, { timeoutMs: TIMEOUTS.message }).catch(() => null);

        // Simulate a dropped connection: no close handshake at all.
        killSocket(ws);

        // A fresh connection with a new session should still succeed,
        // proving the abrupt drop didn't wedge the server-side handler.
        let reconnectError = null;
        let reconnected;
        try {
            reconnected = await openSocket(URL, { token: wsAuthToken });
        } catch (err) {
            reconnectError = err.message;
        }

        await attachWsEvidence(testInfo, { endpoint: URL, step: 'unexpected-disconnect-then-reconnect', reconnectError });

        expect(reconnectError, `Reconnect after abrupt drop failed: ${reconnectError}`).toBeNull();
        await closeSocket(reconnected.ws);
    });
});
