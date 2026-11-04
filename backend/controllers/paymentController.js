const { getPool } = require('../config/db');
const logger = require('../utils/logger');
const { getNextSequence } = require('../utils/sequenceGenerator');

// Payment projection DTO: strips internal auth tenant ID (user_id)
function toPaymentDto(p) {
  if (!p) return null;
  const dto = {
    id: p.id,
    bill_id: p.bill_id,
    customer_id: p.customer_id,
    payment_number: p.payment_number || p.payment_code || '',
    date: p.date,
    cash_amount: parseFloat(p.cash_amount) || 0,
    upi_amount: parseFloat(p.upi_amount) || 0,
    total_paid: parseFloat(p.total_paid) || 0,
    payment_type: p.payment_type || 'partial',
    is_refund: !!p.is_refund,
    notes: p.notes || ''
  };
  if (p.customer_name) dto.customer_name = p.customer_name;
  if (p.bill_total !== undefined) dto.bill_total = parseFloat(p.bill_total) || 0;
  if (p.bill_status !== undefined) dto.bill_status = p.bill_status;
  if (p.deleted_at !== undefined) dto.deleted_at = p.deleted_at;
  if (p.is_reversal !== undefined) dto.is_reversal = !!p.is_reversal;
  if (p.reversal_of !== undefined) dto.reversal_of = p.reversal_of;
  if (p.reversed_amount !== undefined) dto.reversed_amount = parseFloat(p.reversed_amount) || 0;
  if (p.status !== undefined) dto.status = p.status;
  if (p.reversal_reason !== undefined) dto.reversal_reason = p.reversal_reason;
  if (p.authorized_by !== undefined) dto.authorized_by = p.authorized_by;
  if (p.excess_credit !== undefined) dto.excess_credit = parseFloat(p.excess_credit) || 0;
  return dto;
}

// GET /bill/:billId - Get payments for a specific bill
async function getPaymentsForBill(req, res, next) {
  try {
    const pool = getPool();
    const billId = req.params.billId || req.params.id;

    const [bills] = await pool.query(
      'SELECT id, bill_number, invoice_number FROM bills WHERE (id::text = ? OR bill_number = ? OR invoice_number = ?) AND user_id = ?',
      [billId, billId, billId, req.user.id]
    );
    if (bills.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const bill = bills[0];
    const [payments] = await pool.query(
      'SELECT * FROM payments WHERE (bill_id = ? OR bill_id = ? OR bill_id = ?) AND user_id = ? AND deleted_at IS NULL ORDER BY date ASC',
      [String(bill.id), bill.bill_number || '', bill.invoice_number || '', req.user.id]
    );

    res.json({ success: true, data: payments.map(toPaymentDto) });
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
    let totalPaid = parseFloat((cashAmt + upiAmt).toFixed(2));
    if (totalPaid <= 0 && req.body.total_paid) {
      totalPaid = parseFloat(Number(req.body.total_paid).toFixed(2));
    }

    if (totalPaid <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    let customerId = customer_id;
    let resolvedBill = null;

    if (bill_id) {
      const cleanBillId = String(bill_id).trim();
      const numOnly = cleanBillId.replace(/[^0-9]/g, '');
      const [billRows] = await conn.query(
        `SELECT id, customer_id, bill_number, invoice_number, balance, total, status FROM bills 
         WHERE (id::text = ? OR bill_number = ? OR invoice_number = ? 
                OR (NULLIF(regexp_replace(COALESCE(bill_number, ''), '[^0-9]', '', 'g'), '') IS NOT NULL AND regexp_replace(COALESCE(bill_number, ''), '[^0-9]', '', 'g') = ?)) 
           AND user_id = ? AND deleted_at IS NULL`,
        [cleanBillId, cleanBillId, cleanBillId, numOnly || '___none___', req.user.id]
      );
      if (billRows.length > 0) {
        resolvedBill = billRows[0];
        if (!customerId) {
          customerId = resolvedBill.customer_id;
        }
      }
    }

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'customer_id or valid bill_id is required' });
    }

    // Resolve customer to guaranteed UUID
    const [custRows] = await conn.query(
      'SELECT id, credit_balance FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [customerId, customerId, req.user.id]
    );
    if (custRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    const resolvedCustomerId = custRows[0].id;

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
       ORDER BY date ASC, created_at ASC`,
      [resolvedCustomerId, req.user.id]
    );

    let billsToProcess = unpaidBills;
    if (resolvedBill) {
      const match = unpaidBills.find(b => b.id === resolvedBill.id);
      const others = unpaidBills.filter(b => b.id !== resolvedBill.id);
      if (match) {
        billsToProcess = [match, ...others];
      } else {
        // Check if resolvedBill has unrecorded payment gap (total > sum(payments))
        const [paySumRows] = await conn.query(
          `SELECT COALESCE(SUM(total_paid), 0) AS total_paid FROM payments WHERE bill_id = ? AND user_id = ? AND deleted_at IS NULL AND is_refund = false`,
          [resolvedBill.id, req.user.id]
        );
        const paidSoFar = parseFloat(paySumRows[0]?.total_paid || 0);
        const actualRemaining = parseFloat(Math.max(parseFloat(resolvedBill.total) - paidSoFar, 0).toFixed(2));
        if (actualRemaining > 0) {
          resolvedBill.balance = actualRemaining;
          resolvedBill.amount_paid = paidSoFar;
          billsToProcess = [resolvedBill, ...others];
        } else {
          billsToProcess = others;
        }
      }
    }

    let remainingCash = cashAmt;
    let remainingUpi = upiAmt;
    let remainingAdvance = (cashAmt === 0 && upiAmt === 0 && totalPaid > 0) ? totalPaid : 0;
    const paymentRecords = [];

    for (const bill of billsToProcess) {
      let outstanding = parseFloat(bill.balance);
      if (outstanding <= 0) {
        const [paySumRows] = await conn.query(
          `SELECT COALESCE(SUM(total_paid), 0) AS total_paid FROM payments WHERE bill_id = ? AND user_id = ? AND deleted_at IS NULL AND is_refund = false`,
          [bill.id, req.user.id]
        );
        const paidSoFar = parseFloat(paySumRows[0]?.total_paid || 0);
        outstanding = parseFloat(Math.max(parseFloat(bill.total) - paidSoFar, 0).toFixed(2));
      }
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

      let applyTotal = parseFloat((applyCash + applyUpi).toFixed(2));
      if (applyTotal <= 0 && remainingAdvance > 0) {
        const applyAdv = Math.min(remainingAdvance, outstanding);
        remainingAdvance = parseFloat((remainingAdvance - applyAdv).toFixed(2));
        applyTotal = applyAdv;
      }
      if (applyTotal <= 0) continue;

      const [existingPayRows] = await conn.query(
        `SELECT COALESCE(SUM(total_paid), 0) AS total_paid FROM payments WHERE bill_id = ? AND user_id = ? AND deleted_at IS NULL AND is_refund = false`,
        [bill.id, req.user.id]
      );
      const prevPaid = parseFloat(existingPayRows[0]?.total_paid || 0);
      const newAmountPaid = parseFloat((prevPaid + applyTotal).toFixed(2));
      const newBalance = parseFloat(Math.max(parseFloat(bill.total) - newAmountPaid, 0).toFixed(2));
      const newStatus = newAmountPaid >= parseFloat(bill.total) ? 'paid' : 'partial';
      const paymentType = newStatus === 'paid' ? 'full' : 'partial';

      // Generate sequence number for standard payment (PAY-0001)
      const paySeq = await getNextSequence(conn, req.user.id, 'payment');

      // Insert payment record for this bill
      const [payResult] = await conn.query(
        `INSERT INTO payments (user_id, bill_id, customer_id, payment_number, cash_amount, upi_amount, total_paid, payment_type, notes, session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, bill.id, resolvedCustomerId, paySeq, applyCash, applyUpi, applyTotal, paymentType, notes || 'FIFO payment', activeSessionId]
      );

      // Auto-create UPI transaction if upi_amount > 0
      if (applyUpi > 0) {
        await conn.query(
          `INSERT INTO upi_transactions (user_id, payment_id, bill_id, customer_id, upi_ref, amount, status, date)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
          [req.user.id, payResult.insertId, bill.id, resolvedCustomerId, req.body.upi_ref || '', applyUpi]
        );
      }

      // If this was an advance deduction, atomically decrement customer advance_balance and credit_balance
      if (applyCash === 0 && applyUpi === 0 && applyTotal > 0) {
        await conn.query(
          `UPDATE customers SET
             credit_balance = GREATEST(0, COALESCE(credit_balance, 0) - ?),
             advance_balance = GREATEST(0, COALESCE(advance_balance, 0) - ?)
           WHERE id = ? AND user_id = ?`,
          [applyTotal, resolvedCustomerId, req.user.id]
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

      paymentRecords.push({ paymentId: payResult.insertId, paymentNumber: paySeq, billId: bill.id, applied: applyTotal, newBalance, newStatus });

      if (remainingCash <= 0 && remainingUpi <= 0 && remainingAdvance <= 0) break;
    }

    // ── Handle excess (overpayment) ───────────────────────────────────────────
    const excess = parseFloat((remainingCash + remainingUpi).toFixed(2));
    if (excess > 0) {
      await conn.query(
        `UPDATE customers SET
           credit_balance = COALESCE(credit_balance, 0) + ?,
           advance_balance = COALESCE(advance_balance, 0) + ?
         WHERE id = ? AND user_id = ?`,
        [excess, excess, resolvedCustomerId, req.user.id]
      );

      const targetBillId = resolvedBill ? resolvedBill.id : null;
      const advSeq = await getNextSequence(conn, req.user.id, 'advance');
      const payMode = remainingUpi > 0 ? (remainingCash > 0 ? 'split' : 'upi') : 'cash';
      await conn.query(
        `INSERT INTO advance_payments (user_id, customer_id, amount, payment_mode, type, bill_id, notes, advance_number, date)
         VALUES (?, ?, ?, ?, 'deposit', ?, ?, ?, NOW())`,
        [req.user.id, resolvedCustomerId, excess, payMode, targetBillId, 'Excess payment credited to advance', advSeq]
      );

      if (remainingUpi > 0) {
        await conn.query(
          `INSERT INTO upi_transactions (user_id, bill_id, customer_id, upi_ref, amount, status, date)
           VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
          [req.user.id, targetBillId, resolvedCustomerId, req.body.upi_ref || '', remainingUpi]
        );
      }
      paymentRecords.push({ billId: targetBillId, applied: excess, excess, isAdvance: true });

      logger.info(`FIFO: Excess credit added to customer balance`, { customerId: resolvedCustomerId, excess: excess.toFixed(2) });
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
        'SELECT * FROM bills WHERE (id::text = ? OR bill_number = ? OR invoice_number = ?) AND user_id = ? AND deleted_at IS NULL',
        [bill_id, bill_id, bill_id, req.user.id]
      );
      if (billRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }
      bill = billRows[0];
      if (!customerId) {
        customerId = bill.customer_id;
      }

      const originalPaid = parseFloat(bill.amount_paid) || 0;
      if (totalRefund > originalPaid) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          error: `Refund amount (₹${totalRefund.toFixed(2)}) cannot exceed total amount paid on the bill (₹${originalPaid.toFixed(2)})`
        });
      }

      // 48-Hour Refund policy enforcement
      const billCreatedTime = new Date(bill.created_at || bill.date).getTime();
      const diffHours = (Date.now() - billCreatedTime) / (1000 * 60 * 60);
      if (diffHours > 48) {
        const { pin_override, security_pin } = req.body;
        let authorized = false;
        if (pin_override) {
          const [settingsRows] = await conn.query(
            'SELECT settings FROM user_settings WHERE user_id = ? LIMIT 1',
            [req.user.id]
          );
          const userSettings = (settingsRows[0] && settingsRows[0].settings) || {};
          const expectedPin = String(userSettings.securityPin || '0000').trim();
          if (security_pin && String(security_pin).trim() === expectedPin) {
            authorized = true;
          }
        }
        if (!authorized) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            error: 'Refund window expired (>48 hrs). Master Security PIN override is required to authorize this refund.'
          });
        }
      }
    }

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'customer_id is required' });
    }

    // Verify customer
    const [custRows] = await conn.query(
      'SELECT * FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [customerId, customerId, req.user.id]
    );
    if (custRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    const resolvedCustomerId = custRows[0].id;

    // Insert refund payment row (negative amounts, is_refund = true, payment_type = 'refund')
    let payResult = null;
    if (totalRefund > 0) {
      const isCash = refund_method === 'cash' || (cashRefund > 0 && upiRefund === 0);
      const finalCash = isCash ? -totalRefund : -cashRefund;
      const finalUpi = isCash ? 0 : (upiRefund > 0 ? -upiRefund : -totalRefund);
      const refSeq = await getNextSequence(conn, req.user.id, 'refund');

      const [resInsert] = await conn.query(
        `INSERT INTO payments (user_id, bill_id, customer_id, payment_number, cash_amount, upi_amount, total_paid, payment_type, is_refund, notes, date, session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'refund', true, ?, NOW(), ?)`,
        [
          req.user.id,
          bill ? bill.id : null,
          resolvedCustomerId,
          refSeq,
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
        [advAmt, resolvedCustomerId, req.user.id]
      );
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      data: {
        payment_id: payResult?.insertId,
        refund_amount: totalRefund,
        customer_id: resolvedCustomerId,
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
        'SELECT * FROM bills WHERE (id::text = ? OR bill_number = ? OR invoice_number = ?) AND user_id = ? AND deleted_at IS NULL',
        [payment.bill_id, payment.bill_id, payment.bill_id, req.user.id]
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
       LEFT JOIN bills b ON (p.bill_id::text = b.id::text OR p.bill_id = b.bill_number OR p.bill_id = b.invoice_number) AND p.user_id = b.user_id
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
      LEFT JOIN bills b ON (p.bill_id::text = b.id::text OR p.bill_id = b.bill_number OR p.bill_id = b.invoice_number) AND p.user_id = b.user_id
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
    res.json({ success: true, data: rows.map(toPaymentDto) });
  } catch (err) {
    next(err);
  }
}

// GET /customer/:customerId - Get all payments by customer
async function getPaymentsByCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { customerId } = req.params;

    const [customer] = await pool.query(
      'SELECT id FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [customerId, customerId, req.user.id]
    );
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const resolvedCustomerId = customer[0].id;
    const [payments] = await pool.query(
      `SELECT p.*, b.total AS bill_total, b.status AS bill_status
       FROM payments p
       LEFT JOIN bills b ON (p.bill_id::text = b.id::text OR p.bill_id = b.bill_number OR p.bill_id = b.invoice_number) AND p.user_id = b.user_id
       WHERE p.customer_id = ? AND p.user_id = ? AND p.deleted_at IS NULL
       ORDER BY p.date DESC`,
      [resolvedCustomerId, req.user.id]
    );

    res.json({ success: true, data: payments.map(toPaymentDto) });
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
    res.json({ success: true, data: payments.map(toPaymentDto) });
  } catch (err) {
    next(err);
  }
}

// POST /:id/reverse - Full or partial reversal of a recorded payment with audit trail
async function reversePayment(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { amount, reason, authorized_by } = req.body;

    if (!reason || !String(reason).trim()) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'A reason for payment reversal is mandatory' });
    }

    const [payRows] = await conn.query(
      'SELECT * FROM payments WHERE (id::text = ? OR payment_number = ?) AND user_id = ? AND deleted_at IS NULL',
      [id, id, req.user.id]
    );

    if (payRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Payment record not found or already deleted' });
    }

    const payment = payRows[0];
    const originalPaid = Math.abs(parseFloat(payment.total_paid) || 0);
    const alreadyReversed = parseFloat(payment.reversed_amount) || 0;
    const remainingReversible = parseFloat(Math.max(0, originalPaid - alreadyReversed).toFixed(2));

    if (remainingReversible <= 0 || payment.status === 'reversed') {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'This payment has already been fully reversed' });
    }

    let reverseAmount = amount !== undefined && amount !== null && amount !== '' ? parseFloat(amount) : remainingReversible;
    reverseAmount = parseFloat(reverseAmount.toFixed(2));

    if (isNaN(reverseAmount) || reverseAmount <= 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Reversal amount must be greater than zero' });
    }

    if (reverseAmount > remainingReversible) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        error: `Cannot reverse ₹${reverseAmount.toFixed(2)}. Remaining reversible amount is ₹${remainingReversible.toFixed(2)}`
      });
    }

    // Proportionally apportion reversal between cash and upi
    const originalCash = parseFloat(payment.cash_amount) || 0;
    const originalUpi = parseFloat(payment.upi_amount) || 0;
    let revCash = 0;
    let revUpi = 0;

    if (originalPaid > 0) {
      if (originalCash > 0 && originalUpi <= 0) {
        revCash = reverseAmount;
        revUpi = 0;
      } else if (originalUpi > 0 && originalCash <= 0) {
        revCash = 0;
        revUpi = reverseAmount;
      } else {
        revCash = parseFloat((reverseAmount * (originalCash / originalPaid)).toFixed(2));
        revUpi = parseFloat((reverseAmount - revCash).toFixed(2));
      }
    }

    const newReversedTotal = parseFloat((alreadyReversed + reverseAmount).toFixed(2));
    const isFullyReversed = newReversedTotal >= originalPaid;
    const newStatus = isFullyReversed ? 'reversed' : 'partially_reversed';

    // 1. Update original payment
    await conn.query(
      `UPDATE payments 
       SET reversed_amount = ?, status = ?, is_reversed = ? 
       WHERE id = ? AND user_id = ?`,
      [newReversedTotal, newStatus, isFullyReversed, payment.id, req.user.id]
    );

    // 2. Generate sequence number for reversal transaction (REV-0001)
    let revPaymentNumber = '';
    try {
      revPaymentNumber = await getNextSequence(conn, req.user.id, 'payment_reversal');
    } catch {
      revPaymentNumber = `REV-${Date.now().toString().slice(-4)}`;
    }

    // 3. Insert linked reversal transaction
    const [revResult] = await conn.query(
      `INSERT INTO payments (
         user_id, bill_id, customer_id, payment_number, cash_amount, upi_amount, 
         total_paid, payment_type, is_refund, notes, date, session_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'reversal', false, ?, NOW(), ?)`,
      [
        req.user.id,
        payment.bill_id || null,
        payment.customer_id,
        revPaymentNumber,
        -revCash,
        -revUpi,
        -reverseAmount,
        `Reversal of payment #${payment.payment_number || payment.id}: ${reason}`,
        payment.session_id || null
      ]
    );

    // 4. Update bill amount_paid & balance if attached to a bill
    let updatedBill = null;
    if (payment.bill_id) {
      const [billRows] = await conn.query(
        'SELECT * FROM bills WHERE (id::text = ? OR bill_number = ? OR invoice_number = ?) AND user_id = ? AND deleted_at IS NULL',
        [payment.bill_id, payment.bill_id, payment.bill_id, req.user.id]
      );

      if (billRows.length > 0) {
        const bill = billRows[0];
        const newAmountPaid = Math.max(0, parseFloat((parseFloat(bill.amount_paid) - reverseAmount).toFixed(2)));
        const newBalance = Math.min(parseFloat(bill.total), parseFloat((parseFloat(bill.total) - newAmountPaid).toFixed(2)));
        const billStatus = newAmountPaid >= parseFloat(bill.total) ? 'paid' : (newAmountPaid > 0 ? 'partial' : 'unpaid');

        await conn.query(
          'UPDATE bills SET amount_paid = ?, balance = ?, status = ? WHERE id = ? AND user_id = ?',
          [newAmountPaid, newBalance, billStatus, bill.id, req.user.id]
        );
        updatedBill = { ...bill, amount_paid: newAmountPaid, balance: newBalance, status: billStatus };
      }
    }

    // 5. Reverse excess credit on customer if original payment created customer credit
    if (payment.customer_id && payment.excess_credit && parseFloat(payment.excess_credit) > 0) {
      const excessDeduct = Math.min(reverseAmount, parseFloat(payment.excess_credit));
      await conn.query(
        'UPDATE customers SET credit_balance = GREATEST(0, credit_balance - ?), advance_balance = GREATEST(0, advance_balance - ?) WHERE id = ? AND user_id = ?',
        [excessDeduct, excessDeduct, payment.customer_id, req.user.id]
      );
    }

    // 6. Record Audit Log
    await conn.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        'REVERSE_PAYMENT',
        'payment',
        String(payment.id),
        JSON.stringify({ originalPaid, alreadyReversed, paymentStatus: payment.status }),
        JSON.stringify({ reverseAmount, newReversedTotal, newStatus, reason, authorized_by: authorized_by || 'Admin' })
      ]
    );

    await conn.commit();
    res.json({
      success: true,
      message: `Payment ${isFullyReversed ? 'fully' : 'partially'} reversed successfully`,
      data: {
        originalPaymentId: payment.id,
        reversalTransactionId: revResult.insertId,
        reversedAmount: reverseAmount,
        remainingReversible: parseFloat(Math.max(0, remainingReversible - reverseAmount).toFixed(2)),
        status: newStatus,
        bill: updatedBill
      }
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

module.exports = {
  getPaymentsForBill,
  recordPayment,
  recordRefund,
  reversePayment,
  deletePayment,
  listDeletedPayments,
  listRefundPayments,
  getPaymentsByCustomer,
  listAllPayments
};
