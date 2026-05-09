import asyncHandler from '../utils/asyncHandler.js';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../constants/domainConstants.js';
import { parseDateOrThrow } from '../validators/commonValidators.js';
import { roundPrice } from '../services/discountService.js';

const EXCLUDED_SALES_STATUSES = [
    ORDER_STATUSES.CANCELLED,
    ORDER_STATUSES.REFUNDED,
    ORDER_STATUSES.FAILED,
];

const normalizeRangeBoundary = (rawValue, fieldName) => {
    const parsed = parseDateOrThrow(rawValue, fieldName);
    if (!parsed) {
        return null;
    }

    if (typeof rawValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawValue.trim())) {
        if (fieldName === 'startDate') {
            parsed.setHours(0, 0, 0, 0);
        } else {
            parsed.setHours(23, 59, 59, 999);
        }
    }

    return parsed;
};

const buildSalesOrderMatch = ({ startDate = null, endDate = null } = {}) => {
    const match = {
        paymentStatus: PAYMENT_STATUSES.PAID,
        $or: [
            { orderStatus: { $exists: false } },
            { orderStatus: null },
            { orderStatus: { $nin: EXCLUDED_SALES_STATUSES } },
        ],
    };

    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = startDate;
        if (endDate) match.createdAt.$lte = endDate;
    }

    return match;
};

/**
 * @desc    Get aggregate sales summary including total revenue, orders, and discounts
 * @route   GET /api/sales/summary
 * @access  Private/Admin
 */
const getSalesSummary = asyncHandler(async (req, res) => {
    // Define criteria for "valid" sales: Paid orders that are not cancelled or failed
    const match = buildSalesOrderMatch();

    // Use MongoDB aggregation to sum financial metrics from all matching orders
    const [summary] = await Order.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$total' },
                grossSales: { $sum: { $ifNull: ['$grossItemsPrice', '$subtotal'] } },
                totalOrders: { $sum: 1 },
                couponDiscount: { $sum: { $ifNull: ['$coupon.discountAmount', 0] } },
                tokenDiscount: { $sum: { $ifNull: ['$tokenDiscount.discountAmount', 0] } },
                totalDiscount: { $sum: { $ifNull: ['$totalDiscount', '$discount'] } },
            },
        },
    ]);

    // Aggregate quantity of individual products sold
    const [itemsSummary] = await OrderItem.aggregate([
        {
            $lookup: {
                from: 'orders',
                localField: 'order',
                foreignField: '_id',
                as: 'orderDoc',
            },
        },
        { $unwind: '$orderDoc' },
        { $match: { 'orderDoc.paymentStatus': PAYMENT_STATUSES.PAID, $or: [{ 'orderDoc.orderStatus': { $exists: false } }, { 'orderDoc.orderStatus': null }, { 'orderDoc.orderStatus': { $nin: EXCLUDED_SALES_STATUSES } }] } },
        {
            $group: {
                _id: null,
                totalProductsSold: { $sum: '$quantity' },
            },
        },
    ]);

    const totalRevenue = roundPrice(summary?.totalRevenue || 0);
    const totalOrders = summary?.totalOrders || 0;

    res.json({
        totalRevenue,
        grossSales: roundPrice(summary?.grossSales || 0),
        totalOrders,
        averageOrderValue: totalOrders > 0 ? roundPrice(totalRevenue / totalOrders) : 0,
        couponDiscount: roundPrice(summary?.couponDiscount || 0),
        tokenDiscount: roundPrice(summary?.tokenDiscount || 0),
        totalDiscount: roundPrice(summary?.totalDiscount || 0),
        totalProductsSold: itemsSummary?.totalProductsSold || 0,
    });
});


/**
 * @desc    Get revenue and order count grouped by day for charts
 * @route   GET /api/sales/daily
 * @access  Private/Admin
 */
const getDailySales = asyncHandler(async (req, res) => {
    // Filter by date range if provided in query params
    const startDate = normalizeRangeBoundary(req.query.startDate, 'startDate');
    const endDate = normalizeRangeBoundary(req.query.endDate, 'endDate');
    const match = buildSalesOrderMatch({ startDate, endDate });

    // Group orders by date (string format YYYY-MM-DD) and sum metrics
    const results = await Order.aggregate([
        { $match: match },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$createdAt',
                    },
                },
                revenue: { $sum: '$total' },
                orders: { $sum: 1 },
                grossSales: { $sum: { $ifNull: ['$grossItemsPrice', '$subtotal'] } },
                discount: { $sum: { $ifNull: ['$totalDiscount', '$discount'] } },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    res.json(results.map((item) => ({
        date: item._id,
        revenue: roundPrice(item.revenue),
        orders: item.orders,
        grossSales: roundPrice(item.grossSales),
        discount: roundPrice(item.discount),
    })));
});


const getProductSales = asyncHandler(async (req, res) => {
    const results = await OrderItem.aggregate([
        {
            $lookup: {
                from: 'orders',
                localField: 'order',
                foreignField: '_id',
                as: 'orderDoc',
            },
        },
        { $unwind: '$orderDoc' },
        { $match: { 'orderDoc.paymentStatus': PAYMENT_STATUSES.PAID, $or: [{ 'orderDoc.orderStatus': { $exists: false } }, { 'orderDoc.orderStatus': null }, { 'orderDoc.orderStatus': { $nin: EXCLUDED_SALES_STATUSES } }] } },
        {
            $group: {
                _id: '$product',
                name: { $first: '$productName' },
                quantitySold: { $sum: '$quantity' },
                revenue: { $sum: '$lineTotal' },
            },
        },
        { $sort: { quantitySold: -1, revenue: -1 } },
        { $limit: 10 },
    ]);

    res.json(results.map((item) => ({
        productId: item._id,
        name: item.name,
        quantitySold: item.quantitySold,
        revenue: roundPrice(item.revenue),
    })));
});

const getCouponSales = asyncHandler(async (req, res) => {
    const results = await Order.aggregate([
        {
            $match: {
                ...buildSalesOrderMatch(),
                'coupon.code': { $exists: true, $ne: '' },
            },
        },
        {
            $group: {
                _id: '$coupon.code',
                uses: { $sum: 1 },
                totalDiscount: { $sum: { $ifNull: ['$coupon.discountAmount', 0] } },
                revenueAfterDiscount: { $sum: '$total' },
            },
        },
        { $sort: { uses: -1, revenueAfterDiscount: -1 } },
    ]);

    res.json(results.map((item) => ({
        code: item._id,
        uses: item.uses,
        totalDiscount: roundPrice(item.totalDiscount),
        revenueAfterDiscount: roundPrice(item.revenueAfterDiscount),
    })));
});

export {
    getSalesSummary,
    getDailySales,
    getProductSales,
    getCouponSales,
};
