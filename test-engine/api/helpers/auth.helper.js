/**
 * Authentication domain helper.
 *
 * Contains pure HTTP request wrappers for the /api/auth routes.
 * Contains NO assertions. Assertions belong in spec files.
 */

export async function login(context, credentials) {
    return context.post('/api/auth/login', {
        data: credentials,
    });
}

export async function signup(context, payload) {
    return context.post('/api/auth/signup', {
        data: payload,
    });
}

export async function verifySignupOtp(context, payload) {
    return context.post('/api/auth/signup/verify-otp', {
        data: payload,
    });
}

export async function resendSignupOtp(context, payload) {
    return context.post('/api/auth/signup/resend-otp', {
        data: payload,
    });
}

export async function getMe(context, options = {}) {
    return context.get('/api/auth/me', options);
}

export async function refreshToken(context, payload = {}, options = {}) {
    return context.post('/api/auth/refresh', {
        data: payload,
        ...options,
    });
}

export async function logout(context, options = {}) {
    return context.post('/api/auth/logout', options);
}

export async function forgotPassword(context, payload) {
    return context.post('/api/auth/forgot-password', {
        data: payload,
    });
}

export async function verifyForgotPasswordOtp(context, payload) {
    return context.post('/api/auth/forgot-password/verify-otp', {
        data: payload,
    });
}

export async function resendForgotPasswordOtp(context, payload) {
    return context.post('/api/auth/forgot-password/resend-otp', {
        data: payload,
    });
}

export async function resetPassword(context, payload) {
    return context.post('/api/auth/reset-password', {
        data: payload,
    });
}

export async function googleLogin(context, payload) {
    return context.post('/api/auth/google', {
        data: payload,
    });
}
