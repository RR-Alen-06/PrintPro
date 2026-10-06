const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');
const logger = require('../utils/logger');

// Helper to get active session ID
async function getActiveSessionId(poolOrConn, userId) {
  const [rows] = await poolOrConn.query(
    `SELECT id FROM cash_sessions WHERE user_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
    [userId]
  );
  return rows.length > 0 ? rows[0].id : null;
}

// GET /api/cash-sessions - List all sessions
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM cash_sessions WHERE user_id = ? ORDER BY opened_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/cash-sessions/active - Get currently open session with live running totals
router.get('/active', async (req, res, next) => {
  try {
    const pool = getPool();
    const [sessions] = await pool.query(
      `SELECT * FROM cash_sessions WHERE user_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (sessions.length === 0) {
      return res.json({ success: true, data: null });
    }

    const session = sessions[0];
    const sessionId = session.id;
    const openedAt = session.opened_at;

    // 1. Total cash payments linked to this session (or created after opened_at with session_id)
    const [payRows] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN is_refund = false AND deleted_at IS NULL THEN cash_amount ELSE 0 END), 0) AS cash_in,
         COALESCE(SUM(CASE WHEN is_refund = true AND deleted_at IS NULL THEN ABS(cash_amount) ELSE 0 END), 0) AS cash_refunds,
         COALESCE(SUM(CASE WHEN is_refund = false AND deleted_at IS NULL THEN upi_amount ELSE 0 END), 0) AS upi_in
       FROM payments
       WHERE user_id = ? AND (session_id = ? OR (session_id IS NULL AND date >= ?))`,
      [req.user.id, sessionId, openedAt]
    );

    // 2. Total cash expenses during session
    const [expRows] = await pool.query(
      `SELECT
         COALESCE(SUM(total), 0) AS cash_expenses
       FROM purchases
       WHERE user_id = ? AND (session_id = ? OR (session_id IS NULL AND date >= ?))`,
      [req.user.id, sessionId, openedAt]
    );

    const openingCash = parseFloat(session.opening_cash) || 0;
    const cashIn = parseFloat(payRows[0].cash_in) || 0;
    const cashRefunds = parseFloat(payRows[0].cash_refunds) || 0;
    const upiIn = parseFloat(payRows[0].upi_in) || 0;
    const cashExpenses = parseFloat(expRows[0].cash_expenses) || 0;

    const currentExpectedCash = parseFloat((openingCash + cashIn - cashRefunds - cashExpenses).toFixed(2));

    res.json({
      success: true,
      data: {
        ...session,
        cash_in: cashIn,
        cash_refunds: cashRefunds,
        upi_in: upiIn,
        cash_expenses: cashExpenses,
        current_expected_cash: currentExpectedCash
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/cash-sessions/open - Open a new register session
router.post('/open', async (req, res, next) => {
  const pool = getPool();
  try {
    const { opening_cash = 0, opening_float, notes } = req.body;
    const floatVal = parseFloat(opening_float !== undefined ? opening_float : opening_cash) || 0;

    // Reject if a session is already open
    const [existing] = await pool.query(
      `SELECT id FROM cash_sessions WHERE user_id = ? AND status = 'open' LIMIT 1`,
      [req.user.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'An active cash register session is already open. Please close the active session first.'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO cash_sessions (user_id, opened_at, opening_cash, status, notes)
       VALUES (?, NOW(), ?, 'open', ?)`,
      [req.user.id, floatVal, notes || '']
    );

    const [created] = await pool.query('SELECT * FROM cash_sessions WHERE id = ? AND user_id = ?', [result.insertId, req.user.id]);
    logger.info(`Cash session #${result.insertId} opened with float ₹${floatVal}`);

    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/cash-sessions/:id/close - Close a cash session with physical count
router.post('/:id/close', async (req, res, next) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { closing_cash, physical_count, notes } = req.body;

    const countVal = parseFloat(physical_count !== undefined ? physical_count : closing_cash) || 0;

    const [sessions] = await conn.query(
      'SELECT * FROM cash_sessions WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ success: false, error: 'Cash session not found' });
    }

    const session = sessions[0];
    if (session.status === 'closed') {
      return res.status(400).json({ success: false, error: 'Session is already closed' });
    }

    const openedAt = session.opened_at;

    // Tag any untagged payments and purchases during this session window
    await conn.query(
      `UPDATE payments SET session_id = ?
       WHERE user_id = ? AND session_id IS NULL AND date >= ?`,
      [id, req.user.id, openedAt]
    );

    await conn.query(
      `UPDATE purchases SET session_id = ?
       WHERE user_id = ? AND session_id IS NULL AND date >= ?`,
      [id, req.user.id, openedAt]
    );

    // Calculate sum of cash payments and refunds
    const [payRows] = await conn.query(
      `SELECT
         COALESCE(SUM(CASE WHEN is_refund = false AND deleted_at IS NULL THEN cash_amount ELSE 0 END), 0) AS cash_in,
         COALESCE(SUM(CASE WHEN is_refund = true AND deleted_at IS NULL THEN ABS(cash_amount) ELSE 0 END), 0) AS cash_refunds
       FROM payments
       WHERE user_id = ? AND session_id = ?`,
      [req.user.id, id]
    );

    // Calculate sum of cash expenses
    const [expRows] = await conn.query(
      `SELECT
         COALESCE(SUM(total), 0) AS cash_expenses
       FROM purchases
       WHERE user_id = ? AND session_id = ?`,
      [req.user.id, id]
    );

    const openingCash = parseFloat(session.opening_cash) || 0;
    const cashIn = parseFloat(payRows[0].cash_in) || 0;
    const cashRefunds = parseFloat(payRows[0].cash_refunds) || 0;
    const cashExpenses = parseFloat(expRows[0].cash_expenses) || 0;

    const expectedCash = parseFloat((openingCash + cashIn - cashRefunds - cashExpenses).toFixed(2));
    const discrepancy = parseFloat((countVal - expectedCash).toFixed(2));

    await conn.query(
      `UPDATE cash_sessions SET
         closed_at = NOW(),
         closing_cash = ?,
         expected_cash = ?,
         discrepancy = ?,
         status = 'closed',
         notes = CASE WHEN ? != '' THEN ? ELSE notes END
       WHERE id = ? AND user_id = ?`,
      [countVal, expectedCash, discrepancy, notes || '', notes || '', id, req.user.id]
    );

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM cash_sessions WHERE id = ? AND user_id = ?', [id, req.user.id]);
    logger.info(`Cash session #${id} closed. Count: ₹${countVal}, Expected: ₹${expectedCash}, Variance: ₹${discrepancy}`);

    res.json({ success: true, data: updated[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/cash-sessions/:id/report - Full Z-Report data
router.get('/:id/report', async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [sessions] = await pool.query(
      'SELECT * FROM cash_sessions WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ success: false, error: 'Cash session not found' });
    }

    const session = sessions[0];

    // Fetch payments
    const [payments] = await pool.query(
      `SELECT p.*, b.id as bill_code, c.name as customer_name
       FROM payments p
       LEFT JOIN bills b ON p.bill_id::text = b.id::text AND p.user_id = b.user_id
       LEFT JOIN customers c ON p.customer_id::text = c.id::text AND p.user_id = c.user_id
       WHERE p.user_id = ? AND p.session_id = ? AND p.deleted_at IS NULL
       ORDER BY p.date ASC`,
      [req.user.id, id]
    );

    // Fetch expenses
    const [expenses] = await pool.query(
      `SELECT * FROM purchases
       WHERE user_id = ? AND session_id = ?
       ORDER BY date ASC`,
      [req.user.id, id]
    );

    const normalPayments = payments.filter(p => !p.is_refund);
    const refundPayments = payments.filter(p => p.is_refund);

    const totalCashIn = normalPayments.reduce((s, p) => s + (parseFloat(p.cash_amount) || 0), 0);
    const totalUpiIn = normalPayments.reduce((s, p) => s + (parseFloat(p.upi_amount) || 0), 0);
    const totalCashRefunds = refundPayments.reduce((s, p) => s + Math.abs(parseFloat(p.cash_amount) || 0), 0);
    const totalCashExpenses = expenses.reduce((s, e) => s + (parseFloat(e.total) || 0), 0);

    const openingCash = parseFloat(session.opening_cash) || 0;
    const closingCash = session.closing_cash !== null ? parseFloat(session.closing_cash) : null;
    const expectedCash = session.expected_cash !== null ? parseFloat(session.expected_cash) : parseFloat((openingCash + totalCashIn - totalCashRefunds - totalCashExpenses).toFixed(2));
    const discrepancy = session.discrepancy !== null ? parseFloat(session.discrepancy) : (closingCash !== null ? parseFloat((closingCash - expectedCash).toFixed(2)) : 0);

    const report = {
      session: {
        ...session,
        opening_cash: openingCash,
        closing_cash: closingCash,
        expected_cash: expectedCash,
        discrepancy: discrepancy
      },
      summary: {
        opening_float: openingCash,
        cash_sales: parseFloat(totalCashIn.toFixed(2)),
        upi_sales: parseFloat(totalUpiIn.toFixed(2)),
        total_sales: parseFloat((totalCashIn + totalUpiIn).toFixed(2)),
        cash_refunds: parseFloat(totalCashRefunds.toFixed(2)),
        cash_expenses: parseFloat(totalCashExpenses.toFixed(2)),
        net_cash_flow: parseFloat((totalCashIn - totalCashRefunds - totalCashExpenses).toFixed(2)),
        expected_drawer: expectedCash,
        actual_drawer: closingCash,
        discrepancy: discrepancy,
        transaction_count: payments.length + expenses.length
      },
      payments: normalPayments,
      refunds: refundPayments,
      expenses: expenses
    };

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  router,
  getActiveSessionId
};
