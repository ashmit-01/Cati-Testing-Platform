/**
 * AI Engine domain helper.
 *
 * Contains pure HTTP request wrappers for the /api/ai-engine routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function getProviders(context, options = {}) {
    return context.get('/api/ai-engine/providers', options);
}

export async function query(context, payload, options = {}) {
    return context.post('/api/ai-engine/query', {
        data: payload,
        ...options,
    });
}

export async function startConversation(context, multipartData, options = {}) {
    return context.post('/api/ai-engine/conversation', {
        multipart: multipartData,
        ...options,
    });
}
