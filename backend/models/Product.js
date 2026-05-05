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
        images: [
            {
                type: String,
                trim: true,
            },
        ],
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
        department: {
            type: String,
            default: 'electronics',
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        gender: {
            type: String,
            trim: true,
        },
        colors: [String],
        sizes: [String],
        material: {
            type: String,
            trim: true,
        },
        fit: {
            type: String,
            trim: true,
        },
        occasion: {
            type: String,
            trim: true,
        },
        season: {
            type: String,
            trim: true,
        },
        styleTags: [String],
        productType: {
            type: String,
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
        isNewArrival: {
            type: Boolean,
            default: false,
        },
        adminPriorityScore: {
            type: Number,
            default: 0,
        },
        isSponsored: {
            type: Boolean,
            default: false,
        },
        sponsoredWeight: {
            type: Number,
            default: 0,
        },
    },
    
    {
        timestamps: true,
    }
    
);

const Product = mongoose.model('Product', productSchema);

export default Product;
