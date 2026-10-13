import mongoose from 'mongoose';

const { Schema } = mongoose;

export const TEST_RESULT_STATUS = Object.freeze({
    PASS: 'PASS',
    FAIL: 'FAIL',
    SKIPPED: 'SKIPPED'
});

export const TEST_SUITES = Object.freeze({
    API: 'API',
    UI: 'UI',
    E2E: 'E2E',
    WEBSOCKET: 'WEBSOCKET',
    AI_VOICE: 'AI_VOICE'
});

const evidenceSchema = new Schema(
    {
        screenshot: { type: String, default: null },
        trace: { type: String, default: null },
        video: { type: String, default: null },
        consoleLogs: { type: String, default: null },
        networkInfo: { type: String, default: null },
        // Request/response and WebSocket message logs, per the master flow
        // document's evidence list. Mixed so a request/response body of any
        // shape (JSON, plain text) can be stored as-is.
        request: { type: Schema.Types.Mixed, default: null },
        response: { type: Schema.Types.Mixed, default: null },
        websocketLogs: { type: Schema.Types.Mixed, default: null }
    },
    { _id: false, strict: false } // strict:false keeps evidence extensible
);

const testResultSchema = new Schema(
    {
        runId: {
            type: String,
            required: true,
            index: true
        },
        testCaseId: {
            // Links back to the TestCase this result came from, when the
            // run was driven by a stored test case rather than a raw
            // Playwright spec file. Null for legacy/ad-hoc results.
            type: Schema.Types.ObjectId,
            ref: 'TestCase',
            default: null,
            index: true
        },
        testName: {
            type: String,
            required: true
        },
        suite: {
            type: String,
            enum: Object.values(TEST_SUITES),
            required: true,
            index: true
        },
        environment: {
            type: String,
            default: null
        },
        status: {
            type: String,
            enum: Object.values(TEST_RESULT_STATUS),
            required: true,
            index: true
        },
        duration: { type: Number, default: 0 },
        error: { type: String, default: null },
        expected: { type: Schema.Types.Mixed, default: null },
        actual: { type: Schema.Types.Mixed, default: null },
        endpoint: { type: String, default: null },
        page: { type: String, default: null },
        evidence: { type: evidenceSchema, default: () => ({}) }
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('TestResult', testResultSchema);
