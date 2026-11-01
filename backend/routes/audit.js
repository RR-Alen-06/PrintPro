const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');

// DTO projection: Return only fields needed by UI and strip internal user_id
function toAuditLogDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    old_value: row.old_value,
    new_value: row.new_value,
    timestamp: row.timestamp
  };
}

// GET /api/audit?entity_type=&action=&limit=50
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { entity_type, action, limit = 100 } = req.query;

    let sql = 'SELECT id, action, entity_type, entity_id, old_value, new_value, timestamp FROM audit_log WHERE user_id = ?';
    const params = [req.user.id];

    if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
    if (action)      { sql += ' AND action = ?';      params.push(action); }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows.map(toAuditLogDto) });
  } catch (err) { next(err); }
});

// GET /api/audit/:entity_type/:entity_id
router.get('/:entity_type/:entity_id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { entity_type, entity_id } = req.params;
    const [rows] = await pool.query(
      'SELECT id, action, entity_type, entity_id, old_value, new_value, timestamp FROM audit_log WHERE user_id = ? AND entity_type = ? AND entity_id = ? ORDER BY timestamp DESC',
      [req.user.id, entity_type, entity_id]
    );
    res.json({ success: true, data: rows.map(toAuditLogDto) });
  } catch (err) { next(err); }
});

module.exports = router;
