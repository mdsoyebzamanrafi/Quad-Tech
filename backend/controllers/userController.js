import crypto from 'crypto';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import { OAuth2Client } from 'google-auth-library';

const verifyRecaptcha = async (token) => {
    if (process.env.NODE_ENV === 'test') return true;
    if (!token) return false;

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
    });

    const outcome = await response.json();
    return outcome.success;
};
// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = async (req, res) => {
    try {
        const { email, password, captchaToken } = req.body;

        const isHuman = await verifyRecaptcha(captchaToken);
        if (!isHuman) {
            return res.status(400).json({ message: 'CAPTCHA verification failed. Please try again.' });
        }

        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            const token = generateToken(res, user._id);

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
                token
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Register a new user & send OTP
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { name, email, password, captchaToken } = req.body;

        const isHuman = await verifyRecaptcha(captchaToken);
        if (!isHuman) {
            return res.status(400).json({ message: 'CAPTCHA verification failed. Please try again.' });
        }

        let user = await User.findOne({ email });

        if (user && user.isVerified) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

        if (user && !user.isVerified) {
            // Update unverified user with new OTP
            user.name = name;
            user.password = password;
            user.otpCode = otpCode;
            user.otpExpire = otpExpire;
            await user.save();
        } else {
            // Create brand new unverified user
            user = await User.create({
                name,
                email,
                password,
                otpCode,
                otpExpire,
                isVerified: false
            });
        }

        // Send OTP via Email
        const message = `
            <h1>Welcome to Quad Tech!</h1>
            <p>Your email verification code is: <strong>${otpCode}</strong></p>
            <p>This code will expire in 10 minutes.</p>
        `;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Quad Tech - Email Verification Code',
                message
            });

            res.status(200).json({ status: 'pending_verification', email: user.email });
        } catch (error) {
            console.error('Nodemailer Error:', error);
            user.otpCode = undefined;
            user.otpExpire = undefined;
            await user.save();
            return res.status(500).json({ message: 'Email could not be sent' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify OTP Code
// @route   POST /api/users/verify
// @access  Public
const verifyOTP = async (req, res) => {
    try {
        const { email, otpCode } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'User is already verified' });
        }

        if (user.otpCode !== otpCode || user.otpExpire < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        user.isVerified = true;
        user.otpCode = undefined;
        user.otpExpire = undefined;
        await user.save();

        const token = generateToken(res, user._id);
        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth user with Google
// @route   POST /api/users/google
// @access  Public
const googleAuth = async (req, res) => {
    const { token } = req.body;
    try {
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        let name, email;

        try {
            // Case 1: Token is an ID Token (JWT) from GSI Widget
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            name = payload.name;
            email = payload.email;
        } catch (error) {
            // Case 2: Token is an Access Token from useGoogleLogin custom button
            client.setCredentials({ access_token: token });
            const googleResponse = await client.request({
                url: 'https://www.googleapis.com/oauth2/v3/userinfo'
            });
            name = googleResponse.data.name;
            email = googleResponse.data.email;

            if (!email) {
                throw new Error("Could not retrieve email from Google");
            }
        }

        let user = await User.findOne({ email });

        if (!user) {
            // Create user if not exists (but needs a password set later)
            user = await User.create({ name, email });
        }

        const sessionToken = generateToken(res, user._id);

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            needsPassword: !user.password,
            token: sessionToken,
        });
    } catch (error) {
        console.error("Google Auth Backend Error:", error);
        res.status(401).json({ message: "Invalid Google Token", error: error.message });
    }
};

// @desc    Forgot Password Request
// @route   POST /api/users/forgotpassword
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email, captchaToken } = req.body;

        const isHuman = await verifyRecaptcha(captchaToken);
        if (!isHuman) {
            return res.status(400).json({ message: 'CAPTCHA verification failed. Please try again.' });
        }
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'There is no user with that email' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordToken = otpCode;
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
                message
            });
            res.status(200).json({ message: 'Email sent' });
        } catch (error) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();
            return res.status(500).json({ message: 'Email could not be sent' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reset Password via OTP
// @route   POST /api/users/resetpassword
// @access  Public
const resetPassword = async (req, res) => {
    try {
        const { email, otpCode, password } = req.body;
        
        const user = await User.findOne({
            email,
            resetPasswordToken: otpCode,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset completely successful' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Set password for Google authenticated users
// @route   POST /api/users/setpassword
// @access  Private
const setGooglePassword = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        user.password = req.body.password;
        await user.save();

        res.status(200).json({ message: 'Password attached to your account successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export {
    authUser,
    registerUser,
    verifyOTP,
    getUserProfile,
    googleAuth,
    forgotPassword,
    resetPassword,
    setGooglePassword
};
