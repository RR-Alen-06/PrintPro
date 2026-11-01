/**
 * Security and Sanitization Utilities
 * Enforces HTML entity escaping by default, strict URL scheme validation,
 * safe formatted HTML sanitization, and CSV formula injection neutralization.
 */

import DOMPurify from 'dompurify';

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
    return encodeURI(trimmed);
  }
  return '';
}

/**
 * Sanitizes formatted text using DOMPurify against a strict allowlist of safe formatting tags.
 * Strips all script tags, attributes, and event handlers.
 * @param {string} str
 * @returns {string}
 */
export function sanitizeFormattedText(str) {
  if (!str || typeof str !== 'string') return '';
  return DOMPurify.sanitize(str, {
    ALLOWED_TAGS: ['b', 'i', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  });
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
