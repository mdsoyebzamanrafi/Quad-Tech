import { getGiftAssistantRecommendations } from '../services/giftAssistantService.js';
import { getFriendWishlistGiftRecommendations } from '../services/friendWishlistGiftService.js';

const handleGiftAssistant = async (req, res) => {
    const message = req.body?.message;

    if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Message is required',
        });
    }

    try {
        const result = await getGiftAssistantRecommendations(message);

        return res.json({
            success: true,
            reply: result.reply,
            giftContext: result.giftContext,
            occasionContext: result.occasionContext,
            recommendations: result.recommendations,
        });
    } catch (error) {
        console.error('Gift assistant error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to get gift recommendations',
        });
    }
};

const handleFriendWishlistGiftAssistant = async (req, res) => {
    const message = req.body?.message;
    const friendIdentifier = req.body?.friendIdentifier;

    if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Message is required',
        });
    }

    if (typeof friendIdentifier !== 'string' || !friendIdentifier.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Friend email or username is required',
        });
    }

    try {
        const result = await getFriendWishlistGiftRecommendations({
            message,
            friendIdentifier,
            currentUser: req.user,
        });

        return res.json({
            success: true,
            reply: result.reply,
            giftContext: result.giftContext,
            occasionContext: result.occasionContext,
            wishlistContext: result.wishlistContext,
            recommendations: result.recommendations,
        });
    } catch (error) {
        if (error?.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }

        console.error('Friend wishlist gift assistant error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to get friend wishlist gift recommendations',
        });
    }
};

export { handleGiftAssistant, handleFriendWishlistGiftAssistant };
