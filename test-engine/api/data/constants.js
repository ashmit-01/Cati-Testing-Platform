/**
 * Safe test constants for API automated tests.
 *
 * DO NOT include secrets, passwords, production API keys, or live IDs in this file.
 * All sensitive credentials MUST be loaded from environment variables.
 */

// Valid 24-character hexadecimal MongoDB ObjectIds for schema validation testing
export const VALID_FAKE_OBJ_ID = '507f1f77bcf86cd799439011';
export const ANOTHER_VALID_OBJ_ID = '507f191e810c19729de860ea';

// Invalid ObjectId format (fails ObjectId schema validation)
export const INVALID_OBJ_ID = 'invalid-mongo-id-12345';

// Safe non-callable test numbers (E.164 reserved for documentation/testing)
export const SAFE_TEST_PHONE_NUMBER = '+15555550199';
export const SAFE_TEST_PHONE_NUMBER_ALT = '+15555550198';

// Minimal valid payload for creating an agent
export const MINIMAL_VALID_AGENT = {
    name: 'QA Automated Agent',
    prompt: 'You are a helpful customer service representative tested by automated QA.',
    agentType: 'support',
    language: 'en-US',
    ratePerMinute: 0.15,
};

// Edge-case and boundary agent payloads
export const INVALID_AGENT_NAME_TOO_SHORT = {
    name: 'QA', // minimum is 3 chars
    prompt: 'Valid prompt longer than ten characters for validation failure check.',
};

export const INVALID_AGENT_PROMPT_TOO_SHORT = {
    name: 'QA Valid Name',
    prompt: 'Short', // minimum is 10 chars
};

// Safe AI Query payload
export const SAFE_AI_QUERY = {
    text: 'What are your operating hours?',
};

// Sample CSV content for bulk upload testing (does not trigger calls)
export const SAMPLE_BULK_CSV_CONTENT = `name,phone,details
John Doe,+15555550101,Test contact 1
Jane Smith,+15555550102,Test contact 2
`;

// Boundary pagination constants
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
};
