const express = require('express');
const router = express.Router();
const {
  recordPayment,
  getPaymentsForBill,
  getPaymentsByCustomer,
} = require('../controllers/paymentController');

// POST /api/payments
router.post('/', recordPayment);

// GET /api/payments/bill/:billId
router.get('/bill/:billId', getPaymentsForBill);

// GET /api/payments/customer/:customerId
router.get('/customer/:customerId', getPaymentsByCustomer);

module.exports = router;
