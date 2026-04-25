import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../errors/ApiError.js';
import Coupon from '../models/Coupon.js';
import {
    cleanString,
    parseDateOrThrow,
    parseOptionalNumberOrThrow,
    requireNonEmptyString,
    requireObjectId,
} from '../validators/commonValidators.js';
import { roundPrice, validateCouponForUser } from '../services/discountService.js';

const normalizeCouponCode = (value) => requireNonEmptyString(value, 'code').toUpperCase();

const parseDiscountType = (value) => {
    const discountType = requireNonEmptyString(value, 'discountType').toLowerCase();
    if (!['percentage', 'fixed'].includes(discountType)) {
        throw new ApiError(400, 'discountType must be either percentage or fixed');
    }

    return discountType;
};

const parseDiscountValue = (value, discountType) => {
    const discountValue = Number(value);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new ApiError(400, 'discountValue must be greater than 0');
    }

    if (discountType === 'percentage' && discountValue > 100) {
        throw new ApiError(400, 'Percentage discount cannot exceed 100');
    }

    return roundPrice(discountValue);
};

const parseNullableNumberField = (value, fieldName) => {
    if (value === undefined || value === '') {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    const parsed = parseOptionalNumberOrThrow(value, fieldName);
    if (parsed !== null && parsed < 0) {
        throw new ApiError(400, `${fieldName} cannot be negative`);
    }

    if (['usageLimit', 'perUserLimit'].includes(fieldName) && parsed !== null && !Number.isInteger(parsed)) {
        throw new ApiError(400, `${fieldName} must be a whole number`);
    }

    return ['minimumOrderAmount', 'maxDiscountAmount'].includes(fieldName) && parsed !== null
        ? roundPrice(parsed)
        : parsed;
};

const parseRequiredDate = (value) => {
    const date = parseDateOrThrow(value, 'expiresAt');
    if (!date) {
        throw new ApiError(400, 'expiresAt is required');
    }

    return date;
};

const buildCouponPayload = (body, { partial = false, currentCoupon = null } = {}) => {
    const payload = {};

    if (!partial || body.code !== undefined) {
        payload.code = normalizeCouponCode(body.code);
    }

    const hasDiscountType = body.discountType !== undefined;
    const hasDiscountValue = body.discountValue !== undefined;

    if (!partial || hasDiscountType) {
        payload.discountType = parseDiscountType(body.discountType);
    }

    if (!partial || hasDiscountValue) {
        const discountType = payload.discountType
            || (hasDiscountType ? parseDiscountType(body.discountType) : null)
            || currentCoupon?.discountType;
        const typeForValue = discountType || cleanString(body.discountType).toLowerCase();
        payload.discountValue = parseDiscountValue(body.discountValue, typeForValue);
    }

    const numberFields = ['minimumOrderAmount', 'maxDiscountAmount', 'usageLimit', 'perUserLimit'];
    for (const field of numberFields) {
        const parsedValue = parseNullableNumberField(body[field], field);
        if (parsedValue !== undefined) {
            payload[field] = field === 'minimumOrderAmount' && parsedValue === null ? 0 : parsedValue;
        }
    }

    if (payload.perUserLimit !== undefined && payload.perUserLimit !== null && payload.perUserLimit < 1) {
        throw new ApiError(400, 'perUserLimit must be at least 1');
    }

    if (!partial || body.expiresAt !== undefined) {
        payload.expiresAt = parseRequiredDate(body.expiresAt);
    }

    if (body.isActive !== undefined) {
        payload.isActive = Boolean(body.isActive);
    } else if (!partial) {
        payload.isActive = true;
    }

    return payload;
};

const createCoupon = asyncHandler(async (req, res) => {
    const payload = buildCouponPayload(req.body);

    const existingCoupon = await Coupon.findOne({ code: payload.code }).lean();
    if (existingCoupon) {
        throw new ApiError(409, 'Coupon code already exists');
    }

    const coupon = await Coupon.create({
        ...payload,
        createdBy: req.user._id,
    });

    res.status(201).json(coupon);
});

const getCoupons = asyncHandler(async (req, res) => {
    const coupons = await Coupon.find({})
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();

    res.json(coupons);
});

const getCouponById = asyncHandler(async (req, res) => {
    requireObjectId(req.params.id, 'couponId');

    const coupon = await Coupon.findById(req.params.id)
        .populate('createdBy', 'name email')
        .lean();

    if (!coupon) {
        throw new ApiError(404, 'Coupon not found');
    }

    res.json(coupon);
});

const updateCoupon = asyncHandler(async (req, res) => {
    requireObjectId(req.params.id, 'couponId');

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
        throw new ApiError(404, 'Coupon not found');
    }

    const payload = buildCouponPayload(req.body, { partial: true, currentCoupon: coupon });

    if (payload.code && payload.code !== coupon.code) {
        const duplicateCoupon = await Coupon.findOne({ code: payload.code, _id: { $ne: coupon._id } }).lean();
        if (duplicateCoupon) {
            throw new ApiError(409, 'Coupon code already exists');
        }
    }

    Object.assign(coupon, payload);
    await coupon.save();

    res.json(coupon);
});

const deleteCoupon = asyncHandler(async (req, res) => {
    requireObjectId(req.params.id, 'couponId');

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
        throw new ApiError(404, 'Coupon not found');
    }

    coupon.isActive = false;
    await coupon.save();

    res.json({ message: 'Coupon disabled successfully' });
});

const validateCoupon = asyncHandler(async (req, res) => {
    const code = normalizeCouponCode(req.body?.code);
    const itemsPrice = Number(req.body?.itemsPrice);

    if (!Number.isFinite(itemsPrice) || itemsPrice <= 0) {
        throw new ApiError(400, 'itemsPrice must be a valid positive number');
    }

    const coupon = await Coupon.findOne({ code });
    const validation = validateCouponForUser({
        coupon,
        userId: req.user._id,
        itemsPrice,
    });

    res.json({
        valid: true,
        code,
        discountAmount: validation.discountAmount,
        message: 'Coupon applied successfully',
    });
});

export {
    createCoupon,
    getCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    validateCoupon,
};
