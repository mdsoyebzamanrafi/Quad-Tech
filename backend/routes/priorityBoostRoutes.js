import express from 'express';
import {
    cancelPriorityBoost,
    createPriorityBoost,
    getPriorityBoostById,
    getPriorityBoostSummary,
    getPriorityBoosts,
} from '../controllers/priorityBoostController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, admin);

router.get('/summary', getPriorityBoostSummary);
router.route('/')
    .get(getPriorityBoosts)
    .post(createPriorityBoost);
router.get('/:id', getPriorityBoostById);
router.patch('/:id/cancel', cancelPriorityBoost);

export default router;
