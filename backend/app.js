import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/errorMiddleware.js';

const PRIVATE_ORIGIN =
    /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i;

/**
 * FRONTEND_ORIGIN may hold one or more comma-separated origins (trailing
 * slashes ignored). Outside production, localhost and private-LAN origins
 * are always allowed so the dashboard works from other machines on the
 * network without editing .env.
 */
function corsOrigin(origin, callback) {
    if (!origin) return callback(null, true); // non-browser clients
    const configured = (process.env.FRONTEND_ORIGIN || '')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean);
    const normalized = origin.replace(/\/+$/, '');
    const isProd = process.env.NODE_ENV === 'production';
    const allowed =
        configured.includes(normalized) ||
        (!isProd && (configured.length === 0 || PRIVATE_ORIGIN.test(normalized)));
    callback(null, allowed);
}

/**
 * Builds and returns the Express app without starting a listener, so it
 * can be imported by tests or by server.js.
 */
export function createApp() {
    const app = express();

    // CORS: restrict to the known dashboard origin when configured, but
    // don't hard-fail local development if it isn't set yet.
    app.use(cors({ origin: corsOrigin }));

    app.use(express.json({ limit: '8mb' }));

    app.use('/api', apiRoutes);

    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
}
