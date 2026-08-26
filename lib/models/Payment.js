import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    memberName: { type: String, default: '' },
    planName: { type: String, default: '' },
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'easypaisa', 'jazzcash', 'bank'],
      default: 'cash',
    },
    type: {
      type: String,
      enum: ['membership', 'daypass', 'supplement', 'merch', 'other'],
      default: 'membership',
    },
    note: { type: String, default: '' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiptNumber: { type: String, unique: true },
  },
  { timestamps: true }
);

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ member: 1 });

export default mongoose.model('Payment', paymentSchema);
