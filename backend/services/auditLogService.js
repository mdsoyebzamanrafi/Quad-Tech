import AuditLog from '../models/AuditLog.js';

const logAudit = async ({
    actorUserId = null,
    actorRole = null,
    action,
    entityType,
    entityId,
    oldValue = null,
    newValue = null,
    note = null,
    session = null,
}) => {
    const payload = {
        actorUser: actorUserId,
        actorRole,
        action,
        entityType,
        entityId: String(entityId),
        oldValue,
        newValue,
        note,
    };

    await AuditLog.create([payload], { session });
};

const getAuditTrail = async ({ entityType, entityId, limit = 100 }) => {
    return AuditLog.find({ entityType, entityId: String(entityId) })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

export { logAudit, getAuditTrail };
