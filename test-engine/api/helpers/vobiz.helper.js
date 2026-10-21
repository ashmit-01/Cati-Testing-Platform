/**
 * VoBiz Telephony domain helper.
 *
 * Contains pure HTTP request wrappers for the /api/vobiz routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function getConfig(context, options = {}) {
    return context.get('/api/vobiz/config', options);
}

export async function getAvailableNumbers(context, params = {}, options = {}) {
    return context.get('/api/vobiz/numbers/available', {
        params,
        ...options,
    });
}

export async function getUserNumbers(context, options = {}) {
    return context.get('/api/vobiz/numbers', options);
}

export async function getUserNumberById(context, id, options = {}) {
    return context.get(`/api/vobiz/numbers/${id}`, options);
}

export async function updateNumberRouting(context, id, payload, options = {}) {
    return context.patch(`/api/vobiz/numbers/${id}/routing`, {
        data: payload,
        ...options,
    });
}

export async function purchaseNumber(context, payload, options = {}) {
    return context.post('/api/vobiz/numbers/buy', {
        data: payload,
        ...options,
    });
}

export async function releaseNumber(context, id, options = {}) {
    return context.delete(`/api/vobiz/numbers/${id}`, options);
}

export async function makeCall(context, payload, options = {}) {
    return context.post('/api/vobiz/call', {
        data: payload,
        ...options,
    });
}
