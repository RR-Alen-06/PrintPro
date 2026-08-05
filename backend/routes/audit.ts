import express from 'express';
import { getPool } from '../config/db';

const router = express.Router();

// GET /api/audit?entity_type=&action=&limit=50
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const { entity_type, action, limit = 50 } = req.query;
    let sql = 'SELECT * FROM audit_log WHERE user_id = $1';
    const params: any[] = [req.user.id];

    if (entity_type) {
      params.push(entity_type);
      sql += ` AND entity_type = $${params.length}`;
    }
    if (action) {
      params.push(action);
      sql += ` AND action = $${params.length}`;
    }

    params.push(parseInt(String(limit), 10));
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/audit/:entity_type/:entity_id
router.get('/:entity_type/:entity_id', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const { entity_type, entity_id } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM audit_log WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3 ORDER BY created_at DESC',
      [req.user.id, entity_type, entity_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

export default router;
