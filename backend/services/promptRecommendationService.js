import { buildRecommendationContext } from './recommendationContextService.js';
import { parseRecommendationIntent } from './recommendationIntentService.js';
import {
    PROMPT_SCORING_WEIGHTS,
    fetchCandidatesFromIntent,
    hasSpecificIntentFilters,
    rankIntentProducts,
    serializeRecommendationProducts,
} from './recommendationSearchService.js';

const buildPromptFallbackStages = (intent) => [
    {
        key: 'exact',
        message: 'Recommended products based on your request.',
        options: {},
    },
    {
        key: 'relaxedAttributes',
        message: 'I could not find many exact matches, so I included similar products.',
        options: {
            skipColors: true,
            skipSizes: true,
            skipMaterials: true,
        },
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
        options: {
            skipDepartment: true,
            skipProductFamily: true,
            primaryOnly: true,
            relaxMaxPrice: Boolean(intent.maxPrice),
        },
        textFallback: true,
        skip: hasSpecificIntentFilters(intent),
    },
    {
        key: 'personalized',
        message: 'Here are products matched to your cart, wishlist, Cloud Closet, and shopping preferences.',
        options: { skipDepartment: true, skipProductFamily: true, primaryOnly: true, skipPrice: true },
    },
];

const getPromptRecommendations = async ({ userId, prompt }) => {
    const [{ intent, parserFallbackUsed }, context] = await Promise.all([
        parseRecommendationIntent(prompt),
        buildRecommendationContext(userId, { orderLimit: 5 }),
    ]);
    const candidateResult = await fetchCandidatesFromIntent({
        prompt,
        intent,
        stages: buildPromptFallbackStages(intent),
    });
    const rankedProducts = rankIntentProducts({
        products: candidateResult.products,
        context,
        intent,
        scoringWeights: PROMPT_SCORING_WEIGHTS,
    });

    return {
        intent,
        contextSummary: context.contextSummary,
        fallbackUsed: candidateResult.fallbackUsed,
        parserFallbackUsed,
        message: candidateResult.stage?.message || 'Recommended products based on your request.',
        products: serializeRecommendationProducts(rankedProducts),
    };
};

export { getPromptRecommendations };
