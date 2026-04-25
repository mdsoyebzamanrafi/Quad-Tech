import express from 'express';
import {
    getCouponSales,
    getDailySales,
    getProductSales,
    getSalesSummary,
} from '../controllers/salesController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/summary', protect, admin, getSalesSummary);
router.get('/daily', protect, admin, getDailySales);
router.get('/products', protect, admin, getProductSales);
router.get('/coupons', protect, admin, getCouponSales);

export default router;
