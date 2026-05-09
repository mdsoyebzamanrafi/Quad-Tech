import { buildRecommendationContext, buildProductLikeShape } from './recommendationContextService.js';
import { scoreProduct } from './recommendationScoringService.js';
import { filterAndLimitRecommendations } from './recommendationFilterService.js';
import {
    calculatePaidBoostForProduct,
    collectCategories,
    getActiveBoostMapForProducts,
    getActiveBoostedProductsForRelevantCategories,
} from './priorityBoostService.js';

const PERSONAL_RECOMMENDATION_LIMIT = 6;

const serializeProduct = (product) => {
    const normalizedProduct = buildProductLikeShape(product);

    return {
        _id: normalizedProduct._id,
        name: normalizedProduct.name,
        image: normalizedProduct.image,
        brand: normalizedProduct.brand,
        category: normalizedProduct.category,
        department: normalizedProduct.department,
        description: normalizedProduct.description,
        price: normalizedProduct.price,
        countInStock: normalizedProduct.countInStock,
        rating: normalizedProduct.rating,
        numReviews: normalizedProduct.numReviews,
        colors: normalizedProduct.colors,
        sizes: normalizedProduct.sizes,
        material: normalizedProduct.material,
        fit: normalizedProduct.fit,
        occasion: normalizedProduct.occasion,
        season: normalizedProduct.season,
        styleTags: normalizedProduct.styleTags,
        productType: normalizedProduct.productType,
        isNewArrival: normalizedProduct.isNewArrival,
        adminPriorityScore: normalizedProduct.adminPriorityScore,
        isSponsored: normalizedProduct.isSponsored,
        sponsoredWeight: normalizedProduct.sponsoredWeight,
        isPromoted: Boolean(normalizedProduct.isPromoted),
        paidBoostScore: Number(normalizedProduct.paidBoostScore) || 0,
        promotionLabel: normalizedProduct.promotionLabel || '',
    };
};

const serializeRecommendations = (recommendations) =>
    recommendations.map((recommendation) => ({
        product: serializeProduct(recommendation.product),
        organicScore: Math.round(Number(recommendation.organicScore) || 0),
        paidBoostScore: Number(recommendation.paidBoostScore) || 0,
        finalScore: Math.round(recommendation.finalScore),
        scoreBreakdown: recommendation.scoreBreakdown,
        reasons: Array.isArray(recommendation.reasons) ? recommendation.reasons : [],
        isPromoted: Boolean(recommendation.isPromoted),
        promotionLabel: recommendation.promotionLabel || '',
    }));

const buildFallbackRecommendations = (availableProducts) => {
    return (Array.isArray(availableProducts) ? availableProducts : []).map((product) => {
        const rating = Number(product.rating) || 0;
        const stock = Number(product.countInStock) || 0;
        let ratingScore = 0;

        if (rating >= 4.5) {
            ratingScore = 10;
        } else if (rating >= 4) {
            ratingScore = 7;
        } else if (rating >= 3.5) {
            ratingScore = 4;
        }

        const stockScore = stock > 5 ? 10 : stock > 0 ? 6 : 0;
        const priorityScore = Math.min(
            Math.min(Number(product.adminPriorityScore) || 0, 25) +
                (product.isSponsored ? Math.min(Number(product.sponsoredWeight) || 0, 12) : 0) +
                (product.isNewArrival ? 10 : 0),
            35
        );

        const organicScore = ratingScore + stockScore + priorityScore + 8;
        const reasons = ['Popular product', 'Available in stock', 'Recommended starter pick'];

        if (product.isNewArrival) {
            reasons.unshift('New arrival');
        }

        return {
            product: buildProductLikeShape(product),
            organicScore,
            paidBoostScore: 0,
            finalScore: organicScore,
            scoreBreakdown: {
                wishlistScore: 0,
                cartScore: 0,
                purchaseHistoryScore: 0,
                similarityScore: 0,
                cloudClosetScore: 0,
                priceScore: 0,
                friendBoostScore: 0,
                stockScore,
                ratingScore,
                priorityScore,
                paidBoostScore: 0,
            },
            reasons,
            isPromoted: false,
            promotionLabel: '',
        };
    });
};

const dedupeProductsById = (products = []) => {
    const seenProductIds = new Set();

    return (Array.isArray(products) ? products : []).filter((product) => {
        const productId = String(product?._id || '');

        if (!productId || seenProductIds.has(productId)) {
            return false;
        }

        seenProductIds.add(productId);
        return true;
    });
};

const buildPromotedRelevantProductIds = (
    recommendations = [],
    allowedPromotedProductIds = []
) => {
    const allowedPromotedProductIdSet = new Set(
        (Array.isArray(allowedPromotedProductIds) ? allowedPromotedProductIds : [])
            .map((productId) => String(productId || ''))
            .filter(Boolean)
    );

    return Array.from(
        new Set(
            (Array.isArray(recommendations) ? recommendations : [])
                .filter((recommendation) => {
                    const productId = String(recommendation?.product?._id || '');

                    if (!productId) {
                        return false;
                    }

                    if (
                        allowedPromotedProductIdSet.size > 0 &&
                        !allowedPromotedProductIdSet.has(productId)
                    ) {
                        return false;
                    }

                    return (
                        Number(recommendation?.paidBoostScore || 0) > 0 ||
                        Boolean(recommendation?.isPromoted) ||
                        Boolean(recommendation?.product?.isPromoted)
                    );
                })
                .map((recommendation) => String(recommendation?.product?._id || ''))
                .filter(Boolean)
        )
    );
};

const buildPersonalRelevantCategories = (context = {}) =>
    collectCategories(
        context?.preferenceProfile?.preferredCategories,
        context?.wishlistCategories,
        context?.cartCategories,
        context?.purchasedCategories,
        context?.friendWishlistCategories,
        context?.relevantCategories,
        context?.wishlistProducts,
        context?.cartProducts,
        context?.purchasedProducts,
        context?.friendWishlistProducts,
        context?.cloudClosetItems
    );

const buildPersonalCandidatePool = async (context = {}) => {
    const relevantCategories = buildPersonalRelevantCategories(context);
    const boostedEntries = await getActiveBoostedProductsForRelevantCategories({
        categories: relevantCategories,
        placement: 'personal',
        limit: 20,
    });
    const promotedRelevantProductIds = Array.from(
        new Set(
            boostedEntries
                .map((entry) => String(entry?.product?._id || ''))
                .filter(Boolean)
        )
    );
    const candidateProducts = dedupeProductsById([
        ...(Array.isArray(context.availableProducts) ? context.availableProducts : []),
        ...boostedEntries.map((entry) => buildProductLikeShape(entry.product)),
    ]);

    return {
        candidateProducts,
        promotedRelevantProductIds,
        relevantCategories,
    };
};

const applyPaidBoostsToRecommendations = async (
    recommendations,
    context = {},
    relevantCategories = buildPersonalRelevantCategories(context)
) => {
    const productIds = (Array.isArray(recommendations) ? recommendations : [])
        .map((recommendation) => recommendation?.product?._id)
        .filter(Boolean);
    const boostMap = await getActiveBoostMapForProducts(productIds, 'personal');

    return (Array.isArray(recommendations) ? recommendations : []).map((recommendation) => {
        const organicScore = Number(recommendation.organicScore ?? recommendation.finalScore ?? 0);
        const paidBoost = calculatePaidBoostForProduct({
            product: recommendation.product,
            boostMap,
            options: {
                context,
                mode: 'personal',
                organicScore,
                relevantCategories,
            },
        });
        const finalScore = organicScore + Number(paidBoost.paidBoostScore || 0);
        const reasons = Array.isArray(recommendation.reasons) ? [...recommendation.reasons] : [];

        if (paidBoost.reason && !reasons.includes(paidBoost.reason)) {
            reasons.push(paidBoost.reason);
        }

        return {
            ...recommendation,
            organicScore,
            paidBoostScore: Number(paidBoost.paidBoostScore) || 0,
            finalScore,
            scoreBreakdown: {
                ...(recommendation.scoreBreakdown || {}),
                paidBoostScore: Number(paidBoost.paidBoostScore) || 0,
            },
            reasons,
            isPromoted: Boolean(paidBoost.isPromoted),
            promotionLabel: paidBoost.promotionLabel || '',
            product: {
                ...recommendation.product,
                isPromoted: Boolean(paidBoost.isPromoted),
                paidBoostScore: Number(paidBoost.paidBoostScore) || 0,
                promotionLabel: paidBoost.promotionLabel || '',
            },
        };
    });
};

const getPersonalRecommendations = async (userId) => {
    const context = await buildRecommendationContext(userId);
    const {
        candidateProducts,
        promotedRelevantProductIds,
        relevantCategories,
    } = await buildPersonalCandidatePool(context);
    const hasPersonalSignals =
        Number(context.contextSummary?.orderCount || 0) > 0 ||
        Number(context.contextSummary?.wishlistCount || 0) > 0 ||
        Number(context.contextSummary?.cartCount || 0) > 0 ||
        Number(context.contextSummary?.cloudClosetCount || 0) > 0;

    if (!hasPersonalSignals) {
        const fallbackRecommendations = await applyPaidBoostsToRecommendations(
            buildFallbackRecommendations(candidateProducts),
            context,
            relevantCategories
        );
        const fallbackPromotedRelevantProductIds = buildPromotedRelevantProductIds(
            fallbackRecommendations,
            promotedRelevantProductIds
        );

        return {
            recommendations: serializeRecommendations(
                filterAndLimitRecommendations(fallbackRecommendations, {
                    limit: PERSONAL_RECOMMENDATION_LIMIT,
                    preferenceProfile: context.preferenceProfile,
                    promotedRelevantProductIds: fallbackPromotedRelevantProductIds,
                })
            ),
            contextSummary: context.contextSummary,
        };
    }

    const scoredProducts = candidateProducts.map((product) => scoreProduct(product, context));
    const scoredProductsWithBoosts = await applyPaidBoostsToRecommendations(
        scoredProducts,
        context,
        relevantCategories
    );
    const scoredPromotedRelevantProductIds = buildPromotedRelevantProductIds(
        scoredProductsWithBoosts,
        promotedRelevantProductIds
    );

    let recommendations = filterAndLimitRecommendations(scoredProductsWithBoosts, {
        limit: PERSONAL_RECOMMENDATION_LIMIT,
        preferenceProfile: context.preferenceProfile,
        promotedRelevantProductIds: scoredPromotedRelevantProductIds,
    });

    if (recommendations.length === 0) {
        const fallbackRecommendations = await applyPaidBoostsToRecommendations(
            buildFallbackRecommendations(candidateProducts),
            context,
            relevantCategories
        );
        const fallbackPromotedRelevantProductIds = buildPromotedRelevantProductIds(
            fallbackRecommendations,
            promotedRelevantProductIds
        );

        recommendations = filterAndLimitRecommendations(fallbackRecommendations, {
            limit: PERSONAL_RECOMMENDATION_LIMIT,
            preferenceProfile: context.preferenceProfile,
            promotedRelevantProductIds: fallbackPromotedRelevantProductIds,
        });
    }

    return {
        recommendations: serializeRecommendations(recommendations),
        contextSummary: context.contextSummary,
    };
};

export { getPersonalRecommendations };
