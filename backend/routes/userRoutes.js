import express from 'express';
import {
    authUser,
    registerUser,
    verifyOTP,
    getUserProfile,
    googleAuth,
    forgotPassword,
    resetPassword,
    setGooglePassword,
    adminGetUsers,
    adminGetUserById,
    adminUpdateUserStatus,
    superAdminUpdateUserRole,
    adminSoftDeleteUser,
} from '../controllers/userController.js';
import {
    protect,
    requireActiveAdmin,
    requireRoles,
} from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../constants/domainConstants.js';

const router = express.Router();

// Public auth endpoints
router.post('/', registerUser);
router.post('/verify', verifyOTP);
router.post('/login', authUser);
router.post('/google', googleAuth);
router.post('/forgotpassword', forgotPassword);
router.post('/resetpassword', resetPassword);

// User profile/authenticated endpoints
router.post('/setpassword', protect, setGooglePassword);
router.get('/profile', protect, getUserProfile);

// Admin user management endpoints
router.get('/admin', protect, requireActiveAdmin, adminGetUsers);
router.get('/admin/:id', protect, requireActiveAdmin, adminGetUserById);
router.patch('/admin/:id/status', protect, requireActiveAdmin, adminUpdateUserStatus);
router.patch(
    '/admin/:id/role',
    protect,
    requireActiveAdmin,
    requireRoles(USER_ROLES.SUPER_ADMIN),
    superAdminUpdateUserRole
);
router.delete('/admin/:id', protect, requireActiveAdmin, adminSoftDeleteUser);

export default router;
