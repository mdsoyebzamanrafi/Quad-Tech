import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../errors/ApiError.js';
import {
    cancelPriorityBoost as cancelPriorityBoostService,
    createPriorityBoost as createPriorityBoostService,
    getPriorityBoostById as getPriorityBoostByIdService,
    getPriorityBoostSummary as getPriorityBoostSummaryService,
    listPriorityBoosts as listPriorityBoostsService,
} from '../services/priorityBoostService.js';

const ALLOWED_PLACEMENTS = new Set(['personal', 'gift', 'both']);

const createPriorityBoost = asyncHandler(async (req, res) => {
    const {
        productId,
        feeAmount,
        startsAt,
        endsAt,
        durationDays,
        placement = 'both',
        note,
    } = req.body || {};

    if (!productId) {
        throw new ApiError(400, 'productId is required');
    }

    if (feeAmount === undefined || feeAmount === null || feeAmount === '') {
        throw new ApiError(400, 'feeAmount is required');
    }

    if (!(Number(feeAmount) > 0)) {
        throw new ApiError(400, 'feeAmount must be greater than 0');
    }

    if (!endsAt && !durationDays) {
        throw new ApiError(400, 'Either endsAt or durationDays is required');
    }

    if (durationDays !== undefined && durationDays !== null && durationDays !== '' && !(Number(durationDays) > 0)) {
        throw new ApiError(400, 'durationDays must be positive');
    }

    if (!ALLOWED_PLACEMENTS.has(String(placement || 'both').trim())) {
        throw new ApiError(400, 'placement must be personal, gift, or both');
    }

    const boost = await createPriorityBoostService({
        productId,
        feeAmount,
        startsAt,
        endsAt,
        durationDays,
        placement,
        note,
        createdBy: req.user?._id,
    });

    res.status(201).json({
        success: true,
        boost,
    });
});

const getPriorityBoosts = asyncHandler(async (req, res) => {
    const boosts = await listPriorityBoostsService(req.query || {});

    res.json({
        success: true,
        count: boosts.length,
        boosts,
    });
});

const getPriorityBoostById = asyncHandler(async (req, res) => {
    const boost = await getPriorityBoostByIdService(req.params.id);

    res.json({
        success: true,
        boost,
    });
});

const cancelPriorityBoost = asyncHandler(async (req, res) => {
    const boost = await cancelPriorityBoostService(req.params.id, req.user?._id);

    res.json({
        success: true,
        boost,
        message: 'Priority boost cancelled successfully',
    });
});

const getPriorityBoostSummary = asyncHandler(async (req, res) => {
    const summary = await getPriorityBoostSummaryService();

    res.json({
        success: true,
        summary,
    });
});

export {
    createPriorityBoost,
    getPriorityBoosts,
    getPriorityBoostById,
    cancelPriorityBoost,
    getPriorityBoostSummary,
};
