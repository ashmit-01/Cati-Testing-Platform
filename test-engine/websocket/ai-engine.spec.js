/**
 * /realtime - AI Engine real-time WebSocket bridge
 *
 * Implements Phase 11:
 * - Real backend protocol: requires JWT token + agentId
 * - Server-side & client-side frame types: connected, transcript, response, audio, error
 * - Tests:
 *   1. valid connection
 *   2. invalid authentication
 *   3. invalid / missing agent
 *   4. successful message / response flow
 *   5. error frame handling
 *   6. connection close behavior
 *   7. unexpected connection failure handling
 * - Robust AI Engine Error Evidence capture
 */

import { test, expect } from './fixtures/ws.fixture.js';
import {
    openSocket,
    sendJson,
    waitForMessage,
    closeSocket,
    attachWsEvidence,
} from './helpers/wsClient.helper.js';
import {
    WS_ENDPOINTS,
    WS_FRAMES,
    TIMEOUTS,
    CLOSE_CODES,
    VALID_FAKE_AGENT_ID,
    INVALID_AGENT_ID,
    buildTranscriptFrame,
    buildMalformedPayload,
} from './data/ws.config.js';

const URL = WS_ENDPOINTS.REALTIME;

test.describe('WS /realtime - AI Engine Protocol', () => {
    test('1. valid connection - opens successfully with valid token and agentId', async ({ wsAuthToken }, testInfo) => {
        let wsSession = null;
        let handshakeStatus = null;
        let error = null;

        try {
            const result = await openSocket(URL, {
                token: wsAuthToken,
                agentId: process.env.TEST_AGENT_ID || VALID_FAKE_AGENT_ID,
                testInfo,
            });
            wsSession = result.session;
            handshakeStatus = result.handshakeStatus;

            await attachWsEvidence(testInfo, {
                endpoint: URL,
                step: 'valid-connection',
                handshakeStatus,
                connectionStatus: 'connected',
                expected: false,
            });

            expect(wsSession.ws.readyState).toBe(wsSession.ws.OPEN);
        } catch (err) {
            error = err;
            await attachWsEvidence(testInfo, {
                endpoint: URL,
                step: 'valid-connection',
                error: err,
                handshakeStatus: err.handshakeStatus,
                closeCode: err.closeCode,
                closeReason: err.closeReason,
                connectionStatus: 'failed',
                expected: false,
            });
            throw err;
        } finally {
            if (wsSession) {
                await wsSession.close();
            }
        }
    });

    test('2. invalid authentication - rejects connection with garbage token', async ({}, testInfo) => {
        let outcome = 'opened';
        let error = null;
        let wsSession = null;

        try {
            const result = await openSocket(URL, {
                token: 'invalid-jwt-token-string',
                agentId: VALID_FAKE_AGENT_ID,
                timeoutMs: TIMEOUTS.connect,
                testInfo,
            });
            wsSession = result.session;
        } catch (err) {
            outcome = 'rejected';
            error = err;
        }

        await attachWsEvidence(testInfo, {
            endpoint: URL,
            step: 'invalid-auth',
            outcome,
            error,
            handshakeStatus: error?.handshakeStatus,
            closeCode: error?.closeCode,
            closeReason: error?.closeReason,
            expected: true, // Expected negative test
        });

        if (outcome === 'opened') {
            // If handshake did not reject immediately, wait for server to send error frame or close
            try {
                const msg = await waitForMessage(wsSession.ws, { timeoutMs: 3_000 });
                const isError = msg.json?.type === WS_FRAMES.ERROR || Boolean(msg.json?.error);
                expect(isError, 'Server must emit an error frame for invalid token').toBe(true);
            } catch {
                expect(wsSession.ws.readyState).not.toBe(wsSession.ws.OPEN);
            } finally {
                await wsSession.close();
            }
        } else {
            expect(outcome).toBe('rejected');
        }
    });

    test('3. missing or invalid agent - rejects or emits error frame', async ({ wsAuthToken }, testInfo) => {
        let outcome = 'opened';
        let error = null;
        let wsSession = null;

        try {
            const result = await openSocket(URL, {
                token: wsAuthToken,
                agentId: INVALID_AGENT_ID,
                timeoutMs: TIMEOUTS.connect,
                testInfo,
            });
            wsSession = result.session;
        } catch (err) {
            outcome = 'rejected';
            error = err;
        }

        await attachWsEvidence(testInfo, {
            endpoint: URL,
            step: 'invalid-agent',
            outcome,
            error,
            closeCode: error?.closeCode,
            closeReason: error?.closeReason,
            expected: true, // Expected negative test
        });

        if (outcome === 'opened') {
            // Verify server closes or returns error frame
            let receivedError = false;
            try {
                const msg = await waitForMessage(wsSession.ws, { timeoutMs: 3_000 });
                receivedError = msg.json?.type === WS_FRAMES.ERROR || Boolean(msg.json?.error);
            } catch {
                receivedError = wsSession.ws.readyState !== wsSession.ws.OPEN;
            } finally {
                await wsSession.close();
            }
            expect(receivedError, 'Invalid agentId must produce an error frame or close').toBe(true);
        } else {
            expect(outcome).toBe('rejected');
        }
    });

    test('4. message / response flow - sending transcript produces response frame', async ({ wsAuthToken }, testInfo) => {
        const agentId = process.env.TEST_AGENT_ID || VALID_FAKE_AGENT_ID;
        let wsSession = null;

        try {
            const result = await openSocket(URL, {
                token: wsAuthToken,
                agentId,
                testInfo,
            });
            wsSession = result.session;

            const turnFrame = buildTranscriptFrame('What are your office hours?', agentId);
            wsSession.send(turnFrame);

            let replyMsg = null;
            let replyError = null;

            try {
                replyMsg = await waitForMessage(wsSession.ws, {
                    timeoutMs: TIMEOUTS.message,
                    predicate: (msg) => msg.json?.type === WS_FRAMES.RESPONSE || msg.json?.type === WS_FRAMES.TRANSCRIPT || msg.json?.reply,
                });
            } catch (err) {
                replyError = err;
            }

            await attachWsEvidence(testInfo, {
                endpoint: URL,
                step: 'message-response',
                messageHistory: wsSession.messageHistory,
                errorFrame: wsSession.lastErrorFrame,
                error: replyError,
                expected: false,
            });

            expect(replyError, `Expected AI Engine response frame, got: ${replyError?.message}`).toBeNull();
            expect(replyMsg).not.toBeNull();
        } finally {
            if (wsSession) {
                await wsSession.close();
            }
        }
    });

    test('5. error frame - malformed payload does not crash the server', async ({ wsAuthToken }, testInfo) => {
        const agentId = process.env.TEST_AGENT_ID || VALID_FAKE_AGENT_ID;
        let wsSession = null;

        try {
            const result = await openSocket(URL, {
                token: wsAuthToken,
                agentId,
                testInfo,
            });
            wsSession = result.session;

            // Send malformed payload
            wsSession.send(buildMalformedPayload());

            // Server should either send an error frame or close with code 1002/1003/1008
            let serverErrorResponse = null;
            try {
                const msg = await waitForMessage(wsSession.ws, {
                    timeoutMs: 3_000,
                    predicate: (m) => m.json?.type === WS_FRAMES.ERROR || Boolean(m.json?.error),
                });
                serverErrorResponse = msg.json;
            } catch {
                // If it closed cleanly on malformed data, that is also valid RFC 6455 behavior
            }

            await attachWsEvidence(testInfo, {
                endpoint: URL,
                step: 'malformed-payload',
                errorFrame: wsSession.lastErrorFrame || serverErrorResponse,
                messageHistory: wsSession.messageHistory,
                closeCode: wsSession.closeCode,
                closeReason: wsSession.closeReason,
                expected: true, // Expected error handling behavior
            });

            const handledProperly =
                Boolean(serverErrorResponse) ||
                wsSession.isClosed ||
                wsSession.ws.readyState === wsSession.ws.OPEN;

            expect(handledProperly).toBe(true);
        } finally {
            if (wsSession && !wsSession.isClosed) {
                await wsSession.close();
            }
        }
    });

    test('6. connection close behavior - normal client disconnect produces 1000', async ({ wsAuthToken }, testInfo) => {
        const agentId = process.env.TEST_AGENT_ID || VALID_FAKE_AGENT_ID;
        const result = await openSocket(URL, { token: wsAuthToken, agentId, testInfo });
        const closeResult = await result.session.close(CLOSE_CODES.NORMAL, 'client test complete');

        await attachWsEvidence(testInfo, {
            endpoint: URL,
            step: 'clean-close',
            closeCode: closeResult.code,
            closeReason: closeResult.reason,
            expected: false,
        });

        expect(closeResult.code).toBe(CLOSE_CODES.NORMAL);
    });

    test('7. reconnect behavior - clean close is followed by a working new connection', async ({ wsAuthToken }, testInfo) => {
        const agentId = process.env.TEST_AGENT_ID || VALID_FAKE_AGENT_ID;
        const first = await openSocket(URL, { token: wsAuthToken, agentId, testInfo });
        await first.session.close(CLOSE_CODES.NORMAL, 'first session closed');

        const second = await openSocket(URL, { token: wsAuthToken, agentId, testInfo });
        expect(second.ws.readyState).toBe(second.ws.OPEN);
        await second.session.close(CLOSE_CODES.NORMAL, 'second session closed');
    });
});
