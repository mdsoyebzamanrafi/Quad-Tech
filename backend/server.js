import 'dotenv/config';
import connectDB from './config/db.js';
import ensureInitialSuperAdmin from './bootstrap/ensureSuperAdmin.js';
import app from './app.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    if (process.env.SKIP_SUPER_ADMIN_BOOTSTRAP !== 'true') {
        await ensureInitialSuperAdmin();
    }

    app.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
};

startServer().catch((error) => {
    console.error('Server startup failed:', error);
    process.exit(1);
});
