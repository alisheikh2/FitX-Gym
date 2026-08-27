import express from 'express';
import { protect } from '../middleware/auth.js';
import models from '../config/models.js';
const { Payment, Member } = models;
import { generateReceiptNumber, buildReceiptPDF } from '../utils/helpers.js';

const router = express.Router();

// GET list
router.get('/', protect, async (req, res) => {
  try {
    const { range } = req.query;
    let startDate = new Date(0);
    if (range === 'today') {
      const d = new Date(); d.setHours(0,0,0,0); startDate = d;
    } else if (range === 'month') {
      const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); startDate = d;
    }
    const payments = await Payment.find({ createdAt: { $gte: startDate } })
      .sort({ createdAt: -1 }).limit(200);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET revenue stats — optimized: run all 7 daily aggregates in PARALLEL
router.get('/stats', protect, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel — this was the main cause of slow dashboard.
    const [todayAgg, monthAgg, methodAgg, coachAgg, sevenDays] = await Promise.all([
      Payment.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } },
      ]),
      Member.aggregate([
        { $match: { status: 'active', assignedCoach: { $nin: ['', null] } } },
        { $group: { _id: '$assignedCoach', clients: { $sum: 1 } } },
        { $sort: { clients: -1 } },
      ]),
      // Parallel 7-day buckets — build all 7 match specs and run concurrently
      Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6-i));
          const end = new Date(d); end.setDate(end.getDate()+1);
          return Payment.aggregate([
            { $match: { createdAt: { $gte: d, $lt: end } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ]).then(r => ({
            date: d.toLocaleDateString('en-PK', { weekday: 'short' }),
            revenue: r[0]?.total || 0,
            count: r[0]?.count || 0,
          }));
        })
      ),
    ]);

    // Filter out null/blank methods from byMethod
    const cleanMethods = (methodAgg || []).filter(m => m._id && m._id !== '');

    res.json({
      today: todayAgg[0]?.total || 0,
      todayCount: todayAgg[0]?.count || 0,
      month: monthAgg[0]?.total || 0,
      monthCount: monthAgg[0]?.count || 0,
      byMethod: cleanMethods,
      byCoach: coachAgg || [],
      last7Days: sevenDays,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST — record payment (POS)
router.post('/', protect, async (req, res) => {
  try {
    const receiptNumber = generateReceiptNumber();
    // Default paymentMethod to 'cash' if missing or invalid
    let method = req.body.paymentMethod || req.body.method || 'cash';
    if (!['cash','card','easypaisa','jazzcash','bank'].includes(method)) method = 'cash';
    const amount = Number(req.body.amount) || 0;

    const payment = await Payment.create({
      member: req.body.memberId || undefined,
      memberName: req.body.memberName || '',
      planName: req.body.planName || '',
      amount,
      paymentMethod: method,
      type: ['membership','daypass','supplement','merch','other'].includes(req.body.type) ? req.body.type : 'other',
      note: req.body.note || '',
      receiptNumber,
      receivedBy: req.user._id,
    });

    // If membership payment + member provided, extend member expiry
    if (req.body.memberId && req.body.type === 'membership' && req.body.extendDays) {
      try {
        const extendDays = Number(req.body.extendDays);
        const MemberModel = Member;
        // Use findOneAndUpdate-style for cross-mode safety (works for Mongoose + in-memory).
        const member = await MemberModel.findById(req.body.memberId);
        if (member) {
          const now = new Date();
          let current;
          if (member.expiryDate instanceof Date) current = member.expiryDate;
          else { current = new Date(member.expiryDate); if (isNaN(current.getTime())) current = now; }
          const base = current > now ? current : now;
          const newExpiry = new Date(base.getTime() + extendDays * 24*60*60*1000);
          // Prefer findByIdAndUpdate if available (works for both Mongoose + our memory store)
          if (typeof MemberModel.findByIdAndUpdate === 'function') {
            await MemberModel.findByIdAndUpdate(req.body.memberId, {
              expiryDate: newExpiry,
              status: 'active',
              ...(req.body.planName ? { planName: req.body.planName } : {}),
              ...(amount ? { planPrice: amount } : {}),
            });
          } else if (typeof member.save === 'function') {
            member.expiryDate = newExpiry;
            member.status = 'active';
            if (req.body.planName) member.planName = req.body.planName;
            if (amount) member.planPrice = amount;
            await member.save();
          }
        }
      } catch (e) {
        // Don't fail the whole payment if member extension fails
        console.warn('Could not extend member expiry:', e.message);
      }
    }

    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// CSV export
router.get('/export/csv', protect, async (req, res) => {
  const payments = await Payment.find().sort({ createdAt: -1 }).limit(1000);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=fitx-payments.csv');
  res.write('\uFEFF');
  res.write('Receipt #,Date & Time,Type,Member/Customer,Plan,Amount (PKR),Method,Note\n');
  payments.forEach(p => {
    const d = new Date(p.createdAt);
    const ds = d.toISOString().replace('T',' ').slice(0,19);
    const method = p.paymentMethod || p.method || '';
    res.write(`"${p.receiptNumber}","${ds}","${p.type||''}","${(p.memberName||'').replace(/"/g,'""')}","${(p.planName||'').replace(/"/g,'""')}",${p.amount||0},"${method}","${(p.note||'').replace(/"/g,'""')}"\n`);
  });
  res.end();
});

// GET receipt PDF
router.get('/:id/receipt', protect, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).send('Not found');
    const pdf = await buildReceiptPDF(payment);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${payment.receiptNumber}.pdf`);
    res.send(pdf);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).send('Not found');
    res.status(500).json({ message: err.message });
  }
});

export default router;
