/**
 * Agents domain helper.
 *
 * Contains pure HTTP request wrappers for the /api/agents routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function getAgents(context, options = {}) {
    return context.get('/api/agents', options);
}

export async function createAgent(context, payload, options = {}) {
    return context.post('/api/agents', {
        data: payload,
        ...options,
    });
}

export async function getAgent(context, id, options = {}) {
    return context.get(`/api/agents/${id}`, options);
}

export async function updateAgent(context, id, payload, options = {}) {
    return context.put(`/api/agents/${id}`, {
        data: payload,
        ...options,
    });
}

export async function deleteAgent(context, id, options = {}) {
    return context.delete(`/api/agents/${id}`, options);
}

export async function generatePrompt(context, payload, options = {}) {
    return context.post('/api/agents/generate-prompt', {
        data: payload,
        ...options,
    });
}

export async function aiEditPrompt(context, id, payload, options = {}) {
    return context.post(`/api/agents/${id}/ai-edit-prompt`, {
        data: payload,
        ...options,
    });
}

export async function regeneratePrompt(context, id, payload, options = {}) {
    return context.post(`/api/agents/${id}/regenerate-prompt`, {
        data: payload,
        ...options,
    });
}

export async function updatePrompt(context, id, payload, options = {}) {
    return context.put(`/api/agents/${id}/prompt`, {
        data: payload,
        ...options,
    });
}

export async function confirmAgent(context, id, options = {}) {
    return context.put(`/api/agents/${id}/confirm`, options);
}

export async function getSystemPrompt(context, id, options = {}) {
    return context.get(`/api/agents/${id}/system-prompt`, options);
}
