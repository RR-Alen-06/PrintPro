const { getPool } = require('../config/db');
const logger = require('../utils/logger');

// Helper to recalculate customer loyalty points from loyalty_events and update customers table
async function recalculateCustomerPoints(connOrPool, customerId, userId) {
  const [rows] = await connOrPool.query(
    'SELECT COALESCE(SUM(points), 0) AS total_points FROM loyalty_events WHERE customer_id = ? AND user_id = ?',
    [customerId, userId]
  );
  const total = Math.max(0, parseInt(rows[0]?.total_points || 0, 10));

  await connOrPool.query(
    'UPDATE customers SET loyalty_points = ? WHERE id = ? AND user_id = ?',
    [total, customerId, userId]
  );

  return total;
}

// GET /api/loyalty/settings
async function getSettings(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM loyalty_settings WHERE user_id = ?', [req.user.id]);
    if (rows.length === 0) {
      await pool.query('INSERT INTO loyalty_settings (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING', [req.user.id]);
      const [newRows] = await pool.query('SELECT * FROM loyalty_settings WHERE user_id = ?', [req.user.id]);
      return res.json({ success: true, data: newRows[0] || {} });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/loyalty/settings
async function updateSettings(req, res, next) {
  try {
    const pool = getPool();
    const { points_per_rupee, rupee_per_point, min_points_redeem, tier_config, redeem_options, is_enabled } = req.body;

    await pool.query(
      `INSERT INTO loyalty_settings (user_id, points_per_rupee, rupee_per_point, min_points_redeem, tier_config, redeem_options, is_enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         points_per_rupee = COALESCE(EXCLUDED.points_per_rupee, loyalty_settings.points_per_rupee),
         rupee_per_point = COALESCE(EXCLUDED.rupee_per_point, loyalty_settings.rupee_per_point),
         min_points_redeem = COALESCE(EXCLUDED.min_points_redeem, loyalty_settings.min_points_redeem),
         tier_config = COALESCE(EXCLUDED.tier_config, loyalty_settings.tier_config),
         redeem_options = COALESCE(EXCLUDED.redeem_options, loyalty_settings.redeem_options),
         is_enabled = COALESCE(EXCLUDED.is_enabled, loyalty_settings.is_enabled),
         updated_at = NOW()`,
      [
        req.user.id,
        points_per_rupee ?? 1.0,
        rupee_per_point ?? 0.1,
        min_points_redeem ?? 100,
        tier_config ? (typeof tier_config === 'string' ? tier_config : JSON.stringify(tier_config)) : '[]',
        redeem_options ? (typeof redeem_options === 'string' ? redeem_options : JSON.stringify(redeem_options)) : '[]',
        is_enabled !== undefined ? is_enabled : true,
      ]
    );

    const [updated] = await pool.query('SELECT * FROM loyalty_settings WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
}

// GET /api/loyalty/customer/:id
async function getCustomerLoyalty(req, res, next) {
  try {
    const pool = getPool();
    const customerId = req.params.id;

    const [customer] = await pool.query('SELECT id, name, loyalty_points FROM customers WHERE id = ? AND user_id = ?', [customerId, req.user.id]);
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [events] = await pool.query(
      'SELECT * FROM loyalty_events WHERE customer_id = ? AND user_id = ? ORDER BY created_at DESC',
      [customerId, req.user.id]
    );

    const [sumRows] = await pool.query(
      'SELECT COALESCE(SUM(points), 0) AS total_points FROM loyalty_events WHERE customer_id = ? AND user_id = ?',
      [customerId, req.user.id]
    );
    const balance = Math.max(0, parseInt(sumRows[0]?.total_points || 0, 10));

    res.json({
      success: true,
      data: {
        customerId,
        customerName: customer[0].name,
        balance,
        events,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/loyalty/customer/:id/adjust
async function adjustCustomerLoyalty(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const customerId = req.params.id;
    const { points, event_type, notes, operation } = req.body;

    let pts = parseInt(points, 10) || 0;
    if (operation === 'deduct' || event_type === 'manual_deduct') {
      pts = -Math.abs(pts);
    } else if (operation === 'add' || event_type === 'manual_add') {
      pts = Math.abs(pts);
    }

    if (pts === 0) {
      return res.status(400).json({ success: false, error: 'Points adjustment must not be zero' });
    }

    const [custRows] = await conn.query('SELECT id, name FROM customers WHERE id = ? AND user_id = ?', [customerId, req.user.id]);
    if (custRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const type = event_type || (pts >= 0 ? 'manual_add' : 'manual_deduct');

    const [resInsert] = await conn.query(
      `INSERT INTO loyalty_events (user_id, customer_id, event_type, points, notes, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, customerId, type, pts, notes || 'Manual points adjustment by owner']
    );

    const newBalance = await recalculateCustomerPoints(conn, customerId, req.user.id);

    await conn.commit();

    const [createdEvent] = await pool.query('SELECT * FROM loyalty_events WHERE id = ? AND user_id = ?', [resInsert.insertId, req.user.id]);

    res.status(201).json({
      success: true,
      data: {
        balance: newBalance,
        event: createdEvent[0],
      },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// DELETE /api/loyalty/events/:eventId
async function deleteLoyaltyEvent(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const eventId = req.params.eventId;

    const [events] = await conn.query(
      'SELECT * FROM loyalty_events WHERE id = ? AND user_id = ?',
      [eventId, req.user.id]
    );

    if (events.length === 0) {
      return res.status(404).json({ success: false, error: 'Loyalty event not found' });
    }

    const event = events[0];
    const customerId = event.customer_id;

    await conn.query('DELETE FROM loyalty_events WHERE id = ? AND user_id = ?', [eventId, req.user.id]);

    const newBalance = await recalculateCustomerPoints(conn, customerId, req.user.id);

    await conn.commit();

    res.json({
      success: true,
      message: 'Loyalty event deleted and customer points recalculated',
      data: {
        customerId,
        new_balance: newBalance,
      },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// POST /api/loyalty/earn (internal/called when bill is paid)
async function earnPoints(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_id, bill_id, points, notes } = req.body;

    const pts = Math.abs(parseInt(points, 10) || 0);
    if (!customer_id || pts <= 0) {
      return res.status(400).json({ success: false, error: 'customer_id and positive points are required' });
    }

    const [resInsert] = await conn.query(
      `INSERT INTO loyalty_events (user_id, customer_id, bill_id, event_type, points, notes, created_at)
       VALUES (?, ?, ?, 'earn', ?, ?, NOW())`,
      [req.user.id, customer_id, bill_id || null, pts, notes || (bill_id ? `Earned from bill #${bill_id}` : 'Points earned')]
    );

    const newBalance = await recalculateCustomerPoints(conn, customer_id, req.user.id);

    await conn.commit();

    res.status(201).json({
      success: true,
      data: {
        event_id: resInsert.insertId,
        points_earned: pts,
        new_balance: newBalance,
      },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// POST /api/loyalty/redeem (internal/called at billing)
async function redeemPoints(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_id, bill_id, points, notes } = req.body;

    const pts = Math.abs(parseInt(points, 10) || 0);
    if (!customer_id || pts <= 0) {
      return res.status(400).json({ success: false, error: 'customer_id and positive points to redeem are required' });
    }

    const [resInsert] = await conn.query(
      `INSERT INTO loyalty_events (user_id, customer_id, bill_id, event_type, points, notes, created_at)
       VALUES (?, ?, ?, 'redeem', ?, ?, NOW())`,
      [req.user.id, customer_id, bill_id || null, -pts, notes || (bill_id ? `Redeemed on bill #${bill_id}` : 'Points redeemed')]
    );

    const newBalance = await recalculateCustomerPoints(conn, customer_id, req.user.id);

    await conn.commit();

    res.status(201).json({
      success: true,
      data: {
        event_id: resInsert.insertId,
        points_redeemed: pts,
        new_balance: newBalance,
      },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// GET /api/loyalty/events
async function listEvents(req, res, next) {
  try {
    const pool = getPool();
    const { customer_id } = req.query;
    let sql = `
      SELECT le.*, c.name AS customer_name
      FROM loyalty_events le
      LEFT JOIN customers c ON le.customer_id = c.id AND le.user_id = c.user_id
      WHERE le.user_id = ?
    `;
    const params = [req.user.id];

    if (customer_id) {
      sql += ' AND le.customer_id = ?';
      params.push(customer_id);
    }

    sql += ' ORDER BY le.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
  getCustomerLoyalty,
  adjustCustomerLoyalty,
  deleteLoyaltyEvent,
  earnPoints,
  redeemPoints,
  listEvents,
};
