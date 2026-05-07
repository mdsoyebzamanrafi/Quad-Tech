import ApiError from '../errors/ApiError.js';
import CloudClosetItem from '../models/CloudClosetItem.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
    analyzeCloudClosetImage,
    emptyAttributes,
    getGeminiVisionModel,
} from '../services/cloudClosetAiService.js';
import { deleteImage, uploadImageBuffer } from '../services/cloudinaryService.js';
import { getProductAttributeValues } from '../services/productAttributeValueService.js';

const DEFAULT_CLOUD_CLOSET_LIMIT = 2;
const UPLOAD_LIMIT_MESSAGE = 'Cloud Closet upload limit reached. You can upload up to 2 clothing items.';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const logCloudCloset = (...args) => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('[Cloud Closet]', ...args);
    }
};

const logCloudClosetError = (...args) => {
    if (process.env.NODE_ENV !== 'test') {
        console.error('[Cloud Closet]', ...args);
    }
};

const getCloudClosetLimit = () => {
    const configuredLimit = Number(process.env.CLOUD_CLOSET_UPLOAD_LIMIT);
    return Number.isFinite(configuredLimit) && configuredLimit > 0
        ? Math.floor(configuredLimit)
        : DEFAULT_CLOUD_CLOSET_LIMIT;
};

const buildLimitState = async (userId) => {
    const limit = getCloudClosetLimit();
    const count = await CloudClosetItem.countDocuments({ user: userId });

    return {
        limit,
        count,
        remaining: Math.max(0, limit - count),
    };
};

const serializeCloudClosetItem = (item) => {
    const source = typeof item.toObject === 'function' ? item.toObject() : item;

    return {
        _id: source._id,
        imageUrl: source.imageUrl,
        originalFilename: source.originalFilename,
        aiProvider: source.aiProvider,
        aiModel: source.aiModel,
        analysisStatus: source.analysisStatus,
        analysisError: source.analysisError,
        attributes: source.attributes || emptyAttributes,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    };
};

const hasRecognizedClothingSignal = (attributes = {}) =>
    Boolean(
        attributes.department ||
            attributes.category ||
            attributes.productType ||
            attributes.material ||
            attributes.fit ||
            attributes.occasion ||
            attributes.season ||
            (Array.isArray(attributes.colors) && attributes.colors.length > 0) ||
            (Array.isArray(attributes.styleTags) && attributes.styleTags.length > 0)
    );

const getCleanAnalysisErrorMessage = (error) => {
    if (error?.message?.includes('API key')) {
        return 'Gemini analysis is not configured yet.';
    }

    if (error?.message?.includes('JSON') || error?.message?.includes('response')) {
        return 'We uploaded your image, but could not read the AI analysis response.';
    }

    return 'We uploaded your image, but Gemini analysis is unavailable right now.';
};

const getCloudClosetItems = asyncHandler(async (req, res) => {
    logCloudCloset('GET /api/cloud-closet', { userId: String(req.user._id) });
    const [items, limitState] = await Promise.all([
        CloudClosetItem.find({ user: req.user._id }).sort({ createdAt: -1 }).lean(),
        buildLimitState(req.user._id),
    ]);

    res.json({
        success: true,
        ...limitState,
        items: items.map(serializeCloudClosetItem),
    });
});

const uploadCloudClosetItem = asyncHandler(async (req, res) => {
    logCloudCloset('POST /api/cloud-closet started', {
        userId: String(req.user._id),
        hasFile: Boolean(req.file),
        file: req.file
            ? {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
            }
            : null,
    });

    const limitState = await buildLimitState(req.user._id);
    logCloudCloset('Upload limit state before upload', limitState);

    if (limitState.count >= limitState.limit) {
        logCloudCloset('Upload blocked: limit reached');
        return res.status(400).json({
            success: false,
            message: UPLOAD_LIMIT_MESSAGE,
        });
    }

    if (!req.file) {
        logCloudCloset('Upload blocked: no file received');
        return res.status(400).json({
            success: false,
            message: 'Image is required.',
        });
    }

    if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
        logCloudCloset('Upload blocked: invalid MIME type', { mimetype: req.file.mimetype });
        return res.status(400).json({
            success: false,
            message: 'Only JPEG, PNG, or WebP images are allowed.',
        });
    }

    const folder = `quad-tech/cloud-closet/${req.user._id}`;
    let uploadedImage = null;
    let closetItem = null;

    try {
        logCloudCloset('Stage 1: uploading image to Cloudinary', { folder });
        uploadedImage = await uploadImageBuffer({
            buffer: req.file.buffer,
            folder,
            originalFilename: req.file.originalname,
        });
        logCloudCloset('Stage 1 complete: Cloudinary upload returned', {
            publicId: uploadedImage.public_id,
            secureUrl: uploadedImage.secure_url,
            format: uploadedImage.format,
        });

        logCloudCloset('Stage 2: checking upload limit again before DB create');
        const latestLimitState = await buildLimitState(req.user._id);
        logCloudCloset('Upload limit state after Cloudinary upload', latestLimitState);
        if (latestLimitState.count >= latestLimitState.limit) {
            logCloudCloset('Limit reached after Cloudinary upload; deleting uploaded asset');
            await deleteImage(uploadedImage.public_id);
            return res.status(400).json({
                success: false,
                message: UPLOAD_LIMIT_MESSAGE,
            });
        }

        logCloudCloset('Stage 3: creating pending Cloud Closet item in MongoDB');
        closetItem = await CloudClosetItem.create({
            user: req.user._id,
            imageUrl: uploadedImage.secure_url,
            cloudinaryPublicId: uploadedImage.public_id,
            originalFilename: req.file.originalname,
            aiModel: getGeminiVisionModel(),
            analysisStatus: 'pending',
            attributes: emptyAttributes,
        });
        logCloudCloset('Stage 3 complete: pending Cloud Closet item created', {
            itemId: String(closetItem._id),
        });
    } catch (error) {
        logCloudClosetError('Upload/create failed before Gemini analysis', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            uploadedPublicId: uploadedImage?.public_id,
        });

        if (uploadedImage?.public_id) {
            logCloudCloset('Cleaning up Cloudinary asset after upload/create failure', {
                publicId: uploadedImage.public_id,
            });
            await deleteImage(uploadedImage.public_id).catch(() => null);
        }

        throw new ApiError(502, 'Image upload failed. Please try again.');
    }

    let responseMessage = 'Cloud Closet item uploaded and analyzed.';

    try {
        logCloudCloset('Stage 4: fetching valid product attribute values');
        const validValues = await getProductAttributeValues();
        logCloudCloset('Stage 4 complete: valid value counts', {
            departments: validValues.departments?.length || 0,
            categories: validValues.categories?.length || 0,
            productTypes: validValues.productTypes?.length || 0,
            colors: validValues.colors?.length || 0,
            sizes: validValues.sizes?.length || 0,
            materials: validValues.materials?.length || 0,
            fits: validValues.fits?.length || 0,
            occasions: validValues.occasions?.length || 0,
            seasons: validValues.seasons?.length || 0,
            styleTags: validValues.styleTags?.length || 0,
        });

        logCloudCloset('Stage 5: calling Gemini image analysis');
        const analysis = await analyzeCloudClosetImage({
            imageBuffer: req.file.buffer,
            mimeType: req.file.mimetype,
            validValues,
        });
        logCloudCloset('Stage 5 complete: Gemini analysis returned', {
            aiModel: analysis.aiModel,
            attributes: analysis.attributes,
        });

        const analysisStatus =
            analysis.attributes.confidence > 0 && hasRecognizedClothingSignal(analysis.attributes)
                ? 'completed'
                : 'failed';
        const analysisError =
            analysisStatus === 'completed' ? undefined : 'Please upload a clothing item.';

        closetItem.analysisStatus = analysisStatus;
        closetItem.analysisError = analysisError;
        closetItem.aiModel = analysis.aiModel;
        closetItem.attributes = analysis.attributes;
        closetItem.rawAiResponse = analysis.rawAiResponse;
        logCloudCloset('Stage 6: saving analyzed Cloud Closet item', {
            itemId: String(closetItem._id),
            analysisStatus,
            analysisError,
        });
        await closetItem.save();
        logCloudCloset('Stage 6 complete: analyzed Cloud Closet item saved');

        if (analysisStatus === 'failed') {
            responseMessage = 'Image uploaded, but analysis failed. Please upload a clothing item.';
        }
    } catch (error) {
        logCloudClosetError('Gemini analysis stage failed', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            rawAiResponse: error.rawAiResponse,
        });

        closetItem.analysisStatus = 'failed';
        closetItem.analysisError = getCleanAnalysisErrorMessage(error);
        closetItem.rawAiResponse = error.rawAiResponse;
        logCloudCloset('Stage 6: saving failed analysis status', {
            itemId: String(closetItem._id),
            analysisError: closetItem.analysisError,
        });
        await closetItem.save();
        responseMessage = closetItem.analysisError;
    }

    const nextLimitState = await buildLimitState(req.user._id);
    logCloudCloset('POST /api/cloud-closet completed', {
        itemId: String(closetItem._id),
        analysisStatus: closetItem.analysisStatus,
        nextLimitState,
    });

    res.status(201).json({
        success: true,
        message: responseMessage,
        ...nextLimitState,
        item: serializeCloudClosetItem(closetItem),
    });
});

const deleteCloudClosetItem = asyncHandler(async (req, res) => {
    logCloudCloset('DELETE /api/cloud-closet/:id started', {
        userId: String(req.user._id),
        itemId: req.params.id,
    });

    const closetItem = await CloudClosetItem.findOne({
        _id: req.params.id,
        user: req.user._id,
    });

    if (!closetItem) {
        throw new ApiError(404, 'Cloud Closet item not found.');
    }

    try {
        logCloudCloset('Deleting Cloudinary asset for closet item', {
            publicId: closetItem.cloudinaryPublicId,
        });
        await deleteImage(closetItem.cloudinaryPublicId);
    } catch (error) {
        logCloudClosetError('Cloudinary delete error', {
            message: error.message,
            publicId: closetItem.cloudinaryPublicId,
        });
    }

    await closetItem.deleteOne();
    const limitState = await buildLimitState(req.user._id);

    res.json({
        success: true,
        message: 'Cloud Closet item deleted.',
        ...limitState,
    });
});

const reanalyzeCloudClosetItem = asyncHandler(async (req, res) => {
    logCloudCloset('POST /api/cloud-closet/:id/reanalyze started', {
        userId: String(req.user._id),
        itemId: req.params.id,
    });

    const closetItem = await CloudClosetItem.findOne({
        _id: req.params.id,
        user: req.user._id,
    });

    if (!closetItem) {
        throw new ApiError(404, 'Cloud Closet item not found.');
    }

    try {
        logCloudCloset('Reanalysis stage 1: fetching valid product attribute values');
        const validValues = await getProductAttributeValues();
        logCloudCloset('Reanalysis stage 2: calling Gemini image analysis from Cloudinary URL');
        const analysis = await analyzeCloudClosetImage({
            imageUrl: closetItem.imageUrl,
            validValues,
        });
        logCloudCloset('Reanalysis Gemini returned', {
            aiModel: analysis.aiModel,
            attributes: analysis.attributes,
        });
        const analysisStatus =
            analysis.attributes.confidence > 0 && hasRecognizedClothingSignal(analysis.attributes)
                ? 'completed'
                : 'failed';

        closetItem.analysisStatus = analysisStatus;
        closetItem.analysisError =
            analysisStatus === 'completed' ? undefined : 'Please upload a clothing item.';
        closetItem.aiModel = analysis.aiModel;
        closetItem.attributes = analysis.attributes;
        closetItem.rawAiResponse = analysis.rawAiResponse;
        await closetItem.save();

        res.json({
            success: true,
            message:
                analysisStatus === 'completed'
                    ? 'Cloud Closet item reanalyzed.'
                    : 'Analysis failed. Please upload a clothing item.',
            item: serializeCloudClosetItem(closetItem),
        });
    } catch (error) {
        logCloudClosetError('Cloud Closet reanalysis error', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            rawAiResponse: error.rawAiResponse,
        });

        closetItem.analysisStatus = 'failed';
        closetItem.analysisError = getCleanAnalysisErrorMessage(error);
        closetItem.rawAiResponse = error.rawAiResponse;
        await closetItem.save();

        res.status(502).json({
            success: false,
            message: closetItem.analysisError,
            item: serializeCloudClosetItem(closetItem),
        });
    }
});

export {
    deleteCloudClosetItem,
    getCloudClosetItems,
    reanalyzeCloudClosetItem,
    uploadCloudClosetItem,
};
