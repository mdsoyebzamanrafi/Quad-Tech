import mongoose from 'mongoose';
import {
    ORDER_STATUSES,
    ORDER_STATUS_VALUES,
    PAYMENT_METHOD_VALUES,
    PAYMENT_STATUSES,
    PAYMENT_STATUS_VALUES,
} from '../constants/domainConstants.js';

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
        orderStatus: {
            type: String,
            enum: ORDER_STATUS_VALUES,
            default: ORDER_STATUSES.PENDING,
            index: true,
        },
        paymentStatus: {
            type: String,
            enum: PAYMENT_STATUS_VALUES,
            default: PAYMENT_STATUSES.UNPAID,
            index: true,
        },
        paymentMethod: {
            type: String,
            enum: PAYMENT_METHOD_VALUES,
            required: true,
        },
        coupon: {
            code: {
                type: String,
                default: '',
                trim: true,
            },
            couponId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Coupon',
                default: null,
            },
            discountAmount: {
                type: Number,
                min: 0,
                default: 0,
            },
        },
        smartDiscount: {
            ruleId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'DiscountRule',
                default: null,
            },
            ruleName: {
                type: String,
                default: '',
                trim: true,
            },
            discountType: {
                type: String,
                default: '',
                trim: true,
            },
            discountValue: {
                type: Number,
                min: 0,
                default: 0,
            },
            discountAmount: {
                type: Number,
                min: 0,
                default: 0,
            },
        },
        tokenDiscount: {
            tokensUsed: {
                type: Number,
                min: 0,
                default: 0,
            },
            discountAmount: {
                type: Number,
                min: 0,
                default: 0,
            },
            tokensDeducted: {
                type: Boolean,
                default: false,
            },
        },
        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },
        grossItemsPrice: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        netItemsPrice: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        discount: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        totalDiscount: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        tax: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        shippingFee: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        total: {
            type: Number,
            required: true,
            min: 0,
        },
        rewardTokensEarned: {
            type: Number,
            min: 0,
            default: 0,
        },
        shippingName: {
            type: String,
            required: true,
            trim: true,
        },
        shippingPhone: {
            type: String,
            required: true,
            trim: true,
        },
        shippingAddress: {
            type: String,
            required: true,
            trim: true,
        },
        shippingAddressLine2: {
            type: String,
            trim: true,
            default: '',
        },
        shippingCity: {
            type: String,
            required: true,
            trim: true,
        },
        shippingPostalCode: {
            type: String,
            required: true,
            trim: true,
        },
        shippingCountry: {
            type: String,
            required: true,
            trim: true,
        },
        adminNote: {
            type: String,
            default: null,
        },
        stockReduced: {
            type: Boolean,
            default: false,
            index: true,
        },
        stockReducedAt: {
            type: Date,
            default: null,
        },
        stockRestoredAt: {
            type: Date,
            default: null,
        },
        paidAt: {
            type: Date,
            default: null,
        },
        refundedAt: {
            type: Date,
            default: null,
        },
        deliveredAt: {
            type: Date,
            default: null,
        },
        deliveredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        bulkDelivered: {
            type: Boolean,
            default: false,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        failedAt: {
            type: Date,
            default: null,
        },
        confirmedAt: {
            type: Date,
            default: null,
        },
        processingAt: {
            type: Date,
            default: null,
        },
        shippedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

orderSchema.virtual('itemsPrice').get(function () {
    return this.grossItemsPrice || this.subtotal;
});

orderSchema.virtual('taxPrice').get(function () {
    return this.tax;
});

orderSchema.virtual('shippingPrice').get(function () {
    return this.shippingFee;
});

orderSchema.virtual('totalPrice').get(function () {
    return this.total;
});

orderSchema.virtual('isPaid').get(function () {
    return this.paymentStatus === PAYMENT_STATUSES.PAID || this.paymentStatus === PAYMENT_STATUSES.REFUNDED;
});

orderSchema.virtual('couponDiscount').get(function () {
    return this.coupon?.discountAmount || 0;
});

orderSchema.virtual('tokenDiscountAmount').get(function () {
    return this.tokenDiscount?.discountAmount || 0;
});

orderSchema.virtual('isDelivered').get(function () {
    return this.orderStatus === ORDER_STATUSES.DELIVERED || this.orderStatus === ORDER_STATUSES.REFUND_REQUESTED || this.orderStatus === ORDER_STATUSES.REFUNDED;
});

orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderStatus: 1, paymentStatus: 1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;
