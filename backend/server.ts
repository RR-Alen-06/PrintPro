import express from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { initializeDatabase, getPool } from './config/db';
import logger from './utils/logger';
import { auth } from './middleware/auth';

// ── Route imports ────────────────────────────────────────────────────────────
import customerRoutes from './routes/customers';
import billRoutes from './routes/bills';
import paymentRoutes from './routes/payments';
import inventoryRoutes from './routes/inventory';
import purchaseRoutes from './routes/purchases';
import reportRoutes from './routes/reports';
import profileRoutes from './routes/profile';
import notificationRoutes from './routes/notifications';
import auditRoutes from './routes/audit';
import shareRoutes from './routes/share';

// ── App setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;
const ENV  = process.env.NODE_ENV || 'development';

app.set('trust proxy', 1); // so req.ip works behind reverse proxies

// ── Global middleware ────────────────────────────────────────────────────────
app.use(helmet());

// Configure CORS with allowed local development origins and configured CORS_ORIGIN
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'https://printpro-in.vercel.app',
  process.env.CORS_ORIGIN
].filter(Boolean);

const corsOptions = {
  origin: (origin: any, callback: any) => {
    if (
      !origin ||
      allowedOrigins.indexOf(origin) !== -1 ||
      origin.startsWith('http://localhost:') ||
      origin.endsWith('-print-service.vercel.app') ||
      /^https:\/\/print-pro-[a-z0-9-]+\.vercel\.app$/.test(origin) ||
      /^https:\/\/printpro-[a-z0-9-]+\.vercel\.app$/.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Disable caching for all API responses to prevent stale data delivery
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Set request payload limits to prevent denial-of-service/payload-bombs
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply rate limiting to all API requests
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later'
  }
});
app.use('/api/', limiter);

// ── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check (public) ────────────────────────────────────────────────────
const startedAt = new Date();

app.get('/api/health', async (req, res) => {
  const uptimeSec = Math.floor(process.uptime());
  const uptimeStr = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`;

  let dbStatus = 'ok';
  let dbError = null;
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
  } catch (err: any) {
    dbStatus = 'error';
    dbError = err.message;
  }

  res.json({
    status:    dbStatus === 'ok' ? 'ok' : 'error',
    service:   'printpro-api',
    version:   process.env.npm_package_version || '1.0.0',
    env:       ENV,
    timestamp: new Date().toISOString(),
    started:   startedAt.toISOString(),
    uptime:    uptimeStr,
    database: {
      status: dbStatus,
      error: dbError
    }
  });
});

import settingsRoutes from './routes/settings';

// ── Authenticated API routes ─────────────────────────────────────────────────
app.use('/api', auth);

app.use('/api/customers',     customerRoutes);
app.use('/api/bills',         billRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/inventory',     inventoryRoutes);
app.use('/api/purchases',     purchaseRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/profile',       profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit',         auditRoutes);
app.use('/api/share',         shareRoutes);
app.use('/api/settings',      settingsRoutes);

// ── 404 catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn(`404 Not Found — ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error:   `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    logger.info('─────────────────────────────────────────');
    logger.info(`Starting PrintPro API  [${ENV.toUpperCase()}]`);

    await initializeDatabase();

    app.listen(PORT, () => {
      logger.info('─────────────────────────────────────────');
      logger.info(`Server listening on    http://localhost:${PORT}`);
      logger.info(`API base URL           http://localhost:${PORT}/api`);
      logger.info(`Health check           http://localhost:${PORT}/api/health`);
      logger.info(`Log level              ${process.env.LOG_LEVEL || 'info'}`);
      logger.info('─────────────────────────────────────────');
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    if (err.stack) logger.error(err.stack);
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
  if (err.stack) logger.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled promise rejection: ${reason}`);
  process.exit(1);
});

if (require.main === module) {
  start();
} else {
  // Export for serverless environments (e.g., Vercel)
  // Ensure the database is initialized, though Vercel might cold-start
  initializeDatabase().catch(err => {
    logger.error(`Database init failed during cold start: ${err.message}`);
  });
}

export default app;
