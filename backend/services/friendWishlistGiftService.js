import Product from '../models/Product.js';
import User from '../models/User.js';
import Wishlist from '../models/Wishlist.js';
import Friendship from '../models/Friendship.js';
import { parseGiftContext } from './giftContextParser.js';
import { getBangladeshOccasionContext } from './bangladeshOccasionService.js';
import { scoreGiftProduct } from './giftRecommendationScoringService.js';
import {
    ACTIVE_GIFT_PRODUCT_FILTER,
    GIFT_RECOMMENDATION_LIMIT,
    applyRecommendationDiversity,
    buildGiftBoostContext,
    serializeGiftProduct,
} from './giftAssistantService.js';
import {
    applyPriorityQuotaToRecommendations,
    calculatePaidBoostForProduct,
    collectCategories,
    getActiveBoostMapForProducts,
    getActiveBoostedProductsForRelevantCategories,
} from './priorityBoostService.js';

const FRIEND_SOURCE_PRIORITY = {
    friend_wishlist: 4,
    similar_to_wishlist: 3,
    promoted_relevant_category: 2,
    general_catalog: 1,
};

const createHttpError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const normalizeString = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeString(value).toLowerCase();
const normalizeList = (values) =>
    Array.isArray(values)
        ? values
            .filter((value) => typeof value === 'string')
            .map((value) => normalizeString(value))
            .filter(Boolean)
        : [];

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const dedupeReasons = (reasons) =>
    Array.from(new Set((Array.isArray(reasons) ? reasons : []).filter(Boolean)));

const hasNumericValue = (value) =>
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value));

const formatTaka = (amount) => `\u09F3${Math.round(Number(amount) || 0)}`;

const getUserIdentifierField = () => {
    if (User.schema.path('username')) {
        return 'username';
    }

    if (User.schema.path('userName')) {
        return 'userName';
    }

    return null;
};

const buildSafeFriendShape = (friendUser = {}, identifierField = null) => ({
    _id: friendUser._id,
    name: normalizeString(friendUser.name),
    username: identifierField ? normalizeString(friendUser[identifierField]) || null : null,
    email: normalizeString(friendUser.email),
});

const getRecommendationId = (recommendation) => String(recommendation?.product?._id || '');

const getProductId = (product) => String(product?._id || '');

const isCatalogEligibleProduct = (product) =>
    Boolean(product) &&
    toNumber(product.countInStock) > 0 &&
    (product.isActive === true || product.isActive === undefined);

const dedupeProductsById = (products = []) => {
    const seenProductIds = new Set();

    return (Array.isArray(products) ? products : []).filter((product) => {
        const productId = getProductId(product);

        if (!productId || seenProductIds.has(productId)) {
            return false;
        }

        seenProductIds.add(productId);
        return true;
    });
};

const findFriendUserByIdentifier = async (friendIdentifier) => {
    const trimmedIdentifier = normalizeString(friendIdentifier);

    if (!trimmedIdentifier) {
        return { friendUser: null, identifierField: getUserIdentifierField() };
    }

    const normalizedEmail = trimmedIdentifier.toLowerCase();
    const identifierField = getUserIdentifierField();
    const exactMatchExpression = {
        $regex: `^${escapeRegExp(trimmedIdentifier)}$`,
        $options: 'i',
    };
    const lookupConditions = [
        { email: normalizedEmail },
        { name: exactMatchExpression },
    ];

    if (identifierField) {
        lookupConditions.push({
            [identifierField]: exactMatchExpression,
        });
    }

    const friendUser = await User.findOne({
        $or: lookupConditions,
        deletedAt: null,
    })
        .select('_id name email username userName status deletedAt')
        .lean();

    return {
        friendUser:
            friendUser && !friendUser.deletedAt
                ? friendUser
                : null,
        identifierField,
    };
};

const verifyAcceptedFriendship = async (currentUserId, friendUserId) => {
    const friendship = await Friendship.findOne({
        status: 'accepted',
        $or: [
            { requester: currentUserId, recipient: friendUserId },
            { requester: friendUserId, recipient: currentUserId },
        ],
    })
        .select('_id status')
        .lean();

    return Boolean(friendship);
};

const loadFriendWishlistProducts = async (friendUserId) => {
    const wishlistDocument = await Wishlist.findOne({ user: friendUserId })
        .populate('items.product')
        .lean();

    const wishlistItems = Array.isArray(wishlistDocument?.items) ? wishlistDocument.items : [];
    const wishlistProducts = wishlistItems
        .map((item) => item?.product)
        .filter(Boolean);

    return {
        wishlistProductCount: wishlistItems.length,
        wishlistProducts,
    };
};

const buildWishlistSignals = (wishlistProducts) => {
    const validProducts = Array.isArray(wishlistProducts) ? wishlistProducts.filter(Boolean) : [];
    const categories = Array.from(
        new Set(validProducts.map((product) => normalizeString(product.category)).filter(Boolean))
    );
    const departments = Array.from(
        new Set(validProducts.map((product) => normalizeLower(product.department || 'electronics')).filter(Boolean))
    );
    const brands = Array.from(
        new Set(validProducts.map((product) => normalizeString(product.brand)).filter(Boolean))
    );
    const styleTags = Array.from(
        new Set(
            validProducts.flatMap((product) =>
                normalizeList(product.styleTags).map((value) => normalizeString(value))
            )
        )
    );
    const colors = Array.from(
        new Set(
            validProducts.flatMap((product) =>
                normalizeList(product.colors).map((value) => normalizeString(value))
            )
        )
    );
    const prices = validProducts
        .map((product) => toNumber(product.price))
        .filter((price) => price > 0);

    return {
        categories,
        departments,
        brands,
        styleTags,
        colors,
        minPrice: prices.length ? Math.min(...prices) : 0,
        maxPrice: prices.length ? Math.max(...prices) : 0,
        averagePrice: prices.length
            ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length)
            : 0,
    };
};

const computeWishlistSimilarityBonus = (product, wishlistSignals) => {
    const category = normalizeString(product?.category);
    const department = normalizeLower(product?.department || 'electronics');
    const brand = normalizeString(product?.brand);
    const colors = normalizeList(product?.colors).map((value) => normalizeString(value));
    const styleTags = normalizeList(product?.styleTags).map((value) => normalizeString(value));
    const price = toNumber(product?.price);

    let bonus = 0;

    if (wishlistSignals.categories.includes(category)) {
        bonus += 10;
    }

    if (wishlistSignals.departments.includes(department)) {
        bonus += 6;
    }

    if (wishlistSignals.brands.includes(brand)) {
        bonus += 8;
    }

    if (styleTags.some((tag) => wishlistSignals.styleTags.includes(tag))) {
        bonus += 6;
    }

    if (colors.some((color) => wishlistSignals.colors.includes(color))) {
        bonus += 4;
    }

    if (
        wishlistSignals.averagePrice > 0 &&
        price > 0 &&
        Math.abs(price - wishlistSignals.averagePrice) / wishlistSignals.averagePrice <= 0.3
    ) {
        bonus += 4;
    }

    return Math.min(bonus, 20);
};

const scoreWishlistAwareProduct = ({
    product,
    giftContext,
    occasionContext,
    source,
    wishlistSignals,
}) => {
    const baseScore = scoreGiftProduct(product, giftContext, occasionContext);
    const reasons = Array.isArray(baseScore.reasons) ? [...baseScore.reasons] : [];
    let wishlistScore = 0;

    if (source === 'friend_wishlist') {
        wishlistScore += 45;
        reasons.unshift("This item is on your friend's wishlist");
    } else if (source === 'similar_to_wishlist') {
        wishlistScore += 25 + computeWishlistSimilarityBonus(product, wishlistSignals);
        reasons.unshift("Similar to items on your friend's wishlist");
    }

    const totalBeforeClamp =
        Number(baseScore.scoreBreakdown?.totalBeforeClamp || baseScore.giftScore || 0) + wishlistScore;
    const giftScore = Math.max(0, Math.min(100, Math.round(totalBeforeClamp)));

    return {
        giftScore,
        reasons: dedupeReasons(reasons).slice(0, 7),
        scoreBreakdown: {
            ...baseScore.scoreBreakdown,
            wishlistScore,
            totalBeforeClamp,
        },
    };
};

const compareRecommendations = (firstRecommendation, secondRecommendation) => {
    const firstPriority = FRIEND_SOURCE_PRIORITY[firstRecommendation.recommendationSource] || 0;
    const secondPriority = FRIEND_SOURCE_PRIORITY[secondRecommendation.recommendationSource] || 0;

    if (secondPriority !== firstPriority) {
        return secondPriority - firstPriority;
    }

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
        Number(secondRecommendation.product?.rating || 0) -
        Number(firstRecommendation.product?.rating || 0);

    if (ratingDifference !== 0) {
        return ratingDifference;
    }

    return (
        new Date(secondRecommendation.product?.createdAt || secondRecommendation.product?.updatedAt || 0).getTime() -
        new Date(firstRecommendation.product?.createdAt || firstRecommendation.product?.updatedAt || 0).getTime()
    );
};

const sortRecommendations = (recommendations) =>
    [...recommendations].sort(compareRecommendations);

const buildRelevantPromotedProductIds = (recommendations = []) =>
    Array.from(
        new Set(
            (Array.isArray(recommendations) ? recommendations : [])
                .filter(
                    (recommendation) =>
                        Number(recommendation?.paidBoostScore || 0) > 0 ||
                        Boolean(recommendation?.isPromoted) ||
                        Boolean(recommendation?.product?.isPromoted)
                )
                .map((recommendation) => getRecommendationId(recommendation))
                .filter(Boolean)
        )
    );

const applyFriendWishlistPriorityQuota = (recommendations, rankedRecommendations) =>
    applyPriorityQuotaToRecommendations({
        recommendations,
        rankedRecommendations,
        finalLimit: GIFT_RECOMMENDATION_LIMIT,
        mode: 'gift',
        protectedSources: ['friend_wishlist'],
        promotedProductIds: buildRelevantPromotedProductIds(rankedRecommendations),
        sortComparator: compareRecommendations,
    });

const buildCandidateRecommendation = ({
    product,
    source,
    giftContext,
    occasionContext,
    wishlistSignals,
    boostMap,
    boostContext,
}) => {
    const scoreResult = scoreWishlistAwareProduct({
        product,
        giftContext,
        occasionContext,
        source,
        wishlistSignals,
    });
    const organicScore = Number(
        scoreResult.scoreBreakdown?.totalBeforeClamp ?? scoreResult.giftScore ?? 0
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
    const reasons = Array.isArray(scoreResult.reasons) ? [...scoreResult.reasons] : [];

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
        recommendationSource: source,
        reasons,
        scoreBreakdown: {
            ...scoreResult.scoreBreakdown,
            paidBoostScore,
        },
        isPromoted: Boolean(paidBoost.isPromoted),
        promotionLabel: paidBoost.promotionLabel || '',
    };
};

const buildSelectableRecommendations = (recommendations) => {
    const positiveRecommendations = recommendations.filter(
        (recommendation) => Number(recommendation.finalScore ?? recommendation.giftScore) > 0
    );

    return sortRecommendations(
        positiveRecommendations.length >= GIFT_RECOMMENDATION_LIMIT
            ? positiveRecommendations
            : recommendations
    );
};

const buildSimilarProductsQuery = (wishlistSignals, excludedIds) => {
    const signalClauses = [];

    if (wishlistSignals.categories.length) {
        signalClauses.push({ category: { $in: wishlistSignals.categories } });
    }

    if (wishlistSignals.departments.length) {
        signalClauses.push({ department: { $in: wishlistSignals.departments } });
    }

    if (wishlistSignals.brands.length) {
        signalClauses.push({ brand: { $in: wishlistSignals.brands } });
    }

    if (wishlistSignals.styleTags.length) {
        signalClauses.push({ styleTags: { $in: wishlistSignals.styleTags } });
    }

    if (wishlistSignals.colors.length) {
        signalClauses.push({ colors: { $in: wishlistSignals.colors } });
    }

    if (signalClauses.length === 0) {
        return null;
    }

    return {
        ...ACTIVE_GIFT_PRODUCT_FILTER,
        _id: { $nin: excludedIds },
        $and: [{ $or: signalClauses }],
    };
};

const countSelectionsBySource = (recommendations) =>
    recommendations.reduce(
        (counts, recommendation) => {
            const source = recommendation.recommendationSource;

            if (source === 'friend_wishlist') {
                counts.selectedWishlistProductCount += 1;
            } else if (source === 'similar_to_wishlist') {
                counts.selectedSimilarProductCount += 1;
            } else if (source === 'general_catalog' || source === 'promoted_relevant_category') {
                counts.selectedGeneralProductCount += 1;
            }

            return counts;
        },
        {
            selectedWishlistProductCount: 0,
            selectedSimilarProductCount: 0,
            selectedGeneralProductCount: 0,
        }
    );

const buildFriendWishlistContext = ({
    friendUser,
    identifierField,
    wishlistProductCount,
    inStockWishlistProductCount,
    selectionCounts,
}) => {
    let reason = null;
    let usedWishlist =
        selectionCounts.selectedWishlistProductCount > 0 ||
        selectionCounts.selectedSimilarProductCount > 0;

    if (wishlistProductCount === 0) {
        reason = 'empty_wishlist';
        usedWishlist = false;
    } else if (inStockWishlistProductCount === 0) {
        reason = 'wishlist_items_out_of_stock';
        usedWishlist = false;
    } else if (
        selectionCounts.selectedWishlistProductCount === 0 &&
        selectionCounts.selectedSimilarProductCount > 0
    ) {
        reason = 'no_wishlist_match_in_budget';
        usedWishlist = true;
    }

    return {
        usedWishlist,
        friend: buildSafeFriendShape(friendUser, identifierField),
        wishlistProductCount,
        inStockWishlistProductCount,
        selectedWishlistProductCount: selectionCounts.selectedWishlistProductCount,
        selectedSimilarProductCount: selectionCounts.selectedSimilarProductCount,
        selectedGeneralProductCount: selectionCounts.selectedGeneralProductCount,
        reason,
    };
};

const buildFriendWishlistFallbackReply = (wishlistContext, recommendations) => {
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
        return 'I could not find a strong in-stock match right now. Try increasing the budget or choosing a broader gift category.';
    }

    if (
        wishlistContext.selectedWishlistProductCount > 0 &&
        wishlistContext.selectedSimilarProductCount > 0
    ) {
        return "I found some options from your friend's wishlist and added similar in-stock picks to complete the shortlist.";
    }

    if (wishlistContext.selectedWishlistProductCount > 0) {
        return "I found gift ideas using your friend's wishlist first, then ranked them by budget, occasion fit, and availability.";
    }

    if (wishlistContext.reason === 'empty_wishlist') {
        return 'Your friend does not have available wishlist items right now, so I picked thoughtful in-stock Quad Tech products instead.';
    }

    if (wishlistContext.reason === 'wishlist_items_out_of_stock') {
        return "Your friend's wishlist items are currently out of stock, so I selected similar in-stock alternatives and other thoughtful gift options.";
    }

    if (wishlistContext.selectedSimilarProductCount > 0) {
        return "I found some options inspired by your friend's wishlist and filled the rest with thoughtful in-stock picks.";
    }

    return 'Your friend does not have available wishlist items right now, so I picked thoughtful in-stock Quad Tech products instead.';
};

const buildFriendWishlistPrompt = ({
    message,
    giftContext,
    occasionContext,
    recommendations,
}) => {
    const selectedProducts = recommendations
        .map(
            (recommendation, index) =>
                `${index + 1}. ${recommendation.product.name} | ${recommendation.product.brand} | ${recommendation.product.category} | ${recommendation.product.price} | ${recommendation.recommendationSource} | ${recommendation.reasons.join('; ')}`
        )
        .join('\n');

    return `You are Quad Tech's AI Gift Assistant.
The user is buying a gift for an accepted friend.
Some selected products may come from the friend's wishlist.
Only explain the products provided below.
Do not invent products.
Do not mention products outside this selected list.
Do not mention orders, past purchases, private history, or behavior.
Do not reveal anything beyond wishlist presence.
Use Bangladesh cultural context when relevant.
Keep the reply short, warm, and helpful.
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

const generateFriendWishlistGiftReply = async ({
    message,
    giftContext,
    occasionContext,
    recommendations,
}) => {
    if (!process.env.OLLAMA_BASE_URL || recommendations.length === 0 || typeof fetch !== 'function') {
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

        const basicAuthUser = normalizeString(process.env.OLLAMA_BASIC_AUTH_USER);
        const basicAuthPass = normalizeString(process.env.OLLAMA_BASIC_AUTH_PASS);

        if (basicAuthUser && basicAuthPass) {
            headers.Authorization = `Basic ${Buffer.from(`${basicAuthUser}:${basicAuthPass}`).toString('base64')}`;
        }

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: process.env.OLLAMA_MODEL || 'qwen3.5:9b',
                prompt: buildFriendWishlistPrompt({
                    message,
                    giftContext,
                    occasionContext,
                    recommendations,
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

const buildBudgetPhrase = (giftContext) => {
    const budgetMin = hasNumericValue(giftContext?.budgetMin) ? Number(giftContext.budgetMin) : null;
    const budgetMax = hasNumericValue(giftContext?.budgetMax) ? Number(giftContext.budgetMax) : null;

    if (budgetMax !== null && budgetMin === null) {
        return ` under ${formatTaka(budgetMax)}`;
    }

    if (budgetMin !== null && budgetMax !== null) {
        return ` within ${formatTaka(budgetMin)}-${formatTaka(budgetMax)}`;
    }

    return '';
};

const getFriendWishlistGiftRecommendations = async ({
    message,
    friendIdentifier,
    currentUser,
}) => {
    if (typeof message !== 'string' || !message.trim()) {
        throw createHttpError(400, 'Message is required');
    }

    if (typeof friendIdentifier !== 'string' || !friendIdentifier.trim()) {
        throw createHttpError(400, 'Friend email or username is required');
    }

    const trimmedMessage = message.trim();
    const { friendUser, identifierField } = await findFriendUserByIdentifier(friendIdentifier);

    if (!friendUser) {
        throw createHttpError(404, 'Friend not found');
    }

    if (String(friendUser._id) === String(currentUser?._id)) {
        throw createHttpError(400, 'Please choose a friend, not your own account');
    }

    const acceptedFriendship = await verifyAcceptedFriendship(currentUser?._id, friendUser._id);

    if (!acceptedFriendship) {
        throw createHttpError(
            403,
            'You can only use wishlist gift recommendations for accepted friends'
        );
    }

    const { wishlistProductCount, wishlistProducts } = await loadFriendWishlistProducts(friendUser._id);
    const validWishlistProducts = wishlistProducts.filter(Boolean);
    const activeInStockWishlistProducts = validWishlistProducts.filter(isCatalogEligibleProduct);
    const wishlistSignals = buildWishlistSignals(validWishlistProducts);

    const giftContext = parseGiftContext(trimmedMessage);
    const occasionContext = getBangladeshOccasionContext(giftContext);
    const baseBoostContext = buildGiftBoostContext(giftContext, occasionContext, {
        friendWishlistCategories: wishlistSignals.categories,
        similarWishlistCategories: wishlistSignals.categories,
        friendWishlistProducts: validWishlistProducts,
        wishlistProducts: validWishlistProducts,
    });

    const wishlistProductIds = validWishlistProducts.map((product) => product._id).filter(Boolean);
    const similarQuery = buildSimilarProductsQuery(wishlistSignals, wishlistProductIds);

    const similarProducts = similarQuery
        ? await Product.find(similarQuery).limit(80).lean()
        : [];
    const promotedCatalogProducts = dedupeProductsById(
        (
            await getActiveBoostedProductsForRelevantCategories({
                categories:
                    baseBoostContext.priorityRelevantCategories ||
                    baseBoostContext.relevantCategories,
                placement: 'gift',
                limit: 20,
            })
        )
            .map((entry) => entry.product)
            .filter(
                (product) =>
                    isCatalogEligibleProduct(product) &&
                    !wishlistProductIds.some((wishlistProductId) => String(wishlistProductId) === getProductId(product)) &&
                    !similarProducts.some((similarProduct) => getProductId(similarProduct) === getProductId(product))
            )
    );
    let generalProducts = [];

    const buildBoostContext = (extraContext = {}) =>
        buildGiftBoostContext(giftContext, occasionContext, {
            friendWishlistCategories: wishlistSignals.categories,
            similarWishlistCategories: wishlistSignals.categories,
            friendWishlistProducts: validWishlistProducts,
            similarWishlistProducts: similarProducts,
            wishlistProducts: validWishlistProducts,
            promotedProducts: promotedCatalogProducts,
            ...extraContext,
        });

    const buildCandidates = async () => {
        const boostMap = await getActiveBoostMapForProducts(
            [
                ...activeInStockWishlistProducts.map((product) => product._id),
                ...similarProducts.map((product) => product._id),
                ...promotedCatalogProducts.map((product) => product._id),
                ...generalProducts.map((product) => product._id),
            ],
            'gift'
        );
        const boostContext = buildBoostContext();
        const nextWishlistCandidates = activeInStockWishlistProducts.map((product) =>
            buildCandidateRecommendation({
                product,
                source: 'friend_wishlist',
                giftContext,
                occasionContext,
                wishlistSignals,
                boostMap,
                boostContext,
            })
        );
        const nextSimilarCandidates = similarProducts.map((product) =>
            buildCandidateRecommendation({
                product,
                source: 'similar_to_wishlist',
                giftContext,
                occasionContext,
                wishlistSignals,
                boostMap,
                boostContext,
            })
        );
        const nextPromotedCandidates = promotedCatalogProducts.map((product) =>
            buildCandidateRecommendation({
                product,
                source: 'promoted_relevant_category',
                giftContext,
                occasionContext,
                wishlistSignals,
                boostMap,
                boostContext,
            })
        );
        const nextGeneralCandidates = generalProducts.map((product) =>
            buildCandidateRecommendation({
                product,
                source: 'general_catalog',
                giftContext,
                occasionContext,
                wishlistSignals,
                boostMap,
                boostContext,
            })
        );

        return {
            wishlistCandidates: nextWishlistCandidates,
            similarCandidates: nextSimilarCandidates,
            promotedCandidates: nextPromotedCandidates,
            generalCandidates: nextGeneralCandidates,
        };
    };

    let {
        wishlistCandidates,
        similarCandidates,
        promotedCandidates,
        generalCandidates,
    } = await buildCandidates();
    let combinedCandidates = buildSelectableRecommendations([
        ...wishlistCandidates,
        ...similarCandidates,
        ...promotedCandidates,
    ]);
    let recommendations = applyFriendWishlistPriorityQuota(
        applyRecommendationDiversity(
            combinedCandidates,
            GIFT_RECOMMENDATION_LIMIT
        ),
        combinedCandidates,
    );

    if (recommendations.length < GIFT_RECOMMENDATION_LIMIT) {
        const excludedProductIds = Array.from(
            new Set(
                [...wishlistCandidates, ...similarCandidates, ...promotedCandidates]
                    .map((recommendation) => getRecommendationId(recommendation))
                    .filter(Boolean)
            )
        );

        generalProducts = await Product.find({
            ...ACTIVE_GIFT_PRODUCT_FILTER,
            _id: { $nin: excludedProductIds },
        }).lean();

        ({
            wishlistCandidates,
            similarCandidates,
            promotedCandidates,
            generalCandidates,
        } = await buildCandidates());

        combinedCandidates = buildSelectableRecommendations([
            ...wishlistCandidates,
            ...similarCandidates,
            ...promotedCandidates,
            ...generalCandidates,
        ]);
        recommendations = applyFriendWishlistPriorityQuota(
            applyRecommendationDiversity(
                combinedCandidates,
                GIFT_RECOMMENDATION_LIMIT
            ),
            combinedCandidates,
        );
    }

    const selectionCounts = countSelectionsBySource(recommendations);
    const wishlistContext = buildFriendWishlistContext({
        friendUser,
        identifierField,
        wishlistProductCount,
        inStockWishlistProductCount: activeInStockWishlistProducts.length,
        selectionCounts,
    });

    const fallbackReply = buildFriendWishlistFallbackReply(wishlistContext, recommendations);
    const ollamaReply = await generateFriendWishlistGiftReply({
        message: trimmedMessage,
        giftContext,
        occasionContext,
        recommendations,
    });

    return {
        reply: ollamaReply || fallbackReply,
        giftContext,
        occasionContext,
        wishlistContext,
        recommendations,
    };
};

export { createHttpError, getFriendWishlistGiftRecommendations };
