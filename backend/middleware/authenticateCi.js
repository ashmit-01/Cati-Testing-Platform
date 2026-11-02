
import crypto from 'node:crypto';

export function authenticateCi(req, res, next) {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.CI_INGEST_TOKEN;

    if (!expectedToken) {
        return res.status(503).json({
            success: false,
            message: 'CI ingestion is not configured'
        });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'CI authentication required'
        });
    }

    const receivedToken = authHeader.slice(7);

    const receivedBuffer = Buffer.from(receivedToken);
    const expectedBuffer = Buffer.from(expectedToken);

    if (
        receivedBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
        return res.status(401).json({
            success: false,
            message: 'Invalid CI authentication token'
        });
    }

    req.ciAuthenticated = true;
    next();
}
