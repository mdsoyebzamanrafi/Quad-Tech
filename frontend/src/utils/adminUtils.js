const ADMIN_ROLES = ['admin', 'super_admin'];

export const USER_ROLES = ['customer', 'admin', 'super_admin'];
export const USER_STATUSES = ['active', 'inactive', 'suspended', 'blocked', 'deleted'];
export const EDITABLE_USER_STATUSES = ['active', 'inactive', 'suspended', 'blocked'];
export const ORDER_STATUSES = [
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refund_requested',
    'refunded',
    'failed',
];
export const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];

export const isAdminUser = (user) => (
    Boolean(user) &&
    ADMIN_ROLES.includes(user.role) &&
    user.status === 'active'
);

export const isSuperAdmin = (user) => user?.role === 'super_admin' && user?.status === 'active';

export const labelize = (value) => {
    if (!value) return 'Not set';
    return String(value)
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};


const parseValidDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value) => {
    const date = parseValidDate(value);
    if (!date) return 'Not set';

    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
};

export const formatDateTime = (value) => {
    const date = parseValidDate(value);
    if (!date) return 'Not set';

    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

export const shortId = (value) => {
    if (!value) return 'Unknown';
    const id = String(value);
    return id.length > 10 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
};

export const getErrorMessage = (error, fallback = 'Something went wrong') => (
    error?.response?.data?.message || error?.message || fallback
);

export const statusTone = (status) => {
    if (['active', 'paid', 'delivered', 'confirmed'].includes(status)) return 'success';
    if (['blocked', 'deleted', 'cancelled', 'failed'].includes(status)) return 'danger';
    if (['refunded', 'refund_requested', 'suspended'].includes(status)) return 'warning';
    return 'neutral';
};
