const express = require('express');
const router = express.Router();
const {
  listItems,
  addItem,
  updateItem,
  deleteItem,
  updateStock,
  getLowStock,
} = require('../controllers/inventoryController');

// GET /api/inventory
router.get('/', listItems);

// GET /api/inventory/low-stock
router.get('/low-stock', getLowStock);

// POST /api/inventory
const { validateInventoryItem, validateInventoryUpdate, validateInventoryStock } = require('../middleware/validate');
const { validateSchema } = require('../middleware/schemaValidator');
const schemas = require('../config/schemas');

router.post('/', validateSchema(schemas.inventoryCreate), validateInventoryItem, addItem);

// PUT /api/inventory/:id
router.put('/:id', validateSchema(schemas.inventoryUpdate), validateInventoryUpdate, updateItem);

// PUT /api/inventory/:id/stock
router.put('/:id/stock', validateSchema(schemas.inventoryStock), validateInventoryStock, updateStock);

// DELETE /api/inventory/:id
router.delete('/:id', deleteItem);

module.exports = router;
