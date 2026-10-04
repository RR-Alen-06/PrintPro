const express = require('express');
const router = express.Router();
const {
  listBills,
  listDeletedBills,
  getBill,
  createBill,
  updateBill,
  deleteBill,
  restoreBill,
  applyDiscount,
} = require('../controllers/billController');
const { getPaymentsForBill } = require('../controllers/paymentController');

// GET /api/bills?status=&customer_id=&date_from=&date_to=&deleted=
router.get('/', listBills);

// GET /api/bills/deleted/all
router.get('/deleted/all', listDeletedBills);

// GET /api/bills/:id/payments
router.get('/:id/payments', getPaymentsForBill);

// GET /api/bills/:id
router.get('/:id', getBill);

// POST /api/bills
const { validateBill } = require('../middleware/validate');
router.post('/', validateBill, createBill);

// PUT /api/bills/:id
router.put('/:id', validateBill, updateBill);

// DELETE /api/bills/:id (soft delete)
router.delete('/:id', deleteBill);

// POST /api/bills/:id/restore
router.post('/:id/restore', restoreBill);

// POST /api/bills/:id/discount
router.post('/:id/discount', applyDiscount);

module.exports = router;
