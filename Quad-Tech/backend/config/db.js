import mongoose from 'mongoose';

let dbConnected = false;

export const isDatabaseConnected = () => dbConnected;

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI?.trim();
  const allowStartWithoutDb = process.env.ALLOW_START_WITHOUT_DB === 'true';

  if (!mongoUri) {
    dbConnected = false;
    const message = 'MONGO_URI is not set in backend/.env';
    if (allowStartWithoutDb) {
      console.warn(`${message}. Continuing startup because ALLOW_START_WITHOUT_DB=true.`);
      return false;
    }
    throw new Error(message);
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    dbConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    dbConnected = false;
    console.error(`Database Connection Error: ${error.message}`);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('Tip: This often indicates a DNS issue or IP whitelist problem.');
      console.error('Try changing your DNS to 8.8.8.8 or check your MongoDB Atlas dashboard.');
    }
    if (allowStartWithoutDb) {
      console.warn('Continuing startup without database because ALLOW_START_WITHOUT_DB=true.');
      return false;
    }
    throw error;
  }
};

export default connectDB;
