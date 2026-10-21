import TestCase from '../models/TestCase.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';

/**
 * POST /api/test-cases
 * Body: { testCaseId, name, type, suiteId?, precondition?, input?, expectedResult, priority? }
 */
export const createTestCase = asyncHandler(async (req, res) => {
    const testCase = await TestCase.create(req.body);
    res.status(201).json({ success: true, testCase });
});

/**
 * GET /api/test-cases?type=&suiteId=&priority=&active=
 */
export const listTestCases = asyncHandler(async (req, res) => {
    const { type, suiteId, priority, active } = req.query;
    const filter = {};
    if (type) filter.type = type.toUpperCase();
    if (suiteId) filter.suiteId = suiteId;
    if (priority) filter.priority = priority.toUpperCase();
    if (active !== undefined) filter.active = active === 'true';

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const testCases = await TestCase.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, count: testCases.length, testCases });
});

/**
 * GET /api/test-cases/:id — accepts either Mongo _id or the application-level testCaseId.
 */
export const getTestCase = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const testCase = await TestCase.findOne({
        $or: [{ testCaseId: id }, ...(isValidObjectId(id) ? [{ _id: id }] : [])]
    }).lean();

    if (!testCase) {
        throw new ApiError(404, `No test case found with id "${id}"`);
    }
    res.json({ success: true, testCase });
});

/**
 * PUT /api/test-cases/:id
 */
export const updateTestCase = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const testCase = await TestCase.findOneAndUpdate(
        { $or: [{ testCaseId: id }, ...(isValidObjectId(id) ? [{ _id: id }] : [])] },
        req.body,
        { new: true, runValidators: true }
    );

    if (!testCase) {
        throw new ApiError(404, `No test case found with id "${id}"`);
    }
    res.json({ success: true, testCase });
});

/**
 * DELETE /api/test-cases/:id
 */
export const deleteTestCase = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const testCase = await TestCase.findOneAndDelete({
        $or: [{ testCaseId: id }, ...(isValidObjectId(id) ? [{ _id: id }] : [])]
    });

    if (!testCase) {
        throw new ApiError(404, `No test case found with id "${id}"`);
    }
    res.json({ success: true, message: 'Test case deleted' });
});

function isValidObjectId(value) {
    return /^[a-f0-9]{24}$/i.test(value);
}
