/**
 * Rate Limiting Configuration
 * Standard RFC headers and 429 response formatting for compute-heavy routes.
 */

const rateLimit = require('express-rate-limit');

/**
 * Factory helper to construct standardized express-rate-limit middleware
 * with RFC standard headers, Retry-After, and consistent JSON error envelopes.
 */
function createRateLimiter({
  windowMs,
  max,
  message,
  serviceName,
  keyGenerator,
  skipSuccessfulRequests = false
}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Return RateLimit-* headers (draft-6 / draft-7 RFC)
    legacyHeaders: false,  // Disable X-RateLimit-* headers
    skipSuccessfulRequests,
    keyGenerator: keyGenerator || undefined,
    statusCode: 429,
    handler: (req, res, _next, options) => {
      const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(options.statusCode || 429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        error: message,
        service: serviceName,
        limit: options.max,
        windowMs: options.windowMs,
        retryAfter: retryAfterSeconds,
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * PDF Generation & Heavy Export Limiter: 20 generations per 5 minutes per user/IP.
 * Protects Node.js event loop and server memory from CPU-intensive PDF rendering.
 */
const pdfExportLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  serviceName: 'compute:pdf-export',
  message: 'PDF document generation limit reached. Please wait a few minutes before generating more PDF reports or statements.'
});

module.exports = {
  createRateLimiter,
  pdfExportLimiter
};
