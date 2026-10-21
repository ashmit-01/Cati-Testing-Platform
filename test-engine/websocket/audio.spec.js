/**
 * /ws/audio - the Python AI engine's raw audio socket (VAD -> STT ->
 * RAG -> LLM -> TTS pipeline entry point).
 *
 * This is the lowest-level, most latency-sensitive socket in the voice
 * pipeline, so tests here are deliberately narrow: connect, send a test
 * audio frame, and confirm a structured response comes back within a
 * generous timeout (TTS synthesis can be slow). Deeper behavioral
 * assertions about what the response *means* belong in test-engine/ai/,
 * not here.
 */

import { test, expect } from './fixtures/ws.fixture.js';
import { openSocket, sendJson, waitForMessage, closeSocket, attachWsEvidence } from './helpers/wsClient.helper.js';
import { WS_ENDPOINTS, TIMEOUTS, buildStartEvent, buildAudioChunkEvent, newSessionId } from './data/ws.config.js';

const URL = WS_ENDPOINTS.AUDIO;

test.describe('WS /ws/audio', () => {
    test('connect - handshake succeeds against the AI engine host', async ({ wsAuthToken }, testInfo) => {
        const { ws, handshakeStatus } = await openSocket(URL, { token: wsAuthToken });
        await attachWsEvidence(testInfo, { endpoint: URL, step: 'connect', handshakeStatus });
        expect(ws.readyState).toBe(ws.OPEN);
        await closeSocket(ws);
    });

    test('send test audio -> receive a structured response', async ({ wsAuthToken }, testInfo) => {
        const sessionId = newSessionId();
        const { ws } = await openSocket(URL, { token: wsAuthToken });

        sendJson(ws, buildStartEvent(sessionId));
        await waitForMessage(ws, { timeoutMs: TIMEOUTS.message }).catch(() => null);

        sendJson(ws, buildAudioChunkEvent(sessionId));

        let response;
        let error = null;
        try {
            // Audio round-trips through VAD/STT/RAG/LLM/TTS, so this gets
            // the longer "idle" timeout budget rather than the default
            // message timeout.
            response = await waitForMessage(ws, { timeoutMs: TIMEOUTS.idle });
        } catch (err) {
            error = err.message;
        }

        await attachWsEvidence(testInfo, {
            endpoint: URL,
            step: 'send-audio-receive-response',
            sessionId,
            response: response?.json ?? response?.raw ?? null,
            responseIsBinary: response?.isBinary ?? null,
            error,
        });

        await closeSocket(ws);

        expect(error, `Expected a response to the test audio frame, got error: ${error}`).toBeNull();
        expect(response).toBeTruthy();
    });
});
