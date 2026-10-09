/**
 * Dedicated AI Engine Live Error Capture Verification Spec
 *
 * Implements Phase 21:
 * Validates with REAL network calls against the live AI Engine host:
 * 1. Playwright receives real AI Engine error responses.
 * 2. Error evidence is attached with all metadata (status, headers, body, duration).
 * 3. Sensitive values are completely redacted.
 * 4. Test passes when expected error was tested.
 * 5. Test fails when unexpected error occurs.
 * 6. WebSocket connection failures and close codes are captured.
 */

import { test, expect } from '../fixtures/api.fixture.js';
import { captureAiHttpEvidence, captureAiWsEvidence, sanitizeData, sanitizeHeaders } from '../../shared/aiErrorCapture.js';
import { openSocket, attachWsEvidence } from '../../websocket/helpers/wsClient.helper.js';

const LIVE_AI_ENGINE_HOST =
    process.env.AI_ENGINE_URL ||
    'https://fucr8ewyudjjbqlxhajoahpn.200.234.39.243.sslip.io';

const LIVE_AI_ENGINE_WS =
    process.env.AI_ENGINE_WS_URL ||
    'wss://fucr8ewyudjjbqlxhajoahpn.200.234.39.243.sslip.io';

test.describe('AI Engine Live Error Capture - Direct Validation', () => {
    test('1. live HTTP error capture - real 405 Method Not Allowed response captured as expected error evidence', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        // GET on /api/prebuild produces 405 Method Not Allowed on the live external AI engine
        const response = await apiContext.get(`${LIVE_AI_ENGINE_HOST}/api/prebuild`);
        const durationMs = Date.now() - start;
        const bodyText = await response.text();

        const evidence = await captureAiHttpEvidence(testInfo, {
            method: 'GET',
            endpoint: `${LIVE_AI_ENGINE_HOST}/api/prebuild`,
            expectedStatus: 405,
            actualStatus: response.status(),
            durationMs,
            responseBody: bodyText,
            responseHeaders: response.headers(),
            expected: true, // Expected error response
        });

        // 1. Verify real HTTP response code
        expect(response.status()).toBe(405);

        // 2. Verify evidence fields were populated correctly
        expect(evidence).not.toBeNull();
        expect(evidence.source).toBe('AI Engine');
        expect(evidence.protocol).toBe('HTTP');
        expect(evidence.actualStatus).toBe(405);
        expect(evidence.expected).toBe(true);
        expect(evidence.durationMs).toBeGreaterThan(0);
        expect(evidence.response).toBeTruthy();

        // 3. Verify Playwright attachment was created
        const attachment = testInfo.attachments.find((a) => a.name === 'AI Engine Error Evidence');
        expect(attachment).toBeDefined();
        expect(attachment.contentType).toBe('application/json');
    });

    test('2. live HTTP 404 capture - real nonexistent route error captured with response body and timing', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await apiContext.get(`${LIVE_AI_ENGINE_HOST}/nonexistent-qa-verification-route`);
        const durationMs = Date.now() - start;
        const bodyText = await response.text();

        const evidence = await captureAiHttpEvidence(testInfo, {
            method: 'GET',
            endpoint: `${LIVE_AI_ENGINE_HOST}/nonexistent-qa-verification-route`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: bodyText,
            responseHeaders: response.headers(),
            expected: true,
        });

        expect(response.status()).toBe(404);
        expect(evidence.source).toBe('AI Engine');
        expect(evidence.actualStatus).toBe(404);
        expect(evidence.expected).toBe(true);
    });

    test('3. sensitive data sanitization - tokens, passwords, and API keys are redacted', async ({}, testInfo) => {
        const sensitivePayload = {
            username: 'qa-tester',
            password: 'superSecretPassword123!',
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyPayload',
            apiKey: 'live-secret-key-abcdef',
            nested: {
                authorization: 'Bearer secret-jwt-here',
                regularField: 'safeValue',
            },
        };

        const sanitized = sanitizeData(sensitivePayload);

        expect(sanitized.password).toBe('[REDACTED]');
        expect(sanitized.token).toBe('[REDACTED]');
        expect(sanitized.apiKey).toBe('[REDACTED]');
        expect(sanitized.nested.authorization).toBe('[REDACTED]');
        expect(sanitized.nested.regularField).toBe('safeValue');
        expect(sanitized.username).toBe('qa-tester');

        // Test headers sanitization
        const headers = {
            'authorization': 'Bearer confidential',
            'content-type': 'application/json',
            'cookie': 'session_id=12345',
        };

        const safeHeaders = sanitizeHeaders(headers);
        expect(safeHeaders.authorization).toBe('[REDACTED]');
        expect(safeHeaders.cookie).toBe('[REDACTED]');
        expect(safeHeaders['content-type']).toBe('application/json');
    });

    test('4. live WebSocket connection error capture - handshake rejection captured as evidence', async ({}, testInfo) => {
        const testWsUrl = `${LIVE_AI_ENGINE_WS}/nonexistent-ws-endpoint`;
        let outcome = 'opened';
        let capturedError = null;

        try {
            await openSocket(testWsUrl, { timeoutMs: 5_000, testInfo });
        } catch (err) {
            outcome = 'rejected';
            capturedError = err;
        }

        const evidence = await captureAiWsEvidence(testInfo, {
            endpoint: testWsUrl,
            step: 'live-ws-handshake-failure',
            connectionStatus: outcome === 'opened' ? 'connected' : 'rejected',
            handshakeStatus: capturedError?.handshakeStatus || null,
            closeCode: capturedError?.closeCode || null,
            closeReason: capturedError?.closeReason || '',
            error: capturedError,
            expected: true, // Expected rejection
        });

        expect(outcome).toBe('rejected');
        expect(evidence).not.toBeNull();
        expect(evidence.protocol).toBe('WebSocket');
        expect(evidence.expected).toBe(true);

        const attachment = testInfo.attachments.find((a) => a.name === 'AI Engine Error Evidence');
        expect(attachment).toBeDefined();
    });
});
