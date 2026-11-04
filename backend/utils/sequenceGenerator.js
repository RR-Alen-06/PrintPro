/**
 * Atomic Concurrency-Safe Sequence Number Generator
 *
 * Provides thread-safe, monotonic, formatted sequence IDs for multi-tenant entities:
 * - Regular Customers: RC-0001
 * - Walk-in Customers: WI-0001
 * - Bills & Invoices: BILL-0001
 * - Standard Payments: PAY-0001
 * - Payment Reversals: REV-0001
 * - Refunds: REF-0001
 * - Customer Advances: ADV-0001
 * - Expenses / Purchases: EXP-0001
 * - Customer Groups: GRP-0001
 * - Split Purchases: SP-0001
 * - Cash Drawer Sessions: SESS-0001
 *
 * Uses the database 'sequences' table with atomic UPSERT and row-level locking.
 */

const logger = require('./logger');

const ENTITY_CONFIG = {
  bill: { prefix: 'BILL', padding: 4, table: 'bills', col: 'bill_number' },
  customer_regular: { prefix: 'RC', padding: 4, table: 'customers', col: 'customer_code', filter: "type = 'regular'" },
  customer_walkin: { prefix: 'WI', padding: 4, table: 'customers', col: 'customer_code', filter: "type != 'regular'" },
  payment: { prefix: 'PAY', padding: 4, table: 'payments', col: 'payment_number', filter: "(is_refund = false OR is_refund IS NULL) AND (payment_type IS NULL OR payment_type NOT IN ('reversal', 'refund'))" },
  payment_reversal: { prefix: 'REV', padding: 4, table: 'payments', col: 'payment_number', filter: "payment_type = 'reversal'" },
  refund: { prefix: 'REF', padding: 4, table: 'payments', col: 'payment_number', filter: "(is_refund = true OR payment_type = 'refund') AND payment_type != 'reversal'" },
  advance: { prefix: 'ADV', padding: 4, table: 'advance_payments', col: 'advance_number' },
  expense: { prefix: 'EXP', padding: 4, table: 'purchases', col: 'expense_number' },
  group: { prefix: 'GRP', padding: 4, table: 'customer_groups', col: 'group_code' },
  split_purchase: { prefix: 'SP', padding: 4, table: 'group_bills', col: 'id' },
  cash_session: { prefix: 'SESS', padding: 4, table: 'cash_sessions', col: 'session_number' }
};

const ENTITY_ALIASES = {
  bill: 'bill',
  bills: 'bill',
  BILL: 'bill',

  customer_regular: 'customer_regular',
  regular_customer: 'customer_regular',
  rc: 'customer_regular',
  RC: 'customer_regular',

  customer_walkin: 'customer_walkin',
  walkin: 'customer_walkin',
  walk_in: 'customer_walkin',
  wi: 'customer_walkin',
  WI: 'customer_walkin',

  payment: 'payment',
  payments: 'payment',
  PAY: 'payment',
  pay: 'payment',

  payment_reversal: 'payment_reversal',
  reversal: 'payment_reversal',
  REV: 'payment_reversal',
  rev: 'payment_reversal',

  refund: 'refund',
  refunds: 'refund',
  REF: 'refund',
  ref: 'refund',

  advance: 'advance',
  advance_payment: 'advance',
  advances: 'advance',
  ADV: 'advance',
  adv: 'advance',

  expense: 'expense',
  expenses: 'expense',
  purchase: 'expense',
  purchases: 'expense',
  EXP: 'expense',
  exp: 'expense',

  group: 'group',
  customer_group: 'group',
  customer_groups: 'group',
  GRP: 'group',
  grp: 'group',

  split_purchase: 'split_purchase',
  split_bill: 'split_purchase',
  SP: 'split_purchase',
  sp: 'split_purchase',

  cash_session: 'cash_session',
  session: 'cash_session',
  cash_sessions: 'cash_session',
  SESS: 'cash_session',
  sess: 'cash_session'
};

/**
 * Gets the next atomic sequence code for an entity type.
 *
 * @param {object} connOrPool Database connection or pool with query()
 * @param {string} userId Tenant / Auth User ID (UUID)
 * @param {string} rawEntityType One of canonical types or alias (e.g. 'bill', 'payment', 'REV', 'SESS', etc.)
 * @param {string} [customPrefix] Optional override prefix
 * @returns {Promise<string>} e.g. "BILL-0007"
 */
async function getNextSequence(connOrPool, userId, rawEntityType, customPrefix = null) {
  const entityType = ENTITY_ALIASES[rawEntityType] || rawEntityType;
  const config = ENTITY_CONFIG[entityType] || { prefix: customPrefix || 'SEQ', padding: 4 };
  const prefix = customPrefix || config.prefix;
  const padding = config.padding || 4;

  try {
    // 1. Check if sequence already initialized for this user + entity_type
    const [existingSeq] = await connOrPool.query(
      'SELECT last_seq FROM sequences WHERE user_id = ? AND entity_type = ? FOR UPDATE',
      [userId, entityType]
    );

    if (existingSeq.length > 0) {
      // Sequence row exists; atomically increment
      const [updated] = await connOrPool.query(
        `UPDATE sequences
         SET last_seq = last_seq + 1, updated_at = NOW()
         WHERE user_id = ? AND entity_type = ?
         RETURNING prefix, last_seq, padding`,
        [userId, entityType]
      );
      const row = (Array.isArray(updated) ? updated[0] : updated) || {};
      const rowPrefix = row.prefix || prefix;
      const rowSeq = row.last_seq || (existingSeq[0].last_seq + 1);
      const rowPad = row.padding || padding;
      const delim = rowPrefix.endsWith('-') ? '' : '-';
      return `${rowPrefix}${delim}${String(rowSeq).padStart(rowPad, '0')}`;
    }

    // 2. Initialize sequence by finding current max in the entity table
    let maxNum = 0;
    if (config.table && config.col) {
      let maxSql = `SELECT ${config.col} AS code FROM ${config.table} WHERE user_id = ? AND ${config.col} IS NOT NULL`;
      if (config.filter) {
        maxSql += ` AND ${config.filter}`;
      }
      maxSql += ` ORDER BY CAST(NULLIF(regexp_replace(${config.col}::text, '[^0-9]', '', 'g'), '') AS INTEGER) DESC LIMIT 1`;

      const [maxRows] = await connOrPool.query(maxSql, [userId]);
      if (maxRows.length > 0 && maxRows[0]?.code) {
        const numPart = String(maxRows[0].code).replace(/[^0-9]/g, '');
        maxNum = parseInt(numPart || '0', 10);
      }
    }

    const nextSeq = maxNum + 1;

    // 3. Insert new sequence row with conflict handling
    const [inserted] = await connOrPool.query(
      `INSERT INTO sequences (user_id, entity_type, prefix, last_seq, padding, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON CONFLICT (user_id, entity_type)
       DO UPDATE SET last_seq = sequences.last_seq + 1, updated_at = NOW()
       RETURNING prefix, last_seq, padding`,
      [userId, entityType, prefix, nextSeq, padding]
    );

    const row = (Array.isArray(inserted) ? inserted[0] : inserted) || {};
    const rowPrefix = row.prefix || prefix;
    const rowSeq = row.last_seq || nextSeq;
    const rowPad = row.padding || padding;
    const delim = rowPrefix.endsWith('-') ? '' : '-';
    return `${rowPrefix}${delim}${String(rowSeq).padStart(rowPad, '0')}`;
  } catch (err) {
    logger.warn(`Sequence generator error: ${err.message}. Falling back to timestamp sequence.`);
    const delim = prefix.endsWith('-') ? '' : '-';
    return `${prefix}${delim}${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Reset all sequences for a user (called during Clear All Data / Factory Reset).
 *
 * @param {object} connOrPool Database connection or pool
 * @param {string} userId Tenant UUID
 */
async function resetAllSequences(connOrPool, userId) {
  try {
    await connOrPool.query('DELETE FROM sequences WHERE user_id = ?', [userId]);
    logger.info(`All sequences reset successfully for user ${userId}`);
    return true;
  } catch (err) {
    logger.error(`Error resetting sequences for user ${userId}: ${err.message}`);
    throw err;
  }
}

module.exports = {
  getNextSequence,
  resetAllSequences,
  ENTITY_CONFIG,
  ENTITY_ALIASES
};
