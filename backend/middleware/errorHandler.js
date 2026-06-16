/**
 * Global error handler middleware for Express.
 * Must be registered AFTER all routes (4-argument signature).
 */

const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  // ── Log the error with context ────────────────────────────────────────────
  const meta = {
    method:  req.method,
    url:     req.originalUrl,
    code:    err.code || undefined,
    status:  err.statusCode || 500,
  };

  if (err.statusCode && err.statusCode < 500) {
    // 4xx — client error, warn level
    logger.warn(`Client error: ${err.message}`, meta);
  } else {
    // 5xx or unknown — full stack
    logger.error(`Unhandled error: ${err.message}`, meta);
    if (err.stack) logger.error(err.stack);
  }

  // ── MySQL duplicate entry ─────────────────────────────────────────────────
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry. This record already exists.',
    });
  }

  // ── MySQL FK constraint ───────────────────────────────────────────────────
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      error: 'Operation failed due to a data reference constraint.',
    });
  }

  // ── Multer file upload ────────────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'File size exceeds the 2 MB limit.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: 'Unexpected file field in upload.' });
  }

  // ── express-validator ─────────────────────────────────────────────────────
  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors || err.message,
    });
  }

  // ── JSON parse error ──────────────────────────────────────────────────────
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body.' });
  }

  // ── Generic ───────────────────────────────────────────────────────────────
  const statusCode = err.statusCode || 500;
  const message    = err.statusCode ? err.message : 'Internal server error';

  return res.status(statusCode).json({ success: false, error: message });
}

module.exports = errorHandler;
