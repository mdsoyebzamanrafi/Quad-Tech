import express from 'express';
import {
    placeOrder,
    getMyOrders,
    getMyOrderDetails,
    cancelOwnOrder,
    markOwnOrderAsReceived,
    getOrderById,
    getAllOrdersAdmin,
    getOrderByIdAdmin,
    updateOrderStatusAdmin,
    updatePaymentStatusAdmin,
    updateAdminNoteController,
} from '../controllers/orderController.js';
import { protect, requireActiveAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer endpoints
router.post('/', protect, placeOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/my/:id', protect, getMyOrderDetails);
router.patch('/my/:id/cancel', protect, cancelOwnOrder);

// Backward-compatible endpoint for existing frontend flow.
router.put('/:id/deliver', protect, markOwnOrderAsReceived);

// Admin order management endpoints
router.get('/admin', protect, requireActiveAdmin, getAllOrdersAdmin);
router.get('/admin/:id', protect, requireActiveAdmin, getOrderByIdAdmin);
router.patch('/admin/:id/status', protect, requireActiveAdmin, updateOrderStatusAdmin);
router.patch('/admin/:id/payment-status', protect, requireActiveAdmin, updatePaymentStatusAdmin);
router.patch('/admin/:id/admin-note', protect, requireActiveAdmin, updateAdminNoteController);

// Generic order detail endpoint (owner or admin)
router.get('/:id', protect, getOrderById);

export default router;
