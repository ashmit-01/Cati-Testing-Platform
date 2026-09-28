import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as analyticsHelper from '../helpers/analytics.helper.js';

test.describe('Analytics API - Unauthorized Boundaries', () => {
    test('GET /api/analytics/overview - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await analyticsHelper.getOverview(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/overview',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/analytics/calls-per-day - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await analyticsHelper.getCallsPerDay(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/calls-per-day',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/analytics/calls-per-agent - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await analyticsHelper.getCallsPerAgent(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/calls-per-agent',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/analytics/recent-calls - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await analyticsHelper.getRecentCalls(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/recent-calls',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });
});

test.describe('Analytics API - Authenticated Endpoints & Schema Validation', () => {
    test('GET /api/analytics/overview - should return valid overview statistics schema', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await analyticsHelper.getOverview(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/overview',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('totalCalls');
        expect(body).toHaveProperty('completedCalls');
        expect(body).toHaveProperty('failedCalls');
        expect(body).toHaveProperty('totalMinutes');
        expect(body).toHaveProperty('totalCost');
        expect(body).toHaveProperty('totalCreditsUsed');
        expect(body).toHaveProperty('avgCallDuration');
        expect(body).toHaveProperty('totalAgents');
        expect(typeof body.totalCalls).toBe('number');
        expect(typeof body.totalAgents).toBe('number');
    });

    test('GET /api/analytics/overview - should support ISO date query filtering', async ({ authContext }, testInfo) => {
        const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const to = new Date().toISOString();

        const start = Date.now();
        const response = await analyticsHelper.getOverview(authContext, { from, to });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/overview?from=...&to=...',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(typeof body.totalCalls).toBe('number');
    });

    test('GET /api/analytics/calls-per-day - should return days array with default 30 days', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await analyticsHelper.getCallsPerDay(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/calls-per-day',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('days');
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.days).toBe(30);
    });

    test('GET /api/analytics/calls-per-day - should support custom days parameter', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await analyticsHelper.getCallsPerDay(authContext, { days: 7 });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/calls-per-day?days=7',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body.days).toBe(7);
        expect(Array.isArray(body.data)).toBe(true);
    });

    test('GET /api/analytics/calls-per-agent - should return agents list with success metrics', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await analyticsHelper.getCallsPerAgent(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/calls-per-agent',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('agents');
        expect(Array.isArray(body.agents)).toBe(true);
    });

    test('GET /api/analytics/recent-calls - should return calls array with default limit 20', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await analyticsHelper.getRecentCalls(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/recent-calls',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('calls');
        expect(Array.isArray(body.calls)).toBe(true);
        expect(body.calls.length).toBeLessThanOrEqual(20);
    });

    test('GET /api/analytics/recent-calls - should support custom limit parameter', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await analyticsHelper.getRecentCalls(authContext, { limit: 5 });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/analytics/recent-calls?limit=5',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('calls');
        expect(Array.isArray(body.calls)).toBe(true);
        expect(body.calls.length).toBeLessThanOrEqual(5);
    });
});
