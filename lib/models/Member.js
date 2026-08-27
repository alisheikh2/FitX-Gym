import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    cnic: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    assignedCoach: {
      type: String,
      enum: ['Zohaib Ali', 'Arslan Ahmad', 'Muazam', 'Iqra Zahid', ''],
      default: '',
    },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    planName: { type: String, default: '' },
    planPrice: { type: Number, default: 0 },
    joinDate: { type: Date, default: Date.now },
    startDate: { type: Date, default: Date.now }, // kept for backward-compat
    expiryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'frozen'],
      default: 'active',
    },
    notes: { type: String, default: '' },
    joinedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

memberSchema.index({ phone: 1 });
memberSchema.index({ status: 1 });
memberSchema.index({ expiryDate: 1 });

export default mongoose.model('Member', memberSchema);
