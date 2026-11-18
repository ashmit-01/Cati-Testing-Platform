import TestSuite from '../models/TestSuite.js';
import TestCase from '../models/TestCase.js';
import TestRun from '../models/TestRun.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';

function isValidObjectId(value) {
    return /^[a-f0-9]{24}$/i.test(value);
}

/**
 * POST /api/test-suites
 * Body: { name, type, description? }
 */
export const createTestSuite = asyncHandler(async (req, res) => {
    const suite = await TestSuite.create(req.body);
    res.status(201).json({ success: true, suite });
});

/**
 * GET /api/test-suites?type=
 * Includes each suite's test case count so the dashboard can show it
 * without a second round trip per suite.
 */
export const listTestSuites = asyncHandler(async (req, res) => {
    const { type } = req.query;
    const filter = {};
    if (type) filter.type = type.toUpperCase();

    const suites = await TestSuite.find(filter).sort({ createdAt: -1 }).lean();

    const suiteIds = suites.map((s) => s._id);
    const [counts, lastRuns] = await Promise.all([
        TestCase.aggregate([
            { $match: { suiteId: { $in: suiteIds } } },
            { $group: { _id: '$suiteId', count: { $sum: 1 }, active: { $sum: { $cond: ['$active', 1, 0] } } } }
        ]),
        TestRun.aggregate([
            { $match: { suiteId: { $in: suiteIds } } },
            { $sort: { startedAt: -1 } },
            { $group: { _id: '$suiteId', runId: { $first: '$runId' }, status: { $first: '$status' }, startedAt: { $first: '$startedAt' }, targetUrl: { $first: '$targetUrl' } } }
        ])
    ]);
    const countBySuite = new Map(counts.map((c) => [String(c._id), c]));
    const runBySuite = new Map(lastRuns.map((r) => [String(r._id), r]));

    const withCounts = suites.map((suite) => {
        const run = runBySuite.get(String(suite._id));
        return {
            ...suite,
            testCaseCount: countBySuite.get(String(suite._id))?.count || 0,
            activeCount: countBySuite.get(String(suite._id))?.active || 0,
            lastRun: run
                ? { runId: run.runId, status: run.status, startedAt: run.startedAt, targetUrl: run.targetUrl || null }
                : null
        };
    });

    res.json({ success: true, count: withCounts.length, suites: withCounts });
});

/**
 * POST /api/test-suites/:id/assign
 * Body: { testCaseIds: [mongoId...], remove?: boolean }
 * Moves the cases into this suite, or detaches them when remove is true
 * (only cases currently in this suite are detached).
 */
export const assignTestCases = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) throw new ApiError(400, `Invalid test suite id "${id}"`);
    const { testCaseIds, remove } = req.body || {};
    if (!Array.isArray(testCaseIds) || testCaseIds.length === 0 || !testCaseIds.every((v) => typeof v === 'string' && isValidObjectId(v))) {
        throw new ApiError(400, 'testCaseIds must be a non-empty array of Mongo ObjectId strings');
    }
    const suite = await TestSuite.findById(id).lean();
    if (!suite) throw new ApiError(404, `No test suite found with id "${id}"`);

    const result = remove
        ? await TestCase.updateMany({ _id: { $in: testCaseIds }, suiteId: id }, { suiteId: null })
        : await TestCase.updateMany({ _id: { $in: testCaseIds } }, { suiteId: id });
    res.json({ success: true, modified: result.modifiedCount });
});

/**
 * POST /api/test-suites/:id/active
 * Body: { active: boolean } — switches every case in the suite on or off.
 */
export const setSuiteActive = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) throw new ApiError(400, `Invalid test suite id "${id}"`);
    if (typeof req.body?.active !== 'boolean') throw new ApiError(400, 'active must be true or false');
    const suite = await TestSuite.findById(id).lean();
    if (!suite) throw new ApiError(404, `No test suite found with id "${id}"`);

    const result = await TestCase.updateMany({ suiteId: id }, { active: req.body.active });
    res.json({ success: true, modified: result.modifiedCount });
});

/**
 * GET /api/test-suites/:id — includes its member test cases.
 */
export const getTestSuite = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
        throw new ApiError(400, `Invalid test suite id "${id}"`);
    }

    const suite = await TestSuite.findById(id).lean();
    if (!suite) {
        throw new ApiError(404, `No test suite found with id "${id}"`);
    }

    const testCases = await TestCase.find({ suiteId: id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, suite, testCases });
});

/**
 * PUT /api/test-suites/:id
 */
export const updateTestSuite = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
        throw new ApiError(400, `Invalid test suite id "${id}"`);
    }

    const suite = await TestSuite.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true
    });
    if (!suite) {
        throw new ApiError(404, `No test suite found with id "${id}"`);
    }
    res.json({ success: true, suite });
});

/**
 * DELETE /api/test-suites/:id?deleteCases=true
 * By default member test cases are detached (suiteId -> null) so they are
 * kept. With deleteCases=true they are deleted along with the suite. Past
 * results and runs are never removed either way.
 */
export const deleteTestSuite = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
        throw new ApiError(400, `Invalid test suite id "${id}"`);
    }

    const suite = await TestSuite.findByIdAndDelete(id);
    if (!suite) {
        throw new ApiError(404, `No test suite found with id "${id}"`);
    }

    if (req.query.deleteCases === 'true') {
        const result = await TestCase.deleteMany({ suiteId: id });
        return res.json({ success: true, deletedCases: result.deletedCount, message: 'Test suite and its test cases deleted' });
    }

    await TestCase.updateMany({ suiteId: id }, { suiteId: null });

    res.json({ success: true, deletedCases: 0, message: 'Test suite deleted; its test cases were detached, not deleted' });
});
