import express from 'express';
import {
    createDiscountRule,
    deleteDiscountRule,
    getDiscountRuleById,
    getDiscountRules,
    getEligibleSmartDiscount,
    toggleDiscountRule,
    updateDiscountRule,
} from '../controllers/discountController.js';
import { protect, requireActiveAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/discounts/eligible', protect, getEligibleSmartDiscount);

router.route('/admin/discounts')
    .get(protect, requireActiveAdmin, getDiscountRules)
    .post(protect, requireActiveAdmin, createDiscountRule);

router.route('/admin/discounts/:id')
    .get(protect, requireActiveAdmin, getDiscountRuleById)
    .put(protect, requireActiveAdmin, updateDiscountRule)
    .delete(protect, requireActiveAdmin, deleteDiscountRule);

router.patch('/admin/discounts/:id/toggle', protect, requireActiveAdmin, toggleDiscountRule);

export default router;
