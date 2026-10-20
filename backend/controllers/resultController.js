import TestResult from '../models/TestResult.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { sanitizeErrorText } from '../../test-engine/shared/aiErrorCapture.js';

/**
 * GET /api/results?runId=&status=&suite=
 */
export const listResults = asyncHandler(async (req, res) => {
    const { runId, status, suite } = req.query;
    const filter = {};
    if (runId) filter.runId = runId;
    if (status) filter.status = status.toUpperCase();
    if (suite) filter.suite = suite.toUpperCase();

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = parseInt(req.query.skip, 10) || 0;

    const [rawResults, total] = await Promise.all([
        TestResult.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        TestResult.countDocuments(filter)
    ]);

    const results = rawResults.map((r) => ({
        ...r,
        error: r.error ? sanitizeErrorText(r.error, { preserveStack: true }) : null
    }));

    res.json({ success: true, count: results.length, total, results });
});

/**
 * GET /api/results/:id — full result including evidence.
 */
export const getResultById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await TestResult.findById(id).lean().catch(() => null);
    if (!result) {
        throw new ApiError(404, `No test result found with id "${id}"`);
    }

    if (result.error) {
        result.error = sanitizeErrorText(result.error, { preserveStack: true });
    }

    res.json({ success: true, result });
});
