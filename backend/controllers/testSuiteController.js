import TestSuite from '../models/TestSuite.js';
import TestCase from '../models/TestCase.js';
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

    const counts = await TestCase.aggregate([
        { $match: { suiteId: { $in: suites.map((s) => s._id) } } },
        { $group: { _id: '$suiteId', count: { $sum: 1 } } }
    ]);
    const countBySuite = new Map(counts.map((c) => [String(c._id), c.count]));

    const withCounts = suites.map((suite) => ({
        ...suite,
        testCaseCount: countBySuite.get(String(suite._id)) || 0
    }));

    res.json({ success: true, count: withCounts.length, suites: withCounts });
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
 * DELETE /api/test-suites/:id
 * Does not delete member test cases — it detaches them (suiteId -> null)
 * so their history/results stay intact.
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

    await TestCase.updateMany({ suiteId: id }, { suiteId: null });

    res.json({ success: true, message: 'Test suite deleted; its test cases were detached, not deleted' });
});
