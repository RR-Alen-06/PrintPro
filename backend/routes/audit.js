const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');

// GET /api/audit?entity_type=&action=&limit=50
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { entity_type, action, limit = 100 } = req.query;

    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];

    if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
    if (action)      { sql += ' AND action = ?';      params.push(action); }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/audit/:entity_type/:entity_id
router.get('/:entity_type/:entity_id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { entity_type, entity_id } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp DESC',
      [entity_type, entity_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
