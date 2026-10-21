/**
 * WebSocket client helper.
 *
 * Thin, promise-based wrapper around the `ws` package, enhanced with:
 * - Live message history recording
 * - Error frame capture
 * - Integrated AI Engine Error Evidence capture (Phase 7, 9, 10, 11)
 * - Safe credential sanitization
 *
 * Contains NO assertions — spec files decide pass/fail.
 */

import WebSocket from 'ws';
import { TIMEOUTS, WS_FRAMES } from '../data/ws.config.js';
import { sanitizeData, captureAiWsEvidence } from '../../shared/aiErrorCapture.js';

export function sanitizeEvidence(data) {
    return sanitizeData(data);
}

/**
 * Attaches connection/message evidence and structured AI Engine Error Evidence
 * to the Playwright report.
 */
export async function attachWsEvidence(testInfo, details = {}) {
    if (!testInfo) return;
    try {
        await captureAiWsEvidence(testInfo, {
            endpoint: details.endpoint || '',
            step: details.step || 'interaction',
            connectionStatus: details.connectionStatus || (details.outcome === 'opened' ? 'connected' : 'rejected'),
            handshakeStatus: details.handshakeStatus || details.error?.handshakeStatus || null,
            closeCode: details.closeCode || details.closeResult?.code || details.error?.closeCode || null,
            closeReason: details.closeReason || details.closeResult?.reason || '',
            errorFrame: details.errorFrame || null,
            messageHistory: details.messageHistory || [],
            error: details.error,
            expected: Boolean(details.expected),
        });
    } catch {
        // Safe fallback
    }
}

/**
 * Enhanced WebSocket session wrapper that tracks message history and error frames.
 */
export class WsSession {
    constructor(ws, url, testInfo = null) {
        this.ws = ws;
        this.url = url;
        this.testInfo = testInfo;
        this.messageHistory = [];
        this.lastErrorFrame = null;
        this.isClosed = false;
        this.closeCode = null;
        this.closeReason = '';

        this._setupListeners();
    }

    _setupListeners() {
        this.ws.on('message', (data, isBinary) => {
            const raw = isBinary ? `<binary ${data.length} bytes>` : data.toString();
            let json = null;
            if (!isBinary) {
                try {
                    json = JSON.parse(raw);
                } catch {}
            }

            const record = {
                direction: 'inbound',
                timestamp: new Date().toISOString(),
                isBinary: Boolean(isBinary),
                raw,
                json,
            };

            this.messageHistory.push(record);

            // Check if this is an error frame from the server
            if (json && (json.type === WS_FRAMES.ERROR || json.error || json.status === 'error')) {
                this.lastErrorFrame = json;
            }
        });

        this.ws.once('close', (code, reason) => {
            this.isClosed = true;
            this.closeCode = code;
            this.closeReason = reason?.toString() || '';
        });
    }

    send(payload) {
        const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
        let parsed = null;
        try {
            parsed = JSON.parse(text);
        } catch {}

        this.messageHistory.push({
            direction: 'outbound',
            timestamp: new Date().toISOString(),
            raw: text,
            json: parsed,
        });

        this.ws.send(text);
    }

    async close(code = 1000, reason = 'test complete') {
        return closeSocket(this.ws, code, reason);
    }
}

/**
 * Opens a WebSocket connection and resolves once open, or rejects on error.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {string} [opts.token] - JWT token
 * @param {string} [opts.agentId] - Owned agentId
 * @param {Record<string,string>} [opts.headers]
 * @param {number} [opts.timeoutMs]
 * @param {import('@playwright/test').TestInfo} [opts.testInfo]
 * @returns {Promise<{ws: WebSocket, session: WsSession, handshakeStatus: number}>}
 */
export function openSocket(url, opts = {}) {
    const { token, agentId, headers = {}, timeoutMs = TIMEOUTS.connect, testInfo = null } = opts;

    return new Promise((resolve, reject) => {
        let settled = false;
        let handshakeStatus = null;

        const urlObj = new URL(url);
        if (token) urlObj.searchParams.set('token', token);
        if (agentId) urlObj.searchParams.set('agentId', agentId);
        const finalUrl = urlObj.toString();

        const finalHeaders = token
            ? { Authorization: `Bearer ${token}`, ...headers }
            : headers;

        const ws = new WebSocket(finalUrl, { headers: finalHeaders, handshakeTimeout: timeoutMs });

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            ws.terminate();
            reject(new Error(`Timed out after ${timeoutMs}ms waiting for WebSocket to open: ${url}`));
        }, timeoutMs);

        ws.on('upgrade', (res) => {
            handshakeStatus = res.statusCode;
        });

        ws.once('open', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            const session = new WsSession(ws, finalUrl, testInfo);
            resolve({ ws, session, handshakeStatus: handshakeStatus ?? 101 });
        });

        ws.once('unexpected-response', (_req, res) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            handshakeStatus = res.statusCode;
            reject(Object.assign(new Error(`Unexpected handshake response: ${res.statusCode}`), {
                handshakeStatus: res.statusCode,
            }));
        });

        ws.once('error', (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
        });

        ws.once('close', (code, reasonBuf) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(
                Object.assign(new Error(`Socket closed before opening (code ${code})`), {
                    closeCode: code,
                    closeReason: reasonBuf?.toString() || '',
                    handshakeStatus,
                })
            );
        });
    });
}

/** Sends a JS object as a JSON text frame. */
export function sendJson(ws, payload) {
    if (ws instanceof WsSession) {
        ws.send(payload);
    } else {
        ws.send(JSON.stringify(payload));
    }
}

/**
 * Waits for the next message matching predicate.
 */
export function waitForMessage(ws, opts = {}) {
    const rawWs = ws instanceof WsSession ? ws.ws : ws;
    const { predicate = () => true, timeoutMs = TIMEOUTS.message } = opts;

    return new Promise((resolve, reject) => {
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error(`Timed out after ${timeoutMs}ms waiting for matching WebSocket message`));
        }, timeoutMs);

        function onMessage(data, isBinary) {
            if (settled) return;
            let json = null;
            let raw;
            if (isBinary) {
                raw = `<binary ${data.length} bytes>`;
            } else {
                raw = data.toString();
                try {
                    json = JSON.parse(raw);
                } catch {}
            }
            const msg = { json, raw, isBinary: Boolean(isBinary) };
            if (predicate(msg)) {
                settled = true;
                cleanup();
                resolve(msg);
            }
        }

        function onClose(code, reasonBuf) {
            if (settled) return;
            settled = true;
            cleanup();
            reject(
                Object.assign(new Error(`Socket closed while waiting for a message (code ${code})`), {
                    closeCode: code,
                    closeReason: reasonBuf?.toString() || '',
                })
            );
        }

        function onError(err) {
            if (settled) return;
            settled = true;
            cleanup();
            reject(err);
        }

        function cleanup() {
            clearTimeout(timer);
            rawWs.off('message', onMessage);
            rawWs.off('close', onClose);
            rawWs.off('error', onError);
        }

        rawWs.on('message', onMessage);
        rawWs.once('close', onClose);
        rawWs.once('error', onError);
    });
}

/** Closes the socket and resolves once the close handshake completes. */
export function closeSocket(ws, code = 1000, reason = 'test complete') {
    const rawWs = ws instanceof WsSession ? ws.ws : ws;
    if (rawWs.readyState === WebSocket.CLOSED) {
        return Promise.resolve({ code: rawWs._closeCode ?? null, reason: '' });
    }

    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            rawWs.off('close', onClose);
            rawWs.terminate();
            resolve({ code: null, reason: 'force-terminated after close timeout' });
        }, TIMEOUTS.connect);

        function onClose(closeCode, reasonBuf) {
            clearTimeout(timer);
            resolve({ code: closeCode, reason: reasonBuf?.toString() || '' });
        }

        rawWs.once('close', onClose);

        try {
            rawWs.close(code, reason);
        } catch {
            clearTimeout(timer);
            rawWs.off('close', onClose);
            rawWs.terminate();
            resolve({ code: null, reason: 'terminated: close() threw' });
        }
    });
}

/** Abruptly kills connection without a handshake. */
export function killSocket(ws) {
    const rawWs = ws instanceof WsSession ? ws.ws : ws;
    rawWs.terminate();
}

export { WebSocket };
