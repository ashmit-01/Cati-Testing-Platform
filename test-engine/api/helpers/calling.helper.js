/**
 * Calling & Bulk Campaign domain helper.
 *
 * Contains pure HTTP request wrappers for the /api/calling routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function singleCall(context, payload, options = {}) {
    return context.post('/api/calling/single', {
        data: payload,
        ...options,
    });
}

export async function uploadBulkFile(context, multipartData, options = {}) {
    return context.post('/api/calling/bulk/upload', {
        multipart: multipartData,
        ...options,
    });
}

export async function startBulkCall(context, payload, options = {}) {
    return context.post('/api/calling/bulk/start', {
        data: payload,
        ...options,
    });
}

export async function getCampaigns(context, options = {}) {
    return context.get('/api/calling/campaigns', options);
}

export async function getCampaign(context, id, options = {}) {
    return context.get(`/api/calling/campaigns/${id}`, options);
}

export async function stopCampaign(context, id, options = {}) {
    return context.post(`/api/calling/campaigns/${id}/stop`, options);
}

export async function deleteCampaign(context, id, options = {}) {
    return context.delete(`/api/calling/campaigns/${id}`, options);
}

export async function getLeadsCampaign(context, options = {}) {
    return context.get('/api/calling/campaigns/leads-campaign', options);
}

export async function updateLeadsCampaignSettings(context, payload, options = {}) {
    return context.put('/api/calling/campaigns/leads-campaign/settings', {
        data: payload,
        ...options,
    });
}

export async function scheduleLead(context, payload, options = {}) {
    return context.post('/api/calling/campaigns/schedule-lead', {
        data: payload,
        ...options,
    });
}

export async function cancelLeadSchedule(context, payload, options = {}) {
    return context.post('/api/calling/campaigns/cancel-lead-schedule', {
        data: payload,
        ...options,
    });
}
