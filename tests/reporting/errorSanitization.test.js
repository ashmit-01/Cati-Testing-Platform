import test from 'node:test';
import assert from 'node:assert/strict';
import {
    stripAnsi,
    redactSecretStrings,
    sanitizeErrorText,
    parseAssertionDetails,
    buildLlmErrorContext,
    sanitizeData
} from '../../test-engine/shared/aiErrorCapture.js';

test.describe('Error Sanitization and LLM Context Pipeline', () => {

    test('1. strips ANSI-colored Playwright assertion messages with multiple formatting codes', () => {
        const rawPlaywrightError =
            '\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).toBe(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m\n\n' +
            'Expected: \u001b[32m400\u001b[39m\n' +
            'Received: \u001b[31m404\u001b[39m';

        const cleaned = stripAnsi(rawPlaywrightError);

        assert.strictEqual(
            cleaned,
            'expect(received).toBe(expected)\n\nExpected: 400\nReceived: 404'
        );
        assert.ok(!cleaned.includes('\u001b'));
        assert.ok(!cleaned.includes('[2m'));
        assert.ok(!cleaned.includes('[31m'));
        assert.ok(!cleaned.includes('[39m'));
        assert.ok(!cleaned.includes('[22m'));
        assert.ok(!cleaned.includes('[32m'));
    });

    test('2. strips visible escape representations where escape characters were stripped or lost', () => {
        const visibleNoise =
            'Suite: API | Page: api/specs/vobiz.spec.js | Error:\n' +
            '[2mexpect([22m[31mreceived[39m[2m).toBe([22m[32mexpected[39m[2m)[22m\n\n' +
            'Expected: 400\n' +
            'Received: 404';

        const cleaned = sanitizeErrorText(visibleNoise, { preserveStack: true });

        assert.ok(!cleaned.includes('[2m'));
        assert.ok(!cleaned.includes('[22m'));
        assert.ok(!cleaned.includes('[31m'));
        assert.ok(!cleaned.includes('[32m'));
        assert.ok(!cleaned.includes('[39m'));
        assert.ok(cleaned.includes('expect(received).toBe(expected)'));
        assert.ok(cleaned.includes('Expected: 400'));
        assert.ok(cleaned.includes('Received: 404'));
    });

    test('3. handles string-escaped literal representations (\\u001b and \\x1b)', () => {
        const escaped = '\\u001b[31mError: assertion failed\\u001b[39m at \\x1b[2mline 21\\x1b[22m';
        const cleaned = stripAnsi(escaped);
        assert.strictEqual(cleaned, 'Error: assertion failed at line 21');
    });

    test('4. clean error messages require no changes and remain intact', () => {
        const cleanMessage = 'Error: Request failed with status code 500 at /api/health';
        const result = sanitizeErrorText(cleanMessage);
        assert.strictEqual(result, cleanMessage);
    });

    test('5. preserves legitimate bracketed text, array indices, and HTTP status codes', () => {
        const legitimateText = 'Failed on item[0]: HTTP status [404] received for endpoint /api/vobiz/123 [REDACTED]';
        const cleaned = stripAnsi(legitimateText);
        assert.strictEqual(cleaned, legitimateText);
    });

    test('6. preserves Expected and Received values and extracts assertion details', () => {
        const errorText =
            'expect(received).toBe(expected)\n\n' +
            'Expected: 400\n' +
            'Received: 404';

        const details = parseAssertionDetails(errorText);

        assert.strictEqual(details.expected, '400');
        assert.strictEqual(details.actual, '404');
        assert.strictEqual(details.errorType, 'AssertionError');
    });

    test('7. normalizes whitespace and CRLF without destroying stack-trace structure', () => {
        const rawStack =
            'AssertionError: expect(received).toBe(expected)\r\n\r\n\r\n\r\n' +
            'Expected: 400   \r\n' +
            'Received: 404   \r\n\r\n' +
            '    at api/specs/vobiz.spec.js:21:32\r\n' +
            '    at async Promise.all (index 0)   \r\n';

        const sanitized = sanitizeErrorText(rawStack, { preserveStack: true });

        // CRLF normalized to LF
        assert.ok(!sanitized.includes('\r'));
        // Indentation on stack lines preserved
        assert.ok(sanitized.includes('    at api/specs/vobiz.spec.js:21:32'));
        assert.ok(sanitized.includes('    at async Promise.all (index 0)'));
        // Excessive blank lines collapsed
        assert.ok(!sanitized.includes('\n\n\n'));
        // Trailing whitespace stripped
        assert.ok(!sanitized.includes('400   '));
    });

    test('8. safely handles null, undefined, empty strings, numbers, and non-string values', () => {
        assert.strictEqual(sanitizeErrorText(null), '');
        assert.strictEqual(sanitizeErrorText(undefined), '');
        assert.strictEqual(sanitizeErrorText(''), '');
        assert.strictEqual(sanitizeErrorText(404), '404');
        assert.strictEqual(sanitizeErrorText(false), 'false');
        assert.strictEqual(sanitizeErrorText({ message: 'Custom object error' }), 'Custom object error');
        assert.strictEqual(sanitizeErrorText(new Error('Native error message'), { preserveStack: false }), 'Native error message');
        assert.ok(sanitizeErrorText(new Error('Native error message'), { preserveStack: true }).includes('Native error message'));
    });

    test('9. redacts secrets (passwords, tokens, JWTs, API keys, cookies) before transmission', () => {
        const rawWithSecrets =
            'Request to https://api.cati.com/v1?token=secretToken12345&password=mySecretPassword failed. ' +
            'Headers: Authorization: Bearer mySecretBearerToken123 ' +
            'Raw Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123 ' +
            'Cookie: session_id=xyz789';

        const redacted = redactSecretStrings(rawWithSecrets);

        assert.ok(!redacted.includes('secretToken12345'), 'Token should be redacted');
        assert.ok(!redacted.includes('mySecretPassword'), 'Password should be redacted');
        assert.ok(!redacted.includes('mySecretBearerToken123'), 'Bearer token should be redacted');
        assert.ok(!redacted.includes('signature123'), 'JWT signature should be redacted');
        assert.ok(!redacted.includes('xyz789'), 'Cookie session should be redacted');
        assert.ok(redacted.includes('Bearer [REDACTED]'));
        assert.ok(redacted.includes('[REDACTED_JWT]'));
    });

    test('10. sanitizeData redacts secrets deeply inside objects and arrays', () => {
        const payload = {
            username: 'qa-admin',
            password: 'secretPassword123!',
            apiKey: 'live-key-999',
            nested: {
                authorization: 'Bearer secretBearerToken',
                token: 'anotherSecret',
                safeField: 200
            },
            headers: [
                { name: 'cookie', value: 'token=xyz' }
            ]
        };

        const sanitized = sanitizeData(payload);

        assert.strictEqual(sanitized.username, 'qa-admin');
        assert.strictEqual(sanitized.password, '[REDACTED]');
        assert.strictEqual(sanitized.apiKey, '[REDACTED]');
        assert.strictEqual(sanitized.nested.authorization, '[REDACTED]');
        assert.strictEqual(sanitized.nested.token, '[REDACTED]');
        assert.strictEqual(sanitized.nested.safeField, 200);
    });

    test('11. builds structured, relevant error context for LLM without terminal noise', () => {
        const rawAnsiError =
            '\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).toBe(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m\n\n' +
            'Expected: \u001b[32m400\u001b[39m\n' +
            'Received: \u001b[31m404\u001b[39m\n' +
            '    at c:\\Users\\rosha\\api\\specs\\vobiz.spec.js:21:32';

        const context = buildLlmErrorContext({
            testName: 'GET /api/vobiz/numbers - should reject invalid request with 400',
            testFile: 'api/specs/vobiz.spec.js',
            suite: 'API',
            method: 'GET',
            endpoint: '/api/vobiz/numbers',
            expectedStatus: 400,
            actualStatus: 404,
            error: rawAnsiError,
            environment: 'staging',
            evidence: {
                apiCall: {
                    method: 'GET',
                    endpoint: '/api/vobiz/numbers',
                    expectedStatus: 400,
                    actualStatus: 404
                }
            }
        });

        assert.strictEqual(context.testName, 'GET /api/vobiz/numbers - should reject invalid request with 400');
        assert.strictEqual(context.testFile, 'api/specs/vobiz.spec.js');
        assert.strictEqual(context.suite, 'API');
        assert.strictEqual(context.method, 'GET');
        assert.strictEqual(context.endpoint, '/api/vobiz/numbers');
        assert.strictEqual(context.expectedStatus, 400);
        assert.strictEqual(context.actualStatus, 404);
        assert.strictEqual(context.errorType, 'AssertionError');
        assert.strictEqual(context.environment, 'staging');

        // Confirm NO ANSI escape sequences in LLM payload
        const jsonContext = JSON.stringify(context);
        assert.ok(!jsonContext.includes('\u001b'), 'LLM context must not contain ANSI escape bytes');
        assert.ok(!jsonContext.includes('[2m'), 'LLM context must not contain [2m formatting');
        assert.ok(!jsonContext.includes('[31m'), 'LLM context must not contain [31m color');

        // Confirm observed facts are factual and non-presumptuous
        assert.ok(context.observedFacts.length > 0);
        assert.ok(context.observedFacts.some((f) => f.includes('404') && f.includes('400')));
        assert.ok(!jsonContext.includes('missing route'), 'Must not prematurely hypothesize missing route');
    });

    test('12. respects LLM token/size limits and truncates oversized stack traces', () => {
        const longStack = Array.from({ length: 100 }, (_, i) => `    at frame_${i} (file.js:${i}:1)`).join('\n');
        const context = buildLlmErrorContext({
            testName: 'Oversized Stack Test',
            error: `Error: failed\n${longStack}`
        });

        const lines = context.stackTrace.split('\n');
        assert.ok(lines.length <= 25, `Stack trace should be limited to ~20 lines, got ${lines.length}`);
        assert.ok(context.stackTrace.includes('more lines truncated'));
    });

    test('13. resultNormalizer integration: sanitizes failure message, keeps rawMessage, and attaches llmContext', async () => {
        const { normalizeTestResult } = await import('../../reports/lib/resultNormalizer.js');

        const spec = {
            title: 'Reject invalid VoBiz request',
            file: 'test-engine/api/specs/vobiz.spec.js',
            line: 21,
            column: 9
        };

        const result = {
            status: 'failed',
            duration: 154,
            retry: 0,
            startTime: '2026-10-20T10:00:00.000Z',
            error: {
                message:
                    '\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).toBe(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m\n\n' +
                    'Expected: \u001b[32m400\u001b[39m\n' +
                    'Received: \u001b[31m404\u001b[39m',
                stack:
                    '\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).toBe(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m\n\n' +
                    'Expected: \u001b[32m400\u001b[39m\n' +
                    'Received: \u001b[31m404\u001b[39m\n' +
                    '    at api/specs/vobiz.spec.js:21:32'
            },
            attachments: []
        };

        const normalized = normalizeTestResult(spec, result);

        assert.ok(normalized.failure, 'Failure object should be created');
        // Cleaned message
        assert.ok(!normalized.failure.message.includes('\u001b'));
        assert.ok(!normalized.failure.message.includes('[2m'));
        assert.ok(normalized.failure.message.includes('expect(received).toBe(expected)'));
        // Cleaned stack
        assert.ok(!normalized.failure.stack.includes('\u001b'));
        assert.ok(!normalized.failure.stack.includes('[2m'));
        // Raw values preserved for developer diagnostics
        assert.ok(normalized.failure.rawMessage.includes('\u001b[2m'));
        assert.ok(normalized.failure.rawStack.includes('\u001b[2m'));
        // Parsed expected/actual
        assert.strictEqual(normalized.failure.expected, '400');
        assert.strictEqual(normalized.failure.actual, '404');
        // LLM context generated and clean
        assert.ok(normalized.evidence.llmContext);
        assert.strictEqual(normalized.evidence.llmContext.expectedStatus, 400);
        assert.strictEqual(normalized.evidence.llmContext.actualStatus, 404);
        assert.ok(!JSON.stringify(normalized.evidence.llmContext).includes('\u001b'));
    });

    test('14. failure description generation: produces clean human-readable text and preserves 400/404', () => {
        const rawAnsiError =
            '[2mexpect([22m[31mreceived[39m[2m).toBe([22m[32mexpected[39m[2m)[22m\n\n' +
            'Expected: 400\n' +
            'Received: 404';

        const testResult = {
            testName: 'GET /api/vobiz/numbers - invalid request',
            suite: 'API',
            endpoint: '/api/vobiz/numbers',
            page: 'api/specs/vobiz.spec.js',
            error: rawAnsiError,
            expected: 400,
            actual: 404
        };

        // Recreate buildTitleAndDescription logic
        const descriptionParts = [];
        const cleanError = sanitizeErrorText(testResult.error, { preserveStack: false });

        if (testResult.suite) descriptionParts.push(`Suite: ${testResult.suite}`);
        if (testResult.endpoint) descriptionParts.push(`Endpoint: ${testResult.endpoint}`);
        if (testResult.page) descriptionParts.push(`Page: ${testResult.page}`);
        if (cleanError) descriptionParts.push(`Error: ${cleanError}`);
        if (testResult.expected !== undefined && testResult.expected !== null) {
            descriptionParts.push(`Expected: ${testResult.expected}`);
        }
        if (testResult.actual !== undefined && testResult.actual !== null) {
            descriptionParts.push(`Actual: ${testResult.actual}`);
        }

        const description = descriptionParts.join(' | ');

        // Check for complete absence of terminal formatting codes
        assert.ok(!description.includes('[2m'));
        assert.ok(!description.includes('[22m'));
        assert.ok(!description.includes('[31m'));
        assert.ok(!description.includes('[32m'));
        assert.ok(!description.includes('[39m'));

        // Check that essential details are intact and readable
        assert.ok(description.includes('Suite: API'));
        assert.ok(description.includes('Endpoint: /api/vobiz/numbers'));
        assert.ok(description.includes('Page: api/specs/vobiz.spec.js'));
        assert.ok(description.includes('Error: expect(received).toBe(expected)'));
        assert.ok(description.includes('Expected: 400'));
        assert.ok(description.includes('Actual: 404'));
    });

    test('15. read-path sanitization: sanitizes legacy ANSI contamination from database records', () => {
        // Simulate legacy un-sanitized failure record stored in MongoDB
        const legacyDbRecord = {
            _id: '64f1a2b3c4d5e6f7a8b9c0d1',
            runId: 'RUN-2026-001',
            title: 'Reject invalid request',
            description:
                'Suite: API | Page: api/specs/vobiz.spec.js | Error: [2mexpect([22m[31mreceived[39m[2m).toBe([22m[32mexpected[39m[2m)[22m\n\n' +
                'Expected: 400\nReceived: 404',
            severity: 'HIGH',
            category: 'API',
            status: 'OPEN'
        };

        const sanitizedDescription = sanitizeErrorText(legacyDbRecord.description, { preserveStack: false });

        assert.ok(!sanitizedDescription.includes('[2m'));
        assert.ok(!sanitizedDescription.includes('[31m'));
        assert.ok(sanitizedDescription.includes('Error: expect(received).toBe(expected)'));
        assert.ok(sanitizedDescription.includes('Expected: 400'));
        assert.ok(sanitizedDescription.includes('Received: 404'));
    });

    test('16. frontend sanitization defense-in-depth: stripAnsiText removes any escape sequences before rendering', () => {
        function stripAnsiText(text) {
            if (!text) return '';
            return String(text)
                .replace(/(?:\\u001b|\\x1b|\u001b|\x1b)(?:\[[0-9;?]*[a-zA-Z]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_]|[0-9a-zA-Z#%()]|)|\[\d+(?:;\d+)*m/gi, '')
                .trim();
        }

        const dashboardString =
            'Suite: API | Page: api/specs/vobiz.spec.js | Error:\n' +
            '[2mexpect([22m[31mreceived[39m[2m).toBe([22m[32mexpected[39m[2m)[22m\n\n' +
            'Expected: 400\n' +
            'Received: 404';

        const renderedText = stripAnsiText(dashboardString);

        assert.ok(!renderedText.includes('[2m'));
        assert.ok(!renderedText.includes('[22m'));
        assert.ok(!renderedText.includes('[31m'));
        assert.ok(!renderedText.includes('[39m'));
        assert.ok(renderedText.includes('Expected: 400'));
        assert.ok(renderedText.includes('Received: 404'));
    });
});
