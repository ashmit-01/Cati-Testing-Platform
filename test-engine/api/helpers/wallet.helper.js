/**
 * Wallet domain helper.
 *
 * Contains pure HTTP request wrappers for the /api/wallet routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function getWallet(context, options = {}) {
    return context.get('/api/wallet', options);
}

export async function getWalletTransactions(context, options = {}) {
    return context.get('/api/wallet/transactions', options);
}

export async function getPhoneRenewalAlerts(context, options = {}) {
    return context.get('/api/wallet/phone-renewal-alerts', options);
}

export async function createCheckoutSession(context, payload, options = {}) {
    return context.post('/api/wallet/create-checkout-session', {
        data: payload,
        ...options,
    });
}

export async function addFunds(context, payload, options = {}) {
    return context.post('/api/wallet/add-funds', {
        data: payload,
        ...options,
    });
}

export async function debitWallet(context, payload, options = {}) {
    return context.post('/api/wallet/debit', {
        data: payload,
        ...options,
    });
}

export async function reconcileCalls(context, payload = {}, options = {}) {
    return context.post('/api/wallet/reconcile-calls', {
        data: payload,
        ...options,
    });
}
