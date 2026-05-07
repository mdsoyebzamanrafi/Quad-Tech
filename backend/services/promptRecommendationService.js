import Product from '../models/Product.js';
import {
    buildProductLikeShape,
    buildRecommendationContext,
    normalizeDepartment,
    normalizeStringList,
    toObjectIdString,
} from './recommendationContextService.js';
import { scoreProduct } from './recommendationScoringService.js';
import { parseRecommendationIntent } from './recommendationIntentService.js';

const PRODUCT_QUERY_LIMIT = 100;
const RESULT_LIMIT = 8;
const MIN_EXACT_RESULTS = 5;
const PURCHASED_EXACT_PENALTY = -100;

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactRegex = (value) => new RegExp(`^${escapeRegex(value)}$`, 'i');

const ACTIVE_IN_STOCK_FILTER = {
    countInStock: { $gt: 0 },
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
};

const normalizeString = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeString(value).toLowerCase();

const addReason = (reasons, message) => {
    if (message && !reasons.includes(message)) {
        reasons.push(message);
    }
};

const stringMatches = (value, expected) =>
    Boolean(value && expected && normalizeLower(value) === normalizeLower(expected));

const listOverlaps = (values, expectedValues) => {
    const normalizedValues = new Set(normalizeStringList(values).map(normalizeLower));
    return normalizeStringList(expectedValues).some((value) => normalizedValues.has(normalizeLower(value)));
};

const stringOverlaps = (value, expectedValues) =>
    normalizeStringList(expectedValues).some((expectedValue) => stringMatches(value, expectedValue));

const uniqueList = (values) =>
    Array.from(
        new Set(
            (Array.isArray(values) ? values : [])
                .filter((value) => typeof value === 'string')
                .map((value) => value.trim())
                .filter(Boolean)
        )
    );

const serializeProduct = (product, reasons = []) => {
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

const buildPromptProductQuery = (intent, options = {}) => {
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

        if (!options.relaxFashionAttributes) {
            addCondition(andConditions, buildArrayMatchCondition('colors', intent.requestedColors));
            addCondition(andConditions, buildArrayMatchCondition('sizes', intent.requestedSizes));
            addCondition(andConditions, buildStringListMatchCondition('material', intent.requestedMaterials));
        }

        addCondition(andConditions, buildStringMatchCondition('fit', intent.fit));
        addCondition(andConditions, buildStringMatchCondition('occasion', intent.occasion));
        addCondition(andConditions, buildStringMatchCondition('season', intent.season));
        addCondition(andConditions, buildArrayMatchCondition('styleTags', intent.styleTags));
    }

    if (andConditions.length > 0) {
        query.$and = andConditions;
    }

    return query;
};

const hasSpecificPromptFilters = (intent) =>
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

const fetchProductsForStage = async (prompt, intent, stage) => {
    let query = buildPromptProductQuery(intent, stage.options || {});

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

const buildFallbackStages = (intent) => [
    {
        key: 'exact',
        message: 'Recommended products based on your request.',
        options: {},
    },
    {
        key: 'relaxedAttributes',
        message: 'I could not find many exact matches, so I included similar products.',
        options: { relaxFashionAttributes: true },
    },
    {
        key: 'primaryFilters',
        message: 'I could not find enough exact matches, so I kept the main product type and budget.',
        options: { primaryOnly: true },
    },
    {
        key: 'relaxedBudget',
        message: 'I could not find enough matches within budget, so I included nearby options.',
        options: { primaryOnly: true, relaxMaxPrice: Boolean(intent.maxPrice) },
        skip: !intent.maxPrice,
    },
    {
        key: 'department',
        message: 'I could not find enough exact matches, so I broadened this to similar products.',
        options: { skipProductFamily: true, primaryOnly: true, relaxMaxPrice: Boolean(intent.maxPrice) },
    },
    {
        key: 'text',
        message: 'I matched your request against product names and descriptions.',
        options: { skipDepartment: true, skipProductFamily: true, primaryOnly: true, relaxMaxPrice: Boolean(intent.maxPrice) },
        textFallback: true,
        skip: hasSpecificPromptFilters(intent),
    },
    {
        key: 'personalized',
        message: 'Here are products matched to your cart, wishlist, Cloud Closet, and shopping preferences.',
        options: { skipDepartment: true, skipProductFamily: true, primaryOnly: true, skipPrice: true },
    },
];

const fetchPromptCandidates = async (prompt, intent) => {
    const stages = buildFallbackStages(intent).filter((stage) => !stage.skip);

    for (let index = 0; index < stages.length; index += 1) {
        const stage = stages[index];
        const products = await fetchProductsForStage(prompt, intent, stage);

        if (products.length >= MIN_EXACT_RESULTS || index === stages.length - 1) {
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
        stage: stages[stages.length - 1],
    };
};

const buildPromptScore = (product, intent, preferenceProfile = {}) => {
    const normalizedProduct = buildProductLikeShape(product);
    const reasons = [];
    let promptScore = 0;
    let preferenceScore = 0;

    if (listOverlaps(normalizedProduct.colors, intent.requestedColors)) {
        promptScore += 100;
        addReason(reasons, `Matches requested color: ${intent.requestedColors.join(', ')}.`);
    }

    if (stringOverlaps(normalizedProduct.material, intent.requestedMaterials)) {
        promptScore += 80;
        addReason(reasons, `Matches requested material: ${intent.requestedMaterials.join(', ')}.`);
    }

    if (listOverlaps(normalizedProduct.sizes, intent.requestedSizes)) {
        promptScore += 80;
        addReason(reasons, 'Available in your requested size.');
    }

    if (stringMatches(normalizedProduct.brand, intent.brand)) {
        promptScore += 90;
        addReason(reasons, `Matches requested brand: ${intent.brand}.`);
    }

    if (stringMatches(normalizedProduct.gender, intent.gender)) {
        promptScore += 45;
        addReason(reasons, `Matches requested fit audience: ${intent.gender}.`);
    }

    if (stringMatches(normalizedProduct.productType, intent.productType)) {
        promptScore += 70;
        addReason(reasons, `Matches requested product type: ${intent.productType}.`);
    }

    if (stringMatches(normalizedProduct.category, intent.category)) {
        promptScore += 60;
        addReason(reasons, `Matches requested category: ${intent.category}.`);
    }

    if (stringMatches(normalizedProduct.department, intent.department)) {
        promptScore += 40;
    }

    if (listOverlaps(normalizedProduct.styleTags, intent.styleTags)) {
        promptScore += 35;
        addReason(reasons, 'Matches requested style.');
    }

    if (stringMatches(normalizedProduct.occasion, intent.occasion)) {
        promptScore += 25;
        addReason(reasons, `Fits ${intent.occasion}.`);
    }

    if (stringMatches(normalizedProduct.season, intent.season)) {
        promptScore += 25;
        addReason(reasons, `Fits ${intent.season}.`);
    }

    if (stringMatches(normalizedProduct.fit, intent.fit)) {
        promptScore += 25;
        addReason(reasons, `Matches requested fit: ${intent.fit}.`);
    }

    if (listOverlaps(normalizedProduct.colors, preferenceProfile.preferredColors)) {
        preferenceScore += 15;
        addReason(reasons, 'Matches colors you usually prefer.');
    }

    if (preferenceProfile.preferredBrands?.some((brand) => stringMatches(normalizedProduct.brand, brand))) {
        preferenceScore += 12;
        addReason(reasons, 'Matches brands you usually pick.');
    }

    if (preferenceProfile.preferredCategories?.some((category) => stringMatches(normalizedProduct.category, category))) {
        preferenceScore += 12;
        addReason(reasons, 'Similar to categories you like.');
    }

    if (preferenceProfile.preferredProductTypes?.some((productType) => stringMatches(normalizedProduct.productType, productType))) {
        preferenceScore += 12;
        addReason(reasons, 'Matches product types you explore often.');
    }

    if (listOverlaps(normalizedProduct.styleTags, preferenceProfile.preferredStyleTags)) {
        preferenceScore += 10;
        addReason(reasons, 'Matches your saved style preferences.');
    }

    if (listOverlaps(normalizedProduct.sizes, preferenceProfile.preferredSizes)) {
        preferenceScore += 8;
        addReason(reasons, 'Available in sizes you often choose.');
    }

    if (preferenceProfile.preferredMaterials?.some((material) => stringMatches(normalizedProduct.material, material))) {
        preferenceScore += 8;
        addReason(reasons, 'Matches materials you usually prefer.');
    }

    if (preferenceProfile.preferredFits?.some((fit) => stringMatches(normalizedProduct.fit, fit))) {
        preferenceScore += 8;
        addReason(reasons, 'Matches fits you usually prefer.');
    }

    if (preferenceProfile.preferredSeasons?.some((season) => stringMatches(normalizedProduct.season, season))) {
        preferenceScore += 8;
        addReason(reasons, 'Fits seasons you often shop for.');
    }

    if (preferenceProfile.preferredOccasions?.some((occasion) => stringMatches(normalizedProduct.occasion, occasion))) {
        preferenceScore += 8;
        addReason(reasons, 'Fits occasions you often shop for.');
    }

    return {
        promptScore,
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

const rankPromptProducts = (products, context, intent) => {
    const seenIds = new Set();
    const seenNames = new Set();
    const scoredProducts = products.map((product) => {
        const baseScore = scoreProduct(product, context);
        const promptScore = buildPromptScore(product, intent, context.preferenceProfile);
        const finalScore = Number(baseScore.finalScore) + promptScore.promptScore + promptScore.preferenceScore;

        return {
            product: {
                ...buildProductLikeShape(product),
                createdAt: product.createdAt,
            },
            finalScore,
            scoreBreakdown: {
                ...baseScore.scoreBreakdown,
                promptScore: promptScore.promptScore,
                promptPreferenceScore: promptScore.preferenceScore,
            },
            reasons: uniqueList([...promptScore.reasons, ...baseScore.reasons]),
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
        .slice(0, RESULT_LIMIT);
};

const getPromptRecommendations = async ({ userId, prompt }) => {
    const [{ intent, parserFallbackUsed }, context] = await Promise.all([
        parseRecommendationIntent(prompt),
        buildRecommendationContext(userId, { orderLimit: 5 }),
    ]);
    const candidateResult = await fetchPromptCandidates(prompt, intent);
    const rankedProducts = rankPromptProducts(candidateResult.products, context, intent);
    const finalProducts = rankedProducts.map((recommendation) =>
        serializeProduct(recommendation.product, recommendation.reasons)
    );

    return {
        intent,
        contextSummary: context.contextSummary,
        fallbackUsed: candidateResult.fallbackUsed,
        parserFallbackUsed,
        message: candidateResult.stage?.message || 'Recommended products based on your request.',
        products: finalProducts,
    };
};

export { getPromptRecommendations };
