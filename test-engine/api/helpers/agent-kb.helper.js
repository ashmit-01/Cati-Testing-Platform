/**
 * Agent Knowledge Base domain helper.
 *
 * Contains pure HTTP request wrappers for agent knowledge routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function getKnowledge(context, agentId, options = {}) {
    return context.get(`/api/agents/${agentId}/knowledge`, options);
}

export async function clearKnowledge(context, agentId, options = {}) {
    return context.delete(`/api/agents/${agentId}/knowledge`, options);
}

export async function removeKnowledgeChunk(context, agentId, chunkHash, options = {}) {
    return context.post(`/api/agents/${agentId}/knowledge/remove`, {
        data: { chunkHash },
        ...options,
    });
}

export async function ingestText(context, payload, options = {}) {
    return context.post('/api/agents/ingest-text', {
        data: payload,
        ...options,
    });
}

export async function ingestUrl(context, payload, options = {}) {
    return context.post('/api/agents/ingest-url', {
        data: payload,
        ...options,
    });
}

export async function uploadFile(context, multipartData, options = {}) {
    return context.post('/api/agents/upload', {
        multipart: multipartData,
        ...options,
    });
}

export async function ingestImage(context, multipartData, options = {}) {
    return context.post('/api/agents/ingest-image', {
        multipart: multipartData,
        ...options,
    });
}

export async function refreshAllKnowledgeBase(context, options = {}) {
    return context.post('/api/agents/refresh-all-kb', options);
}
