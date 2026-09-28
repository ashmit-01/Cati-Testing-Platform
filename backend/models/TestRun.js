import mongoose from 'mongoose';

const { Schema } = mongoose;

export const TEST_RUN_STATUS = Object.freeze({
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
});

const testRunSchema = new Schema(
    {
        runId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        environment: {
            type: String,
            required: true,
            trim: true
        },
        suites: {
            // Legacy: which suite-folder enums were requested, e.g. ['UI', 'API'].
            // Empty/omitted means "all available suites". Mutually exclusive
            // with suiteId/testCaseIds below in practice, but not enforced,
            // since a run only ever uses one execution path.
            type: [String],
            default: []
        },
        suiteId: {
            // DB-driven: the stored TestSuite this run executed, if any.
            type: Schema.Types.ObjectId,
            ref: 'TestSuite',
            default: null
        },
        testCaseIds: {
            // DB-driven: specific stored TestCases this run executed, if any.
            type: [Schema.Types.ObjectId],
            ref: 'TestCase',
            default: []
        },
        status: {
            type: String,
            enum: Object.values(TEST_RUN_STATUS),
            default: TEST_RUN_STATUS.RUNNING,
            index: true
        },
        startedAt: {
            type: Date,
            default: Date.now
        },
        completedAt: {
            type: Date,
            default: null
        },
        totalTests: { type: Number, default: 0 },
        passed: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        skipped: { type: Number, default: 0 },
        duration: { type: Number, default: 0 }, // milliseconds
        executionMode: {
            // 'mock' or 'playwright' — which runner path produced this run.
            type: String,
            default: 'unknown'
        },
        error: {
            // Populated only if the run failed unexpectedly (crash, not a
            // normal test FAIL).
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

export default mongoose.model('TestRun', testRunSchema);
