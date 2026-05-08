import mongoose from 'mongoose';
import ApiError from '../errors/ApiError.js';
import PriorityBoost from '../models/PriorityBoost.js';
import Product from '../models/Product.js';
import { cleanString, parseDateOrThrow, requireObjectId, toRoundedCurrency } from '../validators/commonValidators.js';

const PERSONAL_MAX_PAID_BOOST = 5;
const GIFT_MAX_PAID_BOOST = 7;
const PRIORITY_RECOMMENDATION_RATIO = 0.2;
const BOOST_PLACEMENTS = new Set(['personal', 'gift', 'both']);

const BOOST_POPULATE = [
    {
        path: 'product',
        select: 'name image price category countInStock stock createdAt updatedAt isActive status user seller createdBy',
    },
    {
        path: 'seller',
        select: 'name email',
    },
    {
        path: 'createdBy',
        select: 'name email',
    },
    {
        path: 'cancelledBy',
        select: 'name email',
    },
];

const BOOSTED_PRODUCT_POPULATE = {
    path: 'product',
    select: [
        'name',
        'image',
        'images',
        'brand',
        'category',
        'department',
        'description',
        'gender',
        'price',
        'countInStock',
        'stock',
        'rating',
        'averageRating',
        'numReviews',
        'colors',
        'sizes',
        'material',
        'fit',
        'occasion',
        'season',
        'styleTags',
        'tags',
        'productType',
        'isNewArrival',
        'adminPriorityScore',
        'isSponsored',
        'sponsoredWeight',
        'isActive',
        'status',
        'createdAt',
        'updatedAt',
        'user',
        'seller',
        'createdBy',
    ].join(' '),
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toObjectIdString = (value) => {
    if (!value) {
        return '';
    }

    if (typeof value === 'string') {
        return value;
    }

    if (value instanceof mongoose.Types.ObjectId) {
        return value.toString();
    }

    if (typeof value === 'object' && value._id) {
        return toObjectIdString(value._id);
    }

    return '';
};

const singularizeCategoryToken = (value) => {
    const normalizedValue = String(value || '').trim().toLowerCase();

    if (!normalizedValue) {
        return '';
    }

    if (normalizedValue.endsWith('ies') && normalizedValue.length > 3) {
        return `${normalizedValue.slice(0, -3)}y`;
    }

    if (/(ches|shes|sses|xes|zes|oes)$/.test(normalizedValue)) {
        return normalizedValue.slice(0, -2);
    }

    if (normalizedValue.endsWith('s') && !normalizedValue.endsWith('ss')) {
        return normalizedValue.slice(0, -1);
    }

    return normalizedValue;
};

const normalizeCategory = (category) => {
    if (typeof category !== 'string') {
        return '';
    }

    const normalized = category
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');

    if (!normalized) {
        return '';
    }

    const tokens = normalized.split(' ');
    const lastTokenIndex = tokens.length - 1;
    tokens[lastTokenIndex] = singularizeCategoryToken(tokens[lastTokenIndex]);

    return tokens.join(' ');
};

const addCollectedCategory = (categories, value) => {
    const normalized = normalizeCategory(value);
    if (normalized) {
        categories.add(normalized);
    }
};

const collectCategories = (...sources) => {
    const categories = new Set();
    const visited = new WeakSet();

    const visit = (value, depth = 0) => {
        if (value === null || value === undefined || depth > 5) {
            return;
        }

        if (typeof value === 'string') {
            addCollectedCategory(categories, value);
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item) => visit(item, depth + 1));
            return;
        }

        if (typeof value !== 'object') {
            return;
        }

        if (visited.has(value)) {
            return;
        }

        visited.add(value);

        addCollectedCategory(categories, value.category);
        addCollectedCategory(categories, value.department);
        addCollectedCategory(categories, value.productType);
        addCollectedCategory(categories, value.subcategory);
        addCollectedCategory(categories, value.subCategory);
        addCollectedCategory(categories, value.tag);

        [
            value.categories,
            value.tags,
            value.preferredCategories,
            value.relationshipCategories,
            value.occasionCategories,
            value.friendWishlistCategories,
            value.similarWishlistCategories,
            value.relevantCategories,
            value.wishlistCategories,
            value.cartCategories,
            value.purchasedCategories,
            value.product,
            value.products,
            value.items,
            value.wishlistProducts,
            value.cartProducts,
            value.purchasedProducts,
            value.friendWishlistProducts,
            value.similarWishlistProducts,
            value.recommendations,
            value.giftContext,
            value.preferenceProfile,
            value.context,
        ].forEach((entry) => visit(entry, depth + 1));

        Object.entries(value).forEach(([key, nestedValue]) => {
            if (nestedValue === null || nestedValue === undefined) {
                return;
            }

            if (
                key.endsWith('Categories') ||
                key.endsWith('Products') ||
                key.endsWith('Items') ||
                key.endsWith('Recommendations')
            ) {
                visit(nestedValue, depth + 1);
            }
        });
    };

    sources.forEach((source) => visit(source));

    return Array.from(categories);
};

const getMaxBoostForMode = (mode) =>
    mode === 'gift' ? GIFT_MAX_PAID_BOOST : PERSONAL_MAX_PAID_BOOST;

const isTruthyField = (objectValue, fieldName) =>
    Object.prototype.hasOwnProperty.call(objectValue || {}, fieldName);

const isProductActive = (product = {}) => {
    if (isTruthyField(product, 'isActive')) {
        return product.isActive !== false;
    }

    if (isTruthyField(product, 'active')) {
        return product.active !== false;
    }

    if (typeof product.status === 'string') {
        return normalizeCategory(product.status) === 'active';
    }

    return true;
};

const isProductInStock = (product = {}) => {
    if (isTruthyField(product, 'countInStock')) {
        return toNumber(product.countInStock) > 0;
    }

    if (isTruthyField(product, 'stock')) {
        return toNumber(product.stock) > 0;
    }

    return true;
};

const getProductRating = (product = {}) => toNumber(product.rating ?? product.averageRating);

const getProductTimestamp = (product = {}) =>
    new Date(product.createdAt || product.updatedAt || 0).getTime() || 0;

const getRecommendationProduct = (recommendation = {}) =>
    recommendation?.product && typeof recommendation.product === 'object'
        ? recommendation.product
        : recommendation;

const getRecommendationProductId = (recommendation = {}) =>
    toObjectIdString(getRecommendationProduct(recommendation)?._id);

const getRecommendationRating = (recommendation = {}) =>
    getProductRating(getRecommendationProduct(recommendation));

const getRecommendationTimestamp = (recommendation = {}) =>
    getProductTimestamp(getRecommendationProduct(recommendation));

const getRecommendationOrganicScore = (recommendation = {}) =>
    toNumber(recommendation?.organicScore ?? recommendation?.scoreBreakdown?.totalBeforeClamp);

const getRecommendationPaidBoostScore = (recommendation = {}) =>
    toNumber(
        recommendation?.paidBoostScore ??
            getRecommendationProduct(recommendation)?.paidBoostScore
    );

const getRecommendationPrimaryScore = (recommendation = {}, mode = 'personal') => {
    if (mode === 'gift') {
        return toNumber(recommendation?.finalScore ?? recommendation?.giftScore);
    }

    return toNumber(recommendation?.finalScore);
};

const compareRecommendationsForMode = (
    firstRecommendation,
    secondRecommendation,
    mode = 'personal'
) => {
    const primaryScoreDifference =
        getRecommendationPrimaryScore(secondRecommendation, mode) -
        getRecommendationPrimaryScore(firstRecommendation, mode);

    if (primaryScoreDifference !== 0) {
        return primaryScoreDifference;
    }

    const organicScoreDifference =
        getRecommendationOrganicScore(secondRecommendation) -
        getRecommendationOrganicScore(firstRecommendation);

    if (organicScoreDifference !== 0) {
        return organicScoreDifference;
    }

    const paidBoostDifference =
        getRecommendationPaidBoostScore(secondRecommendation) -
        getRecommendationPaidBoostScore(firstRecommendation);

    if (paidBoostDifference !== 0) {
        return paidBoostDifference;
    }

    const ratingDifference =
        getRecommendationRating(secondRecommendation) -
        getRecommendationRating(firstRecommendation);

    if (ratingDifference !== 0) {
        return ratingDifference;
    }

    return getRecommendationTimestamp(secondRecommendation) - getRecommendationTimestamp(firstRecommendation);
};

const dedupeRecommendationsByProductId = (recommendations = []) => {
    const seenRecommendationProductIds = new Set();

    return (Array.isArray(recommendations) ? recommendations : []).filter((recommendation) => {
        const recommendationProductId = getRecommendationProductId(recommendation);

        if (!recommendationProductId || seenRecommendationProductIds.has(recommendationProductId)) {
            return false;
        }

        seenRecommendationProductIds.add(recommendationProductId);
        return true;
    });
};

const isPromotedRecommendation = (recommendation = {}) =>
    getRecommendationPaidBoostScore(recommendation) > 0 ||
    Boolean(recommendation?.isPromoted) ||
    Boolean(getRecommendationProduct(recommendation)?.isPromoted);

const getPrioritySlotCount = (finalLimit, promotedCount) => {
    const normalizedFinalLimit = Math.max(0, Math.floor(toNumber(finalLimit) || 0));
    const normalizedPromotedCount = Math.max(0, Math.floor(toNumber(promotedCount) || 0));

    if (normalizedFinalLimit <= 0 || normalizedPromotedCount <= 0) {
        return 0;
    }

    return Math.min(
        Math.ceil(normalizedFinalLimit * PRIORITY_RECOMMENDATION_RATIO),
        normalizedPromotedCount
    );
};

const buildProductIdSet = (productIds = []) =>
    new Set(
        (Array.isArray(productIds) ? productIds : [])
            .map((productId) => toObjectIdString(productId))
            .filter(Boolean)
    );

const sortRecommendations = (recommendations = [], comparator, mode = 'personal') =>
    [...(Array.isArray(recommendations) ? recommendations : [])].sort(
        typeof comparator === 'function'
            ? comparator
            : (firstRecommendation, secondRecommendation) =>
                compareRecommendationsForMode(firstRecommendation, secondRecommendation, mode)
    );

const applyPriorityQuotaToRecommendations = ({
    recommendations = [],
    rankedRecommendations = [],
    finalLimit = 0,
    mode = 'personal',
    protectedSources = [],
    promotedProductIds = [],
    sortComparator,
    isProtectedRecommendation: isProtectedRecommendationOverride,
    isPromotedRecommendation: isPromotedRecommendationOverride,
} = {}) => {
    const normalizedFinalLimit = Math.max(0, Math.floor(toNumber(finalLimit) || 0));

    if (normalizedFinalLimit <= 0) {
        return [];
    }

    const normalizedProtectedSources = new Set(
        (Array.isArray(protectedSources) ? protectedSources : [])
            .map((source) => cleanString(source))
            .filter(Boolean)
    );
    const allowedPromotedProductIds = buildProductIdSet(promotedProductIds);
    const comparator = typeof sortComparator === 'function'
        ? sortComparator
        : (firstRecommendation, secondRecommendation) =>
            compareRecommendationsForMode(firstRecommendation, secondRecommendation, mode);

    const isEligiblePromotedRecommendation = (recommendation) => {
        const recommendationProductId = getRecommendationProductId(recommendation);

        if (
            allowedPromotedProductIds.size > 0 &&
            !allowedPromotedProductIds.has(recommendationProductId)
        ) {
            return false;
        }

        if (typeof isPromotedRecommendationOverride === 'function') {
            return Boolean(isPromotedRecommendationOverride(recommendation));
        }

        return isPromotedRecommendation(recommendation);
    };

    const isProtectedRecommendation = (recommendation) => {
        const recommendationSource = cleanString(
            recommendation?.recommendationSource || recommendation?.source
        );

        if (
            recommendationSource &&
            normalizedProtectedSources.has(recommendationSource)
        ) {
            return true;
        }

        if (typeof isProtectedRecommendationOverride === 'function') {
            return Boolean(isProtectedRecommendationOverride(recommendation));
        }

        return false;
    };

    const rankedPool = sortRecommendations(
        dedupeRecommendationsByProductId(
            Array.isArray(rankedRecommendations) && rankedRecommendations.length > 0
                ? rankedRecommendations
                : recommendations
        ),
        comparator,
        mode
    );
    const selectedRecommendations = sortRecommendations(
        dedupeRecommendationsByProductId(recommendations).slice(0, normalizedFinalLimit),
        comparator,
        mode
    );
    const promotedPool = rankedPool.filter((recommendation) =>
        isEligiblePromotedRecommendation(recommendation)
    );
    const prioritySlotCount = getPrioritySlotCount(
        normalizedFinalLimit,
        promotedPool.length
    );

    if (prioritySlotCount === 0) {
        return selectedRecommendations.slice(0, normalizedFinalLimit);
    }

    const requiredPromotedRecommendations = promotedPool.slice(0, prioritySlotCount);
    const requiredPromotedRecommendationIds = new Set(
        requiredPromotedRecommendations
            .map((recommendation) => getRecommendationProductId(recommendation))
            .filter(Boolean)
    );
    const workingSelection = [...selectedRecommendations];
    const selectedRecommendationIds = new Set(
        workingSelection
            .map((recommendation) => getRecommendationProductId(recommendation))
            .filter(Boolean)
    );

    requiredPromotedRecommendations.forEach((promotedRecommendation) => {
        const promotedRecommendationId = getRecommendationProductId(promotedRecommendation);

        if (!promotedRecommendationId || selectedRecommendationIds.has(promotedRecommendationId)) {
            return;
        }

        if (workingSelection.length < normalizedFinalLimit) {
            workingSelection.push(promotedRecommendation);
            selectedRecommendationIds.add(promotedRecommendationId);
            return;
        }

        let replacementIndex = -1;

        for (let index = workingSelection.length - 1; index >= 0; index -= 1) {
            const currentRecommendation = workingSelection[index];
            const currentRecommendationId = getRecommendationProductId(currentRecommendation);

            if (!currentRecommendationId) {
                continue;
            }

            if (requiredPromotedRecommendationIds.has(currentRecommendationId)) {
                continue;
            }

            if (isProtectedRecommendation(currentRecommendation)) {
                continue;
            }

            if (isEligiblePromotedRecommendation(currentRecommendation)) {
                continue;
            }

            replacementIndex = index;
            break;
        }

        if (replacementIndex === -1) {
            for (let index = workingSelection.length - 1; index >= 0; index -= 1) {
                const currentRecommendation = workingSelection[index];
                const currentRecommendationId = getRecommendationProductId(currentRecommendation);

                if (!currentRecommendationId) {
                    continue;
                }

                if (requiredPromotedRecommendationIds.has(currentRecommendationId)) {
                    continue;
                }

                if (isProtectedRecommendation(currentRecommendation)) {
                    continue;
                }

                replacementIndex = index;
                break;
            }
        }

        if (replacementIndex === -1) {
            return;
        }

        selectedRecommendationIds.delete(
            getRecommendationProductId(workingSelection[replacementIndex])
        );
        workingSelection[replacementIndex] = promotedRecommendation;
        selectedRecommendationIds.add(promotedRecommendationId);
    });

    rankedPool.forEach((rankedRecommendation) => {
        if (workingSelection.length >= normalizedFinalLimit) {
            return;
        }

        const rankedRecommendationId = getRecommendationProductId(rankedRecommendation);

        if (!rankedRecommendationId || selectedRecommendationIds.has(rankedRecommendationId)) {
            return;
        }

        workingSelection.push(rankedRecommendation);
        selectedRecommendationIds.add(rankedRecommendationId);
    });

    return sortRecommendations(workingSelection, comparator, mode).slice(0, normalizedFinalLimit);
};

const getProductCategorySignals = (product = {}, boostCategory = '') =>
    collectCategories(
        boostCategory,
        product?.category,
        product?.productType,
        product?.subcategory,
        product?.subCategory,
        product?.tag,
        product?.tags
    );

const matchesRelevantCategorySet = (product = {}, relevantCategorySet = new Set(), boostCategory = '') => {
    if (!(relevantCategorySet instanceof Set) || relevantCategorySet.size === 0) {
        return false;
    }

    return getProductCategorySignals(product, boostCategory).some((category) =>
        relevantCategorySet.has(normalizeCategory(category))
    );
};

const validatePlacement = (placement = 'both') => {
    const normalizedPlacement = cleanString(placement) || 'both';

    if (!BOOST_PLACEMENTS.has(normalizedPlacement)) {
        throw new ApiError(400, 'placement must be personal, gift, or both');
    }

    return normalizedPlacement;
};

const getActiveBoostQuery = ({ productIds = [], placement, now = new Date() } = {}) => {
    const query = {
        status: 'active',
        paymentStatus: 'paid',
        startsAt: { $lte: now },
        endsAt: { $gt: now },
    };

    if (Array.isArray(productIds) && productIds.length > 0) {
        query.product = { $in: productIds };
    }

    if (placement && placement !== 'both') {
        query.placement = { $in: [placement, 'both'] };
    }

    return query;
};

const selectStrongestBoostsByProduct = (boosts = []) => {
    const strongestBoostByProductId = new Map();

    boosts.forEach((boost) => {
        const productId = toObjectIdString(boost.product);

        if (!productId || strongestBoostByProductId.has(productId)) {
            return;
        }

        strongestBoostByProductId.set(productId, boost);
    });

    return Array.from(strongestBoostByProductId.values());
};

const buildNormalizedBoostEntries = (boosts = [], mode = 'personal') => {
    const maxBoost = getMaxBoostForMode(mode);
    const highestFeeByCategory = new Map();

    boosts.forEach((boost) => {
        const categoryKey = normalizeCategory(boost.category);
        const boostFee = toNumber(boost.feeAmount);
        const currentHighestFee = highestFeeByCategory.get(categoryKey) || 0;

        if (boostFee > currentHighestFee) {
            highestFeeByCategory.set(categoryKey, boostFee);
        }
    });

    return boosts.map((boost) => {
        const categoryKey = normalizeCategory(boost.category);
        const highestFeeAmount = highestFeeByCategory.get(categoryKey) || 0;
        const normalizedScore = highestFeeAmount > 0
            ? clamp((toNumber(boost.feeAmount) / highestFeeAmount) * maxBoost, 0, maxBoost)
            : 0;

        return {
            boost: {
                ...boost,
                normalizedBoostScore: normalizedScore,
                maxBoostScore: maxBoost,
            },
            paidBoostScore: normalizedScore,
        };
    });
};

const populateBoostQuery = (query) => {
    BOOST_POPULATE.forEach((populateConfig) => {
        query.populate(populateConfig);
    });

    return query;
};

const resolveBoostSeller = (product, createdBy) =>
    product?.user || product?.seller || product?.createdBy || createdBy || null;

const buildBoostRecord = async (boostId) =>
    populateBoostQuery(PriorityBoost.findById(boostId)).lean();

const expireOldBoosts = async (now = new Date()) => {
    const result = await PriorityBoost.updateMany(
        {
            status: 'active',
            endsAt: { $lte: now },
        },
        {
            $set: {
                status: 'expired',
            },
        }
    );

    return result.modifiedCount || 0;
};

const createPriorityBoost = async ({
    productId,
    feeAmount,
    startsAt,
    endsAt,
    durationDays,
    placement = 'both',
    note = '',
    createdBy,
} = {}) => {
    requireObjectId(productId, 'productId');

    const normalizedPlacement = validatePlacement(placement);
    const normalizedFeeAmount = toRoundedCurrency(feeAmount);

    if (!(normalizedFeeAmount > 0)) {
        throw new ApiError(400, 'feeAmount must be greater than 0');
    }

    const startDate = startsAt ? parseDateOrThrow(startsAt, 'startsAt') : new Date();
    const normalizedDurationDays = durationDays === undefined || durationDays === null || durationDays === ''
        ? null
        : Number(durationDays);

    if (normalizedDurationDays !== null && (!Number.isFinite(normalizedDurationDays) || normalizedDurationDays <= 0)) {
        throw new ApiError(400, 'durationDays must be a positive number');
    }

    const endDate = endsAt
        ? parseDateOrThrow(endsAt, 'endsAt')
        : normalizedDurationDays !== null
            ? new Date(startDate.getTime() + normalizedDurationDays * 24 * 60 * 60 * 1000)
            : null;

    if (!endDate) {
        throw new ApiError(400, 'Either endsAt or durationDays is required');
    }

    if (endDate <= startDate) {
        throw new ApiError(400, 'endsAt must be after startsAt');
    }

    const product = await Product.findById(productId).lean();

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    if (!isProductActive(product)) {
        throw new ApiError(400, 'Only active products can receive a priority boost');
    }

    if (!isProductInStock(product)) {
        throw new ApiError(400, 'Only in-stock products can receive a priority boost');
    }

    const seller = resolveBoostSeller(product, createdBy);

    if (!seller) {
        throw new ApiError(400, 'A seller could not be resolved for this product');
    }

    const category = cleanString(product.category);

    if (!category) {
        throw new ApiError(400, 'Product category is required to create a priority boost');
    }

    const createdBoost = await PriorityBoost.create({
        product: product._id,
        seller,
        category,
        feeAmount: normalizedFeeAmount,
        normalizedBoostScore: 0,
        maxBoostScore: normalizedPlacement === 'gift' ? GIFT_MAX_PAID_BOOST : PERSONAL_MAX_PAID_BOOST,
        startsAt: startDate,
        endsAt: endDate,
        status: 'active',
        paymentStatus: 'paid',
        placement: normalizedPlacement,
        note: cleanString(note),
        createdBy: createdBy || null,
    });

    return buildBoostRecord(createdBoost._id);
};

const getActiveBoostsForProducts = async (productIds = [], placement = 'personal') => {
    await expireOldBoosts();

    const normalizedIds = Array.from(
        new Set(
            (Array.isArray(productIds) ? productIds : [])
                .map((id) => toObjectIdString(id))
                .filter(Boolean)
        )
    ).filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (normalizedIds.length === 0) {
        return [];
    }

    const normalizedPlacement = validatePlacement(placement === 'both' ? 'both' : placement);
    const boosts = await PriorityBoost.find(
        getActiveBoostQuery({
            productIds: normalizedIds,
            placement: normalizedPlacement,
        })
    )
        .sort({ feeAmount: -1, createdAt: -1, _id: -1 })
        .lean();

    return selectStrongestBoostsByProduct(boosts);
};

const getActiveBoostMapForProducts = async (productIds = [], placement = 'personal') => {
    const normalizedPlacement = placement === 'gift' ? 'gift' : 'personal';
    const activeBoosts = await getActiveBoostsForProducts(productIds, normalizedPlacement);
    const normalizedEntries = buildNormalizedBoostEntries(activeBoosts, normalizedPlacement);

    return normalizedEntries.reduce((boostMap, entry) => {
        const boost = entry.boost;
        const productId = toObjectIdString(boost.product);
        boostMap[productId] = {
            boost,
            paidBoostScore: entry.paidBoostScore,
        };

        return boostMap;
    }, {});
};

const getActiveBoostedProductsForRelevantCategories = async ({
    categories = [],
    placement = 'gift',
    limit = 20,
} = {}) => {
    await expireOldBoosts();

    const normalizedPlacement = placement === 'gift' ? 'gift' : 'personal';
    const normalizedLimit = Math.max(1, Math.floor(toNumber(limit) || 20));
    const relevantCategorySet = new Set(
        collectCategories(categories)
            .map((category) => normalizeCategory(category))
            .filter(Boolean)
    );

    if (relevantCategorySet.size === 0) {
        return [];
    }

    const boosts = await PriorityBoost.find(
        getActiveBoostQuery({
            placement: normalizedPlacement,
        })
    )
        .sort({ feeAmount: -1, createdAt: -1, _id: -1 })
        .populate(BOOSTED_PRODUCT_POPULATE)
        .lean();

    const matchingBoosts = selectStrongestBoostsByProduct(boosts).filter(
        (boost) =>
            Boolean(boost?.product) &&
            isProductActive(boost.product) &&
            isProductInStock(boost.product) &&
            matchesRelevantCategorySet(boost.product, relevantCategorySet, boost.category)
    );

    return buildNormalizedBoostEntries(matchingBoosts, normalizedPlacement)
        .map((entry) => ({
            product: entry.boost.product,
            boost: entry.boost,
            paidBoostScore: entry.paidBoostScore,
        }))
        .sort((firstEntry, secondEntry) => {
            const boostScoreDifference =
                Number(secondEntry.paidBoostScore || 0) - Number(firstEntry.paidBoostScore || 0);

            if (boostScoreDifference !== 0) {
                return boostScoreDifference;
            }

            const feeDifference =
                toNumber(secondEntry.boost?.feeAmount) - toNumber(firstEntry.boost?.feeAmount);

            if (feeDifference !== 0) {
                return feeDifference;
            }

            return getProductTimestamp(secondEntry.product) - getProductTimestamp(firstEntry.product);
        })
        .slice(0, normalizedLimit);
};

const getRelevantCategoriesForContext = ({
    context = {},
    mode = 'personal',
    relevantCategories = [],
} = {}) => {
    if (mode === 'gift') {
        return collectCategories(
            relevantCategories,
            context?.preferredCategories,
            context?.relationshipCategories,
            context?.occasionCategories,
            context?.friendWishlistCategories,
            context?.similarWishlistCategories,
            context?.relevantCategories,
            context?.giftContext,
            context?.wishlist,
            context?.wishlistProducts,
            context?.friendWishlist,
            context?.friendWishlistProducts
        );
    }

    return collectCategories(
        relevantCategories,
        context?.preferenceProfile?.preferredCategories,
        context?.wishlistCategories,
        context?.cartCategories,
        context?.purchasedCategories,
        context?.friendWishlistCategories,
        context?.relevantCategories,
        context?.wishlist,
        context?.wishlistProducts,
        context?.cart,
        context?.cartProducts,
        context?.orders,
        context?.purchasedProducts,
        context?.friendWishlistProducts
    );
};

const isBoostEligibleForContext = ({
    product,
    context = {},
    mode = 'personal',
    organicScore = 0,
    relevantCategories = [],
} = {}) => {
    const productCategory =
        normalizeCategory(product?.category) ||
        normalizeCategory(product?.productType) ||
        normalizeCategory(product?.subcategory) ||
        normalizeCategory(product?.subCategory);
    const normalizedRelevantCategories = new Set(
        getRelevantCategoriesForContext({
            context,
            mode,
            relevantCategories,
        })
            .map((category) => normalizeCategory(category))
            .filter(Boolean)
    );

    if (matchesRelevantCategorySet(product, normalizedRelevantCategories, productCategory)) {
        return true;
    }

    if (normalizedRelevantCategories.size > 0) {
        return false;
    }

    return toNumber(organicScore) > 0;
};

const getBoostEntry = (boostMap, productId) => {
    if (!boostMap || !productId) {
        return null;
    }

    if (boostMap instanceof Map) {
        return boostMap.get(productId) || null;
    }

    return boostMap[productId] || null;
};

const calculatePaidBoostForProduct = ({
    product,
    boostMap,
    options = {},
} = {}) => {
    const productId = toObjectIdString(product?._id);
    const mode = options.mode === 'gift' ? 'gift' : 'personal';
    const maxBoost = getMaxBoostForMode(mode);
    const organicScore = toNumber(options.organicScore);

    if (!productId) {
        return {
            paidBoostScore: 0,
            isPromoted: false,
            promotionLabel: '',
            reason: '',
        };
    }

    if (!isProductActive(product) || !isProductInStock(product)) {
        return {
            paidBoostScore: 0,
            isPromoted: false,
            promotionLabel: '',
            reason: '',
        };
    }

    const boostEntry = getBoostEntry(boostMap, productId);

    if (!boostEntry) {
        return {
            paidBoostScore: 0,
            isPromoted: false,
            promotionLabel: '',
            reason: '',
        };
    }

    if (
        !isBoostEligibleForContext({
            product,
            context: options.context,
            mode,
            organicScore,
            relevantCategories: options.relevantCategories,
        })
    ) {
        return {
            paidBoostScore: 0,
            isPromoted: false,
            promotionLabel: '',
            reason: '',
        };
    }

    const paidBoostScore = clamp(toRoundedCurrency(boostEntry.paidBoostScore), 0, maxBoost);

    if (!(paidBoostScore > 0)) {
        return {
            paidBoostScore: 0,
            isPromoted: false,
            promotionLabel: '',
            reason: '',
        };
    }

    return {
        paidBoostScore,
        isPromoted: true,
        promotionLabel: 'Promoted',
        reason:
            mode === 'gift'
                ? 'Promoted within relevant gift category'
                : 'Promoted within relevant category',
    };
};

const listPriorityBoosts = async (filters = {}) => {
    await expireOldBoosts();

    const query = {};

    if (filters.status) {
        query.status = cleanString(filters.status);
    }

    if (filters.paymentStatus) {
        query.paymentStatus = cleanString(filters.paymentStatus);
    }

    if (filters.placement) {
        query.placement = validatePlacement(filters.placement);
    }

    if (filters.category) {
        query.category = new RegExp(`^${cleanString(filters.category)}$`, 'i');
    }

    if (filters.seller) {
        requireObjectId(filters.seller, 'seller');
        query.seller = filters.seller;
    }

    if (filters.product) {
        requireObjectId(filters.product, 'product');
        query.product = filters.product;
    }

    return populateBoostQuery(
        PriorityBoost.find(query).sort({ createdAt: -1, _id: -1 })
    ).lean();
};

const getPriorityBoostById = async (boostId) => {
    requireObjectId(boostId, 'priorityBoostId');
    await expireOldBoosts();

    const boost = await buildBoostRecord(boostId);

    if (!boost) {
        throw new ApiError(404, 'Priority boost not found');
    }

    return boost;
};

const getPriorityBoostSummary = async () => {
    await expireOldBoosts();

    const boosts = await PriorityBoost.find({}).lean();
    const summary = {
        totalBoosts: boosts.length,
        activeBoosts: 0,
        expiredBoosts: 0,
        cancelledBoosts: 0,
        totalRevenue: 0,
        activeRevenue: 0,
        byPlacement: {
            personal: { count: 0, revenue: 0 },
            gift: { count: 0, revenue: 0 },
            both: { count: 0, revenue: 0 },
        },
        byCategory: {},
    };

    boosts.forEach((boost) => {
        const status = cleanString(boost.status);
        const placement = validatePlacement(boost.placement || 'both');
        const category = cleanString(boost.category) || 'Uncategorized';
        const feeAmount = toRoundedCurrency(boost.feeAmount);
        const isPaid = cleanString(boost.paymentStatus) === 'paid';

        if (status === 'active') {
            summary.activeBoosts += 1;
        } else if (status === 'expired') {
            summary.expiredBoosts += 1;
        } else if (status === 'cancelled') {
            summary.cancelledBoosts += 1;
        }

        if (isPaid) {
            summary.totalRevenue = toRoundedCurrency(summary.totalRevenue + feeAmount);
            if (status === 'active') {
                summary.activeRevenue = toRoundedCurrency(summary.activeRevenue + feeAmount);
            }

            summary.byPlacement[placement].revenue = toRoundedCurrency(
                summary.byPlacement[placement].revenue + feeAmount
            );
        }

        summary.byPlacement[placement].count += 1;

        if (!summary.byCategory[category]) {
            summary.byCategory[category] = {
                count: 0,
                revenue: 0,
                activeCount: 0,
            };
        }

        summary.byCategory[category].count += 1;
        if (status === 'active') {
            summary.byCategory[category].activeCount += 1;
        }
        if (isPaid) {
            summary.byCategory[category].revenue = toRoundedCurrency(
                summary.byCategory[category].revenue + feeAmount
            );
        }
    });

    return summary;
};

const cancelPriorityBoost = async (boostId, cancelledBy) => {
    requireObjectId(boostId, 'priorityBoostId');

    const boost = await PriorityBoost.findById(boostId);

    if (!boost) {
        throw new ApiError(404, 'Priority boost not found');
    }

    if (boost.status !== 'active') {
        throw new ApiError(400, 'Only active priority boosts can be cancelled');
    }

    boost.status = 'cancelled';
    boost.cancelledAt = new Date();
    boost.cancelledBy = cancelledBy || null;

    await boost.save();

    return buildBoostRecord(boost._id);
};

export {
    PERSONAL_MAX_PAID_BOOST,
    GIFT_MAX_PAID_BOOST,
    PRIORITY_RECOMMENDATION_RATIO,
    createPriorityBoost,
    getActiveBoostsForProducts,
    getActiveBoostMapForProducts,
    getActiveBoostedProductsForRelevantCategories,
    calculatePaidBoostForProduct,
    getPrioritySlotCount,
    applyPriorityQuotaToRecommendations,
    isPromotedRecommendation,
    listPriorityBoosts,
    getPriorityBoostById,
    getPriorityBoostSummary,
    cancelPriorityBoost,
    expireOldBoosts,
    isBoostEligibleForContext,
    normalizeCategory,
    collectCategories,
    getProductRating,
    getProductTimestamp,
};
