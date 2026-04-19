import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import ensureInitialSuperAdmin from './ensureSuperAdmin.js';

dotenv.config();

await connectDB();
await ensureInitialSuperAdmin();
console.log('[bootstrap] Super admin bootstrap check completed');
process.exit(0);
