import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect } from '../middleware/auth.js';
import models from '../config/models.js';
const { Member, Plan } = models;

const router = express.Router();

// Helper: parse a date (string/Date/undefined/null) safely into a YYYY-MM-DD string
// in PKT (UTC+5). Returns '' when invalid.
function toPKDateStr(d) {
  if (!d) return '';
  const date = (d instanceof Date) ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  // Add 5 hours for PKT, then take ISO slice
  const pkt = new Date(date.getTime() + 5*60*60*1000);
  return pkt.toISOString().slice(0,10);
}

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
    // Use PKT today for accurate status counts
    const todayStr = toPKDateStr(new Date());
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const in30Str = toPKDateStr(in30);
    const all = await Member.find().lean();
    let active = 0, expired = 0, expiringSoon = 0;
    all.forEach(m => {
      const exp = toPKDateStr(m.expiryDate);
      if (m.status === 'active' && exp && exp >= todayStr) {
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
  [body('name').notEmpty().withMessage('Name is required'), body('phone').notEmpty().withMessage('Phone is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array(), message: errors.array()[0].msg });
    try {
      // Accept either joinDate or startDate (backwards-compat with older frontend)
      const joinDateInput = req.body.joinDate || req.body.startDate || null;
      let joinDate = joinDateInput ? new Date(joinDateInput) : new Date();
      if (isNaN(joinDate.getTime())) joinDate = new Date();

      let planData = {};
      let computedExpiry = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
      if (computedExpiry && isNaN(computedExpiry.getTime())) computedExpiry = null;

      if (req.body.planId) {
        try {
          const plan = await Plan.findById(req.body.planId);
          if (plan) {
            planData = {
              plan: plan._id,
              planName: plan.name,
              planPrice: plan.price,
            };
            if (!computedExpiry && plan.durationDays) {
              const exp = new Date(joinDate);
              exp.setDate(exp.getDate() + plan.durationDays);
              computedExpiry = exp;
            }
          }
        } catch { /* invalid planId — just ignore */ }
      }
      if (!computedExpiry) {
        const exp = new Date(joinDate);
        exp.setDate(exp.getDate() + 30);
        computedExpiry = exp;
      }

      const member = await Member.create({
        status: 'active',
        name: (req.body.name||'').trim(),
        phone: (req.body.phone||'').trim(),
        cnic: (req.body.cnic||'').trim(),
        gender: req.body.gender || 'male',
        assignedCoach: req.body.assignedCoach || '',
        notes: req.body.notes || '',
        joinDate,
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
    if (err.name === 'CastError') return res.status(404).json({ message: 'Member not found' });
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/members/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    const allowed = ['name','phone','cnic','gender','assignedCoach','status','notes','planName','planPrice','expiryDate','joinDate'];
    allowed.forEach(k => {
      if (req.body[k] !== undefined) {
        if (k === 'expiryDate' || k === 'joinDate') {
          const d = new Date(req.body[k]);
          if (!isNaN(d.getTime())) member[k] = d;
        } else {
          member[k] = req.body[k];
        }
      }
    });
    await member.save();
    res.json(member);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Member not found' });
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/members/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const r = await Member.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ message: 'Member not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Member not found' });
    res.status(500).json({ message: err.message });
  }
});

// CSV export
router.get('/export/csv', protect, async (req, res) => {
  const members = await Member.find().sort({ createdAt: -1 }).limit(1000);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=fitx-members.csv');
  res.write('\uFEFF');
  res.write('Name,Phone,Gender,Coach,Plan,Plan Price,Join Date,Expiry,Status\n');
  members.forEach(m => {
    const join = toPKDateStr(m.joinDate || m.startDate);
    const exp = toPKDateStr(m.expiryDate);
    res.write(`"${m.name}","${m.phone}","${m.gender||''}","${m.assignedCoach||''}","${m.planName||''}",${m.planPrice||0},"${join}","${exp}","${m.status||''}"\n`);
  });
  res.end();
});

export default router;
