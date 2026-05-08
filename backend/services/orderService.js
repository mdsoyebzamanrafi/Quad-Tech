import mongoose from 'mongoose';
import ApiError from '../errors/ApiError.js';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import User from '../models/User.js';
import Coupon from '../models/Coupon.js';
import {
    AUDIT_ACTIONS,
    AUDIT_ENTITY_TYPES,
    ORDER_STATUSES,
    PAYMENT_METHODS,
    PAYMENT_STATUSES,
    SHOPPER_ROLE_SET,
    USER_ROLES,
    USER_STATUSES,
} from '../constants/domainConstants.js';
import {
    cleanString,
    requireObjectId,
} from '../validators/commonValidators.js';
import {
    validateAdminNoteInput,
    validateCreateOrderInput,
    validateOrderListFilters,
    validateOrderStatusInput,
    validatePaymentStatusInput,
} from '../validators/featureValidators.js';
import { logAudit, getAuditTrail } from './auditLogService.js';
import { assertOrderStatusTransition, assertPaymentStatusTransition } from './transitionService.js';
import {
    calculateBestDiscount,
    calculateOrderTotals,
    calculateTokenDiscount,
    roundPrice,
    toObjectId,
    validateCouponForUser,
} from './discountService.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REWARD_TOKEN_RATE = Number(process.env.REWARD_TOKEN_RATE ?? 5);
const MAX_TRANSACTION_ATTEMPTS = 3;

const isTransientTransactionError = (error) => {
    if (typeof error?.hasErrorLabel === 'function' && error.hasErrorLabel('TransientTransactionError')) {
        return true;
    }

    if (error?.errorLabelSet?.has?.('TransientTransactionError')) {
        return true;
    }

    return Array.isArray(error?.errorResponse?.errorLabels) &&
        error.errorResponse.errorLabels.includes('TransientTransactionError');
};
const BULK_DELIVERABLE_STATUSES = Object.freeze([
    ORDER_STATUSES.PENDING,
    ORDER_STATUSES.CONFIRMED,
    ORDER_STATUSES.PROCESSING,
    ORDER_STATUSES.SHIPPED,
]);

const buildPaymentStatusFromMethod = (paymentMethod) => {
    if (paymentMethod === PAYMENT_METHODS.CASH_ON_DELIVERY || paymentMethod === PAYMENT_METHODS.PLACEHOLDER) {
        return PAYMENT_STATUSES.UNPAID;
    }

    return PAYMENT_STATUSES.PENDING;
};

const formatOrderItemForResponse = (item) => ({
    _id: item._id,
    product: item.product,
    productId: item.product,
    name: item.productName,
    productName: item.productName,
    image: item.productImage,
    selectedColor: item.selectedColor || '',
    selectedSize: item.selectedSize || '',
    customDesign: item.customDesign || null,
    unitPrice: item.unitPrice,
    price: item.unitPrice,
    quantity: item.quantity,
    qty: item.quantity,
    lineTotal: item.lineTotal,
});

const formatOrderForResponse = (order, orderItems, { includeAuditTrail = false, auditTrail = [] } = {}) => {
    const grossItemsPrice = order.grossItemsPrice ?? order.subtotal ?? 0;
    const coupon = {
        code: order.coupon?.code || '',
        couponId: order.coupon?.couponId || null,
        discountAmount: order.coupon?.discountAmount ?? 0,
    };
    const smartDiscount = {
        ruleId: order.smartDiscount?.ruleId || null,
        ruleName: order.smartDiscount?.ruleName || '',
        discountType: order.smartDiscount?.discountType || '',
        discountValue: order.smartDiscount?.discountValue ?? 0,
        discountAmount: order.smartDiscount?.discountAmount ?? 0,
    };
    const tokenDiscount = {
        tokensUsed: order.tokenDiscount?.tokensUsed ?? 0,
        discountAmount: order.tokenDiscount?.discountAmount ?? 0,
        tokensDeducted: order.tokenDiscount?.tokensDeducted ?? false,
    };

    const base = {
        _id: order._id,
        user: order.user,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        subtotal: order.subtotal,
        grossItemsPrice,
        netItemsPrice: order.netItemsPrice ?? Math.max(grossItemsPrice - (order.totalDiscount ?? order.discount ?? 0), 0),
        discount: order.totalDiscount ?? order.discount ?? 0,
        totalDiscount: order.totalDiscount ?? order.discount ?? 0,
        coupon,
        smartDiscount,
        tokenDiscount,
        rewardTokensEarned: order.rewardTokensEarned ?? 0,
        tax: order.tax,
        shippingFee: order.shippingFee,
        total: order.total,
        shippingName: order.shippingName,
        shippingPhone: order.shippingPhone,
        shippingAddress: {
            address: order.shippingAddress,
            addressLine2: order.shippingAddressLine2,
            city: order.shippingCity,
            postalCode: order.shippingPostalCode,
            country: order.shippingCountry,
            phone: order.shippingPhone,
        },
        shippingAddressText: order.shippingAddress,
        shippingCity: order.shippingCity,
        shippingPostalCode: order.shippingPostalCode,
        shippingCountry: order.shippingCountry,
        adminNote: order.adminNote,
        stockReduced: order.stockReduced,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        paidAt: order.paidAt,
        refundedAt: order.refundedAt,
        deliveredAt: order.deliveredAt,
        deliveredBy: order.deliveredBy,
        bulkDelivered: order.bulkDelivered ?? false,
        cancelledAt: order.cancelledAt,
        confirmedAt: order.confirmedAt,
        processingAt: order.processingAt,
        shippedAt: order.shippedAt,
        failedAt: order.failedAt,
        orderItems: orderItems.map(formatOrderItemForResponse),

        // Legacy compatibility fields
        itemsPrice: grossItemsPrice,
        taxPrice: order.tax,
        shippingPrice: order.shippingFee,
        totalPrice: order.total,
        isPaid: [PAYMENT_STATUSES.PAID, PAYMENT_STATUSES.REFUNDED].includes(order.paymentStatus),
        isDelivered: [ORDER_STATUSES.DELIVERED, ORDER_STATUSES.REFUND_REQUESTED, ORDER_STATUSES.REFUNDED].includes(order.orderStatus),
    };

    if (includeAuditTrail) {
        base.auditTrail = auditTrail;
    }

    return base;
};

const getOrderItemsMap = async (orderIds, session = null) => {
    const items = await OrderItem.find({ order: { $in: orderIds } })
        .session(session)
        .sort({ createdAt: 1 })
        .lean();

    const grouped = new Map();
    for (const item of items) {
        const key = String(item.order);
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(item);
    }

    return grouped;
};

const buildNonDeletedOrderScope = () => {
    const query = {};

    if (Order.schema.path('isDeleted')) {
        query.isDeleted = { $ne: true };
    }

    if (Order.schema.path('deletedAt')) {
        query.deletedAt = null;
    }

    return query;
};

const getOrderWithItemsOrThrow = async (orderId, session = null) => {
    const order = await Order.findById(orderId).session(session).populate('user', 'name email role status').lean();
    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    const items = await OrderItem.find({ order: order._id }).session(session).sort({ createdAt: 1 }).lean();
    return { order, items };
};

const assertUserCanPlaceOrder = (user) => {
    if (!user) {
        throw new ApiError(401, 'Authentication required');
    }

    if (!SHOPPER_ROLE_SET.has(user.role)) {
        throw new ApiError(403, 'Your role is not allowed to place orders');
    }

    if (user.status !== USER_STATUSES.ACTIVE || user.deletedAt) {
        throw new ApiError(403, 'Only active accounts can place orders');
    }
};

const buildMongoOrderQuery = async (filters) => {
    const query = {};

    if (filters.status) {
        query.orderStatus = filters.status;
    }

    if (filters.paymentStatus) {
        query.paymentStatus = filters.paymentStatus;
    }

    if (filters.userId) {
        query.user = filters.userId;
    }

    if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom;
        if (filters.dateTo) query.createdAt.$lte = filters.dateTo;
    }

    if (filters.minAmount !== null || filters.maxAmount !== null) {
        query.total = {};
        if (filters.minAmount !== null) query.total.$gte = filters.minAmount;
        if (filters.maxAmount !== null) query.total.$lte = filters.maxAmount;
    }

    if (filters.search) {
        const safe = escapeRegex(filters.search);
        const regex = new RegExp(safe, 'i');
        const orConditions = [
            { shippingName: regex },
            { shippingPhone: regex },
            { shippingAddress: regex },
            { paymentMethod: regex },
        ];

        if (mongoose.Types.ObjectId.isValid(filters.search)) {
            orConditions.push({ _id: filters.search }, { user: filters.search });
        }

        const matchingUsers = await User.find(
            {
                $or: [{ name: regex }, { email: regex }, { phone: regex }],
            },
            { _id: 1 }
        ).lean();

        if (matchingUsers.length > 0) {
            orConditions.push({ user: { $in: matchingUsers.map((u) => u._id) } });
        }

        query.$or = orConditions;
    }

    return query;
};

const applyOrderStatusSideEffects = async ({ order, newStatus, session }) => {
    if (newStatus === ORDER_STATUSES.CONFIRMED && !order.stockReduced) {
        const items = await OrderItem.find({ order: order._id }).session(session).lean();

        for (const item of items) {
            const result = await Product.updateOne(
                {
                    _id: item.product,
                    countInStock: { $gte: item.quantity },
                },
                { $inc: { countInStock: -item.quantity } },
                { session }
            );

            if (result.modifiedCount !== 1) {
                throw new ApiError(409, `Insufficient stock to confirm order for product ${item.productName}`);
            }
        }

        order.stockReduced = true;
        order.stockReducedAt = new Date();
        order.stockRestoredAt = null;
    }

    if (newStatus === ORDER_STATUSES.CANCELLED && order.stockReduced) {
        const items = await OrderItem.find({ order: order._id }).session(session).lean();

        for (const item of items) {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { countInStock: item.quantity } },
                { session }
            );
        }

        order.stockReduced = false;
        order.stockRestoredAt = new Date();
    }
};

const applyOrderStatusTimestamps = (order, newStatus) => {
    const now = new Date();

    if (newStatus === ORDER_STATUSES.CONFIRMED && !order.confirmedAt) order.confirmedAt = now;
    if (newStatus === ORDER_STATUSES.PROCESSING && !order.processingAt) order.processingAt = now;
    if (newStatus === ORDER_STATUSES.SHIPPED && !order.shippedAt) order.shippedAt = now;
    if (newStatus === ORDER_STATUSES.DELIVERED && !order.deliveredAt) order.deliveredAt = now;
    if (newStatus === ORDER_STATUSES.CANCELLED && !order.cancelledAt) order.cancelledAt = now;
    if (newStatus === ORDER_STATUSES.FAILED && !order.failedAt) order.failedAt = now;
};

const normalizeCouponCode = (value) => cleanString(value).toUpperCase();

const calculateEarnedRewardTokens = (orderTotal) => Math.floor(roundPrice(orderTotal) / 100) * REWARD_TOKEN_RATE;

const applySuccessfulPaymentEffects = async ({ order, session, shouldCountOrder }) => {
    const user = await User.findById(order.user).session(session);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const tokensUsed = order.tokenDiscount?.tokensUsed ?? 0;
    if (tokensUsed > 0 && !order.tokenDiscount.tokensDeducted) {
        if ((user.rewardTokens ?? 0) < tokensUsed) {
            throw new ApiError(400, 'User reward token balance is insufficient for this order');
        }

        user.rewardTokens = Math.max((user.rewardTokens ?? 0) - tokensUsed, 0);
        order.tokenDiscount.tokensDeducted = true;
    }

    if ((order.rewardTokensEarned ?? 0) <= 0) {
        const earnedTokens = calculateEarnedRewardTokens(order.total);
        if (earnedTokens > 0) {
            user.rewardTokens = (user.rewardTokens ?? 0) + earnedTokens;
        }
        order.rewardTokensEarned = earnedTokens;
    }

    if (shouldCountOrder) {
        user.lifetimeSpent = roundPrice((user.lifetimeSpent ?? 0) + (order.total ?? 0));
        user.totalOrders = (user.totalOrders ?? 0) + 1;
    }

    await user.save({ session });
};

const createOrder = async ({ authenticatedUser, payload }) => {
    const validated = validateCreateOrderInput(payload);
    assertUserCanPlaceOrder(authenticatedUser);

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        const session = await mongoose.startSession();
        let orderId;

        try {
            session.startTransaction();

            const user = await User.findById(authenticatedUser._id).session(session).select('+password');
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        assertUserCanPlaceOrder(user);

        const shippingName = validated.shipping.shippingName || user.name;
        const shippingPhone = validated.shipping.shippingPhone || cleanString(user.phone);

        if (!shippingPhone) {
            throw new ApiError(400, 'Contact number is required');
        }

        const productIds = validated.orderItems.map((item) => item.productId);
        const products = await Product.find({ _id: { $in: productIds } }).session(session).lean();

        if (products.length !== productIds.length) {
            throw new ApiError(404, 'One or more products were not found');
        }

        const productMap = new Map(products.map((product) => [String(product._id), product]));

        const orderItemDocs = [];
        const smartDiscountCartItems = [];
        let itemsPrice = 0;

        for (const item of validated.orderItems) {
            const product = productMap.get(item.productId);

            if (!product) {
                throw new ApiError(404, `Product not found: ${item.productId}`);
            }

            if (product.countInStock < item.quantity) {
                throw new ApiError(409, `Insufficient stock for product ${product.name}`);
            }

            const unitPrice = roundPrice(product.price);
            const lineTotal = roundPrice(unitPrice * item.quantity);
            itemsPrice += lineTotal;

            orderItemDocs.push({
                product: product._id,
                productName: product.name,
                productImage: product.image || '',
                selectedColor: item.selectedColor || '',
                selectedSize: item.selectedSize || '',
                customDesign: item.customDesign || null,
                unitPrice,
                quantity: item.quantity,
                lineTotal,
            });

            smartDiscountCartItems.push({
                product: product._id,
                quantity: item.quantity,
                unitPrice,
                lineTotal,
                category: product.category || '',
            });
        }

        itemsPrice = roundPrice(itemsPrice);

        let coupon = null;
        let couponDiscount = 0;

        if (validated.couponCode) {
            coupon = await Coupon.findOne({ code: normalizeCouponCode(validated.couponCode) }).session(session);
            const couponValidation = validateCouponForUser({
                coupon,
                userId: user._id,
                itemsPrice,
            });
            couponDiscount = couponValidation.discountAmount;
        }

        const smartDiscountResult = await calculateBestDiscount(user._id, validated.orderItems, {
            user,
            normalizedCartItems: smartDiscountCartItems,
            subtotal: itemsPrice,
            productsById: productMap,
            session,
        });
        const smartDiscountAmount = roundPrice(Math.min(
            Math.max(Number(smartDiscountResult.discountAmount || 0), 0),
            Math.max(roundPrice(itemsPrice - couponDiscount), 0)
        ));

        const remainingAmountAfterCoupon = Math.max(roundPrice(itemsPrice - couponDiscount - smartDiscountAmount), 0);
        const tokenUsage = calculateTokenDiscount({
            user,
            requestedTokens: validated.requestedTokens,
            remainingAmountAfterCoupon,
        });
        const totals = calculateOrderTotals({
            itemsPrice,
            smartDiscount: smartDiscountAmount,
            couponDiscount,
            tokenDiscount: tokenUsage.discountAmount,
        });

        const paymentStatus = buildPaymentStatusFromMethod(validated.paymentMethod);

        const [createdOrder] = await Order.create(
            [
                {
                    user: user._id,
                    orderStatus: ORDER_STATUSES.PENDING,
                    paymentStatus,
                    paymentMethod: validated.paymentMethod,
                    coupon: coupon
                        ? {
                            code: coupon.code,
                            couponId: coupon._id,
                            discountAmount: totals.couponDiscount,
                        }
                        : undefined,
                    smartDiscount: {
                        ruleId: smartDiscountResult.eligible ? toObjectId(smartDiscountResult.ruleId) : null,
                        ruleName: smartDiscountResult.ruleName || '',
                        discountType: smartDiscountResult.discountType || '',
                        discountValue: smartDiscountResult.discountValue || 0,
                        discountAmount: totals.smartDiscount,
                    },
                    tokenDiscount: {
                        tokensUsed: tokenUsage.tokensUsed,
                        discountAmount: totals.tokenDiscount,
                        tokensDeducted: false,
                    },
                    subtotal: totals.itemsPrice,
                    grossItemsPrice: totals.grossItemsPrice,
                    netItemsPrice: totals.netItemsPrice,
                    discount: totals.totalDiscount,
                    totalDiscount: totals.totalDiscount,
                    tax: totals.taxPrice,
                    shippingFee: totals.shippingPrice,
                    total: totals.totalPrice,
                    rewardTokensEarned: 0,
                    shippingName,
                    shippingPhone,
                    shippingAddress: validated.shipping.addressLine,
                    shippingAddressLine2: validated.shipping.addressLine2,
                    shippingCity: validated.shipping.city,
                    shippingPostalCode: validated.shipping.postalCode,
                    shippingCountry: validated.shipping.country,
                },
            ],
            { session }
        );

        const enrichedOrderItems = orderItemDocs.map((item) => ({
            ...item,
            order: createdOrder._id,
        }));

        await OrderItem.insertMany(enrichedOrderItems, { session });

        if (coupon) {
            coupon.usedCount += 1;
            coupon.usedBy.push({
                user: user._id,
                order: createdOrder._id,
                usedAt: new Date(),
            });
            await coupon.save({ session });
        }

        await Cart.updateOne(
            { user: user._id },
            { $set: { items: [] } },
            { session }
        );

        await logAudit({
            actorUserId: user._id,
            actorRole: user.role,
            action: AUDIT_ACTIONS.ORDER_CREATED,
            entityType: AUDIT_ENTITY_TYPES.ORDER,
            entityId: createdOrder._id,
            oldValue: null,
            newValue: {
                orderStatus: createdOrder.orderStatus,
                paymentStatus: createdOrder.paymentStatus,
                couponCode: createdOrder.coupon?.code || null,
                smartDiscountRule: createdOrder.smartDiscount?.ruleName || null,
                totalDiscount: createdOrder.totalDiscount,
                total: createdOrder.total,
            },
            note: 'Order created by customer',
            session,
        });

            orderId = createdOrder._id;
            await session.commitTransaction();
            return getOrderForUser({ orderId, requester: authenticatedUser });
        } catch (error) {
            await session.abortTransaction().catch(() => null);

            if (isTransientTransactionError(error) && attempt < MAX_TRANSACTION_ATTEMPTS) {
                continue;
            }

            throw error;
        } finally {
            session.endSession();
        }
    }

    throw new ApiError(500, 'Failed to create order');
};

const listMyOrders = async ({ requester }) => {
    const orders = await Order.find({ user: requester._id })
        .sort({ createdAt: -1 })
        .lean();

    if (orders.length === 0) {
        return [];
    }

    const orderIds = orders.map((order) => order._id);
    const itemsMap = await getOrderItemsMap(orderIds);

    return orders.map((order) => formatOrderForResponse(order, itemsMap.get(String(order._id)) || []));
};

const getOrderForUser = async ({ orderId, requester }) => {
    requireObjectId(orderId, 'orderId');
    const { order, items } = await getOrderWithItemsOrThrow(orderId);

    const ownerId = String(order.user?._id || order.user);
    const requesterId = String(requester._id);
    const isAdmin = requester.canAccessAdmin?.() || false;

    if (!isAdmin && ownerId !== requesterId) {
        throw new ApiError(403, 'Not authorized to access this order');
    }

    return formatOrderForResponse(order, items);
};

const cancelMyOrder = async ({ orderId, requester, reason = null }) => {
    requireObjectId(orderId, 'orderId');

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findById(orderId).session(session);
        if (!order) {
            throw new ApiError(404, 'Order not found');
        }

        if (String(order.user) !== String(requester._id)) {
            throw new ApiError(403, 'You can cancel only your own orders');
        }

        if (![ORDER_STATUSES.PENDING, ORDER_STATUSES.CONFIRMED].includes(order.orderStatus)) {
            throw new ApiError(400, 'This order can no longer be cancelled');
        }

        const oldOrderStatus = order.orderStatus;
        assertOrderStatusTransition(order.orderStatus, ORDER_STATUSES.CANCELLED, {
            alreadyDispatched: order.shippedAt !== null,
        });

        await applyOrderStatusSideEffects({ order, newStatus: ORDER_STATUSES.CANCELLED, session });
        applyOrderStatusTimestamps(order, ORDER_STATUSES.CANCELLED);
        order.orderStatus = ORDER_STATUSES.CANCELLED;

        let paymentChanged = false;
        const oldPaymentStatus = order.paymentStatus;

        if (order.paymentStatus === PAYMENT_STATUSES.PAID) {
            order.paymentStatus = PAYMENT_STATUSES.REFUNDED;
            order.refundedAt = new Date();
            paymentChanged = true;
        }

        await order.save({ session });

        await logAudit({
            actorUserId: requester._id,
            actorRole: requester.role,
            action: AUDIT_ACTIONS.ORDER_STATUS_UPDATED,
            entityType: AUDIT_ENTITY_TYPES.ORDER,
            entityId: order._id,
            oldValue: { orderStatus: oldOrderStatus },
            newValue: { orderStatus: order.orderStatus },
            note: reason || 'Order cancelled by customer',
            session,
        });

        if (paymentChanged) {
            await logAudit({
                actorUserId: requester._id,
                actorRole: requester.role,
                action: AUDIT_ACTIONS.ORDER_PAYMENT_STATUS_UPDATED,
                entityType: AUDIT_ENTITY_TYPES.ORDER,
                entityId: order._id,
                oldValue: { paymentStatus: oldPaymentStatus },
                newValue: { paymentStatus: order.paymentStatus },
                note: reason || 'Payment refunded due to customer cancellation',
                session,
            });
        }

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    return getOrderForUser({ orderId, requester });
};

const markOrderAsReceived = async ({ orderId, requester }) => {
    requireObjectId(orderId, 'orderId');

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findById(orderId).session(session);

        if (!order) {
            throw new ApiError(404, 'Order not found');
        }

        if (String(order.user) !== String(requester._id)) {
            throw new ApiError(403, 'Not authorized to update this order');
        }

        assertOrderStatusTransition(order.orderStatus, ORDER_STATUSES.DELIVERED);
        const oldStatus = order.orderStatus;

        order.orderStatus = ORDER_STATUSES.DELIVERED;
        applyOrderStatusTimestamps(order, ORDER_STATUSES.DELIVERED);
        await order.save({ session });

        await logAudit({
            actorUserId: requester._id,
            actorRole: requester.role,
            action: AUDIT_ACTIONS.ORDER_STATUS_UPDATED,
            entityType: AUDIT_ENTITY_TYPES.ORDER,
            entityId: order._id,
            oldValue: { orderStatus: oldStatus },
            newValue: { orderStatus: order.orderStatus },
            note: 'Order marked as received by customer',
            session,
        });

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    return getOrderForUser({ orderId, requester });
};

const listOrdersForAdmin = async ({ filters }) => {
    const validatedFilters = validateOrderListFilters(filters);
    const mongoQuery = await buildMongoOrderQuery(validatedFilters);

    const allowedSortFields = new Set(['createdAt', 'updatedAt', 'total', 'subtotal', 'orderStatus', 'paymentStatus']);
    const sortField = allowedSortFields.has(validatedFilters.sortBy) ? validatedFilters.sortBy : 'createdAt';
    const sortDirection = validatedFilters.sortOrder === 'asc' ? 1 : -1;

    const [orders, total] = await Promise.all([
        Order.find(mongoQuery)
            .populate('user', 'name email role status')
            .sort({ [sortField]: sortDirection })
            .skip(validatedFilters.pagination.skip)
            .limit(validatedFilters.pagination.limit)
            .lean(),
        Order.countDocuments(mongoQuery),
    ]);

    const itemsMap = await getOrderItemsMap(orders.map((order) => order._id));

    return {
        items: orders.map((order) => formatOrderForResponse(order, itemsMap.get(String(order._id)) || [])),
        pagination: {
            page: validatedFilters.pagination.page,
            limit: validatedFilters.pagination.limit,
            total,
            pages: Math.ceil(total / validatedFilters.pagination.limit) || 1,
        },
    };
};

const getOrderForAdmin = async ({ orderId, includeAuditTrail = true }) => {
    requireObjectId(orderId, 'orderId');

    const { order, items } = await getOrderWithItemsOrThrow(orderId);

    let auditTrail = [];
    if (includeAuditTrail) {
        auditTrail = await getAuditTrail({ entityType: AUDIT_ENTITY_TYPES.ORDER, entityId: order._id, limit: 200 });
    }

    return formatOrderForResponse(order, items, { includeAuditTrail, auditTrail });
};

const updateOrderStatusByAdmin = async ({ orderId, newStatus, actor, note }) => {
    requireObjectId(orderId, 'orderId');
    const targetStatus = validateOrderStatusInput(newStatus);
    const noteValue = note ? validateAdminNoteInput(note) : null;

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findById(orderId).session(session);
        if (!order) {
            throw new ApiError(404, 'Order not found');
        }

        const oldStatus = order.orderStatus;
        assertOrderStatusTransition(order.orderStatus, targetStatus, {
            alreadyDispatched: order.shippedAt !== null,
        });

        if (targetStatus === ORDER_STATUSES.REFUNDED && order.paymentStatus !== PAYMENT_STATUSES.REFUNDED) {
            throw new ApiError(400, 'Order cannot be marked refunded until payment status is refunded');
        }

        await applyOrderStatusSideEffects({ order, newStatus: targetStatus, session });

        order.orderStatus = targetStatus;
        applyOrderStatusTimestamps(order, targetStatus);

        if (noteValue) {
            order.adminNote = noteValue;
        }

        await order.save({ session });

        await logAudit({
            actorUserId: actor._id,
            actorRole: actor.role,
            action: AUDIT_ACTIONS.ORDER_STATUS_UPDATED,
            entityType: AUDIT_ENTITY_TYPES.ORDER,
            entityId: order._id,
            oldValue: { orderStatus: oldStatus },
            newValue: { orderStatus: order.orderStatus },
            note: noteValue,
            session,
        });

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    return getOrderForAdmin({ orderId, includeAuditTrail: true });
};

const updatePaymentStatusByAdmin = async ({ orderId, newStatus, actor, note }) => {
    requireObjectId(orderId, 'orderId');
    const targetStatus = validatePaymentStatusInput(newStatus);
    const noteValue = note ? validateAdminNoteInput(note) : null;

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findById(orderId).session(session);
        if (!order) {
            throw new ApiError(404, 'Order not found');
        }

        assertPaymentStatusTransition(order.paymentStatus, targetStatus);

        if (
            targetStatus === PAYMENT_STATUSES.REFUNDED &&
            ![ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REFUND_REQUESTED, ORDER_STATUSES.REFUNDED].includes(order.orderStatus)
        ) {
            throw new ApiError(400, 'Payment can be refunded only for cancelled or refund-requested orders');
        }

        if (
            targetStatus === PAYMENT_STATUSES.PAID &&
            [ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REFUNDED, ORDER_STATUSES.FAILED].includes(order.orderStatus)
        ) {
            throw new ApiError(400, 'Cancelled, refunded, or failed orders cannot be marked as paid');
        }

        const oldPaymentStatus = order.paymentStatus;
        const paymentStatusChanged = oldPaymentStatus !== targetStatus;
        order.paymentStatus = targetStatus;

        if (targetStatus === PAYMENT_STATUSES.PAID && !order.paidAt) {
            order.paidAt = new Date();
        }

        if (targetStatus === PAYMENT_STATUSES.REFUNDED && !order.refundedAt) {
            order.refundedAt = new Date();
        }

        const oldOrderStatus = order.orderStatus;
        let orderStatusUpdated = false;

        if (targetStatus === PAYMENT_STATUSES.REFUNDED && order.orderStatus === ORDER_STATUSES.REFUND_REQUESTED) {
            order.orderStatus = ORDER_STATUSES.REFUNDED;
            orderStatusUpdated = true;
        }

        if (targetStatus === PAYMENT_STATUSES.PAID) {
            await applySuccessfulPaymentEffects({
                order,
                session,
                shouldCountOrder: oldPaymentStatus !== PAYMENT_STATUSES.PAID,
            });
        }

        await order.save({ session });

        if (paymentStatusChanged) {
            await logAudit({
                actorUserId: actor._id,
                actorRole: actor.role,
                action: AUDIT_ACTIONS.ORDER_PAYMENT_STATUS_UPDATED,
                entityType: AUDIT_ENTITY_TYPES.ORDER,
                entityId: order._id,
                oldValue: { paymentStatus: oldPaymentStatus },
                newValue: { paymentStatus: order.paymentStatus },
                note: noteValue,
                session,
            });
        }

        if (orderStatusUpdated) {
            await logAudit({
                actorUserId: actor._id,
                actorRole: actor.role,
                action: AUDIT_ACTIONS.ORDER_STATUS_UPDATED,
                entityType: AUDIT_ENTITY_TYPES.ORDER,
                entityId: order._id,
                oldValue: { orderStatus: oldOrderStatus },
                newValue: { orderStatus: order.orderStatus },
                note: 'Auto-transition after payment refund',
                session,
            });
        }

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    return getOrderForAdmin({ orderId, includeAuditTrail: true });
};

const updateAdminNote = async ({ orderId, note, actor }) => {
    requireObjectId(orderId, 'orderId');
    const validatedNote = validateAdminNoteInput(note);

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findById(orderId).session(session);
        if (!order) {
            throw new ApiError(404, 'Order not found');
        }

        const oldNote = order.adminNote;
        order.adminNote = validatedNote;
        await order.save({ session });

        await logAudit({
            actorUserId: actor._id,
            actorRole: actor.role,
            action: AUDIT_ACTIONS.ORDER_ADMIN_NOTE_UPDATED,
            entityType: AUDIT_ENTITY_TYPES.ORDER,
            entityId: order._id,
            oldValue: { adminNote: oldNote },
            newValue: { adminNote: order.adminNote },
            note: 'Admin note updated',
            session,
        });

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    return getOrderForAdmin({ orderId, includeAuditTrail: true });
};

const confirmAndDeliverAllOrdersBySuperAdmin = async ({ actor }) => {
    if (!actor || actor.role !== USER_ROLES.SUPER_ADMIN || actor.status !== USER_STATUSES.ACTIVE || actor.deletedAt) {
        throw new ApiError(403, 'Only Super Admin can perform this action.');
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const baseQuery = buildNonDeletedOrderScope();
        const totalNonDeletedOrders = await Order.countDocuments(baseQuery).session(session);
        const eligibleOrders = await Order.find({
            ...baseQuery,
            orderStatus: { $in: BULK_DELIVERABLE_STATUSES },
        }).session(session);

        if (eligibleOrders.length === 0) {
            await session.commitTransaction();

            return {
                success: true,
                message: 'No eligible orders found to confirm and deliver.',
                deliveredOrders: 0,
                skippedOrders: totalNonDeletedOrders,
            };
        }

        const deliveryTimestamp = new Date();

        for (const order of eligibleOrders) {
            const oldStatus = order.orderStatus;

            if (!order.stockReduced) {
                await applyOrderStatusSideEffects({
                    order,
                    newStatus: ORDER_STATUSES.CONFIRMED,
                    session,
                });
            }

            order.orderStatus = ORDER_STATUSES.DELIVERED;
            order.deliveredAt = deliveryTimestamp;
            order.deliveredBy = actor._id;
            order.bulkDelivered = true;
            await order.save({ session });

            await logAudit({
                actorUserId: actor._id,
                actorRole: actor.role,
                action: AUDIT_ACTIONS.ORDER_STATUS_UPDATED,
                entityType: AUDIT_ENTITY_TYPES.ORDER,
                entityId: order._id,
                oldValue: { orderStatus: oldStatus },
                newValue: {
                    orderStatus: order.orderStatus,
                    deliveredAt: order.deliveredAt,
                    deliveredBy: order.deliveredBy,
                    bulkDelivered: order.bulkDelivered,
                },
                note: 'Bulk confirmed and delivered by Super Admin',
                session,
            });
        }

        await session.commitTransaction();

        return {
            success: true,
            message: 'All eligible orders have been confirmed and marked as delivered.',
            deliveredOrders: eligibleOrders.length,
            skippedOrders: Math.max(totalNonDeletedOrders - eligibleOrders.length, 0),
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export {
    createOrder,
    listMyOrders,
    getOrderForUser,
    cancelMyOrder,
    markOrderAsReceived,
    listOrdersForAdmin,
    getOrderForAdmin,
    updateOrderStatusByAdmin,
    updatePaymentStatusByAdmin,
    updateAdminNote,
    confirmAndDeliverAllOrdersBySuperAdmin,
};
