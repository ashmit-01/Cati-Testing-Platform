import { ApiError } from '../utils/asyncHandler.js';
import { AVAILABLE_SUITES } from '../services/testRunnerService.js';
import { TEST_CASE_PRIORITY } from '../models/TestCase.js';

/**
 * Validates POST /api/test-runs request bodies.
 *
 * The task only requires validating `environment`, but we also lightly
 * validate an optional `suites` array so a typo doesn't silently run
 * zero tests.
 */
export function validateCreateTestRun(req, res, next) {
    const { environment, suites, suiteId, testCaseIds } = req.body || {};

    if (!environment || typeof environment !== 'string' || !environment.trim()) {
        throw new ApiError(400, 'environment is required and must be a non-empty string');
    }

    if (suites !== undefined) {
        if (!Array.isArray(suites) || suites.length === 0) {
            throw new ApiError(400, 'suites must be a non-empty array of strings when provided');
        }
        const invalid = suites.filter(
            (suite) => typeof suite !== 'string' || !AVAILABLE_SUITES.includes(suite.toUpperCase())
        );
        if (invalid.length > 0) {
            throw new ApiError(
                400,
                `Invalid suite(s): ${invalid.join(', ')}. Must be one of: ${AVAILABLE_SUITES.join(', ')}`
            );
        }
    }

    if (suiteId !== undefined && (typeof suiteId !== 'string' || !/^[a-f0-9]{24}$/i.test(suiteId))) {
        throw new ApiError(400, 'suiteId must be a valid Mongo ObjectId string');
    }

    if (testCaseIds !== undefined) {
        if (!Array.isArray(testCaseIds) || testCaseIds.length === 0) {
            throw new ApiError(400, 'testCaseIds must be a non-empty array when provided');
        }
        const invalidIds = testCaseIds.filter((id) => typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id));
        if (invalidIds.length > 0) {
            throw new ApiError(400, 'testCaseIds must all be valid Mongo ObjectId strings');
        }
    }

    next();
}

/**
 * Validates POST /api/test-cases request bodies.
 */
export function validateTestCase(req, res, next) {
    const { testCaseId, name, type, expectedResult, priority } = req.body || {};

    if (!testCaseId || typeof testCaseId !== 'string' || !testCaseId.trim()) {
        throw new ApiError(400, 'testCaseId is required (e.g. "WS-001")');
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
        throw new ApiError(400, 'name is required');
    }
    if (!type || !AVAILABLE_SUITES.includes(String(type).toUpperCase())) {
        throw new ApiError(400, `type is required and must be one of: ${AVAILABLE_SUITES.join(', ')}`);
    }
    if (expectedResult === undefined || expectedResult === null || expectedResult === '') {
        throw new ApiError(400, 'expectedResult is required');
    }
    if (priority !== undefined && !Object.values(TEST_CASE_PRIORITY).includes(String(priority).toUpperCase())) {
        throw new ApiError(400, `priority must be one of: ${Object.values(TEST_CASE_PRIORITY).join(', ')}`);
    }

    next();
}

/**
 * Validates POST /api/test-suites request bodies.
 */
export function validateTestSuite(req, res, next) {
    const { name, type } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
        throw new ApiError(400, 'name is required');
    }
    if (!type || !AVAILABLE_SUITES.includes(String(type).toUpperCase())) {
        throw new ApiError(400, `type is required and must be one of: ${AVAILABLE_SUITES.join(', ')}`);
    }

    next();
}
