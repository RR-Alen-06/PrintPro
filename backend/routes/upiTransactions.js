const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');
const logger = require('../utils/logger');

// Helper to auto-create a UPI transaction row when a payment has upi_amount > 0
async function createUpiTransaction(connOrPool, { userId, paymentId, billId, customerId, amount, upiRef, upiId, date, status = 'pending', metadata = {} }) {
  if (!amount || parseFloat(amount) <= 0) return null;
  const numAmount = parseFloat(amount) || 0;
  const [result] = await connOrPool.query(
    `INSERT INTO upi_transactions (user_id, payment_id, bill_id, customer_id, upi_id, upi_ref, amount, status, date, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      paymentId || null,
      billId ? String(billId) : null,
      customerId ? String(customerId) : null,
      upiId || '',
      upiRef || '',
      numAmount,
      status || 'pending',
      date || new Date().toISOString(),
      JSON.stringify(metadata || {})
    ]
  );
  return result.insertId;
}

// GET /api/upi-transactions - List transactions with filters
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { startDate, endDate, status, search, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT u.*,
             c.name AS customer_name,
             c.phone AS customer_phone,
             b.total AS bill_total,
             b.status AS bill_status
      FROM upi_transactions u
      LEFT JOIN customers c ON (u.customer_id::text = c.id::text OR u.customer_id::text = c.customer_code) AND u.user_id = c.user_id
      LEFT JOIN bills b ON u.bill_id::text = b.id::text AND u.user_id = b.user_id
      WHERE u.user_id = ?
    `;
    const params = [req.user.id];

    if (startDate) {
      sql += ' AND u.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND u.date <= ?';
      params.push(endDate + ' 23:59:59');
    }
    if (status && status !== 'all') {
      sql += ' AND u.status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (u.upi_ref ILIKE ? OR u.bill_id::text ILIKE ? OR c.name ILIKE ? OR c.phone ILIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY u.date DESC, u.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/upi-transactions/summary - Daily/monthly settlement summary
router.get('/summary', async (req, res, next) => {
  try {
    const pool = getPool();
    const { startDate, endDate } = req.query;

    let filterSql = ' WHERE user_id = ?';
    const params = [req.user.id];

    if (startDate) {
      filterSql += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      filterSql += ' AND date <= ?';
      params.push(endDate + ' 23:59:59');
    }

    const [totals] = await pool.query(
      `SELECT
         COALESCE(SUM(amount), 0) AS total_volume,
         COUNT(*) AS total_count,
         COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END), 0) AS confirmed_volume,
         COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS confirmed_count,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_volume,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0) AS failed_volume,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_count
       FROM upi_transactions
       ${filterSql}`,
      params
    );

    // Daily breakdown for settlement tracking
    const [dailyRows] = await pool.query(
      `SELECT
         date::date AS settlement_date,
         COUNT(*) AS tx_count,
         COALESCE(SUM(amount), 0) AS total_amount,
         COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END), 0) AS confirmed_amount,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_amount
       FROM upi_transactions
       ${filterSql}
       GROUP BY date::date
       ORDER BY settlement_date DESC
       LIMIT 30`,
      params
    );

    res.json({
      success: true,
      data: {
        total_volume: parseFloat(totals[0].total_volume) || 0,
        total_count: parseInt(totals[0].total_count, 10) || 0,
        confirmed_volume: parseFloat(totals[0].confirmed_volume) || 0,
        confirmed_count: parseInt(totals[0].confirmed_count, 10) || 0,
        pending_volume: parseFloat(totals[0].pending_volume) || 0,
        pending_count: parseInt(totals[0].pending_count, 10) || 0,
        failed_volume: parseFloat(totals[0].failed_volume) || 0,
        failed_count: parseInt(totals[0].failed_count, 10) || 0,
        daily_breakdown: dailyRows.map(r => ({
          date: r.settlement_date,
          tx_count: parseInt(r.tx_count, 10) || 0,
          total_amount: parseFloat(r.total_amount) || 0,
          confirmed_amount: parseFloat(r.confirmed_amount) || 0,
          pending_amount: parseFloat(r.pending_amount) || 0,
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/upi-transactions/daily-settlement - Formatted daily settlement report
router.get('/daily-settlement', async (req, res, next) => {
  try {
    const pool = getPool();
    const dateParam = req.query.date || new Date().toISOString().slice(0, 10);

    const [rows] = await pool.query(
      `SELECT u.*, c.name AS customer_name, c.phone AS customer_phone
       FROM upi_transactions u
       LEFT JOIN customers c ON (u.customer_id::text = c.id::text OR u.customer_id::text = c.customer_code) AND u.user_id = c.user_id
       WHERE u.user_id = ? AND u.date::date = ?
       ORDER BY u.date ASC`,
      [req.user.id, dateParam]
    );

    const confirmedList = rows.filter(r => r.status === 'confirmed');
    const pendingList = rows.filter(r => r.status === 'pending');
    const failedList = rows.filter(r => r.status === 'failed');

    const confirmedTotal = confirmedList.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const pendingTotal = pendingList.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const failedTotal = failedList.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const grandTotal = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    res.json({
      success: true,
      data: {
        date: dateParam,
        summary: {
          total_transactions: rows.length,
          grand_total: parseFloat(grandTotal.toFixed(2)),
          confirmed_total: parseFloat(confirmedTotal.toFixed(2)),
          confirmed_count: confirmedList.length,
          pending_total: parseFloat(pendingTotal.toFixed(2)),
          pending_count: pendingList.length,
          failed_total: parseFloat(failedTotal.toFixed(2)),
          failed_count: failedList.length,
        },
        transactions: rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/upi-transactions - Manual entry
router.post('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { payment_id, bill_id, customer_id, amount, upi_ref, upi_id, date, status = 'pending', metadata } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Amount is required and must be greater than 0' });
    }

    const insertId = await createUpiTransaction(pool, {
      userId: req.user.id,
      paymentId: payment_id,
      billId: bill_id,
      customerId: customer_id,
      amount,
      upiRef: upi_ref,
      upiId: upi_id,
      date,
      status,
      metadata
    });

    const [created] = await pool.query('SELECT * FROM upi_transactions WHERE id = ? AND user_id = ?', [insertId, req.user.id]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/upi-transactions/:id - Update UTR reference, status, or metadata
router.put('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { upi_ref, status, upi_id, metadata } = req.body;

    const [existing] = await pool.query('SELECT * FROM upi_transactions WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'UPI transaction not found' });
    }

    await pool.query(
      `UPDATE upi_transactions SET
         upi_ref = COALESCE(?, upi_ref),
         status = COALESCE(?, status),
         upi_id = COALESCE(?, upi_id),
         metadata = COALESCE(?, metadata)
       WHERE id = ? AND user_id = ?`,
      [
        upi_ref !== undefined ? upi_ref : null,
        status !== undefined ? status : null,
        upi_id !== undefined ? upi_id : null,
        metadata ? JSON.stringify(metadata) : null,
        id,
        req.user.id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM upi_transactions WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/upi-transactions/bulk-confirm - Bulk confirm multiple transactions
router.post('/bulk-confirm', async (req, res, next) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { ids, status = 'confirmed' } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of transaction IDs is required' });
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [result] = await conn.query(
      `UPDATE upi_transactions SET status = ?
       WHERE id IN (${placeholders}) AND user_id = ?`,
      [status, ...ids, req.user.id]
    );

    await conn.commit();
    res.json({
      success: true,
      message: `Successfully marked ${result.affectedRows || ids.length} UPI transactions as ${status}`,
      updatedCount: result.affectedRows || ids.length
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = {
  router,
  createUpiTransaction
};
