// Seed defaults for both in-memory and MongoDB modes.
// Safe to call on every boot — only inserts when collections are empty.
import bcrypt from 'bcryptjs';
import { db, uid } from './memoryStore.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import Member from '../models/Member.js';
import Payment from '../models/Payment.js';
import Attendance from '../models/Attendance.js';

const DEFAULT_USERS = [
  // Fixed _id strings so that JWT tokens issued during a cold-boot of demo /
  // in-memory mode stay valid across server restarts (otherwise every cold
  // boot re-rolls random IDs → every saved token returns "User not found" →
  // the user is logged out after a few minutes of inactivity on Vercel).
  { _id: 'user-owner-0001', username: 'owner', password: 'fitx2026', name: 'Zohaib Ali', role: 'owner' },
  { _id: 'user-staff-0002', username: 'staff', password: 'staff2026', name: 'Front Desk', role: 'staff' },
];

// Fixed IDs for default plans too so planId references don't break between cold starts
const DEFAULT_PLANS = [
  { _id: 'plan-daypass-01', name: 'Day Pass', description: 'Single-day gym access', durationDays: 1, price: 500, category: 'gym', includesPT: false },
  { _id: 'plan-mgym-02', name: 'Monthly Gym Access', description: 'Full gym access, no personal training', durationDays: 30, price: 3500, category: 'gym', includesPT: false },
  { _id: 'plan-qgym-03', name: 'Quarterly Gym Access', description: '3 months gym access', durationDays: 90, price: 9000, category: 'gym', includesPT: false },
  { _id: 'plan-mpt-04', name: 'Monthly PT Package', description: 'Gym access + one-on-one personal training', durationDays: 30, price: 12000, category: 'pt', includesPT: true },
  { _id: 'plan-qpt-05', name: 'Quarterly PT Package', description: '3 months personal training package', durationDays: 90, price: 32000, category: 'pt', includesPT: true },
  { _id: 'plan-wpt-06', name: "Women's Monthly PT", description: 'Women-only coaching with Iqra Zahid', durationDays: 30, price: 10000, category: 'female', includesPT: true },
  { _id: 'plan-student-07', name: 'Student Monthly', description: 'Discounted monthly access for students', durationDays: 30, price: 2500, category: 'student', includesPT: false },
  { _id: 'plan-couple-08', name: 'Couple Monthly', description: 'Two memberships at a discounted rate', durationDays: 30, price: 6000, category: 'couple', includesPT: false },
];

// ----------------------- In-memory seeding -----------------------
// Idempotent: safe to call on every boot (models.js calls it every time models
// are accessed in memory mode). Only inserts what's missing, using FIXED _ids
// from the defaults so JWT tokens don't die on cold start.
export function seedMemoryDefaults() {
  const now = new Date();
  DEFAULT_USERS.forEach(u => {
    if (!db.users.some(x => x.username === u.username || x._id === u._id)) {
      db.users.push({ ...u, createdAt: now, updatedAt: now });
    }
  });
  DEFAULT_PLANS.forEach(p => {
    if (!db.plans.some(x => x.name === p.name || x._id === p._id)) {
      db.plans.push({ active: true, createdAt: now, updatedAt: now, ...p });
    }
  });
}

// ----------------------- MongoDB seeding -----------------------
export async function seedMongoDefaults() {
  try {
    // Users — bcrypt hashing handled by User model pre('save') hook
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Seeding default users (owner/staff) in MongoDB...');
      for (const u of DEFAULT_USERS) {
        await User.create(u);
      }
      console.log('   ✅ Default users created. Login: owner/fitx2026, staff/staff2026');
    }

    // Plans
    const planCount = await Plan.countDocuments();
    if (planCount === 0) {
      console.log('🌱 Seeding default membership plans in MongoDB...');
      for (const p of DEFAULT_PLANS) {
        await Plan.create({ ...p, active: true });
      }
      console.log(`   ✅ ${DEFAULT_PLANS.length} plans created.`);
    }
  } catch (err) {
    console.error('⚠️  Seeding error (non-fatal):', err.message);
  }
}

// ----------------------- Member password hash helper -----------------------
export async function hashPasswordIfNeeded(plain) {
  // User model already has pre-save bcrypt hook, but we expose this for convenience.
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export default { seedMemoryDefaults, seedMongoDefaults };
