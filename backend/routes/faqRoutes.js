import express from 'express';
import {
  getFAQs,
  getCategories,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  submitFAQFeedback,
  getFAQById
} from '../controllers/faqController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getFAQs)
  .post(protect, admin, createFAQ);

router.get('/categories', getCategories);

router.route('/:id')
  .get(getFAQById)
  .put(protect, admin, updateFAQ)
  .delete(protect, admin, deleteFAQ);

router.post('/:id/feedback', submitFAQFeedback);

export default router;
