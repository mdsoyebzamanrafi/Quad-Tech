import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Wishlist from '../models/Wishlist.js';
import Friendship from '../models/Friendship.js';

let replSet;

const authHeaderFor = (userId) => ({
    Authorization: `Bearer ${jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET)}`,
});

const uniqueEmail = (prefix = 'user') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;

const createUser = async ({
    name = 'Test User',
    email = uniqueEmail('user'),
    password = 'password123',
    phone = '+8801000000000',
} = {}) =>
    User.create({
        name,
        email,
        password,
        phone,
    });

const createProduct = async ({
    owner,
    name,
    brand,
    category,
    department = 'fashion',
    price = 3000,
    countInStock = 10,
    colors = ['Pink'],
    styleTags = ['Giftable', 'Elegant'],
    isActive = true,
    isNewArrival = true,
    adminPriorityScore = 10,
    sponsoredWeight = 0,
    isSponsored = false,
    rating = 4.5,
} = {}) =>
    Product.create({
        user: owner,
        name,
        image: '/images/test-product.jpg',
        images: ['/images/test-product-2.jpg'],
        brand,
        category,
        department,
        description: `${name} description`,
        gender: 'Women',
        colors,
        sizes: ['M'],
        material: 'Cotton',
        fit: 'Regular',
        occasion: 'Gift',
        season: 'All Season',
        styleTags,
        productType: category,
        price,
        countInStock,
        numReviews: 14,
        rating,
        isActive,
        isNewArrival,
        adminPriorityScore,
        isSponsored,
        sponsoredWeight,
    });

before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'feature13-test-secret';
    delete process.env.OLLAMA_BASE_URL;

    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
    });

    await mongoose.connect(replSet.getUri(), {
        dbName: 'feature13-tests',
    });
});

after(async () => {
    await mongoose.disconnect();
    await replSet.stop();
});

beforeEach(async () => {
    await Promise.all([
        Wishlist.deleteMany({}),
        Friendship.deleteMany({}),
        Product.deleteMany({}),
        User.deleteMany({}),
    ]);
});

test('POST /api/ai/gift-assistant rejects empty messages', async () => {
    const response = await request(app)
        .post('/api/ai/gift-assistant')
        .send({ message: '   ' });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, 'Message is required');
});

test('POST /api/ai/gift-assistant returns real recommendations and respects diversity limits', async () => {
    const owner = await createUser();

    await Promise.all([
        createProduct({
            owner: owner._id,
            name: 'Rose Gold Gift Watch',
            brand: 'BrandA',
            category: 'Watches',
            colors: ['Pink', 'Gold'],
            styleTags: ['Giftable', 'Elegant', 'Premium'],
            adminPriorityScore: 15,
        }),
        createProduct({
            owner: owner._id,
            name: 'Blush Evening Bag',
            brand: 'BrandA',
            category: 'Bags',
            colors: ['Pink', 'White'],
            styleTags: ['Giftable', 'Elegant', 'Romantic'],
            adminPriorityScore: 12,
        }),
        createProduct({
            owner: owner._id,
            name: 'Romantic Satin Dress',
            brand: 'BrandB',
            category: 'Dresses',
            colors: ['Red', 'Pink'],
            styleTags: ['Giftable', 'Elegant', 'Romantic'],
            adminPriorityScore: 11,
        }),
        createProduct({
            owner: owner._id,
            name: 'Classic Bracelet Watch',
            brand: 'BrandC',
            category: 'Watches',
            colors: ['White', 'Silver'],
            styleTags: ['Giftable', 'Classic', 'Premium'],
            adminPriorityScore: 10,
        }),
        createProduct({
            owner: owner._id,
            name: 'Pearl Accent Accessory Set',
            brand: 'BrandD',
            category: 'Accessories',
            colors: ['White', 'Silver'],
            styleTags: ['Giftable', 'Premium', 'Elegant'],
            adminPriorityScore: 9,
        }),
        createProduct({
            owner: owner._id,
            name: 'Velvet Mini Bag',
            brand: 'BrandE',
            category: 'Bags',
            colors: ['Maroon', 'Gold'],
            styleTags: ['Giftable', 'Elegant', 'Premium'],
            adminPriorityScore: 8,
        }),
        createProduct({
            owner: owner._id,
            name: 'Rose Gold Gift Watch',
            brand: 'BrandF',
            category: 'Watches',
            colors: ['Pink', 'Gold'],
            styleTags: ['Giftable', 'Elegant', 'Premium'],
            adminPriorityScore: 16,
        }),
        createProduct({
            owner: owner._id,
            name: 'Inactive Premium Bag',
            brand: 'BrandZ',
            category: 'Bags',
            colors: ['Pink'],
            styleTags: ['Giftable', 'Premium'],
            isActive: false,
            adminPriorityScore: 20,
        }),
        createProduct({
            owner: owner._id,
            name: 'Out Of Stock Anniversary Watch',
            brand: 'BrandY',
            category: 'Watches',
            colors: ['Pink', 'Gold'],
            styleTags: ['Giftable', 'Elegant'],
            countInStock: 0,
            adminPriorityScore: 20,
        }),
    ]);

    const response = await request(app)
        .post('/api/ai/gift-assistant')
        .send({
            message: 'I want to buy a gift for my girlfriend under 5000',
        });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.giftContext.recipientType, 'girlfriend');
    assert.equal(response.body.giftContext.budgetMax, 5000);
    assert.equal(response.body.recommendations.length, 5);
    assert.equal(typeof response.body.reply, 'string');
    assert.ok(response.body.reply.length > 0);

    const recommendations = response.body.recommendations;
    const names = recommendations.map((recommendation) => recommendation.product.name);
    const uniqueNames = new Set(names);

    assert.equal(uniqueNames.size, names.length);
    assert.ok(!names.includes('Inactive Premium Bag'));
    assert.ok(!names.includes('Out Of Stock Anniversary Watch'));

    recommendations.forEach((recommendation) => {
        assert.equal(typeof recommendation.giftScore, 'number');
        assert.ok(Array.isArray(recommendation.reasons));
        assert.ok(recommendation.reasons.length >= 1);
        assert.equal(typeof recommendation.scoreBreakdown, 'object');
        assert.equal(typeof recommendation.product, 'object');
        assert.equal(typeof recommendation.product.name, 'string');
        assert.equal(typeof recommendation.product.category, 'string');
        assert.equal(typeof recommendation.product.brand, 'string');
    });

    const categoryCounts = recommendations.reduce((counts, recommendation) => {
        const key = recommendation.product.category.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
        return counts;
    }, new Map());

    const brandCounts = recommendations.reduce((counts, recommendation) => {
        const key = recommendation.product.brand.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
        return counts;
    }, new Map());

    categoryCounts.forEach((count) => {
        assert.ok(count <= 2);
    });

    brandCounts.forEach((count) => {
        assert.ok(count <= 2);
    });
});

test('POST /api/ai/gift-assistant/friend rejects unauthenticated requests', async () => {
    const response = await request(app)
        .post('/api/ai/gift-assistant/friend')
        .send({
            message: 'Gift for my friend under 5000',
            friendIdentifier: 'friend@example.com',
        });

    assert.equal(response.status, 401);
    assert.equal(response.body.message, 'Not authorized, no token');
});

test('POST /api/ai/gift-assistant/friend requires friendIdentifier', async () => {
    const user = await createUser();

    const response = await request(app)
        .post('/api/ai/gift-assistant/friend')
        .set(authHeaderFor(user._id))
        .send({
            message: 'Gift for my friend under 5000',
        });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, 'Friend email or username is required');
});

test('POST /api/ai/gift-assistant/friend rejects non-friends', async () => {
    const requester = await createUser({ email: uniqueEmail('requester') });
    const stranger = await createUser({ email: uniqueEmail('stranger') });

    const response = await request(app)
        .post('/api/ai/gift-assistant/friend')
        .set(authHeaderFor(requester._id))
        .send({
            message: 'Gift for my friend under 5000',
            friendIdentifier: stranger.email,
        });

    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);
    assert.equal(
        response.body.message,
        'You can only use wishlist gift recommendations for accepted friends'
    );
});

test('POST /api/ai/gift-assistant/friend supports exact full-name lookup and rejects partial names', async () => {
    const requester = await createUser({ email: uniqueEmail('requester') });
    const friend = await createUser({
        name: 'Mir Abrar',
        email: uniqueEmail('friend-name'),
    });

    await Friendship.create({
        requester: requester._id,
        recipient: friend._id,
        status: 'accepted',
    });

    await Wishlist.create({
        user: friend._id,
        items: [],
    });

    const exactNameResponse = await request(app)
        .post('/api/ai/gift-assistant/friend')
        .set(authHeaderFor(requester._id))
        .send({
            message: 'Gift for my friend under 5000',
            friendIdentifier: 'Mir Abrar',
        });

    assert.equal(exactNameResponse.status, 200);
    assert.equal(exactNameResponse.body.success, true);
    assert.equal(exactNameResponse.body.wishlistContext.friend.name, 'Mir Abrar');

    const partialNameResponse = await request(app)
        .post('/api/ai/gift-assistant/friend')
        .set(authHeaderFor(requester._id))
        .send({
            message: 'Gift for my friend under 5000',
            friendIdentifier: 'Mir',
        });

    assert.equal(partialNameResponse.status, 404);
    assert.equal(partialNameResponse.body.success, false);
    assert.equal(partialNameResponse.body.message, 'Friend not found');
});

test('POST /api/ai/gift-assistant/friend returns wishlist-first recommendations for accepted friends', async () => {
    const requester = await createUser({ email: uniqueEmail('requester') });
    const friend = await createUser({
        name: 'Mir Abrar',
        email: uniqueEmail('friend'),
    });

    await Friendship.create({
        requester: requester._id,
        recipient: friend._id,
        status: 'accepted',
    });

    const wishlistProducts = await Promise.all([
        createProduct({
            owner: requester._id,
            name: 'Wishlist Gold Watch',
            brand: 'WishBrand',
            category: 'Watches',
            colors: ['Gold', 'White'],
            styleTags: ['Giftable', 'Premium', 'Elegant'],
            price: 4200,
        }),
        createProduct({
            owner: requester._id,
            name: 'Wishlist Pearl Bag',
            brand: 'WishBrand2',
            category: 'Bags',
            colors: ['Pink', 'White'],
            styleTags: ['Giftable', 'Elegant', 'Romantic'],
            price: 3800,
        }),
        createProduct({
            owner: requester._id,
            name: 'Wishlist Accent Dress',
            brand: 'WishBrand3',
            category: 'Dresses',
            colors: ['Red', 'Pink'],
            styleTags: ['Giftable', 'Elegant', 'Premium'],
            price: 4600,
        }),
    ]);

    await Promise.all([
        createProduct({
            owner: requester._id,
            name: 'Similar Evening Watch',
            brand: 'WishBrand4',
            category: 'Watches',
            colors: ['White', 'Silver'],
            styleTags: ['Giftable', 'Classic', 'Premium'],
            price: 3990,
        }),
        createProduct({
            owner: requester._id,
            name: 'Catalog Rose Accessory Set',
            brand: 'WishBrand5',
            category: 'Accessories',
            colors: ['Pink', 'Gold'],
            styleTags: ['Giftable', 'Premium'],
            price: 2900,
        }),
    ]);

    await Wishlist.create({
        user: friend._id,
        items: wishlistProducts.map((product) => ({ product: product._id })),
    });

    const response = await request(app)
        .post('/api/ai/gift-assistant/friend')
        .set(authHeaderFor(requester._id))
        .send({
            message: 'I want to buy a gift for my friend under 5000',
            friendIdentifier: 'Mir Abrar',
        });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.wishlistContext.friend.email, friend.email);
    assert.equal(response.body.wishlistContext.usedWishlist, true);
    assert.ok(response.body.wishlistContext.selectedWishlistProductCount >= 1);
    assert.ok(Array.isArray(response.body.recommendations));
    assert.ok(response.body.recommendations.length > 0);
    assert.ok(
        response.body.recommendations.every((recommendation) =>
            ['friend_wishlist', 'similar_to_wishlist', 'general_catalog'].includes(
                recommendation.recommendationSource
            )
        )
    );
    assert.ok(
        response.body.recommendations.some(
            (recommendation) => recommendation.recommendationSource === 'friend_wishlist'
        )
    );
    assert.ok(!JSON.stringify(response.body).includes('"thinking"'));
});

test('GET /api/friends/:friendId/wishlist is blocked for privacy', async () => {
    const requester = await createUser({ email: uniqueEmail('requester') });
    const friend = await createUser({
        name: 'Wishlist Friend',
        email: uniqueEmail('friend-private'),
    });

    await Friendship.create({
        requester: requester._id,
        recipient: friend._id,
        status: 'accepted',
    });

    await Wishlist.create({
        user: friend._id,
        items: [],
    });

    const response = await request(app)
        .get(`/api/friends/${friend._id}/wishlist`)
        .set(authHeaderFor(requester._id));

    assert.equal(response.status, 403);
    assert.equal(
        response.body.message,
        'Friend wishlists are private and only used for gift recommendations.'
    );
});

test('POST /api/ai/gift-assistant/friend falls back to general recommendations when wishlist is empty', async () => {
    const requester = await createUser({ email: uniqueEmail('requester') });
    const friend = await createUser({ email: uniqueEmail('friend-empty') });

    await Friendship.create({
        requester: requester._id,
        recipient: friend._id,
        status: 'accepted',
    });

    await Promise.all([
        createProduct({
            owner: requester._id,
            name: 'Fallback Smart Watch',
            brand: 'CatalogA',
            category: 'Watches',
            colors: ['Black', 'Silver'],
            styleTags: ['Giftable', 'Premium'],
            price: 3400,
        }),
        createProduct({
            owner: requester._id,
            name: 'Fallback Casual Bag',
            brand: 'CatalogB',
            category: 'Bags',
            colors: ['Blue', 'White'],
            styleTags: ['Giftable', 'Practical'],
            price: 2400,
        }),
    ]);

    const response = await request(app)
        .post('/api/ai/gift-assistant/friend')
        .set(authHeaderFor(requester._id))
        .send({
            message: 'Birthday gift for my friend under 5000',
            friendIdentifier: friend.email,
        });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.wishlistContext.usedWishlist, false);
    assert.equal(response.body.wishlistContext.reason, 'empty_wishlist');
    assert.equal(response.body.wishlistContext.wishlistProductCount, 0);
    assert.ok(Array.isArray(response.body.recommendations));
    assert.ok(response.body.recommendations.length > 0);
    assert.ok(!JSON.stringify(response.body).includes('"thinking"'));
});
