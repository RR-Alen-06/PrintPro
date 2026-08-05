import express from 'express';
import {
  listItems,
  addItem,
  updateItem,
  deleteItem,
  updateStock,
  getLowStock,
} from '../controllers/inventoryController';
import { validateInventoryItem } from '../middleware/validate';

const router = express.Router();

// GET /api/inventory
router.get('/', listItems);

// GET /api/inventory/low-stock
router.get('/low-stock', getLowStock);

// POST /api/inventory
router.post('/', validateInventoryItem, addItem);

// PUT /api/inventory/:id
router.put('/:id', validateInventoryItem, updateItem);

// PUT /api/inventory/:id/stock
router.put('/:id/stock', validateInventoryItem, updateStock);

// DELETE /api/inventory/:id
router.delete('/:id', deleteItem);

export default router;
