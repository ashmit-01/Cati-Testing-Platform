/**
 * Wraps an async Express handler so rejected promises are forwarded to
 * next(err) instead of crashing the process. Keeps controllers free of
 * repetitive try/catch blocks.
 */
export function asyncHandler(fn) {
    return function wrapped(req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * A small typed error so the central error middleware can decide the right
 * HTTP status code instead of everything collapsing to 500.
 */
export class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.isApiError = true;
    }
}
