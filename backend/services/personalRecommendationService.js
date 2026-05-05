import { buildRecommendationContext, buildProductLikeShape } from './recommendationContextService.js';
import { scoreProduct } from './recommendationScoringService.js';
import { filterAndLimitRecommendations } from './recommendationFilterService.js';

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
    };
};

const serializeRecommendations = (recommendations) =>
    recommendations.map((recommendation) => ({
        product: serializeProduct(recommendation.product),
        finalScore: Math.round(recommendation.finalScore),
        scoreBreakdown: recommendation.scoreBreakdown,
        reasons: Array.isArray(recommendation.reasons) ? recommendation.reasons : [],
    }));

const buildFallbackRecommendations = (availableProducts) => {
    const fallbackScoredProducts = (Array.isArray(availableProducts) ? availableProducts : []).map((product) => {
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

        const finalScore = ratingScore + stockScore + priorityScore + 8;
        const reasons = ['Popular product', 'Available in stock', 'Recommended starter pick'];

        if (product.isNewArrival) {
            reasons.unshift('New arrival');
        }

        return {
            product: buildProductLikeShape(product),
            finalScore,
            scoreBreakdown: {
                wishlistScore: 0,
                purchaseHistoryScore: 0,
                similarityScore: 0,
                priceScore: 0,
                friendBoostScore: 0,
                stockScore,
                ratingScore,
                priorityScore,
            },
            reasons,
        };
    });

    return filterAndLimitRecommendations(fallbackScoredProducts, {
        limit: 5,
        preferenceProfile: {},
    });
};

const getPersonalRecommendations = async (userId) => {
    const context = await buildRecommendationContext(userId);
    const hasPersonalSignals =
        Number(context.contextSummary?.orderCount || 0) > 0 ||
        Number(context.contextSummary?.wishlistCount || 0) > 0;

    if (!hasPersonalSignals) {
        return {
            recommendations: serializeRecommendations(
                buildFallbackRecommendations(context.availableProducts)
            ),
            contextSummary: context.contextSummary,
        };
    }

    const scoredProducts = context.availableProducts.map((product) => scoreProduct(product, context));

    let recommendations = filterAndLimitRecommendations(scoredProducts, {
        limit: 5,
        preferenceProfile: context.preferenceProfile,
    });

    if (recommendations.length === 0) {
        recommendations = buildFallbackRecommendations(context.availableProducts);
    }

    return {
        recommendations: serializeRecommendations(recommendations),
        contextSummary: context.contextSummary,
    };
};

export { getPersonalRecommendations };
