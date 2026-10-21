import { logger } from '../utils/logger.js';

/**
 * 404 handler — mounted after all routes.
 */
export function notFoundMiddleware(req, res, next) {
    next({ statusCode: 404, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/**
 * Centralized error handler. All controllers should forward errors here
 * via next(err) (asyncHandler does this automatically). Never exposes
 * stack traces or internal details in production.
 */
// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
    const statusCode = err.statusCode && Number.isInteger(err.statusCode)
        ? err.statusCode
        : 500;

    const message = statusCode === 500 && process.env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : err.message || 'Something went wrong';

    if (statusCode >= 500) {
        logger.error('Unhandled error', { message: err.message, path: req.originalUrl });
    } else {
        logger.warn('Request error', { message: err.message, path: req.originalUrl, statusCode });
    }

    const body = { success: false, message };

    if (process.env.NODE_ENV !== 'production' && err.stack) {
        body.stack = err.stack;
    }

    res.status(statusCode).json(body);
}
