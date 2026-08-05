import express from 'express';
import { getPool } from '../config/db';
import { validatePurchase } from '../middleware/validate';

const router = express.Router();

// GET /api/purchases?startDate=&endDate=&category=
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const { startDate, endDate, category } = req.query;
    let sql = 'SELECT * FROM purchases WHERE user_id = $1';
    const params: any[] = [req.user.id];

    if (startDate) { params.push(startDate); sql += ` AND date >= $${params.length}`; }
    if (endDate)   { params.push(endDate); sql += ` AND date <= $${params.length}`; }
    if (category)  { params.push(category); sql += ` AND category = $${params.length}`; }

    sql += ' ORDER BY date DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/purchases/summary
router.get('/summary', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT category, COUNT(*) AS count, SUM(total) AS total_spent
       FROM purchases WHERE user_id = $1 GROUP BY category ORDER BY total_spent DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/purchases/:id
router.get('/:id', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM purchases WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    const existing = Array.isArray(rows) ? rows[0] : rows;
    if (!existing) return res.status(404).json({ success: false, error: 'Purchase not found' });
    res.json({ success: true, data: existing });
  } catch (err) { next(err); }
});

// POST /api/purchases
router.post('/', validatePurchase, async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const { date, item_name, category, qty, unit_cost, notes } = req.body;

    if (!date || !item_name || !category) {
      return res.status(400).json({ success: false, error: 'date, item_name, and category are required' });
    }

    const qtyNum = parseInt(qty, 10) || 0;
    const cost = parseFloat(unit_cost) || 0;
    const total = parseFloat((qtyNum * cost).toFixed(2));

    const [result] = await pool.query(
      `INSERT INTO purchases (user_id, date, item_name, category, qty, unit_cost, total, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, date, item_name, category, qtyNum, cost, total, notes || '']
    );

    const newRow = Array.isArray(result) ? result[0] : result;
    res.status(201).json({ success: true, data: newRow });
  } catch (err) { next(err); }
});

// PUT /api/purchases/:id
router.put('/:id', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const [existingRows] = await pool.query('SELECT * FROM purchases WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
    if (!existing) return res.status(404).json({ success: false, error: 'Purchase not found' });

    const { date, item_name, category, qty, unit_cost, notes } = req.body;
    const updates: Record<string, any> = {};
    if (date !== undefined)      updates.date = date;
    if (item_name !== undefined) updates.item_name = item_name;
    if (category !== undefined)  updates.category = category;
    if (qty !== undefined)       updates.qty = parseInt(qty, 10);
    if (unit_cost !== undefined) updates.unit_cost = parseFloat(unit_cost);
    if (notes !== undefined)     updates.notes = notes;

    if (updates.qty !== undefined || updates.unit_cost !== undefined) {
      const q = updates.qty !== undefined ? updates.qty : existing.qty;
      const c = updates.unit_cost !== undefined ? updates.unit_cost : parseFloat(existing.unit_cost);
      updates.total = parseFloat((q * c).toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const keys = Object.keys(updates);
    const setClauses = keys.map((k, idx) => `${k} = $${idx + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id, req.user.id);
    await pool.query(`UPDATE purchases SET ${setClauses} WHERE id = $${values.length - 1} AND user_id = $${values.length}`, values);

    const [updatedRows] = await pool.query('SELECT * FROM purchases WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true, data: Array.isArray(updatedRows) ? updatedRows[0] : updatedRows });
  } catch (err) { next(err); }
});

// DELETE /api/purchases/:id
router.delete('/:id', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const [existingRows] = await pool.query('SELECT * FROM purchases WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
    if (!existing) return res.status(404).json({ success: false, error: 'Purchase not found' });
    await pool.query('DELETE FROM purchases WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (err) { next(err); }
});

export default router;
