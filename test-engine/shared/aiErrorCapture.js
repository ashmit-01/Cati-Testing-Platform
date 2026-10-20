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
 * - Centralized ANSI terminal formatting code cleanup and secret redaction
 * - Structured context generation for LLM failure analysis
 */

/**
 * Sensitive fields to redact from logs and reports.
 */
const SENSITIVE_KEY_REGEX = /password|token|secret|authorization|cookie|apikey|api_key|access_token|jwt/i;

/**
 * Comprehensive ANSI escape sequence regex.
 * Matches:
 * 1. Standard CSI sequences: ESC [ ... [a-zA-Z]
 * 2. OSC sequences: ESC ] ... (BEL | ESC \)
 * 3. Standard 2-character ESC sequences: ESC [@-Z\\-_], ESC [0-9a-zA-Z#%()]
 * 4. Literal string representations: "\\u001b[...m", "\\x1b[...m"
 * 5. Naked/visible SGR formatting sequences that lost their escape prefix: "[2m", "[31m", "[39m", "[22m", etc.
 */
const ANSI_PATTERN = /(?:\\u001b|\\x1b|\u001b|\x1b)(?:\[[0-9;?]*[a-zA-Z]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_]|[0-9a-zA-Z#%()]|)|\[\d+(?:;\d+)*m/gi;

/**
 * Strips ANSI terminal formatting codes, real escape bytes, and orphaned visible SGR codes.
 *
 * @param {any} text - String or input to clean
 * @returns {string} Sanitized string without ANSI escapes
 */
export function stripAnsi(text) {
    if (text === null || text === undefined) return '';
    const str = typeof text === 'string' ? text : String(text);
    return str.replace(ANSI_PATTERN, '');
}

/**
 * Redacts secrets (passwords, tokens, API keys, cookies, auth headers) from plain text/strings.
 *
 * @param {string} text - Raw string
 * @returns {string} Redacted string
 */
export function redactSecretStrings(text) {
    if (!text || typeof text !== 'string') return text;
    return text
        // URL query parameter secrets: ?token=..., &password=..., &apikey=..., &api_key=..., &access_token=...
        .replace(/([?&](?:password|token|access_token|secret|apikey|api_key|auth)=)[^&\s]+/gi, '$1[REDACTED]')
        // Authorization Bearer/Basic headers: "Bearer ey...", "Basic dXNlcm5hbWU6..."
        .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9\-._~+/]+=*/gi, '$1 [REDACTED]')
        // Raw JSON Web Tokens (header.payload.signature)
        .replace(/\beyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]+/g, '[REDACTED_JWT]')
        // Cookie / header / key-value lines: "password: ...", "apiKey: ...", "cookie: session=...", etc.
        .replace(/((?:password|secret|apiKey|api_key|access_token|cookie)\s*[:=]\s*)[^\s"',;\r\n]+/gi, '$1[REDACTED]')
        .replace(/("?(?:password|token|secret|authorization|apiKey|api_key|access_token|cookie)"?\s*:\s*")([^"\r\n]+)(")/gi, '$1[REDACTED]$3');
}

/**
 * Robust, centralized error sanitization.
 *
 * - Removes ANSI CSI color and text-formatting sequences (colors, bold, dim, reset).
 * - Handles actual escape characters (\u001B, \x1B) and visible representations ([2m, [31m).
 * - Safely handles null, undefined, numbers, booleans, objects, Error instances.
 * - Normalizes unnecessary whitespace (line ends, excess blank lines) while preserving stack-trace structure.
 * - Preserves useful assertion details (Expected, Received, status codes, paths).
 * - Redacts sensitive tokens and secrets.
 *
 * @param {any} error - Error string, Error instance, or arbitrary object
 * @param {object} [options]
 * @param {boolean} [options.redactSecrets=true] - Whether to redact credentials
 * @param {boolean} [options.preserveStack=true] - Whether to include stack trace if available
 * @param {number} [options.maxStackLines=30] - Max lines of stack trace to prevent prompt explosion
 * @returns {string} Clean, human-readable error description
 */
export function sanitizeErrorText(error, {
    redactSecrets = true,
    preserveStack = true,
    maxStackLines = 30
} = {}) {
    if (error === null || error === undefined) return '';

    let text;
    if (typeof error === 'string') {
        text = error;
    } else if (error instanceof Error) {
        text = preserveStack && error.stack ? error.stack : error.message;
    } else if (typeof error === 'object') {
        if (preserveStack && error.stack) {
            text = String(error.stack);
        } else if (error.message) {
            text = String(error.message);
        } else {
            try {
                text = JSON.stringify(error, null, 2);
            } catch {
                text = String(error);
            }
        }
    } else {
        text = String(error);
    }

    // 1. Strip ANSI escape sequences and visible SGR brackets
    let cleaned = stripAnsi(text);

    // 2. Normalize carriage returns to standard newline
    cleaned = cleaned.replace(/\r\n?/g, '\n');

    // 3. Normalize whitespace without destroying indentation/structure
    const lines = cleaned.split('\n').map((line) => line.replace(/[ \t]+$/, ''));

    // Limit lines if stack trace is unusually long
    const limitedLines = maxStackLines && lines.length > maxStackLines
        ? [...lines.slice(0, maxStackLines), `    ... (${lines.length - maxStackLines} more lines truncated)`]
        : lines;

    cleaned = limitedLines.join('\n');

    // Collapse 3+ consecutive newlines to 2, trim outside
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    // 4. Redact credentials/secrets
    if (redactSecrets) {
        cleaned = redactSecretStrings(cleaned);
    }

    return cleaned;
}

/**
 * Extracts assertion details (expected, actual, errorType) from sanitized error text.
 *
 * @param {string|Error} text - Error message or stack trace
 * @returns {{ expected: any, actual: any, errorType: string|null }}
 */
export function parseAssertionDetails(text) {
    if (!text) return { expected: null, actual: null, errorType: null };
    const clean = stripAnsi(typeof text === 'string' ? text : String(text?.message || text));

    let expected = null;
    let actual = null;
    let errorType = null;

    if (clean.includes('AssertionError') || clean.includes('expect(')) {
        errorType = 'AssertionError';
    } else if (clean.includes('TimeoutError') || clean.includes('timed out')) {
        errorType = 'TimeoutError';
    }

    // Format: Expected: ... \n Received: ...
    const expectedMatch = clean.match(/Expected:\s*([^\r\n]+)/);
    const receivedMatch = clean.match(/Received:\s*([^\r\n]+)/);
    if (expectedMatch && receivedMatch) {
        expected = expectedMatch[1].trim();
        actual = receivedMatch[1].trim();
    }

    // Format: Expected pattern: ... \n Received string: ...
    if (!expected) {
        const patternMatch = clean.match(/Expected pattern:\s*([^\r\n]+)/);
        const receivedStrMatch = clean.match(/Received string:\s*"([^"]+)"/);
        if (patternMatch && receivedStrMatch) {
            expected = patternMatch[1].trim();
            actual = receivedStrMatch[1].trim();
        }
    }

    return { expected, actual, errorType };
}

/**
 * Builds structured, relevant, secret-redacted error context for LLM failure analysis.
 *
 * Adheres to Task 4 requirements:
 * - Terminal formatting noise is stripped.
 * - Relevant evidence preserved without huge unneeded stack dumps.
 * - Distinguishes observed facts from hypotheses (no premature assumption that 404 is missing route).
 * - Secrets (passwords, tokens, API keys, cookies, auth headers) redacted.
 * - Respects token and payload size budgets.
 *
 * @param {object} options
 * @param {object} [options.testResult] - Mongoose or raw TestResult object
 * @param {object} [options.failure] - Failure object
 * @param {object} [options.testInfo] - Playwright testInfo
 * @param {string} [options.testName] - Test name
 * @param {string} [options.testFile] - Test file / spec
 * @param {string} [options.suite] - Test suite
 * @param {string} [options.method] - HTTP method
 * @param {string} [options.endpoint] - API endpoint
 * @param {any} [options.expectedStatus] - Expected status code / value
 * @param {any} [options.actualStatus] - Actual status received
 * @param {string|Error} [options.error] - Error message or object
 * @param {string} [options.stack] - Stack trace
 * @param {object} [options.evidence] - Additional evidence
 * @param {string} [options.environment] - Environment
 * @returns {object} Structured LLM context
 */
export function buildLlmErrorContext({
    testResult = null,
    failure = null,
    testInfo = null,
    testName = '',
    testFile = '',
    suite = '',
    method = null,
    endpoint = null,
    expectedStatus = null,
    actualStatus = null,
    error = null,
    stack = null,
    evidence = null,
    environment = null
} = {}) {
    const name = testName || testResult?.testName || failure?.title || testInfo?.title || 'Unknown Test';
    const file = testFile || testResult?.page || failure?.testResultId?.page || 'Unknown Spec';
    const suiteName = suite || testResult?.suite || failure?.category || 'Unknown Suite';

    const rawErrorText = error || testResult?.error || failure?.description || '';
    const cleanError = sanitizeErrorText(rawErrorText, { redactSecrets: true, preserveStack: false });
    const rawStackCandidate = stack ||
        testResult?.evidence?.rawStack ||
        (typeof error === 'string' && error.includes('\n') ? error : null) ||
        (typeof testResult?.error === 'string' && testResult?.error.includes('\n') ? testResult.error : null);

    const cleanStack = rawStackCandidate
        ? sanitizeErrorText(rawStackCandidate, { redactSecrets: true, preserveStack: true, maxStackLines: 20 })
        : null;

    const assertionInfo = parseAssertionDetails(rawErrorText);
    const errorType = assertionInfo.errorType || (cleanError.includes('Timeout') ? 'TimeoutError' : 'AssertionError');

    // Extract endpoint and HTTP method
    const apiCallEvidence = evidence?.apiCall || testResult?.evidence?.apiCall || evidence?.request || testResult?.evidence?.request;
    const finalMethod = method || apiCallEvidence?.method || (name.match(/\b(GET|POST|PUT|PATCH|DELETE)\b/i)?.[1]?.toUpperCase()) || null;
    const finalEndpoint = endpoint || testResult?.endpoint || apiCallEvidence?.endpoint || (name.match(/\b(\/api\/[^\s]+)/)?.[1]) || null;

    // Status codes
    const expStatus = expectedStatus ?? testResult?.expected ?? assertionInfo.expected ?? null;
    const actStatus = actualStatus ?? testResult?.actual ?? assertionInfo.actual ?? null;

    // Concrete observed facts - purely observational, no speculation
    const observedFacts = [];
    if (finalMethod && finalEndpoint) {
        observedFacts.push(`Executed ${finalMethod} request to endpoint: ${finalEndpoint}`);
    }
    if (expStatus !== null && actStatus !== null) {
        observedFacts.push(`Observed HTTP status ${actStatus}; test assertion expected status ${expStatus}`);
    } else if (actStatus !== null) {
        observedFacts.push(`Observed HTTP status ${actStatus}`);
    }
    if (file) {
        observedFacts.push(`Failure occurred in test file: ${file}`);
    }
    if (cleanError) {
        observedFacts.push(`Failure message: ${cleanError.split('\n')[0]}`);
    }

    // Build concise, sanitized evidence object
    const rawEvidence = evidence || testResult?.evidence || failure?.evidence || {};
    const sanitizedEvidence = sanitizeData({
        apiCall: rawEvidence.apiCall || undefined,
        webSocket: rawEvidence.webSocket || undefined,
        aiEngineError: rawEvidence.aiEngineError || undefined,
        requests: rawEvidence.requests || undefined,
        responses: rawEvidence.responses || undefined,
    });

    const parsedExpected = expStatus !== null && !isNaN(Number(expStatus)) ? Number(expStatus) : expStatus;
    const parsedActual = actStatus !== null && !isNaN(Number(actStatus)) ? Number(actStatus) : actStatus;

    return {
        testName: name,
        testFile: file,
        suite: suiteName,
        method: finalMethod,
        endpoint: finalEndpoint,
        expectedStatus: parsedExpected,
        actualStatus: parsedActual,
        errorType,
        errorMessage: cleanError,
        stackTrace: cleanStack,
        observedFacts,
        environment: environment || testResult?.environment || process.env.TEST_ENV || 'unknown',
        evidence: sanitizedEvidence
    };
}

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
        } else if (typeof value === 'string') {
            sanitized[key] = redactSecretStrings(value);
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
            safe[lowerKey] = typeof value === 'string' ? redactSecretStrings(value) : value;
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

    const cleanError = error ? sanitizeErrorText(error) : (actualStatus >= 400 ? `HTTP ${actualStatus}` : null);
    const rawError = error ? String(error?.stack || error?.message || error) : null;

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
        error: cleanError,
        rawError,
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

    const cleanError = error ? sanitizeErrorText(error) : (closeCode && closeCode !== 1000 ? `WS close ${closeCode}: ${closeReason}` : null);
    const rawError = error ? String(error?.stack || error?.message || error) : null;

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
        error: cleanError,
        rawError,
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
