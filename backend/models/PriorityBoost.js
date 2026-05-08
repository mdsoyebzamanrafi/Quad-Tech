import mongoose from 'mongoose';

const PRIORITY_BOOST_STATUSES = ['pending', 'active', 'expired', 'cancelled'];
const PRIORITY_BOOST_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
const PRIORITY_BOOST_PLACEMENTS = ['personal', 'gift', 'both'];

const priorityBoostSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true,
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        category: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        feeAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        normalizedBoostScore: {
            type: Number,
            default: 0,
            min: 0,
        },
        maxBoostScore: {
            type: Number,
            default: 5,
            min: 0,
        },
        startsAt: {
            type: Date,
            required: true,
        },
        endsAt: {
            type: Date,
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: PRIORITY_BOOST_STATUSES,
            default: 'active',
            index: true,
        },
        paymentStatus: {
            type: String,
            enum: PRIORITY_BOOST_PAYMENT_STATUSES,
            default: 'paid',
        },
        placement: {
            type: String,
            enum: PRIORITY_BOOST_PLACEMENTS,
            default: 'both',
            index: true,
        },
        note: {
            type: String,
            trim: true,
            default: '',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        cancelledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

priorityBoostSchema.pre('validate', function () {
    if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
        this.invalidate('endsAt', 'endsAt must be after startsAt');
    }

    if (
        this.status === 'active' &&
        this.paymentStatus === 'paid' &&
        !(Number(this.feeAmount) > 0)
    ) {
        this.invalidate('feeAmount', 'Active paid boosts must have feeAmount greater than 0');
    }

});

priorityBoostSchema.index({ product: 1, status: 1, endsAt: 1 });
priorityBoostSchema.index({ category: 1, status: 1, endsAt: 1 });
priorityBoostSchema.index({ seller: 1, status: 1 });
priorityBoostSchema.index({ placement: 1, status: 1 });

const PriorityBoost = mongoose.model('PriorityBoost', priorityBoostSchema);

export {
    PRIORITY_BOOST_STATUSES,
    PRIORITY_BOOST_PAYMENT_STATUSES,
    PRIORITY_BOOST_PLACEMENTS,
};
export default PriorityBoost;
