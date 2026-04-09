import express from 'express';
const router = express.Router();
import {
    getProducts,
    getProductById,
    createProductReview,
    createProduct,
    getProductSuggestions
} from '../controllers/productController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(getProducts).post(protect, admin, createProduct);
router.route('/search/suggestions').get(getProductSuggestions);
router.route('/:id').get(getProductById);
router.route('/:id/reviews').post(protect, createProductReview);

export default router;
