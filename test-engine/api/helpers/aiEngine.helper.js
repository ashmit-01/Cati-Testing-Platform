/**
 * AI Engine domain helper.
 *
 * Contains HTTP request wrappers for the CATI backend /api/ai-engine routes
 * as well as direct AI Engine health/voices inspection endpoints.
 *
 * Adheres to:
 * - GET /api/ai-engine/providers
 * - POST /api/ai-engine/query
 * - POST /api/ai-engine/conversation
 * - Direct AI Engine health & status
 *
 * Contains NO assertions. Assertions belong in spec files.
 */

const AI_ENGINE_DIRECT_URL =
    process.env.AI_ENGINE_URL ||
    'https://fucr8ewyudjjbqlxhajoahpn.200.234.39.243.sslip.io';

/**
 * Times an async API call and captures any thrown network/transport error.
 */
export async function timedCall(callFn) {
    const start = Date.now();
    try {
        const response = await callFn();
        const durationMs = Date.now() - start;
        return { response, durationMs, error: null };
    } catch (error) {
        const durationMs = Date.now() - start;
        return { response: null, durationMs, error };
    }
}

/**
 * GET /api/ai-engine/providers
 * Fetches available AI engine providers, LLMs, STT, and TTS models.
 */
export async function getProviders(context, options = {}) {
    return context.get('/api/ai-engine/providers', options);
}

/**
 * POST /api/ai-engine/query
 * Queries the AI engine with agentId and input text.
 */
export async function query(context, payload, options = {}) {
    return context.post('/api/ai-engine/query', {
        data: payload,
        ...options,
    });
}

/**
 * POST /api/ai-engine/conversation
 * Initiates an AI conversation session with agentId.
 * Supports both JSON payload and multipart form data.
 */
export async function startConversation(context, payload = {}, options = {}) {
    // If multipart is explicitly specified or contains file/audio fields, use multipart
    if (options.multipart || payload?.file || payload?.audio) {
        return context.post('/api/ai-engine/conversation', {
            multipart: options.multipart || payload,
            ...options,
        });
    }

    return context.post('/api/ai-engine/conversation', {
        data: payload,
        ...options,
    });
}

/**
 * GET direct external AI engine /health
 */
export async function checkDirectEngineHealth(context, baseUrl = AI_ENGINE_DIRECT_URL) {
    const url = `${baseUrl.replace(/\/+$/, '')}/health`;
    return context.get(url, { timeout: 10_000 });
}

/**
 * GET direct external AI engine /api/tts/voices
 */
export async function getDirectEngineVoices(context, baseUrl = AI_ENGINE_DIRECT_URL) {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/tts/voices`;
    return context.get(url, { timeout: 10_000 });
}
