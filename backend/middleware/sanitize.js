const xss = require('xss');

/**
 * Recursively sanitizes string values in an object/array using xss.
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (typeof val === 'string') {
        obj[key] = xss(val.trim());
      } else if (typeof val === 'object' && val !== null) {
        sanitizeObject(val);
      }
    }
  }
  return obj;
}

/**
 * Express middleware to sanitize all string fields in request body, query, and params.
 * Prevents Cross-Site Scripting (XSS) injections in stored data.
 */
function sanitize(req, res, next) {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
}

module.exports = sanitize;
