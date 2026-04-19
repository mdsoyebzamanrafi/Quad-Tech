import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
    {
        actorUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        actorRole: {
            type: String,
            default: null,
        },
        action: {
            type: String,
            required: true,
            index: true,
        },
        entityType: {
            type: String,
            required: true,
            index: true,
        },
        entityId: {
            type: String,
            required: true,
            index: true,
        },
        oldValue: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        newValue: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        note: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
