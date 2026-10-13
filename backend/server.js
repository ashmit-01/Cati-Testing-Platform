import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 5001;

async function start() {
    logger.info('Starting CATI QA Backend...');

    await connectDB();

    const app = createApp();

    app.listen(PORT, () => {
        logger.info(`CATI QA Backend listening on port ${PORT}`, {
            nodeEnv: process.env.NODE_ENV || 'development',
            executionMode: process.env.TEST_EXECUTION_MODE || 'mock'
        });
    });
}

start().catch((err) => {
    logger.error('Fatal error starting server', { message: err.message });
    process.exit(1);
});
