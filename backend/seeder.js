import dotenv from 'dotenv';
import users from './data/users.js';
import products from './data/products.js';
import User from './models/User.js';
import Product from './models/Product.js';
import Order from './models/Order.js';
import OrderItem from './models/OrderItem.js';
import AuditLog from './models/AuditLog.js';
import Cart from './models/Cart.js';
import connectDB from './config/db.js';

dotenv.config();

await connectDB();

const clearCollections = async () => {
    await Promise.all([
        OrderItem.deleteMany(),
        Order.deleteMany(),
        AuditLog.deleteMany(),
        Cart.deleteMany(),
        Product.deleteMany(),
        User.deleteMany(),
    ]);
};

const importData = async () => {
    try {
        await clearCollections();

        const createdUsers = await User.insertMany(users);
        const owner = createdUsers[0]._id;

        const sampleProducts = products.map((product) => ({
            ...product,
            user: owner,
        }));

        await Product.insertMany(sampleProducts);

        console.log('Data Imported!');
        process.exit(0);
    } catch (error) {
        console.error(`Error with seeding data: ${error}`);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await clearCollections();

        console.log('Data Destroyed!');
        process.exit(0);
    } catch (error) {
        console.error(`Error with destroying data: ${error}`);
        process.exit(1);
    }
};

if (process.argv[2] === '-d') {
    destroyData();
} else {
    importData();
}
