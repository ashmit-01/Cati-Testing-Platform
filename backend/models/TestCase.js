import mongoose from 'mongoose';
import { TEST_SUITES } from './TestResult.js';

const { Schema } = mongoose;

export const TEST_CASE_PRIORITY = Object.freeze({
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
});

/**
 * TestCase — the thing a QA person defines, per the master flow document's
 * Step 1 ("Create the test case") and Step 2 ("Group tests into suites").
 *
 * This is deliberately independent of *how* a case gets executed.
 * `type` decides the execution method in testRunnerService (UI -> a
 * matching Playwright spec if one exists, everything else -> the generic
 * comparator in resultCheckerService until a dedicated engine exists for
 * that type — see WebSocket/AI_VOICE notes in the README).
 */
const testCaseSchema = new Schema(
    {
        testCaseId: {
            // Application-level id, e.g. "WS-001", matching the document's
            // examples. Distinct from Mongo's _id, same convention as
            // TestRun.runId.
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            enum: Object.values(TEST_SUITES),
            required: true,
            index: true
        },
        suiteId: {
            // A test case can exist without being assigned to a suite yet.
            type: Schema.Types.ObjectId,
            ref: 'TestSuite',
            default: null,
            index: true
        },
        precondition: {
            type: String,
            default: ''
        },
        input: {
            type: Schema.Types.Mixed,
            default: null
        },
        expectedResult: {
            type: Schema.Types.Mixed,
            required: true
        },
        priority: {
            type: String,
            enum: Object.values(TEST_CASE_PRIORITY),
            default: TEST_CASE_PRIORITY.MEDIUM
        },
        active: {
            // Soft-disable a case without deleting its history — inactive
            // cases are skipped when a suite/run is executed.
            type: Boolean,
            default: true,
            index: true
        }
    },
    { timestamps: true }
);

export default mongoose.model('TestCase', testCaseSchema);
