import ApiError from '../errors/ApiError.js';
import { analyzeImageSearchIntent } from './cloudClosetAiService.js';
import { buildRecommendationContext } from './recommendationContextService.js';
import { getProductAttributeValues } from './productAttributeValueService.js';
import {
    IMAGE_SCORING_WEIGHTS,
    buildAnonymousRecommendationContext,
    fetchCandidatesFromIntent,
    rankIntentProducts,
    serializeRecommendationProducts,
} from './recommendationSearchService.js';

const MIN_SEARCHABLE_CONFIDENCE = 0.15;

const buildImageFallbackStages = () => [
    {
        key: 'exact',
        message: 'Found products similar to your image.',
        options: {},
    },
    {
        key: 'relaxedAttributes',
        message: 'I could not find exact matches, so I included visually similar products.',
        options: {
            skipMaterials: true,
            skipFit: true,
            skipOccasion: true,
            skipSeason: true,
            skipStyleTags: true,
        },
    },
    {
        key: 'relaxedColors',
        message: 'I relaxed color matching to show more visually similar products.',
        options: {
            skipColors: true,
            skipMaterials: true,
            skipFit: true,
            skipOccasion: true,
            skipSeason: true,
            skipStyleTags: true,
        },
    },
    {
        key: 'productFamily',
        message: 'I kept the main product family and broadened the rest.',
        options: { primaryOnly: true },
    },
    {
        key: 'department',
        message: 'I broadened this to nearby products in the same department.',
        options: { skipProductFamily: true, primaryOnly: true },
    },
    {
        key: 'personalized',
        message: 'I could not find exact matches, so I mixed in broader in-stock products ranked by your preferences.',
        options: { skipDepartment: true, skipProductFamily: true, primaryOnly: true, skipPrice: true },
    },
];

const hasSearchableImageSignals = (intent = {}) =>
    Boolean(
        intent.department ||
            intent.category ||
            intent.productType ||
            intent.brand ||
            intent.gender ||
            intent.requestedColors?.length ||
            intent.requestedSizes?.length ||
            intent.requestedMaterials?.length ||
            intent.fit ||
            intent.occasion ||
            intent.season ||
            intent.styleTags?.length
    );

const buildDetectedItemLabel = (intent = {}) => {
    const parts = [];

    if (Array.isArray(intent.requestedColors) && intent.requestedColors[0]) {
        parts.push(intent.requestedColors[0].toLowerCase());
    }

    if (intent.occasion) {
        parts.push(intent.occasion.toLowerCase());
    }

    if (intent.productType) {
        parts.push(intent.productType.toLowerCase());
    } else if (intent.category) {
        parts.push(intent.category.toLowerCase());
    }

    return parts.join(' ').trim();
};

const buildImageSearchMessage = (intent, stage) => {
    if (stage?.key && stage.key !== 'exact') {
        return stage.message;
    }

    const detectedItemLabel = buildDetectedItemLabel(intent);
    return detectedItemLabel
        ? `I detected ${detectedItemLabel} and found similar products.`
        : 'Found products similar to your image.';
};

const getImageSearchRecommendations = async ({ userId = null, imageBuffer, mimeType }) => {
    const validValues = await getProductAttributeValues();
    const analysis = await analyzeImageSearchIntent({
        imageBuffer,
        mimeType,
        validValues,
    });
    const intent = analysis.intent;

    if (intent.confidence < MIN_SEARCHABLE_CONFIDENCE && !hasSearchableImageSignals(intent)) {
        throw new ApiError(
            400,
            'Could not identify a searchable product in the image. Try a clearer product photo.'
        );
    }

    const context = userId
        ? await buildRecommendationContext(userId, { orderLimit: 5 })
        : buildAnonymousRecommendationContext();
    const candidateResult = await fetchCandidatesFromIntent({
        intent,
        stages: buildImageFallbackStages(intent),
    });
    const rankedProducts = rankIntentProducts({
        products: candidateResult.products,
        context,
        intent,
        scoringWeights: IMAGE_SCORING_WEIGHTS,
    });

    return {
        intent,
        contextSummary: context.contextSummary || {},
        fallbackUsed: candidateResult.fallbackUsed,
        message: buildImageSearchMessage(intent, candidateResult.stage),
        products: serializeRecommendationProducts(rankedProducts),
        aiModel: analysis.aiModel,
    };
};

export { getImageSearchRecommendations };
