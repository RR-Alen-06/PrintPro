const express = require('express');
const router = express.Router();
const {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBills,
  getCustomerPayments,
  getCustomerStatement,
} = require('../controllers/customerController');

// GET /api/customers?type=&search=
router.get('/', listCustomers);

// GET /api/customers/:id
router.get('/:id', getCustomer);

// POST /api/customers
const { validateCustomer, validateCustomerUpdate } = require('../middleware/validate');
const { validateSchema } = require('../middleware/schemaValidator');
const schemas = require('../config/schemas');

router.post('/', validateSchema(schemas.customerCreate), validateCustomer, createCustomer);

// PUT /api/customers/:id
router.put('/:id', validateSchema(schemas.customerUpdate), validateCustomerUpdate, updateCustomer);

// DELETE /api/customers/:id
router.delete('/:id', deleteCustomer);

// GET /api/customers/:id/bills
router.get('/:id/bills', getCustomerBills);

// GET /api/customers/:id/payments
router.get('/:id/payments', getCustomerPayments);

// GET /api/customers/:id/statement
router.get('/:id/statement', getCustomerStatement);

module.exports = router;
