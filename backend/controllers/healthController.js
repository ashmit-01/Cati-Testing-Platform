import { asyncHandler } from '../utils/asyncHandler.js';
import { getDatabaseStatus } from '../config/db.js';

/**
 * GET /api/health
 * Never exposes sensitive information (no connection strings, no env dump).
 */
export const getHealth = asyncHandler(async (req, res) => {
    res.json({
        status: 'ok',
        service: 'CATI QA Backend',
        database: getDatabaseStatus()
    });
});
