/**
 * Analytics domain helper.
 *
 * Contains pure HTTP request wrappers for the /api/analytics routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function getOverview(context, params = {}, options = {}) {
    return context.get('/api/analytics/overview', {
        params,
        ...options,
    });
}

export async function getCallsPerDay(context, params = {}, options = {}) {
    return context.get('/api/analytics/calls-per-day', {
        params,
        ...options,
    });
}

export async function getCallsPerAgent(context, options = {}) {
    return context.get('/api/analytics/calls-per-agent', options);
}

export async function getRecentCalls(context, params = {}, options = {}) {
    return context.get('/api/analytics/recent-calls', {
        params,
        ...options,
    });
}
