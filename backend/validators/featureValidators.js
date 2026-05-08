import ApiError from '../errors/ApiError.js';
import {
    ORDER_STATUS_VALUES,
    PAYMENT_STATUS_VALUES,
    PAYMENT_METHOD_VALUES,
    PAYMENT_METHODS,
    USER_ROLE_VALUES,
    USER_STATUSES,
    USER_STATUS_VALUES,
} from '../constants/domainConstants.js';
import {
    cleanString,
    parseDateOrThrow,
    parseOptionalNumberOrThrow,
    parsePagination,
    requireNonNegativeNumber,
    requireNonEmptyString,
    requireObjectId,
    requirePositiveInteger,
} from './commonValidators.js';

const normalizePaymentMethod = (value) => {
    const raw = requireNonEmptyString(value, 'paymentMethod').toLowerCase();

    if (raw === 'cod') {
        return PAYMENT_METHODS.CASH_ON_DELIVERY;
    }

    if (raw === 'cash on delivery') {
        return PAYMENT_METHODS.CASH_ON_DELIVERY;
    }

    if (raw === 'paypal') {
        return PAYMENT_METHODS.PAYPAL;
    }

    if (raw === 'stripe') {
        return PAYMENT_METHODS.STRIPE;
    }

    if (PAYMENT_METHOD_VALUES.includes(raw)) {
        return raw;
    }

    throw new ApiError(400, 'paymentMethod is invalid');
};

const normalizeOptionalText = (value) => cleanString(value);

const normalizeOptionalNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(value);

const normalizeCustomDesign = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const designs = Array.isArray(value.designs)
        ? value.designs
            .slice(0, 30)
            .map((design, index) => ({
                assetId: cleanString(design?.assetId),
                imagePath: cleanString(design?.imagePath),
                x: normalizeOptionalNumber(design?.x),
                y: normalizeOptionalNumber(design?.y),
                width: Math.max(normalizeOptionalNumber(design?.width), 0),
                height: Math.max(normalizeOptionalNumber(design?.height), 0),
                rotation: normalizeOptionalNumber(design?.rotation),
                zIndex: Number.isInteger(Number(design?.zIndex)) ? Number(design.zIndex) : index + 1,
            }))
            .filter((design) => design.assetId)
        : [];

    const shirtColor = cleanString(value.shirtColor);

    return {
        designId: cleanString(value.designId),
        shirtColor: isHexColor(shirtColor) ? shirtColor : '',
        templateId: cleanString(value.templateId),
        templatePath: cleanString(value.templatePath),
        previewImageUrl: cleanString(value.previewImageUrl),
        previewImagePublicId: cleanString(value.previewImagePublicId),
        designs,
    };
};

const buildCustomDesignKey = (customDesign) => {
    if (!customDesign) {
        return '';
    }

    if (customDesign.designId) {
        return customDesign.designId;
    }

    return JSON.stringify({
        shirtColor: customDesign.shirtColor,
        templateId: customDesign.templateId,
        designs: customDesign.designs,
    });
};

const validateCreateOrderInput = (payload) => {
    if (!payload || typeof payload !== 'object') {
        throw new ApiError(400, 'Request body is required');
    }

    if (!Array.isArray(payload.orderItems) || payload.orderItems.length === 0) {
        throw new ApiError(400, 'Cart is empty. At least one order item is required');
    }

    const dedupeMap = new Map();

    for (const item of payload.orderItems) {
        const productId = requireObjectId(item.product, 'orderItems.product');
        const quantity = requirePositiveInteger(item.qty, 'orderItems.qty');
        const selectedColor = normalizeOptionalText(item.selectedColor);
        const selectedSize = normalizeOptionalText(item.selectedSize);
        const customDesign = normalizeCustomDesign(item.customDesign);
        const itemKey = `${productId}::${selectedColor}::${selectedSize}::${buildCustomDesignKey(customDesign)}`;
        const existing = dedupeMap.get(itemKey) || {
            productId,
            quantity: 0,
            selectedColor,
            selectedSize,
            customDesign,
        };

        existing.quantity += quantity;
        dedupeMap.set(itemKey, existing);
    }

    const orderItems = Array.from(dedupeMap.values());

    const shippingAddress = payload.shippingAddress || {};
    const addressLine = requireNonEmptyString(shippingAddress.address, 'shippingAddress.address');
    const city = requireNonEmptyString(shippingAddress.city, 'shippingAddress.city');
    const postalCode = requireNonEmptyString(shippingAddress.postalCode, 'shippingAddress.postalCode');
    const country = requireNonEmptyString(shippingAddress.country, 'shippingAddress.country');

    const shippingName = cleanString(payload.shippingName);
    const shippingPhone = cleanString(payload.shippingPhone || shippingAddress.phone);
    const addressLine2 = cleanString(shippingAddress.addressLine2);

    const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
    const couponCode = cleanString(payload.couponCode).toUpperCase();
    let requestedTokens = 0;

    if (payload.requestedTokens !== undefined && payload.requestedTokens !== null && payload.requestedTokens !== '') {
        const parsedTokens = requireNonNegativeNumber(payload.requestedTokens, 'requestedTokens');
        if (!Number.isInteger(parsedTokens)) {
            throw new ApiError(400, 'requestedTokens must be a whole number');
        }
        requestedTokens = parsedTokens;
    }

    return {
        orderItems,
        shipping: {
            shippingName,
            shippingPhone,
            addressLine,
            addressLine2,
            city,
            postalCode,
            country,
        },
        paymentMethod,
        couponCode,
        requestedTokens,
    };
};

const validateOrderStatusInput = (status) => {
    if (!ORDER_STATUS_VALUES.includes(status)) {
        throw new ApiError(400, 'orderStatus is invalid');
    }
    return status;
};

const validatePaymentStatusInput = (status) => {
    if (!PAYMENT_STATUS_VALUES.includes(status)) {
        throw new ApiError(400, 'paymentStatus is invalid');
    }
    return status;
};

const validateAdminNoteInput = (note) => {
    const cleaned = cleanString(note);
    if (!cleaned) {
        throw new ApiError(400, 'adminNote is required');
    }
    if (cleaned.length > 2000) {
        throw new ApiError(400, 'adminNote is too long');
    }
    return cleaned;
};

const validateOrderListFilters = (query) => {
    const { page, limit, skip } = parsePagination(query, { page: 1, limit: 20, maxLimit: 100 });

    const filters = {
        pagination: { page, limit, skip },
        status: query.status || null,
        paymentStatus: query.paymentStatus || null,
        userId: query.user || null,
        dateFrom: parseDateOrThrow(query.dateFrom, 'dateFrom'),
        dateTo: parseDateOrThrow(query.dateTo, 'dateTo'),
        minAmount: parseOptionalNumberOrThrow(query.minAmount, 'minAmount'),
        maxAmount: parseOptionalNumberOrThrow(query.maxAmount, 'maxAmount'),
        search: cleanString(query.search || query.q),
        sortBy: cleanString(query.sortBy) || 'createdAt',
        sortOrder: cleanString(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    if (filters.status) validateOrderStatusInput(filters.status);
    if (filters.paymentStatus) validatePaymentStatusInput(filters.paymentStatus);
    if (filters.userId) requireObjectId(filters.userId, 'user');

    if (filters.minAmount !== null && filters.maxAmount !== null && filters.minAmount > filters.maxAmount) {
        throw new ApiError(400, 'minAmount cannot be greater than maxAmount');
    }

    return filters;
};

const validateUserListFilters = (query) => {
    const { page, limit, skip } = parsePagination(query, { page: 1, limit: 20, maxLimit: 100 });
    const role = cleanString(query.role);
    const status = cleanString(query.status);
    const includeDeleted = cleanString(query.includeDeleted).toLowerCase() === 'true';

    if (role && !USER_ROLE_VALUES.includes(role)) {
        throw new ApiError(400, 'role filter is invalid');
    }

    if (status && !USER_STATUS_VALUES.includes(status)) {
        throw new ApiError(400, 'status filter is invalid');
    }

    if (status === USER_STATUSES.DELETED && !includeDeleted) {
        throw new ApiError(400, 'Use includeDeleted=true when filtering deleted users');
    }

    return {
        pagination: { page, limit, skip },
        role: role || null,
        status: status || null,
        search: cleanString(query.search || query.q),
        includeDeleted,
        sortBy: cleanString(query.sortBy) || 'createdAt',
        sortOrder: cleanString(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
    };
};

const validateUserStatusInput = (status) => {
    if (!USER_STATUS_VALUES.includes(status)) {
        throw new ApiError(400, 'status is invalid');
    }

    return status;
};

const validateUserRoleInput = (role) => {
    if (!USER_ROLE_VALUES.includes(role)) {
        throw new ApiError(400, 'role is invalid');
    }

    return role;
};

export {
    normalizePaymentMethod,
    validateCreateOrderInput,
    validateOrderStatusInput,
    validatePaymentStatusInput,
    validateAdminNoteInput,
    validateOrderListFilters,
    validateUserListFilters,
    validateUserStatusInput,
    validateUserRoleInput,
};
