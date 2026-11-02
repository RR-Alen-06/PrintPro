const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');
const { getNextSequence } = require('../utils/sequenceGenerator');
const { allowlist } = require('../middleware/allowlist');
const { validateSchema } = require('../middleware/schemaValidator');
const schemas = require('../config/schemas');

// Purchase projection DTO: strips internal auth tenant ID (user_id)
function toPurchaseDto(p) {
  if (!p) return null;
  return {
    id: p.id,
    date: p.date,
    expense_number: p.expense_number || '',
    item_name: p.item_name || '',
    category: p.category || 'General',
    vendor_name: p.vendor_name || '',
    payment_method: p.payment_method || 'cash',
    upi_ref: p.upi_ref || '',
    qty: parseInt(p.qty, 10) || 0,
    unit_cost: parseFloat(p.unit_cost) || 0,
    total: parseFloat(p.total) || 0,
    notes: p.notes || ''
  };
}

// GET /api/purchases?startDate=&endDate=&category=
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { startDate, endDate, category } = req.query;
    let sql = 'SELECT id, expense_number, date, item_name, category, vendor_name, payment_method, upi_ref, qty, unit_cost, total, notes FROM purchases WHERE user_id = ?';
    const params = [req.user.id];

    if (startDate) { sql += ' AND date >= ?'; params.push(startDate); }
    if (endDate)   { sql += ' AND date <= ?'; params.push(endDate); }
    if (category)  { sql += ' AND category = ?'; params.push(category); }

    sql += ' ORDER BY date DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows.map(toPurchaseDto) });
  } catch (err) { next(err); }
});

// GET /api/purchases/summary
router.get('/summary', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT category, COUNT(*) AS count, SUM(total) AS total_spent
       FROM purchases WHERE user_id = ? GROUP BY category ORDER BY total_spent DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/purchases/:id
router.get('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT id, expense_number, date, item_name, category, vendor_name, payment_method, upi_ref, qty, unit_cost, total, notes FROM purchases WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Purchase not found' });
    res.json({ success: true, data: toPurchaseDto(rows[0]) });
  } catch (err) { next(err); }
});

// POST /api/purchases
const { validatePurchase } = require('../middleware/validate');
router.post('/', allowlist(['date', 'item_name', 'itemName', 'name', 'category', 'qty', 'unit_cost', 'unitCost', 'amount', 'total', 'notes', 'vendor_name', 'vendorName', 'payment_method', 'paymentMethod', 'upi_ref', 'upiRef', 'session_id']), validateSchema(schemas.purchaseCreate), validatePurchase, async (req, res, next) => {
  try {
    const pool = getPool();
    const { date, item_name, category, qty, unit_cost, notes, vendor_name = '', payment_method = 'cash', upi_ref = '', session_id } = req.body;

    if (!date || !item_name || !category) {
      return res.status(400).json({ success: false, error: 'date, item_name, and category are required' });
    }

    let activeSessionId = session_id || null;
    if (!activeSessionId) {
      const [sessRows] = await pool.query(
        `SELECT id FROM cash_sessions WHERE user_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
        [req.user.id]
      );
      if (sessRows.length > 0) activeSessionId = sessRows[0].id;
    }

    const reqTotal = parseFloat(req.body.total !== undefined ? req.body.total : req.body.amount);
    let qtyNum = parseInt(qty, 10);
    let cost = parseFloat(unit_cost);
    let total = 0;

    if (!isNaN(reqTotal) && reqTotal > 0 && (isNaN(qtyNum) || isNaN(cost) || (qtyNum * cost === 0))) {
      total = parseFloat(reqTotal.toFixed(2));
      qtyNum = isNaN(qtyNum) || qtyNum === 0 ? 1 : qtyNum;
      cost = isNaN(cost) || cost === 0 ? total : cost;
    } else {
      qtyNum = isNaN(qtyNum) ? 1 : qtyNum;
      cost = isNaN(cost) ? 0 : cost;
      total = parseFloat((qtyNum * cost).toFixed(2));
    }

    const expenseNumber = await getNextSequence(pool, req.user.id, 'expense');

    const [result] = await pool.query(
      `INSERT INTO purchases (user_id, date, item_name, category, qty, unit_cost, total, notes, vendor_name, payment_method, upi_ref, session_id, expense_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, date, item_name, category, qtyNum, cost, total, notes || '', vendor_name || '', payment_method || 'cash', upi_ref || '', activeSessionId, expenseNumber]
    );

    const [newRow] = await pool.query('SELECT id, expense_number, date, item_name, category, vendor_name, payment_method, upi_ref, qty, unit_cost, total, notes FROM purchases WHERE id = ? AND user_id = ?', [result.insertId, req.user.id]);
    res.status(201).json({ success: true, data: toPurchaseDto(newRow[0]) });
  } catch (err) { next(err); }
});

// PUT /api/purchases/:id
router.put('/:id', allowlist(['date', 'item_name', 'itemName', 'name', 'category', 'qty', 'unit_cost', 'unitCost', 'amount', 'total', 'notes', 'vendor_name', 'vendorName', 'payment_method', 'paymentMethod', 'upi_ref', 'upiRef']), validateSchema(schemas.purchaseUpdate), async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM purchases WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: 'Purchase not found' });

    const item_name = req.body.item_name || req.body.itemName || req.body.name;
    const unit_cost = req.body.unit_cost !== undefined ? req.body.unit_cost : req.body.unitCost;
    const vendor_name = req.body.vendor_name !== undefined ? req.body.vendor_name : req.body.vendorName;
    const payment_method = req.body.payment_method !== undefined ? req.body.payment_method : req.body.paymentMethod;
    const upi_ref = req.body.upi_ref !== undefined ? req.body.upi_ref : req.body.upiRef;
    const { date, category, qty, notes } = req.body;

    const updates = {};
    if (date !== undefined)           updates.date = date;
    if (item_name !== undefined)      updates.item_name = item_name;
    if (category !== undefined)       updates.category = category;
    if (qty !== undefined)            updates.qty = parseInt(qty, 10);
    if (unit_cost !== undefined)      updates.unit_cost = parseFloat(unit_cost);
    if (notes !== undefined)          updates.notes = notes;
    if (vendor_name !== undefined)    updates.vendor_name = vendor_name;
    if (payment_method !== undefined) updates.payment_method = payment_method;
    if (upi_ref !== undefined)        updates.upi_ref = upi_ref;

    const explicitTotal = req.body.total !== undefined ? req.body.total : req.body.amount;
    if (explicitTotal !== undefined) {
      updates.total = parseFloat(parseFloat(explicitTotal).toFixed(2));
    } else if (updates.qty !== undefined || updates.unit_cost !== undefined) {
      const q = updates.qty !== undefined ? updates.qty : existing[0].qty;
      const c = updates.unit_cost !== undefined ? updates.unit_cost : parseFloat(existing[0].unit_cost);
      updates.total = parseFloat((q * c).toFixed(2));
    }

    const ALLOWED_PURCHASE_COLUMNS = ['date', 'item_name', 'category', 'qty', 'unit_cost', 'total', 'notes', 'vendor_name', 'payment_method', 'upi_ref'];
    const validKeys = Object.keys(updates).filter((k) => ALLOWED_PURCHASE_COLUMNS.includes(k));

    if (validKeys.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const setClauses = validKeys.map((k) => `"${k}" = ?`).join(', ');
    const values = validKeys.map((k) => updates[k]);
    await pool.query(`UPDATE purchases SET ${setClauses} WHERE id = ? AND user_id = ?`, [...values, id, req.user.id]);

    const [updated] = await pool.query('SELECT id, expense_number, date, item_name, category, vendor_name, payment_method, upi_ref, qty, unit_cost, total, notes FROM purchases WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, data: toPurchaseDto(updated[0]) });
  } catch (err) { next(err); }
});

// DELETE /api/purchases/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const [existing] = await pool.query('SELECT * FROM purchases WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: 'Purchase not found' });
    await pool.query('DELETE FROM purchases WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
