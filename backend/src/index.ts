import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import webhookRouter from './routes/webhook';
import adminRouter from './routes/admin';
import { startScheduler } from './services/scheduler';

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

// CORS — allow frontend dev server
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

// Parse URL-encoded bodies (Twilio sends form-encoded webhooks)
app.use(express.urlencoded({ extended: false }));

// Parse JSON bodies (for admin API calls from frontend)
app.use(express.json());

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SchoolConnect Backend',
    timestamp: new Date().toISOString(),
  });
});

// Twilio WhatsApp webhook
app.use('/webhook', webhookRouter);

// Admin REST API
app.use('/api', adminRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 SchoolConnect Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Webhook: http://localhost:${PORT}/webhook/twilio`);
  console.log(`   Admin API: http://localhost:${PORT}/api\n`);

  // Start the notification scheduler
  startScheduler();
});

export default app;