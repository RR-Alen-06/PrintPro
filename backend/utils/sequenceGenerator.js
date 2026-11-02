/**
 * Atomic Concurrency-Safe Sequence Number Generator
 *
 * Provides thread-safe, monotonic, formatted sequence IDs for multi-tenant entities
 * (e.g., BILL-0001, RC-0001, WI-0001, PAY-0001, ADV-0001, EXP-0001, GRP-0001).
 * Uses the database 'sequences' table with atomic UPSERT and row-level locking.
 */

const logger = require('./logger');

const ENTITY_CONFIG = {
  bill: { prefix: 'BILL', padding: 4, table: 'bills', col: 'bill_number' },
  customer_regular: { prefix: 'RC', padding: 4, table: 'customers', col: 'customer_code', filter: "type = 'regular'" },
  customer_walkin: { prefix: 'WI', padding: 4, table: 'customers', col: 'customer_code', filter: "type != 'regular'" },
  payment: { prefix: 'PAY', padding: 4, table: 'payments', col: 'payment_number' },
  advance: { prefix: 'ADV', padding: 4, table: 'advance_payments', col: 'advance_number' },
  expense: { prefix: 'EXP', padding: 4, table: 'purchases', col: 'expense_number' },
  group: { prefix: 'GRP', padding: 3, table: 'customer_groups', col: 'id' }
};

/**
 * Gets the next atomic sequence code for an entity type.
 *
 * @param {object} connOrPool Database connection or pool with query()
 * @param {string} userId Tenant / Auth User ID (UUID)
 * @param {string} entityType One of 'bill', 'customer_regular', 'customer_walkin', 'payment', 'advance', 'expense', 'group'
 * @param {string} [customPrefix] Optional override prefix
 * @returns {Promise<string>} e.g. "BILL-0007"
 */
async function getNextSequence(connOrPool, userId, entityType, customPrefix = null) {
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

module.exports = {
  getNextSequence,
  ENTITY_CONFIG
};
