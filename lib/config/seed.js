// Seed defaults for both in-memory and MongoDB modes.
// Safe to call on every boot — only inserts when collections are empty.
import bcrypt from 'bcryptjs';
import { db, uid } from './memoryStore.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import Member from '../models/Member.js';
import Payment from '../models/Payment.js';
import Attendance from '../models/Attendance.js';

const DEFAULT_PLANS = [
  { name: 'Day Pass', description: 'Single-day gym access', durationDays: 1, price: 500, category: 'gym', includesPT: false },
  { name: 'Monthly Gym Access', description: 'Full gym access, no personal training', durationDays: 30, price: 3500, category: 'gym', includesPT: false },
  { name: 'Quarterly Gym Access', description: '3 months gym access', durationDays: 90, price: 9000, category: 'gym', includesPT: false },
  { name: 'Monthly PT Package', description: 'Gym access + one-on-one personal training', durationDays: 30, price: 12000, category: 'pt', includesPT: true },
  { name: 'Quarterly PT Package', description: '3 months personal training package', durationDays: 90, price: 32000, category: 'pt', includesPT: true },
  { name: "Women's Monthly PT", description: 'Women-only coaching with Iqra Zahid', durationDays: 30, price: 10000, category: 'female', includesPT: true },
  { name: 'Student Monthly', description: 'Discounted monthly access for students', durationDays: 30, price: 2500, category: 'student', includesPT: false },
  { name: 'Couple Monthly', description: 'Two memberships at a discounted rate', durationDays: 30, price: 6000, category: 'couple', includesPT: false },
];

const DEFAULT_USERS = [
  { username: 'owner', password: 'fitx2026', name: 'Zohaib Ali', role: 'owner' },
  { username: 'staff', password: 'staff2026', name: 'Front Desk', role: 'staff' },
];

// ----------------------- In-memory seeding -----------------------
export function seedMemoryDefaults() {
  if (db.users.length === 0) {
    DEFAULT_USERS.forEach(u => {
      db.users.push({ _id: uid(), ...u, createdAt: new Date(), updatedAt: new Date() });
    });
  }
  if (db.plans.length === 0) {
    DEFAULT_PLANS.forEach(p => {
      db.plans.push({ _id: uid(), active: true, createdAt: new Date(), updatedAt: new Date(), ...p });
    });
  }
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
