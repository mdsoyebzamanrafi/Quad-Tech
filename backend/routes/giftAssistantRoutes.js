import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    handleGiftAssistant,
    handleFriendWishlistGiftAssistant,
} from '../controllers/giftAssistantController.js';

const router = express.Router();

router.post('/gift-assistant', handleGiftAssistant);
router.post('/gift-assistant/friend', protect, handleFriendWishlistGiftAssistant);

export default router;
