import { getPool } from '../config/db';

// GET / - List all inventory items
export async function listItems(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM inventory_items WHERE user_id = $1 ORDER BY name ASC', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// POST / - Add new item
export async function addItem(req: any, res: any, next: any) {
  try {
    const { name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert } = req.body;
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO inventory_items (user_id, name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.user.id,
        name,
        color_single || 0,
        color_double || 0,
        bw_single || 0,
        bw_double || 0,
        stock || 0,
        low_stock_alert || 50,
      ]
    );

    const newItem = Array.isArray(result) ? result[0] : result;
    if (newItem) {
      await pool.query(
        'INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'CREATE_INVENTORY', 'inventory', String(newItem.id), JSON.stringify(newItem)]
      );
    }

    res.status(201).json({ success: true, data: newItem });
  } catch (err) {
    next(err);
  }
}

// PUT /:id - Update item
export async function updateItem(req: any, res: any, next: any) {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [existingRows] = await pool.query(
      'SELECT * FROM inventory_items WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    const existingItem = Array.isArray(existingRows) ? existingRows[0] : existingRows;
    if (!existingItem) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const { name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert } = req.body;

    const [updateResult] = await pool.query(
      `UPDATE inventory_items 
       SET name = $1, color_single = $2, color_double = $3, bw_single = $4, bw_double = $5, stock = $6, low_stock_alert = $7
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [
        name ?? existingItem.name,
        color_single ?? existingItem.color_single,
        color_double ?? existingItem.color_double,
        bw_single ?? existingItem.bw_single,
        bw_double ?? existingItem.bw_double,
        stock ?? existingItem.stock,
        low_stock_alert ?? existingItem.low_stock_alert,
        id,
        req.user.id,
      ]
    );

    const updatedItem = Array.isArray(updateResult) ? updateResult[0] : updateResult;

    await pool.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'UPDATE_INVENTORY', 'inventory', id, JSON.stringify(existingItem), JSON.stringify(updatedItem)]
    );

    res.json({ success: true, data: updatedItem });
  } catch (err) {
    next(err);
  }
}

// DELETE /:id - Delete item
export async function deleteItem(req: any, res: any, next: any) {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [existingRows] = await pool.query(
      'SELECT * FROM inventory_items WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    const existingItem = Array.isArray(existingRows) ? existingRows[0] : existingRows;
    if (!existingItem) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    await pool.query('DELETE FROM inventory_items WHERE id = $1 AND user_id = $2', [id, req.user.id]);

    await pool.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'DELETE_INVENTORY', 'inventory', id, JSON.stringify(existingItem)]
    );

    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    next(err);
  }
}

// PATCH /:id/stock - Adjust stock level
export async function updateStock(req: any, res: any, next: any) {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const pool = getPool();

    const [existingRows] = await pool.query(
      'SELECT * FROM inventory_items WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    const existingItem = Array.isArray(existingRows) ? existingRows[0] : existingRows;
    if (!existingItem) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const [updateResult] = await pool.query(
      'UPDATE inventory_items SET stock = stock + $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [quantity, id, req.user.id]
    );

    const updatedItem = Array.isArray(updateResult) ? updateResult[0] : updateResult;

    await pool.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'UPDATE_STOCK', 'inventory', id, JSON.stringify(existingItem), JSON.stringify(updatedItem)]
    );

    res.json({ success: true, data: updatedItem });
  } catch (err) {
    next(err);
  }
}

// GET /low-stock - Get items low in stock
export async function getLowStock(req: any, res: any, next: any) {
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
