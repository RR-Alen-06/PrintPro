const express = require('express');
const router = express.Router();
const {
  recordPayment,
  getPaymentsForBill,
  getPaymentsByCustomer,
  listAllPayments
} = require('../controllers/paymentController');

// POST /api/payments
const { validatePayment } = require('../middleware/validate');
router.post('/', validatePayment, recordPayment);

// GET /api/payments
router.get('/', listAllPayments);

// GET /api/payments/bill/:billId
router.get('/bill/:billId', getPaymentsForBill);

// GET /api/payments/customer/:customerId
router.get('/customer/:customerId', getPaymentsByCustomer);

module.exports = router;
