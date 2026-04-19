import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
        },
        isAdmin: {
            type: Boolean,
            required: true,
            default: false,
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
        },
        resetPasswordExpire: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

export default User;
