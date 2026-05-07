import Product from '../models/Product.js';

const ACTIVE_PRODUCT_FILTER = {
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
};

const SEARCHABLE_FIELDS = [
    'name',
    'category',
    'brand',
    'department',
    'description',
    'colors',
    'sizes',
    'styleTags',
    'occasion',
    'season',
    'productType',
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildContainsRegex = (value) => new RegExp(escapeRegex(value.trim()), 'i');

const buildExactRegex = (value) => new RegExp(`^${escapeRegex(value.trim())}$`, 'i');

const normalizeDepartmentLabel = (department) => {
    if (!department) {
        return 'electronics';
    }

    return String(department).trim().toLowerCase();
};

const buildDepartmentFilter = (department) => {
    const normalizedDepartment = normalizeDepartmentLabel(department);

    if (normalizedDepartment === 'electronics') {
        return {
            $or: [
                { department: buildExactRegex('electronics') },
                { department: { $exists: false } },
                { department: null },
                { department: '' },
            ],
        };
    }

    return { department: buildExactRegex(normalizedDepartment) };
};

const buildKeywordConditions = (keyword) => {
    if (!keyword || !keyword.trim()) {
        return [];
    }

    const normalizedKeyword = keyword.trim().toLowerCase();
    const regex = buildContainsRegex(keyword);
    const conditions = SEARCHABLE_FIELDS.map((field) => ({ [field]: regex }));

    if ('electronics'.includes(normalizedKeyword) || normalizedKeyword.includes('tech')) {
        conditions.push({ department: { $exists: false } });
    }

    return conditions;
};

const buildProductQueryFilter = (query, { includeActiveOnly = true } = {}) => {
    const filters = [];

    if (includeActiveOnly) {
        filters.push(ACTIVE_PRODUCT_FILTER);
    }

    const keywordConditions = buildKeywordConditions(query.keyword);
    if (keywordConditions.length) {
        filters.push({ $or: keywordConditions });
    }

    if (query.department) {
        filters.push(buildDepartmentFilter(query.department));
    }

    if (query.category) {
        filters.push({ category: buildExactRegex(query.category) });
    }

    if (query.brand) {
        filters.push({ brand: buildExactRegex(query.brand) });
    }

    if (query.gender) {
        filters.push({ gender: buildExactRegex(query.gender) });
    }

    if (query.color) {
        filters.push({ colors: buildExactRegex(query.color) });
    }

    if (query.size) {
        filters.push({ sizes: buildExactRegex(query.size) });
    }

    if (query.season) {
        filters.push({ season: buildExactRegex(query.season) });
    }

    if (query.occasion) {
        filters.push({ occasion: buildExactRegex(query.occasion) });
    }

    if (query.styleTag) {
        filters.push({ styleTags: buildExactRegex(query.styleTag) });
    }

    if (query.productType) {
        filters.push({ productType: buildContainsRegex(query.productType) });
    }

    const minPrice = Number(query.minPrice);
    const maxPrice = Number(query.maxPrice);

    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
        const priceFilter = {};

        if (Number.isFinite(minPrice)) {
            priceFilter.$gte = minPrice;
        }

        if (Number.isFinite(maxPrice)) {
            priceFilter.$lte = maxPrice;
        }

        filters.push({ price: priceFilter });
    }

    if (!filters.length) {
        return {};
    }

    if (filters.length === 1) {
        return filters[0];
    }

    return { $and: filters };
};

const normalizeStringList = (values) =>
    Array.isArray(values)
        ? values.filter((value) => typeof value === 'string' && value.trim())
        : [];

const normalizeArrayInput = (values) => {
    if (Array.isArray(values)) {
        return values
            .filter((value) => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean);
    }

    if (typeof values === 'string') {
        return values
            .split(/[\n,]/)
            .map((value) => value.trim())
            .filter(Boolean);
    }

    return [];
};

const buildProductMedia = ({ image, images }) => {
    const mainImage = typeof image === 'string' ? image.trim() : '';
    const gallery = normalizeArrayInput(images);
    const dedupedImages = Array.from(new Set([mainImage, ...gallery].filter(Boolean)));

    return {
        image: mainImage || dedupedImages[0] || '',
        images: dedupedImages,
    };
};

const buildProductUpdatePayload = (payload) => {
    const productMedia = buildProductMedia(payload);
    const hasField = (field) => Object.prototype.hasOwnProperty.call(payload, field);

    return {
        name: hasField('name') && typeof payload.name === 'string' ? payload.name.trim() : payload.name,
        price: hasField('price') ? payload.price : undefined,
        image: hasField('image') || hasField('images') ? productMedia.image : undefined,
        images: hasField('image') || hasField('images') ? productMedia.images : undefined,
        brand: hasField('brand') && typeof payload.brand === 'string' ? payload.brand.trim() : payload.brand,
        category:
            hasField('category') && typeof payload.category === 'string'
                ? payload.category.trim()
                : payload.category,
        department:
            hasField('department') && typeof payload.department === 'string'
                ? payload.department.trim()
                : payload.department,
        description:
            hasField('description') && typeof payload.description === 'string'
                ? payload.description.trim()
                : payload.description,
        gender: hasField('gender') && typeof payload.gender === 'string' ? payload.gender.trim() : payload.gender,
        colors: hasField('colors') ? normalizeArrayInput(payload.colors) : undefined,
        sizes: hasField('sizes') ? normalizeArrayInput(payload.sizes) : undefined,
        material:
            hasField('material') && typeof payload.material === 'string'
                ? payload.material.trim()
                : payload.material,
        fit: hasField('fit') && typeof payload.fit === 'string' ? payload.fit.trim() : payload.fit,
        occasion:
            hasField('occasion') && typeof payload.occasion === 'string'
                ? payload.occasion.trim()
                : payload.occasion,
        season:
            hasField('season') && typeof payload.season === 'string'
                ? payload.season.trim()
                : payload.season,
        styleTags: hasField('styleTags') ? normalizeArrayInput(payload.styleTags) : undefined,
        productType:
            hasField('productType') && typeof payload.productType === 'string'
                ? payload.productType.trim()
                : payload.productType,
        countInStock: hasField('countInStock') ? payload.countInStock : undefined,
        isActive: hasField('isActive') ? payload.isActive : undefined,
        isNewArrival: hasField('isNewArrival') ? payload.isNewArrival : undefined,
        adminPriorityScore: hasField('adminPriorityScore') ? payload.adminPriorityScore : undefined,
        isSponsored: hasField('isSponsored') ? payload.isSponsored : undefined,
        sponsoredWeight: hasField('sponsoredWeight') ? payload.sponsoredWeight : undefined,
    };
};

const matchesSuggestionQuery = (value, query) =>
    typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase());

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    try {
        const queryLimit = req.query.limit ? Number(req.query.limit) : 10;
        const pageSize = Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : 10;
        const page = Number(req.query.pageNumber) || 1;

        const filter = buildProductQueryFilter(req.query);
        const count = await Product.countDocuments(filter);
        const products = await Product.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        res.json({ products, page, pages: Math.ceil(count / pageSize) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            ...ACTIVE_PRODUCT_FILTER,
        });

        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(500).json({ message: error.message });
    }
};

const getAdminProducts = async (req, res) => {
    try {
        const pageSize = Number(req.query.limit) || 10;
        const page = Number(req.query.pageNumber) || 1;

        const filter = buildProductQueryFilter(req.query, { includeActiveOnly: false });

        if (req.query.isActive === 'true') {
            filter.isActive = true;
        }

        if (req.query.isActive === 'false') {
            filter.isActive = false;
        }

        if (req.query.stockStatus === 'out_of_stock') {
            filter.countInStock = 0;
        }

        if (req.query.stockStatus === 'low_stock') {
            filter.countInStock = { $gt: 0, $lte: 5 };
        }

        if (req.query.stockStatus === 'in_stock') {
            filter.countInStock = { $gt: 5 };
        }

        const count = await Product.countDocuments(filter);

        const products = await Product.find(filter)
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        res.json({
            products,
            page,
            pages: Math.ceil(count / pageSize),
            total: count,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAdminProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;

        const product = await Product.findById(req.params.id);

        if (product) {
            const alreadyReviewed = product.reviews.find(
                (r) => r.user.toString() === req.user._id.toString()
            );

            if (alreadyReviewed) {
                res.status(400).json({ message: 'Product already reviewed' });
                return;
            }

            const review = {
                name: req.user.name,
                rating: Number(rating),
                comment,
                user: req.user._id,
            };

            product.reviews.push(review);
            product.numReviews = product.reviews.length;

            product.rating =
                product.reviews.reduce((acc, item) => item.rating + acc, 0) /
                product.reviews.length;

            await product.save();
            res.status(201).json({ message: 'Review added' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
    try {
        const payload = buildProductUpdatePayload(req.body);
        const {
            name,
            price,
            image,
            images,
            brand,
            category,
            department,
            countInStock,
            description,
            gender,
            colors,
            sizes,
            material,
            fit,
            occasion,
            season,
            styleTags,
            productType,
            isActive,
            isNewArrival,
            adminPriorityScore,
            isSponsored,
            sponsoredWeight,
        } = payload;

        if (!name || !image || !brand || !category || !description) {
            return res.status(400).json({
                message: 'Please provide name, image, brand, category, and description',
            });
        }

        const product = new Product({
            name,
            price,
            user: req.user._id,
            image,
            images,
            brand,
            category,
            department,
            countInStock,
            numReviews: 0,
            description,
            gender,
            colors,
            sizes,
            material,
            fit,
            occasion,
            season,
            styleTags,
            productType,
            isActive: isActive ?? true,
            isNewArrival: Boolean(isNewArrival),
            adminPriorityScore: Number(adminPriorityScore) || 0,
            isSponsored: Boolean(isSponsored),
            sponsoredWeight: Number(sponsoredWeight) || 0,
        });

        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const payload = buildProductUpdatePayload(req.body);

        product.name = payload.name ?? product.name;
        product.price = payload.price ?? product.price;
        product.image = payload.image || product.image;
        product.images = payload.images ?? product.images;
        product.brand = payload.brand ?? product.brand;
        product.category = payload.category ?? product.category;
        product.department = payload.department ?? product.department;
        product.countInStock = payload.countInStock ?? product.countInStock;
        product.description = payload.description ?? product.description;
        product.gender = payload.gender ?? product.gender;
        product.colors = payload.colors ?? product.colors;
        product.sizes = payload.sizes ?? product.sizes;
        product.material = payload.material ?? product.material;
        product.fit = payload.fit ?? product.fit;
        product.occasion = payload.occasion ?? product.occasion;
        product.season = payload.season ?? product.season;
        product.styleTags = payload.styleTags ?? product.styleTags;
        product.productType = payload.productType ?? product.productType;
        product.isActive = payload.isActive ?? product.isActive;
        product.isNewArrival = payload.isNewArrival ?? product.isNewArrival;
        product.adminPriorityScore = payload.adminPriorityScore ?? product.adminPriorityScore;
        product.isSponsored = payload.isSponsored ?? product.isSponsored;
        product.sponsoredWeight = payload.sponsoredWeight ?? product.sponsoredWeight;
        product.user = product.user || req.user._id;

        const updatedProduct = await product.save();

        res.json(updatedProduct);
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(500).json({ message: error.message });
    }
};

const deactivateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.isActive = false;

        const updatedProduct = await product.save();

        res.json({
            message: 'Product deactivated',
            product: updatedProduct,
        });
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(500).json({ message: error.message });
    }
};

const updateProductStock = async (req, res) => {
    try {
        const { countInStock } = req.body;

        if (countInStock === undefined) {
            return res.status(400).json({ message: 'countInStock is required' });
        }

        if (!Number.isInteger(Number(countInStock)) || Number(countInStock) < 0) {
            return res.status(400).json({
                message: 'countInStock must be a whole number greater than or equal to 0',
            });
        }

        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.countInStock = Number(countInStock);

        const updatedProduct = await product.save();

        res.json({
            message: 'Stock updated',
            product: updatedProduct,
        });
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(500).json({ message: error.message });
    }
};

// @desc    Get product suggestions
// @route   GET /api/products/search/suggestions
// @access  Public
const getProductSuggestions = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || !q.trim()) {
            return res.json([]);
        }

        const filter = buildProductQueryFilter({ keyword: q });
        const products = await Product.find(filter)
            .select(
                'name category brand department colors sizes styleTags occasion season productType'
            )
            .sort({ createdAt: -1, _id: -1 })
            .limit(12)
            .lean();

        const suggestions = new Set();

        if ('electronics'.includes(q.toLowerCase())) {
            suggestions.add('Electronics');
        }

        products.forEach((product) => {
            const department = normalizeDepartmentLabel(product.department);
            const values = [
                product.name,
                product.category,
                product.brand,
                department,
                product.occasion,
                product.season,
                product.productType,
                ...normalizeStringList(product.colors),
                ...normalizeStringList(product.sizes),
                ...normalizeStringList(product.styleTags),
            ];

            values.forEach((value) => {
                if (matchesSuggestionQuery(value, q)) {
                    suggestions.add(
                        department === value
                            ? department.charAt(0).toUpperCase() + department.slice(1)
                            : value
                    );
                }
            });
        });

        res.json(Array.from(suggestions).slice(0, 10));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export {
    getProducts,
    getProductById,
    getAdminProducts,
    getAdminProductById,
    createProductReview,
    createProduct,
    updateProduct,
    deactivateProduct,
    updateProductStock,
    getProductSuggestions,
};
