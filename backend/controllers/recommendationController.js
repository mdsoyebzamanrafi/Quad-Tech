import { getPersonalRecommendations as getPersonalRecommendationsService } from '../services/personalRecommendationService.js';

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

export { getPersonalRecommendations };
