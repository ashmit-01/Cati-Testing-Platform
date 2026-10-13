import { FAILURE_SEVERITY } from '../models/Failure.js';

/**
 * Deterministic, rule-based severity engine.
 *
 * On purpose this does NOT use AI/ML — the task calls for a simple,
 * explainable, maintainable rule set that a human can audit. All rules
 * live here so severity is never decided ad-hoc inside controllers.
 *
 * Rules are checked in order CRITICAL -> HIGH -> MEDIUM -> LOW and the
 * first match wins. If nothing matches, we default to MEDIUM rather than
 * silently guessing LOW (a failure we can't classify shouldn't be
 * automatically treated as harmless) or CRITICAL (which would cause alert
 * fatigue).
 */

const CRITICAL_PATTERNS = [
    /econnrefused/i,
    /system (is )?unavailable/i,
    /service unavailable/i,
    /\b50[0-9]\b/, // 5xx-class server errors
    /completely (broken|unavailable|down)/i,
    /connection (refused|reset|timed out)/i,
    /could not connect/i
];

const CRITICAL_KEYWORDS_BY_CATEGORY = {
    AUTHENTICATION: [/broken/i, /unavailable/i, /down/i, /cannot log ?in/i],
    WEBSOCKET: [/unavailable/i, /cannot connect/i, /disconnected/i],
    VOICE: [/unavailable/i, /cannot connect/i]
};

const HIGH_PATTERNS = [
    /agent creation/i,
    /create agent/i,
    /call (functionality|feature)/i,
    /\bcall\b.*(fail|broken|error)/i,
    /\b4(0[0-9]|1[0-9])\b/, // 4xx client errors indicating broken API contract
    /major (api|workflow)/i,
    /important functionality/i
];

const MEDIUM_PATTERNS = [
    /partial/i,
    /workaround/i,
    /non-critical/i,
    /intermittent/i,
    /degraded/i
];

const LOW_PATTERNS = [
    /\bui\b.*(text|label|wording|copy)/i,
    /layout/i,
    /alignment/i,
    /validation message/i,
    /minor/i,
    /cosmetic/i,
    /typo/i
];

function matchesAny(patterns, text) {
    return patterns.some((pattern) => pattern.test(text));
}

/**
 * @param {Object} input
 * @param {string} input.testName
 * @param {string} input.suite
 * @param {string} [input.category] - failure category, if already classified
 * @param {string} [input.error]
 * @returns {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'}
 */
export function calculateSeverity({ testName = '', suite = '', category = '', error = '' } = {}) {
    const haystack = `${testName} ${error}`.trim();

    if (matchesAny(CRITICAL_PATTERNS, haystack)) {
        return FAILURE_SEVERITY.CRITICAL;
    }

    const categoryCriticalPatterns = CRITICAL_KEYWORDS_BY_CATEGORY[category];
    if (categoryCriticalPatterns && matchesAny(categoryCriticalPatterns, haystack)) {
        return FAILURE_SEVERITY.CRITICAL;
    }

    if (matchesAny(HIGH_PATTERNS, haystack)) {
        return FAILURE_SEVERITY.HIGH;
    }

    // Category-driven HIGH: a broken API test or broken FUNCTIONAL workflow
    // test is treated as important functionality unless already caught
    // above or downgraded below.
    if ((category === 'API' || category === 'FUNCTIONAL') && !matchesAny(LOW_PATTERNS, haystack)) {
        if (matchesAny(MEDIUM_PATTERNS, haystack)) {
            return FAILURE_SEVERITY.MEDIUM;
        }
        return FAILURE_SEVERITY.HIGH;
    }

    if (matchesAny(MEDIUM_PATTERNS, haystack)) {
        return FAILURE_SEVERITY.MEDIUM;
    }

    if (matchesAny(LOW_PATTERNS, haystack) || category === 'VALIDATION' || category === 'UI') {
        return FAILURE_SEVERITY.LOW;
    }

    // Uncertain case: default to MEDIUM (see module docstring for rationale).
    return FAILURE_SEVERITY.MEDIUM;
}
