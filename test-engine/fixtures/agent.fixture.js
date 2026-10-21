/**
 * Reusable Test Agent Fixture
 *
 * Implements Phase 12 requirements:
 * - Dynamic test agent lifecycle: login -> create test agent -> run AI tests -> cleanup
 * - Unique test agent per test (isolated, no cross-test pollution)
 * - Automatic cleanup in finally block even if assertions fail
 * - No hardcoded production agent IDs
 * - Graceful skip reporting if credentials/backend are unavailable
 */

import { test as baseTest, expect as baseExpect } from '../api/fixtures/api.fixture.js';
import * as agentsHelper from '../api/helpers/agents.helper.js';

export const DEFAULT_TEST_AGENT_PAYLOAD = {
    name: 'QA Dynamic Test Agent',
    prompt: 'You are an automated QA test agent. Your greeting is: Hello, welcome to automated QA support. You provide helpful and accurate assistance.',
    agentType: 'support',
    language: 'en-US',
    ratePerMinute: 0.15,
};

/**
 * Creates an isolated test agent via CATI Backend API.
 */
export async function createTestAgent(context, customOverrides = {}) {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload = {
        ...DEFAULT_TEST_AGENT_PAYLOAD,
        name: `QA Agent ${uniqueSuffix}`,
        ...customOverrides,
    };

    const response = await agentsHelper.createAgent(context, payload);
    if (!response.ok()) {
        const body = await response.text();
        throw new Error(`Failed to create test agent (HTTP ${response.status()}): ${body}`);
    }

    const json = await response.json();
    const agent = json.agent || json.data || json;
    const id = agent.id || agent._id;

    if (!id) {
        throw new Error('Created agent did not return an id or _id field: ' + JSON.stringify(json));
    }

    return {
        id,
        _id: id,
        name: payload.name,
        prompt: payload.prompt,
        agentType: payload.agentType,
        language: payload.language,
        raw: agent,
    };
}

/**
 * Safely cleans up a test agent. Does not throw if deletion fails.
 */
export async function deleteTestAgent(context, agentId) {
    if (!agentId || !context) return;
    try {
        await agentsHelper.deleteAgent(context, agentId);
    } catch {
        // Safe teardown fallback
    }
}

/**
 * Extended Playwright test with `testAgent` fixture.
 */
export const test = baseTest.extend({
    testAgent: async ({ authContext }, use, testInfo) => {
        // Check if explicit TEST_AGENT_ID exists in environment and should be used
        const envAgentId = process.env.TEST_AGENT_ID;

        let createdAgent = null;

        if (envAgentId) {
            // Use environment-configured agent
            await use({
                id: envAgentId,
                _id: envAgentId,
                name: 'Environment Configured Agent',
                isDynamicallyCreated: false,
            });
            return;
        }

        // Dynamically create a unique test agent for this test
        try {
            createdAgent = await createTestAgent(authContext);
            createdAgent.isDynamicallyCreated = true;
        } catch (err) {
            testInfo.skip(
                true,
                `Could not provision dynamic test agent: ${err.message}. Ensure backend is running and TEST_EMAIL/TEST_PASSWORD are valid.`
            );
            return;
        }

        try {
            await use(createdAgent);
        } finally {
            // Guaranteed cleanup even if assertions fail
            if (createdAgent?.id && createdAgent.isDynamicallyCreated) {
                await deleteTestAgent(authContext, createdAgent.id);
            }
        }
    },
});

export const expect = baseExpect;
