import express from 'express';
import {
    getPersonalRecommendations,
    getPromptRecommendations,
} from '../controllers/recommendationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/personal', protect, getPersonalRecommendations);
router.post('/prompt', protect, getPromptRecommendations);

export default router;
