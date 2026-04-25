import mongoose from 'mongoose';
import ApiError from '../errors/ApiError.js';

const TOKEN_CONVERSION_RATE = Number(process.env.TOKEN_CONVERSION_RATE ?? 10);
const MAX_TOKEN_DISCOUNT_PERCENT = Number(process.env.MAX_TOKEN_DISCOUNT_PERCENT ?? 20);
const TAX_RATE = Number(process.env.ORDER_TAX_RATE ?? 0.1);
const FREE_SHIPPING_THRESHOLD = Number(process.env.ORDER_FREE_SHIPPING_THRESHOLD ?? 1000);
const DEFAULT_SHIPPING_PRICE = Number(process.env.ORDER_SHIPPING_FEE ?? 100);

const roundPrice = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return Math.round(parsed * 100) / 100;
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

const calculateOrderTotals = ({ itemsPrice, couponDiscount, tokenDiscount }) => {
    const normalizedItemsPrice = roundPrice(itemsPrice);
    const normalizedCouponDiscount = Math.max(roundPrice(couponDiscount), 0);
    const normalizedTokenDiscount = Math.max(roundPrice(tokenDiscount), 0);
    const totalDiscount = roundPrice(normalizedCouponDiscount + normalizedTokenDiscount);
    const netItemsPrice = roundPrice(Math.max(normalizedItemsPrice - totalDiscount, 0));
    const taxPrice = roundPrice(netItemsPrice * TAX_RATE);
    const shippingPrice = roundPrice(netItemsPrice > FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_PRICE);
    const totalPrice = roundPrice(netItemsPrice + taxPrice + shippingPrice);

    return {
        itemsPrice: normalizedItemsPrice,
        grossItemsPrice: normalizedItemsPrice,
        netItemsPrice,
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
};
