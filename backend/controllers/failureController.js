import Failure from '../models/Failure.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import {
    claimAnalysis,
    getAnalysisConfig,
    runClaimedAnalysis
} from '../services/aiFailureAnalysisService.js';
import { logger } from '../utils/logger.js';

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

/**
 * POST /api/failures/:id/analyze — (re)run AI analysis for one failure.
 *
 * Used for the "Retry analysis" action. The analysis is claimed
 * synchronously (so the response already shows PENDING) and the slow LLM
 * call continues in the background. It never changes the failure's or
 * the test result's status.
 */
export const analyzeFailureById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const config = getAnalysisConfig();

    if (!config.enabled) {
        throw new ApiError(503, 'AI failure analysis is disabled on this server.');
    }

    const exists = await Failure.exists({ _id: id }).catch(() => null);
    if (!exists) {
        throw new ApiError(404, `No failure found with id "${id}"`);
    }

    const claimed = await claimAnalysis(id, { force: true, config });
    if (!claimed) {
        throw new ApiError(409, 'AI analysis for this failure is already in progress.');
    }

    // Fire-and-forget; runClaimedAnalysis never throws, the catch is a
    // last-resort guard against an unhandled rejection.
    runClaimedAnalysis(claimed, config).catch((err) => {
        logger.error('Unexpected error during AI analysis retry', {
            failureId: String(id),
            message: err.message
        });
    });

    res.status(202).json({
        success: true,
        message: 'AI analysis started',
        aiAnalysis: claimed.aiAnalysis
    });
});
