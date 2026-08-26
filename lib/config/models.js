// Unified model access — returns real Mongoose models when connected to MongoDB,
// otherwise returns in-memory mocks with the same API surface.
// Must be imported AFTER connectDB() has been awaited (api/index.js does this).
import mongoose from 'mongoose';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import Member from '../models/Member.js';
import Payment from '../models/Payment.js';
import Attendance from '../models/Attendance.js';
import { buildModel, db } from './memoryStore.js';
import { seedMemoryDefaults } from './seed.js';

function memModel(name) {
  const collMap = { User: 'users', Plan: 'plans', Member: 'members', Payment: 'payments', Attendance: 'attendances' };
  const coll = collMap[name] || name.toLowerCase() + 's';
  if (!db[coll]) db[coll] = [];
  return buildModel(db[coll], name);
}

// Decide mode based on active mongoose connection state
function isMemoryMode() {
  return !mongoose.connection || mongoose.connection.readyState !== 1;
}

function getModels() {
  const mem = isMemoryMode();
  if (mem) {
    // Ensure in-memory defaults are seeded (connectDB already calls this,
    // but safe-guard if models are imported before connectDB resolves).
    seedMemoryDefaults();
    return {
      User: memModel('User'),
      Plan: memModel('Plan'),
      Member: memModel('Member'),
      Payment: memModel('Payment'),
      Attendance: memModel('Attendance'),
      isMemoryMode: true,
    };
  }
  return { User, Plan, Member, Payment, Attendance, isMemoryMode: false };
}

// Proxy so that `import models from '...'; models.User` works whether accessed
// immediately or later.
const models = new Proxy({}, {
  get(_t, prop) {
    return getModels()[prop];
  },
});

export default models;
