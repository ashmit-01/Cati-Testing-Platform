import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    buildCasesFromSpec,
    exampleFromSchema,
    fingerprintCase,
    normalizeSchema,
    parseSpec,
    pickBundleName,
    planOpenApiImport
} from '../services/openApiImportService.js';
import { evaluateApiAssertions } from '../services/playwrightCaseExecutor.js';
import { normalizeTargetUrl } from '../services/targetUrl.js';

const SPEC = {
    openapi: '3.0.3',
    info: { title: 'CATI Backend', version: '1.4.0' },
    security: [{ bearerAuth: [] }],
    components: {
        securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer' },
            internalKey: { type: 'apiKey', in: 'header', name: 'x-internal-api-key' }
        },
        schemas: {
            Agent: {
                type: 'object',
                required: ['id', 'name'],
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string', example: 'Support bot' },
                    description: { type: 'string', nullable: true },
                    parent: { $ref: '#/components/schemas/Agent' }
                }
            },
            NewAgent: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string' }, language: { type: 'string', default: 'en' } }
            }
        }
    },
    paths: {
        '/api/health': {
            get: {
                operationId: 'getHealth',
                security: [],
                responses: {
                    200: {
                        description: 'ok',
                        content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } }
                    }
                }
            }
        },
        '/api/agents': {
            get: {
                operationId: 'listAgents',
                parameters: [{ name: 'page', in: 'query', required: true, schema: { type: 'integer', default: 1 } }],
                responses: {
                    200: {
                        description: 'list',
                        content: {
                            'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Agent' } } }
                        }
                    }
                }
            },
            post: {
                summary: 'Create agent',
                requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/NewAgent' } } } },
                responses: { 201: { description: 'created' } }
            }
        },
        '/api/agents/{agentId}': {
            parameters: [{ name: 'agentId', in: 'path', required: true, schema: { type: 'string' } }],
            get: {
                operationId: 'getAgent',
                responses: {
                    200: { description: 'one', content: { 'application/json': { schema: { $ref: '#/components/schemas/Agent' } } } }
                }
            }
        },
        '/internal/sync': {
            get: {
                operationId: 'internalSync',
                security: [{ internalKey: [] }],
                responses: { default: { description: 'any' } }
            }
        }
    }
};

const byId = (cases) => Object.fromEntries(cases.map((c) => [c.testCaseId, c]));

test('parseSpec accepts YAML text and rejects Swagger 2.0', () => {
    const spec = parseSpec('openapi: 3.1.0\ninfo:\n  title: T\n  version: "1"\npaths: {}\n');
    assert.equal(spec.openapi, '3.1.0');
    assert.throws(() => parseSpec({ swagger: '2.0', paths: {} }), /Swagger 2.0/);
    assert.throws(() => parseSpec({ foo: 1 }), /OpenAPI 3/);
});

test('buildCasesFromSpec generates one case per operation', () => {
    const cases = byId(buildCasesFromSpec(SPEC));
    assert.deepEqual(Object.keys(cases).sort(), [
        'OA-POST-api-agents',
        'OA-getAgent',
        'OA-getHealth',
        'OA-internalSync',
        'OA-listAgents'
    ]);

    const health = cases['OA-getHealth'];
    assert.equal(health.definition.auth, 'public');
    assert.equal(health.active, true);
    assert.deepEqual(health.expectedResult, [{ kind: 'status', expected: '200' }, { kind: 'schema' }]);

    const list = cases['OA-listAgents'];
    assert.equal(list.definition.auth, 'jwt');
    assert.equal(list.input.endpoint, '/api/agents?page={{page}}');
    assert.equal(list.definition.variables.page, '1');
    // Recursive $ref is cut, nullable becomes a JSON Schema type union.
    assert.deepEqual(list.definition.responseSchema.items.properties.description.type, ['string', 'null']);

    const create = cases['OA-POST-api-agents'];
    assert.deepEqual(create.input.body, { name: 'string', language: 'en' });
    assert.equal(create.active, false, 'mutating cases start inactive');
    assert.deepEqual(create.expectedResult, [{ kind: 'status', expected: '201' }]);

    const one = cases['OA-getAgent'];
    assert.equal(one.input.endpoint, '/api/agents/:agentId');
    assert.equal(one.active, false, 'path param without example starts inactive');
    assert.ok(one.definition.risk.includes('needs-path-params'));

    const sync = cases['OA-internalSync'];
    assert.equal(sync.definition.auth, 'internal-key');
    assert.deepEqual(sync.expectedResult, [{ kind: 'statusBelow', expected: '500' }]);
});

test('exampleFromSchema follows formats, required props and allOf', () => {
    assert.equal(exampleFromSchema({ type: 'string', format: 'email' }), 'qa@example.com');
    assert.deepEqual(
        exampleFromSchema({
            allOf: [
                { type: 'object', required: ['a'], properties: { a: { type: 'integer' } } },
                { type: 'object', required: ['b'], properties: { b: { type: 'boolean' } } }
            ]
        }),
        { a: 1, b: true }
    );
});

test('normalizeSchema converts boolean exclusiveMinimum', () => {
    assert.deepEqual(normalizeSchema({ type: 'number', minimum: 0, exclusiveMinimum: true }), {
        type: 'number',
        exclusiveMinimum: 0
    });
});

test('planOpenApiImport updates untouched, keeps edited, deactivates removed', () => {
    const first = buildCasesFromSpec(SPEC);
    const stored = first.map((c) => ({ ...c, active: true }));
    const edited = stored.find((c) => c.testCaseId === 'OA-getHealth');
    edited.expectedResult = [{ kind: 'status', expected: '204' }];

    const changed = structuredClone(SPEC);
    delete changed.paths['/internal/sync'];
    changed.paths['/api/agents'].get.summary = 'List agents';
    changed.paths['/api/agents'].get.parameters[0].schema.default = 2;
    changed.paths['/api/teams'] = { get: { operationId: 'listTeams', responses: { 200: { description: 'ok' } } } };

    const plan = planOpenApiImport(buildCasesFromSpec(changed), stored, 'CATI Backend');
    const ids = (list) => list.map((c) => c.testCaseId).sort();

    assert.deepEqual(ids(plan.create), ['OA-listTeams']);
    assert.deepEqual(ids(plan.update), ['OA-listAgents']);
    assert.equal(plan.update[0].active, true, 'tester-enabled case stays enabled');
    assert.equal(plan.update[0].definition.variables.page, '2');
    assert.deepEqual(ids(plan.keptEdited), ['OA-getHealth']);
    assert.deepEqual(ids(plan.removed), ['OA-internalSync']);
    assert.deepEqual(ids(plan.unchanged), ['OA-POST-api-agents', 'OA-getAgent']);
});

test('fingerprint ignores active and suite changes', () => {
    const [c] = buildCasesFromSpec(SPEC);
    assert.equal(fingerprintCase({ ...c, active: false, suiteId: 'x' }), c.definition.openapi.fingerprint);
});

test('schema assertion passes and fails against the stored schema', () => {
    const definition = {
        responseSchema: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string', format: 'uuid' } }
        }
    };
    const assertions = [{ kind: 'status', expected: '200' }, { kind: 'schema' }];

    const ok = evaluateApiAssertions(assertions, 200, { id: '00000000-0000-4000-8000-000000000000' }, definition);
    assert.equal(ok.actualText, ok.expectedText);

    const bad = evaluateApiAssertions(assertions, 200, { id: 'nope' }, definition);
    assert.match(bad.actualText, /schema mismatch: \/id must match format "uuid"/);

    const missing = evaluateApiAssertions([{ kind: 'schema' }], 200, {}, {});
    assert.match(missing.actualText, /no response schema/);
});

test('normalizeTargetUrl validates and applies the allowlist', () => {
    assert.equal(normalizeTargetUrl(''), null);
    assert.equal(normalizeTargetUrl('http://localhost:5000/'), 'http://localhost:5000');
    assert.equal(normalizeTargetUrl('https://pr-12.example.com/base/'), 'https://pr-12.example.com/base');
    assert.throws(() => normalizeTargetUrl('ftp://x'), /http/);
    assert.throws(() => normalizeTargetUrl('https://u:p@x.com'), /credentials/);
    assert.equal(normalizeTargetUrl('https://a.sslip.io', 'localhost,*.sslip.io'), 'https://a.sslip.io');
    assert.throws(() => normalizeTargetUrl('https://evil.com', 'localhost,*.sslip.io'), /ALLOWLIST/);
});

test('planOpenApiImport adopts unassigned cases but not ones in another suite', () => {
    const stored = buildCasesFromSpec(SPEC).map((c) => ({ ...c, suiteId: null }));
    stored.find((c) => c.testCaseId === 'OA-getHealth').suiteId = 'other-suite';
    // an edited, unassigned case is still adopted
    stored.find((c) => c.testCaseId === 'OA-getAgent').name = 'renamed by tester';

    const plan = planOpenApiImport(buildCasesFromSpec(SPEC), stored, 'CATI Backend');
    const adopted = plan.adopt.map((c) => c.testCaseId).sort();
    assert.ok(!adopted.includes('OA-getHealth'));
    assert.ok(adopted.includes('OA-getAgent'));
    assert.equal(adopted.length, stored.length - 1);
});

test('pickBundleName avoids names taken by other suites', () => {
    assert.equal(pickBundleName('CATI Backend', new Set()), 'CATI Backend');
    assert.equal(pickBundleName('CATI Backend', new Set(['CATI Backend'])), 'CATI Backend (OpenAPI)');
    assert.equal(
        pickBundleName('CATI Backend', new Set(['CATI Backend', 'CATI Backend (OpenAPI)'])),
        'CATI Backend (OpenAPI 2)'
    );
    assert.equal(pickBundleName('  ', new Set()), 'OpenAPI');
});
