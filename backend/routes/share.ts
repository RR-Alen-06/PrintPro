const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'receipts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
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

// POST /api/share/upload-pdf
router.post('/upload-pdf', upload.single('pdf'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded.' });
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
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
