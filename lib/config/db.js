import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log('ℹ️  Demo mode active (set MONGO_URI to enable persistent storage).');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.log(`⚠️  MongoDB connection failed: ${err.message.split('\n')[0]}`);
    console.log('   Falling back to in-memory demo mode.');
    const { enableMemoryStore } = await import('./memoryStore.js');
    enableMemoryStore();
  }
};

export default connectDB;
