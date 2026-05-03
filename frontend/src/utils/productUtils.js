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

    return metaParts.join(' • ');
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
