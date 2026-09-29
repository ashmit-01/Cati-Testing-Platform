import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/errorMiddleware.js';

/**
 * Builds and returns the Express app without starting a listener, so it
 * can be imported by tests or by server.js.
 */
export function createApp() {
    const app = express();

    // CORS: restrict to the known dashboard origin when configured, but
    // don't hard-fail local development if it isn't set yet.
    const allowedOrigin = process.env.FRONTEND_ORIGIN;
    app.use(
        cors(
            allowedOrigin
                ? { origin: allowedOrigin }
                : { origin: process.env.NODE_ENV === 'production' ? false : '*' }
        )
    );

    app.use(express.json());

    app.use('/api', apiRoutes);

    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
}
