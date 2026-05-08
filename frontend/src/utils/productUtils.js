export const normalizeDepartment = (department) => {
    const normalized = String(department || '').trim().toLowerCase();

    if (normalized === 'fashion') {
        return 'fashion';
    }

    return 'electronics';
};

export const getDepartmentLabel = (department) =>
    normalizeDepartment(department) === 'fashion' ? 'Fashion' : 'Electronics';

export const normalizeStringList = (values) =>
    Array.isArray(values)
        ? values
            .filter((value) => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

export const getProductImages = (product) => {
    const mainImage = typeof product?.image === 'string' ? product.image.trim() : '';
    const gallery = normalizeStringList(product?.images);
    const fallbackGallery = gallery.length ? [mainImage, ...gallery] : [mainImage];

    return Array.from(new Set(fallbackGallery.filter(Boolean)));
};

export const getCustomDesignKey = (customDesign) => {
    if (!customDesign || typeof customDesign !== 'object') {
        return '';
    }

    if (typeof customDesign.designId === 'string' && customDesign.designId.trim()) {
        return customDesign.designId.trim();
    }

    const designSignature = {
        shirtColor: customDesign.shirtColor || '',
        templateId: customDesign.templateId || '',
        designs: Array.isArray(customDesign.designs)
            ? customDesign.designs.map(({ assetId, x, y, width, height, rotation, zIndex }) => ({
                assetId,
                x,
                y,
                width,
                height,
                rotation,
                zIndex,
            }))
            : [],
    };

    return JSON.stringify(designSignature);
};

export const buildCartItemKey = (productId, selectedColor = '', selectedSize = '', customDesign = null) => {
    const baseParts = [productId, selectedColor.trim(), selectedSize.trim()];
    const customDesignKey = getCustomDesignKey(customDesign);

    return customDesignKey ? [...baseParts, customDesignKey].join('::') : baseParts.join('::');
};

export const getProductOptionSummary = (item) => {
    const parts = [];

    if (item?.customDesign?.shirtColor) {
        parts.push(`Custom Color: ${item.customDesign.shirtColor}`);
    } else if (typeof item?.selectedColor === 'string' && item.selectedColor.trim()) {
        parts.push(`Color: ${item.selectedColor.trim()}`);
    }

    if (typeof item?.selectedSize === 'string' && item.selectedSize.trim()) {
        parts.push(`Size: ${item.selectedSize.trim()}`);
    }

    if (item?.customDesign) {
        const designCount = Array.isArray(item.customDesign.designs) ? item.customDesign.designs.length : 0;
        parts.push(`${designCount} custom design${designCount === 1 ? '' : 's'}`);
    }

    return parts.join(' | ');
};

export const matchesProductKeyword = (product, keyword) => {
    const query = String(keyword || '').trim().toLowerCase();

    if (!query) {
        return true;
    }

    const searchableValues = [
        product.name,
        product.category,
        product.brand,
        normalizeDepartment(product.department),
        product.description,
        product.gender,
        product.material,
        product.fit,
        product.occasion,
        product.season,
        product.productType,
        ...normalizeStringList(product.colors),
        ...normalizeStringList(product.sizes),
        ...normalizeStringList(product.styleTags),
    ];

    return searchableValues.some(
        (value) => typeof value === 'string' && value.toLowerCase().includes(query)
    );
};

export const buildFashionMetaLine = (product) => {
    if (normalizeDepartment(product.department) !== 'fashion') {
        return '';
    }

    const metaParts = [
        normalizeStringList(product.styleTags)[0],
        normalizeStringList(product.colors)[0],
        product.fit,
        product.occasion,
        product.season,
        product.material,
    ]
        .filter((value) => typeof value === 'string' && value.trim())
        .filter((value, index, array) => array.indexOf(value) === index)
        .slice(0, 3);

    return metaParts.join(' | ');
};

export const getStockStatusLabel = (countInStock) => {
    if (countInStock === 0) {
        return 'Out of Stock';
    }

    if (countInStock > 0 && countInStock <= 5) {
        return 'Low Stock';
    }

    return 'In Stock';
};
