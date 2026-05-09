import { applyPriorityQuotaToRecommendations } from './priorityBoostService.js';
import { normalizeDepartment, normalizeStringList, toObjectIdString } from './recommendationContextService.js';

const PURCHASED_SCORE_PENALTY = -100;

const getNameKey = (name) => String(name || '').trim().toLowerCase();
const getColorSignature = (product) => normalizeStringList(product.colors)[0] || 'no-color';

const canUseDepartmentOverflow = (preferenceProfile) =>
    Array.isArray(preferenceProfile?.preferredDepartments) &&
    preferenceProfile.preferredDepartments.length === 1;

const withinLimit = (countMap, key, limit) => (countMap.get(key) || 0) < limit;

const buildCounts = () => ({
    categoryCounts: new Map(),
    brandCounts: new Map(),
    departmentCounts: new Map(),
    fashionSignatureCounts: new Map(),
});

const incrementMap = (countMap, key) => {
    countMap.set(key, (countMap.get(key) || 0) + 1);
};

const registerProductCounts = (counts, product) => {
    incrementMap(counts.categoryCounts, product.category || 'uncategorized');
    incrementMap(counts.brandCounts, product.brand || 'unknown-brand');
    incrementMap(counts.departmentCounts, normalizeDepartment(product.department));

    if (normalizeDepartment(product.department) === 'fashion') {
        incrementMap(
            counts.fashionSignatureCounts,
            `${product.category || 'uncategorized'}::${getColorSignature(product)}`
        );
    }
};

const getRecommendationOrganicScore = (recommendation) =>
    Number(recommendation.organicScore ?? recommendation.finalScore ?? 0);

const getRecommendationPaidBoostScore = (recommendation) =>
    Number(recommendation.paidBoostScore ?? recommendation?.product?.paidBoostScore ?? 0);

const getRecommendationRating = (recommendation) =>
    Number(recommendation?.product?.rating ?? recommendation?.product?.averageRating ?? 0);

const getRecommendationTimestamp = (recommendation) =>
    new Date(recommendation?.product?.createdAt || recommendation?.product?.updatedAt || 0).getTime() || 0;

const getRecommendationSource = (recommendation) =>
    String(recommendation?.recommendationSource || recommendation?.source || '')
        .trim()
        .toLowerCase();

const compareRecommendations = (firstRecommendation, secondRecommendation) => {
    const finalScoreDifference =
        Number(secondRecommendation.finalScore || 0) - Number(firstRecommendation.finalScore || 0);

    if (finalScoreDifference !== 0) {
        return finalScoreDifference;
    }

    const organicScoreDifference =
        getRecommendationOrganicScore(secondRecommendation) -
        getRecommendationOrganicScore(firstRecommendation);

    if (organicScoreDifference !== 0) {
        return organicScoreDifference;
    }

    const paidBoostScoreDifference =
        getRecommendationPaidBoostScore(secondRecommendation) -
        getRecommendationPaidBoostScore(firstRecommendation);

    if (paidBoostScoreDifference !== 0) {
        return paidBoostScoreDifference;
    }

    const ratingDifference =
        getRecommendationRating(secondRecommendation) - getRecommendationRating(firstRecommendation);

    if (ratingDifference !== 0) {
        return ratingDifference;
    }

    return getRecommendationTimestamp(secondRecommendation) - getRecommendationTimestamp(firstRecommendation);
};

const isPromotedRecommendation = (recommendation = {}) =>
    Boolean(recommendation?.isPromoted) ||
    Boolean(recommendation?.product?.isPromoted) ||
    getRecommendationPaidBoostScore(recommendation) > 0;

const getRecommendationReasons = (recommendation) =>
    Array.isArray(recommendation?.reasons)
        ? recommendation.reasons
            .filter((reason) => typeof reason === 'string')
            .map((reason) => reason.trim().toLowerCase())
        : [];

const isProtectedOrganicRecommendation = (recommendation = {}) => {
    const recommendationSource = getRecommendationSource(recommendation);
    const scoreBreakdown = recommendation?.scoreBreakdown || {};
    const reasons = getRecommendationReasons(recommendation);
    const wishlistScore = Number(scoreBreakdown.wishlistScore || 0);
    const cartScore = Number(scoreBreakdown.cartScore || 0);
    const purchaseHistoryScore = Number(scoreBreakdown.purchaseHistoryScore || 0);
    const cloudClosetScore = Number(scoreBreakdown.cloudClosetScore || 0);
    const hasExactWishlistReason = reasons.some((reason) =>
        reason.includes('already in your wishlist')
    );
    const hasExactCartReason = reasons.some((reason) =>
        reason.includes('already in your cart')
    );
    const hasExactPurchaseReason = reasons.some((reason) =>
        reason.includes('already purchased exact product')
    );

    if (
        [
            'exact_wishlist',
            'wishlist',
            'cart_related',
            'past_order_related',
            'purchase_history',
            'cloud_closet',
            'saved_preference',
            'friend_wishlist',
        ].includes(recommendationSource)
    ) {
        return true;
    }

    if (hasExactWishlistReason || hasExactCartReason || hasExactPurchaseReason) {
        return true;
    }

    if (wishlistScore >= 55) {
        return true;
    }

    if (cartScore >= 35) {
        return true;
    }

    if (purchaseHistoryScore >= 40) {
        return true;
    }

    return cloudClosetScore >= 70;
};

const canAddProduct = (counts, recommendation, options = {}) => {
    const product = recommendation.product || {};
    const department = normalizeDepartment(product.department);
    const departmentLimit =
        options.relaxDepartmentLimit === true
            ? Number.POSITIVE_INFINITY
            : canUseDepartmentOverflow(options.preferenceProfile) &&
                options.preferenceProfile.preferredDepartments[0] === department
                ? 4
                : 2;

    if (!withinLimit(counts.categoryCounts, product.category || 'uncategorized', 2)) {
        return false;
    }

    if (!withinLimit(counts.brandCounts, product.brand || 'unknown-brand', 2)) {
        return false;
    }

    if (!withinLimit(counts.departmentCounts, department, departmentLimit)) {
        return false;
    }

    if (department === 'fashion') {
        const fashionSignature = `${product.category || 'uncategorized'}::${getColorSignature(product)}`;
        if (!withinLimit(counts.fashionSignatureCounts, fashionSignature, 1)) {
            return false;
        }
    }

    return true;
};

const selectRecommendations = (sortedRecommendations, options = {}) => {
    const selected = [];
    const seenIds = new Set();
    const seenNames = new Set();
    const counts = buildCounts();

    sortedRecommendations.forEach((recommendation) => {
        const product = recommendation.product || {};
        const productId = toObjectIdString(product._id);
        const nameKey = getNameKey(product.name);

        if (!productId || seenIds.has(productId) || seenNames.has(nameKey)) {
            return;
        }

        if (!canAddProduct(counts, recommendation, options)) {
            return;
        }

        selected.push(recommendation);
        seenIds.add(productId);
        seenNames.add(nameKey);
        registerProductCounts(counts, product);
    });

    return {
        selected,
        seenIds,
        seenNames,
        counts,
    };
};

const fillRemainingRecommendations = (baseSelection, sortedRecommendations, limit) => {
    sortedRecommendations.forEach((recommendation) => {
        if (baseSelection.selected.length >= limit) {
            return;
        }

        const product = recommendation.product || {};
        const productId = toObjectIdString(product._id);
        const nameKey = getNameKey(product.name);

        if (!productId || baseSelection.seenIds.has(productId) || baseSelection.seenNames.has(nameKey)) {
            return;
        }

        baseSelection.selected.push(recommendation);
        baseSelection.seenIds.add(productId);
        baseSelection.seenNames.add(nameKey);
    });

    return baseSelection.selected;
};

const applyPriorityQuota = (selectedRecommendations, sortedRecommendations, options = {}) => {
    const limit = Number(options.limit) > 0 ? Number(options.limit) : 5;

    return applyPriorityQuotaToRecommendations({
        recommendations: selectedRecommendations,
        rankedRecommendations: sortedRecommendations,
        finalLimit: limit,
        mode: 'personal',
        promotedProductIds: options.promotedRelevantProductIds,
        sortComparator: compareRecommendations,
        isProtectedRecommendation: isProtectedOrganicRecommendation,
        isPromotedRecommendation,
    }).slice(0, limit);
};

const filterAndLimitRecommendations = (scoredProducts, options = {}) => {
    const limit = Number(options.limit) > 0 ? Number(options.limit) : 5;

    const cleanedRecommendations = (Array.isArray(scoredProducts) ? scoredProducts : [])
        .filter((recommendation) => recommendation?.product)
        .filter((recommendation) => Number(recommendation.product.countInStock) > 0)
        .filter((recommendation) => Number(recommendation.finalScore) > 0)
        .filter(
            (recommendation) =>
                Number(recommendation.scoreBreakdown?.purchaseHistoryScore) > PURCHASED_SCORE_PENALTY
        )
        .sort(compareRecommendations);

    const strictSelection = selectRecommendations(cleanedRecommendations, {
        preferenceProfile: options.preferenceProfile,
        relaxDepartmentLimit: false,
    });

    if (strictSelection.selected.length >= limit) {
        return applyPriorityQuota(
            strictSelection.selected.slice(0, limit),
            cleanedRecommendations,
            options
        ).slice(0, limit);
    }

    const relaxedDepartmentSelection = selectRecommendations(cleanedRecommendations, {
        preferenceProfile: options.preferenceProfile,
        relaxDepartmentLimit: true,
    });

    if (relaxedDepartmentSelection.selected.length >= limit) {
        return applyPriorityQuota(
            relaxedDepartmentSelection.selected.slice(0, limit),
            cleanedRecommendations,
            options
        ).slice(0, limit);
    }

    const filledRecommendations = fillRemainingRecommendations(
        relaxedDepartmentSelection,
        cleanedRecommendations,
        limit
    );

    return applyPriorityQuota(
        filledRecommendations.slice(0, limit),
        cleanedRecommendations,
        options
    ).slice(0, limit);
};

export {
    compareRecommendations,
    filterAndLimitRecommendations,
    isPromotedRecommendation,
    isProtectedOrganicRecommendation,
};
