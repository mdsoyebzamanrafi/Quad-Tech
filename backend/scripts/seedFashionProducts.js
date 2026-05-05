import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import fashionProducts from '../data/fashionProducts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SEED_USER_ID = new mongoose.Types.ObjectId('69d780aa455e258b2e724fbf');

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

    const bulkOperations = fashionProducts.map((product) => ({
        updateOne: {
            filter: {
                name: product.name,
                category: product.category,
            },
            update: {
                $set: {
                    ...product,
                    user: SEED_USER_ID,
                    image: product.image,
                    images: Array.isArray(product.images) && product.images.length ? product.images : [product.image],
                    rating: 0,
                    numReviews: 0,
                    reviews: [],
                    isActive: true,
                },
            },
            upsert: true,
        },
    }));

    const writeResult = await Product.bulkWrite(bulkOperations, { ordered: false });

    const [finalTotalCount, finalFashionCount, finalElectronicsCount] = await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ department: 'fashion' }),
        Product.countDocuments(buildDepartmentMatch('electronics')),
    ]);

    console.log(`Seed user id: ${SEED_USER_ID}`);
    console.log(`Upserted fashion products: ${writeResult.upsertedCount || 0}`);
    console.log(`Modified fashion products: ${writeResult.modifiedCount || 0}`);
    console.log(`Matched fashion products: ${writeResult.matchedCount || 0}`);
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
