import mongoose from 'mongoose';

const discountConditionsSchema = new mongoose.Schema(
    {
        minCartTotal: {
            type: Number,
            min: 0,
            default: null,
        },
        minOrderCount: {
            type: Number,
            min: 0,
            default: null,
        },
        maxOrderCount: {
            type: Number,
            min: 0,
            default: null,
        },
        firstOrderOnly: {
            type: Boolean,
            default: false,
        },
        returningCustomerOnly: {
            type: Boolean,
            default: false,
        },
        category: {
            type: String,
            trim: true,
            default: '',
        },
        inactiveDays: {
            type: Number,
            min: 0,
            default: null,
        },
    },
    {
        _id: false,
    }
);

const discountRuleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },
        discountType: {
            type: String,
            required: true,
            enum: ['percentage', 'fixed'],
        },
        discountValue: {
            type: Number,
            required: true,
            min: 0,
        },
        maxDiscountAmount: {
            type: Number,
            min: 0,
            default: null,
        },
        conditions: {
            type: discountConditionsSchema,
            default: () => ({}),
        },
        active: {
            type: Boolean,
            default: true,
            index: true,
        },
        startDate: {
            type: Date,
            default: null,
        },
        endDate: {
            type: Date,
            default: null,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

discountRuleSchema.index({ active: 1, startDate: 1, endDate: 1 });
discountRuleSchema.index({ createdAt: -1 });

const DiscountRule = mongoose.model('DiscountRule', discountRuleSchema);

export default DiscountRule;
