import { PoolClient } from 'pg';
const { getPool } = require('../config/db');

export interface DependentCustomerInput {
  type?: 'regular' | 'random';
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit?: number;
}

export async function executeAtomicTransaction<T>(
  reqUser: any,
  newCustomerInput: DependentCustomerInput | null | undefined,
  primaryOperation: (conn: PoolClient, resolvedCustomerId: string | null) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let resolvedCustomerId: string | null = null;

    if (newCustomerInput) {
      const type = newCustomerInput.type || 'random';
      const prefix = type === 'regular' ? 'RC' : 'RND';

      const [maxRows] = await conn.query(
        `SELECT customer_code FROM customers WHERE type = $1 AND user_id = $2 ORDER BY CAST(NULLIF(regexp_replace(customer_code, '[^0-9]', '', 'g'), '') AS INTEGER) DESC LIMIT 1`,
        [type, reqUser.id]
      );

      let nextNum = 1;
      if (maxRows.length > 0 && maxRows[0].customer_code) {
        const numPart = maxRows[0].customer_code.replace(/[^0-9]/g, '');
        nextNum = parseInt(numPart || '0', 10) + 1;
      }
      const customerCode = `${prefix}-${String(nextNum).padStart(3, '0')}`;

      const [insertedRows] = await conn.query(
        `INSERT INTO customers (user_id, type, name, phone, email, address, credit_limit, customer_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          reqUser.id,
          type,
          newCustomerInput.name,
          newCustomerInput.phone || '',
          newCustomerInput.email || '',
          newCustomerInput.address || '',
          newCustomerInput.credit_limit || 0,
          customerCode
        ]
      );

      resolvedCustomerId = insertedRows[0].id;
    }

    const result = await primaryOperation(conn, resolvedCustomerId);

    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
