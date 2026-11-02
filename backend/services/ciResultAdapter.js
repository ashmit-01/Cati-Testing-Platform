
const SUITE_PATTERNS = [
    { pattern: /websocket/i, suite: 'WEBSOCKET' },
    { pattern: /ai[\\/_-]/i, suite: 'AI_VOICE' },
    { pattern: /voice/i, suite: 'AI_VOICE' },
    { pattern: /api/i, suite: 'API' },
    { pattern: /e2e/i, suite: 'E2E' },
    { pattern: /ui/i, suite: 'UI' },
];

function detectSuite(file = '') {
    const normalized = String(file).replace(/\\/g, '/');

    for (const item of SUITE_PATTERNS) {
        if (item.pattern.test(normalized)) {
            return item.suite;
        }
    }

    // Default for browser-based specs without a recognized folder.
    return 'UI';
}

function mapStatus(status, failure) {
    const value = String(status || '').toLowerCase();

    if (failure || ['failed', 'timedout', 'interrupted'].includes(value)) {
        return 'FAIL';
    }

    if (value === 'passed') {
        return 'PASS';
    }

    if (value === 'skipped') {
        return 'SKIPPED';
    }

    throw new Error(`Unsupported Playwright test status: ${status}`);
}

function stringifyEvidence(value) {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function extractEndpoint(evidence = {}) {
    if (evidence.apiCall?.endpoint) {
        return evidence.apiCall.endpoint;
    }

    if (Array.isArray(evidence.requests)) {
        return evidence.requests[0]?.endpoint || null;
    }

    return null;
}

function normalizeEvidence(evidence = {}) {
    return {
        // GitHub runner paths are deliberately not stored as usable URLs.
        // They will be replaced with persistent storage URLs in a later step.
        screenshot: null,
        video: null,
        trace: null,

        consoleLogs: stringifyEvidence(evidence.consoleLogs),
        networkInfo: stringifyEvidence({
            requests: evidence.requests || [],
            responses: evidence.responses || [],
            apiCall: evidence.apiCall || null,
            aiEngineError: evidence.aiEngineError || null,
            errorContext: evidence.errorContext || null,
        }),

        request: evidence.requests?.[0] || null,
        response: evidence.responses?.[0] || null,
        websocketLogs: evidence.webSocket || null,

        // Additional structured evidence is retained because the evidence
        // schema is extensible.
        errorContext: evidence.errorContext || null,
        aiEngineError: evidence.aiEngineError || null,
        apiCall: evidence.apiCall || null,
        requests: evidence.requests || [],
        responses: evidence.responses || [],
    };
}

/**
 * Converts one normalized Playwright result into the backend TestResult format.
 */
export function adaptCiResult(item, environment) {
    if (!item?.test || !item?.result) {
        throw new Error('Invalid CI result: test or result information is missing.');
    }

    const testName = item.test.title;

    if (!testName) {
        throw new Error('Invalid CI result: test title is missing.');
    }

    const suite = detectSuite(item.test.file);
    const status = mapStatus(item.result.status, item.failure);

    const failure = item.failure || null;

    return {
        testCaseId: null,

        testName,
        suite,
        status,

        duration: Number(item.result.duration) || 0,

        error: failure?.message || null,
        stackTrace: failure?.stack || null,

        expected: failure?.expected ?? null,
        actual: failure?.actual ?? null,

        endpoint: extractEndpoint(item.evidence),
        page: item.test.file || null,

        evidence: normalizeEvidence(item.evidence),

        environment: environment || item.result.environment || 'unknown',
    };
}

/**
 * Converts the complete generated QA report into backend-compatible results.
 */
export function adaptCiReport(report) {
    if (!report || !Array.isArray(report.results)) {
        throw new Error('Invalid CI report: results array is missing.');
    }

    if (report.results.length === 0) {
        throw new Error('CI report contains no test results.');
    }

    const environment = report.environment || 'unknown';

    const results = report.results.map((item, index) => {
        try {
            return adaptCiResult(item, environment);
        } catch (error) {
            throw new Error(
                `Failed to normalize CI result at index ${index}: ${error.message}`
            );
        }
    });

    return {
        environment,
        url: report.url || null,
        generatedAt: report.generatedAt || null,
        results,
    };
}
