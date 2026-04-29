import express from 'express';
const router = express.Router();
import {
    getProducts,
    getProductById,
    getAdminProducts,
    getAdminProductById,
    createProductReview,
    createProduct,
    updateProduct,
    deactivateProduct,
    updateProductStock,
    getProductSuggestions
} from '../controllers/productController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(getProducts).post(protect, admin, createProduct);
router.route('/search/suggestions').get(getProductSuggestions);
router.route('/admin').get(protect, admin, getAdminProducts);
router.route('/admin/:id').get(protect, admin, getAdminProductById);
router.route('/admin/:id/deactivate').patch(protect, admin, deactivateProduct);
router.route('/admin/:id/stock').patch(protect, admin, updateProductStock);
router.route('/:id').get(getProductById).put(protect, admin, updateProduct);
router.route('/:id/reviews').post(protect, createProductReview);
export default router;
