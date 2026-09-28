/**
 * Result Checker — a single, shared expected-vs-actual comparator that
 * every suite type funnels through, per the master flow document's rule:
 *
 *   Expected = Actual -> PASS
 *   Expected != Actual -> FAIL
 *
 * Before this module, "did it pass" was decided inconsistently: Playwright
 * assertions decided it for UI tests, and mock mode just picked a random
 * status. Any test case executed generically (API/WebSocket/AI_VOICE
 * cases with no dedicated engine yet) now goes through this one function,
 * so every suite type produces a PASS/FAIL the same way.
 *
 * A dedicated engine (e.g. a future WebSocket test client) is still free
 * to decide status itself when the comparison needs protocol-specific
 * logic (e.g. "was the handshake completed", not just "do two values
 * match") — this module is the default/fallback comparator, not a
 * mandatory bottleneck.
 */

function normalize(value) {
    if (value === undefined) return null;
    if (typeof value === 'object' && value !== null) {
        try {
            return JSON.stringify(sortKeysDeep(value));
        } catch {
            return String(value);
        }
    }
    if (typeof value === 'string') return value.trim();
    return value;
}

function sortKeysDeep(value) {
    if (Array.isArray(value)) return value.map(sortKeysDeep);
    if (value && typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                acc[key] = sortKeysDeep(value[key]);
                return acc;
            }, {});
    }
    return value;
}

/**
 * Compares an expected value against an actual value and returns a
 * PASS/FAIL verdict plus a short human-readable reason.
 *
 * Object/array values are compared structurally (key order doesn't
 * matter); strings are compared trimmed; everything else falls back to
 * strict equality.
 *
 * @param {*} expected
 * @param {*} actual
 * @returns {{status: 'PASS'|'FAIL', reason: string|null}}
 */
export function checkResult(expected, actual) {
    const normalizedExpected = normalize(expected);
    const normalizedActual = normalize(actual);

    const matches = normalizedExpected === normalizedActual;

    return {
        status: matches ? 'PASS' : 'FAIL',
        reason: matches
            ? null
            : `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    };
}
