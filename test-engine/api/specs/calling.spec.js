import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as callingHelper from '../helpers/calling.helper.js';
import { VALID_FAKE_OBJ_ID, INVALID_OBJ_ID, SAMPLE_BULK_CSV_CONTENT } from '../data/constants.js';

test.describe('Calling API - Unauthorized Boundaries', () => {
    test('POST /api/calling/single - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { to: '+15555550199', agentId: VALID_FAKE_OBJ_ID };
        const response = await callingHelper.singleCall(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calling/single',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('POST /api/calling/bulk/upload - should reject unauthenticated upload with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.uploadBulkFile(apiContext, {
            file: {
                name: 'test.csv',
                mimeType: 'text/csv',
                buffer: Buffer.from(SAMPLE_BULK_CSV_CONTENT),
            },
        });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calling/bulk/upload',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/calling/campaigns - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.getCampaigns(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/calling/campaigns',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/calling/campaigns/leads-campaign - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.getLeadsCampaign(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/calling/campaigns/leads-campaign',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('PUT /api/calling/campaigns/leads-campaign/settings - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const payload = { whatsappLeadParsingEnabled: true };
        const response = await callingHelper.updateLeadsCampaignSettings(apiContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'PUT',
            endpoint: '/api/calling/campaigns/leads-campaign/settings',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });
});

test.describe('Calling API - Safe Bulk Upload & File Parsing', () => {
    test('POST /api/calling/bulk/upload - should parse valid CSV file without initiating calls', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.uploadBulkFile(authContext, {
            file: {
                name: 'contacts.csv',
                mimeType: 'text/csv',
                buffer: Buffer.from(SAMPLE_BULK_CSV_CONTENT),
            },
        });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calling/bulk/upload',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('success', true);
        // Verified from routes/calling.js line 661: response property is 'total'
        expect(body).toHaveProperty('total');
        expect(body).toHaveProperty('contacts');
        expect(typeof body.total).toBe('number');
    });

    test('POST /api/calling/bulk/upload - should reject missing file upload with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await authContext.post('/api/calling/bulk/upload');
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calling/bulk/upload',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });
});

test.describe('Calling API - Campaigns Lifecycle & Settings', () => {
    test('GET /api/calling/campaigns - should return campaigns list for authenticated user', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.getCampaigns(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/calling/campaigns',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('campaigns');
    });

    test('GET /api/calling/campaigns/:id - should return 404 for non-existent campaign', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.getCampaign(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/calling/campaigns/${VALID_FAKE_OBJ_ID}`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('POST /api/calling/campaigns/:id/stop - should return 404 for non-existent campaign', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.stopCampaign(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: `/api/calling/campaigns/${VALID_FAKE_OBJ_ID}/stop`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('DELETE /api/calling/campaigns/:id - should return 404 for non-existent campaign', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.deleteCampaign(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'DELETE',
            endpoint: `/api/calling/campaigns/${VALID_FAKE_OBJ_ID}`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('POST /api/calling/campaigns/schedule-lead - should reject missing contactId with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.scheduleLead(authContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calling/campaigns/schedule-lead',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/calling/campaigns/cancel-lead-schedule - should reject missing contactId with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.cancelLeadSchedule(authContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calling/campaigns/cancel-lead-schedule',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('GET /api/calling/campaigns/leads-campaign - should return default leads campaign or prompt agent creation', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await callingHelper.getLeadsCampaign(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/calling/campaigns/leads-campaign',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        // 200 if campaign or active agent exists, or 400 "Please create an AI Agent first before viewing leads."
        expect([200, 400]).toContain(response.status());
        if (response.status() === 200) {
            expect(body).toHaveProperty('success', true);
            expect(body).toHaveProperty('campaign');
        }
    });

    test('PUT /api/calling/campaigns/leads-campaign/settings - should return 404 when configured with non-existent agentId', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = {
            agentId: VALID_FAKE_OBJ_ID,
            whatsappLeadParsingEnabled: true,
        };
        const response = await callingHelper.updateLeadsCampaignSettings(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'PUT',
            endpoint: '/api/calling/campaigns/leads-campaign/settings',
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });
});

test.describe('Calling API - Security & Telephony Safety Guards', () => {
    test('POST /api/calling/single - should reject missing agentId with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = { to: '+15555550199' };
        const response = await callingHelper.singleCall(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calling/single',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/calling/single - should reject missing phone number (to) with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = { agentId: VALID_FAKE_OBJ_ID };
        const response = await callingHelper.singleCall(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calling/single',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    /**
     * CROSS-USER SECURITY REGRESSION TEST:
     * Validates that POST /api/calling/single enforces strict agent ownership.
     * User B (Attacker) attempting to use User A's agent must be rejected with 403 Forbidden
     * BEFORE reaching wallet deduction, telephony providers, or call initiation.
     */
    test('POST /api/calling/single - cross-user security regression: rejects unauthorized agent usage with 403 Forbidden', async ({ authContext, playwright }, testInfo) => {
        // 1. Create an agent belonging to User A
        const agentPayload = { name: 'User A Agent', prompt: 'Owner agent prompt', voice: 'echo' };
        const agentResp = await authContext.post('/api/agents', { data: agentPayload });
        const agentBody = await agentResp.json().catch(() => ({}));
        const agentId = agentBody.agent?._id || agentBody._id || VALID_FAKE_OBJ_ID;

        // 2. Create and authenticate User B (Attacker) independently
        const userBEmail = `attacker-${Date.now()}@example.com`;
        const userBPassword = 'AttackerPassword123!';
        const baseURL = process.env.BACKEND_URL || 'http://localhost:5000';
        
        const attackerApiContext = await playwright.request.newContext({ 
            baseURL, 
            extraHTTPHeaders: { 'Accept': 'application/json', 'Content-Type': 'application/json' } 
        });
        
        await attackerApiContext.post('/api/auth/signup', {
            data: { email: userBEmail, password: userBPassword, name: 'Attacker' }
        });
        
        const loginResp = await attackerApiContext.post('/api/auth/login', {
            data: { email: userBEmail, password: userBPassword }
        });
        const loginBody = await loginResp.json().catch(() => ({}));
        const attackerToken = loginBody.token || 'fake-token';

        const attackerContext = await playwright.request.newContext({
            baseURL,
            extraHTTPHeaders: {
                'Authorization': `Bearer ${attackerToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });

        // 3. User B (Attacker) attempts to initiate a call using User A's agent ID
        // Uses safe synthetic phone number without live telephony authorization
        const start = Date.now();
        const payload = {
            to: '+15555550199',
            agentId,
        };
        const response = await callingHelper.singleCall(attackerContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calling/single',
            expectedStatus: 403,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        // 4. Assert strict 403 Forbidden rejection before wallet/telephony execution
        expect(response.status()).toBe(403);
        expect(body).toHaveProperty('error', 'Forbidden');
        expect(body).toHaveProperty('message', 'You do not have access to this agent');

        // Cleanup contexts
        await attackerApiContext.dispose();
        await attackerContext.dispose();
    });

    /**
     * POSITIVE AUTHORIZATION BOUNDARY TEST:
     * Validates that an authenticated owner can still access their own agent.
     * The ownership check passes and allows execution to proceed to wallet/call validation.
     */
    test('POST /api/calling/single - owner authorization boundary: authenticated owner is allowed access to their own agent', async ({ authContext }, testInfo) => {
        // 1. Create an agent belonging to User A
        const agentPayload = { name: 'User A Self Agent', prompt: 'Self agent prompt', voice: 'echo' };
        const agentResp = await authContext.post('/api/agents', { data: agentPayload });
        const agentBody = await agentResp.json().catch(() => ({}));
        const agentId = agentBody.agent?._id || agentBody._id || VALID_FAKE_OBJ_ID;

        // 2. User A invokes POST /api/calling/single with their own agentId
        // Safe synthetic number; test does not enable ALLOW_REAL_CALLS
        const start = Date.now();
        const payload = {
            to: '+15555550199',
            agentId,
        };
        const response = await callingHelper.singleCall(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/calling/single',
            expectedStatus: 400, // Advances past ownership check to wallet balance (400 if insufficient)
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        // Crucial verification: Owner MUST NOT receive 403 Forbidden
        expect(response.status()).not.toBe(403);
        // Valid progression advances past ownership check to wallet balance or downstream handling
        expect([200, 400]).toContain(response.status());
    });

    test('POST /api/calling/bulk/start - live bulk call initiation is safely skipped by default', async () => {
        test.skip(
            process.env.ALLOW_REAL_CALLS !== 'true',
            'Skipped: Real bulk telephony tests require explicit authorization (ALLOW_REAL_CALLS=true)'
        );

        // This block only executes when user explicitly passes ALLOW_REAL_CALLS=true
    });
});
