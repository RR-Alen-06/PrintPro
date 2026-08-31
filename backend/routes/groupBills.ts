import express from 'express';
import { getPool } from '../config/db';

const router = express.Router();

// GET /api/group-bills - List all group bills for the authenticated user
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM group_bills WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/group-bills/:id - Get single group bill
router.get('/:id', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM group_bills WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Group bill not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/group-bills - Create group bill
router.post('/', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const {
      id,
      type = 'shared',
      date = new Date().toISOString().slice(0, 10),
      due_date = null,
      notes = '',
      member_bill_ids = [],
      members = [],
    } = req.body;

    const params = [
      req.user.id,
      type,
      date,
      due_date,
      notes,
      member_bill_ids,
      JSON.stringify(members),
    ];

    let query = `
      INSERT INTO group_bills (user_id, type, date, due_date, notes, member_bill_ids, members)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    if (id && typeof id === 'string' && !id.startsWith('temp-') && !id.startsWith('GRP')) {
      query = `
        INSERT INTO group_bills (id, user_id, type, date, due_date, notes, member_bill_ids, members)
        VALUES ($8, $1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      params.push(id);
    }

    const [rows] = await pool.query(query, params);
    const created = rows && rows.length > 0 ? rows[0] : rows;
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// PUT /api/group-bills/:id - Update group bill
router.put('/:id', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { type, date, due_date, notes, member_bill_ids, members } = req.body;

    const updates: Record<string, any> = {};
    if (type !== undefined) updates.type = type;
    if (date !== undefined) updates.date = date;
    if (due_date !== undefined) updates.due_date = due_date;
    if (notes !== undefined) updates.notes = notes;
    if (member_bill_ids !== undefined) updates.member_bill_ids = member_bill_ids;
    if (members !== undefined) updates.members = JSON.stringify(members);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const keys = Object.keys(updates);
    const setClauses = keys.map((k, idx) => `${k} = $${idx + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id, req.user.id);

    await pool.query(
      `UPDATE group_bills SET ${setClauses}, updated_at = NOW() WHERE id = $${values.length - 1} AND user_id = $${values.length}`,
      values
    );

    const [updated] = await pool.query('SELECT * FROM group_bills WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/group-bills/:id - Delete group bill
router.delete('/:id', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    await pool.query('DELETE FROM group_bills WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true, message: 'Group bill deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
