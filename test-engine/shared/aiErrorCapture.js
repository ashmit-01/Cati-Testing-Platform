/**
 * AI Engine Live Error & Runtime Evidence Capture
 *
 * Captures, categorizes, sanitizes, and attaches LIVE error information
 * generated during Playwright test execution for both HTTP and WebSocket
 * AI Engine interactions.
 *
 * Adheres to:
 * - Phase 7: Real AI Engine error capture (HTTP & WebSocket)
 * - Phase 8: Clear distinction between expected error responses and unexpected failures
 * - Phase 9: Structured attachment in Playwright ("AI Engine Error Evidence")
 * - Phase 10: Live runtime evidence attribution (AI Engine vs CATI Backend vs Network vs Runner)
 */

/**
 * Sensitive fields to redact from logs and reports.
 */
const SENSITIVE_KEY_REGEX = /password|token|secret|authorization|cookie|apikey|api_key|access_token|jwt/i;

/**
 * Deeply sanitizes objects, arrays, and headers to prevent credential leakage.
 */
export function sanitizeData(data) {
    if (!data) return data;
    if (typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(sanitizeData);

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (SENSITIVE_KEY_REGEX.test(key)) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeData(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

/**
 * Safely extracts sanitized response headers.
 */
export function sanitizeHeaders(headers) {
    if (!headers) return {};
    const safe = {};
    const allowHeaders = ['content-type', 'content-length', 'date', 'server', 'x-request-id', 'etag'];
    const entries = typeof headers.entries === 'function' ? headers.entries() : Object.entries(headers);

    for (const [key, value] of entries) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEY_REGEX.test(lowerKey)) {
            safe[lowerKey] = '[REDACTED]';
        } else if (allowHeaders.includes(lowerKey) || lowerKey.startsWith('x-')) {
            safe[lowerKey] = value;
        }
    }
    return safe;
}

/**
 * Determines whether the failure source is AI Engine, CATI Backend, Network, or Test Runner.
 */
export function determineErrorSource({ protocol, endpoint = '', status, error, responseBody }) {
    const errorText = String(error?.message || error || '').toLowerCase();
    const bodyText = typeof responseBody === 'string' ? responseBody.toLowerCase() : JSON.stringify(responseBody || '').toLowerCase();
    const urlText = String(endpoint).toLowerCase();

    // 1. Network connectivity / DNS / refusal
    if (
        errorText.includes('econnrefused') ||
        errorText.includes('enotfound') ||
        errorText.includes('etimedout') ||
        errorText.includes('socket hang up') ||
        errorText.includes('connection refused')
    ) {
        return 'Network';
    }

    // 2. Direct external AI Engine host interaction
    if (urlText.includes('sslip.io') || urlText.includes('ai_engine')) {
        return 'AI Engine';
    }

    // 3. AI Engine signatures inside response body
    if (
        bodyText.includes('ai engine') ||
        bodyText.includes('ai-engine') ||
        bodyText.includes('llm') ||
        bodyText.includes('openai') ||
        bodyText.includes('whisper') ||
        bodyText.includes('groq') ||
        bodyText.includes('tts') ||
        bodyText.includes('stt') ||
        bodyText.includes('vobiz')
    ) {
        return 'AI Engine';
    }

    // 4. HTTP status attribution for proxy/gateway
    if (status === 502 || status === 503 || status === 504) {
        return 'AI Engine'; // Upstream AI Engine unreachable or timed out
    }

    if (status === 401 || status === 403) {
        return 'CATI Backend'; // Authentication / authorization happens at CATI API layer
    }

    if (status === 400 || status === 422) {
        // Request validation failed at CATI Backend layer
        return 'CATI Backend';
    }

    if (status === 404) {
        // Route not found or entity not found
        return 'CATI Backend';
    }

    if (status >= 500) {
        return 'CATI Backend';
    }

    return 'AI Engine';
}

/**
 * Captures, formats, and attaches structured AI Engine HTTP evidence.
 *
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright TestInfo object
 * @param {object} options
 * @param {string} options.method - HTTP method (GET, POST, etc.)
 * @param {string} options.endpoint - API endpoint or full URL
 * @param {number} [options.expectedStatus] - Status code expected by test
 * @param {number} [options.actualStatus] - Actual status received
 * @param {number} [options.durationMs] - Execution duration in ms
 * @param {any} [options.requestPayload] - Request body or params
 * @param {any} [options.responseBody] - Raw or parsed response body
 * @param {object} [options.responseHeaders] - Response headers
 * @param {string|Error} [options.error] - Error message or object
 * @param {boolean} [options.expected=false] - Whether this error was an expected test condition
 */
export async function captureAiHttpEvidence(testInfo, {
    method = 'GET',
    endpoint = '',
    expectedStatus = 200,
    actualStatus = null,
    durationMs = 0,
    requestPayload = null,
    responseBody = null,
    responseHeaders = {},
    error = null,
    expected = false,
} = {}) {
    if (!testInfo) return null;

    const source = determineErrorSource({
        protocol: 'HTTP',
        endpoint,
        status: actualStatus,
        error,
        responseBody,
    });

    const isErrorCondition = (actualStatus && actualStatus >= 400) || Boolean(error);
    const testStatus = actualStatus === expectedStatus ? 'PASS' : (isErrorCondition ? 'FAIL' : 'UNKNOWN');

    const evidence = {
        test: testInfo.title || 'Unknown Test',
        source,
        protocol: 'HTTP',
        endpoint,
        method: method.toUpperCase(),
        timestamp: new Date().toISOString(),
        durationMs: Number(durationMs) || 0,
        expectedStatus,
        actualStatus: actualStatus !== null ? Number(actualStatus) : null,
        error: error ? (error.message || String(error)) : (actualStatus >= 400 ? `HTTP ${actualStatus}` : null),
        expected: Boolean(expected),
        headers: sanitizeHeaders(responseHeaders),
        request: sanitizeData(requestPayload),
        response: sanitizeData(responseBody),
        classification: actualStatus === 401 ? 'Authentication'
            : actualStatus === 403 ? 'Authorization'
            : actualStatus === 400 || actualStatus === 422 ? 'Validation'
            : source === 'AI Engine' ? 'AI Engine'
            : 'API',
    };

    try {
        // 1. Structured AI Engine attachment
        await testInfo.attach('AI Engine Error Evidence', {
            contentType: 'application/json',
            body: JSON.stringify(evidence, null, 2),
        });

        // 2. Backward-compatible API Call Evidence attachment
        await testInfo.attach('API Call Evidence', {
            contentType: 'application/json',
            body: JSON.stringify({
                method: evidence.method,
                endpoint: evidence.endpoint,
                expectedStatus: evidence.expectedStatus,
                actualStatus: evidence.actualStatus,
                durationMs: `${evidence.durationMs}ms`,
                request: evidence.request,
                response: evidence.response,
                source: evidence.source,
                expected: evidence.expected,
            }, null, 2),
        });
    } catch {
        // Safe fallback if attachment fails
    }

    return evidence;
}

/**
 * Captures, formats, and attaches structured AI Engine WebSocket evidence.
 *
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright TestInfo object
 * @param {object} options
 * @param {string} options.endpoint - WebSocket endpoint URL
 * @param {string} options.step - Test step name
 * @param {string} [options.connectionStatus] - 'connected' | 'rejected' | 'closed' | 'error'
 * @param {number} [options.handshakeStatus] - HTTP upgrade status (101, 401, etc.)
 * @param {number} [options.closeCode] - WS close code (1000, 1006, 1008, 1011, etc.)
 * @param {string} [options.closeReason] - WS close reason text
 * @param {any} [options.errorFrame] - Server error frame payload
 * @param {Array} [options.messageHistory] - Sent and received messages
 * @param {string|Error} [options.error] - Error message or exception
 * @param {boolean} [options.expected=false] - Whether this error was expected
 */
export async function captureAiWsEvidence(testInfo, {
    endpoint = '',
    step = 'interaction',
    connectionStatus = 'unknown',
    handshakeStatus = null,
    closeCode = null,
    closeReason = '',
    errorFrame = null,
    messageHistory = [],
    error = null,
    expected = false,
} = {}) {
    if (!testInfo) return null;

    const source = determineErrorSource({
        protocol: 'WebSocket',
        endpoint,
        status: handshakeStatus,
        error: error || closeReason,
        responseBody: errorFrame,
    });

    const evidence = {
        test: testInfo.title || 'Unknown Test',
        source,
        protocol: 'WebSocket',
        endpoint,
        step,
        timestamp: new Date().toISOString(),
        connectionStatus,
        handshakeStatus: handshakeStatus !== null ? Number(handshakeStatus) : null,
        closeCode: closeCode !== null ? Number(closeCode) : null,
        closeReason: closeReason ? String(closeReason) : '',
        errorFrame: sanitizeData(errorFrame),
        messageHistory: sanitizeData(messageHistory),
        error: error ? (error.message || String(error)) : (closeCode && closeCode !== 1000 ? `WS close ${closeCode}: ${closeReason}` : null),
        expected: Boolean(expected),
        classification: handshakeStatus === 401 || closeCode === 1008 ? 'Authentication'
            : source === 'AI Engine' ? 'AI Engine'
            : 'WebSocket',
    };

    try {
        // 1. Structured AI Engine Error Evidence
        await testInfo.attach('AI Engine Error Evidence', {
            contentType: 'application/json',
            body: JSON.stringify(evidence, null, 2),
        });

        // 2. Backward-compatible WebSocket Evidence
        await testInfo.attach('WebSocket Evidence', {
            contentType: 'application/json',
            body: JSON.stringify({
                endpoint: evidence.endpoint,
                step: evidence.step,
                connectionStatus: evidence.connectionStatus,
                handshakeStatus: evidence.handshakeStatus,
                closeCode: evidence.closeCode,
                closeReason: evidence.closeReason,
                errorFrame: evidence.errorFrame,
                error: evidence.error,
                source: evidence.source,
                expected: evidence.expected,
            }, null, 2),
        });
    } catch {
        // Safe fallback
    }

    return evidence;
}
