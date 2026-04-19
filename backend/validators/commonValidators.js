import mongoose from 'mongoose';
import ApiError from '../errors/ApiError.js';

const cleanString = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim();
};

const requireNonEmptyString = (value, fieldName) => {
    const cleaned = cleanString(value);
    if (!cleaned) {
        throw new ApiError(400, `${fieldName} is required`);
    }
    return cleaned;
};

const requirePositiveInteger = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ApiError(400, `${fieldName} must be a positive integer`);
    }
    return parsed;
};

const requireNonNegativeNumber = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ApiError(400, `${fieldName} must be a non-negative number`);
    }
    return parsed;
};

const toRoundedCurrency = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    return Math.round(parsed * 100) / 100;
};

const requireObjectId = (value, fieldName = 'id') => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `${fieldName} is invalid`);
    }
    return value;
};

const parsePagination = (query, defaults = { page: 1, limit: 20, maxLimit: 100 }) => {
    const page = Math.max(parseInt(query.page, 10) || defaults.page, 1);
    const requestedLimit = parseInt(query.limit, 10) || defaults.limit;
    const limit = Math.max(1, Math.min(requestedLimit, defaults.maxLimit));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

const parseDateOrThrow = (value, fieldName) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new ApiError(400, `${fieldName} must be a valid date`);
    }
    return date;
};

const parseOptionalNumberOrThrow = (value, fieldName) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new ApiError(400, `${fieldName} must be a valid number`);
    }
    return parsed;
};

export {
    cleanString,
    requireNonEmptyString,
    requirePositiveInteger,
    requireNonNegativeNumber,
    toRoundedCurrency,
    requireObjectId,
    parsePagination,
    parseDateOrThrow,
    parseOptionalNumberOrThrow,
};
