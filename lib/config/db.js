import mongoose from 'mongoose';
import { seedMongoDefaults, seedMemoryDefaults } from './seed.js';

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log('ℹ️  Demo mode active (set MONGO_URI to enable persistent storage).');
    seedMemoryDefaults();
    return { mode: 'memory' };
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
    await seedMongoDefaults();
    return { mode: 'mongo' };
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message.split('\n')[0]}`);
    console.error('   App will exit. Check MONGO_URI (whitelist 0.0.0.0/0 in Atlas, correct user/pass, cluster name).');
    process.exit(1);
  }
};

export default connectDB;
