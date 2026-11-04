/**
 * Historical Data Backfill & Sequence Synchronization Migration Script
 *
 * Idempotently scans and assigns clean sequential numbers to historical records:
 * - Customers: RC-0001 (Regular), WI-0001 (Walk-in)
 * - Bills: BILL-0001
 * - Payments: PAY-0001 (Standard), REV-0001 (Reversal), REF-0001 (Refund)
 * - Advances: ADV-0001
 * - Purchases / Expenses: EXP-0001
 * - Cash Sessions: SESS-0001
 * - Synchronizes the 'sequences' table last_seq to the true maximum for every tenant.
 */

const { getPool } = require('../config/db');
const logger = require('../utils/logger');

async function migrateUserSequences(pool, userId) {
  logger.info(`Starting sequence migration for user ${userId}...`);

  // Helper to extract integer from code
  const extractNum = (str, prefix) => {
    if (!str || typeof str !== 'string') return 0;
    const cleanPrefix = String(prefix).toUpperCase();
    if (!str.toUpperCase().startsWith(`${cleanPrefix}-`)) return 0;
    const numPart = str.slice(cleanPrefix.length + 1).replace(/[^0-9]/g, '');
    return parseInt(numPart || '0', 10);
  };

  // 1. Regular Customers (RC-0001)
  const [regCusts] = await pool.query(
    `SELECT id, customer_code, created_at FROM customers WHERE user_id = ? AND type = 'regular' ORDER BY created_at ASC, id ASC`,
    [userId]
  );
  let maxRc = 0;
  regCusts.forEach(c => {
    const n = extractNum(c.customer_code, 'RC');
    if (n > maxRc) maxRc = n;
  });
  for (const c of regCusts) {
    if (!c.customer_code || !/^RC-\d{4,}$/i.test(c.customer_code)) {
      maxRc++;
      const newCode = `RC-${String(maxRc).padStart(4, '0')}`;
      await pool.query(`UPDATE customers SET customer_code = ? WHERE id = ? AND user_id = ?`, [newCode, c.id, userId]);
      logger.info(`Updated regular customer ${c.id} -> ${newCode}`);
    }
  }

  // 2. Walk-in Customers (WI-0001)
  const [wiCusts] = await pool.query(
    `SELECT id, customer_code, created_at FROM customers WHERE user_id = ? AND type != 'regular' ORDER BY created_at ASC, id ASC`,
    [userId]
  );
  let maxWi = 0;
  wiCusts.forEach(c => {
    const n = extractNum(c.customer_code, 'WI');
    if (n > maxWi) maxWi = n;
  });
  for (const c of wiCusts) {
    if (!c.customer_code || !/^WI-\d{4,}$/i.test(c.customer_code)) {
      maxWi++;
      const newCode = `WI-${String(maxWi).padStart(4, '0')}`;
      await pool.query(`UPDATE customers SET customer_code = ? WHERE id = ? AND user_id = ?`, [newCode, c.id, userId]);
      logger.info(`Updated walk-in customer ${c.id} -> ${newCode}`);
    }
  }

  // 3. Bills (BILL-0001)
  const [bills] = await pool.query(
    `SELECT id, bill_number, invoice_number, created_at FROM bills WHERE user_id = ? ORDER BY created_at ASC, id ASC`,
    [userId]
  );
  let maxBill = 0;
  bills.forEach(b => {
    const n = extractNum(b.bill_number, 'BILL');
    if (n > maxBill) maxBill = n;
  });
  for (const b of bills) {
    if (!b.bill_number || !/^BILL-\d{4,}$/i.test(b.bill_number)) {
      maxBill++;
      const newNumber = `BILL-${String(maxBill).padStart(4, '0')}`;
      await pool.query(
        `UPDATE bills SET bill_number = ?, invoice_number = COALESCE(invoice_number, ?) WHERE id = ? AND user_id = ?`,
        [newNumber, newNumber, b.id, userId]
      );
      logger.info(`Updated bill ${b.id} -> ${newNumber}`);
    }
  }

  // 4. Payments: Standard (PAY-0001)
  const [stdPayments] = await pool.query(
    `SELECT id, payment_number, date FROM payments 
     WHERE user_id = ? AND (is_refund = false OR is_refund IS NULL) AND (payment_type IS NULL OR payment_type NOT IN ('reversal', 'refund'))
     ORDER BY date ASC, id ASC`,
    [userId]
  );
  let maxPay = 0;
  stdPayments.forEach(p => {
    const n = extractNum(p.payment_number, 'PAY');
    if (n > maxPay) maxPay = n;
  });
  for (const p of stdPayments) {
    if (!p.payment_number || !/^PAY-\d{4,}$/i.test(p.payment_number)) {
      maxPay++;
      const newNumber = `PAY-${String(maxPay).padStart(4, '0')}`;
      await pool.query(`UPDATE payments SET payment_number = ? WHERE id = ? AND user_id = ?`, [newNumber, p.id, userId]);
      logger.info(`Updated payment ${p.id} -> ${newNumber}`);
    }
  }

  // 5. Payment Reversals (REV-0001)
  const [revPayments] = await pool.query(
    `SELECT id, payment_number, date FROM payments 
     WHERE user_id = ? AND payment_type = 'reversal'
     ORDER BY date ASC, id ASC`,
    [userId]
  );
  let maxRev = 0;
  revPayments.forEach(p => {
    const n = extractNum(p.payment_number, 'REV');
    if (n > maxRev) maxRev = n;
  });
  for (const p of revPayments) {
    if (!p.payment_number || !/^REV-\d{4,}$/i.test(p.payment_number)) {
      maxRev++;
      const newNumber = `REV-${String(maxRev).padStart(4, '0')}`;
      await pool.query(`UPDATE payments SET payment_number = ? WHERE id = ? AND user_id = ?`, [newNumber, p.id, userId]);
      logger.info(`Updated reversal payment ${p.id} -> ${newNumber}`);
    }
  }

  // 6. Refunds (REF-0001)
  const [refPayments] = await pool.query(
    `SELECT id, payment_number, date FROM payments 
     WHERE user_id = ? AND (is_refund = true OR payment_type = 'refund') AND payment_type != 'reversal'
     ORDER BY date ASC, id ASC`,
    [userId]
  );
  let maxRef = 0;
  refPayments.forEach(p => {
    const n = extractNum(p.payment_number, 'REF');
    if (n > maxRef) maxRef = n;
  });
  for (const p of refPayments) {
    if (!p.payment_number || !/^REF-\d{4,}$/i.test(p.payment_number)) {
      maxRef++;
      const newNumber = `REF-${String(maxRef).padStart(4, '0')}`;
      await pool.query(`UPDATE payments SET payment_number = ? WHERE id = ? AND user_id = ?`, [newNumber, p.id, userId]);
      logger.info(`Updated refund payment ${p.id} -> ${newNumber}`);
    }
  }

  // 7. Advance Payments (ADV-0001)
  const [advances] = await pool.query(
    `SELECT id, advance_number, date FROM advance_payments WHERE user_id = ? ORDER BY date ASC, id ASC`,
    [userId]
  );
  let maxAdv = 0;
  advances.forEach(a => {
    const n = extractNum(a.advance_number, 'ADV');
    if (n > maxAdv) maxAdv = n;
  });
  for (const a of advances) {
    if (!a.advance_number || !/^ADV-\d{4,}$/i.test(a.advance_number)) {
      maxAdv++;
      const newNumber = `ADV-${String(maxAdv).padStart(4, '0')}`;
      await pool.query(`UPDATE advance_payments SET advance_number = ? WHERE id = ? AND user_id = ?`, [newNumber, a.id, userId]);
      logger.info(`Updated advance payment ${a.id} -> ${newNumber}`);
    }
  }

  // 8. Purchases / Expenses (EXP-0001)
  const [expenses] = await pool.query(
    `SELECT id, expense_number, date FROM purchases WHERE user_id = ? ORDER BY date ASC, id ASC`,
    [userId]
  );
  let maxExp = 0;
  expenses.forEach(e => {
    const n = extractNum(e.expense_number, 'EXP');
    if (n > maxExp) maxExp = n;
  });
  for (const e of expenses) {
    if (!e.expense_number || !/^EXP-\d{4,}$/i.test(e.expense_number)) {
      maxExp++;
      const newNumber = `EXP-${String(maxExp).padStart(4, '0')}`;
      await pool.query(`UPDATE purchases SET expense_number = ? WHERE id = ? AND user_id = ?`, [newNumber, e.id, userId]);
      logger.info(`Updated purchase ${e.id} -> ${newNumber}`);
    }
  }

  // 9. Cash Sessions (SESS-0001)
  const [sessions] = await pool.query(
    `SELECT id, session_number, opened_at FROM cash_sessions WHERE user_id = ? ORDER BY opened_at ASC, id ASC`,
    [userId]
  );
  let maxSess = 0;
  sessions.forEach(s => {
    const n = extractNum(s.session_number, 'SESS');
    if (n > maxSess) maxSess = n;
  });
  for (const s of sessions) {
    if (!s.session_number || !/^SESS-\d{4,}$/i.test(s.session_number)) {
      maxSess++;
      const newNumber = `SESS-${String(maxSess).padStart(4, '0')}`;
      await pool.query(`UPDATE cash_sessions SET session_number = ? WHERE id = ? AND user_id = ?`, [newNumber, s.id, userId]);
      logger.info(`Updated cash session ${s.id} -> ${newNumber}`);
    }
  }

  // 10. Synchronize the 'sequences' table
  const sequenceSyncs = [
    { entity_type: 'customer_regular', prefix: 'RC', maxSeq: maxRc },
    { entity_type: 'customer_walkin', prefix: 'WI', maxSeq: maxWi },
    { entity_type: 'bill', prefix: 'BILL', maxSeq: maxBill },
    { entity_type: 'payment', prefix: 'PAY', maxSeq: maxPay },
    { entity_type: 'payment_reversal', prefix: 'REV', maxSeq: maxRev },
    { entity_type: 'refund', prefix: 'REF', maxSeq: maxRef },
    { entity_type: 'advance', prefix: 'ADV', maxSeq: maxAdv },
    { entity_type: 'expense', prefix: 'EXP', maxSeq: maxExp },
    { entity_type: 'cash_session', prefix: 'SESS', maxSeq: maxSess }
  ];

  for (const item of sequenceSyncs) {
    await pool.query(
      `INSERT INTO sequences (user_id, entity_type, prefix, last_seq, padding, updated_at)
       VALUES (?, ?, ?, ?, 4, NOW())
       ON CONFLICT (user_id, entity_type)
       DO UPDATE SET last_seq = GREATEST(sequences.last_seq, EXCLUDED.last_seq), updated_at = NOW()`,
      [userId, item.entity_type, item.prefix, item.maxSeq]
    );
  }

  logger.info(`Successfully synchronized sequences for user ${userId}.`);
}

async function run() {
  const pool = getPool();
  try {
    const [users] = await pool.query('SELECT DISTINCT user_id FROM customers UNION SELECT DISTINCT user_id FROM bills');
    for (const u of users) {
      if (u.user_id) {
        await migrateUserSequences(pool, u.user_id);
      }
    }
    console.log('All user sequence migrations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { migrateUserSequences };
