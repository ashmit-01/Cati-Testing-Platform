import { createHash } from 'crypto';
import YAML from 'yaml';
import TestCase from '../models/TestCase.js';
import TestSuite from '../models/TestSuite.js';
import { classifyEndpoint, slug } from './endpointImportService.js';

/**
 * Turns an OpenAPI 3.x document into API test cases.
 *
 * Each operation becomes one case that checks the documented success status
 * and, when the spec documents a JSON response body, validates the body
 * against that schema (see the `schema` assertion in playwrightCaseExecutor).
 *
 * Re-importing is safe:
 *   - cases nobody edited since the last import are refreshed from the spec,
 *   - cases a tester edited are left alone and reported,
 *   - operations that disappeared from the spec are deactivated and marked
 *     `definition.openapi.removed`, never deleted.
 * "Edited" is detected with a fingerprint of the generated content stored in
 * `definition.openapi.fingerprint`.
 *
 * Mutating or sensitive operations, and ones whose path parameters have no
 * example value, are created inactive so a tester enables them deliberately.
 */

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head'];
const MAX_DEPTH = 8;

// ---------------------------------------------------------------------------
// Parsing and $ref resolution
// ---------------------------------------------------------------------------

export function parseSpec(raw) {
    let spec = raw;
    if (typeof raw === 'string') {
        const text = raw.trim();
        if (!text) throw new Error('The OpenAPI file is empty.');
        try {
            spec = text.startsWith('{') ? JSON.parse(text) : YAML.parse(text);
        } catch (error) {
            throw new Error(`Could not parse the OpenAPI file: ${error.message}`);
        }
    }
    if (!spec || typeof spec !== 'object') throw new Error('The OpenAPI file is not an object.');
    if (spec.swagger) {
        throw new Error('Swagger 2.0 is not supported. Export the spec as OpenAPI 3.x.');
    }
    if (typeof spec.openapi !== 'string' || !spec.openapi.startsWith('3.')) {
        throw new Error('Not an OpenAPI 3.x document (missing "openapi: 3.x").');
    }
    if (!spec.paths || typeof spec.paths !== 'object') {
        throw new Error('The OpenAPI document has no "paths".');
    }
    return spec;
}

function readPointer(spec, ref) {
    if (typeof ref !== 'string' || !ref.startsWith('#/')) return undefined;
    return ref
        .slice(2)
        .split('/')
        .map((part) => decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~'))
        .reduce((node, key) => (node == null ? undefined : node[key]), spec);
}

/**
 * Inlines local `#/...` references. A reference that points back into its own
 * chain (recursive schema) or goes deeper than MAX_DEPTH becomes `{}`, which
 * accepts anything — validation stays correct, just less strict there.
 * External references (other files/URLs) are also replaced with `{}`.
 */
export function deref(spec, node, chain = [], depth = 0) {
    if (Array.isArray(node)) return node.map((item) => deref(spec, item, chain, depth + 1));
    if (!node || typeof node !== 'object') return node;
    if (depth > MAX_DEPTH * 4) return {};

    if (typeof node.$ref === 'string') {
        const { $ref, ...siblings } = node;
        if (chain.includes($ref)) return {};
        const target = readPointer(spec, $ref);
        if (target === undefined) return {};
        const resolved = deref(spec, target, [...chain, $ref], depth + 1);
        return Object.keys(siblings).length
            ? { ...resolved, ...deref(spec, siblings, chain, depth + 1) }
            : resolved;
    }
    return Object.fromEntries(
        Object.entries(node).map(([key, value]) => [key, deref(spec, value, chain, depth + 1)])
    );
}

/**
 * Rewrites OpenAPI 3.0 schema dialect into JSON Schema 2020-12 so one Ajv
 * instance can validate both 3.0 and 3.1 specs:
 *   nullable: true            -> type: [t, 'null']
 *   exclusiveMinimum: true    -> exclusiveMinimum: <minimum>
 * and drops OpenAPI-only annotations.
 */
export function normalizeSchema(schema) {
    if (Array.isArray(schema)) return schema.map(normalizeSchema);
    if (!schema || typeof schema !== 'object') return schema;

    const out = {};
    for (const [key, value] of Object.entries(schema)) {
        // "$..." keywords ($id, $schema, $defs, $comment) are dropped: refs are
        // already inlined, and MongoDB rejects "$"-prefixed field names.
        if (key.startsWith('$') || ['nullable', 'discriminator', 'xml', 'externalDocs', 'example'].includes(key)) {
            continue;
        }
        if (key === 'properties' || key === 'patternProperties') {
            out[key] = Object.fromEntries(
                Object.entries(value || {}).map(([name, sub]) => [name, normalizeSchema(sub)])
            );
        } else if (value && typeof value === 'object') {
            out[key] = normalizeSchema(value);
        } else {
            out[key] = value;
        }
    }

    if (schema.nullable === true) {
        if (typeof out.type === 'string') out.type = [out.type, 'null'];
        else if (Array.isArray(out.type) && !out.type.includes('null')) out.type = [...out.type, 'null'];
        if (Array.isArray(out.enum) && !out.enum.includes(null)) out.enum = [...out.enum, null];
    }
    for (const [flag, bound] of [
        ['exclusiveMinimum', 'minimum'],
        ['exclusiveMaximum', 'maximum']
    ]) {
        if (out[flag] === true && typeof out[bound] === 'number') {
            out[flag] = out[bound];
            delete out[bound];
        } else if (typeof out[flag] === 'boolean') {
            delete out[flag];
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Example values
// ---------------------------------------------------------------------------

const STRING_FORMATS = {
    email: 'qa@example.com',
    uuid: '00000000-0000-4000-8000-000000000000',
    'date-time': '2026-01-01T00:00:00.000Z',
    date: '2026-01-01',
    time: '00:00:00',
    uri: 'https://example.com',
    url: 'https://example.com',
    hostname: 'example.com',
    ipv4: '127.0.0.1',
    password: 'Password123!',
    byte: 'dGVzdA=='
};

function firstType(schema) {
    if (Array.isArray(schema.type)) return schema.type.find((t) => t !== 'null') || 'null';
    if (schema.type) return schema.type;
    if (schema.properties) return 'object';
    if (schema.items) return 'array';
    return undefined;
}

export function exampleFromSchema(schema, depth = 0) {
    if (!schema || typeof schema !== 'object' || depth > MAX_DEPTH) return null;
    if (schema.example !== undefined) return schema.example;
    if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
    if (schema.default !== undefined) return schema.default;
    if (schema.const !== undefined) return schema.const;
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];

    if (Array.isArray(schema.allOf) && schema.allOf.length) {
        const parts = schema.allOf.map((part) => exampleFromSchema(part, depth + 1));
        if (parts.every((p) => p && typeof p === 'object' && !Array.isArray(p))) {
            return Object.assign({}, ...parts);
        }
        return parts.find((p) => p != null) ?? null;
    }
    const choice = schema.oneOf || schema.anyOf;
    if (Array.isArray(choice) && choice.length) {
        const pick = choice.find((c) => c && c.type !== 'null') || choice[0];
        return exampleFromSchema(pick, depth + 1);
    }

    switch (firstType(schema)) {
        case 'string': {
            if (STRING_FORMATS[schema.format]) return STRING_FORMATS[schema.format];
            const min = Number(schema.minLength) || 0;
            return min > 6 ? 'x'.repeat(min) : 'string';
        }
        case 'integer':
            return typeof schema.minimum === 'number' ? Math.ceil(schema.minimum) : 1;
        case 'number':
            return typeof schema.minimum === 'number' ? schema.minimum : 1;
        case 'boolean':
            return true;
        case 'array': {
            const item = exampleFromSchema(schema.items || {}, depth + 1);
            const count = Math.max(1, Number(schema.minItems) || 0);
            return Array.from({ length: count }, () => item);
        }
        case 'object': {
            const props = schema.properties || {};
            const required = new Set(schema.required || []);
            const names = Object.keys(props).filter(
                (name) =>
                    required.size === 0 ||
                    required.has(name) ||
                    props[name]?.example !== undefined ||
                    props[name]?.default !== undefined
            );
            return Object.fromEntries(
                names
                    .filter((name) => !props[name]?.readOnly)
                    .map((name) => [name, exampleFromSchema(props[name], depth + 1)])
            );
        }
        default:
            return null;
    }
}

function exampleFromMedia(media) {
    if (!media) return undefined;
    if (media.example !== undefined) return media.example;
    const named = media.examples && Object.values(media.examples)[0];
    if (named && named.value !== undefined) return named.value;
    return exampleFromSchema(media.schema);
}

function paramValue(param) {
    if (param.example !== undefined) return param.example;
    const named = param.examples && Object.values(param.examples)[0];
    if (named && named.value !== undefined) return named.value;
    const schema = param.schema || {};
    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
    return undefined;
}

// ---------------------------------------------------------------------------
// Case generation
// ---------------------------------------------------------------------------

const varName = (name) => String(name).replace(/\W/g, '_').replace(/^(\d)/, '_$1');

function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value)
            .filter((key) => value[key] !== undefined)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value ?? null);
}

/** Hash of the content a tester can edit. Toggling active or the suite is not an edit. */
export function fingerprintCase(testCase) {
    const definition = { ...(testCase.definition || {}) };
    delete definition.openapi;
    const content = {
        name: testCase.name,
        precondition: testCase.precondition || '',
        input: testCase.input ?? null,
        expectedResult: testCase.expectedResult ?? null,
        definition,
        priority: testCase.priority
    };
    return createHash('sha1').update(stableStringify(content)).digest('hex');
}

function mapAuth(spec, operation) {
    if (typeof operation['x-cati-auth'] === 'string') return operation['x-cati-auth'];
    const security = operation.security ?? spec.security ?? [];
    if (!Array.isArray(security) || security.length === 0) return 'public';
    // An empty requirement ({}) means authentication is optional.
    if (security.some((req) => req && Object.keys(req).length === 0)) return 'public';

    const schemes = spec.components?.securitySchemes || {};
    const name = Object.keys(security[0])[0];
    const scheme = deref(spec, schemes[name]) || {};
    if (scheme.type === 'http' && String(scheme.scheme).toLowerCase() === 'bearer') return 'jwt';
    if (scheme.type === 'apiKey' && String(scheme.name).toLowerCase() === 'x-internal-api-key') {
        return 'internal-key';
    }
    return 'custom';
}

function jsonMedia(content) {
    if (!content) return null;
    const key = Object.keys(content).find((type) => /^application\/(.+\+)?json/i.test(type));
    return key ? content[key] : null;
}

function successResponse(responses = {}) {
    const codes = Object.keys(responses)
        .filter((code) => /^2\d\d$/.test(code))
        .sort();
    if (codes.length) return { code: codes[0], response: responses[codes[0]] };
    if (responses['2XX']) return { code: null, response: responses['2XX'] };
    return { code: null, response: null };
}

function mergeParameters(pathLevel = [], operationLevel = []) {
    const byKey = new Map();
    for (const param of [...pathLevel, ...operationLevel]) {
        if (param && param.name && param.in) byKey.set(`${param.in}:${param.name}`, param);
    }
    return [...byKey.values()];
}

export function buildCasesFromSpec(spec) {
    const title = spec.info?.title || 'OpenAPI';
    const version = spec.info?.version || '';
    const seen = new Set();
    const cases = [];

    for (const [rawPath, rawItem] of Object.entries(spec.paths)) {
        const pathItem = deref(spec, rawItem) || {};
        for (const method of HTTP_METHODS) {
            const operation = pathItem[method];
            if (!operation || typeof operation !== 'object') continue;

            const METHOD = method.toUpperCase();
            const params = mergeParameters(pathItem.parameters, operation.parameters);
            const variables = {};
            const headers = {};
            const query = [];

            let endpoint = rawPath.replace(/\{([^}]+)\}/g, (match, name) => `:${varName(name)}`);
            for (const param of params) {
                const name = varName(param.name);
                const value = paramValue(param);
                if (param.in === 'path') {
                    variables[name] = value === undefined ? '' : String(value);
                } else if (param.in === 'query' && param.required) {
                    variables[name] = value === undefined ? String(exampleFromSchema(param.schema) ?? '') : String(value);
                    query.push(`${encodeURIComponent(param.name)}={{${name}}}`);
                } else if (param.in === 'header' && param.required) {
                    if (/^(authorization|content-type|accept)$/i.test(param.name)) continue;
                    variables[name] = value === undefined ? '' : String(value);
                    headers[param.name] = `{{${name}}}`;
                }
            }
            if (query.length) endpoint += `?${query.join('&')}`;

            const requestContent = operation.requestBody?.content || {};
            const requestMedia = jsonMedia(requestContent);
            const multipart = !requestMedia && Object.keys(requestContent).some((t) => /multipart|form-urlencoded/i.test(t));
            const body = requestMedia ? exampleFromMedia(requestMedia) ?? null : null;

            const { code, response } = successResponse(operation.responses);
            const responseMedia = jsonMedia(response?.content);
            const responseSchema = responseMedia?.schema ? normalizeSchema(responseMedia.schema) : null;

            const auth = mapAuth(spec, operation);
            const risk = classifyEndpoint({ method: METHOD, path: endpoint, multipart, auth });
            const missingPathValues = Object.entries(variables).some(
                ([name, value]) => value === '' && endpoint.includes(`:${name}`)
            );
            const finalRisk = risk.filter((r) => r !== 'needs-path-params' || missingPathValues);
            if (operation.deprecated) finalRisk.push('deprecated');

            const expectedResult = code
                ? [{ kind: 'status', expected: code }, ...(responseSchema ? [{ kind: 'schema' }] : [])]
                : [{ kind: 'statusBelow', expected: response ? '400' : '500' }];

            const operationKey = operation.operationId
                ? String(operation.operationId).replace(/[^A-Za-z0-9_-]+/g, '-')
                : `${METHOD}-${slug(rawPath.replace(/\{([^}]+)\}/g, ':$1')) || 'root'}`;
            let testCaseId = `OA-${operationKey}`;
            for (let n = 2; seen.has(testCaseId); n += 1) testCaseId = `OA-${operationKey}-${n}`;
            seen.add(testCaseId);

            const testCase = {
                testCaseId,
                name: operation.summary ? `${METHOD} ${rawPath} - ${operation.summary}` : `${METHOD} ${rawPath}`,
                type: 'API',
                precondition:
                    auth === 'public'
                        ? ''
                        : `Requires ${auth} credentials (configured on the platform, never stored in the case).`,
                input: { method: METHOD, endpoint, headers, body },
                definition: {
                    source: 'openapi',
                    auth,
                    risk: finalRisk,
                    variables,
                    responseSchema
                },
                expectedResult,
                priority: auth === 'public' && finalRisk.length === 0 ? 'MEDIUM' : 'LOW',
                active: finalRisk.length === 0
            };
            testCase.definition.openapi = {
                specTitle: title,
                specVersion: version,
                operationId: operation.operationId || null,
                method: METHOD,
                path: rawPath,
                tags: operation.tags || [],
                fingerprint: fingerprintCase(testCase)
            };
            cases.push(testCase);
        }
    }
    return cases;
}

// ---------------------------------------------------------------------------
// Re-sync planning
// ---------------------------------------------------------------------------

/**
 * Decides what happens to every generated and existing case. Pure: it does
 * not touch the database, so a dry run and the real import agree.
 *
 * @param {object[]} generated  output of buildCasesFromSpec
 * @param {object[]} existing   stored cases with a generated id, or from the same spec
 * @param {string}   specTitle
 */
export function planOpenApiImport(generated, existing, specTitle) {
    const byId = new Map(existing.map((c) => [c.testCaseId, c]));
    const generatedIds = new Set(generated.map((c) => c.testCaseId));
    const plan = { create: [], update: [], unchanged: [], keptEdited: [], removed: [], adopt: [] };

    for (const next of generated) {
        const current = byId.get(next.testCaseId);
        if (!current) {
            plan.create.push(next);
            continue;
        }
        // Loose cases from an earlier import join the bundle; cases a tester
        // already filed in another suite stay where they are.
        if (!current.suiteId) plan.adopt.push(current);
        const meta = current.definition?.openapi;
        const untouched =
            current.definition?.source === 'openapi' && meta?.fingerprint === fingerprintCase(current);
        if (!untouched) {
            plan.keptEdited.push(current);
        } else if (meta.fingerprint === next.definition.openapi.fingerprint && !meta.removed) {
            plan.unchanged.push(current);
        } else {
            plan.update.push({
                ...next,
                // A tester may have switched a case on or off; keep that, unless
                // the case is coming back after being removed from the spec.
                active: meta.removed ? next.active : current.active
            });
        }
    }

    for (const current of existing) {
        if (generatedIds.has(current.testCaseId)) continue;
        const meta = current.definition?.openapi;
        if (current.definition?.source !== 'openapi' || meta?.specTitle !== specTitle || meta?.removed) continue;
        plan.removed.push(current);
    }
    return plan;
}

/**
 * Picks the suite name for a new bundle. `taken` is the set of existing suite
 * names (suite names are unique), so a clash with a hand-made suite gets a
 * suffix instead of failing the import.
 */
export function pickBundleName(wanted, taken) {
    const base = String(wanted || '').trim() || 'OpenAPI';
    if (!taken.has(base)) return base;
    for (const candidate of [`${base} (OpenAPI)`, ...Array.from({ length: 50 }, (_, i) => `${base} (OpenAPI ${i + 2})`)]) {
        if (!taken.has(candidate)) return candidate;
    }
    return `${base} (OpenAPI ${Date.now()})`;
}

/**
 * Finds the bundle (suite) for a spec, or describes the one to create.
 * Reuse is keyed on the spec title, so re-importing a newer version of the
 * same API lands in the same bundle. `suiteId` forces a specific suite.
 */
export async function findBundle({ specTitle, suiteId }) {
    if (suiteId) {
        const forced = await TestSuite.findById(suiteId).lean();
        if (!forced) throw new Error(`No bundle found with id "${suiteId}".`);
        return forced;
    }
    return TestSuite.findOne({ 'source.kind': 'openapi', 'source.specTitle': specTitle }).lean();
}

const summarize = (c) => ({
    testCaseId: c.testCaseId,
    name: c.name,
    active: c.active,
    risk: c.definition?.risk || []
});

/**
 * Parses, plans and (unless dryRun) applies an OpenAPI import.
 */
export async function importOpenApi(raw, { dryRun = false, suiteId = null, bundleName = null, fileName = null } = {}) {
    const spec = parseSpec(raw);
    const generated = buildCasesFromSpec(spec);
    const specTitle = spec.info?.title || 'OpenAPI';
    const specVersion = spec.info?.version || '';

    const existing = await TestCase.find({
        $or: [
            { testCaseId: { $in: generated.map((c) => c.testCaseId) } },
            { 'definition.source': 'openapi', 'definition.openapi.specTitle': specTitle }
        ]
    }).lean();

    const plan = planOpenApiImport(generated, existing, specTitle);

    let bundle = await findBundle({ specTitle, suiteId });
    const bundleCreated = !bundle;
    const source = { kind: 'openapi', specTitle, specVersion, fileName, importedAt: new Date().toISOString() };
    let bundleInfo;
    if (bundleCreated) {
        const taken = new Set((await TestSuite.find().select('name').lean()).map((s) => s.name));
        bundleInfo = { id: null, name: pickBundleName(bundleName || specTitle, taken), created: true };
    } else {
        bundleInfo = { id: String(bundle._id), name: bundle.name, created: false };
    }

    if (!dryRun) {
        if (bundleCreated) {
            bundle = await TestSuite.create({
                name: bundleInfo.name,
                type: 'API',
                description: `Imported from OpenAPI "${specTitle}" ${specVersion}`.trim(),
                source
            });
            bundleInfo.id = String(bundle._id);
        } else {
            await TestSuite.updateOne(
                { _id: bundle._id },
                { $set: { 'source.specVersion': specVersion, 'source.importedAt': source.importedAt, ...(fileName ? { 'source.fileName': fileName } : {}) } }
            );
            if (!bundle.source) await TestSuite.updateOne({ _id: bundle._id }, { $set: { source } });
        }

        if (plan.create.length) {
            await TestCase.insertMany(
                plan.create.map((c) => ({ ...c, suiteId: bundle._id })),
                { ordered: false }
            );
        }
        const ops = [
            ...plan.adopt.map((c) => ({
                updateOne: { filter: { testCaseId: c.testCaseId, suiteId: null }, update: { $set: { suiteId: bundle._id } } }
            })),
            ...plan.update.map((c) => ({
                updateOne: {
                    filter: { testCaseId: c.testCaseId },
                    update: {
                        $set: {
                            name: c.name,
                            precondition: c.precondition,
                            input: c.input,
                            definition: c.definition,
                            expectedResult: c.expectedResult,
                            priority: c.priority,
                            active: c.active
                        }
                    }
                }
            })),
            ...plan.removed.map((c) => ({
                updateOne: {
                    filter: { testCaseId: c.testCaseId },
                    update: {
                        $set: {
                            active: false,
                            'definition.openapi.removed': true,
                            'definition.openapi.removedAt': new Date().toISOString()
                        }
                    }
                }
            }))
        ];
        if (ops.length) await TestCase.bulkWrite(ops, { ordered: false });
    }

    return {
        dryRun,
        spec: { title: specTitle, version: specVersion, openapi: spec.openapi },
        bundle: bundleInfo,
        adopted: plan.adopt.length,
        total: generated.length,
        created: plan.create.length,
        updated: plan.update.length,
        unchanged: plan.unchanged.length,
        keptEdited: plan.keptEdited.length,
        removed: plan.removed.length,
        inactiveForReview: plan.create.filter((c) => !c.active).length,
        preview: {
            create: plan.create.map(summarize),
            update: plan.update.map(summarize),
            keptEdited: plan.keptEdited.map(summarize),
            removed: plan.removed.map(summarize)
        }
    };
}
