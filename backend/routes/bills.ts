import express from 'express';
import {
  listBills,
  listDeletedBills,
  getBill,
  createBill,
  updateBill,
  deleteBill,
  restoreBill,
  applyDiscount,
} from '../controllers/billController';
import { getPaymentsForBill } from '../controllers/paymentController';
import { validateBill, validateUpdateBill } from '../middleware/validate';

const router = express.Router();

// GET /api/bills?status=&customer_id=&date_from=&date_to=&deleted=
router.get('/', listBills);

// GET /api/bills/deleted/all
router.get('/deleted/all', listDeletedBills);

// GET /api/bills/:id/payments
router.get('/:id/payments', getPaymentsForBill);

// GET /api/bills/:id
router.get('/:id', getBill);

// POST /api/bills
router.post('/', validateBill, createBill);

// PUT /api/bills/:id
router.put('/:id', validateUpdateBill, updateBill);

// DELETE /api/bills/:id (soft delete)
router.delete('/:id', deleteBill);

// POST /api/bills/:id/restore
router.post('/:id/restore', restoreBill);

// POST /api/bills/:id/discount
router.post('/:id/discount', applyDiscount);

export default router;
