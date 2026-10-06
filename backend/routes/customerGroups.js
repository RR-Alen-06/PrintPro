const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');

// GET /api/customer-groups
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM customer_groups WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/customer-groups
router.post('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { name, description, member_ids } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Group name is required' });
    }

    let groupId = req.body.id;
    if (!groupId) {
      const [maxRows] = await pool.query(
        `SELECT id FROM customer_groups WHERE user_id = ? ORDER BY CAST(NULLIF(regexp_replace(id, '[^0-9]', '', 'g'), '') AS INTEGER) DESC LIMIT 1`,
        [req.user.id]
      );
      let nextNum = 1;
      if (maxRows.length > 0 && maxRows[0].id) {
        const numPart = String(maxRows[0].id).replace(/[^0-9]/g, '');
        nextNum = parseInt(numPart || '0', 10) + 1;
      }
      groupId = `GRP${String(nextNum).padStart(3, '0')}`;
    }

    await pool.query(
      `INSERT INTO customer_groups (id, user_id, name, description, member_ids)
       VALUES (?, ?, ?, ?, ?)`,
      [
        groupId,
        req.user.id,
        name,
        description || '',
        JSON.stringify(member_ids || [])
      ]
    );

    const [created] = await pool.query('SELECT * FROM customer_groups WHERE id = ? AND user_id = ?', [groupId, req.user.id]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/customer-groups/:id
router.put('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, description, member_ids } = req.body;

    const [existing] = await pool.query('SELECT * FROM customer_groups WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer group not found' });
    }

    await pool.query(
      `UPDATE customer_groups SET
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         member_ids = COALESCE(?, member_ids),
         updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        name,
        description,
        member_ids ? JSON.stringify(member_ids) : null,
        id,
        req.user.id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM customer_groups WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/customer-groups/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM customer_groups WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer group not found' });
    }

    await pool.query('DELETE FROM customer_groups WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, message: 'Customer group deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-groups/:id/bills - List bills for a specific group
router.get('/:id/bills', async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM group_bills WHERE group_id = ? AND user_id = ? ORDER BY date DESC', [id, req.user.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/customer-groups/:id/bills - Create bill for a specific group
router.post('/:id/bills', async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, date, total_amount, amount_paid, status, member_shares, notes } = req.body;

    const billId = req.body.id || `GB-${Date.now()}`;

    await pool.query(
      `INSERT INTO group_bills (id, user_id, group_id, title, date, total_amount, amount_paid, status, member_shares, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        billId,
        req.user.id,
        id,
        title || '',
        date || new Date().toISOString().slice(0, 10),
        total_amount || 0,
        amount_paid || 0,
        status || 'unpaid',
        JSON.stringify(member_shares || []),
        notes || ''
      ]
    );

    const [created] = await pool.query('SELECT * FROM group_bills WHERE id = ? AND user_id = ?', [billId, req.user.id]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
