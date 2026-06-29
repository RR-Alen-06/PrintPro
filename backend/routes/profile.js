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
    const { 
      shop_name, owner_name, phone, address, gstin, upi_id,
      settings, id_counters, advance_payments, recurring_bills, 
      customer_groups, group_bills, deleted_payments 
    } = req.body;

    const updates = {};
    if (shop_name  !== undefined) updates.shop_name  = shop_name;
    if (owner_name !== undefined) updates.owner_name = owner_name;
    if (phone      !== undefined) updates.phone      = phone;
    if (address    !== undefined) updates.address    = address;
    if (gstin      !== undefined) updates.gstin      = gstin;
    if (upi_id     !== undefined) updates.upi_id     = upi_id;

    // Handle JSONB fields (serialize objects to strings if needed, or pass directly. Postgres pg driver accepts JS objects directly for JSONB parameters)
    if (settings !== undefined) updates.settings = typeof settings === 'string' ? settings : JSON.stringify(settings);
    if (id_counters !== undefined) updates.id_counters = typeof id_counters === 'string' ? id_counters : JSON.stringify(id_counters);
    if (advance_payments !== undefined) updates.advance_payments = typeof advance_payments === 'string' ? advance_payments : JSON.stringify(advance_payments);
    if (recurring_bills !== undefined) updates.recurring_bills = typeof recurring_bills === 'string' ? recurring_bills : JSON.stringify(recurring_bills);
    if (customer_groups !== undefined) updates.customer_groups = typeof customer_groups === 'string' ? customer_groups : JSON.stringify(customer_groups);
    if (group_bills !== undefined) updates.group_bills = typeof group_bills === 'string' ? group_bills : JSON.stringify(group_bills);
    if (deleted_payments !== undefined) updates.deleted_payments = typeof deleted_payments === 'string' ? deleted_payments : JSON.stringify(deleted_payments);

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
