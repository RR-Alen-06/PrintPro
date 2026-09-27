import { getPool } from '../config/db';
import logger from '../utils/logger';

// Helper to ensure table exists in case migration hasn't been run manually
let tableEnsured = false;
async function ensureTable(connOrPool: any) {
  if (tableEnsured) return;
  try {
    await connOrPool.query(`
      CREATE TABLE IF NOT EXISTS group_settlement_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        group_bill_id UUID NOT NULL,
        payer_bill_id UUID,
        payer_customer_id UUID NOT NULL,
        cash_amount DECIMAL(10,2) DEFAULT 0.00,
        upi_amount DECIMAL(10,2) DEFAULT 0.00,
        total_paid DECIMAL(10,2) NOT NULL,
        excess_credit DECIMAL(10,2) DEFAULT 0.00,
        settlements JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes TEXT DEFAULT '',
        date TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_group_settle_user ON group_settlement_payments (user_id);
      CREATE INDEX IF NOT EXISTS idx_group_settle_group ON group_settlement_payments (group_bill_id);
    `);
    tableEnsured = true;
  } catch (err: any) {
    logger.warn('Could not auto-ensure group_settlement_payments table:', err.message);
  }
}

/**
 * POST /api/payments/group-settle
 * Atomically settles multiple bills across a group in a single DB transaction.
 */
export async function recordGroupSettlement(req: any, res: any, next: any) {
  const pool = getPool();
  await ensureTable(pool);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const {
      group_bill_id,
      payer_customer_id,
      payer_bill_id,
      cash_amount,
      upi_amount,
      notes
    } = req.body;

    const cashAmt = parseFloat(cash_amount) || 0;
    const upiAmt = parseFloat(upi_amount) || 0;
    const totalPaid = parseFloat((cashAmt + upiAmt).toFixed(2));

    if (totalPaid <= 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    // 1. Verify group bill exists and belongs to user
    const [groupRows] = await conn.query(
      'SELECT * FROM group_bills WHERE id = $1 AND user_id = $2',
      [group_bill_id, req.user.id]
    );
    if (!groupRows || groupRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Group bill not found' });
    }
    const groupBill = groupRows[0];

    // 2. Verify payer customer exists
    const [custRows] = await conn.query(
      'SELECT id, name FROM customers WHERE id = $1 AND user_id = $2',
      [payer_customer_id, req.user.id]
    );
    if (!custRows || custRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Payer customer not found' });
    }

    // 3. Retrieve unpaid member bills
    const memberBillIds: string[] = groupBill.member_bill_ids || [];
    if (!memberBillIds || memberBillIds.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'No member bills found for this group' });
    }

    const [unpaidBills] = await conn.query(
      `SELECT b.*, c.name as customer_name
       FROM bills b
       LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.id = ANY($1::uuid[]) AND b.user_id = $2 AND b.deleted_at IS NULL AND b.status != 'paid'
       ORDER BY b.id ASC`,
      [memberBillIds, req.user.id]
    );

    // Order: payer_bill_id first if unpaid, then rest deterministically
    const payerBill = payer_bill_id ? unpaidBills.find((b: any) => String(b.id) === String(payer_bill_id)) : null;
    const otherBills = unpaidBills.filter((b: any) => String(b.id) !== String(payer_bill_id));
    const orderedBills = payerBill ? [payerBill, ...otherBills] : unpaidBills;

    let remTotal = totalPaid;
    let remCash = cashAmt;
    let remUpi = upiAmt;
    const ratio = totalPaid > 0 ? cashAmt / totalPaid : 1;

    const settlements: any[] = [];
    const childPaymentIds: string[] = [];

    // 4. Proportional distribution and dual-write
    for (let i = 0; i < orderedBills.length; i++) {
      const bill = orderedBills[i];
      if (remTotal <= 0.001) break;

      const outstanding = parseFloat(bill.balance);
      if (outstanding <= 0) continue;

      const apply = parseFloat(Math.min(remTotal, outstanding).toFixed(2));
      const isLast = (i === orderedBills.length - 1) || (apply >= remTotal - 0.001);

      let applyCash = 0;
      let applyUpi = 0;
      if (isLast) {
        applyCash = parseFloat(Math.min(remCash, apply).toFixed(2));
        applyUpi = parseFloat(Math.max(0, apply - applyCash).toFixed(2));
      } else {
        applyCash = parseFloat(Math.min(remCash, apply * ratio).toFixed(2));
        applyUpi = parseFloat(Math.max(0, apply - applyCash).toFixed(2));
      }

      remCash = parseFloat(Math.max(0, remCash - applyCash).toFixed(2));
      remUpi = parseFloat(Math.max(0, remUpi - applyUpi).toFixed(2));
      remTotal = parseFloat(Math.max(0, remTotal - apply).toFixed(2));

      const newAmountPaid = parseFloat((parseFloat(bill.amount_paid) + apply).toFixed(2));
      const newBalance = parseFloat(Math.max(parseFloat(bill.total) - newAmountPaid, 0).toFixed(2));
      const newStatus = newAmountPaid >= parseFloat(bill.total) ? 'paid' : 'partial';
      const paymentType = newStatus === 'paid' ? 'full' : 'partial';

      // Insert child payment record in payments table (so customer statements & accounting work immediately)
      const [payResult] = await conn.query(
        `INSERT INTO payments (user_id, bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          req.user.id,
          bill.id,
          bill.customer_id,
          applyCash,
          applyUpi,
          apply,
          paymentType,
          `Group settlement for group ${group_bill_id}`
        ]
      );
      const childPayId = payResult.id || (payResult[0] && payResult[0].id);
      childPaymentIds.push(childPayId);

      // Update the bill balance and status
      await conn.query(
        'UPDATE bills SET amount_paid = $1, balance = $2, status = $3 WHERE id = $4 AND user_id = $5',
        [newAmountPaid, newBalance, newStatus, bill.id, req.user.id]
      );

      settlements.push({
        bill_id: bill.id,
        customer_id: bill.customer_id,
        customer_name: bill.customer_name || 'Member',
        apply,
        apply_cash: applyCash,
        apply_upi: applyUpi,
        child_payment_id: childPayId
      });
    }

    // 5. Handle overpayment: excess credit to payer's account
    const excess = parseFloat((remCash + remUpi).toFixed(2));
    if (excess > 0) {
      await conn.query(
        'UPDATE customers SET credit_balance = credit_balance + $1 WHERE id = $2 AND user_id = $3',
        [excess, payer_customer_id, req.user.id]
      );
      logger.info('Group settlement excess credited to payer', { customerId: payer_customer_id, excess });
    }

    // 6. Insert master audit record into group_settlement_payments
    const [masterResult] = await conn.query(
      `INSERT INTO group_settlement_payments
       (user_id, group_bill_id, payer_bill_id, payer_customer_id, cash_amount, upi_amount, total_paid, excess_credit, settlements, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.id,
        group_bill_id,
        payer_bill_id || null,
        payer_customer_id,
        cashAmt,
        upiAmt,
        totalPaid,
        excess,
        JSON.stringify(settlements),
        notes || `Group settlement for group ${group_bill_id}`
      ]
    );

    const createdRecord = masterResult && masterResult.length > 0 ? masterResult[0] : masterResult;

    // 7. Audit log entry
    await conn.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.id,
        'GROUP_SETTLEMENT',
        'group_settlement',
        String(createdRecord.id),
        JSON.stringify({ group_bill_id, total_paid: totalPaid }),
        JSON.stringify({ settled_bills: settlements.length, excess_credit: excess })
      ]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      data: createdRecord
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/**
 * GET /api/payments/group-settlements
 * List all group settlements for the user, optionally filtered by group_bill_id.
 */
export async function getGroupSettlements(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    await ensureTable(pool);
    const { group_bill_id } = req.query;

    let query = `
      SELECT gsp.*, c.name as payer_name
      FROM group_settlement_payments gsp
      LEFT JOIN customers c ON gsp.payer_customer_id = c.id AND gsp.user_id = c.user_id
      WHERE gsp.user_id = $1
    `;
    const params: any[] = [req.user.id];

    if (group_bill_id) {
      query += ` AND gsp.group_bill_id = $2`;
      params.push(group_bill_id);
    }

    query += ` ORDER BY gsp.date DESC, gsp.created_at DESC`;

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/group-settle/:id
 * Retrieve a single group settlement record by ID.
 */
export async function getGroupSettlementById(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    await ensureTable(pool);
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT gsp.*, c.name as payer_name
       FROM group_settlement_payments gsp
       LEFT JOIN customers c ON gsp.payer_customer_id = c.id AND gsp.user_id = c.user_id
       WHERE gsp.id = $1 AND gsp.user_id = $2`,
      [id, req.user.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Group settlement not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/payments/group-settle/:id
 * Atomically reverses a group settlement.
 */
export async function reverseGroupSettlement(req: any, res: any, next: any) {
  const pool = getPool();
  await ensureTable(pool);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const { id } = req.params;

    const [existing] = await conn.query(
      'SELECT * FROM group_settlement_payments WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (!existing || existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Group settlement not found' });
    }

    const record = existing[0];
    const settlements: any[] = typeof record.settlements === 'string' ? JSON.parse(record.settlements) : (record.settlements || []);

    // 1. Reverse each member bill
    for (const s of settlements) {
      if (!s.bill_id || !s.apply) continue;

      const [billRows] = await conn.query(
        'SELECT * FROM bills WHERE id = $1 AND user_id = $2',
        [s.bill_id, req.user.id]
      );
      if (billRows && billRows.length > 0) {
        const bill = billRows[0];
        const newAmountPaid = parseFloat(Math.max(0, parseFloat(bill.amount_paid) - s.apply).toFixed(2));
        const newBalance = parseFloat(Math.min(parseFloat(bill.total), parseFloat(bill.total) - newAmountPaid).toFixed(2));
        const newStatus = newAmountPaid <= 0 ? 'unpaid' : 'partial';

        await conn.query(
          'UPDATE bills SET amount_paid = $1, balance = $2, status = $3 WHERE id = $4 AND user_id = $5',
          [newAmountPaid, newBalance, newStatus, bill.id, req.user.id]
        );
      }

      // Delete the child payment record
      if (s.child_payment_id) {
        await conn.query(
          'DELETE FROM payments WHERE id = $1 AND user_id = $2',
          [s.child_payment_id, req.user.id]
        );
      }
    }

    // 2. Reverse excess credit from payer if applicable
    const excess = parseFloat(record.excess_credit) || 0;
    if (excess > 0 && record.payer_customer_id) {
      await conn.query(
        'UPDATE customers SET credit_balance = GREATEST(0, credit_balance - $1) WHERE id = $2 AND user_id = $3',
        [excess, record.payer_customer_id, req.user.id]
      );
    }

    // 3. Delete master record
    await conn.query(
      'DELETE FROM group_settlement_payments WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    // 4. Audit log
    await conn.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'REVERSE_GROUP_SETTLEMENT', 'group_settlement', String(id), JSON.stringify(record)]
    );

    await conn.commit();
    res.json({ success: true, message: 'Group settlement reversed successfully' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}
