import express from 'express';
const router = express.Router();
import {
    authUser,
    registerUser,
    verifyOTP,
    getUserProfile,
    googleAuth,
    forgotPassword,
    resetPassword,
    setGooglePassword
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/').post(registerUser);
router.post('/verify', verifyOTP);
router.post('/login', authUser);
router.post('/google', googleAuth);
router.post('/forgotpassword', forgotPassword);
router.post('/resetpassword', resetPassword);
router.post('/setpassword', protect, setGooglePassword);
router.route('/profile').get(protect, getUserProfile);

export default router;
