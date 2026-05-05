import mongoose from 'mongoose';

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
    },
    {
        timestamps: true,
    }
);

orderItemSchema.index({ order: 1, product: 1, selectedColor: 1, selectedSize: 1 }, { unique: true });

const OrderItem = mongoose.model('OrderItem', orderItemSchema);

export default OrderItem;
