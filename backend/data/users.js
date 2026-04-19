import bcrypt from 'bcryptjs';
import { USER_ROLES, USER_STATUSES } from '../constants/domainConstants.js';

const users = [
    {
        name: 'Super Admin',
        email: 'superadmin@atoz.com',
        password: bcrypt.hashSync('password123', 10),
        phone: '+10000000001',
        role: USER_ROLES.SUPER_ADMIN,
        status: USER_STATUSES.ACTIVE,
        isVerified: true,
    },
    {
        name: 'Admin User',
        email: 'admin@atoz.com',
        password: bcrypt.hashSync('password123', 10),
        phone: '+10000000002',
        role: USER_ROLES.ADMIN,
        status: USER_STATUSES.ACTIVE,
        isVerified: true,
    },
    {
        name: 'John Doe',
        email: 'john@example.com',
        password: bcrypt.hashSync('password123', 10),
        phone: '+10000000003',
        role: USER_ROLES.CUSTOMER,
        status: USER_STATUSES.ACTIVE,
        isVerified: true,
    },
    {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: bcrypt.hashSync('password123', 10),
        phone: '+10000000004',
        role: USER_ROLES.CUSTOMER,
        status: USER_STATUSES.ACTIVE,
        isVerified: true,
    },
];

export default users;
