import { asyncHandler } from '../utils/asyncHandler.js';
import { listReports, getReportByRunId } from '../services/reportService.js';

/**
 * GET /api/reports — summaries of recent runs.
 */
export const getReports = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 20;
    const reports = await listReports({ limit });
    res.json({ success: true, count: reports.length, reports });
});

/**
 * GET /api/reports/:runId — a single run's detailed report.
 */
export const getReportForRun = asyncHandler(async (req, res) => {
    const report = await getReportByRunId(req.params.runId);
    res.json({ success: true, report });
});
