export const USER_ROLES = Object.freeze({
    CUSTOMER: 'customer',
    ADMIN: 'admin',
    SUPER_ADMIN: 'super_admin',
});

export const USER_STATUSES = Object.freeze({
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    BLOCKED: 'blocked',
    DELETED: 'deleted',
});

export const ORDER_STATUSES = Object.freeze({
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REFUND_REQUESTED: 'refund_requested',
    REFUNDED: 'refunded',
    FAILED: 'failed',
});

export const PAYMENT_STATUSES = Object.freeze({
    UNPAID: 'unpaid',
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
});

export const PAYMENT_METHODS = Object.freeze({
    CASH_ON_DELIVERY: 'cash_on_delivery',
    PAYPAL: 'paypal',
    STRIPE: 'stripe',
    BANK_TRANSFER: 'bank_transfer',
    CARD: 'card',
    WALLET: 'wallet',
    PLACEHOLDER: 'placeholder',
});

export const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));
export const USER_STATUS_VALUES = Object.freeze(Object.values(USER_STATUSES));
export const ORDER_STATUS_VALUES = Object.freeze(Object.values(ORDER_STATUSES));
export const PAYMENT_STATUS_VALUES = Object.freeze(Object.values(PAYMENT_STATUSES));
export const PAYMENT_METHOD_VALUES = Object.freeze(Object.values(PAYMENT_METHODS));

export const ADMIN_ROLE_SET = new Set([USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN]);
export const SHOPPER_ROLE_SET = new Set(USER_ROLE_VALUES);
export const AUTH_BLOCKED_STATUS_SET = new Set([USER_STATUSES.BLOCKED, USER_STATUSES.DELETED]);

export const ORDER_STATUS_TRANSITIONS = Object.freeze({
    [ORDER_STATUSES.PENDING]: [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.CANCELLED, ORDER_STATUSES.FAILED],
    [ORDER_STATUSES.CONFIRMED]: [ORDER_STATUSES.PROCESSING, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.PROCESSING]: [ORDER_STATUSES.SHIPPED, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.SHIPPED]: [ORDER_STATUSES.DELIVERED],
    [ORDER_STATUSES.DELIVERED]: [ORDER_STATUSES.REFUND_REQUESTED],
    [ORDER_STATUSES.REFUND_REQUESTED]: [ORDER_STATUSES.REFUNDED],
    [ORDER_STATUSES.CANCELLED]: [],
    [ORDER_STATUSES.REFUNDED]: [],
    [ORDER_STATUSES.FAILED]: [],
});

export const PAYMENT_STATUS_TRANSITIONS = Object.freeze({
    [PAYMENT_STATUSES.UNPAID]: [PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.PAID, PAYMENT_STATUSES.FAILED],
    [PAYMENT_STATUSES.PENDING]: [PAYMENT_STATUSES.UNPAID, PAYMENT_STATUSES.PAID, PAYMENT_STATUSES.FAILED],
    [PAYMENT_STATUSES.PAID]: [PAYMENT_STATUSES.REFUNDED],
    [PAYMENT_STATUSES.FAILED]: [PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.PAID],
    [PAYMENT_STATUSES.REFUNDED]: [],
});

export const AUDIT_ACTIONS = Object.freeze({
    ORDER_CREATED: 'order.created',
    ORDER_STATUS_UPDATED: 'order.status.updated',
    ORDER_PAYMENT_STATUS_UPDATED: 'order.payment_status.updated',
    ORDER_ADMIN_NOTE_UPDATED: 'order.admin_note.updated',
    USER_STATUS_UPDATED: 'user.status.updated',
    USER_ROLE_UPDATED: 'user.role.updated',
    USER_SOFT_DELETED: 'user.soft_deleted',
});

export const AUDIT_ENTITY_TYPES = Object.freeze({
    ORDER: 'order',
    USER: 'user',
});
