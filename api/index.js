import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../lib/config/db.js';
import models from '../lib/config/models.js';

import authRoutes from '../lib/routes/auth.js';
import memberRoutes from '../lib/routes/members.js';
import planRoutes from '../lib/routes/plans.js';
import paymentRoutes from '../lib/routes/payments.js';
import attendanceRoutes from '../lib/routes/attendance.js';
import contactRoutes from '../lib/routes/contact.js';
import { notFound, errorHandler } from '../lib/middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Static client build. Works for both:
//  - Local dev: ../client/dist (when run from project root)
//  - Vercel:    ./public (Vercel serves /public automatically via rewrites below;
//                         but we also serve static directly from api for safety)
const candidateDirs = [
  path.join(__dirname, '..', 'public'),        // Vercel layout (api/../public)
  path.join(__dirname, '..', 'client', 'dist'),// Local monorepo (../client/dist)
  path.join(__dirname, 'public'),              // Local dev fallback
];
import { existsSync } from 'fs';
const clientBuild = candidateDirs.find(existsSync) || candidateDirs[0];
app.use(express.static(clientBuild));

// Connect to DB (skips automatically if MONGO_URI is unset -> demo/memory mode)
await connectDB();

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/contact', contactRoutes);

// SPA fallback — anything that isn't /api/* gets the React app
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

// When run directly (`node api/index.js` or `npm start`) boot a local server.
// When imported by Vercel (serverless), we just export `app` as default.
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('/index.js') ||
  process.argv[1].endsWith('\\index.js')
);
if (isDirectRun) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ FITX server running on port ${PORT}`);
    console.log(`   Public site:  http://localhost:${PORT}`);
    console.log(`   Admin login:  http://localhost:${PORT}/admin`);
    console.log(`   Demo creds:   owner / fitx2026\n`);
  });
}

export default app;
