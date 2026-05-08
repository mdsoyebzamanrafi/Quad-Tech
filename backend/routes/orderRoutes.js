import express from 'express';
import multer from 'multer';
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
    uploadCustomDesignPreview,
    confirmAndDeliverAllOrdersAdmin,
} from '../controllers/orderController.js';
import { protect, requireActiveAdmin, requireActiveSuperAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
const MAX_CUSTOM_PREVIEW_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PREVIEW_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const customPreviewUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_CUSTOM_PREVIEW_SIZE_BYTES,
    },
    fileFilter: (req, file, callback) => {
        if (ALLOWED_PREVIEW_IMAGE_TYPES.has(file.mimetype)) {
            callback(null, true);
            return;
        }

        const error = new Error('Only JPEG, PNG, or WebP preview images are allowed.');
        error.statusCode = 400;
        callback(error);
    },
});

const handleCustomPreviewUpload = (req, res, next) => {
    customPreviewUpload.single('image')(req, res, (error) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Preview image must be 5MB or less.',
            });
        }

        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Invalid preview image upload.',
        });
    });
};

// Customer endpoints
router.post('/', protect, placeOrder);
router.post('/custom-design-preview', protect, handleCustomPreviewUpload, uploadCustomDesignPreview);
router.get('/myorders', protect, getMyOrders);
router.get('/my/:id', protect, getMyOrderDetails);
router.patch('/my/:id/cancel', protect, cancelOwnOrder);

// Backward-compatible endpoint for existing frontend flow.
router.put('/:id/deliver', protect, markOwnOrderAsReceived);

// Admin order management endpoints
router.get('/admin', protect, requireActiveAdmin, getAllOrdersAdmin);
router.patch('/admin/confirm-and-deliver-all', protect, requireActiveSuperAdmin, confirmAndDeliverAllOrdersAdmin);
router.get('/admin/:id', protect, requireActiveAdmin, getOrderByIdAdmin);
router.patch('/admin/:id/status', protect, requireActiveAdmin, updateOrderStatusAdmin);
router.patch('/admin/:id/payment-status', protect, requireActiveAdmin, updatePaymentStatusAdmin);
router.patch('/admin/:id/admin-note', protect, requireActiveAdmin, updateAdminNoteController);

// Generic order detail endpoint (owner or admin)
router.get('/:id', protect, getOrderById);

export default router;
