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

// CORS — allow dashboard (Vercel) and local dev
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, curl, mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
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