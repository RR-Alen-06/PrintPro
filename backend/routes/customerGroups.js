const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');
const { allowlist } = require('../middleware/allowlist');
const { validateSchema } = require('../middleware/schemaValidator');
const schemas = require('../config/schemas');

// Group projection DTOs: strips internal auth tenant ID (user_id)
function toCustomerGroupDto(g) {
  if (!g) return null;
  let members = g.member_ids || [];
  if (typeof members === 'string') {
    try { members = JSON.parse(members); } catch (_e) { members = []; }
  }
  return {
    id: g.id,
    name: g.name || '',
    description: g.description || '',
    member_ids: members
  };
}

function toGroupBillDto(gb) {
  if (!gb) return null;
  let shares = gb.member_shares || [];
  if (typeof shares === 'string') {
    try { shares = JSON.parse(shares); } catch (_e) { shares = []; }
  }
  return {
    id: gb.id,
    group_id: gb.group_id,
    title: gb.title || '',
    date: gb.date,
    total_amount: parseFloat(gb.total_amount) || 0,
    amount_paid: parseFloat(gb.amount_paid) || 0,
    status: gb.status || 'unpaid',
    member_shares: shares,
    notes: gb.notes || ''
  };
}

// GET /api/customer-groups
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM customer_groups WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
    res.json({ success: true, data: rows.map(toCustomerGroupDto) });
  } catch (err) {
    next(err);
  }
});

// POST /api/customer-groups
router.post('/', allowlist(['name', 'description', 'member_ids', 'memberIds', 'members', 'id']), validateSchema(schemas.customerGroupCreate), async (req, res, next) => {
  try {
    const pool = getPool();
    const { name, description } = req.body;
    const member_ids = req.body.member_ids || req.body.memberIds || req.body.members || [];

    if (!name) {
      return res.status(400).json({ success: false, error: 'Group name is required' });
    }

    const [maxRows] = await pool.query(
      `SELECT id FROM customer_groups WHERE user_id = ? ORDER BY CAST(NULLIF(regexp_replace(id, '[^0-9]', '', 'g'), '') AS INTEGER) DESC LIMIT 1`,
      [req.user.id]
    );
    let nextNum = 1;
    if (maxRows.length > 0 && maxRows[0].id) {
      const numPart = String(maxRows[0].id).replace(/[^0-9]/g, '');
      nextNum = parseInt(numPart || '0', 10) + 1;
    }
    const groupId = `GRP${String(nextNum).padStart(3, '0')}`;

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
    res.status(201).json({ success: true, data: toCustomerGroupDto(created[0]) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/customer-groups/:id
router.put('/:id', allowlist(['name', 'description', 'member_ids', 'memberIds', 'members', 'id']), validateSchema(schemas.customerGroupUpdate), async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, description } = req.body;
    const member_ids = req.body.member_ids !== undefined ? req.body.member_ids : (req.body.memberIds !== undefined ? req.body.memberIds : req.body.members);

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
        member_ids !== undefined ? JSON.stringify(member_ids) : null,
        id,
        req.user.id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM customer_groups WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, data: toCustomerGroupDto(updated[0]) });
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

    const [grpRows] = await pool.query(
      'SELECT id FROM customer_groups WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (grpRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer group not found' });
    }

    const [rows] = await pool.query('SELECT * FROM group_bills WHERE group_id = ? AND user_id = ? ORDER BY date DESC', [id, req.user.id]);
    res.json({ success: true, data: rows.map(toGroupBillDto) });
  } catch (err) {
    next(err);
  }
});

// POST /api/customer-groups/:id/bills - Create bill for a specific group
router.post('/:id/bills', allowlist(['title', 'date', 'total_amount', 'member_shares', 'notes']), validateSchema(schemas.customerGroupBill), async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, date, total_amount, member_shares, notes } = req.body;

    const [grpRows] = await pool.query(
      'SELECT id FROM customer_groups WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (grpRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer group not found' });
    }

    const billId = `GB-${Date.now()}`;

    await pool.query(
      `INSERT INTO group_bills (id, user_id, group_id, title, date, total_amount, amount_paid, status, member_shares, notes)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, ?)`,
      [
        billId,
        req.user.id,
        id,
        title || '',
        date || new Date().toISOString().slice(0, 10),
        parseFloat(total_amount) || 0,
        JSON.stringify(member_shares || []),
        notes || ''
      ]
    );

    const [created] = await pool.query('SELECT * FROM group_bills WHERE id = ? AND user_id = ?', [billId, req.user.id]);
    res.status(201).json({ success: true, data: toGroupBillDto(created[0]) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
