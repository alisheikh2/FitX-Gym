import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    durationDays: { type: Number, required: true }, // e.g. 30, 90, 365
    price: { type: Number, required: true }, // PKR
    category: {
      type: String,
      enum: ['gym', 'pt', 'couple', 'student', 'female', 'other'],
      default: 'gym',
    },
    includesPT: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Plan', planSchema);
