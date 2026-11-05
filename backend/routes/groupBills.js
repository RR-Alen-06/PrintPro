const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');
const { getNextSequence } = require('../utils/sequenceGenerator');
const { allowlist } = require('../middleware/allowlist');
const { validateSchema } = require('../middleware/schemaValidator');
const schemas = require('../config/schemas');

// Group Bill projection DTO: strips internal auth tenant ID (user_id)
function toGroupBillDto(gb) {
  if (!gb) return null;
  let shares = gb.member_shares || [];
  if (typeof shares === 'string') {
    try { shares = JSON.parse(shares); } catch (_e) { shares = []; }
  }
  return {
    id: gb.id,
    group_id: gb.group_id,
    title: gb.title || '',
    date: gb.date,
    total_amount: parseFloat(gb.total_amount) || 0,
    amount_paid: parseFloat(gb.amount_paid) || 0,
    status: gb.status || 'unpaid',
    member_shares: shares,
    notes: gb.notes || ''
  };
}

// GET /api/group-bills
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM group_bills WHERE user_id = ? ORDER BY date DESC', [req.user.id]);
    res.json({ success: true, data: rows.map(toGroupBillDto) });
  } catch (err) {
    next(err);
  }
});

// POST /api/group-bills
router.post('/', allowlist(['id', 'group_id', 'groupId', 'title', 'date', 'total_amount', 'totalAmount', 'amount_paid', 'amountPaid', 'status', 'member_shares', 'memberShares', 'notes']), validateSchema(schemas.groupBillCreate), async (req, res, next) => {
  try {
    const pool = getPool();
    const { group_id, title, date, total_amount, member_shares, notes } = req.body;

    let billId = req.body.id;
    if (!billId) {
      billId = await getNextSequence(pool, req.user.id, 'split_purchase');
    }
    const effectiveGroupId = group_id || 'GENERAL';

    // Verify or ensure group exists to satisfy foreign key constraint
    if (group_id) {
      const [grpRows] = await pool.query('SELECT id FROM customer_groups WHERE id = ? AND user_id = ?', [group_id, req.user.id]);
      if (grpRows.length === 0) {
        await pool.query(
          'INSERT INTO customer_groups (id, user_id, name, description) VALUES (?, ?, ?, ?) ON CONFLICT (id, user_id) DO NOTHING',
          [group_id, req.user.id, title || `Group ${group_id}`, 'Auto-created group for group billing']
        );
      }
    } else {
      await pool.query(
        'INSERT INTO customer_groups (id, user_id, name, description) VALUES (?, ?, ?, ?) ON CONFLICT (id, user_id) DO NOTHING',
        ['GENERAL', req.user.id, 'General Group', 'Default container for ad-hoc group bills']
      );
    }

    await pool.query(
      `INSERT INTO group_bills (id, user_id, group_id, title, date, total_amount, amount_paid, status, member_shares, notes)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, ?)
       ON CONFLICT (id, user_id) DO UPDATE SET
         title = EXCLUDED.title,
         total_amount = EXCLUDED.total_amount,
         member_shares = EXCLUDED.member_shares,
         notes = EXCLUDED.notes,
         updated_at = NOW()`,
      [
        billId,
        req.user.id,
        effectiveGroupId,
        title || '',
        date || new Date().toISOString().slice(0, 10),
        parseFloat(total_amount) || 0,
        JSON.stringify(member_shares || []),
        notes || ''
      ]
    );

    const [created] = await pool.query('SELECT * FROM group_bills WHERE id = ? AND user_id = ?', [billId, req.user.id]);
    res.status(201).json({ success: true, data: toGroupBillDto(created[0]) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/group-bills/:id
router.put('/:id', allowlist(['title', 'date', 'total_amount', 'totalAmount', 'amount_paid', 'amountPaid', 'status', 'member_shares', 'memberShares', 'notes', 'id']), validateSchema(schemas.groupBillUpdate), async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, date, notes, status } = req.body;
    const total_amount = req.body.total_amount !== undefined ? req.body.total_amount : req.body.totalAmount;
    const amount_paid = req.body.amount_paid !== undefined ? req.body.amount_paid : req.body.amountPaid;
    const member_shares = req.body.member_shares !== undefined ? req.body.member_shares : req.body.memberShares;

    const [existing] = await pool.query('SELECT * FROM group_bills WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Group bill not found' });
    }

    await pool.query(
      `UPDATE group_bills SET
         title = COALESCE(?, title),
         date = COALESCE(?, date),
         total_amount = COALESCE(?, total_amount),
         amount_paid = COALESCE(?, amount_paid),
         status = COALESCE(?::bill_status, status),
         member_shares = COALESCE(?, member_shares),
         notes = COALESCE(?, notes),
         updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        title,
        date,
        total_amount !== undefined ? parseFloat(total_amount) : null,
        amount_paid !== undefined ? parseFloat(amount_paid) : null,
        status || null,
        member_shares ? JSON.stringify(member_shares) : null,
        notes,
        id,
        req.user.id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM group_bills WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, data: toGroupBillDto(updated[0]) });
  } catch (err) {
    next(err);
  }
});

// POST /api/group-bills/:id/pay-member - Record payment for a specific member in a group bill
router.post('/:id/pay-member', allowlist(['memberId', 'customerId', 'paymentAmount', 'paymentMethod', 'notes', 'upi_ref']), validateSchema(schemas.groupBillPayMember), async (req, res, next) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { memberId, customerId, paymentAmount, paymentMethod = { cash: 0, upi: 0 }, notes } = req.body;

    const [existing] = await conn.query('SELECT * FROM group_bills WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Group bill not found' });
    }

    const bill = existing[0];
    let memberShares = [];
    try {
      memberShares = typeof bill.member_shares === 'string' ? JSON.parse(bill.member_shares || '[]') : (bill.member_shares || []);
    } catch {
      memberShares = [];
    }

    const payAmt = parseFloat(paymentAmount) || 0;
    let targetMember = null;

    memberShares = memberShares.map((m) => {
      if ((memberId && m.id === memberId) || (customerId && (m.customerId === customerId || m.id === customerId))) {
        targetMember = m;
        const currentPaid = parseFloat(m.amountPaid || 0);
        const newPaid = currentPaid + payAmt;
        const memberTotal = parseFloat(m.total || m.shareAmount || 0);
        const newStatus = newPaid >= memberTotal ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
        return { ...m, amountPaid: newPaid, status: newStatus };
      }
      return m;
    });

    const totalBillAmount = parseFloat(bill.total_amount) || 0;
    const newTotalPaid = memberShares.reduce((sum, m) => sum + (parseFloat(m.amountPaid) || 0), 0);
    const newBillStatus = newTotalPaid >= totalBillAmount ? 'paid' : (newTotalPaid > 0 ? 'partial' : 'unpaid');

    await conn.query(
      `UPDATE group_bills SET
         amount_paid = ?,
         status = ?,
         member_shares = ?,
         updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [newTotalPaid, newBillStatus, JSON.stringify(memberShares), id, req.user.id]
    );

    // If member used advance, deduct from customer's credit/advance balance
    const custIdToUse = targetMember?.customerId || customerId;
    if (custIdToUse && targetMember?.useAdvance) {
      await conn.query(
        `UPDATE customers SET
           credit_balance = GREATEST(0, COALESCE(credit_balance, 0) - ?),
           advance_balance = GREATEST(0, COALESCE(advance_balance, 0) - ?)
         WHERE (id::text = ? OR customer_code = ?) AND user_id = ?`,
        [payAmt, payAmt, String(custIdToUse), String(custIdToUse), req.user.id]
      );
    }

    // Insert payment record into payments table for accounting audit
    const cashVal = parseFloat(paymentMethod.cash) || (paymentMethod === 'cash' ? payAmt : (payAmt > 0 && !paymentMethod.upi ? payAmt : 0));
    const upiVal = parseFloat(paymentMethod.upi) || (paymentMethod === 'upi' ? payAmt : 0);

    const [payRes] = await conn.query(
      `INSERT INTO payments (user_id, bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes, is_refund, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, NOW())`,
      [
        req.user.id,
        id,
        custIdToUse ? String(custIdToUse) : null,
        cashVal,
        upiVal,
        payAmt,
        newBillStatus === 'paid' ? 'full' : 'partial',
        notes || `Payment for group bill ${id} member ${memberId || custIdToUse || ''}`
      ]
    );

    if (upiVal > 0) {
      await conn.query(
        `INSERT INTO upi_transactions (user_id, payment_id, bill_id, customer_id, upi_ref, amount, status, date)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [req.user.id, payRes.insertId, id, custIdToUse ? String(custIdToUse) : null, req.body.upi_ref || '', upiVal]
      );
    }

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM group_bills WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, data: toGroupBillDto(updated[0]) });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// POST /api/group-bills/:id/cancel - Cancel a group bill and mark child bills/status cancelled
router.post('/:id/cancel', allowlist(['reason']), async (req, res, next) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { reason = 'Cancelled by user' } = req.body;

    const [existing] = await conn.query('SELECT * FROM group_bills WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Group bill not found' });
    }

    const bill = existing[0];
    const notesAppend = bill.notes ? `${bill.notes} | Cancelled: ${reason}` : `Cancelled: ${reason}`;

    await conn.query(
      `UPDATE group_bills SET
         status = 'cancelled'::bill_status,
         notes = ?,
         updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [notesAppend, id, req.user.id]
    );

    await conn.commit();
    const [updated] = await pool.query('SELECT * FROM group_bills WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, data: toGroupBillDto(updated[0]) });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
