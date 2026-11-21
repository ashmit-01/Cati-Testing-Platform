import { createHash } from 'node:crypto';
import TestResult from '../models/TestResult.js';
import { logger } from '../utils/logger.js';

/**
 * Normalizes a single raw result (already close to TestResult shape,
 * produced by testRunnerService) and persists it.
 *
 * Kept intentionally tolerant of missing fields since a Playwright-derived
 * result and a mock-mode result won't always carry the exact same set of
 * properties (e.g. `endpoint` only makes sense for API suite tests).
 */
async function saveOne(runId, environment, rawResult, reportIndex) {
    const doc = new TestResult({
        runId,
        testCaseId: rawResult.testCaseId || null,
        testName: rawResult.testName,
        suite: rawResult.suite,
        environment: environment || null,
        status: rawResult.status,
        duration: rawResult.duration || 0,
        error: rawResult.error || null,
        stackTrace: rawResult.stackTrace || null,
        expected: rawResult.expected ?? null,
        actual: rawResult.actual ?? null,
        endpoint: rawResult.endpoint || null,
        page: rawResult.page || null,
        evidence: rawResult.evidence || {}
    });

    if (reportIndex !== undefined) {
        // A retried upload uses the same document for each row of the report.
        const id = createHash('sha256').update(JSON.stringify([runId, reportIndex])).digest('hex').slice(0, 24);
        await doc.validate();
        const fields = doc.toObject();
        delete fields._id;
        return TestResult.findOneAndUpdate({ _id: id }, { $setOnInsert: fields }, { upsert: true, new: true });
    }
    return doc.save();
}

/**
 * Persists every raw result produced by the test runner as a TestResult
 * document and computes the pass/fail/skipped summary.
 *
 * @param {string} runId
 * @param {Array} rawResults - normalized results from testRunnerService
 * @param {string} [environment] - the run's environment, denormalized onto each result
 * @returns {Promise<{summary: Object, savedResults: Array}>}
 */
export async function processResults(runId, rawResults, environment, { ciImport = false } = {}) {
    const savedResults = [];

    for (const [index, rawResult] of rawResults.entries()) {
        try {
            const saved = await saveOne(runId, environment, rawResult, ciImport ? index : undefined);
            savedResults.push(saved);
        } catch (err) {
            logger.error('Failed to persist a TestResult, skipping it', {
                runId,
                testName: rawResult?.testName,
                message: err.message
            });
        }
    }

    const summary = savedResults.reduce(
        (acc, result) => {
            acc.totalTests += 1;
            if (result.status === 'PASS') acc.passed += 1;
            else if (result.status === 'FAIL') acc.failed += 1;
            else if (result.status === 'SKIPPED') acc.skipped += 1;
            return acc;
        },
        { totalTests: 0, passed: 0, failed: 0, skipped: 0 }
    );

    return { summary, savedResults };
}
