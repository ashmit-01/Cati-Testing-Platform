/**
 * Billing domain helper.
 *
 * Contains pure HTTP request wrappers for the /api/billing routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function getBalance(context, options = {}) {
    return context.get('/api/billing/balance', options);
}

export async function getTransactions(context, params = {}, options = {}) {
    return context.get('/api/billing/transactions', {
        params,
        ...options,
    });
}
