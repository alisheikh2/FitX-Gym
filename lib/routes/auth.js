import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import models from '../config/models.js'; const { User } = models;
import { protect } from '../middleware/auth.js';

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'devsecret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/login
router.post(
  '/login',
  [body('username').notEmpty(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    const id = user._id || user.id;
    res.json({
      token: signToken(id),
      user: { id, name: user.name, username: user.username, role: user.role },
    });
  }
);

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  const id = req.user._id || req.user.id;
  res.json({ user: { id, name: req.user.name, username: req.user.username, role: req.user.role } });
});

export default router;
