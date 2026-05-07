import express from 'express';
import multer from 'multer';
import {
    deleteCloudClosetItem,
    getCloudClosetItems,
    reanalyzeCloudClosetItem,
    uploadCloudClosetItem,
} from '../controllers/cloudClosetController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const logCloudCloset = (...args) => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('[Cloud Closet]', ...args);
    }
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES,
    },
    fileFilter: (req, file, callback) => {
        logCloudCloset('Multer received file candidate', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            fieldname: file.fieldname,
        });

        if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
            logCloudCloset('Multer accepted file type');
            callback(null, true);
            return;
        }

        const error = new Error('Only JPEG, PNG, or WebP images are allowed.');
        error.statusCode = 400;
        callback(error);
    },
});

const handleCloudClosetUpload = (req, res, next) => {
    logCloudCloset('Multer upload middleware started');

    upload.single('image')(req, res, (error) => {
        if (!error) {
            logCloudCloset('Multer upload middleware completed', {
                hasFile: Boolean(req.file),
                file: req.file
                    ? {
                        originalname: req.file.originalname,
                        mimetype: req.file.mimetype,
                        size: req.file.size,
                    }
                    : null,
            });
            next();
            return;
        }

        logCloudCloset('Multer upload middleware failed', {
            message: error.message,
            code: error.code,
        });

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

router
    .route('/')
    .get(protect, getCloudClosetItems)
    .post(protect, handleCloudClosetUpload, uploadCloudClosetItem);

router.post('/:id/reanalyze', protect, reanalyzeCloudClosetItem);
router.delete('/:id', protect, deleteCloudClosetItem);

export default router;
