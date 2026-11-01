const xss = require('xss');

/**
 * Strict XSS Options:
 * By default, NO raw HTML tags are permitted.
 * All HTML tags are escaped (&lt;...&gt;) and dangerous executable tags are safely stripped.
 */
const strictEscapeOptions = {
  whiteList: {}, // Zero HTML tags allowed by default
  stripIgnoreTag: false, // Escape instead of silent stripping
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
};

/**
 * Strict allowlist for fields that explicitly allow basic text formatting.
 * Only basic typography and structure tags are permitted; no attributes or script handlers.
 */
const FORMATTED_FIELDS = new Set(['notes', 'description', 'headerNotes', 'footerNotes']);
const formattedOptions = {
  whiteList: {
    b: [],
    i: [],
    strong: [],
    em: [],
    p: [],
    br: [],
    ul: [],
    ol: [],
    li: []
  },
  stripIgnoreTag: false,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
};

/**
 * Recursively sanitizes string values in an object/array.
 * Everything is escaped by default. If a field allows formatting (e.g. notes),
 * it is sanitized against a strict allowlist of formatting tags instead.
 */
function sanitizeObject(obj, parentKey = '') {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      if (typeof val === 'string') {
        const opts = FORMATTED_FIELDS.has(parentKey) ? formattedOptions : strictEscapeOptions;
        obj[i] = xss(val.trim(), opts);
      } else if (typeof val === 'object' && val !== null) {
        sanitizeObject(val, parentKey);
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
        const opts = FORMATTED_FIELDS.has(key) ? formattedOptions : strictEscapeOptions;
        Object.defineProperty(obj, key, {
          value: xss(val.trim(), opts),
          writable: true,
          enumerable: true,
          configurable: true
        });
      } else if (typeof val === 'object' && val !== null) {
        sanitizeObject(val, key);
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
