import Product from '../models/Product.js';
import { parseGiftContext } from './giftContextParser.js';
import { getBangladeshOccasionContext } from './bangladeshOccasionService.js';
import { getRelationshipProfile, scoreGiftProduct } from './giftRecommendationScoringService.js';
import {
    applyPriorityQuotaToRecommendations,
    calculatePaidBoostForProduct,
    collectCategories,
    getActiveBoostMapForProducts,
    getActiveBoostedProductsForRelevantCategories,
} from './priorityBoostService.js';

const GIFT_RECOMMENDATION_LIMIT = 10;

const ACTIVE_GIFT_PRODUCT_FILTER = {
    countInStock: { $gt: 0 },
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
};

const normalizeString = (value) => String(value || '').trim();
const normalizeList = (values) =>
    Array.isArray(values)
        ? values
            .filter((value) => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getRecommendationProductId = (recommendation) =>
    String(recommendation?.product?._id || '');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hasNumericValue = (value) =>
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value));

const serializeGiftProduct = (product = {}) => ({
    _id: product._id,
    name: normalizeString(product.name),
    image: normalizeString(product.image),
    images: Array.isArray(product.images) ? product.images.filter((value) => typeof value === 'string') : [],
    brand: normalizeString(product.brand),
    category: normalizeString(product.category),
    department: normalizeString(product.department || 'electronics'),
    description: normalizeString(product.description),
    gender: normalizeString(product.gender),
    price: toNumber(product.price),
    countInStock: toNumber(product.countInStock),
    rating: toNumber(product.rating),
    numReviews: toNumber(product.numReviews),
    colors: normalizeList(product.colors),
    sizes: normalizeList(product.sizes),
    material: normalizeString(product.material),
    fit: normalizeString(product.fit),
    occasion: normalizeString(product.occasion),
    season: normalizeString(product.season),
    styleTags: normalizeList(product.styleTags),
    productType: normalizeString(product.productType),
    isNewArrival: Boolean(product.isNewArrival),
    adminPriorityScore: toNumber(product.adminPriorityScore),
    isSponsored: Boolean(product.isSponsored),
    sponsoredWeight: toNumber(product.sponsoredWeight),
    isActive: product.isActive !== false,
    createdAt: product.createdAt || null,
    updatedAt: product.updatedAt || null,
    isPromoted: Boolean(product.isPromoted),
    paidBoostScore: toNumber(product.paidBoostScore),
    promotionLabel: normalizeString(product.promotionLabel),
});

const formatTaka = (amount) => `$${Math.round(Number(amount) || 0)}`;

const buildBudgetPhrase = (giftContext) => {
    const budgetMin = hasNumericValue(giftContext?.budgetMin) ? Number(giftContext.budgetMin) : null;
    const budgetMax = hasNumericValue(giftContext?.budgetMax) ? Number(giftContext.budgetMax) : null;

    if (budgetMax !== null && budgetMin === null) {
        return ` under ${formatTaka(budgetMax)}`;
    }

    if (budgetMin !== null && budgetMax !== null) {
        const midpoint = Math.round((budgetMin + budgetMax) / 2);
        const aroundMin = Math.round(midpoint * 0.8);
        const aroundMax = Math.round(midpoint * 1.2);

        if (budgetMin === aroundMin && budgetMax === aroundMax) {
            return ` around ${formatTaka(midpoint)}`;
        }

        return ` within ${formatTaka(budgetMin)}-${formatTaka(budgetMax)}`;
    }

    return '';
};

const buildRecipientPhrase = (giftContext) => {
    const recipientType = String(giftContext?.recipientType || '').trim().toLowerCase();

    if (!recipientType || recipientType === 'someone') {
        return 'someone';
    }

    return `your ${recipientType}`;
};

const buildFallbackReply = (giftContext, recommendations) => {
    if (recommendations.length === 0) {
        return 'I could not find a strong in-stock match right now. Try increasing the budget or choosing a broader gift category.';
    }

    return `I found a few thoughtful gift options for ${buildRecipientPhrase(giftContext)}${buildBudgetPhrase(giftContext)}. These are real in-stock Quad Tech products ranked by gift suitability, occasion fit, and budget.`;
};

const applyRecommendationDiversity = (
    recommendations,
    limit = GIFT_RECOMMENDATION_LIMIT
) => {
    const selected = [];
    const seenNames = new Set();
    const categoryCounts = new Map();
    const brandCounts = new Map();

    const tryAddRecommendation = (recommendation, allowOverflow = false) => {
        if (selected.length >= limit) {
            return;
        }

        const product = recommendation?.product || {};
        const nameKey = String(product.name || '').trim().toLowerCase();
        const categoryKey = String(product.category || 'uncategorized').trim().toLowerCase();
        const brandKey = String(product.brand || 'unknown-brand').trim().toLowerCase();

        if (!nameKey || seenNames.has(nameKey)) {
            return;
        }

        const categoryCount = categoryCounts.get(categoryKey) || 0;
        const brandCount = brandCounts.get(brandKey) || 0;

        if (!allowOverflow && (categoryCount >= 2 || brandCount >= 2)) {
            return;
        }

        selected.push(recommendation);
        seenNames.add(nameKey);
        categoryCounts.set(categoryKey, categoryCount + 1);
        brandCounts.set(brandKey, brandCount + 1);
    };

    recommendations.forEach((recommendation) => tryAddRecommendation(recommendation, false));

    if (selected.length < limit) {
        recommendations.forEach((recommendation) => tryAddRecommendation(recommendation, true));
    }

    return selected.slice(0, limit);
};

const buildGiftPriorityRelevantCategories = ({
    giftContext = {},
    relationshipProfile = {},
    occasionCategories = [],
    extraContext = {},
} = {}) => {
    const directContextCategories = collectCategories(
        giftContext?.preferredCategories,
        extraContext?.friendWishlistCategories,
        extraContext?.friendWishlistProducts,
        extraContext?.wishlistProducts
    );

    if (directContextCategories.length > 0) {
        return directContextCategories;
    }

    const occasionDrivenCategories = collectCategories(occasionCategories);

    if (occasionDrivenCategories.length > 0) {
        return occasionDrivenCategories;
    }

    return collectCategories(
        relationshipProfile.categories,
        extraContext?.similarWishlistCategories,
        giftContext?.preferredCategories,
        occasionCategories,
        extraContext?.friendWishlistCategories,
        extraContext?.friendWishlistProducts,
        extraContext?.wishlistProducts
    );
};

const buildGiftBoostContext = (giftContext = {}, occasionContext = {}, extraContext = {}) => {
    const relationshipProfile = getRelationshipProfile(giftContext) || {};
    const occasionCategories = Array.isArray(occasionContext?.activeOccasion?.recommendedCategories)
        ? occasionContext.activeOccasion.recommendedCategories
        : [];
    const relevantCategories = collectCategories(
        giftContext?.preferredCategories,
        relationshipProfile.categories,
        occasionCategories,
        extraContext?.friendWishlistCategories,
        extraContext?.similarWishlistCategories,
        extraContext?.friendWishlistProducts,
        extraContext?.wishlistProducts
    );
    const priorityRelevantCategories = buildGiftPriorityRelevantCategories({
        giftContext,
        relationshipProfile,
        occasionCategories,
        extraContext,
    });

    return {
        ...giftContext,
        ...extraContext,
        giftContext,
        preferredCategories: giftContext?.preferredCategories || [],
        relationshipCategories: relationshipProfile.categories || [],
        occasionCategories,
        relevantCategories,
        priorityRelevantCategories,
    };
};

const buildGiftRecommendation = ({
    product,
    scoreResult,
    boostMap,
    boostContext,
}) => {
    const organicScore = Number(
        scoreResult?.scoreBreakdown?.totalBeforeClamp ?? scoreResult?.giftScore ?? 0
    );
    const paidBoost = calculatePaidBoostForProduct({
        product,
        boostMap,
        options: {
            context: boostContext,
            mode: 'gift',
            organicScore,
            relevantCategories:
                boostContext?.priorityRelevantCategories || boostContext?.relevantCategories,
        },
    });
    const paidBoostScore = Number(paidBoost.paidBoostScore) || 0;
    const finalScore = organicScore + paidBoostScore;
    const giftScore = clamp(Math.round(finalScore), 0, 100);
    const reasons = Array.isArray(scoreResult?.reasons) ? [...scoreResult.reasons] : [];

    if (paidBoost.reason && !reasons.includes(paidBoost.reason)) {
        reasons.push(paidBoost.reason);
    }

    return {
        product: {
            ...serializeGiftProduct(product),
            isPromoted: Boolean(paidBoost.isPromoted),
            paidBoostScore,
            promotionLabel: paidBoost.promotionLabel || '',
        },
        organicScore,
        paidBoostScore,
        finalScore,
        giftScore,
        reasons,
        scoreBreakdown: {
            ...(scoreResult?.scoreBreakdown || {}),
            paidBoostScore,
        },
        isPromoted: Boolean(paidBoost.isPromoted),
        promotionLabel: paidBoost.promotionLabel || '',
    };
};

const getGiftRecommendationRating = (recommendation) =>
    Number(recommendation?.product?.rating ?? recommendation?.product?.averageRating ?? 0);

const getGiftRecommendationTimestamp = (recommendation) =>
    new Date(recommendation?.product?.createdAt || recommendation?.product?.updatedAt || 0).getTime() || 0;

const sortGiftRecommendations = (recommendations) =>
    [...recommendations].sort((firstRecommendation, secondRecommendation) => {
        const finalScoreDifference =
            Number(secondRecommendation.finalScore || secondRecommendation.giftScore || 0) -
            Number(firstRecommendation.finalScore || firstRecommendation.giftScore || 0);

        if (finalScoreDifference !== 0) {
            return finalScoreDifference;
        }

        const organicScoreDifference =
            Number(secondRecommendation.organicScore || 0) - Number(firstRecommendation.organicScore || 0);

        if (organicScoreDifference !== 0) {
            return organicScoreDifference;
        }

        const paidBoostDifference =
            Number(secondRecommendation.paidBoostScore || 0) - Number(firstRecommendation.paidBoostScore || 0);

        if (paidBoostDifference !== 0) {
            return paidBoostDifference;
        }

        const ratingDifference =
            getGiftRecommendationRating(secondRecommendation) -
            getGiftRecommendationRating(firstRecommendation);

        if (ratingDifference !== 0) {
            return ratingDifference;
        }

        return getGiftRecommendationTimestamp(secondRecommendation) - getGiftRecommendationTimestamp(firstRecommendation);
    });

const buildRelevantPromotedProductIds = (
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
                    const productId = getRecommendationProductId(recommendation);

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
                .map((recommendation) => getRecommendationProductId(recommendation))
                .filter(Boolean)
        )
    );
};

const buildOllamaPrompt = ({ message, giftContext, occasionContext, recommendations }) => {
    const selectedProducts = recommendations
        .map(
            (recommendation, index) =>
                `${index + 1}. ${recommendation.product.name} | ${recommendation.product.brand} | ${recommendation.product.category} | ${recommendation.product.price} | ${recommendation.reasons.join('; ')}`
        )
        .join('\n');

    return `You are Quad Tech's AI Gift Assistant.
The customer is buying a gift for someone else.
Only explain the products provided below.
Do not invent products.
Do not mention products outside this selected list.
Use Bangladesh cultural context when relevant.
Keep the reply short, warm, and helpful.
Mention why the top options fit the recipient, budget, and occasion.
Do not mention internal scores.
Do not include hidden reasoning.
Do not output JSON.

User message:
${message}

Parsed gift context:
${JSON.stringify(giftContext, null, 2)}

Occasion context:
${JSON.stringify(
    {
        source: occasionContext?.source || 'default',
        activeOccasion: occasionContext?.activeOccasion
            ? {
                name: occasionContext.activeOccasion.name,
                recommendedCategories: occasionContext.activeOccasion.recommendedCategories,
                recommendedColors: occasionContext.activeOccasion.recommendedColors,
                recommendedStyleTags: occasionContext.activeOccasion.recommendedStyleTags,
            }
            : null,
    },
    null,
    2
)}

Selected products:
${selectedProducts}

Write a short helpful reply in 1-2 paragraphs.`;
};

const generateOllamaGiftReply = async ({
    message,
    giftContext,
    occasionContext,
    recommendations,
    fallbackReply,
}) => {
    if (!process.env.OLLAMA_BASE_URL || recommendations.length === 0) {
        return null;
    }

    if (typeof fetch !== 'function') {
        return null;
    }

    const baseUrl = process.env.OLLAMA_BASE_URL.replace(/\/+$/, '');
    const timeout = Number(process.env.OLLAMA_TIMEOUT_MS || 90000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const headers = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
        };

        const basicAuthUser = String(process.env.OLLAMA_BASIC_AUTH_USER || '').trim();
        const basicAuthPass = String(process.env.OLLAMA_BASIC_AUTH_PASS || '').trim();

        if (basicAuthUser && basicAuthPass) {
            headers.Authorization = `Basic ${Buffer.from(`${basicAuthUser}:${basicAuthPass}`).toString('base64')}`;
        }

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: process.env.OLLAMA_MODEL || 'qwen3.5:9b',
                prompt: buildOllamaPrompt({
                    message,
                    giftContext,
                    occasionContext,
                    recommendations,
                    fallbackReply,
                }),
                stream: false,
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const reply = typeof data?.response === 'string' ? data.response.trim() : '';

        return reply || null;
    } catch (error) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
};

const getGiftAssistantRecommendations = async (message) => {
    if (typeof message !== 'string' || !message.trim()) {
        throw new Error('Message is required');
    }

    const trimmedMessage = message.trim();
    const giftContext = parseGiftContext(trimmedMessage);
    const occasionContext = getBangladeshOccasionContext(giftContext);
    const boostContext = buildGiftBoostContext(giftContext, occasionContext);
    const relevantBoostedProducts = await getActiveBoostedProductsForRelevantCategories({
        categories: boostContext.priorityRelevantCategories || boostContext.relevantCategories,
        placement: 'gift',
        limit: 20,
    });
    const relevantBoostedProductIds = relevantBoostedProducts
        .map((entry) => String(entry?.product?._id || ''))
        .filter(Boolean);

    const products = await Product.find(ACTIVE_GIFT_PRODUCT_FILTER).lean();
    const boostMap = await getActiveBoostMapForProducts(
        products.map((product) => product._id),
        'gift'
    );

    const scoredRecommendations = products.map((product) => {
        const scoreResult = scoreGiftProduct(product, giftContext, occasionContext);

        return buildGiftRecommendation({
            product,
            scoreResult,
            boostMap,
            boostContext,
        });
    });

    const positiveRecommendations = scoredRecommendations.filter(
        (recommendation) => Number(recommendation.finalScore ?? recommendation.giftScore) > 0
    );
    const workingRecommendations =
        positiveRecommendations.length >= GIFT_RECOMMENDATION_LIMIT
            ? positiveRecommendations
            : scoredRecommendations;

    const sortedRecommendations = sortGiftRecommendations(workingRecommendations);
    const promotedRelevantProductIds = buildRelevantPromotedProductIds(
        sortedRecommendations,
        relevantBoostedProductIds
    );

    const diversifiedRecommendations = applyRecommendationDiversity(
        sortedRecommendations,
        GIFT_RECOMMENDATION_LIMIT
    );
    const recommendations = applyPriorityQuotaToRecommendations({
        recommendations: diversifiedRecommendations,
        rankedRecommendations: sortedRecommendations,
        finalLimit: GIFT_RECOMMENDATION_LIMIT,
        mode: 'gift',
        promotedProductIds: promotedRelevantProductIds,
    });
    const fallbackReply = buildFallbackReply(giftContext, recommendations);
    const ollamaReply = await generateOllamaGiftReply({
        message: trimmedMessage,
        giftContext,
        occasionContext,
        recommendations,
        fallbackReply,
    });

    return {
        reply: ollamaReply || fallbackReply,
        giftContext,
        occasionContext,
        recommendations,
    };
};

export {
    ACTIVE_GIFT_PRODUCT_FILTER,
    GIFT_RECOMMENDATION_LIMIT,
    serializeGiftProduct,
    applyRecommendationDiversity,
    buildGiftBoostContext,
    getGiftAssistantRecommendations,
};
