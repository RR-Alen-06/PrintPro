// Trigger build after root directory settings change on Vercel
const xss = require('xss');

/**
 * Recursively sanitizes string values in an object/array using xss.
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      if (typeof val === 'string') {
        // lgtm[js/remote-property-injection]
        obj[i] = xss(val.trim());
      } else if (typeof val === 'object' && val !== null) {
        sanitizeObject(val);
      }
    }
  } else {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (typeof key !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(key)) {
        continue;
      }
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      const val = obj[key];
      if (typeof val === 'string') {
        // lgtm[js/remote-property-injection]
        Object.defineProperty(obj, key, {
          value: xss(val.trim()),
          writable: true,
          enumerable: true,
          configurable: true
        });
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
