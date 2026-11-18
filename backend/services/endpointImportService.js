import TestCase from '../models/TestCase.js';

/**
 * Turns an endpoint export (format "cati-endpoints", produced by
 * scripts/exportEndpoints.js in the target backend) into API test cases.
 *
 * Safe by default: only plain GET/HEAD endpoints with no path parameters and
 * no risky keywords are enabled. Everything else is created inactive and
 * tagged so a tester can review it and turn it on deliberately.
 *
 * Existing test cases (same testCaseId) are never overwritten, so manual
 * edits survive a re-import.
 */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const RISKY_PATH =
    /payment|billing|wallet|purchase|checkout|stripe|razorpay|webhook|twilio|plivo|epicode|telephony|call|campaign|whatsapp|sms|email|send|delete|remove|logout|reset|signup|register/i;

export function parseEndpointExport(data) {
    if (!data || data.format !== 'cati-endpoints' || !Array.isArray(data.endpoints)) {
        throw new Error('Not a CATI endpoint export (expected format "cati-endpoints").');
    }
    return data.endpoints.filter(
        (e) =>
            e &&
            typeof e.method === 'string' &&
            typeof e.path === 'string' &&
            !e.path.includes('*') &&
            !['OPTIONS', 'ALL'].includes(e.method.toUpperCase())
    );
}

export function slug(value) {
    return value
        .replace(/^\//, '')
        .replace(/:([A-Za-z0-9_]+)/g, 'by-$1')
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

export function classifyEndpoint(endpoint) {
    const method = endpoint.method.toUpperCase();
    const reasons = [];
    if (MUTATING_METHODS.has(method)) reasons.push('mutating');
    if (RISKY_PATH.test(endpoint.path)) reasons.push('sensitive-path');
    if (/:[A-Za-z0-9_]+/.test(endpoint.path)) reasons.push('needs-path-params');
    if (endpoint.multipart) reasons.push('multipart');
    if (endpoint.auth === 'internal-key') reasons.push('internal');
    return reasons;
}

export function buildTestCase(endpoint, options = {}) {
    const method = endpoint.method.toUpperCase();
    const reasons = classifyEndpoint(endpoint);
    const auth = endpoint.auth || 'public';
    const input = { method, endpoint: endpoint.path, headers: {}, body: null };

    if (MUTATING_METHODS.has(method) && endpoint.bodyFields?.length) {
        input.body = Object.fromEntries(endpoint.bodyFields.map((f) => [f, null]));
    }

    return {
        testCaseId: `EP-${method}-${slug(endpoint.path) || 'root'}`,
        name: `${method} ${endpoint.path}`,
        type: 'API',
        suiteId: options.suiteId || null,
        precondition:
            auth === 'public'
                ? ''
                : `Requires ${auth} credentials (configured on the platform, never stored in the case).`,
        input,
        definition: {
            source: 'endpoint-import',
            auth,
            risk: reasons,
            variables: Object.fromEntries(
                [...endpoint.path.matchAll(/:([A-Za-z_]\w*)/g)].map((m) => [m[1], ''])
            ),
            bodyFields: endpoint.bodyFields || [],
            queryFields: endpoint.queryFields || [],
            origin: options.origin || null
        },
        // Smoke check: the endpoint must respond without a server error.
        expectedResult: [{ kind: 'statusBelow', expected: '500' }],
        priority: auth === 'public' && reasons.length === 0 ? 'MEDIUM' : 'LOW',
        active: reasons.length === 0
    };
}

/**
 * @returns {{total:number, created:number, skipped:number, enabled:number, flagged:number, cases:object[]}}
 */
export async function importEndpoints(data, { dryRun = false, suiteId = null } = {}) {
    const endpoints = parseEndpointExport(data);
    const origin = data.source ? { ...data.source, importedAt: new Date().toISOString() } : null;
    const seen = new Set();
    const cases = endpoints
        .map((endpoint) => buildTestCase(endpoint, { suiteId, origin }))
        .filter((c) => !seen.has(c.testCaseId) && seen.add(c.testCaseId));

    const existing = new Set(
        (
            await TestCase.find({ testCaseId: { $in: cases.map((c) => c.testCaseId) } })
                .select('testCaseId')
                .lean()
        ).map((c) => c.testCaseId)
    );
    const fresh = cases.filter((c) => !existing.has(c.testCaseId));

    if (!dryRun && fresh.length > 0) {
        await TestCase.insertMany(fresh, { ordered: false });
    }

    return {
        total: cases.length,
        created: fresh.length,
        skipped: cases.length - fresh.length,
        enabled: fresh.filter((c) => c.active).length,
        flagged: fresh.filter((c) => !c.active).length,
        dryRun,
        cases: dryRun ? fresh : undefined
    };
}
