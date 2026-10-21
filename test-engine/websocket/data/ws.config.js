/**
 * WebSocket endpoint + protocol configuration.
 *
 * Aligned with actual CATI backend architecture:
 * - Real endpoints:
 *     /realtime (AI Engine real-time turn bridge)
 *     /ws/vobiz (Telephony bridge)
 * - Required connection credentials:
 *     JWT token + agentId
 * - Server-side & client-side frame types:
 *     connected | transcript | response | audio | error
 * - Error frame capture & standard close codes
 */

import { randomUUID } from 'crypto';

function toWsUrl(httpUrl) {
    if (!httpUrl) return null;
    return httpUrl.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const BACKEND_WS_BASE = toWsUrl(BACKEND_URL);

const AI_ENGINE_WS_BASE =
    process.env.AI_ENGINE_WS_URL ||
    toWsUrl(process.env.AI_ENGINE_URL) ||
    'wss://fucr8ewyudjjbqlxhajoahpn.200.234.39.243.sslip.io';

/** Raw WebSocket endpoint URLs, matching actual CATI routes. */
export const WS_ENDPOINTS = Object.freeze({
    REALTIME: `${BACKEND_WS_BASE}/realtime`,
    VOBIZ: `${BACKEND_WS_BASE}/ws/vobiz`,
    DIRECT_REALTIME: `${AI_ENGINE_WS_BASE}/realtime`,
    AI_ENGINE: `${BACKEND_WS_BASE}/realtime`, // Legacy alias
    AUDIO: `${AI_ENGINE_WS_BASE}/realtime`,   // Legacy alias
});

/** Real frame types supported by the CATI backend and AI engine. */
export const WS_FRAMES = Object.freeze({
    CONNECTED: 'connected',
    TRANSCRIPT: 'transcript',
    RESPONSE: 'response',
    AUDIO: 'audio',
    ERROR: 'error',
    MESSAGE: 'message',
    START: 'start',
});

/** Backward-compatible protocol field names for legacy connection tests */
export const WS_PROTOCOL = Object.freeze({
    eventField: 'type',
    sessionIdField: 'sessionId',
    startEventName: 'start',
    messageEventName: 'transcript',
    mediaEventName: 'audio',
    errorField: 'error',
});

/** Standard RFC 6455 WebSocket close codes. */
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

/** Deliberately invalid session ID / agent ID for negative tests */
export const INVALID_AGENT_ID = 'not-a-real-agent-id-12345';
export const INVALID_SESSION_ID = 'not-a-real-session-####';
export const VALID_FAKE_AGENT_ID = '507f1f77bcf86cd799439011';

/**
 * Builds WebSocket URL with query parameters (token, agentId)
 */
export function buildWsUrl(endpoint, { token, agentId } = {}) {
    const url = new URL(endpoint);
    if (token) url.searchParams.set('token', token);
    if (agentId) url.searchParams.set('agentId', agentId);
    return url.toString();
}

/**
 * Builds client-side transcript frame
 */
export function buildTranscriptFrame(text = 'Hello, this is automated QA testing.', agentId = null) {
    const frame = {
        type: WS_FRAMES.TRANSCRIPT,
        text,
        timestamp: new Date().toISOString(),
    };
    if (agentId) frame.agentId = agentId;
    return frame;
}

/** Legacy alias for buildTranscriptFrame */
export function buildTextMessageEvent(sessionId, text = 'Hello, this is an automated QA test message.') {
    return {
        type: WS_FRAMES.TRANSCRIPT,
        sessionId,
        text,
    };
}

/**
 * Silent WAV file chunk base64 for audio transmission testing
 */
export const SILENT_WAV_BASE64 =
    'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/**
 * Builds audio turn frame
 */
export function buildAudioFrame(audioBase64 = SILENT_WAV_BASE64, agentId = null) {
    const frame = {
        type: WS_FRAMES.AUDIO,
        data: audioBase64,
        format: 'audio/wav',
        timestamp: new Date().toISOString(),
    };
    if (agentId) frame.agentId = agentId;
    return frame;
}

/** Legacy alias for buildAudioFrame */
export function buildAudioChunkEvent(sessionId, audioBase64 = SILENT_WAV_BASE64) {
    return {
        type: WS_FRAMES.AUDIO,
        sessionId,
        data: audioBase64,
    };
}

/** Legacy alias for start session frame */
export function buildStartEvent(sessionId = newSessionId()) {
    return {
        type: WS_FRAMES.START,
        sessionId,
    };
}

/**
 * Builds deliberately malformed payload
 */
export function buildMalformedPayload() {
    return {
        type: 'invalid_unsupported_frame_type',
        brokenField: 99999,
        corrupt: true,
    };
}
