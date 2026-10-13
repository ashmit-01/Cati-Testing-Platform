import Failure from '../models/Failure.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';

/**
 * GET /api/failures?runId=&severity=&status=&category=
 */
export const listFailures = asyncHandler(async (req, res) => {
    const { runId, severity, status, category } = req.query;
    const filter = {};
    if (runId) filter.runId = runId;
    if (severity) filter.severity = severity.toUpperCase();
    if (status) filter.status = status.toUpperCase();
    if (category) filter.category = category.toUpperCase();

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = parseInt(req.query.skip, 10) || 0;

    const [failures, total] = await Promise.all([
        Failure.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Failure.countDocuments(filter)
    ]);

    res.json({ success: true, count: failures.length, total, failures });
});

/**
 * GET /api/failures/:id — complete failure information and evidence.
 */
export const getFailureById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const failure = await Failure.findById(id)
        .populate('testResultId')
        .lean()
        .catch(() => null);

    if (!failure) {
        throw new ApiError(404, `No failure found with id "${id}"`);
    }

    res.json({ success: true, failure });
});
