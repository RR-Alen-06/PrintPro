import express from 'express';
import { getPool } from '../config/db';

const router = express.Router();

const mapPromoCode = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    type: row.type || 'percent',
    value: Number(row.value || 0),
    minAmount: row.min_amount != null ? Number(row.min_amount) : 0,
    maxDiscount: row.max_discount != null ? Number(row.max_discount) : null,
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    enabled: row.enabled !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// GET /api/promo-codes
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM promo_codes WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const data = Array.isArray(rows) ? rows.map(mapPromoCode) : [];
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/promo-codes
router.post('/', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const {
      code,
      type = 'percent',
      value = 0,
      minAmount,
      min_amount,
      maxDiscount,
      max_discount,
      startDate,
      start_date,
      endDate,
      end_date,
      enabled = true,
    } = req.body;

    const cleanedCode = (code || '').trim().toUpperCase();
    if (!cleanedCode) {
      return res.status(400).json({ success: false, error: 'Promo code is required' });
    }

    const val = Number(value || 0);
    const minAmt = Number(minAmount !== undefined ? minAmount : (min_amount !== undefined ? min_amount : 0));
    const maxDisc = maxDiscount !== undefined ? (maxDiscount === '' || maxDiscount === null ? null : Number(maxDiscount)) : (max_discount !== undefined ? (max_discount === '' || max_discount === null ? null : Number(max_discount)) : null);
    const sDate = startDate || start_date || null;
    const eDate = endDate || end_date || null;
    const isEnabled = enabled !== false;

    // Check duplicate
    const [existing] = await pool.query(
      'SELECT id FROM promo_codes WHERE user_id = $1 AND code = $2',
      [req.user.id, cleanedCode]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, error: `Promo code '${cleanedCode}' already exists` });
    }

    const [inserted] = await pool.query(
      `INSERT INTO promo_codes (
        user_id, code, type, value, min_amount, max_discount, start_date, end_date, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [req.user.id, cleanedCode, type, val, minAmt, maxDisc, sDate, eDate, isEnabled]
    );

    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    res.status(201).json({ success: true, data: mapPromoCode(row) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/promo-codes/:id
router.put('/:id', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const idOrCode = req.params.id;
    const {
      code,
      type,
      value,
      minAmount,
      min_amount,
      maxDiscount,
      max_discount,
      startDate,
      start_date,
      endDate,
      end_date,
      enabled,
    } = req.body;

    const [existing] = await pool.query(
      'SELECT * FROM promo_codes WHERE user_id = $1 AND (id::text = $2 OR code = $2)',
      [req.user.id, idOrCode]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Promo code not found' });
    }

    const current = existing[0];
    const newCode = code !== undefined ? String(code).trim().toUpperCase() : current.code;
    const newType = type !== undefined ? type : current.type;
    const newValue = value !== undefined ? Number(value) : current.value;
    const newMinAmount = minAmount !== undefined ? Number(minAmount) : (min_amount !== undefined ? Number(min_amount) : current.min_amount);
    const newMaxDiscount = maxDiscount !== undefined ? (maxDiscount === null || maxDiscount === '' ? null : Number(maxDiscount)) : (max_discount !== undefined ? (max_discount === null || max_discount === '' ? null : Number(max_discount)) : current.max_discount);
    const newStartDate = startDate !== undefined ? startDate : (start_date !== undefined ? start_date : current.start_date);
    const newEndDate = endDate !== undefined ? endDate : (end_date !== undefined ? end_date : current.end_date);
    const newEnabled = enabled !== undefined ? !!enabled : current.enabled;

    // Check duplicate if code is changing
    if (newCode !== current.code) {
      const [dup] = await pool.query(
        'SELECT id FROM promo_codes WHERE user_id = $1 AND code = $2 AND id != $3',
        [req.user.id, newCode, current.id]
      );
      if (dup && dup.length > 0) {
        return res.status(409).json({ success: false, error: `Promo code '${newCode}' already exists` });
      }
    }

    const [updated] = await pool.query(
      `UPDATE promo_codes SET
        code = $1,
        type = $2,
        value = $3,
        min_amount = $4,
        max_discount = $5,
        start_date = $6,
        end_date = $7,
        enabled = $8,
        updated_at = NOW()
      WHERE user_id = $9 AND id = $10
      RETURNING *`,
      [newCode, newType, newValue, newMinAmount, newMaxDiscount, newStartDate, newEndDate, newEnabled, req.user.id, current.id]
    );

    const row = Array.isArray(updated) ? updated[0] : updated;
    res.json({ success: true, data: mapPromoCode(row) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/promo-codes/:id
router.delete('/:id', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const idOrCode = req.params.id;

    const [result] = await pool.query(
      'DELETE FROM promo_codes WHERE user_id = $1 AND (id::text = $2 OR code = $2) RETURNING id',
      [req.user.id, idOrCode]
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, error: 'Promo code not found' });
    }

    res.json({ success: true, message: 'Promo code deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
