import Product from '../models/Product.js';
import {
    buildProductLikeShape,
    normalizeDepartment,
    normalizeStringList,
    toObjectIdString,
} from './recommendationContextService.js';
import { scoreProduct } from './recommendationScoringService.js';

const PRODUCT_QUERY_LIMIT = 100;
const RESULT_LIMIT = 8;
const DEFAULT_MIN_STAGE_RESULTS = 5;
const PURCHASED_EXACT_PENALTY = -100;

const ACTIVE_IN_STOCK_FILTER = {
    countInStock: { $gt: 0 },
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
};

const PROMPT_SCORING_WEIGHTS = Object.freeze({
    color: 100,
    material: 80,
    size: 80,
    brand: 90,
    gender: 45,
    productType: 70,
    category: 60,
    department: 40,
    styleTags: 35,
    occasion: 25,
    season: 25,
    fit: 25,
    preferenceColor: 15,
    preferenceBrand: 12,
    preferenceCategory: 12,
    preferenceProductType: 12,
    preferenceStyleTags: 10,
    preferenceSize: 8,
    preferenceMaterial: 8,
    preferenceFit: 8,
    preferenceSeason: 8,
    preferenceOccasion: 8,
});

const IMAGE_SCORING_WEIGHTS = Object.freeze({
    color: 100,
    material: 70,
    size: 40,
    brand: 30,
    gender: 30,
    productType: 90,
    category: 80,
    department: 35,
    styleTags: 50,
    occasion: 35,
    season: 35,
    fit: 25,
    preferenceColor: 8,
    preferenceBrand: 6,
    preferenceCategory: 6,
    preferenceProductType: 6,
    preferenceStyleTags: 5,
    preferenceSize: 4,
    preferenceMaterial: 4,
    preferenceFit: 4,
    preferenceSeason: 4,
    preferenceOccasion: 4,
});

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactRegex = (value) => new RegExp(`^${escapeRegex(value)}$`, 'i');
const normalizeString = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeString(value).toLowerCase();

const addReason = (reasons, message) => {
    if (message && !reasons.includes(message)) {
        reasons.push(message);
    }
};

const stringMatches = (value, expected) =>
    Boolean(value && expected && normalizeLower(value) === normalizeLower(expected));

const uniqueList = (values) =>
    Array.from(
        new Set(
            (Array.isArray(values) ? values : [])
                .filter((value) => typeof value === 'string')
                .map((value) => value.trim())
                .filter(Boolean)
        )
    );

const listOverlaps = (values, expectedValues) => {
    const normalizedValues = new Set(normalizeStringList(values).map(normalizeLower));
    return normalizeStringList(expectedValues).some((value) => normalizedValues.has(normalizeLower(value)));
};

const stringOverlaps = (value, expectedValues) =>
    normalizeStringList(expectedValues).some((expectedValue) => stringMatches(value, expectedValue));

const serializeRecommendationProduct = (product, reasons = []) => {
    const normalizedProduct = buildProductLikeShape(product);

    return {
        _id: toObjectIdString(normalizedProduct._id),
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
        matchReasons: uniqueList(reasons).slice(0, 4),
    };
};

const buildDepartmentCondition = (department) => {
    if (normalizeDepartment(department) === 'electronics') {
        return {
            $or: [
                { department: exactRegex('electronics') },
                { department: { $exists: false } },
                { department: null },
                { department: '' },
            ],
        };
    }

    return { department: exactRegex(department) };
};

const buildArrayMatchCondition = (field, values) => {
    const normalizedValues = uniqueList(values);

    if (normalizedValues.length === 0) {
        return null;
    }

    return {
        [field]: {
            $in: normalizedValues.map(exactRegex),
        },
    };
};

const buildStringMatchCondition = (field, value) => {
    if (!value) {
        return null;
    }

    return { [field]: exactRegex(value) };
};

const buildStringListMatchCondition = (field, values) => {
    const normalizedValues = uniqueList(values);

    if (normalizedValues.length === 0) {
        return null;
    }

    if (normalizedValues.length === 1) {
        return buildStringMatchCondition(field, normalizedValues[0]);
    }

    return {
        $or: normalizedValues.map((value) => buildStringMatchCondition(field, value)),
    };
};

const buildPriceQuery = (intent, { relaxMaxPrice = false } = {}) => {
    const priceQuery = {};

    if (Number(intent.minPrice) > 0) {
        priceQuery.$gte = Number(intent.minPrice);
    }

    if (Number(intent.maxPrice) > 0) {
        priceQuery.$lte = relaxMaxPrice
            ? Math.round(Number(intent.maxPrice) * 1.2 * 100) / 100
            : Number(intent.maxPrice);
    }

    return Object.keys(priceQuery).length > 0 ? priceQuery : null;
};

const addCondition = (conditions, condition) => {
    if (condition) {
        conditions.push(condition);
    }
};

const buildIntentProductQuery = (intent, options = {}) => {
    const query = { ...ACTIVE_IN_STOCK_FILTER };
    const andConditions = [];
    const priceQuery = options.skipPrice
        ? null
        : buildPriceQuery(intent, { relaxMaxPrice: options.relaxMaxPrice });

    if (priceQuery) {
        query.price = priceQuery;
    }

    if (!options.skipDepartment && intent.department) {
        addCondition(andConditions, buildDepartmentCondition(intent.department));
    }

    if (!options.skipProductFamily) {
        const productFamilyConditions = [];
        addCondition(productFamilyConditions, buildStringMatchCondition('category', intent.category));
        addCondition(productFamilyConditions, buildStringMatchCondition('productType', intent.productType));

        if (productFamilyConditions.length === 1) {
            addCondition(andConditions, productFamilyConditions[0]);
        } else if (productFamilyConditions.length > 1) {
            addCondition(andConditions, { $or: productFamilyConditions });
        }
    }

    if (!options.primaryOnly) {
        addCondition(andConditions, buildStringMatchCondition('brand', intent.brand));
        addCondition(andConditions, buildStringMatchCondition('gender', intent.gender));

        if (!options.skipColors) {
            addCondition(andConditions, buildArrayMatchCondition('colors', intent.requestedColors));
        }

        if (!options.skipSizes) {
            addCondition(andConditions, buildArrayMatchCondition('sizes', intent.requestedSizes));
        }

        if (!options.skipMaterials) {
            addCondition(andConditions, buildStringListMatchCondition('material', intent.requestedMaterials));
        }

        if (!options.skipFit) {
            addCondition(andConditions, buildStringMatchCondition('fit', intent.fit));
        }

        if (!options.skipOccasion) {
            addCondition(andConditions, buildStringMatchCondition('occasion', intent.occasion));
        }

        if (!options.skipSeason) {
            addCondition(andConditions, buildStringMatchCondition('season', intent.season));
        }

        if (!options.skipStyleTags) {
            addCondition(andConditions, buildArrayMatchCondition('styleTags', intent.styleTags));
        }
    }

    if (andConditions.length > 0) {
        query.$and = andConditions;
    }

    return query;
};

const hasSpecificIntentFilters = (intent) =>
    Boolean(
        intent.department ||
            intent.category ||
            intent.productType ||
            intent.brand ||
            intent.gender ||
            intent.minPrice ||
            intent.maxPrice ||
            intent.requestedColors.length > 0 ||
            intent.requestedSizes.length > 0 ||
            intent.requestedMaterials.length > 0 ||
            intent.fit ||
            intent.occasion ||
            intent.season ||
            intent.styleTags.length > 0
    );

const buildTextFallbackCondition = (prompt) => {
    const stopWords = new Set([
        'suggest',
        'recommend',
        'show',
        'me',
        'a',
        'an',
        'the',
        'for',
        'under',
        'below',
        'less',
        'than',
        'over',
        'above',
        'more',
        'products',
        'product',
        'like',
        'my',
        'wishlist',
        'similar',
        'to',
        'something',
    ]);
    const tokens = normalizeString(prompt)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !stopWords.has(token) && !Number.isFinite(Number(token)))
        .slice(0, 4);

    if (tokens.length === 0) {
        return null;
    }

    const tokenConditions = tokens.map((token) => {
        const regex = new RegExp(escapeRegex(token), 'i');

        return {
            $or: [
                { name: regex },
                { description: regex },
                { category: regex },
                { productType: regex },
            ],
        };
    });

    return { $and: tokenConditions };
};

const fetchProductsForStage = async ({ prompt = '', intent, stage }) => {
    let query = buildIntentProductQuery(intent, stage.options || {});

    if (stage.textFallback) {
        const textCondition = buildTextFallbackCondition(prompt);

        if (textCondition) {
            query = {
                ...query,
                $and: [
                    ...(Array.isArray(query.$and) ? query.$and : []),
                    textCondition,
                ],
            };
        }
    }

    return Product.find(query).limit(PRODUCT_QUERY_LIMIT).lean();
};

const fetchCandidatesFromIntent = async ({
    prompt = '',
    intent,
    stages,
    minStageResults = DEFAULT_MIN_STAGE_RESULTS,
}) => {
    const usableStages = (Array.isArray(stages) ? stages : []).filter((stage) => !stage.skip);

    for (let index = 0; index < usableStages.length; index += 1) {
        const stage = usableStages[index];
        const products = await fetchProductsForStage({
            prompt,
            intent,
            stage,
        });

        if (products.length >= minStageResults || index === usableStages.length - 1) {
            return {
                products,
                fallbackUsed: index > 0,
                stage,
            };
        }
    }

    return {
        products: [],
        fallbackUsed: true,
        stage: usableStages[usableStages.length - 1] || null,
    };
};

const buildIntentScore = (product, intent, preferenceProfile = {}, scoringWeights = PROMPT_SCORING_WEIGHTS) => {
    const normalizedProduct = buildProductLikeShape(product);
    const reasons = [];
    let intentScore = 0;
    let preferenceScore = 0;

    if (listOverlaps(normalizedProduct.colors, intent.requestedColors)) {
        intentScore += scoringWeights.color;
        addReason(reasons, `Matches requested color: ${intent.requestedColors.join(', ')}.`);
    }

    if (stringOverlaps(normalizedProduct.material, intent.requestedMaterials)) {
        intentScore += scoringWeights.material;
        addReason(reasons, `Matches requested material: ${intent.requestedMaterials.join(', ')}.`);
    }

    if (listOverlaps(normalizedProduct.sizes, intent.requestedSizes)) {
        intentScore += scoringWeights.size;
        addReason(reasons, 'Available in your requested size.');
    }

    if (stringMatches(normalizedProduct.brand, intent.brand)) {
        intentScore += scoringWeights.brand;
        addReason(reasons, `Matches requested brand: ${intent.brand}.`);
    }

    if (stringMatches(normalizedProduct.gender, intent.gender)) {
        intentScore += scoringWeights.gender;
        addReason(reasons, `Matches requested fit audience: ${intent.gender}.`);
    }

    if (stringMatches(normalizedProduct.productType, intent.productType)) {
        intentScore += scoringWeights.productType;
        addReason(reasons, `Matches requested product type: ${intent.productType}.`);
    }

    if (stringMatches(normalizedProduct.category, intent.category)) {
        intentScore += scoringWeights.category;
        addReason(reasons, `Matches requested category: ${intent.category}.`);
    }

    if (stringMatches(normalizedProduct.department, intent.department)) {
        intentScore += scoringWeights.department;
    }

    if (listOverlaps(normalizedProduct.styleTags, intent.styleTags)) {
        intentScore += scoringWeights.styleTags;
        addReason(reasons, 'Matches requested style.');
    }

    if (stringMatches(normalizedProduct.occasion, intent.occasion)) {
        intentScore += scoringWeights.occasion;
        addReason(reasons, `Fits ${intent.occasion}.`);
    }

    if (stringMatches(normalizedProduct.season, intent.season)) {
        intentScore += scoringWeights.season;
        addReason(reasons, `Fits ${intent.season}.`);
    }

    if (stringMatches(normalizedProduct.fit, intent.fit)) {
        intentScore += scoringWeights.fit;
        addReason(reasons, `Matches requested fit: ${intent.fit}.`);
    }

    if (listOverlaps(normalizedProduct.colors, preferenceProfile.preferredColors)) {
        preferenceScore += scoringWeights.preferenceColor;
        addReason(reasons, 'Matches colors you usually prefer.');
    }

    if (preferenceProfile.preferredBrands?.some((brand) => stringMatches(normalizedProduct.brand, brand))) {
        preferenceScore += scoringWeights.preferenceBrand;
        addReason(reasons, 'Matches brands you usually pick.');
    }

    if (preferenceProfile.preferredCategories?.some((category) => stringMatches(normalizedProduct.category, category))) {
        preferenceScore += scoringWeights.preferenceCategory;
        addReason(reasons, 'Similar to categories you like.');
    }

    if (preferenceProfile.preferredProductTypes?.some((productType) => stringMatches(normalizedProduct.productType, productType))) {
        preferenceScore += scoringWeights.preferenceProductType;
        addReason(reasons, 'Matches product types you explore often.');
    }

    if (listOverlaps(normalizedProduct.styleTags, preferenceProfile.preferredStyleTags)) {
        preferenceScore += scoringWeights.preferenceStyleTags;
        addReason(reasons, 'Matches your saved style preferences.');
    }

    if (listOverlaps(normalizedProduct.sizes, preferenceProfile.preferredSizes)) {
        preferenceScore += scoringWeights.preferenceSize;
        addReason(reasons, 'Available in sizes you often choose.');
    }

    if (preferenceProfile.preferredMaterials?.some((material) => stringMatches(normalizedProduct.material, material))) {
        preferenceScore += scoringWeights.preferenceMaterial;
        addReason(reasons, 'Matches materials you usually prefer.');
    }

    if (preferenceProfile.preferredFits?.some((fit) => stringMatches(normalizedProduct.fit, fit))) {
        preferenceScore += scoringWeights.preferenceFit;
        addReason(reasons, 'Matches fits you usually prefer.');
    }

    if (preferenceProfile.preferredSeasons?.some((season) => stringMatches(normalizedProduct.season, season))) {
        preferenceScore += scoringWeights.preferenceSeason;
        addReason(reasons, 'Fits seasons you often shop for.');
    }

    if (preferenceProfile.preferredOccasions?.some((occasion) => stringMatches(normalizedProduct.occasion, occasion))) {
        preferenceScore += scoringWeights.preferenceOccasion;
        addReason(reasons, 'Fits occasions you often shop for.');
    }

    return {
        intentScore,
        preferenceScore,
        reasons,
    };
};

const sortRecommendations = (recommendations, sortBy) => {
    const sortedRecommendations = [...recommendations];

    if (sortBy === 'price_low') {
        return sortedRecommendations.sort((first, second) =>
            Number(first.product.price) - Number(second.product.price) ||
            Number(second.finalScore) - Number(first.finalScore)
        );
    }

    if (sortBy === 'price_high') {
        return sortedRecommendations.sort((first, second) =>
            Number(second.product.price) - Number(first.product.price) ||
            Number(second.finalScore) - Number(first.finalScore)
        );
    }

    if (sortBy === 'rating') {
        return sortedRecommendations.sort((first, second) =>
            Number(second.product.rating) - Number(first.product.rating) ||
            Number(second.finalScore) - Number(first.finalScore)
        );
    }

    if (sortBy === 'newest') {
        return sortedRecommendations.sort((first, second) =>
            new Date(second.product.createdAt || 0) - new Date(first.product.createdAt || 0) ||
            Number(second.finalScore) - Number(first.finalScore)
        );
    }

    return sortedRecommendations.sort((first, second) => Number(second.finalScore) - Number(first.finalScore));
};

const rankIntentProducts = ({
    products,
    context,
    intent,
    scoringWeights = PROMPT_SCORING_WEIGHTS,
    resultLimit = RESULT_LIMIT,
}) => {
    const seenIds = new Set();
    const seenNames = new Set();
    const scoredProducts = (Array.isArray(products) ? products : []).map((product) => {
        const baseScore = scoreProduct(product, context);
        const explicitScore = buildIntentScore(product, intent, context.preferenceProfile, scoringWeights);
        const finalScore = Number(baseScore.finalScore) + explicitScore.intentScore + explicitScore.preferenceScore;

        return {
            product: {
                ...buildProductLikeShape(product),
                createdAt: product.createdAt,
            },
            finalScore,
            scoreBreakdown: {
                ...baseScore.scoreBreakdown,
                intentScore: explicitScore.intentScore,
                intentPreferenceScore: explicitScore.preferenceScore,
            },
            reasons: uniqueList([...explicitScore.reasons, ...baseScore.reasons]),
        };
    });

    return sortRecommendations(scoredProducts, intent.sortBy)
        .filter((recommendation) => Number(recommendation.product.countInStock) > 0)
        .filter((recommendation) => Number(recommendation.scoreBreakdown?.purchaseHistoryScore) > PURCHASED_EXACT_PENALTY)
        .filter((recommendation) => {
            const productId = toObjectIdString(recommendation.product._id);
            const nameKey = normalizeLower(recommendation.product.name);

            if (!productId || seenIds.has(productId) || seenNames.has(nameKey)) {
                return false;
            }

            seenIds.add(productId);
            seenNames.add(nameKey);
            return true;
        })
        .slice(0, resultLimit);
};

const serializeRecommendationProducts = (recommendations) =>
    (Array.isArray(recommendations) ? recommendations : []).map((recommendation) =>
        serializeRecommendationProduct(recommendation.product, recommendation.reasons)
    );

const buildAnonymousRecommendationContext = () => ({
    user: null,
    orders: [],
    purchasedProducts: [],
    wishlistProducts: [],
    cartProducts: [],
    cloudClosetItems: [],
    friendWishlistProducts: [],
    availableProducts: [],
    purchasedProductIds: [],
    cartProductIds: [],
    preferenceProfile: {},
    contextSummary: {},
});

export {
    ACTIVE_IN_STOCK_FILTER,
    IMAGE_SCORING_WEIGHTS,
    PROMPT_SCORING_WEIGHTS,
    buildAnonymousRecommendationContext,
    buildIntentProductQuery,
    fetchCandidatesFromIntent,
    hasSpecificIntentFilters,
    rankIntentProducts,
    serializeRecommendationProduct,
    serializeRecommendationProducts,
};
