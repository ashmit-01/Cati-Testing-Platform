import Failure from '../models/Failure.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { sanitizeErrorText } from '../../test-engine/shared/aiErrorCapture.js';

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

    const [rawFailures, total] = await Promise.all([
        Failure.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Failure.countDocuments(filter)
    ]);

    const failures = rawFailures.map((f) => ({
        ...f,
        description: f.description ? sanitizeErrorText(f.description, { preserveStack: false }) : ''
    }));

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

    if (failure.description) {
        failure.description = sanitizeErrorText(failure.description, { preserveStack: false });
    }
    if (failure.testResultId && failure.testResultId.error) {
        failure.testResultId.error = sanitizeErrorText(failure.testResultId.error, { preserveStack: true });
    }

    res.json({ success: true, failure });
});
