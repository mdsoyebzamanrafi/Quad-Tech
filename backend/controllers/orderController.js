import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../errors/ApiError.js';
import { uploadImageBuffer } from '../services/cloudinaryService.js';
import {
    createOrder,
    listMyOrders,
    getOrderForUser,
    cancelMyOrder,
    markOrderAsReceived,
    listOrdersForAdmin,
    getOrderForAdmin,
    updateOrderStatusByAdmin,
    updatePaymentStatusByAdmin,
    updateAdminNote,
} from '../services/orderService.js';

const uploadCustomDesignPreview = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'Preview image is required');
    }

    try {
        const uploadedImage = await uploadImageBuffer({
            buffer: req.file.buffer,
            folder: `custom-shirt-previews/${req.user._id}`,
            originalFilename: req.file.originalname,
        });

        res.status(201).json({
            success: true,
            previewImageUrl: uploadedImage.secure_url,
            publicId: uploadedImage.public_id,
        });
    } catch (error) {
        throw new ApiError(502, 'Could not upload custom design preview');
    }
});

const placeOrder = asyncHandler(async (req, res) => {
    const order = await createOrder({ authenticatedUser: req.user, payload: req.body });
    res.status(201).json(order);
});

const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await listMyOrders({ requester: req.user });
    res.json(orders);
});

const getMyOrderDetails = asyncHandler(async (req, res) => {
    const order = await getOrderForUser({ orderId: req.params.id, requester: req.user });
    res.json(order);
});

const cancelOwnOrder = asyncHandler(async (req, res) => {
    const order = await cancelMyOrder({
        orderId: req.params.id,
        requester: req.user,
        reason: req.body?.reason,
    });

    res.json(order);
});

// Backward-compatible endpoint used by current frontend.
const markOwnOrderAsReceived = asyncHandler(async (req, res) => {
    const order = await markOrderAsReceived({ orderId: req.params.id, requester: req.user });
    res.json(order);
});

// Backward-compatible endpoint: customer can fetch own order; admin can fetch any.
const getOrderById = asyncHandler(async (req, res) => {
    const order = await getOrderForUser({ orderId: req.params.id, requester: req.user });
    res.json(order);
});

const getAllOrdersAdmin = asyncHandler(async (req, res) => {
    const result = await listOrdersForAdmin({ filters: req.query });
    res.json(result);
});

const getOrderByIdAdmin = asyncHandler(async (req, res) => {
    const order = await getOrderForAdmin({ orderId: req.params.id, includeAuditTrail: true });
    res.json(order);
});

const updateOrderStatusAdmin = asyncHandler(async (req, res) => {
    const order = await updateOrderStatusByAdmin({
        orderId: req.params.id,
        newStatus: req.body.orderStatus,
        actor: req.user,
        note: req.body.note,
    });

    res.json(order);
});

const updatePaymentStatusAdmin = asyncHandler(async (req, res) => {
    const order = await updatePaymentStatusByAdmin({
        orderId: req.params.id,
        newStatus: req.body.paymentStatus,
        actor: req.user,
        note: req.body.note,
    });

    res.json(order);
});

const updateAdminNoteController = asyncHandler(async (req, res) => {
    const order = await updateAdminNote({
        orderId: req.params.id,
        note: req.body.adminNote,
        actor: req.user,
    });

    res.json(order);
});

export {
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
};
