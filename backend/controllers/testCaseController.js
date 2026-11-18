import TestCase from '../models/TestCase.js';
import { getAuthOptions } from '../services/authOptions.js';
import { importEndpoints } from '../services/endpointImportService.js';
import { importOpenApi } from '../services/openApiImportService.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';

/**
 * An empty suiteId means "no suite". Forms send "" for Unassigned, which
 * Mongoose cannot cast to an ObjectId, so store null instead.
 */
function withCleanSuiteId(body) {
    if (body && typeof body === 'object' && 'suiteId' in body && !body.suiteId) {
        return { ...body, suiteId: null };
    }
    return body;
}

/**
 * POST /api/test-cases
 * Body: { testCaseId, name, type, suiteId?, precondition?, input?, expectedResult, priority? }
 */
export const createTestCase = asyncHandler(async (req, res) => {
    const testCase = await TestCase.create(withCleanSuiteId(req.body));
    res.status(201).json({ success: true, testCase });
});

/**
 * POST /api/test-cases/import-endpoints?dryRun=true
 * Body: a "cati-endpoints" export from the target backend's exportEndpoints script.
 * Creates API smoke cases for endpoints that do not have one yet.
 */
export const importEndpointCases = asyncHandler(async (req, res) => {
    try {
        const summary = await importEndpoints(req.body, {
            dryRun: req.query.dryRun === 'true',
            suiteId: req.query.suiteId || null
        });
        res.status(201).json({ success: true, ...summary });
    } catch (error) {
        throw new ApiError(400, error.message);
    }
});

/**
 * POST /api/test-cases/import-openapi?dryRun=true&suiteId=
 * Body: { spec } — an OpenAPI 3.x document as an object, or JSON/YAML text.
 * Creates cases for new operations, refreshes generated cases nobody edited,
 * keeps edited ones, and deactivates cases whose operation left the spec.
 */
export const importOpenApiCases = asyncHandler(async (req, res) => {
    const spec = req.body?.spec;
    if (spec === undefined || spec === null) {
        throw new ApiError(400, 'Body must be { "spec": <OpenAPI document or its JSON/YAML text> }');
    }
    const suiteId = req.query.suiteId || null;
    if (suiteId && !isValidObjectId(suiteId)) {
        throw new ApiError(400, 'suiteId must be a valid Mongo ObjectId string');
    }
    const dryRun = req.query.dryRun === 'true';
    let summary;
    try {
        summary = await importOpenApi(spec, {
            dryRun,
            suiteId,
            bundleName: typeof req.query.bundleName === 'string' ? req.query.bundleName.trim().slice(0, 120) : null,
            fileName: typeof req.query.fileName === 'string' ? req.query.fileName.slice(0, 200) : null
        });
    } catch (error) {
        if (error.name === 'MongoServerError' || error.name === 'MongoBulkWriteError') throw error;
        throw new ApiError(400, error.message);
    }
    res.status(dryRun ? 200 : 201).json({ success: true, ...summary });
});

/**
 * GET /api/test-cases/auth-options
 * Lists the auth choices for API cases and which ones this platform has credentials for.
 */
export const listAuthOptions = asyncHandler(async (req, res) => {
    res.json({ success: true, options: getAuthOptions() });
});

/**
 * POST /api/test-cases/bulk-delete
 * Body: { testCaseIds: [mongoId...] } (max 500). Past results are kept.
 */
export const bulkDeleteTestCases = asyncHandler(async (req, res) => {
    const { testCaseIds } = req.body || {};
    if (
        !Array.isArray(testCaseIds) ||
        testCaseIds.length === 0 ||
        testCaseIds.length > 500 ||
        !testCaseIds.every((value) => typeof value === 'string' && isValidObjectId(value))
    ) {
        throw new ApiError(400, 'testCaseIds must be 1-500 Mongo ObjectId strings');
    }
    const result = await TestCase.deleteMany({ _id: { $in: testCaseIds } });
    res.json({ success: true, deleted: result.deletedCount });
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
        withCleanSuiteId(req.body),
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
