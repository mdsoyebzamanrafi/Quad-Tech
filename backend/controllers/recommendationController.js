import { getPersonalRecommendations as getPersonalRecommendationsService } from '../services/personalRecommendationService.js';
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

export { getPersonalRecommendations, getPromptRecommendations };
