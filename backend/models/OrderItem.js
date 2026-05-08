import mongoose from 'mongoose';

const customDesignPlacementSchema = new mongoose.Schema(
    {
        assetId: {
            type: String,
            trim: true,
            default: '',
        },
        imagePath: {
            type: String,
            trim: true,
            default: '',
        },
        x: {
            type: Number,
            default: 0,
        },
        y: {
            type: Number,
            default: 0,
        },
        width: {
            type: Number,
            default: 0,
        },
        height: {
            type: Number,
            default: 0,
        },
        rotation: {
            type: Number,
            default: 0,
        },
        zIndex: {
            type: Number,
            default: 0,
        },
    },
    { _id: false }
);

const customDesignSchema = new mongoose.Schema(
    {
        designId: {
            type: String,
            trim: true,
            default: '',
        },
        shirtColor: {
            type: String,
            trim: true,
            default: '',
        },
        templateId: {
            type: String,
            trim: true,
            default: '',
        },
        templatePath: {
            type: String,
            trim: true,
            default: '',
        },
        previewImageUrl: {
            type: String,
            default: '',
        },
        previewImagePublicId: {
            type: String,
            trim: true,
            default: '',
        },
        designs: {
            type: [customDesignPlacementSchema],
            default: [],
        },
    },
    { _id: false }
);

const orderItemSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Order',
            index: true,
        },
        product: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Product',
            index: true,
        },
        productName: {
            type: String,
            required: true,
            trim: true,
        },
        productImage: {
            type: String,
            default: '',
        },
        selectedColor: {
            type: String,
            trim: true,
            default: '',
        },
        selectedSize: {
            type: String,
            trim: true,
            default: '',
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        lineTotal: {
            type: Number,
            required: true,
            min: 0,
        },
        customDesign: {
            type: customDesignSchema,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

orderItemSchema.index(
    { order: 1, product: 1, selectedColor: 1, selectedSize: 1, 'customDesign.designId': 1 },
    { unique: true }
);

const OrderItem = mongoose.model('OrderItem', orderItemSchema);

export default OrderItem;
