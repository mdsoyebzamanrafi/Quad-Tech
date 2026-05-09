import mongoose from 'mongoose';
import User from '../models/User.js';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import Product from '../models/Product.js';
import Wishlist from '../models/Wishlist.js';
import Cart from '../models/Cart.js';
import CloudClosetItem from '../models/CloudClosetItem.js';
import Friendship from '../models/Friendship.js';

const ACTIVE_IN_STOCK_FILTER = {
    countInStock: { $gt: 0 },
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
};

const WISHLIST_WEIGHT = 1.25;
const CART_WEIGHT = 1.15;
const CLOUD_CLOSET_WEIGHT = 1.1;
const PURCHASE_WEIGHT = 1;
const FRIEND_WISHLIST_WEIGHT = 0.6;

const normalizeDepartment = (department) => {
    const normalized = String(department || '').trim().toLowerCase();
    return normalized === 'fashion' ? 'fashion' : 'electronics';
};

const normalizeString = (value) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim();
};

const normalizeStringList = (values) =>
    Array.isArray(values)
        ? values
            .filter((value) => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

const toNumericValue = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

const toObjectIdString = (value) => {
    if (!value) {
        return '';
    }

    if (typeof value === 'string') {
        return value;
    }

    if (value instanceof mongoose.Types.ObjectId) {
        return value.toString();
    }

    if (typeof value === 'object' && value._id) {
        return toObjectIdString(value._id);
    }

    return '';
};

const buildProductLikeShape = (product = {}) => ({
    _id: product._id,
    name: normalizeString(product.name),
    image: normalizeString(product.image),
    brand: normalizeString(product.brand),
    category: normalizeString(product.category),
    department: normalizeDepartment(product.department),
    description: normalizeString(product.description),
    price: toNumericValue(product.price),
    countInStock: toNumericValue(product.countInStock),
    rating: toNumericValue(product.rating),
    numReviews: toNumericValue(product.numReviews),
    colors: normalizeStringList(product.colors),
    sizes: normalizeStringList(product.sizes),
    material: normalizeString(product.material),
    fit: normalizeString(product.fit),
    occasion: normalizeString(product.occasion),
    season: normalizeString(product.season),
    styleTags: normalizeStringList(product.styleTags),
    productType: normalizeString(product.productType),
    isNewArrival: Boolean(product.isNewArrival),
    adminPriorityScore: toNumericValue(product.adminPriorityScore),
    isSponsored: Boolean(product.isSponsored),
    sponsoredWeight: toNumericValue(product.sponsoredWeight),
    isActive: product.isActive !== false,
    createdAt: product.createdAt || null,
    updatedAt: product.updatedAt || null,
    user: product.user || null,
    isPromoted: Boolean(product.isPromoted),
    paidBoostScore: toNumericValue(product.paidBoostScore),
    promotionLabel: normalizeString(product.promotionLabel),
});

const normalizeCountMap = (countMap, value, weight) => {
    const normalizedValue = normalizeString(value);
    if (!normalizedValue) {
        return;
    }

    countMap.set(normalizedValue, (countMap.get(normalizedValue) || 0) + weight);
};

const normalizeListCountMap = (countMap, values, weight) => {
    normalizeStringList(values).forEach((value) => normalizeCountMap(countMap, value, weight));
};

const sortPreferenceMap = (countMap, limit = 5) =>
    Array.from(countMap.entries())
        .sort((firstEntry, secondEntry) => secondEntry[1] - firstEntry[1] || firstEntry[0].localeCompare(secondEntry[0]))
        .slice(0, limit)
        .map(([value]) => value);

const extractWishlistProducts = (wishlistDocument) => {
    if (!wishlistDocument) {
        return [];
    }

    const rawItems = Array.isArray(wishlistDocument.items)
        ? wishlistDocument.items
        : Array.isArray(wishlistDocument.products)
            ? wishlistDocument.products
            : [];

    return rawItems
        .map((item) => {
            if (item?.product && typeof item.product === 'object') {
                return item.product;
            }

            if (item && typeof item === 'object' && item.name) {
                return item;
            }

            return null;
        })
        .filter(Boolean)
        .map(buildProductLikeShape);
};

const extractCartProducts = (cartDocument) => {
    if (!cartDocument || !Array.isArray(cartDocument.items)) {
        return [];
    }

    return cartDocument.items
        .map((item) => {
            if (item?.product && typeof item.product === 'object') {
                return {
                    ...item.product,
                    quantity: Math.max(1, toNumericValue(item.qty) || 1),
                };
            }

            return null;
        })
        .filter(Boolean)
        .map((product) => ({
            ...buildProductLikeShape(product),
            quantity: Math.max(1, toNumericValue(product.quantity) || 1),
        }));
};

const buildCloudClosetPreferenceShape = (item = {}) => {
    const attributes = item.attributes || {};

    return {
        _id: item._id,
        name: normalizeString(item.originalFilename) || 'Cloud Closet item',
        image: normalizeString(item.imageUrl),
        brand: '',
        category: normalizeString(attributes.category),
        department: normalizeString(attributes.department),
        description: '',
        price: 0,
        countInStock: 0,
        rating: 0,
        numReviews: 0,
        colors: normalizeStringList(attributes.colors),
        sizes: normalizeStringList(attributes.sizes),
        material: normalizeString(attributes.material),
        fit: normalizeString(attributes.fit),
        occasion: normalizeString(attributes.occasion),
        season: normalizeString(attributes.season),
        styleTags: normalizeStringList(attributes.styleTags),
        productType: normalizeString(attributes.productType),
        keywords: normalizeStringList(attributes.keywords),
        confidence: toNumericValue(attributes.confidence),
    };
};

const extractOrderItemProductId = (item) =>
    toObjectIdString(item?.product) ||
    toObjectIdString(item?.productId) ||
    toObjectIdString(item?._id);

const extractOrderItemSnapshot = (item) => {
    const nestedProduct = item?.product && typeof item.product === 'object' ? item.product : null;
    const base = nestedProduct || item || {};

    return {
        _id: extractOrderItemProductId(item),
        name: normalizeString(base.productName || base.name),
        image: normalizeString(base.productImage || base.image),
        brand: normalizeString(base.brand),
        category: normalizeString(base.category),
        department: normalizeDepartment(base.department),
        description: normalizeString(base.description),
        price: toNumericValue(base.unitPrice ?? base.price),
        countInStock: toNumericValue(base.countInStock),
        rating: toNumericValue(base.rating),
        numReviews: toNumericValue(base.numReviews),
        colors: normalizeStringList(base.colors),
        sizes: normalizeStringList(base.sizes),
        material: normalizeString(base.material),
        fit: normalizeString(base.fit),
        occasion: normalizeString(base.occasion),
        season: normalizeString(base.season),
        styleTags: normalizeStringList(base.styleTags),
        productType: normalizeString(base.productType),
        quantity: Math.max(1, toNumericValue(base.quantity ?? base.qty ?? 1)),
    };
};

const derivePreferenceProfile = ({
    purchasedSignals,
    wishlistProducts,
    cartProducts,
    cloudClosetItems,
    orders,
    friendWishlistProducts,
}) => {
    const departmentWeights = new Map();
    const categoryWeights = new Map();
    const brandWeights = new Map();
    const colorWeights = new Map();
    const sizeWeights = new Map();
    const materialWeights = new Map();
    const fitWeights = new Map();
    const styleTagWeights = new Map();
    const occasionWeights = new Map();
    const seasonWeights = new Map();
    const productTypeWeights = new Map();
    const priceSamples = [];

    const addProductSignals = (product, weightMultiplier, options = {}) => {
        if (!product) {
            return;
        }

        const departmentValue = options.useStrictDepartment
            ? normalizeString(product.department)
            : normalizeDepartment(product.department);
        normalizeCountMap(departmentWeights, departmentValue, weightMultiplier);
        normalizeCountMap(categoryWeights, product.category, weightMultiplier);
        normalizeCountMap(brandWeights, product.brand, weightMultiplier);
        normalizeListCountMap(colorWeights, product.colors, weightMultiplier);
        normalizeListCountMap(sizeWeights, product.sizes, weightMultiplier);
        normalizeCountMap(materialWeights, product.material, weightMultiplier);
        normalizeCountMap(fitWeights, product.fit, weightMultiplier);
        normalizeListCountMap(styleTagWeights, product.styleTags, weightMultiplier);
        normalizeCountMap(occasionWeights, product.occasion, weightMultiplier);
        normalizeCountMap(seasonWeights, product.season, weightMultiplier);
        normalizeCountMap(productTypeWeights, product.productType, weightMultiplier);

        if (options.includePrice !== false && toNumericValue(product.price) > 0) {
            priceSamples.push({
                price: toNumericValue(product.price),
                weight: weightMultiplier,
            });
        }
    };

    purchasedSignals.forEach((signal) => {
        const quantityWeight = Math.max(1, toNumericValue(signal.quantity) || 1);
        addProductSignals(signal, PURCHASE_WEIGHT * quantityWeight);
    });

    wishlistProducts.forEach((product) => {
        addProductSignals(product, WISHLIST_WEIGHT);
    });

    cartProducts.forEach((product) => {
        const quantityWeight = Math.max(1, toNumericValue(product.quantity) || 1);
        addProductSignals(product, CART_WEIGHT * quantityWeight);
    });

    cloudClosetItems.forEach((item) => {
        addProductSignals(item, CLOUD_CLOSET_WEIGHT, {
            includePrice: false,
            useStrictDepartment: true,
        });
    });

    friendWishlistProducts.forEach((product) => {
        addProductSignals(product, FRIEND_WISHLIST_WEIGHT, {
            includePrice: false,
        });
    });

    const weightedPriceTotal = priceSamples.reduce(
        (total, sample) => total + sample.price * sample.weight,
        0
    );
    const totalPriceWeight = priceSamples.reduce((total, sample) => total + sample.weight, 0);
    const uniqueFriendWishlistProductIds = Array.from(
        new Set(friendWishlistProducts.map((product) => toObjectIdString(product._id)).filter(Boolean))
    );

    return {
        preferredDepartments: sortPreferenceMap(departmentWeights, 3),
        preferredCategories: sortPreferenceMap(categoryWeights, 5),
        preferredBrands: sortPreferenceMap(brandWeights, 5),
        preferredColors: sortPreferenceMap(colorWeights, 6),
        preferredSizes: sortPreferenceMap(sizeWeights, 6),
        preferredMaterials: sortPreferenceMap(materialWeights, 5),
        preferredFits: sortPreferenceMap(fitWeights, 5),
        preferredStyleTags: sortPreferenceMap(styleTagWeights, 6),
        preferredOccasions: sortPreferenceMap(occasionWeights, 4),
        preferredSeasons: sortPreferenceMap(seasonWeights, 4),
        preferredProductTypes: sortPreferenceMap(productTypeWeights, 6),
        averagePrice: totalPriceWeight > 0 ? Math.round(weightedPriceTotal / totalPriceWeight) : 0,
        minTypicalPrice:
            priceSamples.length > 0
                ? Math.min(...priceSamples.map((sample) => sample.price))
                : 0,
        maxTypicalPrice:
            priceSamples.length > 0
                ? Math.max(...priceSamples.map((sample) => sample.price))
                : 0,
        totalSpent: orders.reduce((total, order) => total + toNumericValue(order.total), 0),
        orderCount: orders.length,
        wishlistCount: wishlistProducts.length,
        cartCount: cartProducts.length,
        cloudClosetCount: cloudClosetItems.length,
        friendWishlistProductIds: uniqueFriendWishlistProductIds,
    };
};

const buildRecommendationContext = async (userId, options = {}) => {
    const orderLimit = Number(options.orderLimit) > 0 ? Number(options.orderLimit) : 20;
    const [user, orders, wishlistDocument, cartDocument, cloudClosetDocuments, availableProducts] = await Promise.all([
        User.findById(userId).select('-password').lean(),
        Order.find({ user: userId }).sort({ createdAt: -1 }).limit(orderLimit).lean(),
        Wishlist.findOne({ user: userId }).populate('items.product').lean(),
        Cart.findOne({ user: userId }).populate('items.product').lean(),
        CloudClosetItem.find({
            user: userId,
            analysisStatus: 'completed',
        }).lean(),
        Product.find(ACTIVE_IN_STOCK_FILTER).lean(),
    ]);

    if (!user) {
        throw new Error('User not found for recommendation context');
    }

    const orderIds = orders.map((order) => order._id);
    const orderItems = orderIds.length
        ? await OrderItem.find({ order: { $in: orderIds } }).lean()
        : [];

    const orderItemsByOrderId = new Map();
    orderItems.forEach((item) => {
        const orderKey = toObjectIdString(item.order);
        if (!orderItemsByOrderId.has(orderKey)) {
            orderItemsByOrderId.set(orderKey, []);
        }
        orderItemsByOrderId.get(orderKey).push(item);
    });

    const purchasedItemSnapshots = [];
    const purchasedProductIdSet = new Set();

    orders.forEach((order) => {
        const orderKey = toObjectIdString(order._id);
        const currentOrderItems = [
            ...(Array.isArray(order.orderItems) ? order.orderItems : []),
            ...(orderItemsByOrderId.get(orderKey) || []),
        ];

        currentOrderItems.forEach((item) => {
            const snapshot = extractOrderItemSnapshot(item);
            purchasedItemSnapshots.push(snapshot);

            if (snapshot._id) {
                purchasedProductIdSet.add(snapshot._id);
            }
        });
    });

    const purchasedProductIds = Array.from(purchasedProductIdSet);
    const purchasedProducts = purchasedProductIds.length
        ? await Product.find({ _id: { $in: purchasedProductIds } }).lean()
        : [];

    const purchasedProductsById = new Map(
        purchasedProducts.map((product) => [toObjectIdString(product._id), buildProductLikeShape(product)])
    );

    const purchasedSignals = purchasedItemSnapshots.map((snapshot) => ({
        ...(purchasedProductsById.get(snapshot._id) || snapshot),
        quantity: Math.max(1, toNumericValue(snapshot.quantity) || 1),
        price:
            toNumericValue(purchasedProductsById.get(snapshot._id)?.price) ||
            toNumericValue(snapshot.price),
    }));

    const wishlistProducts = extractWishlistProducts(wishlistDocument);
    const cartProducts = extractCartProducts(cartDocument);
    const cartProductIds = Array.from(
        new Set(cartProducts.map((product) => toObjectIdString(product._id)).filter(Boolean))
    );
    const cloudClosetItems = cloudClosetDocuments.map(buildCloudClosetPreferenceShape);

    let friendWishlistProducts = [];

    try {
        const acceptedFriendships = await Friendship.find({
            status: 'accepted',
            $or: [{ requester: userId }, { recipient: userId }],
        }).lean();

        const friendIds = acceptedFriendships
            .map((friendship) => {
                const requesterId = toObjectIdString(friendship.requester);
                const recipientId = toObjectIdString(friendship.recipient);
                return requesterId === toObjectIdString(userId) ? recipientId : requesterId;
            })
            .filter(Boolean);

        if (friendIds.length > 0) {
            const friendWishlists = await Wishlist.find({ user: { $in: friendIds } })
                .populate('items.product')
                .lean();

            friendWishlistProducts = friendWishlists.flatMap((wishlist) => extractWishlistProducts(wishlist));
        }
    } catch (error) {
        friendWishlistProducts = [];
    }

    const preferenceProfile = derivePreferenceProfile({
        purchasedSignals,
        wishlistProducts,
        cartProducts,
        cloudClosetItems,
        orders,
        friendWishlistProducts,
    });

    const contextSummary = {
        orderCount: orders.length,
        purchasedProductCount: purchasedProductIds.length,
        wishlistCount: wishlistProducts.length,
        cartCount: cartProducts.length,
        cloudClosetCount: cloudClosetItems.length,
        friendWishlistCount: friendWishlistProducts.length,
        availableProductCount: availableProducts.length,
        preferredDepartments: preferenceProfile.preferredDepartments,
        preferredCategories: preferenceProfile.preferredCategories,
        preferredBrands: preferenceProfile.preferredBrands,
        preferredColors: preferenceProfile.preferredColors,
        preferredStyleTags: preferenceProfile.preferredStyleTags,
        averagePrice: preferenceProfile.averagePrice,
    };

    return {
        user,
        orders,
        purchasedProducts: purchasedProducts.map(buildProductLikeShape),
        wishlistProducts,
        cartProducts,
        cloudClosetItems,
        friendWishlistProducts,
        availableProducts: availableProducts.map(buildProductLikeShape),
        purchasedProductIds,
        cartProductIds,
        preferenceProfile,
        contextSummary,
    };
};

export { buildRecommendationContext, buildProductLikeShape, normalizeDepartment, normalizeStringList, toObjectIdString };
