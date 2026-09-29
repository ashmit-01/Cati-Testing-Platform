/**
 * WebSocket endpoint + protocol configuration.
 *
 * This is the ONE place that should change if CATI's real-time protocol
 * differs from what is assumed here. Nothing in the spec files hardcodes
 * a URL, event name, or field name directly — they all read from this
 * module so a protocol confirmation from the CATI engineering team only
 * requires editing this file.
 *
 * ---------------------------------------------------------------------
 * ASSUMPTIONS (confirm against real CATI protocol docs / source before
 * trusting FAIL results from tests that rely on them):
 *
 * 1. All three sockets speak JSON text frames (not raw binary framing for
 *    control messages). Binary frames are assumed only for the actual
 *    audio payload chunks on /ws/audio and inside /ws/vobiz.
 * 2. Auth is passed as a bearer token, either as a `token` query-string
 *    param or an `Authorization: Bearer <token>` header during the
 *    handshake. Both are attempted (see wsClient.helper.js).
 * 3. A client "start" event uses the shape { event: 'start', sessionId }.
 * 4. The server acknowledges session creation with a message containing
 *    a `sessionId` (or `session_id`) field, in an event whose name
 *    contains "session" or "start" (checked case-insensitively).
 * 5. Text/audio turns are sent as { event: 'message', sessionId, text }
 *    or { event: 'media', sessionId, audio: <base64> }.
 * 6. Malformed/invalid input produces either a WS close with a non-1000
 *    code, or a JSON error frame containing an `error` field — a test is
 *    considered to have caught the invalid-input case if either happens.
 *
 * Update WS_PROTOCOL below once the real contract is confirmed.
 * ---------------------------------------------------------------------
 */

import { randomUUID } from 'crypto';

function toWsUrl(httpUrl) {
    if (!httpUrl) return null;
    return httpUrl.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const BACKEND_WS_BASE = toWsUrl(BACKEND_URL);

// The Python AI engine may be a fully separate host, so it gets its own
// env var (already present in .env.example: AI_ENGINE_WS_URL). Fall back
// to deriving it from AI_ENGINE_URL, then from the backend, so the suite
// still runs (against a best guess) in a minimally configured environment.
const AI_ENGINE_WS_BASE =
    process.env.AI_ENGINE_WS_URL ||
    toWsUrl(process.env.AI_ENGINE_URL) ||
    BACKEND_WS_BASE;

/** Raw WebSocket endpoint URLs, one per socket under test. */
export const WS_ENDPOINTS = Object.freeze({
    VOBIZ: `${BACKEND_WS_BASE}/ws/vobiz`,
    AI_ENGINE: `${BACKEND_WS_BASE}/api/ws/ai-engine`,
    AUDIO: `${AI_ENGINE_WS_BASE}/ws/audio`,
});

/** Field / event-name vocabulary — see assumption #3-#6 above. */
export const WS_PROTOCOL = Object.freeze({
    eventField: 'event',
    sessionIdField: 'sessionId',
    startEventName: 'start',
    messageEventName: 'message',
    mediaEventName: 'media',
    errorField: 'error',
});

/** Close codes worth asserting on explicitly. */
export const CLOSE_CODES = Object.freeze({
    NORMAL: 1000,
    GOING_AWAY: 1001,
    PROTOCOL_ERROR: 1002,
    UNSUPPORTED_DATA: 1003,
    ABNORMAL: 1006,
    POLICY_VIOLATION: 1008,
    INTERNAL_ERROR: 1011,
});

export const TIMEOUTS = Object.freeze({
    connect: Number(process.env.WS_CONNECT_TIMEOUT_MS) || 8_000,
    message: Number(process.env.WS_MESSAGE_TIMEOUT_MS) || 10_000,
    idle: Number(process.env.WS_IDLE_TIMEOUT_MS) || 15_000,
});

export function newSessionId() {
    return randomUUID();
}

/** Deliberately malformed / unroutable session id for negative tests. */
export const INVALID_SESSION_ID = 'not-a-real-session-####';

export function buildStartEvent(sessionId = newSessionId()) {
    return {
        [WS_PROTOCOL.eventField]: WS_PROTOCOL.startEventName,
        [WS_PROTOCOL.sessionIdField]: sessionId,
    };
}

export function buildTextMessageEvent(sessionId, text = 'Hello, this is an automated QA test message.') {
    return {
        [WS_PROTOCOL.eventField]: WS_PROTOCOL.messageEventName,
        [WS_PROTOCOL.sessionIdField]: sessionId,
        text,
    };
}

/**
 * A tiny (44-byte header + 0 samples) silent WAV file, base64-encoded.
 * Safe to send repeatedly: it carries no real audio/PII and produces no
 * telephony side effects. Good enough to exercise the "did the server
 * accept and respond to an audio frame" path without needing a real
 * recording.
 */
export const SILENT_WAV_BASE64 =
    'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export function buildAudioChunkEvent(sessionId, audioBase64 = SILENT_WAV_BASE64) {
    return {
        [WS_PROTOCOL.eventField]: WS_PROTOCOL.mediaEventName,
        [WS_PROTOCOL.sessionIdField]: sessionId,
        audio: audioBase64,
    };
}

export function buildMalformedPayload() {
    // Intentionally invalid JSON-shaped-but-wrong payload: missing the
    // event field entirely and using an unexpected type for sessionId.
    return { sessionId: 12345, unexpectedField: true };
}
