const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');

// GET /api/advance-payments
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const { customer_id } = req.query;
    let sql = 'SELECT * FROM advance_payments WHERE user_id = ?';
    const params = [req.user.id];

    if (customer_id) {
      sql += ' AND (customer_id::text = ? OR customer_id IN (SELECT id FROM customers WHERE customer_code = ? AND user_id = ?))';
      params.push(customer_id, customer_id, req.user.id);
    }

    sql += ' ORDER BY date DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/advance-payments
router.post('/', async (req, res, next) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_id, amount, payment_mode, type = 'deposit', bill_id, notes, date } = req.body;

    if (!customer_id || amount === undefined) {
      return res.status(400).json({ success: false, error: 'Customer ID and amount are required' });
    }

    // Resolve customer to UUID
    const [custRows] = await conn.query(
      'SELECT id FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [customer_id, customer_id, req.user.id]
    );
    if (custRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    const resolvedCustomerId = custRows[0].id;

    // Resolve bill to UUID if provided
    let resolvedBillId = null;
    if (bill_id) {
      const [bRows] = await conn.query(
        'SELECT id FROM bills WHERE (id::text = ? OR bill_number = ? OR invoice_number = ?) AND user_id = ?',
        [bill_id, bill_id, bill_id, req.user.id]
      );
      if (bRows.length > 0) {
        resolvedBillId = bRows[0].id;
      }
    }

    const numAmount = parseFloat(amount) || 0;
    let balanceDelta = numAmount;
    if ((type === 'refund' || type === 'return' || type === 'applied') && numAmount > 0) {
      balanceDelta = -numAmount;
    }

    let advanceNumber = req.body.advance_number || req.body.id;
    if (!advanceNumber) {
      const [maxRows] = await conn.query(
        `SELECT advance_number FROM advance_payments WHERE user_id = ? AND advance_number IS NOT NULL ORDER BY CAST(NULLIF(regexp_replace(advance_number, '[^0-9]', '', 'g'), '') AS INTEGER) DESC LIMIT 1`,
        [req.user.id]
      );
      let nextNum = 1;
      if (maxRows.length > 0 && maxRows[0]?.advance_number) {
        const numPart = String(maxRows[0].advance_number).replace(/[^0-9]/g, '');
        nextNum = parseInt(numPart || '0', 10) + 1;
      }
      advanceNumber = `ADV-${String(nextNum).padStart(4, '0')}`;
    }

    const [insertResult] = await conn.query(
      `INSERT INTO advance_payments (user_id, customer_id, amount, payment_mode, type, bill_id, notes, date, advance_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        req.user.id,
        resolvedCustomerId,
        numAmount,
        payment_mode || 'cash',
        type,
        resolvedBillId,
        notes || '',
        date || new Date().toISOString(),
        advanceNumber
      ]
    );

    const newAdvanceId = insertResult.insertId || insertResult[0]?.id;

    // Update customer credit_balance and advance_balance atomically
    await conn.query(
      `UPDATE customers SET
         credit_balance = COALESCE(credit_balance, 0) + ?,
         advance_balance = COALESCE(advance_balance, 0) + ?
       WHERE id = ? AND user_id = ?`,
      [balanceDelta, balanceDelta, resolvedCustomerId, req.user.id]
    );

    await conn.commit();

    const [created] = await pool.query('SELECT * FROM advance_payments WHERE id = ? AND user_id = ?', [newAdvanceId, req.user.id]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// PUT /api/advance-payments/:id
router.put('/:id', async (req, res, next) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { amount, payment_mode, type, bill_id, notes, date } = req.body;

    const [existing] = await conn.query(
      'SELECT * FROM advance_payments WHERE (id::text = ? OR advance_number = ?) AND user_id = ?',
      [id, id, req.user.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Advance payment record not found' });
    }

    const oldRecord = existing[0];
    const actualAdvanceId = oldRecord.id;
    const oldAmount = parseFloat(oldRecord.amount) || 0;
    const oldType = oldRecord.type || 'deposit';
    let oldDelta = oldAmount;
    if ((oldType === 'refund' || oldType === 'return' || oldType === 'applied') && oldAmount > 0) {
      oldDelta = -oldAmount;
    }

    const newAmount = amount !== undefined ? parseFloat(amount) : oldAmount;
    const newType = type || oldType;
    let newDelta = newAmount;
    if ((newType === 'refund' || newType === 'return' || newType === 'applied') && newAmount > 0) {
      newDelta = -newAmount;
    }

    const netAdjustment = newDelta - oldDelta;

    let resolvedBillId = oldRecord.bill_id;
    if (bill_id !== undefined) {
      if (bill_id) {
        const [bRows] = await conn.query(
          'SELECT id FROM bills WHERE (id::text = ? OR bill_number = ? OR invoice_number = ?) AND user_id = ?',
          [bill_id, bill_id, bill_id, req.user.id]
        );
        resolvedBillId = bRows.length > 0 ? bRows[0].id : null;
      } else {
        resolvedBillId = null;
      }
    }

    await conn.query(
      `UPDATE advance_payments SET
         amount = COALESCE(?, amount),
         payment_mode = COALESCE(?, payment_mode),
         type = COALESCE(?, type),
         bill_id = ?,
         notes = COALESCE(?, notes),
         date = COALESCE(?, date)
       WHERE id = ? AND user_id = ?`,
      [newAmount, payment_mode, newType, resolvedBillId, notes, date, actualAdvanceId, req.user.id]
    );

    if (netAdjustment !== 0) {
      await conn.query(
        `UPDATE customers SET
           credit_balance = COALESCE(credit_balance, 0) + ?,
           advance_balance = COALESCE(advance_balance, 0) + ?
         WHERE id = ? AND user_id = ?`,
        [netAdjustment, netAdjustment, oldRecord.customer_id, req.user.id]
      );
    }

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM advance_payments WHERE id = ? AND user_id = ?', [actualAdvanceId, req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// DELETE /api/advance-payments/:id
router.delete('/:id', async (req, res, next) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;

    const [existing] = await conn.query(
      'SELECT * FROM advance_payments WHERE (id::text = ? OR advance_number = ?) AND user_id = ?',
      [id, id, req.user.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Advance payment record not found' });
    }

    const record = existing[0];
    const actualAdvanceId = record.id;
    const recAmount = parseFloat(record.amount) || 0;
    const recType = record.type || 'deposit';
    let deltaToReverse = recAmount;
    if ((recType === 'refund' || recType === 'return' || recType === 'applied') && recAmount > 0) {
      deltaToReverse = -recAmount;
    }

    await conn.query('DELETE FROM advance_payments WHERE id = ? AND user_id = ?', [actualAdvanceId, req.user.id]);

    // Reverse the balance impact on customer
    await conn.query(
      `UPDATE customers SET
         credit_balance = COALESCE(credit_balance, 0) - ?,
         advance_balance = COALESCE(advance_balance, 0) - ?
       WHERE id = ? AND user_id = ?`,
      [deltaToReverse, deltaToReverse, record.customer_id, req.user.id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Advance payment deleted successfully' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
