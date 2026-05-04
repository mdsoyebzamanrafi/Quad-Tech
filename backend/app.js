import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import faqRoutes from './routes/faqRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('API is running...');
});

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/friends', friendRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
