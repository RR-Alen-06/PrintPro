/**
 * Security and Sanitization Utilities
 * Enforces HTML entity escaping by default, strict URL scheme validation,
 * safe formatted HTML sanitization, and CSV formula injection neutralization.
 */

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Escapes all HTML special characters to prevent XSS.
 * Everything should be escaped by default.
 * @param {any} val
 * @returns {string}
 */
export function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Validates and sanitizes URLs for image src and link href attributes.
 * Rejects javascript:, vbscript:, data: (non-image), or file: URLs.
 * @param {string} url
 * @returns {string} Safe URL or empty string
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  // Allow only safe HTTP/HTTPS, Blob, or safe data image URIs
  if (/^(?:https?:\/\/|blob:|data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,)/i.test(trimmed)) {
    return trimmed.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  }
  return '';
}

/**
 * Sanitizes formatted text against a strict allowlist of safe formatting tags.
 * Strips all script tags, attributes, and event handlers.
 * @param {string} str
 * @returns {string}
 */
export function sanitizeFormattedText(str) {
  if (!str || typeof str !== 'string') return '';
  
  // 1. Remove dangerous script, style, iframe, object, embed tags entirely
  let clean = str.replace(/<(?:script|style|iframe|object|embed|svg|link)[^>]*>.*?<\/(?:script|style|iframe|object|embed|svg|link)>/gis, '');
  clean = clean.replace(/<(?:script|style|iframe|object|embed|svg|link)[^>]*\/?>(?!<\/)/gi, '');
  
  // 2. Allow only strict formatting tags: <b>, <i>, <strong>, <em>, <br>, <p>, <ul>, <ol>, <li>
  // Replace all other tags with their escaped entities
  clean = clean.replace(/<(\/?)([a-z0-9_-]+)([^>]*)>/gi, (match, slash, tagName, attrs) => {
    const tag = tagName.toLowerCase();
    const ALLOWED_TAGS = ['b', 'i', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li'];
    if (ALLOWED_TAGS.includes(tag)) {
      // Disallow any inline JavaScript event handlers or dangerous attributes
      const cleanAttrs = attrs.replace(/\b(on\w+|style|id|class)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '').trim();
      return `<${slash}${tag}${cleanAttrs ? ' ' + cleanAttrs : ''}>`;
    }
    // Escape disallowed tags
    return escapeHtml(match);
  });

  return clean;
}

/**
 * Neutralizes CSV formula injection (DDE attacks) when exporting user content to spreadsheets.
 * Prevents execution if cell begins with =, +, -, @, tab, or carriage return.
 * @param {any} value
 * @returns {string}
 */
export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}
