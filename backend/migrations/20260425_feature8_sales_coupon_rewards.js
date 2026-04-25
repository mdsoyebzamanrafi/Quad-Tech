import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import {
    ORDER_STATUSES,
    PAYMENT_STATUSES,
} from '../constants/domainConstants.js';
import { roundPrice } from '../services/discountService.js';

dotenv.config();

await connectDB();

const validSalesMatch = {
    paymentStatus: PAYMENT_STATUSES.PAID,
    orderStatus: {
        $nin: [ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REFUNDED, ORDER_STATUSES.FAILED],
    },
};

const backfillOrders = async () => {
    const orders = await Order.find({}).select('_id subtotal discount grossItemsPrice netItemsPrice totalDiscount coupon tokenDiscount rewardTokensEarned').lean();

    for (const order of orders) {
        const subtotal = roundPrice(order.subtotal ?? 0);
        const totalDiscount = roundPrice(order.totalDiscount ?? order.discount ?? 0);
        const netItemsPrice = roundPrice(Math.max((order.netItemsPrice ?? (subtotal - totalDiscount)), 0));

        await Order.updateOne(
            { _id: order._id },
            {
                $set: {
                    grossItemsPrice: roundPrice(order.grossItemsPrice ?? subtotal),
                    netItemsPrice,
                    totalDiscount,
                    discount: totalDiscount,
                    coupon: {
                        code: order.coupon?.code || '',
                        couponId: order.coupon?.couponId || null,
                        discountAmount: roundPrice(order.coupon?.discountAmount ?? 0),
                    },
                    tokenDiscount: {
                        tokensUsed: order.tokenDiscount?.tokensUsed ?? 0,
                        discountAmount: roundPrice(order.tokenDiscount?.discountAmount ?? 0),
                        tokensDeducted: order.tokenDiscount?.tokensDeducted ?? false,
                    },
                    rewardTokensEarned: order.rewardTokensEarned ?? 0,
                },
            }
        );
    }
};

const backfillUsers = async () => {
    const users = await User.find({}).select('_id rewardTokens lifetimeSpent totalOrders').lean();

    for (const user of users) {
        const [summary] = await Order.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(user._id),
                    ...validSalesMatch,
                },
            },
            {
                $group: {
                    _id: '$user',
                    lifetimeSpent: { $sum: '$total' },
                    totalOrders: { $sum: 1 },
                },
            },
        ]);

        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    rewardTokens: user.rewardTokens ?? 0,
                    lifetimeSpent: roundPrice(summary?.lifetimeSpent ?? user.lifetimeSpent ?? 0),
                    totalOrders: summary?.totalOrders ?? user.totalOrders ?? 0,
                },
            }
        );
    }
};

const runMigration = async () => {
    try {
        await backfillOrders();
        await backfillUsers();
        await Promise.all([User.syncIndexes(), Order.syncIndexes(), Coupon.syncIndexes()]);
        console.log('[migration] Feature 8 migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('[migration] Failed:', error);
        process.exit(1);
    }
};

runMigration();
