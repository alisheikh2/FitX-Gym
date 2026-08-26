import express from 'express';
import { protect } from '../middleware/auth.js';
import models from '../config/models.js'; const { Plan } = models;

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const plans = await Plan.find({ active: true }).sort({ price: 1 });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/all', protect, async (req, res) => {
  const plans = await Plan.find().sort({ price: 1 });
  res.json(plans);
});

router.post('/', protect, async (req, res) => {
  try {
    const plan = await Plan.create(req.body);
    res.status(201).json(plan);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(plan);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  await Plan.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

export default router;
