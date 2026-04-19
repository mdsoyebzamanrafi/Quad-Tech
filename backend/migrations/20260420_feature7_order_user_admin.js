import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import {
    USER_ROLES,
    USER_ROLE_VALUES,
    USER_STATUSES,
    USER_STATUS_VALUES,
    ORDER_STATUSES,
    ORDER_STATUS_VALUES,
    PAYMENT_STATUSES,
    PAYMENT_STATUS_VALUES,
    PAYMENT_METHODS,
    PAYMENT_METHOD_VALUES,
} from '../constants/domainConstants.js';
import { normalizePaymentMethod } from '../validators/featureValidators.js';

dotenv.config();

await connectDB();

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fallback;
};

const deriveRole = (rawUser) => {
    if (USER_ROLE_VALUES.includes(rawUser.role)) {
        return rawUser.role;
    }

    if (rawUser.isAdmin === true) {
        return USER_ROLES.ADMIN;
    }

    return USER_ROLES.CUSTOMER;
};

const deriveStatus = (rawUser) => {
    if (USER_STATUS_VALUES.includes(rawUser.status)) {
        return rawUser.status;
    }

    if (rawUser.deletedAt) {
        return USER_STATUSES.DELETED;
    }

    return USER_STATUSES.ACTIVE;
};

const migrateUsers = async () => {
    const users = await User.collection.find({}).toArray();

    for (const rawUser of users) {
        const role = deriveRole(rawUser);
        const status = deriveStatus(rawUser);

        await User.collection.updateOne(
            { _id: rawUser._id },
            {
                $set: {
                    role,
                    status,
                    phone: rawUser.phone || '',
                    lastLogin: rawUser.lastLogin || null,
                    deletedAt: status === USER_STATUSES.DELETED ? rawUser.deletedAt || new Date() : null,
                    isVerified: rawUser.isVerified ?? true,
                },
                $unset: {
                    isAdmin: '',
                },
            }
        );
    }

    const superAdminCount = await User.countDocuments({
        role: USER_ROLES.SUPER_ADMIN,
        status: USER_STATUSES.ACTIVE,
        deletedAt: null,
    });

    if (superAdminCount === 0) {
        const fallback = await User.findOne({
            role: USER_ROLES.ADMIN,
            status: USER_STATUSES.ACTIVE,
            deletedAt: null,
        })
            .sort({ createdAt: 1 })
            .select('_id');

        const promoteTarget = fallback || (await User.findOne({ status: { $ne: USER_STATUSES.DELETED } }).sort({ createdAt: 1 }));

        if (promoteTarget) {
            await User.updateOne(
                { _id: promoteTarget._id },
                {
                    $set: {
                        role: USER_ROLES.SUPER_ADMIN,
                        status: USER_STATUSES.ACTIVE,
                        deletedAt: null,
                    },
                }
            );

            console.log(`[migration] Promoted ${promoteTarget._id} to super_admin`);
        }
    }
};

const deriveOrderStatus = (rawOrder) => {
    if (ORDER_STATUS_VALUES.includes(rawOrder.orderStatus)) {
        return rawOrder.orderStatus;
    }

    if (rawOrder.isDelivered) {
        return ORDER_STATUSES.DELIVERED;
    }

    if (rawOrder.isPaid) {
        return ORDER_STATUSES.CONFIRMED;
    }

    return ORDER_STATUSES.PENDING;
};

const derivePaymentStatus = (rawOrder) => {
    if (PAYMENT_STATUS_VALUES.includes(rawOrder.paymentStatus)) {
        return rawOrder.paymentStatus;
    }

    if (rawOrder.isPaid) {
        return PAYMENT_STATUSES.PAID;
    }

    const paymentResultStatus = rawOrder.paymentResult?.status?.toLowerCase();
    if (paymentResultStatus === 'pending') {
        return PAYMENT_STATUSES.PENDING;
    }

    if (paymentResultStatus === 'failed') {
        return PAYMENT_STATUSES.FAILED;
    }

    return PAYMENT_STATUSES.UNPAID;
};

const derivePaymentMethod = (rawOrder) => {
    if (PAYMENT_METHOD_VALUES.includes(rawOrder.paymentMethod)) {
        return rawOrder.paymentMethod;
    }

    try {
        return normalizePaymentMethod(rawOrder.paymentMethod || PAYMENT_METHODS.CASH_ON_DELIVERY);
    } catch {
        return PAYMENT_METHODS.CASH_ON_DELIVERY;
    }
};

const upsertOrderItemsFromLegacy = async (rawOrder) => {
    const existingItemsCount = await OrderItem.countDocuments({ order: rawOrder._id });
    if (existingItemsCount > 0) {
        return;
    }

    if (!Array.isArray(rawOrder.orderItems) || rawOrder.orderItems.length === 0) {
        return;
    }

    const dedupeMap = new Map();

    for (const item of rawOrder.orderItems) {
        if (!item?.product) continue;

        const key = String(item.product);
        const previous = dedupeMap.get(key) || {
            product: item.product,
            productName: item.name || 'Unknown Product',
            productImage: item.image || '',
            unitPrice: toNumber(item.price, 0),
            quantity: 0,
            lineTotal: 0,
        };

        const qty = Math.max(1, Number(item.qty) || 1);
        previous.quantity += qty;
        previous.lineTotal = toNumber(previous.lineTotal + previous.unitPrice * qty, 0);
        dedupeMap.set(key, previous);
    }

    const docs = Array.from(dedupeMap.values()).map((item) => ({
        order: rawOrder._id,
        product: item.product,
        productName: item.productName,
        productImage: item.productImage,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
    }));

    if (docs.length > 0) {
        await OrderItem.insertMany(docs, { ordered: false });
    }
};

const migrateOrders = async () => {
    const orders = await Order.collection.find({}).toArray();

    for (const rawOrder of orders) {
        const subtotal = toNumber(
            rawOrder.subtotal ??
                rawOrder.itemsPrice ??
                rawOrder.orderItems?.reduce((acc, item) => acc + toNumber(item.price, 0) * (Number(item.qty) || 1), 0),
            0
        );

        const discount = toNumber(rawOrder.discount, 0);
        const tax = toNumber(rawOrder.tax ?? rawOrder.taxPrice, 0);
        const shippingFee = toNumber(rawOrder.shippingFee ?? rawOrder.shippingPrice, 0);
        const total = toNumber(rawOrder.total ?? rawOrder.totalPrice, subtotal - discount + tax + shippingFee);

        const shippingAddressObject = rawOrder.shippingAddress || {};

        const status = deriveOrderStatus(rawOrder);

        const updatePayload = {
            orderStatus: status,
            paymentStatus: derivePaymentStatus(rawOrder),
            paymentMethod: derivePaymentMethod(rawOrder),
            subtotal,
            discount,
            tax,
            shippingFee,
            total,
            shippingName: rawOrder.shippingName || rawOrder?.userName || 'Customer',
            shippingPhone: rawOrder.shippingPhone || shippingAddressObject.phone || 'unknown',
            shippingAddress: rawOrder.shippingAddressText || shippingAddressObject.address || rawOrder.shippingAddress || 'unknown',
            shippingAddressLine2: rawOrder.shippingAddressLine2 || shippingAddressObject.addressLine2 || '',
            shippingCity: rawOrder.shippingCity || shippingAddressObject.city || 'unknown',
            shippingPostalCode: rawOrder.shippingPostalCode || shippingAddressObject.postalCode || 'unknown',
            shippingCountry: rawOrder.shippingCountry || shippingAddressObject.country || 'unknown',
            stockReduced:
                rawOrder.stockReduced !== undefined
                    ? Boolean(rawOrder.stockReduced)
                    : Array.isArray(rawOrder.orderItems) && rawOrder.orderItems.length > 0,
            paidAt: rawOrder.paidAt || null,
            deliveredAt: rawOrder.deliveredAt || null,
            adminNote: rawOrder.adminNote || null,
        };

        if (!updatePayload.stockReduced) {
            updatePayload.stockReducedAt = null;
        } else {
            updatePayload.stockReducedAt = rawOrder.stockReducedAt || rawOrder.createdAt || new Date();
        }

        if (status === ORDER_STATUSES.CANCELLED) {
            updatePayload.cancelledAt = rawOrder.cancelledAt || rawOrder.updatedAt || new Date();
        }

        if (status === ORDER_STATUSES.FAILED) {
            updatePayload.failedAt = rawOrder.failedAt || rawOrder.updatedAt || new Date();
        }

        await Order.collection.updateOne(
            { _id: rawOrder._id },
            {
                $set: updatePayload,
                $unset: {
                    isPaid: '',
                    isDelivered: '',
                    paymentResult: '',
                    taxPrice: '',
                    shippingPrice: '',
                    totalPrice: '',
                    itemsPrice: '',
                },
            }
        );

        await upsertOrderItemsFromLegacy(rawOrder);
    }
};

const ensureIndexes = async () => {
    await Promise.all([User.syncIndexes(), Order.syncIndexes(), OrderItem.syncIndexes()]);
};

const runMigration = async () => {
    try {
        await migrateUsers();
        await migrateOrders();
        await ensureIndexes();
        console.log('[migration] Feature 7 migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('[migration] Failed:', error);
        process.exit(1);
    }
};

runMigration();
