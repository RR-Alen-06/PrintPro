import express from 'express';
import { getPool } from '../config/db';

const router = express.Router();

// GET /api/profile
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM business_profile WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, data: rows[0] || {} });
  } catch (err) { next(err); }
});

// PUT /api/profile
import { validateProfile } from '../middleware/validate';
router.put('/', validateProfile, async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const { shop_name, owner_name, phone, address, gstin, upi_id } = req.body;

    const updates: Record<string, any> = {};
    if (shop_name  !== undefined) updates.shop_name  = shop_name;
    if (owner_name !== undefined) updates.owner_name = owner_name;
    if (phone      !== undefined) updates.phone      = phone;
    if (address    !== undefined) updates.address    = address;
    if (gstin      !== undefined) updates.gstin      = gstin;
    if (upi_id     !== undefined) updates.upi_id     = upi_id;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const keys = Object.keys(updates);
    const setClauses = keys.map((k, idx) => `${k} = $${idx + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(req.user.id);
    await pool.query(`UPDATE business_profile SET ${setClauses} WHERE user_id = $${values.length}`, values);

    const [updated] = await pool.query('SELECT * FROM business_profile WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
});

export default router;
