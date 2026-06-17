const { getPool } = require('../config/db');
const logger = require('../utils/logger');

// GET /bill/:billId - Get payments for a specific bill
async function getPaymentsForBill(req, res, next) {
  try {
    const pool = getPool();
    const billId = req.params.billId || req.params.id;

    const [bill] = await pool.query('SELECT id FROM bills WHERE id = ?', [billId]);
    if (bill.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const [payments] = await pool.query(
      'SELECT * FROM payments WHERE bill_id = ? ORDER BY date ASC',
      [billId]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

/**
 * POST / - Record payment with FIFO allocation.
 *
 * Instead of applying the payment only to the requested bill_id, we:
 * 1. Find all unpaid/partial bills for that customer, sorted oldest-first (FIFO).
 * 2. Distribute the payment across those bills sequentially.
 * 3. Any remaining overpayment is added to the customer's credit_balance.
 *
 * This matches the frontend AppContext.recordPayment() FIFO logic.
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
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    // Resolve customer_id: either passed directly or derived from bill_id
    let customerId = customer_id;
    if (!customerId && bill_id) {
      const [billRows] = await conn.query(
        'SELECT customer_id FROM bills WHERE id = ? AND deleted_at IS NULL',
        [bill_id]
      );
      if (billRows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }
      customerId = billRows[0].customer_id;
    }

    if (!customerId) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, error: 'customer_id or bill_id is required' });
    }

    // ── FIFO: get all unpaid/partial bills for this customer, oldest first ────
    const [unpaidBills] = await conn.query(
      `SELECT * FROM bills
       WHERE customer_id = ? AND deleted_at IS NULL AND status != 'paid'
       ORDER BY date ASC, id ASC`,
      [customerId]
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
        `INSERT INTO payments (bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [bill.id, customerId, applyCash, applyUpi, applyTotal, paymentType, notes || 'FIFO payment']
      );

      // Update the bill
      await conn.query(
        'UPDATE bills SET amount_paid = ?, balance = ?, status = ? WHERE id = ?',
        [newAmountPaid, newBalance, newStatus, bill.id]
      );

      // Audit log
      await conn.query(
        `INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?)`,
        [
          'PAYMENT', 'payment', String(payResult.insertId),
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
        'UPDATE customers SET credit_balance = credit_balance + ? WHERE id = ?',
        [excess, customerId]
      );

      // Record excess as a payment entry (no specific bill)
      if (paymentRecords.length === 0 && bill_id) {
        // If no unpaid bills were found but a bill_id was given, still record it
        const [pr] = await conn.query(
          `INSERT INTO payments (bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes)
           VALUES (?, ?, ?, ?, ?, 'full', ?)`,
          [bill_id, customerId, remainingCash, remainingUpi, excess, 'Advance/overpayment credit']
        );
        paymentRecords.push({ paymentId: pr.insertId, billId: bill_id, applied: excess, excess });
      }

      logger.info(`FIFO: Excess credit added to customer balance`, { customerId, excess: process.env.NODE_ENV === 'production' ? '[REDACTED]' : excess.toFixed(2) });
    }

    await conn.commit();
    conn.release();

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
    conn.release();
    next(err);
  }
}

// GET /customer/:customerId - Get all payments by customer
async function getPaymentsByCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { customerId } = req.params;

    const [customer] = await pool.query('SELECT id FROM customers WHERE id = ?', [customerId]);
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [payments] = await pool.query(
      `SELECT p.*, b.total AS bill_total, b.status AS bill_status
       FROM payments p
       LEFT JOIN bills b ON p.bill_id = b.id
       WHERE p.customer_id = ?
       ORDER BY p.date DESC`,
      [customerId]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPaymentsForBill,
  recordPayment,
  getPaymentsByCustomer
};
