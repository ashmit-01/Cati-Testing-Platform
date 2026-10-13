import TestRun from '../models/TestRun.js';
import Failure from '../models/Failure.js';
import { ApiError } from '../utils/asyncHandler.js';

function computePassRate(run) {
    if (!run.totalTests) return 0;
    return Math.round((run.passed / run.totalTests) * 100);
}

async function buildReportForRun(run) {
    const failures = await Failure.find({ runId: run.runId })
        .sort({ createdAt: -1 })
        .select('title severity category status')
        .lean();

    return {
        runId: run.runId,
        environment: run.environment,
        status: run.status,
        totalTests: run.totalTests,
        passed: run.passed,
        failed: run.failed,
        skipped: run.skipped,
        passRate: computePassRate(run),
        duration: run.duration,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        failures: failures.map((failure) => ({
            title: failure.title,
            severity: failure.severity,
            category: failure.category,
            status: failure.status
        }))
    };
}

/**
 * GET /api/reports — summaries for the most recent completed/failed runs.
 * Defaults to the 20 most recent runs so payloads stay bounded.
 */
export async function listReports({ limit = 20 } = {}) {
    const runs = await TestRun.find({ status: { $in: ['COMPLETED', 'FAILED'] } })
        .sort({ startedAt: -1 })
        .limit(Math.min(limit, 100))
        .lean();

    return Promise.all(runs.map((run) => buildReportForRun(run)));
}

/**
 * GET /api/reports/:runId — a single run's detailed report.
 */
export async function getReportByRunId(runId) {
    const run = await TestRun.findOne({ runId }).lean();
    if (!run) {
        throw new ApiError(404, `No test run found with runId "${runId}"`);
    }
    return buildReportForRun(run);
}
