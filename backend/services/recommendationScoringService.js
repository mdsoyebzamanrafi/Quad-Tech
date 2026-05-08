import {
    buildProductLikeShape,
    normalizeDepartment,
    normalizeStringList,
    toObjectIdString,
} from './recommendationContextService.js';

const WISHLIST_EXACT_REASON = 'This product is already in your wishlist.';
const PURCHASED_EXACT_REASON = 'Already purchased exact product.';

const safeString = (value) => (typeof value === 'string' ? value.trim() : '');
const safeNumber = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

const intersectionCount = (firstList, secondList) => {
    const secondSet = new Set(normalizeStringList(secondList));
    return normalizeStringList(firstList).filter((value) => secondSet.has(value)).length;
};

const overlaps = (firstList, secondList) => intersectionCount(firstList, secondList) > 0;

const addReason = (reasons, message) => {
    if (message && !reasons.includes(message)) {
        reasons.push(message);
    }
};

const isExactWishlistProduct = (productId, wishlistProducts) =>
    wishlistProducts.some((wishlistProduct) => toObjectIdString(wishlistProduct._id) === productId);

const isExactCartProduct = (productId, cartProducts) =>
    cartProducts.some((cartProduct) => toObjectIdString(cartProduct._id) === productId);

const hasCategoryMatch = (product, products) =>
    products.some((item) => safeString(item.category) && safeString(item.category) === safeString(product.category));

const hasBrandMatch = (product, products) =>
    products.some((item) => safeString(item.brand) && safeString(item.brand) === safeString(product.brand));

const hasFashionMetadataOverlap = (product, products, fieldName, scoreValue, reasons, reasonText) => {
    const hasMatch = products.some((item) => {
        if (Array.isArray(product[fieldName]) || Array.isArray(item[fieldName])) {
            return overlaps(product[fieldName], item[fieldName]);
        }

        return safeString(product[fieldName]) && safeString(product[fieldName]) === safeString(item[fieldName]);
    });

    if (hasMatch) {
        addReason(reasons, reasonText);
        return scoreValue;
    }

    return 0;
};

const ELECTRONICS_RELATED_CATEGORY_RULES = [
    {
        anchors: ['smartphone', 'smartphones', 'phone', 'mobile'],
        related: ['accessories', 'audio', 'wearables'],
    },
    {
        anchors: ['laptop', 'laptops', 'notebook', 'computer'],
        related: ['accessories', 'audio', 'gaming'],
    },
    {
        anchors: ['camera', 'cameras'],
        related: ['drones', 'accessories'],
    },
];

const hasRelatedElectronicsCategoryBoost = (product, preferredCategories) => {
    const productCategory = safeString(product.category).toLowerCase();
    const normalizedPreferredCategories = preferredCategories.map((category) => safeString(category).toLowerCase());

    return ELECTRONICS_RELATED_CATEGORY_RULES.some((rule) => {
        const hasAnchor = normalizedPreferredCategories.some((category) =>
            rule.anchors.some((anchor) => category.includes(anchor))
        );

        return hasAnchor && rule.related.some((relatedCategory) => productCategory.includes(relatedCategory));
    });
};

const buildFriendSignals = (friendWishlistProducts) => ({
    categories: new Set(friendWishlistProducts.map((product) => safeString(product.category)).filter(Boolean)),
    brands: new Set(friendWishlistProducts.map((product) => safeString(product.brand)).filter(Boolean)),
    styleTags: new Set(friendWishlistProducts.flatMap((product) => normalizeStringList(product.styleTags))),
});

const scoreProduct = (rawProduct, context) => {
    const product = buildProductLikeShape(rawProduct);
    const productId = toObjectIdString(product._id);
    const reasons = [];
    const normalizedDepartmentValue = normalizeDepartment(product.department);
    const purchasedProductIds = new Set((context.purchasedProductIds || []).map((id) => toObjectIdString(id)));
    const wishlistProducts = context.wishlistProducts || [];
    const cartProducts = context.cartProducts || [];
    const purchasedProducts = context.purchasedProducts || [];
    const cloudClosetItems = context.cloudClosetItems || [];
    const friendWishlistProducts = context.friendWishlistProducts || [];
    const preferenceProfile = context.preferenceProfile || {};

    let wishlistScore = 0;
    if (isExactWishlistProduct(productId, wishlistProducts)) {
        wishlistScore += 45;
        addReason(reasons, WISHLIST_EXACT_REASON);
    }
    if (hasCategoryMatch(product, wishlistProducts)) {
        wishlistScore += 25;
        addReason(reasons, 'Matches a category from your wishlist.');
    }
    if (hasBrandMatch(product, wishlistProducts)) {
        wishlistScore += 15;
        addReason(reasons, 'Matches a brand from your wishlist.');
    }
    wishlistScore += hasFashionMetadataOverlap(
        product,
        wishlistProducts,
        'colors',
        10,
        reasons,
        'Matches colors from products you saved.'
    );
    wishlistScore += hasFashionMetadataOverlap(
        product,
        wishlistProducts,
        'styleTags',
        15,
        reasons,
        'Matches your saved style preferences.'
    );
    wishlistScore += hasFashionMetadataOverlap(
        product,
        wishlistProducts,
        'occasion',
        8,
        reasons,
        'Fits occasions you saved in your wishlist.'
    );
    wishlistScore += hasFashionMetadataOverlap(
        product,
        wishlistProducts,
        'season',
        8,
        reasons,
        'Fits seasons you saved in your wishlist.'
    );

    let cartScore = 0;
    if (isExactCartProduct(productId, cartProducts)) {
        cartScore += 35;
        addReason(reasons, 'This product is already in your cart.');
    }
    if (hasCategoryMatch(product, cartProducts)) {
        cartScore += 22;
        addReason(reasons, 'Matches a category from your cart.');
    }
    if (hasBrandMatch(product, cartProducts)) {
        cartScore += 12;
        addReason(reasons, 'Matches a brand from your cart.');
    }
    cartScore += hasFashionMetadataOverlap(
        product,
        cartProducts,
        'colors',
        8,
        reasons,
        'Matches colors from products in your cart.'
    );
    cartScore += hasFashionMetadataOverlap(
        product,
        cartProducts,
        'styleTags',
        10,
        reasons,
        'Matches styles from products in your cart.'
    );
    cartScore += hasFashionMetadataOverlap(
        product,
        cartProducts,
        'productType',
        8,
        reasons,
        'Similar to product types in your cart.'
    );

    let purchaseHistoryScore = 0;
    if (purchasedProductIds.has(productId)) {
        purchaseHistoryScore = -100;
        addReason(reasons, PURCHASED_EXACT_REASON);
    } else {
        if (
            purchasedProducts.some(
                (purchasedProduct) => normalizeDepartment(purchasedProduct.department) === normalizedDepartmentValue
            )
        ) {
            purchaseHistoryScore += 15;
            addReason(reasons, 'Matches your previous shopping department.');
        }
        if (hasCategoryMatch(product, purchasedProducts)) {
            purchaseHistoryScore += 20;
            addReason(reasons, 'Similar to products you bought before.');
        }
        if (hasBrandMatch(product, purchasedProducts)) {
            purchaseHistoryScore += 10;
            addReason(reasons, 'Matches a brand you purchased before.');
        }
        if (
            purchasedProducts.some((purchasedProduct) =>
                overlaps(product.styleTags, purchasedProduct.styleTags)
            )
        ) {
            purchaseHistoryScore += 12;
            addReason(reasons, 'Matches your previous style interests.');
        }
    }

    let similarityScore = 0;
    if (normalizedDepartmentValue === 'fashion') {
        if (overlaps(product.colors, preferenceProfile.preferredColors)) {
            similarityScore += 10;
            addReason(reasons, 'Matches colors you usually prefer.');
        }
        if (overlaps(product.sizes, preferenceProfile.preferredSizes)) {
            similarityScore += 8;
            addReason(reasons, 'Available in sizes you often choose.');
        }
        if (
            safeString(product.season) &&
            preferenceProfile.preferredSeasons?.includes(safeString(product.season))
        ) {
            similarityScore += 10;
            addReason(reasons, 'Fits your usual season preference.');
        }
        if (
            safeString(product.occasion) &&
            preferenceProfile.preferredOccasions?.includes(safeString(product.occasion))
        ) {
            similarityScore += 10;
            addReason(reasons, 'Fits occasions you often shop for.');
        }
        if (overlaps(product.styleTags, preferenceProfile.preferredStyleTags)) {
            similarityScore += 15;
            addReason(reasons, 'Matches your preferred style tags.');
        }
        if (
            safeString(product.productType) &&
            preferenceProfile.preferredProductTypes?.includes(safeString(product.productType))
        ) {
            similarityScore += 8;
            addReason(reasons, 'Matches product types you explore often.');
        }
    } else {
        if (preferenceProfile.preferredDepartments?.includes('electronics')) {
            similarityScore += 10;
            addReason(reasons, 'Fits your electronics browsing habits.');
        }
        if (preferenceProfile.preferredCategories?.includes(safeString(product.category))) {
            similarityScore += 15;
            addReason(reasons, 'Matches categories you prefer.');
        }
        if (preferenceProfile.preferredBrands?.includes(safeString(product.brand))) {
            similarityScore += 10;
            addReason(reasons, 'Matches brands you usually pick.');
        }
        if (hasRelatedElectronicsCategoryBoost(product, preferenceProfile.preferredCategories || [])) {
            similarityScore += 12;
            addReason(reasons, 'Complements electronics you already bought.');
        }
    }

    let cloudClosetScore = 0;
    if (normalizedDepartmentValue === 'fashion' && cloudClosetItems.length > 0) {
        if (hasCategoryMatch(product, cloudClosetItems)) {
            cloudClosetScore += 15;
            addReason(reasons, 'Matches clothing styles from your Cloud Closet.');
        }
        cloudClosetScore += hasFashionMetadataOverlap(
            product,
            cloudClosetItems,
            'colors',
            10,
            reasons,
            'Matches colors from clothes you own.'
        );
        cloudClosetScore += hasFashionMetadataOverlap(
            product,
            cloudClosetItems,
            'styleTags',
            12,
            reasons,
            'Matches styles from your Cloud Closet.'
        );
        cloudClosetScore += hasFashionMetadataOverlap(
            product,
            cloudClosetItems,
            'productType',
            12,
            reasons,
            'Similar to items in your Cloud Closet.'
        );
        cloudClosetScore += hasFashionMetadataOverlap(
            product,
            cloudClosetItems,
            'material',
            8,
            reasons,
            'Matches materials from your Cloud Closet.'
        );
        cloudClosetScore += hasFashionMetadataOverlap(
            product,
            cloudClosetItems,
            'season',
            8,
            reasons,
            'Fits seasons from your Cloud Closet.'
        );
        cloudClosetScore += hasFashionMetadataOverlap(
            product,
            cloudClosetItems,
            'occasion',
            8,
            reasons,
            'Fits occasions from your Cloud Closet.'
        );
        cloudClosetScore += hasFashionMetadataOverlap(
            product,
            cloudClosetItems,
            'fit',
            8,
            reasons,
            'Matches fits from your Cloud Closet.'
        );
    }

    let priceScore = 5;
    const averagePrice = safeNumber(preferenceProfile.averagePrice);
    const productPrice = safeNumber(product.price);

    if (averagePrice > 0 && productPrice > 0) {
        const differenceRatio = Math.abs(productPrice - averagePrice) / averagePrice;

        if (differenceRatio <= 0.3) {
            priceScore = 15;
            addReason(reasons, 'Within your usual price range.');
        } else if (differenceRatio <= 0.5) {
            priceScore = 8;
        } else if (productPrice > averagePrice * 1.5) {
            priceScore = -10;
        } else {
            priceScore = 0;
        }
    }

    const friendSignals = buildFriendSignals(friendWishlistProducts);
    let friendBoostScore = 0;
    if ((preferenceProfile.friendWishlistProductIds || []).includes(productId)) {
        friendBoostScore += 18;
        addReason(reasons, 'Popular in your BondhuBandhob circle.');
    }
    if (friendSignals.categories.has(safeString(product.category))) {
        friendBoostScore += 8;
    }
    if (friendSignals.brands.has(safeString(product.brand))) {
        friendBoostScore += 5;
    }
    if (overlaps(product.styleTags, Array.from(friendSignals.styleTags))) {
        friendBoostScore += 7;
    }
    friendBoostScore = Math.min(friendBoostScore, 25);

    let stockScore = 0;
    if (safeNumber(product.countInStock) > 5) {
        stockScore = 10;
        addReason(reasons, 'Available in stock.');
    } else if (safeNumber(product.countInStock) > 0) {
        stockScore = 6;
        addReason(reasons, 'Low stock item you may want to check soon.');
    }

    let ratingScore = 0;
    const rating = safeNumber(product.rating);
    if (rating >= 4.5) {
        ratingScore = 10;
    } else if (rating >= 4) {
        ratingScore = 7;
    } else if (rating >= 3.5) {
        ratingScore = 4;
    }

    let priorityScore = 0;
    priorityScore += Math.min(safeNumber(product.adminPriorityScore), 25);
    if (product.isSponsored) {
        priorityScore += Math.min(safeNumber(product.sponsoredWeight), 12);
    }
    if (product.isNewArrival) {
        priorityScore += 10;
        addReason(reasons, 'New arrival worth exploring.');
    }
    priorityScore = Math.min(priorityScore, 35);

    const scoreBreakdown = {
        wishlistScore,
        cartScore,
        purchaseHistoryScore,
        similarityScore,
        cloudClosetScore,
        priceScore,
        friendBoostScore,
        stockScore,
        ratingScore,
        priorityScore,
    };

    const finalScore = Object.values(scoreBreakdown).reduce((total, score) => total + score, 0);

    return {
        product,
        organicScore: finalScore,
        paidBoostScore: 0,
        finalScore,
        scoreBreakdown,
        reasons,
    };
};

export { scoreProduct, PURCHASED_EXACT_REASON, WISHLIST_EXACT_REASON };
