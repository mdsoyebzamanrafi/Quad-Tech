import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../errors/ApiError.js';
import {
    USER_ROLES,
    USER_STATUSES,
} from '../constants/domainConstants.js';
import {
    sanitizeUser,
    listUsersForAdmin,
    getUserAdminDetails,
    updateUserStatusByAdmin,
    updateUserRoleBySuperAdmin,
    softDeleteUserByAdmin,
} from '../services/userAdminService.js';

const verifyRecaptcha = async (token) => {
    if (process.env.NODE_ENV === 'test') return true;

    const isDevelopmentBypassEnabled = (
        process.env.NODE_ENV === 'development' &&
        process.env.DISABLE_RECAPTCHA === 'true'
    );

    if (isDevelopmentBypassEnabled) {
        return true;
    }

    if (!process.env.RECAPTCHA_SECRET_KEY) {
        throw new ApiError(500, 'reCAPTCHA secret key is not configured');
    }

    if (!token || typeof token !== 'string') {
        return false;
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            secret: process.env.RECAPTCHA_SECRET_KEY,
            response: token,
        }),
    });

    const outcome = await response.json();
    return outcome.success;
};

const ensureUserCanAuthenticate = (user) => {
    if (!user) {
        throw new ApiError(401, 'Invalid email or password');
    }

    if (user.status === USER_STATUSES.BLOCKED) {
        throw new ApiError(403, 'Account is blocked');
    }

    if (user.status === USER_STATUSES.DELETED || user.deletedAt) {
        throw new ApiError(403, 'Account is deleted');
    }
};

const buildAuthResponse = (user, token, extra = {}) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    isAdmin: user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.SUPER_ADMIN,
    lastLogin: user.lastLogin,
    token,
    ...extra,
});

const authUser = asyncHandler(async (req, res) => {
    const { email, password, captchaToken } = req.body;

    if (!email || !password) {
        throw new ApiError(400, 'email and password are required');
    }

    const isHuman = await verifyRecaptcha(captchaToken);
    if (!isHuman) {
        throw new ApiError(400, 'CAPTCHA verification failed. Please try again.');
    }

    const user = await User.findOne({ email: email?.toLowerCase() }).select('+password');
    ensureUserCanAuthenticate(user);

    if (!user.isVerified) {
        throw new ApiError(403, 'Email verification is required before login');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        throw new ApiError(401, 'Invalid email or password');
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(res, user._id);
    res.json(buildAuthResponse(user, token));
});

const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, captchaToken, phone } = req.body;

    const isHuman = await verifyRecaptcha(captchaToken);
    if (!isHuman) {
        throw new ApiError(400, 'CAPTCHA verification failed. Please try again.');
    }

    if (!name || !email || !password) {
        throw new ApiError(400, 'Name, email, and password are required');
    }

    let user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (user && user.status === USER_STATUSES.DELETED) {
        throw new ApiError(400, 'This account is deleted and cannot be re-registered');
    }

    if (user && user.isVerified) {
        throw new ApiError(400, 'User already exists');
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = Date.now() + 10 * 60 * 1000;

    if (user && !user.isVerified) {
        user.name = name;
        user.phone = phone || user.phone;
        user.password = password;
        user.otpCode = otpCode;
        user.otpExpire = otpExpire;
        user.status = USER_STATUSES.ACTIVE;
        user.role = USER_ROLES.CUSTOMER;
        await user.save();
    } else {
        user = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            phone: phone || '',
            otpCode,
            otpExpire,
            isVerified: false,
            role: USER_ROLES.CUSTOMER,
            status: USER_STATUSES.ACTIVE,
        });
    }

    const message = `
        <h1>Welcome to Quad Tech!</h1>
        <p>Your email verification code is: <strong>${otpCode}</strong></p>
        <p>This code will expire in 10 minutes.</p>
    `;

    try {
        await sendEmail({
            email: user.email,
            subject: 'Quad Tech - Email Verification Code',
            message,
        });
    } catch (error) {
        user.otpCode = undefined;
        user.otpExpire = undefined;
        await user.save();
        throw new ApiError(500, 'Email could not be sent');
    }

    res.status(200).json({ status: 'pending_verification', email: user.email });
});

const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otpCode } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    if (user.isVerified) {
        throw new ApiError(400, 'User is already verified');
    }

    if (user.otpCode !== otpCode || user.otpExpire < Date.now()) {
        throw new ApiError(400, 'Invalid or expired verification code');
    }

    if (user.status === USER_STATUSES.BLOCKED || user.status === USER_STATUSES.DELETED || user.deletedAt) {
        throw new ApiError(403, 'Account is not eligible for verification');
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpire = undefined;
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(res, user._id);
    res.status(200).json(buildAuthResponse(user, token));
});

const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .select('-password -resetPasswordToken -resetPasswordExpire -otpCode')
        .lean();

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    res.json(sanitizeUser(user));
});

const googleAuth = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) {
        throw new ApiError(400, 'Google token is required');
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    let name;
    let email;

    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        name = payload.name;
        email = payload.email;
    } catch (idTokenError) {
        client.setCredentials({ access_token: token });
        const googleResponse = await client.request({ url: 'https://www.googleapis.com/oauth2/v3/userinfo' });
        name = googleResponse.data.name;
        email = googleResponse.data.email;
    }

    if (!email) {
        throw new ApiError(401, 'Invalid Google token');
    }

    let user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
        user = await User.create({
            name,
            email: email.toLowerCase(),
            role: USER_ROLES.CUSTOMER,
            status: USER_STATUSES.ACTIVE,
            isVerified: true,
        });
    }

    ensureUserCanAuthenticate(user);

    user.lastLogin = new Date();
    user.isVerified = true;
    await user.save();

    const sessionToken = generateToken(res, user._id);

    res.status(200).json(
        buildAuthResponse(user, sessionToken, {
            needsPassword: !user.password,
        })
    );
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email, captchaToken } = req.body;

    if (!email) {
        throw new ApiError(400, 'email is required');
    }

    const isHuman = await verifyRecaptcha(captchaToken);
    if (!isHuman) {
        throw new ApiError(400, 'CAPTCHA verification failed. Please try again.');
    }

    const user = await User.findOne({ email: email?.toLowerCase() }).select('+resetPasswordToken +resetPasswordExpire');

    if (!user) {
        throw new ApiError(404, 'There is no user with that email');
    }

    ensureUserCanAuthenticate(user);

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = crypto.createHash('sha256').update(otpCode).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const message = `
        <h1>Password Reset Code</h1>
        <p>Your password reset code is: <strong>${otpCode}</strong></p>
        <p>Please enter this code into the web application. This code will expire in 10 minutes.</p>
    `;

    try {
        await sendEmail({
            email: user.email,
            subject: 'Quad Tech - Password Reset',
            message,
        });
    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        throw new ApiError(500, 'Email could not be sent');
    }

    res.status(200).json({ message: 'Email sent' });
});

const resetPassword = asyncHandler(async (req, res) => {
    const { email, otpCode, password } = req.body;
    if (!email || !otpCode || !password) {
        throw new ApiError(400, 'email, otpCode, and password are required');
    }

    const hashedToken = crypto.createHash('sha256').update(otpCode).digest('hex');

    const user = await User.findOne({
        email: email.toLowerCase(),
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() },
    }).select('+password +resetPasswordToken +resetPasswordExpire');

    if (!user) {
        throw new ApiError(400, 'Invalid or expired token');
    }

    ensureUserCanAuthenticate(user);

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset completely successful' });
});

const setGooglePassword = asyncHandler(async (req, res) => {
    if (!req.body.password) {
        throw new ApiError(400, 'password is required');
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    if (user.status === USER_STATUSES.DELETED || user.deletedAt) {
        throw new ApiError(403, 'Deleted account cannot be updated');
    }

    user.password = req.body.password;
    await user.save();

    res.status(200).json({ message: 'Password attached to your account successfully' });
});

const adminGetUsers = asyncHandler(async (req, res) => {
    const result = await listUsersForAdmin({ query: req.query });
    res.json(result);
});

const adminGetUserById = asyncHandler(async (req, res) => {
    const result = await getUserAdminDetails({ userId: req.params.id });
    res.json(result);
});

const adminUpdateUserStatus = asyncHandler(async (req, res) => {
    const user = await updateUserStatusByAdmin({
        actor: req.user,
        userId: req.params.id,
        status: req.body.status,
        note: req.body.note,
    });

    res.json(user);
});

const superAdminUpdateUserRole = asyncHandler(async (req, res) => {
    const user = await updateUserRoleBySuperAdmin({
        actor: req.user,
        userId: req.params.id,
        role: req.body.role,
        note: req.body.note,
    });

    res.json(user);
});

const adminSoftDeleteUser = asyncHandler(async (req, res) => {
    const user = await softDeleteUserByAdmin({
        actor: req.user,
        userId: req.params.id,
        note: req.body.note,
    });

    res.json(user);
});

export {
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
};
