import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
    ADMIN_ROLE_SET,
    USER_ROLES,
    USER_ROLE_VALUES,
    USER_STATUSES,
    USER_STATUS_VALUES,
} from '../constants/domainConstants.js';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            default: '',
            trim: true,
        },
        password: {
            type: String,
            select: false,
        },
        role: {
            type: String,
            enum: USER_ROLE_VALUES,
            default: USER_ROLES.CUSTOMER,
            index: true,
        },
        status: {
            type: String,
            enum: USER_STATUS_VALUES,
            default: USER_STATUSES.ACTIVE,
            index: true,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        otpCode: {
            type: String,
        },
        otpExpire: {
            type: Date,
        },
        resetPasswordToken: {
            type: String,
            select: false,
        },
        resetPasswordExpire: {
            type: Date,
            select: false,
        },
        lastLogin: {
            type: Date,
            default: null,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

userSchema.virtual('isAdmin').get(function () {
    return ADMIN_ROLE_SET.has(this.role);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.canAuthenticate = function () {
    return this.status !== USER_STATUSES.BLOCKED && this.status !== USER_STATUSES.DELETED && !this.deletedAt;
};

userSchema.methods.canAccessAdmin = function () {
    return ADMIN_ROLE_SET.has(this.role) && this.status === USER_STATUSES.ACTIVE && !this.deletedAt;
};

userSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.index({ role: 1, status: 1 });

const User = mongoose.model('User', userSchema);

export default User;
