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
        evidence: { type: Schema.Types.Mixed, default: () => ({}) }
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('Failure', failureSchema);
