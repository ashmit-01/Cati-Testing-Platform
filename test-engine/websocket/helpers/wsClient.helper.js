/**
 * WebSocket client helper.
 *
 * Thin, promise-based wrapper around the `ws` package. Contains NO
 * assertions — spec files decide what a pass/fail looks like. Every
 * function here resolves/rejects rather than throwing synchronously, so
 * spec files can use plain try/catch or `expect(...).rejects`.
 */

import WebSocket from 'ws';
import { TIMEOUTS } from '../data/ws.config.js';

/**
 * Redacts secrets from evidence before it's attached to the HTML report.
 * Mirrors test-engine/api/fixtures/api.fixture.js#sanitizeEvidence so
 * report evidence looks consistent across suites.
 */
export function sanitizeEvidence(data) {
    if (!data) return data;
    if (typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(sanitizeEvidence);

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (/password|token|secret|authorization|cookie|apikey/i.test(key)) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeEvidence(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

/** Attaches connection/message evidence to the Playwright HTML report. */
export async function attachWsEvidence(testInfo, details) {
    if (!testInfo) return;
    try {
        await testInfo.attach('WebSocket Evidence', {
            contentType: 'application/json',
            body: JSON.stringify(sanitizeEvidence(details), null, 2),
        });
    } catch {
        // Safe fallback if attachment fails
    }
}

/**
 * Opens a WebSocket connection and resolves once it is open, or rejects
 * on error / timeout / a non-101 handshake response.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {string} [opts.token] - bearer token, sent both as a `token`
 *   query param and an Authorization header, since the real CATI auth
 *   contract for the handshake isn't confirmed (see ws.config.js).
 * @param {Record<string,string>} [opts.headers]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{ws: WebSocket, handshakeStatus: number|null}>}
 */
export function openSocket(url, opts = {}) {
    const { token, headers = {}, timeoutMs = TIMEOUTS.connect } = opts;

    return new Promise((resolve, reject) => {
        let settled = false;
        let handshakeStatus = null;

        const finalUrl = token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;
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
            resolve({ ws, handshakeStatus: handshakeStatus ?? 101 });
        });

        ws.once('unexpected-response', (_req, res) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            handshakeStatus = res.statusCode;
            reject(Object.assign(new Error(`Unexpected handshake response: ${res.statusCode}`), { handshakeStatus }));
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
                })
            );
        });
    });
}

/** Sends a JS object as a JSON text frame. */
export function sendJson(ws, payload) {
    ws.send(JSON.stringify(payload));
}

/**
 * Waits for the next message matching `predicate` (default: any message).
 * Non-JSON frames are passed to the predicate/resolved value as a raw
 * string under `.raw`, with `.json` left undefined.
 *
 * @param {WebSocket} ws
 * @param {object} [opts]
 * @param {(msg: {json: any, raw: string}) => boolean} [opts.predicate]
 * @param {number} [opts.timeoutMs]
 */
export function waitForMessage(ws, opts = {}) {
    const { predicate = () => true, timeoutMs = TIMEOUTS.message } = opts;

    return new Promise((resolve, reject) => {
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error(`Timed out after ${timeoutMs}ms waiting for a matching WebSocket message`));
        }, timeoutMs);

        function onMessage(data, isBinary) {
            if (settled) return;
            let json;
            let raw;
            if (isBinary) {
                raw = `<binary ${data.length} bytes>`;
            } else {
                raw = data.toString();
                try {
                    json = JSON.parse(raw);
                } catch {
                    // leave json undefined for non-JSON text frames
                }
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
            ws.off('message', onMessage);
            ws.off('close', onClose);
            ws.off('error', onError);
        }

        ws.on('message', onMessage);
        ws.on('close', onClose);
        ws.on('error', onError);
    });
}

/**
 * Collects every message received during a fixed time window. Useful for
 * "did the server send an unsolicited session/ack event right after
 * connecting" style checks where there's no single predicate to wait for.
 */
export function collectMessagesFor(ws, durationMs) {
    const messages = [];
    const onMessage = (data, isBinary) => {
        if (isBinary) {
            messages.push({ raw: `<binary ${data.length} bytes>`, isBinary: true });
            return;
        }
        const raw = data.toString();
        let json;
        try {
            json = JSON.parse(raw);
        } catch {
            // non-JSON text frame
        }
        messages.push({ json, raw, isBinary: false });
    };

    ws.on('message', onMessage);

    return new Promise((resolve) => {
        setTimeout(() => {
            ws.off('message', onMessage);
            resolve(messages);
        }, durationMs);
    });
}

/** Closes the socket and resolves once the close handshake completes. */
export function closeSocket(ws, code = 1000, reason = 'test complete') {
    if (ws.readyState === WebSocket.CLOSED) {
        return Promise.resolve({ code: ws._closeCode ?? null, reason: '' });
    }

    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            ws.off('close', onClose);
            ws.terminate();
            resolve({ code: null, reason: 'force-terminated after close timeout' });
        }, TIMEOUTS.connect);

        function onClose(closeCode, reasonBuf) {
            clearTimeout(timer);
            resolve({ code: closeCode, reason: reasonBuf?.toString() || '' });
        }

        ws.once('close', onClose);

        try {
            ws.close(code, reason);
        } catch {
            clearTimeout(timer);
            ws.off('close', onClose);
            ws.terminate();
            resolve({ code: null, reason: 'terminated: close() threw' });
        }
    });
}

/** Abruptly kills the connection without a close handshake (simulates a dropped connection / network loss). */
export function killSocket(ws) {
    ws.terminate();
}

export { WebSocket };
