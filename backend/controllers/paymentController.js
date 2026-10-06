const { getPool } = require('../config/db');
const logger = require('../utils/logger');

// GET /bill/:billId - Get payments for a specific bill
async function getPaymentsForBill(req, res, next) {
  try {
    const pool = getPool();
    const billId = req.params.billId || req.params.id;

    const [bill] = await pool.query('SELECT id FROM bills WHERE id = ? AND user_id = ?', [billId, req.user.id]);
    if (bill.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const [payments] = await pool.query(
      'SELECT * FROM payments WHERE bill_id = ? AND user_id = ? AND deleted_at IS NULL ORDER BY date ASC',
      [billId, req.user.id]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

/**
 * POST / - Record payment with FIFO allocation.
 */
async function recordPayment(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { bill_id, customer_id, cash_amount, upi_amount, notes } = req.body;

    const cashAmt = parseFloat(cash_amount) || 0;
    const upiAmt = parseFloat(upi_amount) || 0;
    const totalPaid = parseFloat((cashAmt + upiAmt).toFixed(2));

    if (totalPaid <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    // Resolve customer_id: either passed directly or derived from bill_id
    let customerId = customer_id;
    if (!customerId && bill_id) {
      const [billRows] = await conn.query(
        'SELECT customer_id FROM bills WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [bill_id, req.user.id]
      );
      if (billRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }
      customerId = billRows[0].customer_id;
    }

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'customer_id or bill_id is required' });
    }

    // Verify customer belongs to the user
    const [custRows] = await conn.query('SELECT id FROM customers WHERE id = ? AND user_id = ?', [customerId, req.user.id]);
    if (custRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Resolve active session ID if not passed
    let activeSessionId = req.body.session_id || null;
    if (!activeSessionId) {
      const [sessRows] = await conn.query(
        `SELECT id FROM cash_sessions WHERE user_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
        [req.user.id]
      );
      if (sessRows.length > 0) activeSessionId = sessRows[0].id;
    }

    // ── FIFO: get all unpaid/partial bills for this customer, oldest first ────
    const [unpaidBills] = await conn.query(
      `SELECT * FROM bills
       WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL AND status != 'paid'
       ORDER BY date ASC, id ASC`,
      [customerId, req.user.id]
    );

    let remainingCash = cashAmt;
    let remainingUpi = upiAmt;
    const paymentRecords = [];

    for (const bill of unpaidBills) {
      const outstanding = parseFloat(bill.balance);
      if (outstanding <= 0) continue;

      let applyCash = 0;
      let applyUpi = 0;

      if (remainingCash > 0) {
        applyCash = Math.min(remainingCash, outstanding);
        remainingCash = parseFloat((remainingCash - applyCash).toFixed(2));
      }
      const remainingAfterCash = parseFloat((outstanding - applyCash).toFixed(2));
      if (remainingUpi > 0 && remainingAfterCash > 0) {
        applyUpi = Math.min(remainingUpi, remainingAfterCash);
        remainingUpi = parseFloat((remainingUpi - applyUpi).toFixed(2));
      }

      const applyTotal = parseFloat((applyCash + applyUpi).toFixed(2));
      if (applyTotal <= 0) continue;

      const newAmountPaid = parseFloat((parseFloat(bill.amount_paid) + applyTotal).toFixed(2));
      const newBalance = parseFloat(Math.max(parseFloat(bill.total) - newAmountPaid, 0).toFixed(2));
      const newStatus = newAmountPaid >= parseFloat(bill.total) ? 'paid' : 'partial';
      const paymentType = newStatus === 'paid' ? 'full' : 'partial';

      // Insert payment record for this bill
      const [payResult] = await conn.query(
        `INSERT INTO payments (user_id, bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes, session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, bill.id, customerId, applyCash, applyUpi, applyTotal, paymentType, notes || 'FIFO payment', activeSessionId]
      );

      // Auto-create UPI transaction if upi_amount > 0
      if (applyUpi > 0) {
        await conn.query(
          `INSERT INTO upi_transactions (user_id, payment_id, bill_id, customer_id, upi_ref, amount, status, date)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
          [req.user.id, payResult.insertId, bill.id, customerId, req.body.upi_ref || '', applyUpi]
        );
      }

      // Update the bill
      await conn.query(
        'UPDATE bills SET amount_paid = ?, balance = ?, status = ? WHERE id = ? AND user_id = ?',
        [newAmountPaid, newBalance, newStatus, bill.id, req.user.id]
      );

      // Audit log
      await conn.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.user.id, 'PAYMENT', 'payment', String(payResult.insertId),
          JSON.stringify({ bill_id: bill.id, old_balance: outstanding, old_status: bill.status }),
          JSON.stringify({ applied: applyTotal, new_balance: newBalance, new_status: newStatus })
        ]
      );

      paymentRecords.push({ paymentId: payResult.insertId, billId: bill.id, applied: applyTotal, newBalance, newStatus });

      if (remainingCash <= 0 && remainingUpi <= 0) break;
    }

    // ── Handle excess (overpayment) ───────────────────────────────────────────
    const excess = parseFloat((remainingCash + remainingUpi).toFixed(2));
    if (excess > 0) {
      await conn.query(
        'UPDATE customers SET credit_balance = credit_balance + ? WHERE id = ? AND user_id = ?',
        [excess, customerId, req.user.id]
      );

      // Record excess as a payment entry (no specific bill)
      if (paymentRecords.length === 0 && bill_id) {
        const [pr] = await conn.query(
          `INSERT INTO payments (user_id, bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes, session_id)
           VALUES (?, ?, ?, ?, ?, ?, 'full', ?, ?)`,
          [req.user.id, bill_id, customerId, remainingCash, remainingUpi, excess, 'Advance/overpayment credit', activeSessionId]
        );
        if (remainingUpi > 0) {
          await conn.query(
            `INSERT INTO upi_transactions (user_id, payment_id, bill_id, customer_id, upi_ref, amount, status, date)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [req.user.id, pr.insertId, bill_id, customerId, req.body.upi_ref || '', remainingUpi]
          );
        }
        paymentRecords.push({ paymentId: pr.insertId, billId: bill_id, applied: excess, excess });
      }

      logger.info(`FIFO: Excess credit added to customer balance`, { customerId, excess: process.env.NODE_ENV === 'production' ? '[REDACTED]' : excess.toFixed(2) });
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      data: {
        payments: paymentRecords,
        excess_to_credit: excess,
        total_applied: parseFloat((totalPaid - excess).toFixed(2)),
      }
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// POST /refund - Transactional refund for a bill
async function recordRefund(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { bill_id, customer_id, refund_amount, cash_amount, upi_amount, refund_method, notes, advance_refund_amount, session_id } = req.body;

    let activeSessionId = session_id || null;
    if (!activeSessionId) {
      const [sessRows] = await conn.query(
        `SELECT id FROM cash_sessions WHERE user_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
        [req.user.id]
      );
      if (sessRows.length > 0) activeSessionId = sessRows[0].id;
    }

    const cashRefund = Math.abs(parseFloat(cash_amount) || 0);
    const upiRefund = Math.abs(parseFloat(upi_amount) || 0);
    let totalRefund = Math.abs(parseFloat(refund_amount) || (cashRefund + upiRefund));

    if (totalRefund <= 0 && (!advance_refund_amount || parseFloat(advance_refund_amount) <= 0)) {
      return res.status(400).json({ success: false, error: 'Refund amount must be greater than zero' });
    }

    let customerId = customer_id;
    let bill = null;

    if (bill_id && bill_id !== 'REFUND') {
      const [billRows] = await conn.query(
        'SELECT * FROM bills WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [bill_id, req.user.id]
      );
      if (billRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }
      bill = billRows[0];
      if (!customerId) {
        customerId = bill.customer_id;
      }

      const originalPaid = parseFloat(bill.amount_paid) || 0;
      if (totalRefund > originalPaid) {
        return res.status(400).json({
          success: false,
          error: `Refund amount (₹${totalRefund.toFixed(2)}) cannot exceed total amount paid on the bill (₹${originalPaid.toFixed(2)})`
        });
      }
    }

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'customer_id is required' });
    }

    // Verify customer
    const [custRows] = await conn.query('SELECT * FROM customers WHERE id = ? AND user_id = ?', [customerId, req.user.id]);
    if (custRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Insert refund payment row (negative amounts, is_refund = true, payment_type = 'refund')
    let payResult = null;
    if (totalRefund > 0) {
      const isCash = refund_method === 'cash' || (cashRefund > 0 && upiRefund === 0);
      const finalCash = isCash ? -totalRefund : -cashRefund;
      const finalUpi = isCash ? 0 : (upiRefund > 0 ? -upiRefund : -totalRefund);

      const [resInsert] = await conn.query(
        `INSERT INTO payments (user_id, bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, is_refund, notes, date, session_id)
         VALUES (?, ?, ?, ?, ?, ?, 'refund', true, ?, NOW(), ?)`,
        [
          req.user.id,
          bill ? bill.id : null,
          customerId,
          finalCash,
          finalUpi,
          -totalRefund,
          notes || (refund_method ? `Refund issued via ${refund_method.toUpperCase()}` : 'Refund payment'),
          activeSessionId
        ]
      );
      payResult = resInsert;

      // Update bill amount_paid, balance, status if linked to a bill
      if (bill) {
        const newAmountPaid = Math.max(0, parseFloat((parseFloat(bill.amount_paid) - totalRefund).toFixed(2)));
        const newBalance = Math.max(0, parseFloat((parseFloat(bill.total) - newAmountPaid).toFixed(2)));
        const newStatus = newAmountPaid >= parseFloat(bill.total) ? 'paid' : (newAmountPaid > 0 ? 'partial' : 'unpaid');

        await conn.query(
          'UPDATE bills SET amount_paid = ?, balance = ?, status = ? WHERE id = ? AND user_id = ?',
          [newAmountPaid, newBalance, newStatus, bill.id, req.user.id]
        );

        // Audit log
        await conn.query(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            req.user.id, 'REFUND', 'payment', String(payResult.insertId),
            JSON.stringify({ bill_id: bill.id, old_paid: bill.amount_paid, old_balance: bill.balance }),
            JSON.stringify({ refund: totalRefund, new_paid: newAmountPaid, new_balance: newBalance })
          ]
        );
      }
    }

    // Handle customer credit / advance balance adjustments
    if (advance_refund_amount && parseFloat(advance_refund_amount) !== 0) {
      const advAmt = parseFloat(advance_refund_amount);
      await conn.query(
        'UPDATE customers SET credit_balance = credit_balance + ? WHERE id = ? AND user_id = ?',
        [advAmt, customerId, req.user.id]
      );
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      data: {
        payment_id: payResult?.insertId,
        refund_amount: totalRefund,
        customer_id: customerId,
        bill_id: bill?.id || null
      }
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// DELETE /:id - Soft-delete payment and reverse financial impacts
async function deletePayment(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;

    const [payRows] = await conn.query(
      'SELECT * FROM payments WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, req.user.id]
    );

    if (payRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment record not found or already deleted' });
    }

    const payment = payRows[0];
    const totalPaid = parseFloat(payment.total_paid) || 0;

    // 1. Soft delete
    await conn.query('UPDATE payments SET deleted_at = NOW() WHERE id = ? AND user_id = ?', [id, req.user.id]);

    // 2. Reverse bill amount_paid & balance if attached to a bill
    if (payment.bill_id) {
      const [billRows] = await conn.query(
        'SELECT * FROM bills WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [payment.bill_id, req.user.id]
      );

      if (billRows.length > 0) {
        const bill = billRows[0];
        const newAmountPaid = Math.max(0, parseFloat((parseFloat(bill.amount_paid) - totalPaid).toFixed(2)));
        const newBalance = Math.max(0, parseFloat((parseFloat(bill.total) - newAmountPaid).toFixed(2)));
        const newStatus = newAmountPaid >= parseFloat(bill.total) ? 'paid' : (newAmountPaid > 0 ? 'partial' : 'unpaid');

        await conn.query(
          'UPDATE bills SET amount_paid = ?, balance = ?, status = ? WHERE id = ? AND user_id = ?',
          [newAmountPaid, newBalance, newStatus, bill.id, req.user.id]
        );
      }
    }

    // 3. Reverse excess credit if payment created excess credit on customer
    if (payment.customer_id && payment.excess_credit && parseFloat(payment.excess_credit) > 0) {
      await conn.query(
        'UPDATE customers SET credit_balance = GREATEST(0, credit_balance - ?) WHERE id = ? AND user_id = ?',
        [parseFloat(payment.excess_credit), payment.customer_id, req.user.id]
      );
    }

    // Audit log
    await conn.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, 'DELETE_PAYMENT', 'payment', String(id),
        JSON.stringify(payment),
        JSON.stringify({ deleted_at: new Date().toISOString() })
      ]
    );

    await conn.commit();
    res.json({ success: true, message: 'Payment soft-deleted and balances reversed successfully' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// GET /deleted - List all soft-deleted payments
async function listDeletedPayments(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS customer_name, b.total AS bill_total
       FROM payments p
       LEFT JOIN customers c ON p.customer_id = c.id AND p.user_id = c.user_id
       LEFT JOIN bills b ON p.bill_id = b.id AND p.user_id = b.user_id
       WHERE p.user_id = ? AND p.deleted_at IS NOT NULL
       ORDER BY p.deleted_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /refunds - List all refund payments with optional date filtering
async function listRefundPayments(req, res, next) {
  try {
    const pool = getPool();
    const { startDate, endDate } = req.query;
    let sql = `
      SELECT p.*, c.name AS customer_name, b.total AS bill_total
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id AND p.user_id = c.user_id
      LEFT JOIN bills b ON p.bill_id = b.id AND p.user_id = b.user_id
      WHERE p.user_id = ? AND (p.is_refund = true OR p.payment_type = 'refund' OR p.total_paid < 0) AND p.deleted_at IS NULL
    `;
    const params = [req.user.id];

    if (startDate) {
      sql += ' AND DATE(p.date) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND DATE(p.date) <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY p.date DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /customer/:customerId - Get all payments by customer
async function getPaymentsByCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { customerId } = req.params;

    const [customer] = await pool.query('SELECT id FROM customers WHERE id = ? AND user_id = ?', [customerId, req.user.id]);
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [payments] = await pool.query(
      `SELECT p.*, b.total AS bill_total, b.status AS bill_status
       FROM payments p
       LEFT JOIN bills b ON p.bill_id = b.id AND p.user_id = b.user_id
       WHERE p.customer_id = ? AND p.user_id = ? AND p.deleted_at IS NULL
       ORDER BY p.date DESC`,
      [customerId, req.user.id]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

// GET / - Get all active payments for the user
async function listAllPayments(req, res, next) {
  try {
    const pool = getPool();
    const [payments] = await pool.query(
      'SELECT * FROM payments WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC',
      [req.user.id]
    );
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPaymentsForBill,
  recordPayment,
  recordRefund,
  deletePayment,
  listDeletedPayments,
  listRefundPayments,
  getPaymentsByCustomer,
  listAllPayments
};
