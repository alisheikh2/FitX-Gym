// Unified model access — returns real Mongoose model when MONGO_URI is set,
// otherwise returns an in-memory mock with the same API surface.
// Import models from THIS file in all routes/controllers, never from mongoose directly.
import mongoose from 'mongoose';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import Member from '../models/Member.js';
import Payment from '../models/Payment.js';
import Attendance from '../models/Attendance.js';
import { buildModel, seedDefaults, db } from './memoryStore.js';

const USE_MEMORY = !process.env.MONGO_URI;

if (USE_MEMORY) {
  console.log('\n⚠️  DEMO MODE: Using in-memory data store (no MONGO_URI set).');
  console.log('   Set MONGO_URI to a MongoDB connection string for persistent data.\n');
}

function memModel(name) {
  const collMap = { User: 'users', Plan: 'plans', Member: 'members', Payment: 'payments', Attendance: 'attendances' };
  const coll = collMap[name] || name.toLowerCase() + 's';
  if (!db[coll]) db[coll] = [];
  return buildModel(db[coll], name);
}

seedDefaults();

export default {
  User: USE_MEMORY ? memModel('User') : User,
  Plan: USE_MEMORY ? memModel('Plan') : Plan,
  Member: USE_MEMORY ? memModel('Member') : Member,
  Payment: USE_MEMORY ? memModel('Payment') : Payment,
  Attendance: USE_MEMORY ? memModel('Attendance') : Attendance,
  isMemoryMode: USE_MEMORY,
};
