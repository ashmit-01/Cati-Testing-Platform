import { test, expect, attachApiEvidence } from '../fixtures/api.fixture.js';
import * as agentsHelper from '../helpers/agents.helper.js';
import {
    VALID_FAKE_OBJ_ID,
    INVALID_OBJ_ID,
    MINIMAL_VALID_AGENT,
    INVALID_AGENT_NAME_TOO_SHORT,
    INVALID_AGENT_PROMPT_TOO_SHORT,
} from '../data/constants.js';

test.describe('Agents API - Unauthorized Boundaries', () => {
    test('GET /api/agents - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.getAgents(apiContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/agents',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('POST /api/agents - should reject unauthenticated creation with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.createAgent(apiContext, MINIMAL_VALID_AGENT);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents',
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            requestBody: MINIMAL_VALID_AGENT,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });

    test('GET /api/agents/:id - should reject unauthenticated request with 401', async ({ apiContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.getAgent(apiContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/agents/${VALID_FAKE_OBJ_ID}`,
            expectedStatus: 401,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(401);
    });
});

test.describe('Agents API - Schema & Input Validation', () => {
    test('POST /api/agents - should reject creation with missing required fields', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = {};
        const response = await agentsHelper.createAgent(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/agents - should reject agent name shorter than 3 characters', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.createAgent(authContext, INVALID_AGENT_NAME_TOO_SHORT);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: INVALID_AGENT_NAME_TOO_SHORT,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/agents - should reject prompt shorter than 10 characters', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.createAgent(authContext, INVALID_AGENT_PROMPT_TOO_SHORT);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: INVALID_AGENT_PROMPT_TOO_SHORT,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/agents - should reject invalid agentType enum', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const payload = {
            ...MINIMAL_VALID_AGENT,
            agentType: 'invalid_type_enum',
        };
        const response = await agentsHelper.createAgent(authContext, payload);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            requestBody: payload,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('GET /api/agents/:id - should reject malformed ObjectId with 400', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.getAgent(authContext, INVALID_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/agents/${INVALID_OBJ_ID}`,
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('GET /api/agents/:id - should return 404 for valid non-existent ObjectId', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.getAgent(authContext, VALID_FAKE_OBJ_ID);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: `/api/agents/${VALID_FAKE_OBJ_ID}`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('PUT /api/agents/:id - should return 404 for non-existent ObjectId', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.updateAgent(authContext, VALID_FAKE_OBJ_ID, { name: 'New Name' });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'PUT',
            endpoint: `/api/agents/${VALID_FAKE_OBJ_ID}`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });
});

test.describe('Agents API - Full CRUD Lifecycle & Response Structure', () => {
    test('POST -> GET -> PUT -> Prompt Update -> Confirm -> DELETE agent lifecycle', async ({ authContext }, testInfo) => {
        let createdAgentId = null;

        try {
            // 1. CREATE AGENT
            const uniqueName = `Test Agent ${Date.now()}`;
            const createPayload = {
                name: uniqueName,
                prompt: 'You are an automated test agent created by automated tests.',
                agentType: 'sales',
                language: 'en-US',
                ratePerMinute: 0.20,
            };

            const createStart = Date.now();
            const createResponse = await agentsHelper.createAgent(authContext, createPayload);
            const createDuration = Date.now() - createStart;
            const createBody = await createResponse.json();

            await attachApiEvidence(testInfo, {
                method: 'POST',
                endpoint: '/api/agents',
                expectedStatus: 201,
                actualStatus: createResponse.status(),
                durationMs: createDuration,
                requestBody: createPayload,
                responseBody: createBody,
            });

            expect(createResponse.status()).toBe(201);
            expect(createBody).toHaveProperty('agent');
            expect(createBody.agent).toHaveProperty('id');
            expect(createBody.agent.name).toBe(uniqueName);
            expect(createBody.agent.status).toBe('active');

            createdAgentId = createBody.agent.id || createBody.agent._id;

            // 2. GET AGENT BY ID
            const getStart = Date.now();
            const getResponse = await agentsHelper.getAgent(authContext, createdAgentId);
            const getDuration = Date.now() - getStart;
            const getBody = await getResponse.json();

            await attachApiEvidence(testInfo, {
                method: 'GET',
                endpoint: `/api/agents/${createdAgentId}`,
                expectedStatus: 200,
                actualStatus: getResponse.status(),
                durationMs: getDuration,
                responseBody: getBody,
            });

            expect(getResponse.status()).toBe(200);
            expect(getBody).toHaveProperty('agent');
            expect(getBody.agent.name).toBe(uniqueName);

            // 3. UPDATE AGENT
            const updatePayload = {
                name: `${uniqueName} Updated`,
                ratePerMinute: 0.25,
            };

            const updateStart = Date.now();
            const updateResponse = await agentsHelper.updateAgent(authContext, createdAgentId, updatePayload);
            const updateDuration = Date.now() - updateStart;
            const updateBody = await updateResponse.json();

            await attachApiEvidence(testInfo, {
                method: 'PUT',
                endpoint: `/api/agents/${createdAgentId}`,
                expectedStatus: 200,
                actualStatus: updateResponse.status(),
                durationMs: updateDuration,
                requestBody: updatePayload,
                responseBody: updateBody,
            });

            expect(updateResponse.status()).toBe(200);

            // 4. GET SYSTEM PROMPT
            const promptResp = await agentsHelper.getSystemPrompt(authContext, createdAgentId);
            expect(promptResp.status()).toBe(200);

            // 5. UPDATE PROMPT (PUT /:id/prompt)
            const promptUpdateResp = await agentsHelper.updatePrompt(authContext, createdAgentId, {
                prompt: 'Updated system instructions for automated testing verification.'
            });
            expect(promptUpdateResp.status()).toBe(200);

            // 6. CONFIRM AGENT (PUT /:id/confirm)
            const confirmResp = await agentsHelper.confirmAgent(authContext, createdAgentId);
            expect(confirmResp.status()).toBe(200);

        } finally {
            // 7. CLEANUP / DELETE AGENT
            if (createdAgentId) {
                const deleteStart = Date.now();
                const deleteResponse = await agentsHelper.deleteAgent(authContext, createdAgentId);
                const deleteDuration = Date.now() - deleteStart;
                const deleteBody = await deleteResponse.json().catch(() => ({}));

                await attachApiEvidence(testInfo, {
                    method: 'DELETE',
                    endpoint: `/api/agents/${createdAgentId}`,
                    expectedStatus: 200,
                    actualStatus: deleteResponse.status(),
                    durationMs: deleteDuration,
                    responseBody: deleteBody,
                });

                expect(deleteResponse.status()).toBe(200);
            }
        }
    });

    test('GET /api/agents - should list all agents for authenticated user', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.getAgents(authContext);
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'GET',
            endpoint: '/api/agents',
            expectedStatus: 200,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(200);
        expect(body).toHaveProperty('agents');
        expect(Array.isArray(body.agents)).toBe(true);
    });
});

test.describe('Agents API - Prompt Operations Safety', () => {
    test('POST /api/agents/generate-prompt - should reject empty context payload', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.generatePrompt(authContext, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: '/api/agents/generate-prompt',
            expectedStatus: 400,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(400);
    });

    test('POST /api/agents/:id/ai-edit-prompt - should return 404 for non-existent agent', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.aiEditPrompt(authContext, VALID_FAKE_OBJ_ID, { instructions: 'Make friendly' });
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: `/api/agents/${VALID_FAKE_OBJ_ID}/ai-edit-prompt`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });

    test('POST /api/agents/:id/regenerate-prompt - should return 404 for non-existent agent', async ({ authContext }, testInfo) => {
        const start = Date.now();
        const response = await agentsHelper.regeneratePrompt(authContext, VALID_FAKE_OBJ_ID, {});
        const durationMs = Date.now() - start;
        const body = await response.json().catch(() => ({}));

        await attachApiEvidence(testInfo, {
            method: 'POST',
            endpoint: `/api/agents/${VALID_FAKE_OBJ_ID}/regenerate-prompt`,
            expectedStatus: 404,
            actualStatus: response.status(),
            durationMs,
            responseBody: body,
        });

        expect(response.status()).toBe(404);
    });
});
