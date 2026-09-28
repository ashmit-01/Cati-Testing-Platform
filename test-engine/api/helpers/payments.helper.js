/**
 * Payments domain helper.
 *
 * Contains pure HTTP request wrappers for the /api/payments routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function createOrder(context, payload, options = {}) {
    return context.post('/api/payments/create-order', {
        data: payload,
        ...options,
    });
}

export async function verifyPayment(context, payload, options = {}) {
    return context.post('/api/payments/verify', {
        data: payload,
        ...options,
    });
}

export async function getPaymentDetails(context, paymentId, options = {}) {
    return context.get(`/api/payments/${paymentId}`, options);
}

export async function refundPayment(context, paymentId, payload = {}, options = {}) {
    return context.post(`/api/payments/${paymentId}/refund`, {
        data: payload,
        ...options,
    });
}

export async function handleWebhook(context, rawBody, options = {}) {
    return context.post('/api/payments/webhook', {
        data: rawBody,
        ...options,
    });
}
