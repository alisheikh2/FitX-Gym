// FITX Studio — one-time MongoDB seeder for Vercel/Live
// Run: MONGO_URI="mongodb+srv://user:pwd@cluster0.mongodb.net/fitx?retryWrites=true&w=majority" node seed-once.mjs
//
// Ye script kya karta hai:
//  1) owner/fitx2026 (Zohaib Ali, owner role) insert karta hai agar nahi hai
//  2) staff/staff2026 (Front Desk, staff role) insert karta hai agar nahi hai
//  3) 8 default plans insert karta hai agar koi plan nahi hai
// Duplicate safe — dobara chalane se koi farq nahi padta.

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('❌ MONGO_URI environment variable set karein.');
  console.error('   Example: MONGO_URI="mongodb+srv://..." node seed-once.mjs');
  process.exit(1);
}

// ---------- Schemas (same as server/models/*.js) ----------
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['owner', 'admin', 'staff'], default: 'staff' },
  },
  { timestamps: true }
);
const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    durationDays: Number,
    price: Number,
    category: String,
    includesPT: Boolean,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);

// ---------- Default data ----------
const DEFAULT_USERS = [
  { username: 'owner', password: 'fitx2026', name: 'Zohaib Ali', role: 'owner' },
  { username: 'staff', password: 'staff2026', name: 'Front Desk', role: 'staff' },
];
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

async function run() {
  console.log('⏳ Connecting to MongoDB...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`✅ Connected to ${mongoose.connection.host}\n`);

  // --- Users ---
  let usersCreated = 0;
  for (const u of DEFAULT_USERS) {
    const exists = await User.findOne({ username: u.username });
    if (exists) {
      console.log(`  ℹ️  User "${u.username}" already exists — skipping.`);
      continue;
    }
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(u.password, salt);
    await User.create({ ...u, password: hashed });
    console.log(`  ✅ Created user "${u.username}" (${u.role}) / ${u.password}`);
    usersCreated++;
  }
  console.log(`  → ${usersCreated} new user(s).\n`);

  // --- Plans ---
  let plansCreated = 0;
  for (const p of DEFAULT_PLANS) {
    const exists = await Plan.findOne({ name: p.name });
    if (exists) {
      console.log(`  ℹ️  Plan "${p.name}" already exists — skipping.`);
      continue;
    }
    await Plan.create({ ...p, active: true });
    console.log(`  ✅ Created plan "${p.name}" — PKR ${p.price}`);
    plansCreated++;
  }
  console.log(`  → ${plansCreated} new plan(s).\n`);

  console.log('🎉 Done. Ab /admin pe owner / fitx2026 se login kar sakte ho.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
