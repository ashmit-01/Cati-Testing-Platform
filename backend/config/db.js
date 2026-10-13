import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

/**
 * Connects to MongoDB using MONGO_URI from the environment.
 *
 * Intentionally does not crash the process if the initial connection
 * fails: the server still starts so that GET /api/health can report
 * "database": "disconnected" instead of the whole platform going dark.
 * Mongoose will keep retrying the connection in the background.
 */
export async function connectDB() {
    const uri = process.env.MONGO_URI;

    if (!uri) {
        logger.warn(
            'MONGO_URI is not set. The server will start, but any endpoint ' +
            'that reads/writes test runs, results, or failures will fail ' +
            'until a valid MONGO_URI is provided in .env.'
        );
        return;
    }

    mongoose.connection.on('connected', () => {
        logger.info('MongoDB connected');
    });

    mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error', { message: err.message });
    });

    mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
    });

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 8000
        });
    } catch (err) {
        logger.error('Initial MongoDB connection failed', {
            message: err.message
        });
    }
}

/**
 * Returns a simple, safe-to-expose connection status string.
 * Mongoose readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
 */
export function getDatabaseStatus() {
    const state = mongoose.connection.readyState;
    if (state === 1) return 'connected';
    if (state === 2) return 'connecting';
    if (state === 3) return 'disconnecting';
    return 'disconnected';
}

export function isDatabaseConnected() {
    return mongoose.connection.readyState === 1;
}
