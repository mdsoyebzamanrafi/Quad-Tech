import express from 'express';
import multer from 'multer';
import {
    getImageSearchRecommendations,
    getPersonalRecommendations,
    getPromptRecommendations,
} from '../controllers/recommendationController.js';
import { protect, protectOptional } from '../middleware/authMiddleware.js';

const router = express.Router();
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES,
    },
    fileFilter: (req, file, callback) => {
        if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
            callback(null, true);
            return;
        }

        const error = new Error('Only JPEG, PNG, or WebP images are allowed.');
        error.statusCode = 400;
        callback(error);
    },
});

const handleImageSearchUpload = (req, res, next) => {
    upload.single('image')(req, res, (error) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Image must be 5MB or less.',
            });
        }

        res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || 'Invalid image upload.',
        });
    });
};

router.get('/personal', protect, getPersonalRecommendations);
router.post('/prompt', protect, getPromptRecommendations);
router.post('/image-search', protectOptional, handleImageSearchUpload, getImageSearchRecommendations);

export default router;
