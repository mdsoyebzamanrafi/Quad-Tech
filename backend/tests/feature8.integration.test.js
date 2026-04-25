import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import Coupon from '../models/Coupon.js';
import Cart from '../models/Cart.js';
import AuditLog from '../models/AuditLog.js';
import {
    ORDER_STATUSES,
    PAYMENT_STATUSES,
    USER_ROLES,
    USER_STATUSES,
} from '../constants/domainConstants.js';

let replSet;

const authHeaderFor = (userId) => ({
    Authorization: `Bearer ${jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET)}`,
});

const uniqueEmail = (prefix = 'user') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;

const createUser = async ({
    name = 'Test User',
    email = uniqueEmail('user'),
    password = 'password123',
    role = USER_ROLES.CUSTOMER,
    status = USER_STATUSES.ACTIVE,
    isVerified = true,
    rewardTokens = 0,
    lifetimeSpent = 0,
    totalOrders = 0,
    phone = '+8801000000000',
} = {}) => {
    return User.create({
        name,
        email,
        password,
        role,
        status,
        isVerified,
        rewardTokens,
        lifetimeSpent,
        totalOrders,
        phone,
    });
};

const createProduct = async ({
    owner,
    price = 100,
    countInStock = 20,
    name = `Product-${Math.random().toString(36).slice(2, 8)}`,
} = {}) => {
    return Product.create({
        user: owner,
        name,
        image: '/images/sample.jpg',
        brand: 'BrandX',
        category: 'CategoryY',
        description: 'Test product',
        price,
        countInStock,
        numReviews: 0,
        rating: 0,
    });
};

const createCoupon = async ({
    adminUser,
    code = 'WELCOME10',
    discountType = 'percentage',
    discountValue = 10,
    minimumOrderAmount = 100,
    maxDiscountAmount = 500,
    usageLimit = 100,
    perUserLimit = 1,
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000),
    isActive = true,
} = {}) => {
    return Coupon.create({
        code,
        discountType,
        discountValue,
        minimumOrderAmount,
        maxDiscountAmount,
        usageLimit,
        perUserLimit,
        expiresAt,
        isActive,
        createdBy: adminUser._id,
    });
};

before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'feature8-test-secret';

    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
    });

    await mongoose.connect(replSet.getUri(), {
        dbName: 'feature8-tests',
    });
});

after(async () => {
    await mongoose.disconnect();
    await replSet.stop();
});

beforeEach(async () => {
    await Promise.all([
        AuditLog.deleteMany({}),
        OrderItem.deleteMany({}),
        Order.deleteMany({}),
        Coupon.deleteMany({}),
        Cart.deleteMany({}),
        Product.deleteMany({}),
        User.deleteMany({}),
    ]);
});

test('admin can create coupon and customer can validate it', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer') });

    const createRes = await request(app)
        .post('/api/coupons')
        .set(authHeaderFor(admin._id))
        .send({
            code: 'welcome10',
            discountType: 'percentage',
            discountValue: 10,
            minimumOrderAmount: 100,
            maxDiscountAmount: 500,
            usageLimit: 100,
            perUserLimit: 1,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            isActive: true,
        });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.code, 'WELCOME10');

    const validateRes = await request(app)
        .post('/api/coupons/validate')
        .set(authHeaderFor(customer._id))
        .send({
            code: 'welcome10',
            itemsPrice: 1000,
        });

    assert.equal(validateRes.status, 200);
    assert.equal(validateRes.body.discountAmount, 100);
  });

test('expired or below-minimum coupons are rejected', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer') });

    await createCoupon({
        adminUser: admin,
        code: 'EXPIRED',
        expiresAt: new Date(Date.now() - 1000),
    });

    const expiredRes = await request(app)
        .post('/api/coupons/validate')
        .set(authHeaderFor(customer._id))
        .send({ code: 'EXPIRED', itemsPrice: 1000 });

    assert.equal(expiredRes.status, 400);

    await createCoupon({
        adminUser: admin,
        code: 'MIN500',
        minimumOrderAmount: 500,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const belowMinRes = await request(app)
        .post('/api/coupons/validate')
        .set(authHeaderFor(customer._id))
        .send({ code: 'MIN500', itemsPrice: 400 });

    assert.equal(belowMinRes.status, 400);
});

test('order creation recalculates coupon and token discounts from DB prices and defers token deduction', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer'), rewardTokens: 400 });
    const product = await createProduct({ owner: admin._id, price: 600, countInStock: 10 });
    await createCoupon({ adminUser: admin, code: 'WELCOME10' });

    const res = await request(app)
        .post('/api/orders')
        .set(authHeaderFor(customer._id))
        .send({
            orderItems: [{ product: String(product._id), qty: 2, price: 1 }],
            shippingAddress: {
                address: 'Road 12',
                city: 'Dhaka',
                postalCode: '1207',
                country: 'Bangladesh',
                phone: '01711111111',
            },
            paymentMethod: 'paypal',
            couponCode: 'welcome10',
            requestedTokens: 300,
        });

    assert.equal(res.status, 201);
    assert.equal(res.body.itemsPrice, 1200);
    assert.equal(res.body.coupon.code, 'WELCOME10');
    assert.equal(res.body.coupon.discountAmount, 120);
    assert.equal(res.body.tokenDiscount.tokensUsed, 300);
    assert.equal(res.body.tokenDiscount.discountAmount, 30);
    assert.equal(res.body.netItemsPrice, 1050);
    assert.equal(res.body.taxPrice, 105);
    assert.equal(res.body.shippingPrice, 0);
    assert.equal(res.body.totalPrice, 1155);

    const freshUser = await User.findById(customer._id).lean();
    assert.equal(freshUser.rewardTokens, 400);

    const freshCoupon = await Coupon.findOne({ code: 'WELCOME10' }).lean();
    assert.equal(freshCoupon.usedCount, 1);
    assert.equal(freshCoupon.usedBy.length, 1);
});

test('marking order as paid deducts tokens once, rewards once, and updates user totals once', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer'), rewardTokens: 400 });
    const product = await createProduct({ owner: admin._id, price: 600, countInStock: 10 });
    await createCoupon({ adminUser: admin, code: 'WELCOME10' });

    const placed = await request(app)
        .post('/api/orders')
        .set(authHeaderFor(customer._id))
        .send({
            orderItems: [{ product: String(product._id), qty: 2 }],
            shippingAddress: {
                address: 'Road 12',
                city: 'Dhaka',
                postalCode: '1207',
                country: 'Bangladesh',
                phone: '01711111111',
            },
            paymentMethod: 'paypal',
            couponCode: 'WELCOME10',
            requestedTokens: 300,
        });

    const orderId = placed.body._id;

    const pay1 = await request(app)
        .patch(`/api/orders/admin/${orderId}/payment-status`)
        .set(authHeaderFor(admin._id))
        .send({ paymentStatus: PAYMENT_STATUSES.PAID });

    assert.equal(pay1.status, 200);
    assert.equal(pay1.body.tokenDiscount.tokensDeducted, true);
    assert.equal(pay1.body.rewardTokensEarned, 55);

    let freshUser = await User.findById(customer._id).lean();
    assert.equal(freshUser.rewardTokens, 155);
    assert.equal(freshUser.lifetimeSpent, 1155);
    assert.equal(freshUser.totalOrders, 1);

    const pay2 = await request(app)
        .patch(`/api/orders/admin/${orderId}/payment-status`)
        .set(authHeaderFor(admin._id))
        .send({ paymentStatus: PAYMENT_STATUSES.PAID });

    assert.equal(pay2.status, 200);

    freshUser = await User.findById(customer._id).lean();
    assert.equal(freshUser.rewardTokens, 155);
    assert.equal(freshUser.lifetimeSpent, 1155);
    assert.equal(freshUser.totalOrders, 1);
});

test('sales dashboard counts only paid valid orders and reports coupon/token discounts', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer'), rewardTokens: 400 });
    const product = await createProduct({ owner: admin._id, price: 600, countInStock: 20, name: 'Gaming Laptop' });
    await createCoupon({ adminUser: admin, code: 'WELCOME10' });

    const placed = await request(app)
        .post('/api/orders')
        .set(authHeaderFor(customer._id))
        .send({
            orderItems: [{ product: String(product._id), qty: 2 }],
            shippingAddress: {
                address: 'Road 12',
                city: 'Dhaka',
                postalCode: '1207',
                country: 'Bangladesh',
                phone: '01711111111',
            },
            paymentMethod: 'paypal',
            couponCode: 'WELCOME10',
            requestedTokens: 300,
        });

    await request(app)
        .patch(`/api/orders/admin/${placed.body._id}/payment-status`)
        .set(authHeaderFor(admin._id))
        .send({ paymentStatus: PAYMENT_STATUSES.PAID });

    const pendingOrder = await request(app)
        .post('/api/orders')
        .set(authHeaderFor(customer._id))
        .send({
            orderItems: [{ product: String(product._id), qty: 1 }],
            shippingAddress: {
                address: 'Road 12',
                city: 'Dhaka',
                postalCode: '1207',
                country: 'Bangladesh',
                phone: '01711111111',
            },
            paymentMethod: 'cash_on_delivery',
        });

    await request(app)
        .patch(`/api/orders/admin/${pendingOrder.body._id}/status`)
        .set(authHeaderFor(admin._id))
        .send({ orderStatus: ORDER_STATUSES.CANCELLED });

    const summaryRes = await request(app)
        .get('/api/sales/summary')
        .set(authHeaderFor(admin._id));

    assert.equal(summaryRes.status, 200);
    assert.equal(summaryRes.body.totalRevenue, 1155);
    assert.equal(summaryRes.body.grossSales, 1200);
    assert.equal(summaryRes.body.totalOrders, 1);
    assert.equal(summaryRes.body.couponDiscount, 120);
    assert.equal(summaryRes.body.tokenDiscount, 30);
    assert.equal(summaryRes.body.totalDiscount, 150);
    assert.equal(summaryRes.body.totalProductsSold, 2);

    const couponSalesRes = await request(app)
        .get('/api/sales/coupons')
        .set(authHeaderFor(admin._id));

    assert.equal(couponSalesRes.status, 200);
    assert.equal(couponSalesRes.body[0].code, 'WELCOME10');

    const productSalesRes = await request(app)
        .get('/api/sales/products')
        .set(authHeaderFor(admin._id));

    assert.equal(productSalesRes.status, 200);
    assert.equal(productSalesRes.body[0].name, 'Gaming Laptop');
    assert.equal(productSalesRes.body[0].quantitySold, 2);
});
