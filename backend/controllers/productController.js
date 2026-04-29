import Product from '../models/Product.js';

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    try {
        // Accept an optional limit from the query string, default to 10
        const queryLimit = req.query.limit ? Number(req.query.limit) : 10;
        const pageSize = queryLimit;
        const page = Number(req.query.pageNumber) || 1;

        const keyword = req.query.keyword
            ? {
                name: {
                    $regex: req.query.keyword,
                    $options: 'i',
                },
            }
            : {};

        const filter = {
            ...keyword,
            $or: [{ isActive: true }, { isActive: { $exists: false } }],
        };

        const count = await Product.countDocuments(filter);
        const products = await Product.find(filter)
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
            $or: [{ isActive: true }, { isActive: { $exists: false } }],
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

        const keyword = req.query.keyword
            ? {
                name: {
                    $regex: req.query.keyword,
                    $options: 'i',
                },
            }
            : {};

        const filter = { ...keyword };

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
        const {
            name,
            price,
            image,
            brand,
            category,
            countInStock,
            description,
            isActive,
        } = req.body;

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
            brand,
            category,
            countInStock,
            numReviews: 0,
            description,
            isActive: isActive ?? true,
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

        product.name = req.body.name ?? product.name;
        product.price = req.body.price ?? product.price;
        product.image = req.body.image ?? product.image;
        product.brand = req.body.brand ?? product.brand;
        product.category = req.body.category ?? product.category;
        product.countInStock = req.body.countInStock ?? product.countInStock;
        product.description = req.body.description ?? product.description;
        product.isActive = req.body.isActive ?? product.isActive;

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
        if (!q) return res.json([]);

        const products = await Product.find({
            $and: [
                { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
                {
                    $or: [
                        { name: { $regex: q, $options: 'i' } },
                        { category: { $regex: q, $options: 'i' } }
                    ]
                }
            ]
        }).select('name category').limit(10);

        // Extract names and categories and deduplicate
        const suggestions = new Set();
        products.forEach(p => {
            if (p.name.toLowerCase().includes(q.toLowerCase())) suggestions.add(p.name);
            if (p.category.toLowerCase().includes(q.toLowerCase())) suggestions.add(p.category);
        });

        res.json(Array.from(suggestions).slice(0, 8));
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
