import Failure, { FAILURE_CATEGORY, FAILURE_STATUS } from '../models/Failure.js';
import { calculateSeverity } from './severityService.js';
import { logger } from '../utils/logger.js';

/**
 * Best-effort, keyword-based failure classification.
 *
 * Order matters: more specific categories are checked before generic ones
 * (e.g. an auth-related WebSocket failure is still classified as
 * AUTHENTICATION, since that's the more actionable bucket for triage).
 * If nothing matches confidently, category is OTHER rather than a guess.
 */
export function classifyFailureCategory({ testName = '', suite = '', error = '' } = {}) {
    const text = `${testName} ${error}`.toLowerCase();

    const has = (...needles) => needles.some((needle) => text.includes(needle));

    if (has('auth', 'login', 'unauthorized', '401', 'sign in', 'credential')) {
        return FAILURE_CATEGORY.AUTHENTICATION;
    }

    if (suite === 'WEBSOCKET' || has('websocket', 'ws://', 'wss://', 'socket disconnected')) {
        return FAILURE_CATEGORY.WEBSOCKET;
    }

    if (suite === 'AI_VOICE' || has('voice', 'speech', 'transcription', 'intent recognition')) {
        return FAILURE_CATEGORY.VOICE;
    }

    if (has('validation', 'required field', 'invalid input', 'must be provided', 'please enter')) {
        return FAILURE_CATEGORY.VALIDATION;
    }

    if (has('timeout', 'performance', 'slow', 'exceeded', 'took too long')) {
        return FAILURE_CATEGORY.PERFORMANCE;
    }

    if (suite === 'API' || has('endpoint', 'status code', 'request failed', 'response', 'api')) {
        return FAILURE_CATEGORY.API;
    }

    if (suite === 'UI' || has('button', 'locator', 'element', 'page', 'visible', 'click')) {
        return FAILURE_CATEGORY.UI;
    }

    if (suite === 'E2E' || has('workflow', 'end-to-end', 'business')) {
        return FAILURE_CATEGORY.FUNCTIONAL;
    }

    return FAILURE_CATEGORY.OTHER;
}

/**
 * Builds a short, human-readable title/description for a failure from a
 * normalized test result.
 */
function buildTitleAndDescription(testResult) {
    const title = testResult.testName || 'Unnamed test failed';
    const descriptionParts = [];

    if (testResult.suite) descriptionParts.push(`Suite: ${testResult.suite}`);
    if (testResult.endpoint) descriptionParts.push(`Endpoint: ${testResult.endpoint}`);
    if (testResult.page) descriptionParts.push(`Page: ${testResult.page}`);
    if (testResult.error) descriptionParts.push(`Error: ${testResult.error}`);
    if (testResult.expected !== undefined && testResult.expected !== null) {
        descriptionParts.push(`Expected: ${JSON.stringify(testResult.expected)}`);
    }
    if (testResult.actual !== undefined && testResult.actual !== null) {
        descriptionParts.push(`Actual: ${JSON.stringify(testResult.actual)}`);
    }

    return { title, description: descriptionParts.join(' | ') };
}

/**
 * Creates a Failure document from a saved TestResult document whose
 * status is FAIL. Does nothing (returns null) for non-FAIL results.
 *
 * @param {Object} savedTestResult - a saved mongoose TestResult document
 * @param {string} runId
 */
export async function createFailureFromResult(savedTestResult, runId) {
    if (!savedTestResult || savedTestResult.status !== 'FAIL') {
        return null;
    }

    const category = classifyFailureCategory(savedTestResult);
    const severity = calculateSeverity({
        testName: savedTestResult.testName,
        suite: savedTestResult.suite,
        category,
        error: savedTestResult.error || ''
    });

    const { title, description } = buildTitleAndDescription(savedTestResult);

    const failure = new Failure({
        runId,
        testResultId: savedTestResult._id,
        title,
        description,
        severity,
        category,
        status: FAILURE_STATUS.OPEN,
        evidence: savedTestResult.evidence || {}
    });

    await failure.save();

    logger.info('Failure recorded', {
        runId,
        testName: savedTestResult.testName,
        severity,
        category
    });

    return failure;
}

/**
 * Processes an array of saved TestResult documents, creating Failure
 * records for every one with status FAIL.
 *
 * @param {Array} savedTestResults
 * @param {string} runId
 * @returns {Promise<Array>} created Failure documents
 */
export async function processFailures(savedTestResults, runId) {
    const failures = [];

    for (const result of savedTestResults) {
        const failure = await createFailureFromResult(result, runId);
        if (failure) failures.push(failure);
    }

    return failures;
}
