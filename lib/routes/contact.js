import express from 'express';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// In-memory store for demo; in production use email service (Nodemailer + SendGrid/Mailgun)
const submissions = [];

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2 }),
    body('phone').trim().isLength({ min: 5 }),
    body('email').optional({ checkFalsy: true }).isEmail(),
    body('message').optional().isLength({ max: 1000 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const sub = { ...req.body, createdAt: new Date() };
    submissions.push(sub);
    console.log('Contact submission:', sub);
    res.json({ success: true, message: "Thanks! We'll be in touch shortly via WhatsApp or phone." });
  }
);

router.get('/', (req, res) => res.json({ count: submissions.length }));

export default router;
