import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../errors/ApiError.js';
import DiscountRule from '../models/DiscountRule.js';
import {
    cleanString,
    parseDateOrThrow,
    parseOptionalNumberOrThrow,
    requireNonEmptyString,
    requireObjectId,
} from '../validators/commonValidators.js';
import {
    calculateBestDiscount,
    roundPrice,
} from '../services/discountService.js';

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

const parseNullableNumberField = (value, fieldName, { integer = false } = {}) => {
    if (value === undefined) {
        return undefined;
    }

    if (value === null || value === '') {
        return null;
    }

    const parsed = parseOptionalNumberOrThrow(value, fieldName);
    if (parsed === null) {
        return null;
    }

    if (parsed < 0) {
        throw new ApiError(400, `${fieldName} cannot be negative`);
    }

    if (integer && !Number.isInteger(parsed)) {
        throw new ApiError(400, `${fieldName} must be a whole number`);
    }

    return roundPrice(parsed);
};

const parseOptionalBoolean = (value) => {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }

    return Boolean(value);
};

const parseOptionalDate = (value, fieldName) => {
    if (value === undefined) {
        return undefined;
    }

    if (value === null || value === '') {
        return null;
    }

    return parseDateOrThrow(value, fieldName);
};

const buildConditionsPayload = (body, { partial = false, currentRule = null } = {}) => {
    const source = body.conditions && typeof body.conditions === 'object' ? body.conditions : body;
    const existingConditions = currentRule?.conditions || {};

    const minCartTotal = parseNullableNumberField(source.minCartTotal, 'minCartTotal');
    const minOrderCount = parseNullableNumberField(source.minOrderCount, 'minOrderCount', { integer: true });
    const maxOrderCount = parseNullableNumberField(source.maxOrderCount, 'maxOrderCount', { integer: true });
    const firstOrderOnly = parseOptionalBoolean(source.firstOrderOnly);
    const returningCustomerOnly = parseOptionalBoolean(source.returningCustomerOnly);
    const inactiveDays = parseNullableNumberField(source.inactiveDays, 'inactiveDays', { integer: true });
    const category = source.category !== undefined ? cleanString(source.category) : undefined;

    const conditions = partial
        ? {
            minCartTotal: minCartTotal !== undefined ? minCartTotal : existingConditions.minCartTotal ?? null,
            minOrderCount: minOrderCount !== undefined ? minOrderCount : existingConditions.minOrderCount ?? null,
            maxOrderCount: maxOrderCount !== undefined ? maxOrderCount : existingConditions.maxOrderCount ?? null,
            firstOrderOnly: firstOrderOnly !== undefined ? firstOrderOnly : Boolean(existingConditions.firstOrderOnly),
            returningCustomerOnly: returningCustomerOnly !== undefined ? returningCustomerOnly : Boolean(existingConditions.returningCustomerOnly),
            category: category !== undefined ? category : cleanString(existingConditions.category),
            inactiveDays: inactiveDays !== undefined ? inactiveDays : existingConditions.inactiveDays ?? null,
        }
        : {
            minCartTotal: minCartTotal ?? null,
            minOrderCount: minOrderCount ?? null,
            maxOrderCount: maxOrderCount ?? null,
            firstOrderOnly: Boolean(firstOrderOnly),
            returningCustomerOnly: Boolean(returningCustomerOnly),
            category: category || '',
            inactiveDays: inactiveDays ?? null,
        };

    if (
        conditions.minOrderCount !== null
        && conditions.maxOrderCount !== null
        && conditions.minOrderCount > conditions.maxOrderCount
    ) {
        throw new ApiError(400, 'minOrderCount cannot be greater than maxOrderCount');
    }

    if (conditions.firstOrderOnly && conditions.returningCustomerOnly) {
        throw new ApiError(400, 'A rule cannot be both first-order-only and returning-customer-only');
    }

    return conditions;
};

const buildDiscountRulePayload = (body, { partial = false, currentRule = null } = {}) => {
    const payload = {};

    if (!partial || body.name !== undefined) {
        payload.name = requireNonEmptyString(body.name, 'name');
    }

    if (!partial || body.description !== undefined) {
        payload.description = cleanString(body.description);
    }

    const hasDiscountType = body.discountType !== undefined;
    const hasDiscountValue = body.discountValue !== undefined;

    if (!partial || hasDiscountType) {
        payload.discountType = parseDiscountType(body.discountType);
    }

    if (!partial || hasDiscountValue) {
        const effectiveDiscountType = payload.discountType || currentRule?.discountType || cleanString(body.discountType).toLowerCase();
        payload.discountValue = parseDiscountValue(body.discountValue, effectiveDiscountType);
    }

    const maxDiscountAmount = parseNullableNumberField(body.maxDiscountAmount, 'maxDiscountAmount');
    if (maxDiscountAmount !== undefined) {
        payload.maxDiscountAmount = maxDiscountAmount;
    } else if (!partial) {
        payload.maxDiscountAmount = null;
    }

    payload.conditions = buildConditionsPayload(body, { partial, currentRule });

    if (body.active !== undefined) {
        payload.active = parseOptionalBoolean(body.active);
    } else if (!partial) {
        payload.active = true;
    }

    const startDate = parseOptionalDate(body.startDate, 'startDate');
    const endDate = parseOptionalDate(body.endDate, 'endDate');

    if (startDate !== undefined) {
        payload.startDate = startDate;
    } else if (!partial) {
        payload.startDate = null;
    }

    if (endDate !== undefined) {
        payload.endDate = endDate;
    } else if (!partial) {
        payload.endDate = null;
    }

    const effectiveStartDate = payload.startDate !== undefined ? payload.startDate : currentRule?.startDate || null;
    const effectiveEndDate = payload.endDate !== undefined ? payload.endDate : currentRule?.endDate || null;

    if (effectiveStartDate && effectiveEndDate && effectiveStartDate > effectiveEndDate) {
        throw new ApiError(400, 'startDate cannot be later than endDate');
    }

    return payload;
};

const getDiscountRules = asyncHandler(async (req, res) => {
    const rules = await DiscountRule.find({})
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();

    res.json(rules);
});

const getDiscountRuleById = asyncHandler(async (req, res) => {
    requireObjectId(req.params.id, 'discountRuleId');

    const rule = await DiscountRule.findById(req.params.id)
        .populate('createdBy', 'name email')
        .lean();

    if (!rule) {
        throw new ApiError(404, 'Discount rule not found');
    }

    res.json(rule);
});

const createDiscountRule = asyncHandler(async (req, res) => {
    const payload = buildDiscountRulePayload(req.body);

    const rule = await DiscountRule.create({
        ...payload,
        createdBy: req.user._id,
    });

    res.status(201).json(rule);
});

const updateDiscountRule = asyncHandler(async (req, res) => {
    requireObjectId(req.params.id, 'discountRuleId');

    const rule = await DiscountRule.findById(req.params.id);
    if (!rule) {
        throw new ApiError(404, 'Discount rule not found');
    }

    const payload = buildDiscountRulePayload(req.body, { partial: true, currentRule: rule });
    Object.assign(rule, payload);
    await rule.save();

    res.json(rule);
});

const deleteDiscountRule = asyncHandler(async (req, res) => {
    requireObjectId(req.params.id, 'discountRuleId');

    const rule = await DiscountRule.findById(req.params.id);
    if (!rule) {
        throw new ApiError(404, 'Discount rule not found');
    }

    await rule.deleteOne();
    res.json({ message: 'Discount rule deleted successfully' });
});

const toggleDiscountRule = asyncHandler(async (req, res) => {
    requireObjectId(req.params.id, 'discountRuleId');

    const rule = await DiscountRule.findById(req.params.id);
    if (!rule) {
        throw new ApiError(404, 'Discount rule not found');
    }

    rule.active = !rule.active;
    await rule.save();

    res.json(rule);
});

const getEligibleSmartDiscount = asyncHandler(async (req, res) => {
    if (!Array.isArray(req.body?.cartItems)) {
        throw new ApiError(400, 'cartItems must be an array');
    }

    const result = await calculateBestDiscount(req.user._id, req.body.cartItems);

    if (!result.eligible) {
        res.json({
            eligible: false,
            discountAmount: 0,
            subtotal: result.subtotal,
            finalTotal: result.finalTotal,
        });
        return;
    }

    res.json({
        eligible: true,
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        discountType: result.discountType,
        discountValue: result.discountValue,
        discountAmount: result.discountAmount,
        subtotal: result.subtotal,
        finalTotal: result.finalTotal,
    });
});

export {
    getDiscountRules,
    getDiscountRuleById,
    createDiscountRule,
    updateDiscountRule,
    deleteDiscountRule,
    toggleDiscountRule,
    getEligibleSmartDiscount,
};
