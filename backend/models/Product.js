import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
    {
        name: { type: String, required: true,trim: true, },
        rating: { type: Number, required: true },
        comment: { type: String, required: true },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

const productSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        image: {
            type: String,
            required: true,
            trim: true,
        },
        brand: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        reviews: [reviewSchema],
        rating: {
            type: Number,
            required: true,
            default: 0,
        },
        numReviews: {
            type: Number,
            required: true,
            default: 0,
        },
        price: {
            type: Number,
            required: true,
            default: 0,
            min: [0, 'Price cannot be negative'],
        },
        countInStock: {
            type: Number,
            required: true,
            default: 0,
            min: [0, 'Stock cannot be negative'],
            validate: {
                validator: Number.isInteger,
                message: 'Stock must be a whole number',
            },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    
    {
        timestamps: true,
    }
    
);

const Product = mongoose.model('Product', productSchema);

export default Product;
