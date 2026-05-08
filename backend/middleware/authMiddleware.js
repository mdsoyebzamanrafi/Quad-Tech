import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../errors/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
    ADMIN_ROLE_SET,
    AUTH_BLOCKED_STATUS_SET,
    USER_ROLES,
    USER_STATUSES,
} from '../constants/domainConstants.js';

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new ApiError(401, 'Not authorized, no token');
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new ApiError(401, 'Not authorized, token failed');
    }

    const user = await User.findById(decoded.userId).select('-password -resetPasswordToken -resetPasswordExpire');

    if (!user) {
        throw new ApiError(401, 'Not authorized, user not found');
    }

    if (AUTH_BLOCKED_STATUS_SET.has(user.status) || user.deletedAt) {
        throw new ApiError(403, 'Account is not allowed to access the system');
    }

    req.user = user;
    next();
});

const protectOptional = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        next();
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password -resetPasswordToken -resetPasswordExpire');

        if (!user || AUTH_BLOCKED_STATUS_SET.has(user.status) || user.deletedAt) {
            next();
            return;
        }

        req.user = user;
    } catch (error) {
        req.user = undefined;
    }

    next();
});

const requireRoles = (...roles) => (req, res, next) => {
    if (!req.user) {
        throw new ApiError(401, 'Not authorized');
    }

    if (!roles.includes(req.user.role)) {
        throw new ApiError(403, 'Insufficient permissions');
    }

    next();
};

const requireActiveAdmin = (req, res, next) => {
    if (!req.user) {
        throw new ApiError(401, 'Not authorized');
    }

    if (!ADMIN_ROLE_SET.has(req.user.role)) {
        throw new ApiError(403, 'Not authorized as admin');
    }

    if (req.user.status !== USER_STATUSES.ACTIVE || req.user.deletedAt) {
        throw new ApiError(403, 'Admin access requires an active account');
    }

    next();
};

const requireActiveSuperAdmin = (req, res, next) => {
    if (!req.user) {
        throw new ApiError(401, 'Not authorized');
    }

    if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
        return res.status(403).json({
            success: false,
            message: 'Only Super Admin can perform this action.',
        });
    }

    if (req.user.status !== USER_STATUSES.ACTIVE || req.user.deletedAt) {
        throw new ApiError(403, 'Super Admin access requires an active account');
    }

    next();
};

const admin = requireActiveAdmin;

export { protect, protectOptional, admin, requireRoles, requireActiveAdmin, requireActiveSuperAdmin };
