import express from 'express';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBills,
  getCustomerPayments,
  getCustomerStatement,
} from '../controllers/customerController';
import { validateCustomer } from '../middleware/validate';

const router = express.Router();

// GET /api/customers
router.get('/', listCustomers);

// GET /api/customers/:id
router.get('/:id', getCustomer);

// GET /api/customers/:id/bills
router.get('/:id/bills', getCustomerBills);

// GET /api/customers/:id/payments
router.get('/:id/payments', getCustomerPayments);

// GET /api/customers/:id/statement
router.get('/:id/statement', getCustomerStatement);

// POST /api/customers
router.post('/', validateCustomer, createCustomer);

// PUT /api/customers/:id
router.put('/:id', validateCustomer, updateCustomer);

// DELETE /api/customers/:id
router.delete('/:id', deleteCustomer);

export default router;
