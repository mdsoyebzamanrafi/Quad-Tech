import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/Product.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const formatMoney = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 'N/A';
    }

    return value.toFixed(2);
};

const printSection = (title) => {
    console.log(`\n${'='.repeat(64)}`);
    console.log(title);
    console.log('='.repeat(64));
};

const printCountRows = (title, rows) => {
    printSection(title);

    if (!rows.length) {
        console.log('None found.');
        return;
    }

    rows.forEach((row) => {
        console.log(`- ${row._id || 'Unspecified'}: ${row.count}`);
    });
};

const getGroupedCounts = (field, fallbackValue) =>
    Product.aggregate([
        {
            $group: {
                _id: fallbackValue ? { $ifNull: [`$${field}`, fallbackValue] } : `$${field}`,
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1, _id: 1 } },
    ]);

const getDistinctFashionValues = async (field) => {
    const values = await Product.aggregate([
        { $match: { department: 'fashion' } },
        { $project: { values: `$${field}` } },
        { $unwind: '$values' },
        {
            $group: {
                _id: '$values',
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return values.map((row) => row._id).filter(Boolean);
};

const printSimpleList = (title, values) => {
    printSection(title);

    if (!values.length) {
        console.log('None found.');
        return;
    }

    values.forEach((value) => {
        console.log(`- ${value}`);
    });
};

const printSampleProducts = (title, products) => {
    printSection(title);

    if (!products.length) {
        console.log('None found.');
        return;
    }

    products.forEach((product, index) => {
        const department = product.department || 'electronics';
        console.log(
            `${index + 1}. ${product.name} | ${department} | ${product.category} | ${product.brand} | Price: ${formatMoney(product.price)} | Stock: ${product.countInStock}`
        );
    });
};

const runInspection = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is missing. Add it to backend/.env before running this script.');
    }

    await mongoose.connect(process.env.MONGO_URI);

    printSection('MongoDB Product Inspection');
    console.log(`Connected to database: ${mongoose.connection.name}`);

    const [
        totalProducts,
        productsByDepartment,
        productsByCategory,
        productsByBrand,
        priceStats,
        stockStats,
        sampleElectronics,
        sampleFashion,
        uniqueFashionColors,
        uniqueFashionSizes,
        uniqueFashionStyleTags,
        uniqueFashionOccasions,
        uniqueFashionSeasons,
    ] = await Promise.all([
        Product.countDocuments(),
        getGroupedCounts('department', 'electronics'),
        getGroupedCounts('category'),
        getGroupedCounts('brand'),
        Product.aggregate([
            {
                $group: {
                    _id: null,
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' },
                    avgPrice: { $avg: '$price' },
                },
            },
        ]),
        Product.aggregate([
            {
                $group: {
                    _id: null,
                    inStockCount: {
                        $sum: {
                            $cond: [{ $gt: ['$countInStock', 0] }, 1, 0],
                        },
                    },
                    outOfStockCount: {
                        $sum: {
                            $cond: [{ $lte: ['$countInStock', 0] }, 1, 0],
                        },
                    },
                    lowStockCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$countInStock', 0] },
                                        { $lte: ['$countInStock', 5] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]),
        Product.find({
            $or: [
                { department: 'electronics' },
                { department: { $exists: false } },
                { department: null },
                { department: '' },
            ],
        })
            .select('name brand category price countInStock department')
            .sort({ createdAt: -1, name: 1 })
            .limit(5)
            .lean(),
        Product.find({ department: 'fashion' })
            .select('name brand category price countInStock department')
            .sort({ createdAt: -1, name: 1 })
            .limit(5)
            .lean(),
        getDistinctFashionValues('colors'),
        getDistinctFashionValues('sizes'),
        getDistinctFashionValues('styleTags'),
        Product.distinct('occasion', { department: 'fashion', occasion: { $nin: [null, ''] } }),
        Product.distinct('season', { department: 'fashion', season: { $nin: [null, ''] } }),
    ]);

    printSection('Overview');
    console.log(`Total product count: ${totalProducts}`);

    const [priceSummary = {}] = priceStats;
    const [stockSummary = {}] = stockStats;

    printCountRows('Products by Department', productsByDepartment);
    printCountRows('Products by Category', productsByCategory);
    printCountRows('Products by Brand', productsByBrand);

    printSection('Price Statistics');
    console.log(`Minimum price: ${formatMoney(priceSummary.minPrice)}`);
    console.log(`Maximum price: ${formatMoney(priceSummary.maxPrice)}`);
    console.log(`Average price: ${formatMoney(priceSummary.avgPrice)}`);

    printSection('Stock Statistics');
    console.log(`In stock count: ${stockSummary.inStockCount ?? 0}`);
    console.log(`Out of stock count: ${stockSummary.outOfStockCount ?? 0}`);
    console.log(`Low stock count (1 to 5 units): ${stockSummary.lowStockCount ?? 0}`);

    printSampleProducts('Sample Electronics Products', sampleElectronics);
    printSampleProducts('Sample Fashion Products', sampleFashion);

    printSimpleList('Unique Fashion Colors', uniqueFashionColors);
    printSimpleList('Unique Fashion Sizes', uniqueFashionSizes);
    printSimpleList('Unique Fashion Style Tags', uniqueFashionStyleTags);
    printSimpleList('Unique Fashion Occasions', uniqueFashionOccasions.sort((a, b) => a.localeCompare(b)));
    printSimpleList('Unique Fashion Seasons', uniqueFashionSeasons.sort((a, b) => a.localeCompare(b)));
};

try {
    await runInspection();
} catch (error) {
    console.error('\nProduct inspection failed.');
    console.error(error.message);
    process.exitCode = 1;
} finally {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log('\nMongoDB connection closed.');
    }
}
