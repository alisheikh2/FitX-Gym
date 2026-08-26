import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect } from '../middleware/auth.js';
import models from '../config/models.js';
const { Member, Plan } = models;

const router = express.Router();

// GET /api/members — list, search, filter
router.get('/', protect, async (req, res) => {
  try {
    const { search, status, coach } = req.query;
    const query = {};
    if (status) query.status = status;
    if (coach) query.assignedCoach = coach;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const members = await Member.find(query).sort({ createdAt: -1 }).limit(500);
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/members/stats — dashboard numbers
router.get('/stats', protect, async (req, res) => {
  try {
    const all = await Member.find();
    const todayStr = new Date().toISOString().slice(0,10);
    const in30Str = new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10);
    let active = 0, expired = 0, expiringSoon = 0;
    all.forEach(m => {
      const exp = (m.expiryDate ? (typeof m.expiryDate==='string'?m.expiryDate:new Date(m.expiryDate).toISOString().slice(0,10)) : '').slice(0,10);
      if (m.status === 'active' && exp >= todayStr) {
        active++;
        if (exp <= in30Str) expiringSoon++;
      } else if (exp && exp < todayStr) {
        expired++;
      }
    });
    res.json({ total: all.length, active, expired, expiringSoon });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/members — create
router.post(
  '/',
  protect,
  [body('name').notEmpty(), body('phone').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      let planData = {};
      let computedExpiry = req.body.expiryDate || null;
      if (req.body.planId) {
        const plan = await Plan.findById(req.body.planId);
        if (plan) {
          planData = {
            plan: plan._id,
            planName: plan.name,
            planPrice: plan.price,
          };
          if (!computedExpiry && plan.durationDays) {
            const start = req.body.joinDate ? new Date(req.body.joinDate) : new Date();
            const exp = new Date(start);
            exp.setDate(exp.getDate() + plan.durationDays);
            computedExpiry = exp.toISOString().slice(0, 10);
          }
        }
      }
      if (!computedExpiry) {
        // default 30 days from join date
        const start = req.body.joinDate ? new Date(req.body.joinDate) : new Date();
        const exp = new Date(start);
        exp.setDate(exp.getDate() + 30);
        computedExpiry = exp.toISOString().slice(0, 10);
      }
      const member = await Member.create({
        status: 'active',
        ...req.body,
        ...planData,
        expiryDate: computedExpiry,
        joinedBy: req.user._id,
      });
      res.status(201).json({ member });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// GET /api/members/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/members/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    Object.assign(member, req.body);
    await member.save();
    res.json(member);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/members/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    await Member.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CSV export
router.get('/export/csv', protect, async (req, res) => {
  const members = await Member.find().sort({ createdAt: -1 }).limit(1000);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=fitx-members.csv');
  res.write('\uFEFF'); // BOM for Excel Urdu/ASCII compat
  res.write('Name,Phone,Gender,Coach,Plan,Plan Price,Join Date,Expiry,Status\n');
  members.forEach(m => {
    const join = m.joinDate ? (typeof m.joinDate === 'string' ? m.joinDate : new Date(m.joinDate).toISOString().slice(0,10)) : '';
    const exp = m.expiryDate ? (typeof m.expiryDate === 'string' ? m.expiryDate : new Date(m.expiryDate).toISOString().slice(0,10)) : '';
    res.write(`"${m.name}","${m.phone}","${m.gender || ''}","${m.assignedCoach || ''}","${m.planName || ''}",${m.planPrice || ''},"${join}","${exp}","${m.status || ''}"\n`);
  });
  res.end();
});

export default router;
