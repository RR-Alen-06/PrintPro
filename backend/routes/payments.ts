import express from 'express';
import {
  recordPayment,
  getPaymentsForBill,
  getPaymentsByCustomer,
  listAllPayments,
  deletePayment,
  getDeletedPayments,
} from '../controllers/paymentController';
import {
  recordGroupSettlement,
  getGroupSettlements,
  getGroupSettlementById,
  reverseGroupSettlement
} from '../controllers/groupSettlementController';
import { validatePayment, validateGroupSettlement } from '../middleware/validate';

const router = express.Router();

// ── Group Settlement Routes ──────────────────────────────────────────────────
// POST /api/payments/group-settle
router.post('/group-settle', validateGroupSettlement, recordGroupSettlement);

// GET /api/payments/group-settlements
router.get('/group-settlements', getGroupSettlements);

// GET /api/payments/group-settle/:id
router.get('/group-settle/:id', getGroupSettlementById);

// DELETE /api/payments/group-settle/:id
router.delete('/group-settle/:id', reverseGroupSettlement);

// ── Standard Single-Bill Payment Routes ───────────────────────────────────────
// POST /api/payments
router.post('/', validatePayment, recordPayment);

// GET /api/payments
router.get('/', listAllPayments);

// GET /api/payments/deleted
router.get('/deleted', getDeletedPayments);

// GET /api/payments/bill/:billId
router.get('/bill/:billId', getPaymentsForBill);

// GET /api/payments/customer/:customerId
router.get('/customer/:customerId', getPaymentsByCustomer);

// DELETE /api/payments/:id
router.delete('/:id', deletePayment);

export default router;
