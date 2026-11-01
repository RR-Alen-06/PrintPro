const express = require('express');
const router = express.Router();
const multer = require('multer');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { ensureUploadSubdir } = require('../config/uploadConfig');
const { getPool } = require('../config/db');
const { allowlist } = require('../middleware/allowlist');
const { pdfExportLimiter } = require('../middleware/rateLimiters');
const { validateSchema } = require('../middleware/schemaValidator');
const schemas = require('../config/schemas');

// Strict file size cap: 2 MB (2,097,152 bytes)
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

// Memory storage keeps the upload in a Buffer until magic bytes and authorization are verified
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  }
});

/**
 * Validates real file contents from binary header (magic bytes)
 * A real PDF document must begin with %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D).
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isValidPdfMagicBytes(buffer) {
  if (!buffer || buffer.length < 5) return false;
  return buffer.slice(0, 5).toString('ascii') === '%PDF-';
}

// POST /api/share/upload-pdf
router.post('/upload-pdf', pdfExportLimiter, upload.single('pdf'), allowlist(['billId']), validateSchema(schemas.shareUploadPdf), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded.' });
    }

    // 1. Content-based type validation: verify real file type from its contents, NOT extension or mime
    if (!isValidPdfMagicBytes(req.file.buffer)) {
      return res.status(400).json({
        success: false,
        error: 'File content verification failed: Uploaded file is not a valid PDF document.'
      });
    }

    const billId = req.body.billId;
    if (!billId) {
      return res.status(400).json({ success: false, error: 'billId is required.' });
    }

    // 2. Server-side ownership check: Verify that the bill belongs to the authenticated user
    const pool = getPool();
    const [bills] = await pool.query(
      'SELECT id FROM bills WHERE id = ? AND user_id = ?',
      [billId, req.user.id]
    );

    if (!bills || bills.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    // 3. Rename uploaded file to an unguessable cryptographically secure random name
    const randomFilename = `${crypto.randomUUID()}.pdf`;
    const host = req.get('host');
    const protocol = req.protocol;
    const backendUrl = process.env.BACKEND_URL || `${protocol}://${host}`;

    let fileUrl = null;

    // 4. Object storage: upload to Supabase cloud object storage if configured
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY)) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY
        );

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(randomFilename, req.file.buffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: false
          });

        if (!uploadErr && uploadData) {
          const { data: publicData } = supabase.storage
            .from('receipts')
            .getPublicUrl(randomFilename);
          if (publicData?.publicUrl) {
            fileUrl = publicData.publicUrl;
          }
        }
      } catch (cloudErr) {
        console.warn('[Storage] Object storage upload fallback to isolated disk:', cloudErr.message);
      }
    }

    // Fallback if cloud object storage is not configured or bucket is unavailable:
    // Store in isolated directory OUTSIDE application tree and serve with safe headers
    if (!fileUrl) {
      const receiptDir = ensureUploadSubdir('receipts');
      const safeRandom = path.basename(randomFilename);
      const targetPath = path.resolve(receiptDir, safeRandom);
      const baseDir = path.resolve(receiptDir);
      if (!targetPath.startsWith(baseDir + path.sep)) {
        throw new Error('Path traversal detected');
      }
      fs.writeFileSync(targetPath, req.file.buffer, { mode: 0o600 }); // strict non-executable file permissions
      fileUrl = `${backendUrl}/api/share/receipt/${safeRandom}`;
    }

    return res.json({
      success: true,
      fileUrl,
      filename: randomFilename
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/share/receipt/:filename
// Secure serving route: strictly delivers PDF files with non-executable headers
router.get('/receipt/:filename', (req, res) => {
  const { filename } = req.params;

  // Strict UUID format validation: prevents path traversal (../) and restricts to generated files
  const uuidPdfRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;
  if (!uuidPdfRegex.test(filename)) {
    return res.status(400).json({ success: false, error: 'Invalid file identifier.' });
  }

  const receiptDir = ensureUploadSubdir('receipts');
  const safeFilename = path.basename(filename);
  const filePath = path.resolve(receiptDir, safeFilename);
  const baseDir = path.resolve(receiptDir);

  // Path containment check to satisfy static analysis and prevent traversal
  if (!filePath.startsWith(baseDir + path.sep)) {
    return res.status(403).json({ success: false, error: 'Access denied.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found.' });
  }

  // Never serve files from a path where they could execute; enforce strict content headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="receipt.pdf"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  return fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
