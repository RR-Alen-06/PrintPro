const express = require('express');
const router = express.Router();
const { allowlist } = require('../middleware/allowlist');
const { pdfExportLimiter } = require('../middleware/rateLimiters');
const { validateSchema } = require('../middleware/schemaValidator');
const schemas = require('../config/schemas');
const {
  getCustomerLedger,
  generateCustomerLedgerPdf,
} = require('../controllers/ledgerController');

// GET /api/ledger/:customerId?startDate=&endDate=
router.get('/:customerId', getCustomerLedger);

// POST /api/ledger/:customerId/pdf
router.post('/:customerId/pdf', pdfExportLimiter, allowlist(['startDate', 'endDate']), validateSchema(schemas.ledgerPdf), generateCustomerLedgerPdf);

module.exports = router;
