
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const FAILURE_STATUS = Object.freeze({
    OPEN: 'OPEN',
    RESOLVED: 'RESOLVED',
    IGNORED: 'IGNORED'
});

export const FAILURE_SEVERITY = Object.freeze({
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
});

export const FAILURE_CATEGORY = Object.freeze({
    FUNCTIONAL: 'FUNCTIONAL',
    API: 'API',
    UI: 'UI',
    AUTHENTICATION: 'AUTHENTICATION',
    WEBSOCKET: 'WEBSOCKET',
    VOICE: 'VOICE',
    VALIDATION: 'VALIDATION',
    PERFORMANCE: 'PERFORMANCE',
    OTHER: 'OTHER'
});

export const AI_ANALYSIS_STATUS = Object.freeze({
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
});

export const AI_ANALYSIS_CONFIDENCE = Object.freeze({
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High'
});

/**
 * LLM-generated analysis of a failure's evidence.
 * Analysis is advisory and never changes the failure status.
 */
const aiAnalysisSchema = new Schema(
    {
        status: {
            type: String,
            enum: Object.values(AI_ANALYSIS_STATUS),
            default: null
        },
        probableCause: { type: String, default: null },
        supportingEvidence: { type: String, default: null },
        suggestedFix: { type: String, default: null },
        confidence: {
            type: String,
            enum: Object.values(AI_ANALYSIS_CONFIDENCE),
            default: null
        },
        additionalInfoNeeded: { type: String, default: null },
        error: { type: String, default: null },
        provider: { type: String, default: null },
        model: { type: String, default: null },
        attempts: { type: Number, default: 0 },
        requestedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null }
    },
    { _id: false }
);

const failureSchema = new Schema(
    {
        runId: {
            type: String,
            required: true,
            index: true
        },

        testResultId: {
            type: Schema.Types.ObjectId,
            ref: 'TestResult',
            required: true
        },

        title: {
            type: String,
            required: true
        },

        description: {
            type: String,
            default: ''
        },

        severity: {
            type: String,
            enum: Object.values(FAILURE_SEVERITY),
            required: true,
            index: true
        },

        category: {
            type: String,
            enum: Object.values(FAILURE_CATEGORY),
            default: FAILURE_CATEGORY.OTHER,
            index: true
        },

        status: {
            type: String,
            enum: Object.values(FAILURE_STATUS),
            default: FAILURE_STATUS.OPEN,
            index: true
        },

        evidence: {
            type: Schema.Types.Mixed,
            default: () => ({})
        },

        aiAnalysis: {
            type: aiAnalysisSchema,
            default: () => ({})
        }
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: false
        }
    }
);

/**
 * Prevent multiple Failure documents from referencing
 * the same TestResult.
 */
failureSchema.index(
    { testResultId: 1 },
    {
        unique: true,
        name: 'unique_failure_per_test_result'
    }
);

export default mongoose.model('Failure', failureSchema);
