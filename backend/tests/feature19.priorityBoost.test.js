import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import Cart from '../models/Cart.js';
import CloudClosetItem from '../models/CloudClosetItem.js';
import Friendship from '../models/Friendship.js';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import PriorityBoost from '../models/PriorityBoost.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Wishlist from '../models/Wishlist.js';
import { USER_ROLES } from '../constants/domainConstants.js';
import {
    calculatePaidBoostForProduct,
    createPriorityBoost,
    getActiveBoostMapForProducts,
    getActiveBoostedProductsForRelevantCategories,
} from '../services/priorityBoostService.js';
import { getPersonalRecommendations } from '../services/personalRecommendationService.js';
import { getGiftAssistantRecommendations } from '../services/giftAssistantService.js';
import { getFriendWishlistGiftRecommendations } from '../services/friendWishlistGiftService.js';

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
    phone = '+8801000000000',
} = {}) =>
    User.create({
        name,
        email,
        password,
        role,
        phone,
    });

const createProduct = async ({
    owner,
    name = `Product-${Math.random().toString(36).slice(2, 8)}`,
    brand = 'BrandX',
    category = 'Watches',
    department = 'fashion',
    description,
    price = 3000,
    countInStock = 10,
    rating = 4.4,
    styleTags = ['Giftable', 'Premium'],
    colors = ['Black'],
    isActive = true,
    isNewArrival = false,
    adminPriorityScore = 8,
    sponsoredWeight = 0,
    isSponsored = false,
    createdAt = undefined,
} = {}) => {
    const product = new Product({
        user: owner,
        name,
        image: '/images/test-product.jpg',
        images: ['/images/test-product-2.jpg'],
        brand,
        category,
        department,
        description: description || `${name} description`,
        gender: department === 'fashion' ? 'Women' : 'Unisex',
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
        numReviews: 10,
        rating,
        isActive,
        isNewArrival,
        adminPriorityScore,
        isSponsored,
        sponsoredWeight,
    });

    if (createdAt) {
        product.createdAt = createdAt;
    }

    return product.save();
};

const createWishlist = async (userId, productIds = []) =>
    Wishlist.create({
        user: userId,
        items: productIds.map((productId) => ({ product: productId })),
    });

const createCloudClosetItem = async ({
    userId,
    originalFilename = `closet-${Math.random().toString(36).slice(2, 8)}.jpg`,
    attributes = {},
} = {}) =>
    CloudClosetItem.create({
        user: userId,
        imageUrl: '/images/cloud-closet-test.jpg',
        cloudinaryPublicId: `cloud-closet-${Math.random().toString(36).slice(2, 8)}`,
        originalFilename,
        analysisStatus: 'completed',
        attributes: {
            department: 'fashion',
            category: 'T-Shirts',
            productType: 'T-Shirts',
            colors: ['Yellow', 'Black'],
            material: 'Cotton',
            fit: 'Regular',
            occasion: 'Casual',
            season: 'Summer',
            styleTags: ['Sporty', 'Casual'],
            ...attributes,
        },
    });

const createAcceptedFriendship = async (requesterId, recipientId) =>
    Friendship.create({
        requester: requesterId,
        recipient: recipientId,
        status: 'accepted',
    });

const createOrderForProduct = async (userId, product, quantity = 1) => {
    const subtotal = Number(product.price) * quantity;
    const order = await Order.create({
        user: userId,
        paymentMethod: 'paypal',
        subtotal,
        grossItemsPrice: subtotal,
        netItemsPrice: subtotal,
        discount: 0,
        totalDiscount: 0,
        tax: 0,
        shippingFee: 0,
        total: subtotal,
        shippingName: 'Test User',
        shippingPhone: '01711111111',
        shippingAddress: 'Road 12',
        shippingCity: 'Dhaka',
        shippingPostalCode: '1207',
        shippingCountry: 'Bangladesh',
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

const createActiveBoost = async ({
    productId,
    createdBy,
    feeAmount = 100,
    placement = 'both',
    durationDays = 7,
} = {}) =>
    createPriorityBoost({
        productId,
        feeAmount,
        placement,
        durationDays,
        createdBy,
    });

const getMapScore = (boostMap, productId) =>
    Number(boostMap[String(productId)]?.paidBoostScore || 0);

const isPromotedRecommendation = (recommendation = {}) =>
    Boolean(recommendation?.isPromoted) ||
    Boolean(recommendation?.product?.isPromoted) ||
    Number(recommendation?.paidBoostScore || recommendation?.product?.paidBoostScore || 0) > 0;

const countPromotedRecommendations = (recommendations = []) =>
    (Array.isArray(recommendations) ? recommendations : []).filter(isPromotedRecommendation).length;

before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'feature19-test-secret';
    delete process.env.OLLAMA_BASE_URL;

    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
    });

    await mongoose.connect(replSet.getUri(), {
        dbName: 'feature19-tests',
    });
});

after(async () => {
    await mongoose.disconnect();
    await replSet.stop();
});

beforeEach(async () => {
    await Promise.all([
        PriorityBoost.deleteMany({}),
        CloudClosetItem.deleteMany({}),
        Cart.deleteMany({}),
        Wishlist.deleteMany({}),
        Friendship.deleteMany({}),
        OrderItem.deleteMany({}),
        Order.deleteMany({}),
        Product.deleteMany({}),
        User.deleteMany({}),
    ]);
});

test('admin priority boost endpoints create, list, detail, summary, and cancel boosts', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const owner = await createUser({ email: uniqueEmail('owner') });
    const product = await createProduct({
        owner: owner._id,
        name: 'Admin Boost Watch',
        category: 'Watches',
    });

    const createResponse = await request(app)
        .post('/api/priority-boosts')
        .set(authHeaderFor(admin._id))
        .send({
            productId: String(product._id),
            feeAmount: 150,
            placement: 'both',
            durationDays: 5,
            note: 'Admin created boost',
        });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.success, true);
    assert.equal(createResponse.body.boost.product.name, 'Admin Boost Watch');

    const boostId = createResponse.body.boost._id;

    const listResponse = await request(app)
        .get('/api/priority-boosts')
        .set(authHeaderFor(admin._id));

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.success, true);
    assert.equal(listResponse.body.count, 1);

    const detailResponse = await request(app)
        .get(`/api/priority-boosts/${boostId}`)
        .set(authHeaderFor(admin._id));

    assert.equal(detailResponse.status, 200);
    assert.equal(detailResponse.body.boost._id, boostId);

    const summaryResponse = await request(app)
        .get('/api/priority-boosts/summary')
        .set(authHeaderFor(admin._id));

    assert.equal(summaryResponse.status, 200);
    assert.equal(summaryResponse.body.success, true);
    assert.equal(summaryResponse.body.summary.totalBoosts, 1);
    assert.equal(summaryResponse.body.summary.activeBoosts, 1);

    const cancelResponse = await request(app)
        .patch(`/api/priority-boosts/${boostId}/cancel`)
        .set(authHeaderFor(admin._id));

    assert.equal(cancelResponse.status, 200);
    assert.equal(cancelResponse.body.success, true);
    assert.equal(cancelResponse.body.boost.status, 'cancelled');
  });

test('priority boost service creates valid boosts and rejects missing or out-of-stock products', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const owner = await createUser({ email: uniqueEmail('owner') });
    const activeProduct = await createProduct({
        owner: owner._id,
        name: 'Active Watch',
        category: 'Watches',
    });
    const outOfStockProduct = await createProduct({
        owner: owner._id,
        name: 'Out Of Stock Watch',
        category: 'Watches',
        countInStock: 0,
    });

    const boost = await createActiveBoost({
        productId: activeProduct._id,
        createdBy: admin._id,
        feeAmount: 120,
        placement: 'personal',
    });

    assert.equal(boost.product.name, 'Active Watch');
    assert.equal(boost.placement, 'personal');

    await assert.rejects(
        () =>
            createActiveBoost({
                productId: new mongoose.Types.ObjectId(),
                createdBy: admin._id,
            }),
        (error) => {
            assert.equal(error.statusCode, 404);
            return true;
        }
    );

    await assert.rejects(
        () =>
            createActiveBoost({
                productId: outOfStockProduct._id,
                createdBy: admin._id,
            }),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.match(error.message, /in-stock/i);
            return true;
        }
    );
});

test('expired and cancelled boosts do not apply to active boost maps', async () => {
    const owner = await createUser({ email: uniqueEmail('owner') });
    const product = await createProduct({
        owner: owner._id,
        name: 'Expired Boost Watch',
        category: 'Watches',
    });
    const now = Date.now();

    await PriorityBoost.create({
        product: product._id,
        seller: owner._id,
        category: product.category,
        feeAmount: 80,
        startsAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        endsAt: new Date(now - 60 * 1000),
        status: 'active',
        paymentStatus: 'paid',
        placement: 'personal',
        createdBy: owner._id,
    });

    await PriorityBoost.create({
        product: product._id,
        seller: owner._id,
        category: product.category,
        feeAmount: 90,
        startsAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        endsAt: new Date(now + 5 * 24 * 60 * 60 * 1000),
        status: 'cancelled',
        paymentStatus: 'paid',
        placement: 'personal',
        createdBy: owner._id,
    });

    const boostMap = await getActiveBoostMapForProducts([product._id], 'personal');
    const expiredBoost = await PriorityBoost.findOne({ product: product._id }).sort({ createdAt: 1 }).lean();

    assert.equal(boostMap[String(product._id)], undefined);
    assert.equal(expiredBoost.status, 'expired');
});

test('priority boosts are normalized by category and filtered by placement', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const owner = await createUser({ email: uniqueEmail('owner') });

    const maxFeeProduct = await createProduct({
        owner: owner._id,
        name: 'Max Fee Watch',
        category: 'Watches',
    });
    const lowerFeeProduct = await createProduct({
        owner: owner._id,
        name: 'Lower Fee Watch',
        category: 'Watches',
    });
    const personalOnlyProduct = await createProduct({
        owner: owner._id,
        name: 'Personal Only Watch',
        category: 'Watches',
    });
    const giftOnlyProduct = await createProduct({
        owner: owner._id,
        name: 'Gift Only Watch',
        category: 'Watches',
    });
    const bothProduct = await createProduct({
        owner: owner._id,
        name: 'Both Watch',
        category: 'Watches',
    });

    await createActiveBoost({
        productId: maxFeeProduct._id,
        createdBy: admin._id,
        feeAmount: 100,
        placement: 'personal',
    });
    await createActiveBoost({
        productId: lowerFeeProduct._id,
        createdBy: admin._id,
        feeAmount: 50,
        placement: 'personal',
    });
    await createActiveBoost({
        productId: personalOnlyProduct._id,
        createdBy: admin._id,
        feeAmount: 40,
        placement: 'personal',
    });
    await createActiveBoost({
        productId: giftOnlyProduct._id,
        createdBy: admin._id,
        feeAmount: 60,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: bothProduct._id,
        createdBy: admin._id,
        feeAmount: 70,
        placement: 'both',
    });

    const personalMap = await getActiveBoostMapForProducts(
        [
            maxFeeProduct._id,
            lowerFeeProduct._id,
            personalOnlyProduct._id,
            giftOnlyProduct._id,
            bothProduct._id,
        ],
        'personal'
    );
    const giftMap = await getActiveBoostMapForProducts(
        [personalOnlyProduct._id, giftOnlyProduct._id, bothProduct._id],
        'gift'
    );

    assert.equal(Number(getMapScore(personalMap, maxFeeProduct._id).toFixed(2)), 5);
    assert.equal(Number(getMapScore(personalMap, lowerFeeProduct._id).toFixed(2)), 2.5);
    assert.equal(personalMap[String(giftOnlyProduct._id)], undefined);
    assert.equal(giftMap[String(personalOnlyProduct._id)], undefined);
    assert.ok(getMapScore(giftMap, giftOnlyProduct._id) > 0);
    assert.ok(getMapScore(personalMap, bothProduct._id) > 0);
    assert.ok(getMapScore(giftMap, bothProduct._id) > 0);
});

test('relevant boosted gift products are discoverable by normalized category and placement', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const owner = await createUser({ email: uniqueEmail('owner') });

    const bothPlacementProduct = await createProduct({
        owner: owner._id,
        name: 'Boosted Fossil Watch',
        category: 'Watches',
        department: 'fashion',
    });
    const personalOnlyProduct = await createProduct({
        owner: owner._id,
        name: 'Personal Only Fossil Watch',
        category: 'Watches',
        department: 'fashion',
    });
    const unrelatedShoesProduct = await createProduct({
        owner: owner._id,
        name: 'Boosted Running Shoes',
        category: 'Shoes',
        department: 'fashion',
    });

    await createActiveBoost({
        productId: bothPlacementProduct._id,
        createdBy: admin._id,
        feeAmount: 1000,
        placement: 'both',
    });
    await createActiveBoost({
        productId: personalOnlyProduct._id,
        createdBy: admin._id,
        feeAmount: 900,
        placement: 'personal',
    });
    await createActiveBoost({
        productId: unrelatedShoesProduct._id,
        createdBy: admin._id,
        feeAmount: 800,
        placement: 'both',
    });

    const relevantBoostedProducts = await getActiveBoostedProductsForRelevantCategories({
        categories: ['Watch'],
        placement: 'gift',
    });
    const relevantNames = relevantBoostedProducts.map((entry) => entry.product.name);

    assert.ok(relevantNames.includes('Boosted Fossil Watch'));
    assert.ok(!relevantNames.includes('Personal Only Fossil Watch'));
    assert.ok(!relevantNames.includes('Boosted Running Shoes'));

    const fossilEntry = relevantBoostedProducts.find(
        (entry) => entry.product.name === 'Boosted Fossil Watch'
    );

    assert.ok(fossilEntry);
    assert.ok(fossilEntry.paidBoostScore > 0);
});

test('relevant boosted personal products are discoverable by normalized category and placement', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const owner = await createUser({ email: uniqueEmail('owner') });

    const bothPlacementProduct = await createProduct({
        owner: owner._id,
        name: 'Personal Boost Fossil Watch',
        category: 'Watches',
        department: 'fashion',
    });
    const giftOnlyProduct = await createProduct({
        owner: owner._id,
        name: 'Gift Only Fossil Watch',
        category: 'Watches',
        department: 'fashion',
    });
    const unrelatedShoesProduct = await createProduct({
        owner: owner._id,
        name: 'Personal Boost Running Shoes',
        category: 'Shoes',
        department: 'fashion',
    });

    await createActiveBoost({
        productId: bothPlacementProduct._id,
        createdBy: admin._id,
        feeAmount: 1000,
        placement: 'both',
    });
    await createActiveBoost({
        productId: giftOnlyProduct._id,
        createdBy: admin._id,
        feeAmount: 900,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: unrelatedShoesProduct._id,
        createdBy: admin._id,
        feeAmount: 800,
        placement: 'both',
    });

    const relevantBoostedProducts = await getActiveBoostedProductsForRelevantCategories({
        categories: ['Watch'],
        placement: 'personal',
    });
    const relevantNames = relevantBoostedProducts.map((entry) => entry.product.name);

    assert.ok(relevantNames.includes('Personal Boost Fossil Watch'));
    assert.ok(!relevantNames.includes('Gift Only Fossil Watch'));
    assert.ok(!relevantNames.includes('Personal Boost Running Shoes'));
});

test('paid boost eligibility blocks unrelated categories and out-of-stock products', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const owner = await createUser({ email: uniqueEmail('owner') });
    const product = await createProduct({
        owner: owner._id,
        name: 'Eligibility Watch',
        category: 'Watches',
    });

    await createActiveBoost({
        productId: product._id,
        createdBy: admin._id,
        feeAmount: 90,
        placement: 'gift',
    });

    const boostMap = await getActiveBoostMapForProducts([product._id], 'gift');
    const unrelatedContextResult = calculatePaidBoostForProduct({
        product,
        boostMap,
        options: {
            context: {
                preferredCategories: ['Laptops'],
                relationshipCategories: ['Laptops'],
                occasionCategories: ['Laptops'],
            },
            mode: 'gift',
            organicScore: 85,
        },
    });

    assert.equal(unrelatedContextResult.paidBoostScore, 0);

    await Product.findByIdAndUpdate(product._id, { countInStock: 0 });
    const outOfStockProduct = await Product.findById(product._id).lean();
    const outOfStockResult = calculatePaidBoostForProduct({
        product: outOfStockProduct,
        boostMap,
        options: {
            context: {
                preferredCategories: ['Watches'],
                relationshipCategories: ['Watches'],
            },
            mode: 'gift',
            organicScore: 85,
        },
    });

    assert.equal(outOfStockResult.paidBoostScore, 0);
});

test('personal recommendations expose paid boost separately and keep exact wishlist matches ahead of boosted products', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const customer = await createUser({ email: uniqueEmail('customer') });
    const owner = await createUser({ email: uniqueEmail('owner') });

    const wishlistExactProduct = await createProduct({
        owner: owner._id,
        name: 'Wishlist Gold Watch',
        category: 'Watches',
        brand: 'WishBrand',
        styleTags: ['Giftable', 'Premium', 'Elegant'],
        colors: ['Gold', 'Black'],
        adminPriorityScore: 4,
    });
    const boostedRelevantProduct = await createProduct({
        owner: owner._id,
        name: 'Boosted Silver Watch',
        category: 'Watches',
        brand: 'BoostBrand',
        styleTags: ['Giftable', 'Classic'],
        colors: ['Silver', 'Black'],
        adminPriorityScore: 3,
    });
    const unrelatedBoostedProduct = await createProduct({
        owner: owner._id,
        name: 'Boosted Laptop Bag',
        category: 'Bags',
        brand: 'BagBrand',
        styleTags: ['Practical'],
        colors: ['Blue'],
        adminPriorityScore: 3,
    });

    await createWishlist(customer._id, [wishlistExactProduct._id]);
    await createActiveBoost({
        productId: boostedRelevantProduct._id,
        createdBy: admin._id,
        feeAmount: 100,
        placement: 'personal',
    });
    await createActiveBoost({
        productId: unrelatedBoostedProduct._id,
        createdBy: admin._id,
        feeAmount: 80,
        placement: 'personal',
    });

    const result = await getPersonalRecommendations(customer._id);
    const wishlistRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Wishlist Gold Watch'
    );
    const boostedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Boosted Silver Watch'
    );
    const unrelatedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Boosted Laptop Bag'
    );

    assert.ok(wishlistRecommendation);
    assert.ok(boostedRecommendation);
    assert.ok(unrelatedRecommendation);
    assert.ok(boostedRecommendation.paidBoostScore > 0);
    assert.equal(
        boostedRecommendation.scoreBreakdown.paidBoostScore,
        boostedRecommendation.paidBoostScore
    );
    assert.ok(boostedRecommendation.finalScore > boostedRecommendation.organicScore);
    assert.equal(boostedRecommendation.product.isPromoted, true);
    assert.equal(boostedRecommendation.product.promotionLabel, 'Promoted');
    assert.equal(boostedRecommendation.isPromoted, true);
    assert.equal(unrelatedRecommendation.paidBoostScore, 0);

    const recommendationNames = result.recommendations.map(
        (recommendation) => recommendation.product.name
    );

    assert.ok(
        recommendationNames.indexOf('Wishlist Gold Watch') <
            recommendationNames.indexOf('Boosted Silver Watch')
    );
});

test('personal recommendations include relevant boosted watch products without displacing stronger wishlist items', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const customer = await createUser({ email: uniqueEmail('customer') });
    const owner = await createUser({ email: uniqueEmail('owner') });

    const wishlistWatch = await createProduct({
        owner: owner._id,
        name: 'Cartier tank watch',
        category: 'Watch',
        department: 'fashion',
        brand: 'Tissot',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['Gold', 'Brown'],
        price: 4800,
        adminPriorityScore: 6,
    });
    const supportingOrganicWatch = await createProduct({
        owner: owner._id,
        name: 'Yellow Classic Dial Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'ClassicTime',
        styleTags: ['Giftable', 'Classic', 'Premium'],
        colors: ['Yellow', 'Black'],
        price: 4200,
        adminPriorityScore: 5,
    });
    const boostedWatch = await createProduct({
        owner: owner._id,
        name: 'Fossil watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Fossil',
        styleTags: ['Giftable', 'Classic', 'Premium'],
        colors: ['Black', 'Silver'],
        price: 4300,
        adminPriorityScore: 4,
    });
    const relevantBag = await createProduct({
        owner: owner._id,
        name: 'Structured Fashion Bag',
        category: 'Bags',
        department: 'fashion',
        brand: 'BagBrand',
        styleTags: ['Giftable', 'Elegant'],
        colors: ['Black'],
        price: 2800,
        adminPriorityScore: 4,
    });
    const relevantDress = await createProduct({
        owner: owner._id,
        name: 'Occasion Dress',
        category: 'Dresses',
        department: 'fashion',
        brand: 'DressBrand',
        styleTags: ['Giftable', 'Elegant'],
        colors: ['Red'],
        price: 3200,
        adminPriorityScore: 4,
    });
    const relevantAccessory = await createProduct({
        owner: owner._id,
        name: 'Premium Accessory Set',
        category: 'Accessories',
        department: 'fashion',
        brand: 'AccessoryBrand',
        styleTags: ['Giftable', 'Premium'],
        colors: ['White'],
        price: 2600,
        adminPriorityScore: 4,
    });
    const unrelatedBoostedShoes = await createProduct({
        owner: owner._id,
        name: 'Boosted shoes',
        category: 'Shoes',
        department: 'fashion',
        brand: 'ShoeBrand',
        styleTags: ['Practical'],
        colors: ['White'],
        price: 2600,
        adminPriorityScore: 3,
    });

    await createWishlist(customer._id, [wishlistWatch._id]);
    await createActiveBoost({
        productId: boostedWatch._id,
        createdBy: admin._id,
        feeAmount: 1000,
        placement: 'both',
    });
    await createActiveBoost({
        productId: unrelatedBoostedShoes._id,
        createdBy: admin._id,
        feeAmount: 900,
        placement: 'both',
    });

    const result = await getPersonalRecommendations(customer._id);
    const recommendationNames = result.recommendations.map(
        (recommendation) => recommendation.product.name
    );
    const wishlistRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Cartier tank watch'
    );
    const boostedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Fossil watch'
    );
    const unrelatedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Boosted shoes'
    );

    assert.ok(wishlistRecommendation, `Missing wishlist recommendation in ${recommendationNames.join(', ')}`);
    assert.ok(boostedRecommendation, `Missing boosted recommendation in ${recommendationNames.join(', ')}`);
    assert.ok(recommendationNames.includes('Yellow Classic Dial Watch'));
    assert.ok(boostedRecommendation.paidBoostScore > 0);
    assert.ok(boostedRecommendation.scoreBreakdown.paidBoostScore > 0);
    assert.equal(boostedRecommendation.isPromoted, true);
    assert.equal(boostedRecommendation.product.isPromoted, true);
    assert.equal(boostedRecommendation.promotionLabel, 'Promoted');
    assert.equal(boostedRecommendation.product.promotionLabel, 'Promoted');
    assert.ok(
        recommendationNames.indexOf('Cartier tank watch') <
            recommendationNames.indexOf('Fossil watch')
    );

    if (unrelatedRecommendation) {
        assert.equal(unrelatedRecommendation.paidBoostScore, 0);
    }
});

test('personal recommendations reserve about 20 percent of final slots for relevant promoted products', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const customer = await createUser({ email: uniqueEmail('customer') });
    const owner = await createUser({ email: uniqueEmail('owner') });

    const wishlistWatch = await createProduct({
        owner: owner._id,
        name: 'Wishlist Signature Watch',
        category: 'Watch',
        department: 'fashion',
        brand: 'Tissot',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['Gold', 'Black'],
        price: 4700,
        adminPriorityScore: 6,
        rating: 4.8,
    });
    const organicWatch = await createProduct({
        owner: owner._id,
        name: 'Organic Classic Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'ClassicTime',
        styleTags: ['Giftable', 'Classic', 'Premium'],
        colors: ['Silver', 'Black'],
        price: 4200,
        adminPriorityScore: 5,
        rating: 4.6,
    });
    const boostedWatchOne = await createProduct({
        owner: owner._id,
        name: 'Fossil Quota Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Fossil',
        styleTags: ['Giftable', 'Classic', 'Premium'],
        colors: ['Black', 'Silver'],
        price: 4300,
        adminPriorityScore: 4,
        rating: 4.3,
    });
    const boostedWatchTwo = await createProduct({
        owner: owner._id,
        name: 'Citizen Quota Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Citizen',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['Brown', 'Gold'],
        price: 4100,
        adminPriorityScore: 4,
        rating: 4.2,
    });
    const boostedWatchThree = await createProduct({
        owner: owner._id,
        name: 'Casio Quota Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Casio',
        styleTags: ['Giftable', 'Classic'],
        colors: ['Blue', 'Silver'],
        price: 3600,
        adminPriorityScore: 3,
        rating: 4.1,
    });
    const fillerBag = await createProduct({
        owner: owner._id,
        name: 'Support Bag',
        category: 'Bags',
        department: 'fashion',
        brand: 'BagBrand',
        styleTags: ['Giftable', 'Elegant'],
        colors: ['Black'],
        price: 2800,
        adminPriorityScore: 4,
    });
    const fillerDress = await createProduct({
        owner: owner._id,
        name: 'Support Dress',
        category: 'Dresses',
        department: 'fashion',
        brand: 'DressBrand',
        styleTags: ['Giftable', 'Elegant'],
        colors: ['Red'],
        price: 3200,
        adminPriorityScore: 4,
    });
    const fillerAccessory = await createProduct({
        owner: owner._id,
        name: 'Support Accessory',
        category: 'Accessories',
        department: 'fashion',
        brand: 'AccessoryBrand',
        styleTags: ['Giftable', 'Premium'],
        colors: ['White'],
        price: 2400,
        adminPriorityScore: 4,
    });
    const fillerHeadphones = await createProduct({
        owner: owner._id,
        name: 'Support Headphones',
        category: 'Audio',
        department: 'electronics',
        brand: 'AudioBrand',
        styleTags: ['Practical'],
        colors: ['Black'],
        price: 3500,
        adminPriorityScore: 3,
    });
    const unrelatedBoostedLaptop = await createProduct({
        owner: owner._id,
        name: 'Unrelated Boosted Laptop',
        category: 'Laptops',
        department: 'electronics',
        brand: 'TechBrand',
        styleTags: ['Practical'],
        colors: ['Black'],
        price: 65000,
        adminPriorityScore: 5,
    });

    await createWishlist(customer._id, [wishlistWatch._id]);
    await createActiveBoost({
        productId: boostedWatchOne._id,
        createdBy: admin._id,
        feeAmount: 1000,
        placement: 'both',
    });
    await createActiveBoost({
        productId: boostedWatchTwo._id,
        createdBy: admin._id,
        feeAmount: 800,
        placement: 'personal',
    });
    await createActiveBoost({
        productId: boostedWatchThree._id,
        createdBy: admin._id,
        feeAmount: 500,
        placement: 'both',
    });
    await createActiveBoost({
        productId: unrelatedBoostedLaptop._id,
        createdBy: admin._id,
        feeAmount: 1200,
        placement: 'both',
    });

    const result = await getPersonalRecommendations(customer._id);
    const recommendationNames = result.recommendations.map(
        (recommendation) => recommendation.product.name
    );
    const promotedRecommendations = result.recommendations.filter(isPromotedRecommendation);
    const unrelatedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Unrelated Boosted Laptop'
    );

    assert.equal(result.recommendations.length, 6);
    assert.ok(
        recommendationNames.includes('Fossil Quota Watch'),
        `Missing highest fee promoted product in ${recommendationNames.join(', ')}`
    );
    assert.ok(
        countPromotedRecommendations(result.recommendations) >= 2,
        `Expected at least 2 promoted recommendations, got ${promotedRecommendations.map((recommendation) => recommendation.product.name).join(', ')}`
    );
    assert.ok(
        recommendationNames.indexOf('Wishlist Signature Watch') <
            recommendationNames.indexOf('Fossil Quota Watch')
    );
    assert.ok(
        promotedRecommendations.every(
            (recommendation) =>
                recommendation.product.category === 'Watches' ||
                recommendation.product.category === 'Watch'
        )
    );

    if (unrelatedRecommendation) {
        assert.equal(unrelatedRecommendation.paidBoostScore, 0);
    }
});

test('personal recommendations include relevant promoted watch quota even when organic watch and cloud-closet caps would otherwise remove it', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const customer = await createUser({ email: uniqueEmail('customer') });
    const owner = await createUser({ email: uniqueEmail('owner') });

    const wishlistWatch = await createProduct({
        owner: owner._id,
        name: 'Cartier tank watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Cartier',
        styleTags: ['Elegant', 'Premium', 'Giftable'],
        colors: ['Gold', 'Brown'],
        material: 'Metal',
        fit: 'Regular',
        occasion: 'Formal',
        season: 'Winter',
        price: 4800,
        rating: 4.8,
        adminPriorityScore: 8,
        isNewArrival: true,
    });
    const organicWatch = await createProduct({
        owner: owner._id,
        name: 'Yellow Classic Dial Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Tissot',
        styleTags: ['Elegant', 'Premium', 'Giftable'],
        colors: ['Yellow', 'Black'],
        material: 'Metal',
        fit: 'Regular',
        occasion: 'Formal',
        season: 'Winter',
        price: 4300,
        rating: 4.6,
        adminPriorityScore: 6,
        isNewArrival: true,
    });
    const teeOne = await createProduct({
        owner: owner._id,
        name: 'Uniqlo Sport Mesh Tee',
        category: 'T-Shirts',
        department: 'fashion',
        brand: 'Uniqlo',
        styleTags: ['Sporty', 'Casual'],
        colors: ['Yellow', 'Black'],
        material: 'Cotton',
        fit: 'Regular',
        occasion: 'Casual',
        season: 'Summer',
        price: 2100,
        rating: 4.3,
        adminPriorityScore: 7,
        isNewArrival: true,
    });
    const teeTwo = await createProduct({
        owner: owner._id,
        name: 'Nike Everyday Crew Tee',
        category: 'T-Shirts',
        department: 'fashion',
        brand: 'Nike',
        styleTags: ['Sporty', 'Casual'],
        colors: ['Yellow', 'Black'],
        material: 'Cotton',
        fit: 'Regular',
        occasion: 'Casual',
        season: 'Summer',
        price: 2200,
        rating: 4.2,
        adminPriorityScore: 7,
        isNewArrival: true,
    });
    const loafers = await createProduct({
        owner: owner._id,
        name: 'Yellow Formal Leather Loafers',
        category: 'Shoes',
        department: 'fashion',
        brand: 'Bata',
        styleTags: ['Formal', 'Premium'],
        colors: ['Yellow', 'Black'],
        material: 'Leather',
        fit: 'Regular',
        occasion: 'Formal',
        season: 'Summer',
        price: 3600,
        rating: 4.1,
        adminPriorityScore: 5,
    });
    const trainers = await createProduct({
        owner: owner._id,
        name: 'Nike Trail Grip Trainers',
        category: 'Shoes',
        department: 'fashion',
        brand: 'Nike',
        styleTags: ['Sporty', 'Premium'],
        colors: ['Yellow', 'Black'],
        material: 'Leather',
        fit: 'Regular',
        occasion: 'Casual',
        season: 'Summer',
        price: 3500,
        rating: 4.0,
        adminPriorityScore: 5,
    });
    const promotedWatch = await createProduct({
        owner: owner._id,
        name: 'Fossil watch',
        category: 'Watches',
        department: 'electronics',
        brand: 'Fossil',
        styleTags: ['Classic', 'Giftable'],
        colors: ['Black', 'Silver'],
        material: 'Metal',
        fit: 'Regular',
        occasion: 'Casual',
        season: 'Summer',
        price: 4100,
        rating: 4.0,
        adminPriorityScore: 0,
    });
    const unrelatedPromotedBeanie = await createProduct({
        owner: owner._id,
        name: 'Uniqlo Beanie Winter Cap',
        category: 'Accessories',
        department: 'fashion',
        brand: 'Uniqlo',
        styleTags: ['Winter', 'Casual'],
        colors: ['Black'],
        material: 'Wool',
        fit: 'Regular',
        occasion: 'Casual',
        season: 'Winter',
        price: 1200,
        rating: 4.1,
        adminPriorityScore: 2,
    });
    const purchasedTee = await createProduct({
        owner: owner._id,
        name: 'Reference Mesh Tee',
        category: 'T-Shirts',
        department: 'fashion',
        brand: 'Adidas',
        styleTags: ['Sporty', 'Casual'],
        colors: ['Yellow', 'Black'],
        material: 'Cotton',
        fit: 'Regular',
        occasion: 'Casual',
        season: 'Summer',
        price: 2000,
    });
    const purchasedShoes = await createProduct({
        owner: owner._id,
        name: 'Reference Leather Trainers',
        category: 'Shoes',
        department: 'fashion',
        brand: 'Puma',
        styleTags: ['Formal', 'Premium'],
        colors: ['Yellow', 'Black'],
        material: 'Leather',
        fit: 'Regular',
        occasion: 'Formal',
        season: 'Summer',
        price: 3400,
    });

    await createWishlist(customer._id, [wishlistWatch._id]);
    await createOrderForProduct(customer._id, purchasedTee);
    await createOrderForProduct(customer._id, purchasedShoes);
    await createCloudClosetItem({
        userId: customer._id,
        attributes: {
            department: 'fashion',
            category: 'T-Shirts',
            productType: 'T-Shirts',
            colors: ['Yellow', 'Black'],
            material: 'Cotton',
            fit: 'Regular',
            occasion: 'Casual',
            season: 'Summer',
            styleTags: ['Sporty', 'Casual'],
        },
    });
    await createCloudClosetItem({
        userId: customer._id,
        attributes: {
            department: 'fashion',
            category: 'Shoes',
            productType: 'Shoes',
            colors: ['Yellow', 'Black'],
            material: 'Leather',
            fit: 'Regular',
            occasion: 'Formal',
            season: 'Summer',
            styleTags: ['Formal', 'Premium'],
        },
    });
    await createActiveBoost({
        productId: promotedWatch._id,
        createdBy: admin._id,
        feeAmount: 1000,
        placement: 'both',
    });
    await createActiveBoost({
        productId: unrelatedPromotedBeanie._id,
        createdBy: admin._id,
        feeAmount: 100000,
        placement: 'both',
    });

    const relevantBoostedProducts = await getActiveBoostedProductsForRelevantCategories({
        categories: ['Watches'],
        placement: 'personal',
    });
    const personalBoostMap = await getActiveBoostMapForProducts(
        [promotedWatch._id, unrelatedPromotedBeanie._id],
        'personal'
    );
    const result = await getPersonalRecommendations(customer._id);
    const recommendationNames = result.recommendations.map(
        (recommendation) => recommendation.product.name
    );
    const promotedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Fossil watch'
    );
    const unrelatedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Uniqlo Beanie Winter Cap'
    );
    const promotedRecommendations = result.recommendations.filter(isPromotedRecommendation);

    assert.ok(
        relevantBoostedProducts.some((entry) => entry.product.name === 'Fossil watch'),
        `Missing Fossil from boosted watch query: ${relevantBoostedProducts
            .map((entry) => entry.product.name)
            .join(', ')}`
    );
    assert.ok(
        !relevantBoostedProducts.some(
            (entry) => entry.product.name === 'Uniqlo Beanie Winter Cap'
        ),
        'Accessories beanie should not qualify for Watches relevance'
    );
    assert.ok(Number(personalBoostMap[String(promotedWatch._id)]?.paidBoostScore || 0) > 0);
    assert.ok(Number(personalBoostMap[String(unrelatedPromotedBeanie._id)]?.paidBoostScore || 0) > 0);
    assert.ok(promotedRecommendation, `Missing Fossil watch in ${recommendationNames.join(', ')}`);
    assert.ok(promotedRecommendation.paidBoostScore > 0);
    assert.equal(promotedRecommendation.isPromoted, true);
    assert.equal(promotedRecommendation.promotionLabel, 'Promoted');
    assert.equal(promotedRecommendation.product.isPromoted, true);
    assert.equal(promotedRecommendation.product.promotionLabel, 'Promoted');
    assert.ok(countPromotedRecommendations(result.recommendations) >= 1);
    assert.ok(
        recommendationNames.indexOf('Cartier tank watch') <
            recommendationNames.indexOf('Fossil watch')
    );

    if (unrelatedRecommendation) {
        assert.equal(unrelatedRecommendation.paidBoostScore, 0);
    }
});

test('gift recommendations apply paid boost inside relevant categories and ignore unrelated paid categories', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const owner = await createUser({ email: uniqueEmail('owner') });

    const promotedGiftProduct = await createProduct({
        owner: owner._id,
        name: 'Promoted Romantic Watch',
        category: 'Watches',
        brand: 'GiftBrand',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['Pink', 'Gold'],
        adminPriorityScore: 6,
    });
    const relevantGiftProduct = await createProduct({
        owner: owner._id,
        name: 'Relevant Pearl Bag',
        category: 'Bags',
        brand: 'GiftBrand2',
        styleTags: ['Giftable', 'Elegant', 'Romantic'],
        colors: ['Pink', 'White'],
        adminPriorityScore: 5,
    });
    const unrelatedPaidProduct = await createProduct({
        owner: owner._id,
        name: 'Paid Gaming Laptop',
        category: 'Laptops',
        department: 'electronics',
        brand: 'TechBrand',
        styleTags: ['Practical'],
        colors: ['Black'],
        adminPriorityScore: 4,
    });

    await createActiveBoost({
        productId: promotedGiftProduct._id,
        createdBy: admin._id,
        feeAmount: 120,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: unrelatedPaidProduct._id,
        createdBy: admin._id,
        feeAmount: 200,
        placement: 'gift',
    });

    const result = await getGiftAssistantRecommendations(
        'I want to buy a gift for my girlfriend under 5000'
    );
    const promotedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Promoted Romantic Watch'
    );
    const relevantRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Relevant Pearl Bag'
    );
    const unrelatedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Paid Gaming Laptop'
    );

    assert.ok(promotedRecommendation);
    assert.ok(promotedRecommendation.paidBoostScore > 0);
    assert.ok(promotedRecommendation.scoreBreakdown.paidBoostScore > 0);
    assert.equal(promotedRecommendation.isPromoted, true);
    assert.equal(promotedRecommendation.promotionLabel, 'Promoted');
    assert.equal(promotedRecommendation.product.promotionLabel, 'Promoted');
    assert.ok(relevantRecommendation);

    if (unrelatedRecommendation) {
        assert.equal(unrelatedRecommendation.paidBoostScore, 0);
        assert.ok(
            result.recommendations.indexOf(relevantRecommendation) <
                result.recommendations.indexOf(unrelatedRecommendation)
        );
    }
});

test('gift recommendations reserve about 20 percent of final slots for relevant promoted products', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const owner = await createUser({ email: uniqueEmail('owner') });

    const promotedWatchOne = await createProduct({
        owner: owner._id,
        name: 'Gift Fossil Quota Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Fossil',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['Pink', 'Gold'],
        price: 4300,
        adminPriorityScore: 4,
    });
    const promotedWatchTwo = await createProduct({
        owner: owner._id,
        name: 'Gift Citizen Quota Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Citizen',
        styleTags: ['Giftable', 'Classic', 'Premium'],
        colors: ['White', 'Gold'],
        price: 4100,
        adminPriorityScore: 4,
    });
    const promotedWatchThree = await createProduct({
        owner: owner._id,
        name: 'Gift Casio Quota Watch',
        category: 'Watch',
        department: 'fashion',
        brand: 'Casio',
        styleTags: ['Giftable', 'Classic'],
        colors: ['Black', 'Silver'],
        price: 3600,
        adminPriorityScore: 3,
    });

    const fillerProducts = [
        ['Romantic Bag', 'Bags'],
        ['Romantic Dress', 'Dresses'],
        ['Romantic Accessory', 'Accessories'],
        ['Romantic Jewelry', 'Jewelry'],
        ['Romantic Perfume', 'Perfume'],
        ['Romantic Sharee', 'Sharee'],
        ['Romantic Salowar', 'Salowar Kamiz'],
        ['Romantic Ethnic Set', 'Ethnic Wear'],
    ];

    for (const [name, category] of fillerProducts) {
        await createProduct({
            owner: owner._id,
            name,
            category,
            department: 'fashion',
            brand: `${category}Brand`,
            styleTags: ['Giftable', 'Elegant', 'Premium'],
            colors: ['Pink', 'White'],
            price: 3000,
            adminPriorityScore: 4,
        });
    }

    const unrelatedBoostedLaptop = await createProduct({
        owner: owner._id,
        name: 'Gift Unrelated Laptop',
        category: 'Laptops',
        department: 'electronics',
        brand: 'TechBrand',
        styleTags: ['Practical'],
        colors: ['Black'],
        price: 60000,
        adminPriorityScore: 5,
    });

    await createActiveBoost({
        productId: promotedWatchOne._id,
        createdBy: admin._id,
        feeAmount: 1000,
        placement: 'both',
    });
    await createActiveBoost({
        productId: promotedWatchTwo._id,
        createdBy: admin._id,
        feeAmount: 800,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: promotedWatchThree._id,
        createdBy: admin._id,
        feeAmount: 600,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: unrelatedBoostedLaptop._id,
        createdBy: admin._id,
        feeAmount: 1400,
        placement: 'gift',
    });

    const result = await getGiftAssistantRecommendations(
        'I want to buy a gift for my girlfriend under 5000'
    );
    const recommendationNames = result.recommendations.map(
        (recommendation) => recommendation.product.name
    );
    const promotedRecommendations = result.recommendations.filter(isPromotedRecommendation);
    const unrelatedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Gift Unrelated Laptop'
    );

    assert.equal(result.recommendations.length, 10);
    assert.ok(
        recommendationNames.includes('Gift Fossil Quota Watch'),
        `Missing highest fee promoted gift in ${recommendationNames.join(', ')}`
    );
    assert.ok(
        countPromotedRecommendations(result.recommendations) >= 2,
        `Expected at least 2 promoted gift recommendations, got ${promotedRecommendations.map((recommendation) => recommendation.product.name).join(', ')}`
    );
    assert.ok(
        promotedRecommendations.every(
            (recommendation) =>
                recommendation.product.category === 'Watches' ||
                recommendation.product.category === 'Watch'
        )
    );

    if (unrelatedRecommendation) {
        assert.equal(unrelatedRecommendation.paidBoostScore, 0);
    }
});

test('normal gift assistant enforces watch-specific promoted quota and excludes unrelated accessory boosts', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const owner = await createUser({ email: uniqueEmail('owner') });

    const promotedWatchOne = await createProduct({
        owner: owner._id,
        name: 'Gift Quota Fossil Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Fossil',
        styleTags: ['Giftable', 'Classic', 'Premium'],
        colors: ['Black', 'Silver'],
        price: 4300,
        adminPriorityScore: 3,
    });
    const promotedWatchTwo = await createProduct({
        owner: owner._id,
        name: 'Gift Quota Citizen Watch',
        category: 'Watch',
        department: 'fashion',
        brand: 'Citizen',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['Gold', 'Black'],
        price: 4100,
        adminPriorityScore: 3,
    });
    const unrelatedPromotedAccessory = await createProduct({
        owner: owner._id,
        name: 'Uniqlo Beanie Winter Cap',
        category: 'Accessories',
        department: 'fashion',
        brand: 'Uniqlo',
        styleTags: ['Casual', 'Winter'],
        colors: ['Black'],
        price: 1200,
        adminPriorityScore: 2,
    });

    const fillerProducts = [
        ['Gift Watch Organic One', 'Watches'],
        ['Gift Watch Organic Two', 'Watches'],
        ['Gift Bag Organic One', 'Bags'],
        ['Gift Bag Organic Two', 'Bags'],
        ['Gift Dress Organic One', 'Dresses'],
        ['Gift Dress Organic Two', 'Dresses'],
        ['Gift Accessory Organic One', 'Accessories'],
        ['Gift Accessory Organic Two', 'Accessories'],
        ['Gift Shirt Organic One', 'Shirts'],
        ['Gift Shirt Organic Two', 'Shirts'],
    ];

    for (const [name, category] of fillerProducts) {
        await createProduct({
            owner: owner._id,
            name,
            category,
            department: 'fashion',
            brand: `${category}Brand`,
            styleTags: ['Giftable', 'Elegant', 'Premium'],
            colors: ['Pink', 'Gold'],
            price: 3000,
            adminPriorityScore: 4,
            isNewArrival: true,
        });
    }

    await createActiveBoost({
        productId: promotedWatchOne._id,
        createdBy: admin._id,
        feeAmount: 1000,
        placement: 'both',
    });
    await createActiveBoost({
        productId: promotedWatchTwo._id,
        createdBy: admin._id,
        feeAmount: 800,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: unrelatedPromotedAccessory._id,
        createdBy: admin._id,
        feeAmount: 100000,
        placement: 'both',
    });

    const result = await getGiftAssistantRecommendations(
        'I want to buy a watch gift for my friend under 5000'
    );
    const recommendationNames = result.recommendations.map(
        (recommendation) => recommendation.product.name
    );
    const promotedRecommendations = result.recommendations.filter(isPromotedRecommendation);
    const unrelatedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Uniqlo Beanie Winter Cap'
    );

    assert.ok(
        recommendationNames.includes('Gift Quota Fossil Watch'),
        `Missing Fossil watch in ${recommendationNames.join(', ')}`
    );
    assert.ok(
        recommendationNames.includes('Gift Quota Citizen Watch'),
        `Missing Citizen watch in ${recommendationNames.join(', ')}`
    );
    assert.ok(
        countPromotedRecommendations(result.recommendations) >= 2,
        `Expected 2 promoted watch recommendations, got ${promotedRecommendations.map((recommendation) => recommendation.product.name).join(', ')}`
    );

    const fossilRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Gift Quota Fossil Watch'
    );
    const citizenRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Gift Quota Citizen Watch'
    );

    assert.ok(fossilRecommendation.paidBoostScore > 0);
    assert.ok(citizenRecommendation.paidBoostScore > 0);
    assert.equal(fossilRecommendation.isPromoted, true);
    assert.equal(citizenRecommendation.isPromoted, true);
    assert.equal(fossilRecommendation.promotionLabel, 'Promoted');
    assert.equal(citizenRecommendation.promotionLabel, 'Promoted');

    if (unrelatedRecommendation) {
        assert.equal(unrelatedRecommendation.paidBoostScore, 0);
        assert.equal(unrelatedRecommendation.isPromoted, false);
    }
});

test('friend wishlist recommendations preserve source priority over boosted catalog products', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const requester = await createUser({ email: uniqueEmail('requester') });
    const friend = await createUser({
        name: 'Priority Friend',
        email: uniqueEmail('friend'),
    });

    await createAcceptedFriendship(requester._id, friend._id);

    const wishlistProduct = await createProduct({
        owner: requester._id,
        name: 'Friend Wishlist Watch',
        category: 'Watches',
        brand: 'WishBrand',
        styleTags: ['Giftable', 'Premium', 'Elegant'],
        colors: ['Gold', 'White'],
        price: 4200,
    });
    const boostedCatalogProduct = await createProduct({
        owner: requester._id,
        name: 'Boosted Catalog Accessory',
        category: 'Accessories',
        brand: 'CatalogBrand',
        styleTags: ['Giftable', 'Practical'],
        colors: ['Black'],
        price: 4100,
    });
    const fillerProduct = await createProduct({
        owner: requester._id,
        name: 'Giftable Wallet',
        category: 'Bags',
        brand: 'CatalogBrand2',
        styleTags: ['Giftable', 'Premium'],
        colors: ['Black'],
        price: 2500,
    });

    await createWishlist(friend._id, [wishlistProduct._id]);
    await createActiveBoost({
        productId: boostedCatalogProduct._id,
        createdBy: admin._id,
        feeAmount: 300,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: fillerProduct._id,
        createdBy: admin._id,
        feeAmount: 100,
        placement: 'gift',
    });

    const result = await getFriendWishlistGiftRecommendations({
        message: 'I want to buy a gift for my friend under 5000',
        friendIdentifier: friend.email,
        currentUser: requester,
    });
    const wishlistRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Friend Wishlist Watch'
    );
    const catalogRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Boosted Catalog Accessory'
    );

    assert.ok(wishlistRecommendation);
    assert.ok(catalogRecommendation);
    assert.equal(wishlistRecommendation.recommendationSource, 'friend_wishlist');
    assert.ok(catalogRecommendation.paidBoostScore > 0);
    assert.ok(
        result.recommendations.indexOf(wishlistRecommendation) <
            result.recommendations.indexOf(catalogRecommendation)
    );
});

test('friend wishlist gift recommendations include relevant boosted watch products without outranking wishlist items', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const requester = await createUser({ email: uniqueEmail('requester') });
    const friend = await createUser({
        name: 'Sanjoy Rozario',
        email: uniqueEmail('friend'),
    });

    await createAcceptedFriendship(requester._id, friend._id);

    const wishlistWatch = await createProduct({
        owner: requester._id,
        name: 'Cartier tank watch',
        category: 'Watch',
        department: 'fashion',
        brand: 'Cartier',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['Gold', 'Brown'],
        price: 4800,
    });
    const boostedWatch = await createProduct({
        owner: requester._id,
        name: 'Fossil watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Fossil',
        styleTags: ['Giftable', 'Classic', 'Premium'],
        colors: ['Black', 'Silver'],
        price: 4300,
    });
    const supportingBag = await createProduct({
        owner: requester._id,
        name: 'Wishlist inspired bag',
        category: 'Bags',
        department: 'fashion',
        brand: 'BagBrand',
        styleTags: ['Giftable', 'Elegant'],
        colors: ['Black'],
        price: 2800,
    });
    const supportingDress = await createProduct({
        owner: requester._id,
        name: 'Wishlist inspired dress',
        category: 'Dresses',
        department: 'fashion',
        brand: 'DressBrand',
        styleTags: ['Giftable', 'Elegant'],
        colors: ['Red'],
        price: 3200,
    });
    const unrelatedShoes = await createProduct({
        owner: requester._id,
        name: 'Boosted shoes',
        category: 'Shoes',
        department: 'fashion',
        brand: 'ShoeBrand',
        styleTags: ['Practical'],
        colors: ['White'],
        price: 2600,
    });

    await createWishlist(friend._id, [wishlistWatch._id]);
    await createActiveBoost({
        productId: boostedWatch._id,
        createdBy: admin._id,
        feeAmount: 1000,
        placement: 'both',
    });
    await createActiveBoost({
        productId: unrelatedShoes._id,
        createdBy: admin._id,
        feeAmount: 900,
        placement: 'both',
    });
    await createActiveBoost({
        productId: supportingBag._id,
        createdBy: admin._id,
        feeAmount: 300,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: supportingDress._id,
        createdBy: admin._id,
        feeAmount: 200,
        placement: 'gift',
    });

    const result = await getFriendWishlistGiftRecommendations({
        message: 'gift for my friend',
        friendIdentifier: 'Sanjoy Rozario',
        currentUser: requester,
    });
    const recommendationNames = result.recommendations.map(
        (recommendation) => recommendation.product.name
    );
    const wishlistRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Cartier tank watch'
    );
    const boostedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Fossil watch'
    );
    const unrelatedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Boosted shoes'
    );

    assert.ok(wishlistRecommendation, `Missing wishlist recommendation in ${recommendationNames.join(', ')}`);
    assert.ok(boostedRecommendation, `Missing boosted recommendation in ${recommendationNames.join(', ')}`);
    assert.equal(wishlistRecommendation.recommendationSource, 'friend_wishlist');
    assert.ok(boostedRecommendation.paidBoostScore > 0);
    assert.ok(boostedRecommendation.scoreBreakdown.paidBoostScore > 0);
    assert.equal(boostedRecommendation.isPromoted, true);
    assert.equal(boostedRecommendation.product.isPromoted, true);
    assert.equal(boostedRecommendation.promotionLabel, 'Promoted');
    assert.equal(boostedRecommendation.product.promotionLabel, 'Promoted');
    assert.ok(
        result.recommendations.indexOf(wishlistRecommendation) <
            result.recommendations.indexOf(boostedRecommendation)
    );

    if (unrelatedRecommendation) {
        assert.equal(unrelatedRecommendation.paidBoostScore, 0);
    }
});

test('friend wishlist gift flow enforces promoted watch quota without displacing wishlist priority', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const requester = await createUser({ email: uniqueEmail('requester') });
    const friend = await createUser({
        name: 'Gift Quota Friend',
        email: uniqueEmail('friend'),
    });

    await createAcceptedFriendship(requester._id, friend._id);

    const wishlistWatch = await createProduct({
        owner: requester._id,
        name: 'Cartier tank watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Cartier',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['Gold', 'Brown'],
        price: 4800,
        isNewArrival: true,
    });
    const promotedWatchOne = await createProduct({
        owner: requester._id,
        name: 'Friend Gift Fossil Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Fossil',
        styleTags: ['Giftable', 'Classic', 'Premium'],
        colors: ['Black', 'Gold'],
        price: 4300,
    });
    const promotedWatchTwo = await createProduct({
        owner: requester._id,
        name: 'Friend Gift Citizen Watch',
        category: 'Watch',
        department: 'fashion',
        brand: 'Citizen',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['Gold', 'Silver'],
        price: 4100,
    });
    const unrelatedPromotedAccessory = await createProduct({
        owner: requester._id,
        name: 'Friend Gift Beanie',
        category: 'Accessories',
        department: 'fashion',
        brand: 'Uniqlo',
        styleTags: ['Casual', 'Winter'],
        colors: ['Black'],
        price: 1200,
    });

    const similarProducts = [
        ['Friend Similar Bag One', 'Bags'],
        ['Friend Similar Bag Two', 'Bags'],
        ['Friend Similar Dress One', 'Dresses'],
        ['Friend Similar Dress Two', 'Dresses'],
        ['Friend Similar Tee One', 'T-Shirts'],
        ['Friend Similar Tee Two', 'T-Shirts'],
        ['Friend Similar Shirt One', 'Shirts'],
        ['Friend Similar Shirt Two', 'Shirts'],
        ['Friend Similar Hoodie One', 'Hoodies'],
    ];

    for (const [name, category] of similarProducts) {
        await createProduct({
            owner: requester._id,
            name,
            category,
            department: 'fashion',
            brand: `${category}Brand`,
            styleTags: ['Giftable', 'Elegant', 'Premium'],
            colors: ['Gold', 'Black'],
            price: 3000,
            isNewArrival: true,
        });
    }

    await createWishlist(friend._id, [wishlistWatch._id]);
    await createActiveBoost({
        productId: promotedWatchOne._id,
        createdBy: admin._id,
        feeAmount: 1000,
        placement: 'both',
    });
    await createActiveBoost({
        productId: promotedWatchTwo._id,
        createdBy: admin._id,
        feeAmount: 800,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: unrelatedPromotedAccessory._id,
        createdBy: admin._id,
        feeAmount: 100000,
        placement: 'both',
    });

    const result = await getFriendWishlistGiftRecommendations({
        message: 'gift for my friend',
        friendIdentifier: friend.email,
        currentUser: requester,
    });
    const recommendationNames = result.recommendations.map(
        (recommendation) => recommendation.product.name
    );
    const promotedRecommendations = result.recommendations.filter(isPromotedRecommendation);
    const wishlistRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Cartier tank watch'
    );
    const fossilRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Friend Gift Fossil Watch'
    );
    const citizenRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Friend Gift Citizen Watch'
    );
    const unrelatedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Friend Gift Beanie'
    );

    assert.ok(wishlistRecommendation, `Missing wishlist watch in ${recommendationNames.join(', ')}`);
    assert.ok(fossilRecommendation, `Missing Fossil promoted watch in ${recommendationNames.join(', ')}`);
    assert.ok(citizenRecommendation, `Missing Citizen promoted watch in ${recommendationNames.join(', ')}`);
    assert.equal(wishlistRecommendation.recommendationSource, 'friend_wishlist');
    assert.ok(
        ['promoted_relevant_category', 'similar_to_wishlist'].includes(
            fossilRecommendation.recommendationSource
        )
    );
    assert.ok(
        ['promoted_relevant_category', 'similar_to_wishlist'].includes(
            citizenRecommendation.recommendationSource
        )
    );
    assert.ok(fossilRecommendation.paidBoostScore > 0);
    assert.ok(citizenRecommendation.paidBoostScore > 0);
    assert.equal(fossilRecommendation.isPromoted, true);
    assert.equal(citizenRecommendation.isPromoted, true);
    assert.ok(
        recommendationNames.indexOf('Cartier tank watch') <
            recommendationNames.indexOf('Friend Gift Fossil Watch')
    );
    assert.ok(
        countPromotedRecommendations(result.recommendations) >= 2,
        `Expected 2 promoted friend wishlist recommendations, got ${promotedRecommendations.map((recommendation) => recommendation.product.name).join(', ')}`
    );

    if (unrelatedRecommendation) {
        assert.equal(unrelatedRecommendation.paidBoostScore, 0);
        assert.equal(unrelatedRecommendation.isPromoted, false);
    }
});

test('friend wishlist gift recommendations reserve promoted quota without outranking wishlist sources', async () => {
    const admin = await createUser({
        role: USER_ROLES.ADMIN,
        email: uniqueEmail('admin'),
    });
    const requester = await createUser({ email: uniqueEmail('requester') });
    const friend = await createUser({
        name: 'Quota Friend',
        email: uniqueEmail('friend'),
    });

    await createAcceptedFriendship(requester._id, friend._id);

    const wishlistWatch = await createProduct({
        owner: requester._id,
        name: 'Friend Quota Wishlist Watch',
        category: 'Watch',
        department: 'fashion',
        brand: 'Cartier',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['Gold', 'Brown'],
        price: 4800,
    });
    const boostedWatchOne = await createProduct({
        owner: requester._id,
        name: 'Friend Quota Fossil Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Fossil',
        styleTags: ['Giftable', 'Classic', 'Premium'],
        colors: ['Black', 'Silver'],
        price: 4300,
    });
    const boostedWatchTwo = await createProduct({
        owner: requester._id,
        name: 'Friend Quota Citizen Watch',
        category: 'Watches',
        department: 'fashion',
        brand: 'Citizen',
        styleTags: ['Giftable', 'Elegant', 'Premium'],
        colors: ['White', 'Gold'],
        price: 4100,
    });
    const similarBag = await createProduct({
        owner: requester._id,
        name: 'Friend Similar Bag',
        category: 'Bags',
        department: 'fashion',
        brand: 'BagBrand',
        styleTags: ['Giftable', 'Elegant'],
        colors: ['Black'],
        price: 2800,
    });

    const fillerGiftProducts = [
        ['Friend Dress Pick', 'Dresses'],
        ['Friend Accessory Pick', 'Accessories'],
        ['Friend Perfume Pick', 'Perfume'],
        ['Friend Jewelry Pick', 'Jewelry'],
        ['Friend Sharee Pick', 'Sharee'],
        ['Friend Salowar Pick', 'Salowar Kamiz'],
        ['Friend Ethnic Pick', 'Ethnic Wear'],
        ['Friend Audio Pick', 'Audio'],
    ];

    for (const [name, category] of fillerGiftProducts) {
        await createProduct({
            owner: requester._id,
            name,
            category,
            department: category === 'Audio' ? 'electronics' : 'fashion',
            brand: `${category}Brand`,
            styleTags: ['Giftable', 'Elegant', 'Premium'],
            colors: ['Pink', 'White'],
            price: 3000,
        });
    }

    const unrelatedBoostedLaptop = await createProduct({
        owner: requester._id,
        name: 'Friend Unrelated Boosted Laptop',
        category: 'Laptops',
        department: 'electronics',
        brand: 'TechBrand',
        styleTags: ['Practical'],
        colors: ['Black'],
        price: 65000,
    });

    await createWishlist(friend._id, [wishlistWatch._id]);
    await createActiveBoost({
        productId: boostedWatchOne._id,
        createdBy: admin._id,
        feeAmount: 1000,
        placement: 'both',
    });
    await createActiveBoost({
        productId: boostedWatchTwo._id,
        createdBy: admin._id,
        feeAmount: 800,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: similarBag._id,
        createdBy: admin._id,
        feeAmount: 300,
        placement: 'gift',
    });
    await createActiveBoost({
        productId: unrelatedBoostedLaptop._id,
        createdBy: admin._id,
        feeAmount: 1200,
        placement: 'gift',
    });

    const result = await getFriendWishlistGiftRecommendations({
        message: 'gift for my friend',
        friendIdentifier: friend.email,
        currentUser: requester,
    });
    const recommendationNames = result.recommendations.map(
        (recommendation) => recommendation.product.name
    );
    const promotedRecommendations = result.recommendations.filter(isPromotedRecommendation);
    const wishlistRecommendationIndex = recommendationNames.indexOf('Friend Quota Wishlist Watch');
    const firstPromotedIndex = Math.min(
        ...promotedRecommendations.map((recommendation) =>
            recommendationNames.indexOf(recommendation.product.name)
        )
    );
    const unrelatedRecommendation = result.recommendations.find(
        (recommendation) => recommendation.product.name === 'Friend Unrelated Boosted Laptop'
    );

    assert.equal(result.recommendations.length, 10);
    assert.ok(
        recommendationNames.includes('Friend Quota Fossil Watch'),
        `Missing relevant promoted friend-wishlist watch in ${recommendationNames.join(', ')}`
    );
    assert.ok(
        recommendationNames.includes('Friend Quota Citizen Watch'),
        `Missing second promoted friend-wishlist watch in ${recommendationNames.join(', ')}`
    );
    assert.ok(
        countPromotedRecommendations(result.recommendations) >= 2,
        `Expected at least 2 promoted friend-wishlist recommendations, got ${promotedRecommendations.map((recommendation) => recommendation.product.name).join(', ')}`
    );
    assert.ok(wishlistRecommendationIndex >= 0);
    assert.ok(firstPromotedIndex > wishlistRecommendationIndex);

    if (unrelatedRecommendation) {
        assert.equal(unrelatedRecommendation.paidBoostScore, 0);
    }
});
