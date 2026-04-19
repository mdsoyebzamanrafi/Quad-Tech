import express from 'express';
const router = express.Router();
import { processPayment, getPaymentConfig } from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/process').post(protect, processPayment);
router.route('/config').get(protect, getPaymentConfig);

export default router;
