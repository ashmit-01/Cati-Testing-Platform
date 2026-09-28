import mongoose from 'mongoose';
import { TEST_SUITES } from './TestResult.js';

const { Schema } = mongoose;

/**
 * TestSuite — a named, stored grouping of test cases, per the master flow
 * document's examples ("WebSocket Suite: Connection, Authentication,
 * Vobiz, AI Engine, Audio", "AI Suite: Greeting, Intent, Context...").
 *
 * Membership is stored on the TestCase side (`TestCase.suiteId`) rather
 * than as an array here, so adding/removing a case from a suite is a
 * single-document update instead of keeping two collections in sync.
 */
const testSuiteSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        type: {
            // The suite's primary execution type. A suite is normally
            // homogeneous (all WEBSOCKET cases, all UI cases, etc.), which
            // is what lets testRunnerService pick one execution method
            // for the whole suite.
            type: String,
            enum: Object.values(TEST_SUITES),
            required: true,
            index: true
        },
        description: {
            type: String,
            default: ''
        }
    },
    { timestamps: true }
);

export default mongoose.model('TestSuite', testSuiteSchema);
