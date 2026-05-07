import mongoose from 'mongoose';
import ApiError from '../errors/ApiError.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import DiscountRule from '../models/DiscountRule.js';
import {
    ORDER_STATUSES,
    PAYMENT_STATUSES,
} from '../constants/domainConstants.js';

const TOKEN_CONVERSION_RATE = Number(process.env.TOKEN_CONVERSION_RATE ?? 10);
const MAX_TOKEN_DISCOUNT_PERCENT = Number(process.env.MAX_TOKEN_DISCOUNT_PERCENT ?? 20);
const TAX_RATE = Number(process.env.ORDER_TAX_RATE ?? 0.1);
const FREE_SHIPPING_THRESHOLD = Number(process.env.ORDER_FREE_SHIPPING_THRESHOLD ?? 1000);
const DEFAULT_SHIPPING_PRICE = Number(process.env.ORDER_SHIPPING_FEE ?? 100);
const NON_SUCCESSFUL_ORDER_STATUSES = [
    ORDER_STATUSES.CANCELLED,
    ORDER_STATUSES.REFUNDED,
    ORDER_STATUSES.FAILED,
];

const roundPrice = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return Math.round(parsed * 100) / 100;
};

const normalizeCategory = (value) => (
    typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const buildSuccessfulOrderQuery = (userId) => ({
    user: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
    paymentStatus: PAYMENT_STATUSES.PAID,
    $or: [
        { orderStatus: { $exists: false } },
        { orderStatus: null },
        { orderStatus: { $nin: NON_SUCCESSFUL_ORDER_STATUSES } },
    ],
});

const calculateSmartCartSubtotal = (items) => roundPrice(
    items.reduce((sum, item) => {
        const lineTotal = item?.lineTotal ?? ((Number(item?.unitPrice || item?.price || 0) || 0) * (Number(item?.quantity || item?.qty || 0) || 0));
        return sum + Number(lineTotal || 0);
    }, 0)
);

const normalizeProvidedSmartDiscountItems = (items) => {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .map((item) => {
            const quantity = Number(item?.quantity ?? item?.qty ?? 0);
            const unitPrice = roundPrice(item?.unitPrice ?? item?.price ?? 0);

            if (!Number.isInteger(quantity) || quantity <= 0) {
                return null;
            }

            return {
                productId: String(item?.productId || item?.product || '').trim(),
                quantity,
                unitPrice,
                lineTotal: roundPrice(item?.lineTotal ?? (unitPrice * quantity)),
                category: typeof item?.category === 'string' ? item.category.trim() : '',
            };
        })
        .filter(Boolean);
};

const loadNormalizedSmartDiscountCart = async (
    cartItems,
    {
        normalizedCartItems = null,
        subtotal = null,
        productsById = null,
        session = null,
    } = {}
) => {
    if (Array.isArray(normalizedCartItems)) {
        const items = normalizeProvidedSmartDiscountItems(normalizedCartItems);
        return {
            items,
            subtotal: subtotal !== null && subtotal !== undefined
                ? roundPrice(subtotal)
                : calculateSmartCartSubtotal(items),
        };
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return { items: [], subtotal: 0 };
    }

    const requestedItems = [];
    const productIds = new Set();

    for (const item of cartItems) {
        const productId = String(item?.product || item?.productId || '').trim();
        const quantity = Number(item?.qty ?? item?.quantity ?? 0);

        if (!mongoose.Types.ObjectId.isValid(productId) || !Number.isInteger(quantity) || quantity <= 0) {
            continue;
        }

        requestedItems.push({ productId, quantity });
        productIds.add(productId);
    }

    if (requestedItems.length === 0) {
        return { items: [], subtotal: 0 };
    }

    let productMap = productsById;

    if (!(productMap instanceof Map)) {
        const query = Product.find(
            { _id: { $in: Array.from(productIds) } },
            { price: 1, category: 1 }
        ).lean();

        if (session) {
            query.session(session);
        }

        const products = await query;
        productMap = new Map(products.map((product) => [String(product._id), product]));
    }

    const items = [];

    for (const cartItem of requestedItems) {
        const product = productMap.get(cartItem.productId);
        if (!product) {
            continue;
        }

        const unitPrice = roundPrice(product.price);
        const lineTotal = roundPrice(unitPrice * cartItem.quantity);

        items.push({
            productId: cartItem.productId,
            quantity: cartItem.quantity,
            unitPrice,
            lineTotal,
            category: typeof product.category === 'string' ? product.category.trim() : '',
        });
    }

    return {
        items,
        subtotal: subtotal !== null && subtotal !== undefined
            ? roundPrice(subtotal)
            : calculateSmartCartSubtotal(items),
    };
};

const calculateCouponDiscount = ({ coupon, itemsPrice }) => {
    const normalizedItemsPrice = Math.max(roundPrice(itemsPrice), 0);

    if (!coupon) {
        return 0;
    }

    let discount = 0;

    if (coupon.discountType === 'percentage') {
        discount = (normalizedItemsPrice * Number(coupon.discountValue || 0)) / 100;
        if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount !== undefined) {
            discount = Math.min(discount, Number(coupon.maxDiscountAmount));
        }
    } else if (coupon.discountType === 'fixed') {
        discount = Number(coupon.discountValue || 0);
    }

    discount = Math.max(discount, 0);
    discount = Math.min(discount, normalizedItemsPrice);

    return roundPrice(discount);
};

const countUserCouponUses = ({ coupon, userId }) => {
    if (!coupon || !Array.isArray(coupon.usedBy) || !userId) {
        return 0;
    }

    return coupon.usedBy.filter((entry) => {
        if (!entry?.user) {
            return false;
        }

        return String(entry.user) === String(userId);
    }).length;
};

const validateCouponForUser = ({ coupon, userId, itemsPrice }) => {
    const normalizedItemsPrice = roundPrice(itemsPrice);

    if (!coupon) {
        throw new ApiError(400, 'Coupon not found');
    }

    if (!coupon.isActive) {
        throw new ApiError(400, 'Coupon is inactive');
    }

    const expiresAt = new Date(coupon.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        throw new ApiError(400, 'Coupon has expired');
    }

    if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
        throw new ApiError(400, 'Coupon usage limit reached');
    }

    if (normalizedItemsPrice < Number(coupon.minimumOrderAmount || 0)) {
        throw new ApiError(400, 'Minimum order amount not reached for this coupon');
    }

    const userUsageCount = countUserCouponUses({ coupon, userId });
    if (coupon.perUserLimit !== null && coupon.perUserLimit !== undefined && userUsageCount >= coupon.perUserLimit) {
        throw new ApiError(400, 'Per-user coupon limit reached');
    }

    const discountAmount = calculateCouponDiscount({ coupon, itemsPrice: normalizedItemsPrice });

    return {
        valid: true,
        discountAmount,
    };
};

const calculateTokenDiscount = ({ user, requestedTokens, remainingAmountAfterCoupon }) => {
    const normalizedRequestedTokens = Number(requestedTokens);
    const balance = Math.max(Number(user?.rewardTokens || 0), 0);
    const remaining = Math.max(roundPrice(remainingAmountAfterCoupon), 0);

    if (
        requestedTokens === undefined ||
        requestedTokens === null ||
        requestedTokens === false ||
        requestedTokens === '' ||
        !Number.isFinite(normalizedRequestedTokens) ||
        normalizedRequestedTokens <= 0
    ) {
        return { tokensUsed: 0, discountAmount: 0 };
    }

    if (!Number.isInteger(normalizedRequestedTokens)) {
        throw new ApiError(400, 'Requested tokens must be a whole number');
    }

    if (normalizedRequestedTokens < 0) {
        throw new ApiError(400, 'Requested tokens cannot be negative');
    }

    if (normalizedRequestedTokens > balance) {
        throw new ApiError(400, 'Requested tokens exceed available reward token balance');
    }

    const maxDiscountAmount = roundPrice((remaining * MAX_TOKEN_DISCOUNT_PERCENT) / 100);
    const maxTokensByDiscountCap = Math.floor(maxDiscountAmount * TOKEN_CONVERSION_RATE);
    const tokensUsed = Math.max(
        0,
        Math.min(normalizedRequestedTokens, balance, maxTokensByDiscountCap)
    );
    const discountAmount = roundPrice(tokensUsed / TOKEN_CONVERSION_RATE);

    return {
        tokensUsed,
        discountAmount,
    };
};

const calculateOrderTotals = ({ itemsPrice, smartDiscount = 0, couponDiscount, tokenDiscount }) => {
    const normalizedItemsPrice = roundPrice(itemsPrice);
    const normalizedSmartDiscount = Math.min(Math.max(roundPrice(smartDiscount), 0), normalizedItemsPrice);
    const normalizedCouponDiscount = Math.min(Math.max(roundPrice(couponDiscount), 0), normalizedItemsPrice);
    const normalizedTokenDiscount = Math.min(Math.max(roundPrice(tokenDiscount), 0), normalizedItemsPrice);
    const totalDiscount = roundPrice(Math.min(
        normalizedSmartDiscount + normalizedCouponDiscount + normalizedTokenDiscount,
        normalizedItemsPrice
    ));
    const netItemsPrice = roundPrice(Math.max(normalizedItemsPrice - totalDiscount, 0));
    const taxPrice = roundPrice(netItemsPrice * TAX_RATE);
    const shippingPrice = roundPrice(netItemsPrice > FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_PRICE);
    const totalPrice = roundPrice(netItemsPrice + taxPrice + shippingPrice);

    return {
        itemsPrice: normalizedItemsPrice,
        grossItemsPrice: normalizedItemsPrice,
        netItemsPrice,
        smartDiscount: normalizedSmartDiscount,
        couponDiscount: normalizedCouponDiscount,
        tokenDiscount: normalizedTokenDiscount,
        totalDiscount,
        taxPrice,
        shippingPrice,
        totalPrice,
    };
};

const toObjectId = (value) => {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
        return null;
    }

    return new mongoose.Types.ObjectId(value);
};

const getActiveDiscountRules = async ({ session = null } = {}) => {
    const query = DiscountRule.find({ active: true })
        .sort({ createdAt: -1 })
        .lean();

    if (session) {
        query.session(session);
    }

    return query;
};

const calculateDiscountAmount = (rule, subtotal) => {
    const normalizedSubtotal = Math.max(roundPrice(subtotal), 0);
    if (!rule || normalizedSubtotal <= 0) {
        return 0;
    }

    let discountAmount = 0;

    if (rule.discountType === 'percentage') {
        discountAmount = (normalizedSubtotal * Number(rule.discountValue || 0)) / 100;
    } else if (rule.discountType === 'fixed') {
        discountAmount = Number(rule.discountValue || 0);
    }

    if (rule.maxDiscountAmount !== null && rule.maxDiscountAmount !== undefined) {
        discountAmount = Math.min(discountAmount, Number(rule.maxDiscountAmount));
    }

    discountAmount = Math.max(roundPrice(discountAmount), 0);
    discountAmount = Math.min(discountAmount, normalizedSubtotal);

    return roundPrice(discountAmount);
};

const checkRuleEligibility = (rule, user, cartItems, userOrders) => {
    if (!rule?.active) {
        return false;
    }

    const now = new Date();
    if (rule.startDate && now < new Date(rule.startDate)) {
        return false;
    }

    if (rule.endDate && now > new Date(rule.endDate)) {
        return false;
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return false;
    }

    const conditions = rule.conditions || {};
    const subtotal = calculateSmartCartSubtotal(cartItems);
    const orderHistory = Array.isArray(userOrders) ? userOrders : [];
    const orderCount = orderHistory.length;

    if (conditions.minCartTotal !== null && conditions.minCartTotal !== undefined && subtotal < Number(conditions.minCartTotal)) {
        return false;
    }

    if (conditions.minOrderCount !== null && conditions.minOrderCount !== undefined && orderCount < Number(conditions.minOrderCount)) {
        return false;
    }

    if (conditions.maxOrderCount !== null && conditions.maxOrderCount !== undefined && orderCount > Number(conditions.maxOrderCount)) {
        return false;
    }

    if (conditions.firstOrderOnly && orderCount !== 0) {
        return false;
    }

    if (conditions.returningCustomerOnly && orderCount < 1) {
        return false;
    }

    if (conditions.category) {
        const targetCategory = normalizeCategory(conditions.category);
        const hasMatchingCategory = cartItems.some((item) => normalizeCategory(item.category) === targetCategory);

        if (!hasMatchingCategory) {
            return false;
        }
    }

    if (conditions.inactiveDays !== null && conditions.inactiveDays !== undefined) {
        const lastSuccessfulOrder = orderHistory.reduce((latest, order) => {
            if (!order?.createdAt) {
                return latest;
            }

            if (!latest?.createdAt) {
                return order;
            }

            return new Date(order.createdAt) > new Date(latest.createdAt) ? order : latest;
        }, null);
        if (!lastSuccessfulOrder?.createdAt) {
            return false;
        }

        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - Number(conditions.inactiveDays));

        if (new Date(lastSuccessfulOrder.createdAt) > thresholdDate) {
            return false;
        }
    }

    return Boolean(user);
};

const getEligibleDiscounts = async (userId, cartItems, options = {}) => {
    if (!userId) {
        throw new ApiError(401, 'Authentication required');
    }

    const {
        user: providedUser = null,
        userOrders: providedUserOrders = null,
        normalizedCartItems = null,
        subtotal = null,
        productsById = null,
        session = null,
    } = options;

    const user = providedUser || await (() => {
        const query = User.findById(userId).lean();
        if (session) {
            query.session(session);
        }

        return query;
    })();
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const cartContext = await loadNormalizedSmartDiscountCart(cartItems, {
        normalizedCartItems,
        subtotal,
        productsById,
        session,
    });

    if (cartContext.items.length === 0 || cartContext.subtotal <= 0) {
        return {
            eligibleDiscounts: [],
            subtotal: cartContext.subtotal,
        };
    }

    const [rules, userOrders] = await Promise.all([
        getActiveDiscountRules({ session }),
        providedUserOrders
            ? Promise.resolve(providedUserOrders)
            : (() => {
                const query = Order.find(
                    buildSuccessfulOrderQuery(user._id),
                    { createdAt: 1 }
                )
                    .sort({ createdAt: -1 })
                    .lean();

                if (session) {
                    query.session(session);
                }

                return query;
            })(),
    ]);

    if (rules.length === 0) {
        return {
            eligibleDiscounts: [],
            subtotal: cartContext.subtotal,
        };
    }

    const eligibleDiscounts = [];

    for (const rule of rules) {
        if (!checkRuleEligibility(rule, user, cartContext.items, userOrders)) {
            continue;
        }

        const discountAmount = calculateDiscountAmount(rule, cartContext.subtotal);
        if (discountAmount <= 0) {
            continue;
        }

        eligibleDiscounts.push({
            rule,
            discountAmount,
        });
    }

    return {
        eligibleDiscounts,
        subtotal: cartContext.subtotal,
    };
};

const calculateBestDiscount = async (userId, cartItems, options = {}) => {
    const { eligibleDiscounts, subtotal } = await getEligibleDiscounts(userId, cartItems, options);

    if (eligibleDiscounts.length === 0) {
        return {
            eligible: false,
            discountAmount: 0,
            subtotal,
            finalTotal: roundPrice(subtotal),
        };
    }

    const bestDiscount = eligibleDiscounts.reduce((best, candidate) => {
        if (!best) {
            return candidate;
        }

        if (candidate.discountAmount > best.discountAmount) {
            return candidate;
        }

        if (candidate.discountAmount === best.discountAmount) {
            const bestCreatedAt = new Date(best.rule.createdAt || 0).getTime();
            const candidateCreatedAt = new Date(candidate.rule.createdAt || 0).getTime();
            return candidateCreatedAt > bestCreatedAt ? candidate : best;
        }

        return best;
    }, null);

    return {
        eligible: true,
        ruleId: String(bestDiscount.rule._id),
        ruleName: bestDiscount.rule.name,
        discountType: bestDiscount.rule.discountType,
        discountValue: Number(bestDiscount.rule.discountValue || 0),
        discountAmount: roundPrice(bestDiscount.discountAmount),
        subtotal,
        finalTotal: roundPrice(Math.max(subtotal - bestDiscount.discountAmount, 0)),
    };
};

export {
    TOKEN_CONVERSION_RATE,
    MAX_TOKEN_DISCOUNT_PERCENT,
    TAX_RATE,
    FREE_SHIPPING_THRESHOLD,
    DEFAULT_SHIPPING_PRICE,
    roundPrice,
    calculateCouponDiscount,
    validateCouponForUser,
    calculateTokenDiscount,
    calculateOrderTotals,
    toObjectId,
    getActiveDiscountRules,
    getEligibleDiscounts,
    calculateBestDiscount,
    calculateDiscountAmount,
    checkRuleEligibility,
};
