const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');

// GET /api/profile
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM business_profile WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: rows[0] || {} });
  } catch (err) { next(err); }
});

// PUT /api/profile
const { validateProfile } = require('../middleware/validate');
router.put('/', validateProfile, async (req, res, next) => {
  try {
    const pool = getPool();
    const { shop_name, owner_name, phone, address, gstin, upi_id } = req.body;

    const updates = {};
    if (shop_name  !== undefined) updates.shop_name  = shop_name;
    if (owner_name !== undefined) updates.owner_name = owner_name;
    if (phone      !== undefined) updates.phone      = phone;
    if (address    !== undefined) updates.address    = address;
    if (gstin      !== undefined) updates.gstin      = gstin;
    if (upi_id     !== undefined) updates.upi_id     = upi_id;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await pool.query(`UPDATE business_profile SET ${setClauses} WHERE user_id = ?`, [...Object.values(updates), req.user.id]);

    const [updated] = await pool.query('SELECT * FROM business_profile WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) { next(err); }
});

module.exports = router;
