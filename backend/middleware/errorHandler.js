/**
 * Global error handler middleware for Express.
 * Must be registered AFTER all routes (4-argument signature).
 *
 * Production Hardening:
 * 1. Generates a unique, collision-resistant reference code (e.g. ERR-K9ZQ-8F2B1A) for all internal errors.
 * 2. Logs full diagnostics (stack trace, file paths, database query details, request context) strictly on the server.
 * 3. Never leaks stack traces, file paths, library versions, or raw database errors to the client.
 * 4. Returns a plain, user-friendly message and the reference code to the user.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Generates an operator-friendly, unique reference code.
 */
function generateReferenceCode() {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ERR-${timestamp}-${random}`;
}

/**
 * Inspects a string to detect if it contains internal sensitive signatures:
 * - Local file paths (Windows drives C:\... or Unix /var, /usr, /home, node_modules)
 * - Stack trace frames ("at Module._compile (node:internal/...)")
 * - Raw database/SQL errors (syntax error, relation does not exist, etc.)
 * - Library or runtime versions (node.js, express@4.x, etc.)
 */
function containsSensitiveDetails(str) {
  if (typeof str !== 'string' || !str) return false;

  const filePathPattern = /[a-zA-Z]:\\|\/(?:usr|var|home|node_modules|backend|frontend|etc|tmp|app)\b/i;
  const stackPattern = /\bat\s+[^\n\r()]+:\d+:\d+/;
  const sqlErrorPattern = /\b(?:syntax error at or near|relation\s+"[^"]+"\s+does not exist|column\s+"[^"]+"\s+does not exist|violates foreign key|duplicate key value|pq:\s|pg_catalog|SELECT\s+|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM)\b/i;
  const versionPattern = /\b(?:node\.js|node\s+v\d+\.\d+\.\d+|[\w-]+@\d+\.\d+\.\d+)\b/i;

  return filePathPattern.test(str) || stackPattern.test(str) || sqlErrorPattern.test(str) || versionPattern.test(str);
}

function errorHandler(err, req, res, _next) {
  const referenceCode = generateReferenceCode();
  const statusCode = (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode <= 599)
    ? err.statusCode
    : ((typeof err.status === 'number' && err.status >= 400 && err.status <= 599) ? err.status : 500);

  // Remove framework headers that might reveal versions or technology
  res.removeHeader('X-Powered-By');

  // Full diagnostics logged strictly on the server
  const serverMeta = {
    reference: referenceCode,
    status: statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.socket?.remoteAddress,
    userId: req.user?.id || 'unauthenticated',
    code: err.code || undefined,
    dbDetail: err.detail || undefined,
    dbHint: err.hint || undefined,
    dbQuery: err.query || err.sql || undefined,
    timestamp: new Date().toISOString()
  };

  // ── 1. Specific known error types ──────────────────────────────────────────

  // CORS error
  if (err.message === 'Not allowed by CORS') {
    logger.warn(`[${referenceCode}] CORS rejected: ${req.headers.origin || 'unknown origin'} for ${req.method} ${req.originalUrl}`, serverMeta);
    return res.status(403).json({
      success: false,
      error: 'Not allowed by CORS',
      code: 'CORS_ERROR'
    });
  }

  // PostgreSQL duplicate entry (23505)
  if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') {
    logger.warn(`[${referenceCode}] Duplicate entry violation`, serverMeta);
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry. This record already exists.',
      code: 'DUPLICATE_ENTRY'
    });
  }

  // PostgreSQL FK constraint (23503)
  if (err.code === '23503' || err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    logger.warn(`[${referenceCode}] Foreign key constraint violation`, serverMeta);
    return res.status(400).json({
      success: false,
      error: 'Operation failed due to a data reference constraint.',
      code: 'CONSTRAINT_VIOLATION'
    });
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    logger.warn(`[${referenceCode}] File size limit exceeded`, serverMeta);
    return res.status(400).json({
      success: false,
      error: 'File size exceeds the 2 MB limit.',
      code: 'FILE_TOO_LARGE'
    });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    logger.warn(`[${referenceCode}] Unexpected file field in upload`, serverMeta);
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field in upload.',
      code: 'UNEXPECTED_FILE'
    });
  }

  // JSON parsing error in request body
  if (err.type === 'entity.parse.failed') {
    logger.warn(`[${referenceCode}] Malformed JSON request payload`, serverMeta);
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON syntax in request body.',
      code: 'INVALID_JSON'
    });
  }

  // Schema validation errors
  if (err.type === 'validation') {
    logger.warn(`[${referenceCode}] Schema validation rejected request`, serverMeta);
    const safeDetails = (typeof err.details === 'string' && containsSensitiveDetails(err.details))
      ? 'One or more fields failed schema validation rules.'
      : (err.details || err.message || 'Validation failed');

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: safeDetails
    });
  }

  // ── 2. Client vs Server Error Handling ─────────────────────────────────────
  if (statusCode < 500) {
    // 4xx Client Errors: Log as warning
    logger.warn(`[${referenceCode}] Client error (${statusCode}): ${err.message}`, serverMeta);

    // Ensure client error message doesn't leak paths or raw database errors
    const hasSensitiveData = containsSensitiveDetails(err.message);
    const clientMessage = hasSensitiveData
      ? 'The request could not be processed due to invalid parameters.'
      : (err.message || 'Bad request');

    const responseBody = {
      success: false,
      error: clientMessage,
      code: err.code || 'BAD_REQUEST'
    };

    if (hasSensitiveData) {
      responseBody.reference = referenceCode;
    }

    return res.status(statusCode).json(responseBody);
  }

  // ── 3. 5xx Server / Database Errors (Never reveal internal details) ─────────
  // Log complete error and stack trace on the server
  logger.error(`[${referenceCode}] Unhandled server error: ${err.message}`, serverMeta);
  if (err.stack) {
    logger.error(`[${referenceCode}] Stack trace:\n${err.stack}`);
  }

  // Client receives only a friendly plain message and the reference code
  return res.status(500).json({
    success: false,
    error: 'An unexpected server error occurred. Please contact support with this reference code if the issue persists.',
    code: 'INTERNAL_SERVER_ERROR',
    reference: referenceCode,
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;
