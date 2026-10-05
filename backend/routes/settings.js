const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');

// GET /api/settings
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM user_settings WHERE user_id = ?', [req.user.id]);
    if (rows.length === 0) {
      await pool.query('INSERT INTO user_settings (user_id, settings) VALUES (?, ?) ON CONFLICT (user_id) DO NOTHING', [req.user.id, '{}']);
      return res.json({ success: true, data: { settings: {} } });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings
router.put('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { settings } = req.body;
    const settingsJson = typeof settings === 'object' ? JSON.stringify(settings) : (settings || '{}');

    await pool.query(
      `INSERT INTO user_settings (user_id, settings, updated_at)
       VALUES (?, ?, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         settings = EXCLUDED.settings,
         updated_at = NOW()`,
      [req.user.id, settingsJson]
    );

    const [updated] = await pool.query('SELECT * FROM user_settings WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
