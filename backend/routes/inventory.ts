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

// PATCH & PUT /api/inventory/:id/stock
router.patch('/:id/stock', updateStock);
router.put('/:id/stock', updateStock);

// DELETE /api/inventory/:id
router.delete('/:id', deleteItem);

export default router;
