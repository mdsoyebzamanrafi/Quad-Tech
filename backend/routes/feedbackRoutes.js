import express from 'express';
import {
  getFeedback,
  getFeedbackStats,
  submitFeedback
} from '../controllers/feedbackController.js';

const router = express.Router();

router.route('/')
  .get(getFeedback)
  .post(submitFeedback);

router.get('/stats', getFeedbackStats);

export default router;
