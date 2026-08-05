import express from 'express';
import {
  recordPayment,
  getPaymentsForBill,
  getPaymentsByCustomer,
  listAllPayments,
  deletePayment
} from '../controllers/paymentController';
import { validatePayment } from '../middleware/validate';

const router = express.Router();

// POST /api/payments
router.post('/', validatePayment, recordPayment);

// GET /api/payments
router.get('/', listAllPayments);

// GET /api/payments/bill/:billId
router.get('/bill/:billId', getPaymentsForBill);

// GET /api/payments/customer/:customerId
router.get('/customer/:customerId', getPaymentsByCustomer);

// DELETE /api/payments/:id
router.delete('/:id', deletePayment);

export default router;
