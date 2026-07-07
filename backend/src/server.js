import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './database.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import medicationRoutes from './routes/medications.js';
import consultationRoutes from './routes/consultations.js';
import trendRoutes from './routes/trends.js';
import cgaRoutes from './routes/cga.js';
import cognitiveRoutes from './routes/cognitive.js';
import profileRoutes from './routes/profile.js';
import settingsRoutes from './routes/settings.js';
import reminderRoutes from './routes/reminders.js';
import asrRoutes from './routes/asr.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Init DB
initDatabase();

// Image serving (public — UUID filenames are unguessable)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'data', 'uploads');
app.get('/api/images/:userId/:filename', (req, res) => {
  const p = path.join(uploadsDir, req.params.userId, req.params.filename);
  if (fs.existsSync(p)) res.sendFile(p);
  else res.status(404).end();
});

// Public routes (no auth)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/medications', authMiddleware, medicationRoutes);
app.use('/api/consultations', authMiddleware, consultationRoutes);
app.use('/api/trends', authMiddleware, trendRoutes);
app.use('/api/cga-assessments', authMiddleware, cgaRoutes);
app.use('/api/cognitive-screenings', authMiddleware, cognitiveRoutes);
app.use('/api/profile', authMiddleware, profileRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/reminders', authMiddleware, reminderRoutes);
app.use('/api/asr', authMiddleware, asrRoutes);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Server] 颐年家庭医生 API running on http://localhost:${PORT}`);
});
