import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('Tip: This often indicates a DNS issue or IP whitelist problem.');
      console.error('Try changing your DNS to 8.8.8.8 or check your MongoDB Atlas dashboard.');
    }
    process.exit(1);
  }
};

export default connectDB;
