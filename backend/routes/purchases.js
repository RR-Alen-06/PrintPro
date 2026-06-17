const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');

// GET /api/purchases?startDate=&endDate=&category=
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { startDate, endDate, category } = req.query;
    let sql = 'SELECT * FROM purchases WHERE 1=1';
    const params = [];

    if (startDate) { sql += ' AND date >= ?'; params.push(startDate); }
    if (endDate)   { sql += ' AND date <= ?'; params.push(endDate); }
    if (category)  { sql += ' AND category = ?'; params.push(category); }

    sql += ' ORDER BY date DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/purchases/summary
router.get('/summary', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT category, COUNT(*) AS count, SUM(total) AS total_spent
       FROM purchases GROUP BY category ORDER BY total_spent DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/purchases/:id
router.get('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM purchases WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Purchase not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/purchases
const { validatePurchase } = require('../middleware/validate');
router.post('/', validatePurchase, async (req, res, next) => {
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
      `INSERT INTO purchases (date, item_name, category, qty, unit_cost, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [date, item_name, category, qtyNum, cost, total, notes || '']
    );

    const [newRow] = await pool.query('SELECT * FROM purchases WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: newRow[0] });
  } catch (err) { next(err); }
});

// PUT /api/purchases/:id
router.put('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM purchases WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: 'Purchase not found' });

    const { date, item_name, category, qty, unit_cost, notes } = req.body;
    const updates = {};
    if (date !== undefined)      updates.date = date;
    if (item_name !== undefined) updates.item_name = item_name;
    if (category !== undefined)  updates.category = category;
    if (qty !== undefined)       updates.qty = parseInt(qty, 10);
    if (unit_cost !== undefined) updates.unit_cost = parseFloat(unit_cost);
    if (notes !== undefined)     updates.notes = notes;

    if (updates.qty !== undefined || updates.unit_cost !== undefined) {
      const q = updates.qty !== undefined ? updates.qty : existing[0].qty;
      const c = updates.unit_cost !== undefined ? updates.unit_cost : parseFloat(existing[0].unit_cost);
      updates.total = parseFloat((q * c).toFixed(2));
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await pool.query(`UPDATE purchases SET ${setClauses} WHERE id = ?`, [...Object.values(updates), id]);

    const [updated] = await pool.query('SELECT * FROM purchases WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
});

// DELETE /api/purchases/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const [existing] = await pool.query('SELECT * FROM purchases WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: 'Purchase not found' });
    await pool.query('DELETE FROM purchases WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
