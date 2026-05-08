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
const nativeFetch = global.fetch;

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
} = {}) =>
    User.create({
        name,
        email,
        password,
        role,
        status,
        isVerified,
        phone,
    });

const createFashionProduct = async ({
    owner,
    name,
    brand = 'Style House',
    category = 'Dresses',
    productType = 'dress',
    colors = ['Black'],
    material = 'Cotton',
    fit = 'Regular',
    occasion = 'Casual',
    season = 'Summer',
    styleTags = ['casual'],
    gender = 'women',
    price = 999,
} = {}) =>
    Product.create({
        user: owner,
        name,
        image: '/images/fashion.jpg',
        brand,
        category,
        department: 'fashion',
        description: `Test product for ${name}`,
        gender,
        colors,
        sizes: ['M'],
        material,
        fit,
        occasion,
        season,
        styleTags,
        productType,
        price,
        countInStock: 10,
        numReviews: 0,
        rating: 4.5,
        isActive: true,
    });

const makeFetchResponse = (body, { ok = true, status = 200, statusText = 'OK' } = {}) => ({
    ok,
    status,
    statusText,
    text: async () => JSON.stringify(body),
});

before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'feature17-test-secret';
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'feature17-gemini-key';
    process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
    });

    await mongoose.connect(replSet.getUri(), {
        dbName: 'feature17-tests',
    });
});

after(async () => {
    global.fetch = nativeFetch;
    await mongoose.disconnect();
    if (replSet) {
        await replSet.stop();
    }
});

beforeEach(async () => {
    global.fetch = nativeFetch;
    await Promise.all([Product.deleteMany({}), User.deleteMany({})]);
});

test('POST /api/recommendations/image-search rejects missing image', async () => {
    const response = await request(app).post('/api/recommendations/image-search');

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, 'Image is required for image search.');
});

test('POST /api/recommendations/image-search rejects non-image uploads', async () => {
    const response = await request(app)
        .post('/api/recommendations/image-search')
        .attach('image', Buffer.from('not-an-image'), {
            filename: 'notes.txt',
            contentType: 'text/plain',
        });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, 'Only JPEG, PNG, or WebP images are allowed.');
});

test('POST /api/recommendations/image-search returns similar fashion products for guest users', async () => {
    const owner = await createUser({ email: uniqueEmail('owner') });
    await createFashionProduct({
        owner: owner._id,
        name: 'Black Cotton Summer Dress',
        styleTags: ['casual', 'minimal'],
    });
    await createFashionProduct({
        owner: owner._id,
        name: 'White Running Sneaker',
        category: 'Shoes',
        productType: 'sneaker',
        colors: ['White'],
        material: 'Mesh',
        occasion: 'Sports',
        gender: 'men',
    });

    global.fetch = async (url) => {
        assert.match(String(url), /generativelanguage\.googleapis\.com/);

        return makeFetchResponse({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                text: JSON.stringify({
                                    department: 'fashion',
                                    category: 'Dresses',
                                    productType: 'dress',
                                    brand: null,
                                    gender: 'women',
                                    requestedColors: ['Black'],
                                    requestedSizes: [],
                                    requestedMaterials: ['Cotton'],
                                    fit: 'Regular',
                                    occasion: 'Casual',
                                    season: 'Summer',
                                    styleTags: ['casual', 'minimal'],
                                    sortBy: 'recommended',
                                    confidence: 0.91,
                                }),
                            },
                        ],
                    },
                },
            ],
        });
    };

    const response = await request(app)
        .post('/api/recommendations/image-search')
        .attach('image', Buffer.from('fake-image-bytes'), {
            filename: 'dress.jpg',
            contentType: 'image/jpeg',
        });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.intent.category, 'Dresses');
    assert.equal(response.body.intent.productType, 'dress');
    assert.deepEqual(response.body.intent.requestedColors, ['Black']);
    assert.equal(response.body.fallbackUsed, false);
    assert.equal(response.body.contextSummary && Object.keys(response.body.contextSummary).length, 0);
    assert.ok(Array.isArray(response.body.products));
    assert.equal(response.body.products[0].name, 'Black Cotton Summer Dress');
});

test('POST /api/recommendations/prompt still returns results after shared search refactor', async () => {
    const owner = await createUser({ email: uniqueEmail('owner') });
    const shopper = await createUser({ email: uniqueEmail('shopper') });

    await createFashionProduct({
        owner: owner._id,
        name: 'Casual Cotton Dress',
        styleTags: ['casual'],
    });

    global.fetch = async (url) => {
        if (String(url).includes('/api/generate')) {
            return makeFetchResponse({
                response: JSON.stringify({
                    department: 'fashion',
                    category: 'Dresses',
                    productType: 'dress',
                    brand: null,
                    gender: 'women',
                    minPrice: null,
                    maxPrice: null,
                    requestedColors: ['Black'],
                    requestedSizes: [],
                    requestedMaterials: ['Cotton'],
                    fit: 'Regular',
                    occasion: 'Casual',
                    season: 'Summer',
                    styleTags: ['casual'],
                    sortBy: 'recommended',
                    confidence: 0.82,
                }),
            });
        }

        throw new Error(`Unexpected fetch URL in test: ${url}`);
    };

    const response = await request(app)
        .post('/api/recommendations/prompt')
        .set(authHeaderFor(shopper._id))
        .send({ prompt: 'Find me a black casual cotton dress' });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.intent.category, 'Dresses');
    assert.ok(Array.isArray(response.body.products));
    assert.equal(response.body.products[0].name, 'Casual Cotton Dress');
});
