import mongoose from 'mongoose';
import ApiError from '../errors/ApiError.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import {
    AUDIT_ACTIONS,
    AUDIT_ENTITY_TYPES,
    USER_ROLES,
    USER_STATUSES,
} from '../constants/domainConstants.js';
import {
    requireObjectId,
    toRoundedCurrency,
} from '../validators/commonValidators.js';
import {
    validateUserListFilters,
    validateUserRoleInput,
    validateUserStatusInput,
} from '../validators/featureValidators.js';
import { logAudit } from './auditLogService.js';

const sanitizeUser = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    rewardTokens: user.rewardTokens ?? 0,
    lifetimeSpent: user.lifetimeSpent ?? 0,
    totalOrders: user.totalOrders ?? 0,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
    isVerified: user.isVerified,
    isAdmin: user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.SUPER_ADMIN,
});

const countOtherActiveSuperAdmins = async (excludeUserId, session = null) => {
    return User.countDocuments({
        _id: { $ne: excludeUserId },
        role: USER_ROLES.SUPER_ADMIN,
        status: USER_STATUSES.ACTIVE,
        deletedAt: null,
    }).session(session);
};

const countOtherSuperAdmins = async (excludeUserId, session = null) => {
    return User.countDocuments({
        _id: { $ne: excludeUserId },
        role: USER_ROLES.SUPER_ADMIN,
        status: { $ne: USER_STATUSES.DELETED },
        deletedAt: null,
    }).session(session);
};

const assertNotLastActiveSuperAdmin = async (targetUser, session = null) => {
    if (targetUser.role !== USER_ROLES.SUPER_ADMIN || targetUser.status !== USER_STATUSES.ACTIVE || targetUser.deletedAt) {
        return;
    }

    const remaining = await countOtherActiveSuperAdmins(targetUser._id, session);
    if (remaining === 0) {
        throw new ApiError(400, 'Operation blocked: cannot remove or demote the last active super admin');
    }
};

const assertNotLastSuperAdmin = async (targetUser, session = null) => {
    if (targetUser.role !== USER_ROLES.SUPER_ADMIN || targetUser.status === USER_STATUSES.DELETED || targetUser.deletedAt) {
        return;
    }

    const remaining = await countOtherSuperAdmins(targetUser._id, session);
    if (remaining === 0) {
        throw new ApiError(400, 'Operation blocked: cannot remove or demote the last super admin');
    }
};

const listUsersForAdmin = async ({ query }) => {
    const filters = validateUserListFilters(query);
    const mongoQuery = {};

    if (!filters.includeDeleted) {
        mongoQuery.status = { $ne: USER_STATUSES.DELETED };
        mongoQuery.deletedAt = null;
    }

    if (filters.role) {
        mongoQuery.role = filters.role;
    }

    if (filters.status) {
        mongoQuery.status = filters.status;
    }

    if (filters.search) {
        const regex = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        mongoQuery.$or = [
            { name: regex },
            { email: regex },
            { phone: regex },
        ];
    }

    const allowedSort = new Set(['createdAt', 'updatedAt', 'name', 'email', 'lastLogin', 'role', 'status']);
    const sortField = allowedSort.has(filters.sortBy) ? filters.sortBy : 'createdAt';
    const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
        User.find(mongoQuery)
            .select('-password -resetPasswordToken -resetPasswordExpire -otpCode')
            .sort({ [sortField]: sortDirection })
            .skip(filters.pagination.skip)
            .limit(filters.pagination.limit)
            .lean(),
        User.countDocuments(mongoQuery),
    ]);

    return {
        items: users.map(sanitizeUser),
        pagination: {
            page: filters.pagination.page,
            limit: filters.pagination.limit,
            total,
            pages: Math.ceil(total / filters.pagination.limit) || 1,
        },
    };
};

const getUserAdminDetails = async ({ userId }) => {
    requireObjectId(userId, 'userId');

    const user = await User.findById(userId)
        .select('-password -resetPasswordToken -resetPasswordExpire -otpCode')
        .lean();

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const [summary] = await Order.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$user',
                totalOrders: { $sum: 1 },
                totalSpent: { $sum: '$total' },
                lastOrderAt: { $max: '$createdAt' },
            },
        },
    ]);

    const recentOrders = await Order.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderStatus paymentStatus total createdAt updatedAt')
        .lean();

    return {
        user: sanitizeUser(user),
        orderSummary: {
            totalOrders: summary?.totalOrders || 0,
            totalSpent: toRoundedCurrency(summary?.totalSpent || 0),
            lastOrderAt: summary?.lastOrderAt || null,
            recentOrders,
        },
    };
};

const updateUserStatusByAdmin = async ({ actor, userId, status, note }) => {
    requireObjectId(userId, 'userId');
    const targetStatus = validateUserStatusInput(status);

    if (targetStatus === USER_STATUSES.DELETED) {
        throw new ApiError(400, 'Use soft-delete endpoint for deleted status');
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const user = await User.findById(userId).session(session);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        if (String(actor._id) === String(user._id) && targetStatus !== USER_STATUSES.ACTIVE) {
            throw new ApiError(400, 'You cannot set your own account to a non-active status');
        }

        if (user.status === USER_STATUSES.DELETED || user.deletedAt) {
            throw new ApiError(400, 'Deleted users cannot be modified');
        }

        if (user.status === targetStatus) {
            await session.commitTransaction();
            return sanitizeUser(user.toObject());
        }

        if (targetStatus !== USER_STATUSES.ACTIVE && user.role === USER_ROLES.SUPER_ADMIN) {
            await assertNotLastSuperAdmin(user, session);
            await assertNotLastActiveSuperAdmin(user, session);
        }

        const oldStatus = user.status;
        user.status = targetStatus;
        await user.save({ session });

        await logAudit({
            actorUserId: actor._id,
            actorRole: actor.role,
            action: AUDIT_ACTIONS.USER_STATUS_UPDATED,
            entityType: AUDIT_ENTITY_TYPES.USER,
            entityId: user._id,
            oldValue: { status: oldStatus },
            newValue: { status: user.status },
            note: note || null,
            session,
        });

        await session.commitTransaction();
        return sanitizeUser(user.toObject());
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const updateUserRoleBySuperAdmin = async ({ actor, userId, role, note }) => {
    requireObjectId(userId, 'userId');
    const targetRole = validateUserRoleInput(role);

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const user = await User.findById(userId).session(session);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        if (String(actor._id) === String(user._id)) {
            throw new ApiError(400, 'You cannot change your own role');
        }

        if (user.status === USER_STATUSES.DELETED || user.deletedAt) {
            throw new ApiError(400, 'Deleted users cannot be modified');
        }

        if (user.role === targetRole) {
            await session.commitTransaction();
            return sanitizeUser(user.toObject());
        }

        if (user.role === USER_ROLES.SUPER_ADMIN && targetRole !== USER_ROLES.SUPER_ADMIN) {
            await assertNotLastSuperAdmin(user, session);
        }

        const oldRole = user.role;
        user.role = targetRole;
        await user.save({ session });

        await logAudit({
            actorUserId: actor._id,
            actorRole: actor.role,
            action: AUDIT_ACTIONS.USER_ROLE_UPDATED,
            entityType: AUDIT_ENTITY_TYPES.USER,
            entityId: user._id,
            oldValue: { role: oldRole },
            newValue: { role: user.role },
            note: note || null,
            session,
        });

        await session.commitTransaction();
        return sanitizeUser(user.toObject());
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const softDeleteUserByAdmin = async ({ actor, userId, note }) => {
    requireObjectId(userId, 'userId');

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const user = await User.findById(userId).session(session);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        if (String(actor._id) === String(user._id)) {
            throw new ApiError(400, 'You cannot delete your own account through admin endpoint');
        }

        if (user.status === USER_STATUSES.DELETED || user.deletedAt) {
            await session.commitTransaction();
            return sanitizeUser(user.toObject());
        }

        await assertNotLastSuperAdmin(user, session);

        const oldState = { status: user.status, deletedAt: user.deletedAt };

        user.status = USER_STATUSES.DELETED;
        user.deletedAt = new Date();
        await user.save({ session });

        await logAudit({
            actorUserId: actor._id,
            actorRole: actor.role,
            action: AUDIT_ACTIONS.USER_SOFT_DELETED,
            entityType: AUDIT_ENTITY_TYPES.USER,
            entityId: user._id,
            oldValue: oldState,
            newValue: { status: user.status, deletedAt: user.deletedAt },
            note: note || null,
            session,
        });

        await session.commitTransaction();
        return sanitizeUser(user.toObject());
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export {
    sanitizeUser,
    listUsersForAdmin,
    getUserAdminDetails,
    updateUserStatusByAdmin,
    updateUserRoleBySuperAdmin,
    softDeleteUserByAdmin,
};
