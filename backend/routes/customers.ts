import express from 'express';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController';
import { validateCustomer } from '../middleware/validate';

const router = express.Router();

// GET /api/customers
router.get('/', listCustomers);

// GET /api/customers/:id
router.get('/:id', getCustomer);

// POST /api/customers
router.post('/', validateCustomer, createCustomer);

// PUT /api/customers/:id
router.put('/:id', validateCustomer, updateCustomer);

// DELETE /api/customers/:id
router.delete('/:id', deleteCustomer);

export default router;
