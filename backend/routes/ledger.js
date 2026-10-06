const express = require('express');
const router = express.Router();
const {
  getCustomerLedger,
  generateCustomerLedgerPdf,
} = require('../controllers/ledgerController');

// GET /api/ledger/:customerId?startDate=&endDate=
router.get('/:customerId', getCustomerLedger);

// POST /api/ledger/:customerId/pdf
router.post('/:customerId/pdf', generateCustomerLedgerPdf);

module.exports = router;
