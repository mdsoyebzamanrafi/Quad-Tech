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
import DiscountRule from '../models/DiscountRule.js';
import Cart from '../models/Cart.js';
import AuditLog from '../models/AuditLog.js';
import {
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
        phone,
    });
};

const createProduct = async ({
    owner,
    price = 100,
    countInStock = 20,
    category = 'Laptops',
    name = `Product-${Math.random().toString(36).slice(2, 8)}`,
} = {}) => {
    return Product.create({
        user: owner,
        name,
        image: '/images/sample.jpg',
        brand: 'BrandX',
        category,
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
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000),
} = {}) => {
    return Coupon.create({
        code,
        discountType,
        discountValue,
        minimumOrderAmount,
        maxDiscountAmount,
        usageLimit: 100,
        perUserLimit: 10,
        expiresAt,
        isActive: true,
        createdBy: adminUser._id,
    });
};

before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'feature16-test-secret';

    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
    });

    await mongoose.connect(replSet.getUri(), {
        dbName: 'feature16-tests',
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
        DiscountRule.deleteMany({}),
        Cart.deleteMany({}),
        Product.deleteMany({}),
        User.deleteMany({}),
    ]);
});

test('admin can create, update, toggle, list, and delete smart discount rules', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });

    const createRes = await request(app)
        .post('/api/admin/discounts')
        .set(authHeaderFor(admin._id))
        .send({
            name: 'High Cart Discount',
            description: 'Auto-discount for larger baskets',
            discountType: 'percentage',
            discountValue: 12,
            maxDiscountAmount: 800,
            minCartTotal: 5000,
            active: true,
        });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.name, 'High Cart Discount');
    assert.equal(createRes.body.conditions.minCartTotal, 5000);

    const listRes = await request(app)
        .get('/api/admin/discounts')
        .set(authHeaderFor(admin._id));

    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.length, 1);

    const updateRes = await request(app)
        .put(`/api/admin/discounts/${createRes.body._id}`)
        .set(authHeaderFor(admin._id))
        .send({
            description: 'Updated rule',
            inactiveDays: 30,
            active: false,
        });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.description, 'Updated rule');
    assert.equal(updateRes.body.active, false);
    assert.equal(updateRes.body.conditions.inactiveDays, 30);

    const toggleRes = await request(app)
        .patch(`/api/admin/discounts/${createRes.body._id}/toggle`)
        .set(authHeaderFor(admin._id));

    assert.equal(toggleRes.status, 200);
    assert.equal(toggleRes.body.active, true);

    const deleteRes = await request(app)
        .delete(`/api/admin/discounts/${createRes.body._id}`)
        .set(authHeaderFor(admin._id));

    assert.equal(deleteRes.status, 200);

    const emptyListRes = await request(app)
        .get('/api/admin/discounts')
        .set(authHeaderFor(admin._id));

    assert.equal(emptyListRes.status, 200);
    assert.equal(emptyListRes.body.length, 0);
});

test('eligible smart discount endpoint returns the single best matching rule', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer') });
    const product = await createProduct({ owner: admin._id, price: 1000, category: 'Laptops' });

    await DiscountRule.insertMany([
        {
            name: 'First Order Discount',
            discountType: 'percentage',
            discountValue: 10,
            conditions: { firstOrderOnly: true },
            active: true,
            createdBy: admin._id,
        },
        {
            name: 'High Cart Discount',
            discountType: 'percentage',
            discountValue: 12,
            conditions: { minCartTotal: 1500 },
            active: true,
            createdBy: admin._id,
        },
        {
            name: 'Laptop Discount',
            discountType: 'fixed',
            discountValue: 100,
            conditions: { category: 'Laptops' },
            active: true,
            createdBy: admin._id,
        },
    ]);

    const res = await request(app)
        .post('/api/discounts/eligible')
        .set(authHeaderFor(customer._id))
        .send({
            cartItems: [{ product: String(product._id), qty: 2 }],
        });

    assert.equal(res.status, 200);
    assert.equal(res.body.eligible, true);
    assert.equal(res.body.ruleName, 'High Cart Discount');
    assert.equal(res.body.discountAmount, 240);
    assert.equal(res.body.subtotal, 2000);
    assert.equal(res.body.finalTotal, 1760);
});

test('order creation recalculates and stores smart discount snapshots alongside coupons and reward tokens', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer'), rewardTokens: 400 });
    const product = await createProduct({ owner: admin._id, price: 1000, countInStock: 10, category: 'Laptops' });

    await createCoupon({ adminUser: admin, code: 'WELCOME10' });
    await DiscountRule.insertMany([
        {
            name: 'First Order Discount',
            discountType: 'percentage',
            discountValue: 10,
            conditions: { firstOrderOnly: true },
            active: true,
            createdBy: admin._id,
        },
        {
            name: 'High Cart Discount',
            discountType: 'percentage',
            discountValue: 12,
            conditions: { minCartTotal: 1500 },
            active: true,
            createdBy: admin._id,
        },
    ]);

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
            couponCode: 'WELCOME10',
            requestedTokens: 300,
        });

    assert.equal(res.status, 201);
    assert.equal(res.body.grossItemsPrice, 2000);
    assert.equal(res.body.coupon.code, 'WELCOME10');
    assert.equal(res.body.coupon.discountAmount, 200);
    assert.equal(res.body.smartDiscount.ruleName, 'High Cart Discount');
    assert.equal(res.body.smartDiscount.discountAmount, 240);
    assert.equal(res.body.tokenDiscount.tokensUsed, 300);
    assert.equal(res.body.tokenDiscount.discountAmount, 30);
    assert.equal(res.body.totalDiscount, 470);
    assert.equal(res.body.netItemsPrice, 1530);
    assert.equal(res.body.taxPrice, 153);
    assert.equal(res.body.shippingPrice, 0);
    assert.equal(res.body.totalPrice, 1683);

    const storedOrder = await Order.findById(res.body._id).lean();
    assert.equal(storedOrder.smartDiscount.ruleName, 'High Cart Discount');
    assert.equal(storedOrder.smartDiscount.discountAmount, 240);
    assert.equal(storedOrder.totalDiscount, 470);
});
