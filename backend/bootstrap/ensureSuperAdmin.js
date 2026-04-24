import User from '../models/User.js';
import { USER_ROLES, USER_STATUSES } from '../constants/domainConstants.js';

const applyConfiguredSuperAdminFields = ({ user, name, phone, password }) => {
    user.name = name;
    user.phone = phone;
    user.role = USER_ROLES.SUPER_ADMIN;
    user.status = USER_STATUSES.ACTIVE;
    user.deletedAt = null;
    user.isVerified = true;
    user.password = password;
    user.markModified('password');
};

const ensureInitialSuperAdmin = async () => {
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
    const name = process.env.SUPER_ADMIN_NAME?.trim() || 'Initial Super Admin';
    const phone = process.env.SUPER_ADMIN_PHONE?.trim() || '';

    if (!email || !password) {
        const existingSuperAdminCount = await User.countDocuments({
            role: USER_ROLES.SUPER_ADMIN,
            status: USER_STATUSES.ACTIVE,
            deletedAt: null,
        });

        if (existingSuperAdminCount > 0) {
            return;
        }

        console.warn(
            '[bootstrap] No active super admin found. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to bootstrap one automatically.'
        );
        return;
    }

    let user = await User.findOne({ email }).select('+password');

    if (!user) {
        user = new User({
            name,
            email,
            phone,
            password,
            role: USER_ROLES.SUPER_ADMIN,
            status: USER_STATUSES.ACTIVE,
            isVerified: true,
            deletedAt: null,
        });

        await user.save();
        console.log(`[bootstrap] Initial super admin created: ${email}`);
    } else {
        applyConfiguredSuperAdminFields({ user, name, phone, password });
        await user.save();
        console.log(`[bootstrap] Super admin ensured: ${email}`);
    }

    const verifiedUser = await User.findOne({ email }).select('+password');
    const passwordMatches = await verifiedUser?.matchPassword(password);

    if (!verifiedUser || !passwordMatches || !verifiedUser.canAccessAdmin()) {
        throw new Error(`[bootstrap] Super admin verification failed for ${email}`);
    }
};

export default ensureInitialSuperAdmin;
