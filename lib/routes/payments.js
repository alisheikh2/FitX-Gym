import express from 'express';
import { protect } from '../middleware/auth.js';
import models from '../config/models.js';
const { Payment, Member } = models;
import { generateReceiptNumber, buildReceiptPDF } from '../utils/helpers.js';

const router = express.Router();

// GET list
router.get('/', protect, async (req, res) => {
  const { range } = req.query;
  let startDate = new Date(0);
  if (range === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0); startDate = d;
  } else if (range === 'month') {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); startDate = d;
  }
  const payments = await Payment.find({ createdAt: { $gte: startDate } })
    .sort({ createdAt: -1 }).limit(200);
  res.json(payments);
});

// GET revenue stats
router.get('/stats', protect, async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayAgg, monthAgg, methodAgg, coachAgg] = await Promise.all([
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
      { $match: { status: 'active', assignedCoach: { $ne: '' } } },
      { $group: { _id: '$assignedCoach', clients: { $sum: 1 } } },
      { $sort: { clients: -1 } },
    ]),
  ]);

  // Last 7 days revenue
  const sevenDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const end = new Date(d); end.setDate(end.getDate() + 1);
    const r = await Payment.aggregate([
      { $match: { createdAt: { $gte: d, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    sevenDays.push({
      date: d.toLocaleDateString('en-PK', { weekday: 'short' }),
      revenue: r[0]?.total || 0,
    });
  }

  res.json({
    today: todayAgg[0]?.total || 0,
    todayCount: todayAgg[0]?.count || 0,
    month: monthAgg[0]?.total || 0,
    monthCount: monthAgg[0]?.count || 0,
    byMethod: methodAgg,
    byCoach: coachAgg,
    last7Days: sevenDays,
  });
});

// POST — record payment (POS)
router.post('/', protect, async (req, res) => {
  try {
    const receiptNumber = generateReceiptNumber();
    const payment = await Payment.create({
      ...req.body,
      receiptNumber,
      receivedBy: req.user._id,
    });

    // If membership payment + member provided, extend member expiry
    if (req.body.memberId && req.body.type === 'membership' && req.body.extendDays) {
      const member = await Member.findById(req.body.memberId);
      if (member) {
        const base = member.expiryDate < new Date() ? new Date() : member.expiryDate;
        member.expiryDate = new Date(base.getTime() + req.body.extendDays * 24 * 60 * 60 * 1000);
        member.status = 'active';
        if (req.body.planName) member.planName = req.body.planName;
        if (req.body.amount) member.planPrice = req.body.amount;
        await member.save();
      }
    }

    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// CSV export (must come before /:id/receipt)
router.get('/export/csv', protect, async (req, res) => {
  const payments = await Payment.find().sort({ createdAt: -1 }).limit(1000);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=fitx-payments.csv');
  res.write('\uFEFF');
  res.write('Receipt #,Date & Time,Type,Member/Customer,Plan,Amount (PKR),Method,Received By,Note\n');
  payments.forEach(p => {
    const d = new Date(p.createdAt);
    const ds = d.toISOString().replace('T',' ').slice(0,19);
    res.write(`"${p.receiptNumber}","${ds}","${p.type || ''}","${p.memberName || ''}","${p.planName || ''}",${p.amount || 0},"${p.method || p.paymentMethod || ''}","${p.receivedBy || ''}","${(p.note||'').replace(/"/g,'""')}"\n`);
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
    res.status(500).json({ message: err.message });
  }
});

export default router;
