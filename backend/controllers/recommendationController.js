import { getPersonalRecommendations as getPersonalRecommendationsService } from '../services/personalRecommendationService.js';
import { getImageSearchRecommendations as getImageSearchRecommendationsService } from '../services/imageSearchRecommendationService.js';
import { getPromptRecommendations as getPromptRecommendationsService } from '../services/promptRecommendationService.js';

const getPersonalRecommendations = async (req, res) => {
    try {
        const result = await getPersonalRecommendationsService(req.user._id);

        res.json({
            success: true,
            recommendations: result.recommendations,
            contextSummary: result.contextSummary,
        });
    } catch (error) {
        console.error('Personal recommendation error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to generate recommendations',
        });
    }
};

const getPromptRecommendations = async (req, res) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';

    if (!prompt) {
        return res.status(400).json({
            success: false,
            message: 'Prompt is required.',
        });
    }

    if (prompt.length > 300) {
        return res.status(400).json({
            success: false,
            message: 'Prompt must be 300 characters or less.',
        });
    }

    try {
        const result = await getPromptRecommendationsService({
            userId: req.user._id,
            prompt,
        });

        res.json({
            success: true,
            intent: result.intent,
            contextSummary: result.contextSummary,
            fallbackUsed: result.fallbackUsed,
            message: result.message,
            products: result.products,
        });
    } catch (error) {
        console.error('Prompt recommendation error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to generate prompt recommendations',
        });
    }
};

const getImageSearchRecommendations = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'Image is required for image search.',
        });
    }

    try {
        const result = await getImageSearchRecommendationsService({
            userId: req.user?._id || null,
            imageBuffer: req.file.buffer,
            mimeType: req.file.mimetype,
        });

        res.json({
            success: true,
            intent: result.intent,
            contextSummary: result.contextSummary,
            fallbackUsed: result.fallbackUsed,
            message: result.message,
            products: result.products,
        });
    } catch (error) {
        console.error('Image search recommendation error:', error);

        const statusCode = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 502;
        const message =
            statusCode >= 500
                ? 'Image search analysis is unavailable right now. Please try again.'
                : error.message || 'Could not analyze that image.';

        res.status(statusCode).json({
            success: false,
            message,
        });
    }
};

export { getPersonalRecommendations, getPromptRecommendations, getImageSearchRecommendations };
