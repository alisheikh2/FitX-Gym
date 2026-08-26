import express from 'express';
import { protect } from '../middleware/auth.js';
import models from '../config/models.js';
const { Attendance, Member } = models;

const router = express.Router();

// GET check-ins
router.get('/', protect, async (req, res) => {
  const { search, date } = req.query;
  const query = {};
  if (date) {
    const d = new Date(date);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    query.checkIn = { $gte: d, $lt: next };
  }
  if (search) {
    query.memberName = { $regex: search, $options: 'i' };
  }
  const logs = await Attendance.find(query).sort({ checkIn: -1 }).limit(200);
  res.json(logs);
});

// POST check-in
router.post('/', protect, async (req, res) => {
  try {
    const { memberId } = req.body;
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    // Expiry check: compare YYYY-MM-DD strings safely vs today
    const todayStr = new Date().toISOString().slice(0,10);
    const expStr = typeof member.expiryDate === 'string' ? member.expiryDate.slice(0,10) : new Date(member.expiryDate).toISOString().slice(0,10);
    if (member.status !== 'active' || expStr < todayStr) {
      return res.status(400).json({ message: 'Membership inactive or expired' });
    }
    // Prevent duplicate check-in today
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate()+1);
    const existing = await Attendance.find({
      member: member._id,
      createdAt: { $gte: todayStart, $lt: tomorrow },
    });
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: 'Already checked in today', log: existing[0] });
    }
    const now = new Date();
    const log = await Attendance.create({
      member: member._id,
      memberName: member.name,
      checkIn: now,
      checkedInBy: req.user._id,
    });
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Stats
router.get('/stats', protect, async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCount = await Attendance.countDocuments({ createdAt: { $gte: today } });
  const total = await Attendance.countDocuments();
  res.json({ today: todayCount, total });
});

export default router;
