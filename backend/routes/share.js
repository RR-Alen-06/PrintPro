const express = require('express');
const router = express.Router();
const multer = require('multer');

const { ensureUploadSubdir } = require('../config/uploadConfig');

// Multer configuration with lazy directory verification
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = ensureUploadSubdir('receipts');
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const billId = req.body.billId || 'receipt';
    // Clean billId for filename safety
    const cleanBillId = billId.replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${cleanBillId}-${Date.now()}.pdf`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF documents are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2 MB limit
  }
});

const fs = require('fs');
const { getPool } = require('../config/db');

const safeUnlink = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (_err) {
      return false;
    }
  }
  return true;
};

// POST /api/share/upload-pdf
router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded.' });
    }

    const billId = req.body.billId;
    if (!billId) {
      safeUnlink(req.file.path);
      return res.status(400).json({ success: false, error: 'billId is required.' });
    }

    // Server-side check: Verify that the bill belongs to the authenticated user before accepting data
    const pool = getPool();
    const [bills] = await pool.query(
      'SELECT id FROM bills WHERE id = ? AND user_id = ?',
      [billId, req.user.id]
    );

    if (!bills || bills.length === 0) {
      safeUnlink(req.file.path);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Bill does not exist or does not belong to authenticated user.'
      });
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const backendUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
    
    // Hosted path relative to express server static route
    const fileUrl = `${backendUrl}/uploads/receipts/${req.file.filename}`;

    res.json({
      success: true,
      fileUrl,
      filename: req.file.filename
    });
  } catch (err) {
    if (req.file) {
      safeUnlink(req.file.path);
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
