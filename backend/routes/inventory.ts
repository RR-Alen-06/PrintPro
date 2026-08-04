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
const { validateInventoryItem } = require('../middleware/validate');
router.post('/', validateInventoryItem, addItem);

// PUT /api/inventory/:id
router.put('/:id', validateInventoryItem, updateItem);

// PUT /api/inventory/:id/stock
router.put('/:id/stock', validateInventoryItem, updateStock);

// DELETE /api/inventory/:id
router.delete('/:id', deleteItem);

module.exports = router;
