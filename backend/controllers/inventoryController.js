const { getPool } = require('../config/db');

// GET / - List all inventory items
async function listItems(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM inventory_items WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// POST / - Add new item
async function addItem(req, res, next) {
  try {
    const pool = getPool();
    const { name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert, item_type = 'paper', unit_price = 0, unit = 'pcs' } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Item name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO inventory_items (user_id, name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert, item_type, unit_price, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, color_single || 0, color_double || 0, bw_single || 0, bw_double || 0, stock || 0, low_stock_alert || 50, item_type, unit_price || 0, unit]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'CREATE', 'inventory', String(result.insertId), JSON.stringify({ name, stock, item_type })]
    );

    const [newItem] = await pool.query('SELECT * FROM inventory_items WHERE id = ? AND user_id = ?', [result.insertId, req.user.id]);
    res.status(201).json({ success: true, data: newItem[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /:id - Update item
const ALLOWED_INVENTORY_COLUMNS = ['name', 'color_single', 'color_double', 'bw_single', 'bw_double', 'stock', 'low_stock_alert', 'item_type', 'unit_price', 'unit'];

async function updateItem(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const invalidKeys = Object.keys(req.body).filter(k => !ALLOWED_INVENTORY_COLUMNS.includes(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({ success: false, error: `Invalid column(s): ${invalidKeys.join(', ')}` });
    }

    const [existing] = await pool.query('SELECT * FROM inventory_items WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const oldItem = existing[0];
    const updates = {};
    for (const key of ALLOWED_INVENTORY_COLUMNS) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id, req.user.id];

    await pool.query(`UPDATE inventory_items SET ${setClauses} WHERE id = ? AND user_id = ?`, values);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, 'UPDATE', 'inventory', String(id), JSON.stringify(oldItem), JSON.stringify(updates)]
    );

    const [updated] = await pool.query('SELECT * FROM inventory_items WHERE id = ? AND user_id = ?', [id, req.user.id]);
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

    const [existing] = await pool.query('SELECT * FROM inventory_items WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    await pool.query('DELETE FROM inventory_items WHERE id = ? AND user_id = ?', [id, req.user.id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'DELETE', 'inventory', String(id), JSON.stringify(existing[0])]
    );

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// PUT /:id/stock - Update stock level only
async function updateStock(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { stock } = req.body;

    if (stock === undefined || stock === null) {
      return res.status(400).json({ success: false, error: 'Stock value is required' });
    }

    const [existing] = await pool.query('SELECT * FROM inventory_items WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    await pool.query('UPDATE inventory_items SET stock = ? WHERE id = ? AND user_id = ?', [stock, id, req.user.id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, 'UPDATE', 'inventory', String(id),
        JSON.stringify({ stock: existing[0].stock }),
        JSON.stringify({ stock })
      ]
    );

    const [updated] = await pool.query('SELECT * FROM inventory_items WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
}

// GET /low-stock - Items below alert threshold
async function getLowStock(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM inventory_items WHERE user_id = ? AND stock <= low_stock_alert ORDER BY stock ASC',
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
  getLowStock
};
