import express from 'express';
import { protect } from '../middleware/auth.js';
import models from '../config/models.js';
const { Attendance, Member } = models;

const router = express.Router();

// PKT date helper (same as members route)
function toPKDateStr(d) {
  if (!d) return '';
  const date = (d instanceof Date) ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const pkt = new Date(date.getTime() + 5*60*60*1000);
  return pkt.toISOString().slice(0,10);
}

// GET check-ins
router.get('/', protect, async (req, res) => {
  try {
    const { search, date } = req.query;
    const query = {};
    if (date) {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(next.getDate()+1);
      query.checkIn = { $gte: d, $lt: next };
    }
    if (search) {
      query.memberName = { $regex: search, $options: 'i' };
    }
    const logs = await Attendance.find(query).sort({ checkIn: -1 }).limit(200);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST check-in
router.post('/', protect, async (req, res) => {
  try {
    const { memberId } = req.body;
    if (!memberId) return res.status(400).json({ message: 'memberId is required' });
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const todayStr = toPKDateStr(new Date());
    const expStr = toPKDateStr(member.expiryDate);

    if (member.status !== 'active') {
      return res.status(400).json({ message: `Member is ${member.status}. Activate first.` });
    }
    if (!expStr || expStr < todayStr) {
      return res.status(400).json({ message: 'Membership expired. Renew at POS.' });
    }

    // Prevent duplicate check-in today (PKT date)
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate()+1);
    const existing = await Attendance.findOne({
      member: member._id,
      createdAt: { $gte: todayStart, $lt: tomorrow },
    });
    if (existing) {
      return res.status(409).json({ message: 'Already checked in today', log: existing });
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
    if (err.name === 'CastError') return res.status(404).json({ message: 'Member not found' });
    res.status(400).json({ message: err.message });
  }
});

// Stats
router.get('/stats', protect, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [todayCount, total] = await Promise.all([
      Attendance.countDocuments({ createdAt: { $gte: today } }),
      Attendance.countDocuments(),
    ]);
    res.json({ today: todayCount, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
