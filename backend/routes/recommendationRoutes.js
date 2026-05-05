import express from 'express';
import { getPersonalRecommendations } from '../controllers/recommendationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/personal', protect, getPersonalRecommendations);

export default router;
