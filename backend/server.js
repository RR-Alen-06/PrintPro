require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const os      = require('os');

const { initializeDatabase } = require('./config/db');
const logger        = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler  = require('./middleware/errorHandler');

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

// ── App setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;
const ENV  = process.env.NODE_ENV || 'development';

app.set('trust proxy', 1); // so req.ip works behind reverse proxies

// ── Global middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api/customers',     customerRoutes);
app.use('/api/bills',         billRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/inventory',     inventoryRoutes);
app.use('/api/purchases',     purchaseRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/profile',       profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit',         auditRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
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
    process: {
      pid:      process.pid,
      node:     process.version,
      platform: process.platform,
      arch:     process.arch,
      memory: {
        rss:       `${Math.round(process.memoryUsage().rss       / 1024 / 1024)} MB`,
        heapUsed:  `${Math.round(process.memoryUsage().heapUsed  / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
      },
    },
    system: {
      hostname: os.hostname(),
      cpus:     os.cpus().length,
      loadAvg:  os.loadavg().map((v) => v.toFixed(2)),
      freeMemMB: Math.round(os.freemem() / 1024 / 1024),
    },
  });
});

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

start();
