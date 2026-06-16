/**
 * HTTP Request Logger Middleware
 * Logs every incoming request with method, path, status code,
 * response time, and content-length — similar to Morgan "combined"
 * but using our own logger so the format stays consistent.
 */

const logger = require('../utils/logger');

// ANSI helpers (mirrors what logger.js uses)
const useColor = process.stdout.isTTY !== false;
const c = (code, str) => (useColor ? `\x1b[${code}m${str}\x1b[0m` : str);

function methodColor(method) {
  const map = {
    GET:    '32',   // green
    POST:   '34',   // blue
    PUT:    '33',   // yellow
    PATCH:  '35',   // magenta
    DELETE: '31',   // red
  };
  return c(map[method] || '37', method.padEnd(6));
}

function statusColor(status) {
  if (status >= 500) return c('31', status); // red
  if (status >= 400) return c('33', status); // yellow
  if (status >= 300) return c('36', status); // cyan
  return c('32', status);                    // green
}

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  // Capture when response finishes
  res.on('finish', () => {
    const ns      = Number(process.hrtime.bigint() - start);
    const ms      = (ns / 1e6).toFixed(2);
    const method  = methodColor(req.method);
    const url     = req.originalUrl || req.url;
    const status  = statusColor(res.statusCode);
    const length  = res.getHeader('content-length') || '-';
    const ip      = req.ip || req.connection?.remoteAddress || '-';

    // Skip noisy health checks from cluttering logs (optional: remove if you want them)
    if (url === '/api/health') return;

    logger.info(`${method} ${url} ${status} ${ms}ms ${length}b  ${c('90', ip)}`);
  });

  next();
}

module.exports = requestLogger;
