import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import fashionProducts from '../data/fashionProducts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const buildDepartmentMatch = (department) => {
    if (department === 'electronics') {
        return {
            $or: [
                { department: 'electronics' },
                { department: { $exists: false } },
                { department: null },
                { department: '' },
            ],
        };
    }

    return { department };
};

const logGroupedCounts = async (title, field, transformId = (value) => value) => {
    const groupId =
        field === 'department'
            ? { $ifNull: ['$department', 'electronics'] }
            : `$${field}`;

    const rows = await Product.aggregate([
        {
            $group: {
                _id: groupId,
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1, _id: 1 } },
    ]);

    console.log(`\n${title}`);
    rows.forEach((row) => {
        console.log(`- ${transformId(row._id) || 'Unspecified'}: ${row.count}`);
    });
};

const seedFashionProducts = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is missing. Add it to backend/.env before running this script.');
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log('Fashion seed started.');
    console.log(`Fashion products in seed file: ${fashionProducts.length}`);

    const owner = await User.findOne().sort({ createdAt: 1 }).select('_id name email').lean();

    if (!owner) {
        throw new Error('No users found. Create at least one user before seeding fashion products.');
    }

    const duplicateConditions = fashionProducts.map((product) => ({
        name: product.name,
        brand: product.brand,
        category: product.category,
    }));

    const existingProducts = await Product.find({ $or: duplicateConditions })
        .select('name brand category')
        .lean();

    const existingKeys = new Set(
        existingProducts.map((product) => `${product.name}::${product.brand}::${product.category}`)
    );

    const productsToInsert = fashionProducts
        .filter((product) => !existingKeys.has(`${product.name}::${product.brand}::${product.category}`))
        .map((product) => ({
            ...product,
            user: owner._id,
        }));

    let insertedCount = 0;

    if (productsToInsert.length > 0) {
        const insertedProducts = await Product.insertMany(productsToInsert, { ordered: false });
        insertedCount = insertedProducts.length;
    }

    const skippedCount = fashionProducts.length - insertedCount;

    const [finalTotalCount, finalFashionCount, finalElectronicsCount] = await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ department: 'fashion' }),
        Product.countDocuments(buildDepartmentMatch('electronics')),
    ]);

    console.log(`Seed owner: ${owner.name || owner.email || owner._id}`);
    console.log(`Inserted fashion products: ${insertedCount}`);
    console.log(`Skipped duplicates: ${skippedCount}`);
    console.log(`Final total product count: ${finalTotalCount}`);
    console.log(`Final fashion product count: ${finalFashionCount}`);
    console.log(`Final electronics product count: ${finalElectronicsCount}`);

    await logGroupedCounts('Products grouped by department', 'department', (value) =>
        value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Electronics'
    );
    await logGroupedCounts('Products grouped by category', 'category');
};

try {
    await seedFashionProducts();
} catch (error) {
    console.error('\nFashion product seeding failed.');
    console.error(error.message);
    process.exitCode = 1;
} finally {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log('\nMongoDB connection closed.');
    }
}
