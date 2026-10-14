const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');
const logger = require('../utils/logger');

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

// DELETE /api/settings/clear-all-data
router.delete('/clear-all-data', async (req, res, next) => {
  let conn;
  try {
    const pool = getPool();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const userId = req.user.id;
    logger.warn(`Initiating Factory Reset (Clear All Data) for user ${userId}`);

    // Ordered transactional deletion respecting foreign key constraints
    await conn.query('DELETE FROM payments WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM advance_payments WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM promo_uses WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM promo_codes WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM bill_items WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM bills WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM group_bills WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM customer_groups WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM customers WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM purchases WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM upi_transactions WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM cash_sessions WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM loyalty_events WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM inventory_items WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM audit_log WHERE user_id = ?', [userId]);

    await conn.commit();
    logger.info(`Factory Reset completed successfully for user ${userId}`);

    res.json({ success: true, message: 'All business data has been permanently cleared.' });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rbErr) {
        logger.error(`Rollback failed during clear-all-data: ${rbErr.message}`);
      }
    }
    next(err);
  } finally {
    if (conn) {
      conn.release();
    }
  }
});

module.exports = router;

