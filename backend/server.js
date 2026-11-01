require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const crypto    = require('crypto');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const { initializeDatabase, getPool } = require('./config/db');
const logger        = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler  = require('./middleware/errorHandler');
const sanitize      = require('./middleware/sanitize');

// ── Route imports ────────────────────────────────────────────────────────────
const customerRoutes      = require('./routes/customers');
const billRoutes          = require('./routes/bills');
const paymentRoutes       = require('./routes/payments');
const inventoryRoutes     = require('./routes/inventory');
const purchaseRoutes      = require('./routes/purchases');
const reportRoutes        = require('./routes/reports');
const profileRoutes       = require('./routes/profile');
const notificationRoutes  = require('./routes/notifications');
const auditRoutes         = require('./routes/audit');
const shareRoutes         = require('./routes/share');
const loyaltyRoutes       = require('./routes/loyalty');
const settingsRoutes      = require('./routes/settings');
const promoRoutes         = require('./routes/promoCodes');
const advanceRoutes       = require('./routes/advancePayments');
const customerGroupRoutes = require('./routes/customerGroups');
const groupBillRoutes     = require('./routes/groupBills');
const { router: cashSessionRoutes } = require('./routes/cashSessions');
const { router: upiTransactionRoutes } = require('./routes/upiTransactions');
const analyticsRoutes     = require('./routes/analytics');
const ledgerRoutes        = require('./routes/ledger');

// ── App setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;
const ENV  = process.env.NODE_ENV || 'development';

app.set('trust proxy', 1); // so req.ip works behind reverse proxies
app.disable('x-powered-by'); // Prevent technology disclosure

// ── Global middleware ────────────────────────────────────────────────────────
app.use(helmet());

// ── Explicit CORS Configuration ──────────────────────────────────────────────
// Prohibits wildcard origins (*) and wildcard regex patterns (*.vercel.app).
// Ensures credentials (Authorization header, cookies) can only ever be sent by
// explicitly verified domains.
const explicitStaticOrigins = [
  'https://printpro-in.vercel.app', // Production Web Application on Vercel
  'http://localhost:5173',          // Local Development (Vite standard port)
  'http://127.0.0.1:5173',          // Local Development (Vite loopback IP)
  'http://localhost:3000',          // Local Development (Fallback dev port)
  'http://127.0.0.1:3000',          // Local Development (Fallback loopback IP)
  'http://localhost:3001',          // Local Development (Secondary local port)
  'http://localhost:3002',          // Local Development (Tertiary local port)
];

// Parse environment-specified origins, strictly rejecting any wildcard '*' entries
const envOrigins = [
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : []),
]
  .map((o) => o.trim())
  .filter((o) => Boolean(o) && o !== '*' && !o.includes('*'));

// Construct immutable Set for exact O(1) origin matching
const allowedOriginsSet = new Set([
  ...explicitStaticOrigins,
  ...envOrigins
]);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser / same-origin requests without Origin header (e.g., server-side health checks, mobile apps, curl)
    if (!origin) {
      return callback(null, true);
    }

    // Strictly match against explicit allowlist (no wildcards or dynamic regex permitted)
    if (allowedOriginsSet.has(origin)) {
      return callback(null, true);
    }

    // Reject all other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Strictly restricted to explicit allowedOriginsSet matches
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24-hour preflight cache
  optionsSuccessStatus: 200,
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
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 500,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (req, res, _next, options) => {
    const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      error: 'Too many requests from this IP, please try again later',
      retryAfter: retryAfterSeconds,
      timestamp: new Date().toISOString()
    });
  }
});
app.use('/api/', limiter);

app.use(requestLogger);

// ── Static uploads (Restricted to receipts directory with non-executable headers) ──
const { UPLOAD_ROOT } = require('./config/uploadConfig');
const staticUploadOpts = {
  dotfiles: 'ignore',
  index: false,
  setHeaders: (res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="receipt.pdf"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('X-Frame-Options', 'DENY');
  }
};
app.use('/uploads/receipts', express.static(path.join(UPLOAD_ROOT, 'receipts'), staticUploadOpts));

// ── Health check (public) ────────────────────────────────────────────────────
const startedAt = new Date();

app.get('/api/health', async (req, res) => {
  const uptimeSec = Math.floor(process.uptime());
  const uptimeStr = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`;

  let dbStatus = 'ok';
  let dbError = null;
  let dbRef = null;
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
  } catch (err) {
    dbStatus = 'error';
    dbRef = 'ERR-DB-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    logger.error(`[${dbRef}] Database probe failure during health check: ${err.message}`, {
      stack: err.stack,
      code: err.code
    });
    // Never leak raw database error messages, credentials or hostnames to clients
    dbError = ENV === 'production' ? 'Database service temporarily unavailable' : err.message;
  }

  const payload = {
    status: dbStatus === 'ok' ? 'ok' : 'error',
    service: 'printpro-api',
    env: ENV,
    timestamp: new Date().toISOString(),
    uptime: uptimeStr,
    database: {
      status: dbStatus,
      ...(dbError ? { error: dbError } : {}),
      ...(dbRef ? { reference: dbRef } : {})
    }
  };

  // Only expose library/package version in non-production environments to avoid version disclosure
  if (ENV !== 'production') {
    payload.version = process.env.npm_package_version || '1.0.0';
    payload.started = startedAt.toISOString();
  }

  res.status(dbStatus === 'ok' ? 200 : 503).json(payload);
});

// ── Safe error testing endpoint (verify production error shielding) ──────────
// Allows safely verifying that stack traces, file paths, library versions,
// and raw database errors are masked with a clean message and reference code.
app.get('/api/test-error', (req, res, next) => {
  const { type = 'server' } = req.query;

  if (type === 'database') {
    const dbErr = new Error('relation "secret_vault_metadata" does not exist at character 19');
    dbErr.code = '42P01';
    dbErr.query = 'SELECT master_key, token FROM secret_vault_metadata WHERE user_id = 1;';
    dbErr.statusCode = 500;
    return next(dbErr);
  }

  if (type === 'filepath') {
    const pathErr = new Error('Cannot load native module C:\\Dev\\Print-Service\\backend\\node_modules\\pg\\build\\Release\\binding.node');
    pathErr.statusCode = 500;
    return next(pathErr);
  }

  if (type === 'version') {
    const verErr = new Error('Incompatible runtime dependency express@4.18.2 with node v20.10.0');
    verErr.statusCode = 500;
    return next(verErr);
  }

  if (type === 'client') {
    const clientErr = new Error('Requested resource does not exist or has been removed');
    clientErr.statusCode = 404;
    return next(clientErr);
  }

  // Default: unhandled server exception with simulated stack trace
  const err = new Error('Simulated production server failure in /api/test-error');
  err.statusCode = 500;
  return next(err);
});

// ── Authenticated API routes ─────────────────────────────────────────────────
const auth = require('./middleware/auth');
app.use('/api', auth);

app.use('/api/customers',        customerRoutes);
app.use('/api/bills',            billRoutes);
app.use('/api/payments',         paymentRoutes);
app.use('/api/inventory',        inventoryRoutes);
app.use('/api/purchases',        purchaseRoutes);
app.use('/api/reports',          reportRoutes);
app.use('/api/profile',          profileRoutes);
app.use('/api/notifications',    notificationRoutes);
app.use('/api/audit',            auditRoutes);
app.use('/api/share',            shareRoutes);
app.use('/api/loyalty',          loyaltyRoutes);
app.use('/api/settings',         settingsRoutes);
app.use('/api/promo-codes',      promoRoutes);
app.use('/api/advance-payments', advanceRoutes);
app.use('/api/customer-groups',  customerGroupRoutes);
app.use('/api/group-bills',      groupBillRoutes);
app.use('/api/cash-sessions',    cashSessionRoutes);
app.use('/api/upi-transactions', upiTransactionRoutes);
app.use('/api/analytics',        analyticsRoutes);
app.use('/api/ledger',           ledgerRoutes);

// ── 404 catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn(`404 Not Found — ${req.method} ${req.originalUrl}`);
  const safeUrl = String(req.originalUrl).replace(/[&<>"'/]/g, '');
  res.status(404).json({
    success: false,
    error:   `Cannot ${req.method} ${safeUrl}`,
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
