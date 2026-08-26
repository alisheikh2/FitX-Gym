import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    memberName: { type: String, required: true },
    checkIn: { type: Date, default: Date.now },
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

attendanceSchema.index({ checkIn: -1 });
attendanceSchema.index({ member: 1 });

export default mongoose.model('Attendance', attendanceSchema);
