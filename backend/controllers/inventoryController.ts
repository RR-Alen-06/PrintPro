const { getPool } = require('../config/db');

// GET / - List all inventory items
async function listItems(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM inventory_items WHERE user_id = $1 ORDER BY name ASC', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// POST / - Add new item
async function addItem(req, res, next) {
  try {
    const pool = getPool();
    const { name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Item name is required' });
    }

    const [rows] = await pool.query(
      `INSERT INTO inventory_items (user_id, name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, name, color_single || 0, color_double || 0, bw_single || 0, bw_double || 0, stock || 0, low_stock_alert || 50]
    );
    const newItem = rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'CREATE', 'inventory', String(newItem.id), JSON.stringify({ name, stock })]
    );

    res.status(201).json({ success: true, data: newItem });
  } catch (err) {
    next(err);
  }
}

// PUT /:id - Update item
async function updateItem(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert } = req.body;

    const [existing] = await pool.query('SELECT * FROM inventory_items WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const oldItem = existing[0];
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (color_single !== undefined) updates.color_single = color_single;
    if (color_double !== undefined) updates.color_double = color_double;
    if (bw_single !== undefined) updates.bw_single = bw_single;
    if (bw_double !== undefined) updates.bw_double = bw_double;
    if (stock !== undefined) updates.stock = stock;
    if (low_stock_alert !== undefined) updates.low_stock_alert = low_stock_alert;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const keys = Object.keys(updates);
    const setClauses = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id, req.user.id);

    await pool.query(
      `UPDATE inventory_items SET ${setClauses} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}`,
      values
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'UPDATE', 'inventory', id, JSON.stringify(oldItem), JSON.stringify(updates)]
    );

    const [updated] = await pool.query('SELECT * FROM inventory_items WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /:id - Delete item
async function deleteItem(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM inventory_items WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    await pool.query('DELETE FROM inventory_items WHERE id = $1 AND user_id = $2', [id, req.user.id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'DELETE', 'inventory', id, JSON.stringify(existing[0])]
    );

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// PUT /:id/stock - Adjust stock quantity
async function updateStock(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { quantity, mode } = req.body;

    if (quantity === undefined || !['set', 'add', 'subtract'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'quantity and mode (set|add|subtract) are required' });
    }

    const [existing] = await pool.query('SELECT * FROM inventory_items WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const currentStock = existing[0].stock || 0;
    let newStock = currentStock;

    if (mode === 'set') newStock = quantity;
    else if (mode === 'add') newStock = currentStock + quantity;
    else if (mode === 'subtract') newStock = Math.max(0, currentStock - quantity);

    await pool.query('UPDATE inventory_items SET stock = $1 WHERE id = $2 AND user_id = $3', [newStock, id, req.user.id]);
    const [updated] = await pool.query('SELECT * FROM inventory_items WHERE id = $1 AND user_id = $2', [id, req.user.id]);

    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
}

// GET /low-stock - List items at or below alert threshold
async function getLowStock(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM inventory_items WHERE user_id = $1 AND stock <= low_stock_alert ORDER BY stock ASC',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listItems,
  addItem,
  updateItem,
  deleteItem,
  updateStock,
  getLowStock,
};
