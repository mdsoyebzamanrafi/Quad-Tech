import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { USER_ROLES, USER_STATUSES } from '../constants/domainConstants.js';

let replSet;

const authHeaderFor = (userId) => ({
    Authorization: `Bearer ${jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET)}`,
});

const uniqueEmail = (prefix = 'user') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;

const createUser = async ({
    name = 'Test User',
    email = uniqueEmail('user'),
    password = 'password123',
    role = USER_ROLES.CUSTOMER,
    status = USER_STATUSES.ACTIVE,
    isVerified = true,
    phone = '+8801000000000',
} = {}) => {
    return User.create({
        name,
        email,
        password,
        role,
        status,
        isVerified,
        phone,
    });
};

const createProduct = async ({
    owner,
    name = `Product-${Math.random().toString(36).slice(2, 8)}`,
    price = 100,
    countInStock = 20,
    isActive = true,
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
        isActive,
    });
};

before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'feature6-test-secret';

    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
    });

    await mongoose.connect(replSet.getUri(), {
        dbName: 'feature6-tests',
    });
});

after(async () => {
    await mongoose.disconnect();
    await replSet.stop();
});

beforeEach(async () => {
    await Promise.all([Product.deleteMany({}), User.deleteMany({})]);
});

test('admin can create product and isActive defaults to true', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });

    const res = await request(app)
        .post('/api/products')
        .set(authHeaderFor(admin._id))
        .send({
            name: 'Black Hoodie',
            price: 1200,
            image: '/images/hoodie.jpg',
            brand: 'Nike',
            category: 'Hoodies',
            countInStock: 10,
            description: 'Comfortable black hoodie',
        });

    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Black Hoodie');
    assert.equal(res.body.isActive, true);

    const freshProduct = await Product.findById(res.body._id).lean();
    assert.equal(String(freshProduct.user), String(admin._id));
    assert.equal(freshProduct.isActive, true);
});

test('customer cannot create product', async () => {
    const customer = await createUser({ email: uniqueEmail('customer') });

    const res = await request(app)
        .post('/api/products')
        .set(authHeaderFor(customer._id))
        .send({
            name: 'Black Hoodie',
            price: 1200,
            image: '/images/hoodie.jpg',
            brand: 'Nike',
            category: 'Hoodies',
            countInStock: 10,
            description: 'Comfortable black hoodie',
        });

    assert.equal(res.status, 403);
});

test('admin can update product and keep valid 0 and false values', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const product = await createProduct({ owner: admin._id, countInStock: 8, isActive: true });

    const res = await request(app)
        .put(`/api/products/${product._id}`)
        .set(authHeaderFor(admin._id))
        .send({
            name: 'Updated Product',
            countInStock: 0,
            isActive: false,
        });

    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Updated Product');
    assert.equal(res.body.countInStock, 0);
    assert.equal(res.body.isActive, false);

    const freshProduct = await Product.findById(product._id).lean();
    assert.equal(freshProduct.countInStock, 0);
    assert.equal(freshProduct.isActive, false);
});

test('admin product update repairs legacy products missing user', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const { insertedId } = await Product.collection.insertOne({
        name: 'Legacy Product',
        image: '/images/legacy.jpg',
        images: ['/images/legacy.jpg'],
        brand: 'BrandX',
        category: 'CategoryY',
        description: 'Legacy product without owner',
        price: 250,
        countInStock: 4,
        numReviews: 0,
        rating: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    const res = await request(app)
        .put(`/api/products/${insertedId}`)
        .set(authHeaderFor(admin._id))
        .send({
            name: 'Recovered Legacy Product',
        });

    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Recovered Legacy Product');
    assert.equal(String(res.body.user), String(admin._id));

    const freshProduct = await Product.findById(insertedId).lean();
    assert.equal(String(freshProduct.user), String(admin._id));
});

test('admin can update stock and stock endpoint allows zero', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const product = await createProduct({ owner: admin._id, countInStock: 9 });

    const res = await request(app)
        .patch(`/api/products/admin/${product._id}/stock`)
        .set(authHeaderFor(admin._id))
        .send({ countInStock: 0 });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Stock updated');
    assert.equal(res.body.product.countInStock, 0);
});

test('stock endpoint rejects negative and decimal values', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const product = await createProduct({ owner: admin._id, countInStock: 9 });

    const negativeRes = await request(app)
        .patch(`/api/products/admin/${product._id}/stock`)
        .set(authHeaderFor(admin._id))
        .send({ countInStock: -1 });

    assert.equal(negativeRes.status, 400);

    const decimalRes = await request(app)
        .patch(`/api/products/admin/${product._id}/stock`)
        .set(authHeaderFor(admin._id))
        .send({ countInStock: 2.5 });

    assert.equal(decimalRes.status, 400);
});

test('public APIs hide inactive products but admin can still fetch them', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    const activeProduct = await createProduct({ owner: admin._id, name: 'Active Product', isActive: true });
    const inactiveProduct = await createProduct({ owner: admin._id, name: 'Inactive Product', isActive: false });
    const legacyProduct = await createProduct({ owner: admin._id, name: 'Legacy Product', isActive: true });

    await Product.updateOne({ _id: legacyProduct._id }, { $unset: { isActive: 1 } });

    const listRes = await request(app).get('/api/products');
    assert.equal(listRes.status, 200);
    const listIds = listRes.body.products.map((product) => String(product._id));
    assert.ok(listIds.includes(String(activeProduct._id)));
    assert.ok(listIds.includes(String(legacyProduct._id)));
    assert.ok(!listIds.includes(String(inactiveProduct._id)));

    const inactivePublicRes = await request(app).get(`/api/products/${inactiveProduct._id}`);
    assert.equal(inactivePublicRes.status, 404);

    const legacyPublicRes = await request(app).get(`/api/products/${legacyProduct._id}`);
    assert.equal(legacyPublicRes.status, 200);

    const suggestionsRes = await request(app).get('/api/products/search/suggestions?q=Product');
    assert.equal(suggestionsRes.status, 200);
    assert.ok(!suggestionsRes.body.includes('Inactive Product'));

    const adminDetailRes = await request(app)
        .get(`/api/products/admin/${inactiveProduct._id}`)
        .set(authHeaderFor(admin._id));

    assert.equal(adminDetailRes.status, 200);
    assert.equal(String(adminDetailRes.body._id), String(inactiveProduct._id));
});

test('admin product list supports pagination, keyword, active, and stock filters', async () => {
    const admin = await createUser({ role: USER_ROLES.ADMIN, email: uniqueEmail('admin') });
    await createProduct({ owner: admin._id, name: 'Blue Shirt', countInStock: 7, isActive: true });
    await createProduct({ owner: admin._id, name: 'Red Shirt', countInStock: 3, isActive: true });
    await createProduct({ owner: admin._id, name: 'Green Pants', countInStock: 0, isActive: false });

    const res = await request(app)
        .get('/api/products/admin?keyword=shirt&isActive=true&stockStatus=low_stock&limit=5&pageNumber=1')
        .set(authHeaderFor(admin._id));

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.pages, 1);
    assert.equal(res.body.products.length, 1);
    assert.equal(res.body.products[0].name, 'Red Shirt');
});
