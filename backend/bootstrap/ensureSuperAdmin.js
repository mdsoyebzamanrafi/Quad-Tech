import User from '../models/User.js';
import { USER_ROLES, USER_STATUSES } from '../constants/domainConstants.js';

const ensureInitialSuperAdmin = async () => {
    const existingSuperAdminCount = await User.countDocuments({
        role: USER_ROLES.SUPER_ADMIN,
        status: USER_STATUSES.ACTIVE,
        deletedAt: null,
    });

    if (existingSuperAdminCount > 0) {
        return;
    }

    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
    const name = process.env.SUPER_ADMIN_NAME?.trim() || 'Initial Super Admin';
    const phone = process.env.SUPER_ADMIN_PHONE?.trim() || '';

    if (!email || !password) {
        console.warn(
            '[bootstrap] No active super admin found. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to bootstrap one automatically.'
        );
        return;
    }

    let user = await User.findOne({ email }).select('+password');

    if (!user) {
        user = await User.create({
            name,
            email,
            phone,
            password,
            role: USER_ROLES.SUPER_ADMIN,
            status: USER_STATUSES.ACTIVE,
            isVerified: true,
            deletedAt: null,
        });

        console.log(`[bootstrap] Initial super admin created: ${email}`);
        return;
    }

    user.role = USER_ROLES.SUPER_ADMIN;
    user.status = USER_STATUSES.ACTIVE;
    user.deletedAt = null;
    user.isVerified = true;
    if (!user.password) {
        user.password = password;
    }

    await user.save();
    console.log(`[bootstrap] Existing user promoted to super admin: ${email}`);
};

export default ensureInitialSuperAdmin;
