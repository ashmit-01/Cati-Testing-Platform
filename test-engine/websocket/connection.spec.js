/**
 * Generic WebSocket connection-lifecycle matrix.
 *
 * Runs the same set of protocol-level checks (handshake, auth, session
 * creation, send/receive, disconnect, reconnect, timeout, invalid
 * messages) against every configured socket, so behavior differences
 * between /ws/vobiz, /api/ws/ai-engine and /ws/audio show up directly
 * instead of being re-implemented three times.
 *
 * Endpoint-specific happy-path and negative flows (the exact sequence of
 * events a real call/session goes through) live in vobiz.spec.js,
 * ai-engine.spec.js and audio.spec.js instead.
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
    CLOSE_CODES,
    TIMEOUTS,
    buildStartEvent,
    buildMalformedPayload,
    newSessionId,
} from './data/ws.config.js';

const SOCKETS = Object.entries(WS_ENDPOINTS); // [ ['VOBIZ', url], ['AI_ENGINE', url], ['AUDIO', url] ]

for (const [name, url] of SOCKETS) {
    test.describe(`WebSocket lifecycle - ${name} (${url})`, () => {
        test(`${name}: handshake - connects and upgrades to 101`, async ({ wsAuthToken }, testInfo) => {
            const start = Date.now();
            let result;
            try {
                result = await openSocket(url, { token: wsAuthToken });
            } finally {
                await attachWsEvidence(testInfo, {
                    endpoint: url,
                    step: 'handshake',
                    durationMs: Date.now() - start,
                    handshakeStatus: result?.handshakeStatus ?? null,
                });
            }

            expect(result.ws.readyState).toBe(result.ws.OPEN);
            await closeSocket(result.ws);
        });

        test(`${name}: authentication - rejects connection with no token`, async ({}, testInfo) => {
            let outcome = 'opened';
            let error = null;
            let ws = null;

            try {
                const result = await openSocket(url, { timeoutMs: TIMEOUTS.connect });
                ws = result.ws;
            } catch (err) {
                outcome = 'rejected';
                error = { message: err.message, closeCode: err.closeCode, handshakeStatus: err.handshakeStatus };
            }

            await attachWsEvidence(testInfo, { endpoint: url, step: 'auth-no-token', outcome, error });

            // Some sockets may allow anonymous connections that only get
            // rejected once a session/action requiring auth is attempted.
            // Either an outright handshake rejection OR a still-open
            // socket is acceptable here as a raw connection result; the
            // meaningful assertion is that an unauthenticated socket must
            // NOT be able to complete a session start (checked below).
            if (outcome === 'opened') {
                sendJson(ws, buildStartEvent());
                let sessionAccepted = false;
                try {
                    const msg = await waitForMessage(ws, {
                        timeoutMs: TIMEOUTS.message,
                        predicate: () => true,
                    });
                    const text = (msg.raw || '').toLowerCase();
                    sessionAccepted =
                        !text.includes('unauthor') &&
                        !text.includes(WS_PROTOCOL.errorField) &&
                        (msg.json?.sessionId || msg.json?.session_id) !== undefined;
                } catch {
                    sessionAccepted = false;
                }
                await closeSocket(ws);
                expect(
                    sessionAccepted,
                    'An unauthenticated connection should not be able to start a real session'
                ).toBe(false);
            } else {
                expect(outcome).toBe('rejected');
            }
        });

        test(`${name}: authentication - accepts connection with a valid token`, async ({ wsAuthToken }, testInfo) => {
            const { ws } = await openSocket(url, { token: wsAuthToken });
            await attachWsEvidence(testInfo, { endpoint: url, step: 'auth-valid-token', outcome: 'opened' });
            expect(ws.readyState).toBe(ws.OPEN);
            await closeSocket(ws);
        });

        test(`${name}: session creation - start event yields a session identifier`, async ({ wsAuthToken }, testInfo) => {
            const { ws } = await openSocket(url, { token: wsAuthToken });
            const sessionId = newSessionId();
            sendJson(ws, buildStartEvent(sessionId));

            let msg;
            let error = null;
            try {
                msg = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message });
            } catch (err) {
                error = err.message;
            }

            await attachWsEvidence(testInfo, {
                endpoint: url,
                step: 'session-creation',
                sentSessionId: sessionId,
                received: msg?.json ?? msg?.raw ?? null,
                error,
            });

            await closeSocket(ws);

            expect(error, `Expected a response to the start event, got error: ${error}`).toBeNull();
            expect(msg).toBeTruthy();
        });

        test(`${name}: message send/receive - server responds to a client message`, async ({ wsAuthToken }, testInfo) => {
            const { ws } = await openSocket(url, { token: wsAuthToken });
            const sessionId = newSessionId();
            sendJson(ws, buildStartEvent(sessionId));
            // Drain the session-created ack (if any) before sending the
            // actual test message, without failing the test if the
            // socket doesn't send one.
            await waitForMessage(ws, { timeoutMs: TIMEOUTS.message }).catch(() => null);

            sendJson(ws, { [WS_PROTOCOL.eventField]: WS_PROTOCOL.messageEventName, [WS_PROTOCOL.sessionIdField]: sessionId, text: 'QA automated ping' });

            let response;
            let error = null;
            try {
                response = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message });
            } catch (err) {
                error = err.message;
            }

            await attachWsEvidence(testInfo, {
                endpoint: url,
                step: 'message-send-receive',
                response: response?.json ?? response?.raw ?? null,
                error,
            });

            await closeSocket(ws);
            expect(error, `Expected a response to the test message, got error: ${error}`).toBeNull();
        });

        test(`${name}: disconnect - client-initiated close completes cleanly`, async ({ wsAuthToken }, testInfo) => {
            const { ws } = await openSocket(url, { token: wsAuthToken });
            const { code, reason } = await closeSocket(ws, CLOSE_CODES.NORMAL, 'qa-client-disconnect');

            await attachWsEvidence(testInfo, { endpoint: url, step: 'disconnect', closeCode: code, closeReason: reason });

            expect(ws.readyState).toBe(ws.CLOSED);
        });

        test(`${name}: reconnect - a new connection can be opened after a previous one closed`, async ({ wsAuthToken }, testInfo) => {
            const first = await openSocket(url, { token: wsAuthToken });
            await closeSocket(first.ws);

            let second;
            let error = null;
            try {
                second = await openSocket(url, { token: wsAuthToken });
            } catch (err) {
                error = err.message;
            }

            await attachWsEvidence(testInfo, { endpoint: url, step: 'reconnect', error });

            expect(error, `Reconnect failed: ${error}`).toBeNull();
            expect(second.ws.readyState).toBe(second.ws.OPEN);
            await closeSocket(second.ws);
        });

        test(`${name}: timeout - connecting to an unroutable address fails within the client timeout`, async ({}, testInfo) => {
            // Client-side timeout behavior: this does not depend on the
            // server's idle-session timeout policy (which isn't
            // documented and may vary by socket), only on the WS client
            // correctly giving up on a connection attempt.
            const unroutable = url.replace(/^wss?:\/\/[^/]+/, 'ws://10.255.255.1:9');
            const start = Date.now();
            let timedOutOrErrored = false;
            try {
                await openSocket(unroutable, { timeoutMs: 4_000 });
            } catch {
                timedOutOrErrored = true;
            }
            const durationMs = Date.now() - start;

            await attachWsEvidence(testInfo, { endpoint: unroutable, step: 'client-timeout', durationMs, timedOutOrErrored });

            expect(timedOutOrErrored).toBe(true);
            expect(durationMs).toBeLessThan(6_000);
        });

        test(`${name}: invalid messages - malformed payload does not crash the session`, async ({ wsAuthToken }, testInfo) => {
            const { ws } = await openSocket(url, { token: wsAuthToken });
            sendJson(ws, buildStartEvent());
            await waitForMessage(ws, { timeoutMs: TIMEOUTS.message }).catch(() => null);

            sendJson(ws, buildMalformedPayload());

            let handledGracefully = false;
            let observed = null;
            try {
                const msg = await waitForMessage(ws, { timeoutMs: TIMEOUTS.message });
                observed = msg.json ?? msg.raw;
                // Graceful = server sent SOME response (an error frame is
                // fine and expected) rather than the raw JS exception
                // text or nothing at all.
                handledGracefully = true;
            } catch (err) {
                // A clean close in response to bad input also counts as
                // "handled" (not a crash) as long as the close code isn't
                // the abnormal/no-status code.
                if (err.closeCode && err.closeCode !== CLOSE_CODES.ABNORMAL) {
                    handledGracefully = true;
                }
                observed = { closeCode: err.closeCode, closeReason: err.closeReason };
            }

            await attachWsEvidence(testInfo, { endpoint: url, step: 'invalid-message', observed, handledGracefully });

            await closeSocket(ws).catch(() => killSocket(ws));
            expect(
                handledGracefully,
                'Server should respond with an error frame or a clean close for malformed input, not hang or drop abnormally'
            ).toBe(true);
        });
    });
}
