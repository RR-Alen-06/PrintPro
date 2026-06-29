require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const os        = require('os');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const { initializeDatabase } = require('./config/db');
const logger        = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler  = require('./middleware/errorHandler');
const sanitize      = require('./middleware/sanitize');

// ── Route imports ────────────────────────────────────────────────────────────
const customerRoutes     = require('./routes/customers');
const billRoutes         = require('./routes/bills');
const paymentRoutes      = require('./routes/payments');
const inventoryRoutes    = require('./routes/inventory');
const purchaseRoutes     = require('./routes/purchases');
const reportRoutes       = require('./routes/reports');
const profileRoutes      = require('./routes/profile');
const notificationRoutes = require('./routes/notifications');
const auditRoutes        = require('./routes/audit');
const shareRoutes        = require('./routes/share');

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
  process.env.CORS_ORIGIN
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
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
app.use(sanitize);

// Apply rate limiting to all API requests
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later'
  }
});
app.use('/api/', limiter);

app.use(requestLogger);

// ── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check (public) ────────────────────────────────────────────────────
const startedAt = new Date();

app.get('/api/health', (req, res) => {
  const uptimeSec = Math.floor(process.uptime());
  const uptimeStr = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`;

  res.json({
    status:    'ok',
    service:   'printpro-api',
    version:   process.env.npm_package_version || '1.0.0',
    env:       ENV,
    timestamp: new Date().toISOString(),
    started:   startedAt.toISOString(),
    uptime:    uptimeStr,
  });
});

// ── Authenticated API routes ─────────────────────────────────────────────────
const auth = require('./middleware/auth');
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

// ── 404 catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn(`404 Not Found — ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error:   `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

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
  module.exports = app;
}
