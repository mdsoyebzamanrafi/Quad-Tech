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
import AuditLog from '../models/AuditLog.js';
import Cart from '../models/Cart.js';
import {
    AUDIT_ACTIONS,
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
    deletedAt = null,
    phone = '+8801000000000',
} = {}) => {
    return User.create({
        name,
        email,
        password,
        role,
        status,
        isVerified,
        deletedAt,
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

const createOrderWithSingleItem = async ({
    user,
    product,
    quantity = 1,
    orderStatus = ORDER_STATUSES.PENDING,
    paymentStatus = PAYMENT_STATUSES.UNPAID,
    paymentMethod = 'cash_on_delivery',
    stockReduced = false,
} = {}) => {
    const subtotal = Math.round(product.price * quantity * 100) / 100;
    const tax = Math.round(subtotal * 0.15 * 100) / 100;
    const shippingFee = subtotal >= 100 ? 0 : 10;
    const total = Math.round((subtotal + tax + shippingFee) * 100) / 100;

    const order = await Order.create({
        user: user._id,
        orderStatus,
        paymentStatus,
        paymentMethod,
        subtotal,
        discount: 0,
        tax,
        shippingFee,
        total,
        shippingName: user.name,
        shippingPhone: user.phone || '01700000000',
        shippingAddress: 'Street 123',
        shippingAddressLine2: '',
        shippingCity: 'Dhaka',
        shippingPostalCode: '1207',
        shippingCountry: 'Bangladesh',
        stockReduced,
    });

    await OrderItem.create({
        order: order._id,
        product: product._id,
        productName: product.name,
        productImage: product.image,
        unitPrice: product.price,
        quantity,
        lineTotal: subtotal,
    });

    return order;
};

before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'feature7-test-secret';

    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
    });

    await mongoose.connect(replSet.getUri(), {
        dbName: 'feature7-tests',
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
        Cart.deleteMany({}),
        Product.deleteMany({}),
        User.deleteMany({}),
    ]);
});

test('customer can place valid order and totals are recomputed from DB prices', async () => {
    const customer = await createUser();
    const owner = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('owner') });
    const product = await createProduct({ owner: owner._id, price: 120, countInStock: 10 });

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
            itemsPrice: 1,
            taxPrice: 0,
            shippingPrice: 0,
            totalPrice: 1,
        });

    assert.equal(res.status, 201);
    assert.equal(res.body.subtotal, 240);
    assert.equal(res.body.orderItems.length, 1);
    assert.equal(res.body.orderItems[0].unitPrice, 120);
    assert.equal(res.body.orderItems[0].lineTotal, 240);
    assert.equal(res.body.total, Number((res.body.subtotal - res.body.discount + res.body.tax + res.body.shippingFee).toFixed(2)));

    const orderItem = await OrderItem.findOne({ order: res.body._id }).lean();
    assert.equal(orderItem.unitPrice, 120);
});

test('invalid cart/order creation fails', async () => {
    const customer = await createUser();

    const res = await request(app)
        .post('/api/orders')
        .set(authHeaderFor(customer._id))
        .send({
            orderItems: [],
            shippingAddress: {
                address: 'Road 12',
                city: 'Dhaka',
                postalCode: '1207',
                country: 'Bangladesh',
                phone: '01711111111',
            },
            paymentMethod: 'paypal',
        });

    assert.equal(res.status, 400);
});

test('customer can cancel only own pending/confirmed orders', async () => {
    const owner = await createUser({ email: uniqueEmail('owner') });
    const other = await createUser({ email: uniqueEmail('other') });
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const product = await createProduct({ owner: admin._id, price: 80, countInStock: 30 });

    const pendingOrder = await createOrderWithSingleItem({ user: owner, product, orderStatus: ORDER_STATUSES.PENDING });

    const forbidden = await request(app)
        .patch(`/api/orders/my/${pendingOrder._id}/cancel`)
        .set(authHeaderFor(other._id))
        .send({ reason: 'not mine' });
    assert.equal(forbidden.status, 403);

    const ownPendingCancel = await request(app)
        .patch(`/api/orders/my/${pendingOrder._id}/cancel`)
        .set(authHeaderFor(owner._id))
        .send({ reason: 'changed mind' });
    assert.equal(ownPendingCancel.status, 200);
    assert.equal(ownPendingCancel.body.orderStatus, ORDER_STATUSES.CANCELLED);

    const confirmedOrder = await createOrderWithSingleItem({
        user: owner,
        product,
        orderStatus: ORDER_STATUSES.CONFIRMED,
        stockReduced: true,
    });

    const ownConfirmedCancel = await request(app)
        .patch(`/api/orders/my/${confirmedOrder._id}/cancel`)
        .set(authHeaderFor(owner._id))
        .send({ reason: 'cannot receive' });

    assert.equal(ownConfirmedCancel.status, 200);
    assert.equal(ownConfirmedCancel.body.orderStatus, ORDER_STATUSES.CANCELLED);
});

test('customer cannot cancel processing/shipped/delivered/cancelled/refunded/failed orders', async () => {
    const customer = await createUser({ email: uniqueEmail('customer') });
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const product = await createProduct({ owner: admin._id, price: 100, countInStock: 20 });

    const blockedStatuses = [
        ORDER_STATUSES.PROCESSING,
        ORDER_STATUSES.SHIPPED,
        ORDER_STATUSES.DELIVERED,
        ORDER_STATUSES.CANCELLED,
        ORDER_STATUSES.REFUNDED,
        ORDER_STATUSES.FAILED,
    ];

    for (const status of blockedStatuses) {
        const order = await createOrderWithSingleItem({
            user: customer,
            product,
            orderStatus: status,
            paymentStatus: status === ORDER_STATUSES.REFUNDED ? PAYMENT_STATUSES.REFUNDED : PAYMENT_STATUSES.UNPAID,
            stockReduced: [
                ORDER_STATUSES.PROCESSING,
                ORDER_STATUSES.SHIPPED,
                ORDER_STATUSES.DELIVERED,
                ORDER_STATUSES.REFUNDED,
            ].includes(status),
        });

        const res = await request(app)
            .patch(`/api/orders/my/${order._id}/cancel`)
            .set(authHeaderFor(customer._id))
            .send({ reason: `cannot cancel ${status}` });

        assert.equal(res.status, 400);
    }
});

test('pending -> confirmed reduces stock once; confirmed -> cancelled restores stock once; cancelled cannot reduce later', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer') });
    const product = await createProduct({ owner: admin._id, price: 50, countInStock: 5 });

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
            paymentMethod: 'cash_on_delivery',
        });

    assert.equal(placed.status, 201);
    const orderId = placed.body._id;

    const confirm1 = await request(app)
        .patch(`/api/orders/admin/${orderId}/status`)
        .set(authHeaderFor(admin._id))
        .send({ orderStatus: ORDER_STATUSES.CONFIRMED });
    assert.equal(confirm1.status, 200);

    let freshProduct = await Product.findById(product._id).lean();
    assert.equal(freshProduct.countInStock, 3);

    const confirm2 = await request(app)
        .patch(`/api/orders/admin/${orderId}/status`)
        .set(authHeaderFor(admin._id))
        .send({ orderStatus: ORDER_STATUSES.CONFIRMED });
    assert.equal(confirm2.status, 200);

    freshProduct = await Product.findById(product._id).lean();
    assert.equal(freshProduct.countInStock, 3);

    const cancel1 = await request(app)
        .patch(`/api/orders/admin/${orderId}/status`)
        .set(authHeaderFor(admin._id))
        .send({ orderStatus: ORDER_STATUSES.CANCELLED });
    assert.equal(cancel1.status, 200);

    freshProduct = await Product.findById(product._id).lean();
    assert.equal(freshProduct.countInStock, 5);

    const cancel2 = await request(app)
        .patch(`/api/orders/admin/${orderId}/status`)
        .set(authHeaderFor(admin._id))
        .send({ orderStatus: ORDER_STATUSES.CANCELLED });
    assert.equal(cancel2.status, 200);

    freshProduct = await Product.findById(product._id).lean();
    assert.equal(freshProduct.countInStock, 5);

    const invalidReconfirm = await request(app)
        .patch(`/api/orders/admin/${orderId}/status`)
        .set(authHeaderFor(admin._id))
        .send({ orderStatus: ORDER_STATUSES.CONFIRMED });
    assert.equal(invalidReconfirm.status, 400);

    freshProduct = await Product.findById(product._id).lean();
    assert.equal(freshProduct.countInStock, 5);
});

test('invalid order status transitions are rejected', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer') });
    const product = await createProduct({ owner: admin._id, price: 70, countInStock: 10 });

    const order = await createOrderWithSingleItem({ user: customer, product, orderStatus: ORDER_STATUSES.PENDING });

    const res = await request(app)
        .patch(`/api/orders/admin/${order._id}/status`)
        .set(authHeaderFor(admin._id))
        .send({ orderStatus: ORDER_STATUSES.DELIVERED });

    assert.equal(res.status, 400);
});

test('payment status updates remain independent from order status', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer') });
    const product = await createProduct({ owner: admin._id, price: 95, countInStock: 10 });

    const placed = await request(app)
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

    const orderId = placed.body._id;

    const confirm = await request(app)
        .patch(`/api/orders/admin/${orderId}/status`)
        .set(authHeaderFor(admin._id))
        .send({ orderStatus: ORDER_STATUSES.CONFIRMED });

    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.orderStatus, ORDER_STATUSES.CONFIRMED);
    assert.equal(confirm.body.paymentStatus, PAYMENT_STATUSES.UNPAID);

    const pay = await request(app)
        .patch(`/api/orders/admin/${orderId}/payment-status`)
        .set(authHeaderFor(admin._id))
        .send({ paymentStatus: PAYMENT_STATUSES.PAID });

    assert.equal(pay.status, 200);
    assert.equal(pay.body.orderStatus, ORDER_STATUSES.CONFIRMED);
    assert.equal(pay.body.paymentStatus, PAYMENT_STATUSES.PAID);

    const cancel = await request(app)
        .patch(`/api/orders/admin/${orderId}/status`)
        .set(authHeaderFor(admin._id))
        .send({ orderStatus: ORDER_STATUSES.CANCELLED });
    assert.equal(cancel.status, 200);

    const refund = await request(app)
        .patch(`/api/orders/admin/${orderId}/payment-status`)
        .set(authHeaderFor(admin._id))
        .send({ paymentStatus: PAYMENT_STATUSES.REFUNDED });

    assert.equal(refund.status, 200);
    assert.equal(refund.body.orderStatus, ORDER_STATUSES.CANCELLED);
    assert.equal(refund.body.paymentStatus, PAYMENT_STATUSES.REFUNDED);
});

test('admin routes reject non-admin users', async () => {
    const customer = await createUser({ email: uniqueEmail('customer') });

    const ordersRes = await request(app)
        .get('/api/orders/admin')
        .set(authHeaderFor(customer._id));
    assert.equal(ordersRes.status, 403);

    const usersRes = await request(app)
        .get('/api/users/admin')
        .set(authHeaderFor(customer._id));
    assert.equal(usersRes.status, 403);
});

test('role update route rejects non-super-admin users', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer') });

    const res = await request(app)
        .patch(`/api/users/admin/${customer._id}/role`)
        .set(authHeaderFor(admin._id))
        .send({ role: USER_ROLES.ADMIN });

    assert.equal(res.status, 403);
});

test('blocked/deleted users cannot authenticate or access protected routes', async () => {
    const blocked = await createUser({
        email: uniqueEmail('blocked'),
        status: USER_STATUSES.BLOCKED,
    });

    const loginRes = await request(app)
        .post('/api/users/login')
        .send({
            email: blocked.email,
            password: 'password123',
            captchaToken: 'bypass-in-test',
        });

    assert.equal(loginRes.status, 403);

    const deleted = await createUser({
        email: uniqueEmail('deleted'),
        status: USER_STATUSES.DELETED,
        deletedAt: new Date(),
    });

    const protectedRes = await request(app)
        .get('/api/orders/myorders')
        .set(authHeaderFor(deleted._id));

    assert.equal(protectedRes.status, 403);
});

test('last super admin cannot be demoted, blocked, deleted, or changed to non-super-admin', async () => {
    const superAdmin = await createUser({ role: USER_ROLES.SUPER_ADMIN, email: uniqueEmail('sa') });
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });

    const blockRes = await request(app)
        .patch(`/api/users/admin/${superAdmin._id}/status`)
        .set(authHeaderFor(admin._id))
        .send({ status: USER_STATUSES.BLOCKED });
    assert.equal(blockRes.status, 400);

    const deleteRes = await request(app)
        .delete(`/api/users/admin/${superAdmin._id}`)
        .set(authHeaderFor(admin._id))
        .send({ note: 'try delete' });
    assert.equal(deleteRes.status, 400);

    const roleRes = await request(app)
        .patch(`/api/users/admin/${superAdmin._id}/role`)
        .set(authHeaderFor(superAdmin._id))
        .send({ role: USER_ROLES.ADMIN });
    assert.equal(roleRes.status, 400);
});

test('soft-deleted user remains linked to prior orders', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const customer = await createUser({ email: uniqueEmail('customer') });
    const product = await createProduct({ owner: admin._id, price: 150, countInStock: 10 });

    const placed = await request(app)
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
            paymentMethod: 'paypal',
        });

    assert.equal(placed.status, 201);

    const deleteUser = await request(app)
        .delete(`/api/users/admin/${customer._id}`)
        .set(authHeaderFor(admin._id))
        .send({ note: 'cleanup user' });

    assert.equal(deleteUser.status, 200);
    assert.equal(deleteUser.body.status, USER_STATUSES.DELETED);

    const adminOrder = await request(app)
        .get(`/api/orders/admin/${placed.body._id}`)
        .set(authHeaderFor(admin._id));

    assert.equal(adminOrder.status, 200);
    assert.equal(String(adminOrder.body.user._id), String(customer._id));
    assert.equal(adminOrder.body.user.status, USER_STATUSES.DELETED);
});

test('audit logs are created for user status, role, and soft-delete actions', async () => {
    const superAdmin = await createUser({ role: USER_ROLES.SUPER_ADMIN, email: uniqueEmail('super') });
    await createUser({ role: USER_ROLES.SUPER_ADMIN, email: uniqueEmail('super2') });

    const targetForStatus = await createUser({ email: uniqueEmail('status-user') });
    const targetForRole = await createUser({ email: uniqueEmail('role-user') });
    const targetForDelete = await createUser({ email: uniqueEmail('delete-user') });

    const statusRes = await request(app)
        .patch(`/api/users/admin/${targetForStatus._id}/status`)
        .set(authHeaderFor(superAdmin._id))
        .send({ status: USER_STATUSES.SUSPENDED, note: 'policy violation' });
    assert.equal(statusRes.status, 200);

    const roleRes = await request(app)
        .patch(`/api/users/admin/${targetForRole._id}/role`)
        .set(authHeaderFor(superAdmin._id))
        .send({ role: USER_ROLES.ADMIN, note: 'promoted' });
    assert.equal(roleRes.status, 200);

    const deleteRes = await request(app)
        .delete(`/api/users/admin/${targetForDelete._id}`)
        .set(authHeaderFor(superAdmin._id))
        .send({ note: 'soft delete account' });
    assert.equal(deleteRes.status, 200);

    const logs = await AuditLog.find({ actorUser: superAdmin._id }).lean();
    const actions = logs.map((log) => log.action);

    assert.ok(actions.includes(AUDIT_ACTIONS.USER_STATUS_UPDATED));
    assert.ok(actions.includes(AUDIT_ACTIONS.USER_ROLE_UPDATED));
    assert.ok(actions.includes(AUDIT_ACTIONS.USER_SOFT_DELETED));
});
