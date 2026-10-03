import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Ensure directory exists (using /tmp in serverless or fallback)
const uploadDir = process.env.VERCEL === '1' 
  ? path.join('/tmp', 'uploads', 'receipts') 
  : path.join(__dirname, '..', 'uploads', 'receipts');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('Could not create upload directory:', err);
}

import crypto from 'crypto';

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const rawBillId = (req.body && req.body.billId) ? String(req.body.billId) : 'receipt';
    // Clean billId for filename safety
    const cleanBillId = rawBillId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'receipt';
    const randomEntropy = crypto.randomBytes(16).toString('hex');
    const filename = `${cleanBillId}-${randomEntropy}.pdf`;
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

import { getPool } from '../config/db';

// POST /api/share/upload-pdf
router.post('/upload-pdf', upload.single('pdf'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded.' });
    }

    const rawBillId = (req.body && req.body.billId) ? String(req.body.billId).trim() : '';
    if (rawBillId && rawBillId !== 'receipt') {
      const pool = getPool();
      const [rows] = await pool.query(
        'SELECT id FROM bills WHERE (id::text = $1 OR invoice_number = $1) AND user_id = $2',
        [rawBillId, req.user.id]
      );
      if (!rows || (rows as any[]).length === 0) {
        // Remove uploaded file if not owned by requesting user
        try {
          if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (_) {}
        return res.status(404).json({ success: false, error: 'Bill not found or unauthorized' });
      }
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
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

