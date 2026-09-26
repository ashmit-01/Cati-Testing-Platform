/**
 * Calls domain helper.
 *
 * Contains pure HTTP request wrappers for the /api/calls routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function getCalls(context, options = {}) {
    return context.get('/api/calls', options);
}

export async function getCall(context, id, options = {}) {
    return context.get(`/api/calls/${id}`, options);
}

export async function getRecordingStream(context, id, options = {}) {
    return context.get(`/api/calls/${id}/recording/stream`, options);
}

export async function getRecordingDownload(context, id, options = {}) {
    return context.get(`/api/calls/${id}/recording/download`, options);
}

export async function createCall(context, payload, options = {}) {
    return context.post('/api/calls', {
        data: payload,
        ...options,
    });
}

export async function createDemoCall(context, payload, options = {}) {
    return context.post('/api/calls/demo', {
        data: payload,
        ...options,
    });
}

export async function terminateCall(context, id, options = {}) {
    return context.delete(`/api/calls/${id}/terminate`, options);
}

export async function generateFollowUpInsights(context, id, options = {}) {
    return context.post(`/api/calls/${id}/follow-up-insights`, options);
}
