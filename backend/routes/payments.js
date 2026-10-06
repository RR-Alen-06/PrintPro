const express = require('express');
const router = express.Router();
const {
  recordPayment,
  recordRefund,
  deletePayment,
  listDeletedPayments,
  listRefundPayments,
  getPaymentsForBill,
  getPaymentsByCustomer,
  listAllPayments
} = require('../controllers/paymentController');

// POST /api/payments
const { validatePayment } = require('../middleware/validate');
router.post('/', validatePayment, recordPayment);

// POST /api/payments/refund
router.post('/refund', recordRefund);

// GET /api/payments/deleted
router.get('/deleted', listDeletedPayments);

// GET /api/payments/refunds
router.get('/refunds', listRefundPayments);

// GET /api/payments
router.get('/', listAllPayments);

// GET /api/payments/bill/:billId
router.get('/bill/:billId', getPaymentsForBill);

// GET /api/payments/customer/:customerId
router.get('/customer/:customerId', getPaymentsByCustomer);

// DELETE /api/payments/:id
router.delete('/:id', deletePayment);

module.exports = router;
