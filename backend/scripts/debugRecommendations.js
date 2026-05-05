import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Wishlist from '../models/Wishlist.js';
import Friendship from '../models/Friendship.js';
import { getPersonalRecommendations } from '../services/personalRecommendationService.js';
import { USER_ROLES } from '../constants/domainConstants.js';

dotenv.config();

const printRecommendation = (recommendation, index) => {
    const product = recommendation.product || {};

    console.log(`\nRecommendation ${index + 1}`);
    console.log(`  Name: ${product.name || 'Unknown'}`);
    console.log(`  Department: ${product.department || 'electronics'}`);
    console.log(`  Category: ${product.category || 'Unknown'}`);
    console.log(`  Brand: ${product.brand || 'Unknown'}`);
    console.log(`  Price: ${Number(product.price || 0)}`);
    console.log(`  Stock: ${Number(product.countInStock || 0)}`);
    console.log(`  Final Score: ${Number(recommendation.finalScore || 0)}`);
    console.log('  Score Breakdown:', recommendation.scoreBreakdown || {});
    console.log('  Reasons:', Array.isArray(recommendation.reasons) ? recommendation.reasons.slice(0, 3) : []);
};

const findBestDebugUser = async () => {
    const users = await User.find({
        role: { $nin: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN] },
        deletedAt: null,
    })
        .sort({ lastLogin: -1, createdAt: 1 })
        .lean();

    let fallbackUser = users[0] || null;

    for (const user of users) {
        const [orderCount, wishlistDocument, acceptedFriendshipCount] = await Promise.all([
            Order.countDocuments({ user: user._id }),
            Wishlist.findOne({ user: user._id }).lean(),
            Friendship.countDocuments({
                status: 'accepted',
                $or: [{ requester: user._id }, { recipient: user._id }],
            }),
        ]);

        const wishlistCount = Array.isArray(wishlistDocument?.items) ? wishlistDocument.items.length : 0;

        if (orderCount > 0 || wishlistCount > 0 || acceptedFriendshipCount > 0) {
            return user;
        }
    }

    if (fallbackUser) {
        return fallbackUser;
    }

    return User.findOne({ deletedAt: null }).sort({ createdAt: 1 }).lean();
};

const run = async () => {
    try {
        await connectDB();

        const user = await findBestDebugUser();

        if (!user) {
            console.log('No users found. Debug run skipped.');
            return;
        }

        const result = await getPersonalRecommendations(user._id);

        console.log('Selected user:', {
            name: user.name,
            email: user.email,
            role: user.role,
        });
        console.log('Context summary:', result.contextSummary || {});
        console.log('Recommendation count:', Array.isArray(result.recommendations) ? result.recommendations.length : 0);

        (result.recommendations || []).forEach((recommendation, index) => {
            printRecommendation(recommendation, index);
        });
    } catch (error) {
        console.error('debug:recommendations failed:', error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

run();
