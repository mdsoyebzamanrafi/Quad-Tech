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
        .sort((firstRecommendation, secondRecommendation) => secondRecommendation.finalScore - firstRecommendation.finalScore);

    const strictSelection = selectRecommendations(cleanedRecommendations, {
        preferenceProfile: options.preferenceProfile,
        relaxDepartmentLimit: false,
    });

    if (strictSelection.selected.length >= limit) {
        return strictSelection.selected.slice(0, limit);
    }

    const relaxedDepartmentSelection = selectRecommendations(cleanedRecommendations, {
        preferenceProfile: options.preferenceProfile,
        relaxDepartmentLimit: true,
    });

    if (relaxedDepartmentSelection.selected.length >= limit) {
        return relaxedDepartmentSelection.selected.slice(0, limit);
    }

    const filledRecommendations = fillRemainingRecommendations(
        relaxedDepartmentSelection,
        cleanedRecommendations,
        limit
    );

    return filledRecommendations.slice(0, limit);
};

export { filterAndLimitRecommendations };
