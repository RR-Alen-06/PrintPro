import express from 'express';
import { getPool } from '../config/db';
import logger from '../utils/logger';

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let schemaEnsured = false;
async function ensureAdvanceSchema(connOrPool: any) {
  if (schemaEnsured) return;
  try {
    await connOrPool.query(`
      ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS advance_payments JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS advance_balance DECIMAL(10,2) DEFAULT 0.00;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(10,2) DEFAULT 0.00;
    `);
    schemaEnsured = true;
  } catch (err: any) {
    logger.warn(`Could not auto-ensure advance payments schema: ${err.message}`);
  }
}

// GET /api/advance-payments
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    await ensureAdvanceSchema(pool);

    const [rows] = await pool.query(
      `SELECT advance_payments FROM business_profile WHERE user_id = $1`,
      [req.user.id]
    );

    let advances = (rows && rows[0] && rows[0].advance_payments) || [];
    if (typeof advances === 'string') {
      try {
        advances = JSON.parse(advances);
      } catch (_) {
        advances = [];
      }
    }
    if (!Array.isArray(advances)) {
      advances = [];
    }

    res.json({ success: true, data: advances });
  } catch (err) {
    logger.error('Error in GET /api/advance-payments:', err);
    next(err);
  }
});

// POST /api/advance-payments
router.post('/', async (req: any, res: any, next: any) => {
  const pool = getPool();
  await ensureAdvanceSchema(pool);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { customerId, customer_id, customerName, amount, cashAmount, upiAmount, date, notes, isReturn } = req.body;
    const custId = customerId || customer_id;
    const numAmount = Number(amount || 0);

    const newAdvance = {
      id: req.body.id || `ADV-${Date.now()}`,
      customerId: custId || null,
      customerName: customerName || 'Customer',
      amount: numAmount,
      cashAmount: Number(cashAmount || 0),
      upiAmount: Number(upiAmount || 0),
      date: date || new Date().toISOString().slice(0, 10),
      notes: notes || '',
      isReturn: !!isReturn,
      createdAt: new Date().toISOString(),
    };

    // 1. Fetch current profile advances
    const [profileRows] = await conn.query(
      `SELECT advance_payments FROM business_profile WHERE user_id = $1`,
      [req.user.id]
    );

    let currentAdvances = (profileRows && profileRows[0] && profileRows[0].advance_payments) || [];
    if (typeof currentAdvances === 'string') {
      try {
        currentAdvances = JSON.parse(currentAdvances);
      } catch (_) {
        currentAdvances = [];
      }
    }
    if (!Array.isArray(currentAdvances)) {
      currentAdvances = [];
    }

    const updatedAdvances = [newAdvance, ...currentAdvances];

    if (profileRows && profileRows.length > 0) {
      await conn.query(
        `UPDATE business_profile SET advance_payments = $1::jsonb WHERE user_id = $2`,
        [JSON.stringify(updatedAdvances), req.user.id]
      );
    } else {
      await conn.query(
        `INSERT INTO business_profile (user_id, advance_payments) VALUES ($1, $2::jsonb)
         ON CONFLICT (user_id) DO UPDATE SET advance_payments = EXCLUDED.advance_payments`,
        [req.user.id, JSON.stringify(updatedAdvances)]
      );
    }

    // 2. Adjust customer advance_balance and credit_balance safely
    if (custId && UUID_REGEX.test(String(custId))) {
      const delta = isReturn ? -Math.abs(numAmount) : Math.abs(numAmount);
      try {
        await conn.query(
          `UPDATE customers 
           SET advance_balance = COALESCE(advance_balance, 0) + $1, 
               credit_balance = COALESCE(credit_balance, 0) + $1 
           WHERE id = $2 AND user_id = $3`,
          [delta, custId, req.user.id]
        );
      } catch (custErr: any) {
        logger.warn(`Could not update customer balance for ${custId}: ${custErr.message}`);
      }
    }

    await conn.commit();
    res.status(201).json({ success: true, data: newAdvance });
  } catch (err) {
    await conn.rollback();
    logger.error('Error in POST /api/advance-payments:', err);
    next(err);
  } finally {
    conn.release();
  }
});

// DELETE /api/advance-payments/:id
router.delete('/:id', async (req: any, res: any, next: any) => {
  const pool = getPool();
  await ensureAdvanceSchema(pool);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const [profileRows] = await conn.query(
      `SELECT advance_payments FROM business_profile WHERE user_id = $1`,
      [req.user.id]
    );

    let currentAdvances = (profileRows && profileRows[0] && profileRows[0].advance_payments) || [];
    if (typeof currentAdvances === 'string') {
      try {
        currentAdvances = JSON.parse(currentAdvances);
      } catch (_) {
        currentAdvances = [];
      }
    }
    if (!Array.isArray(currentAdvances)) {
      currentAdvances = [];
    }

    const advanceToDelete = currentAdvances.find((a: any) => a.id === id);
    const filteredAdvances = currentAdvances.filter((a: any) => a.id !== id);

    if (profileRows && profileRows.length > 0) {
      await conn.query(
        `UPDATE business_profile SET advance_payments = $1::jsonb WHERE user_id = $2`,
        [JSON.stringify(filteredAdvances), req.user.id]
      );
    }

    if (advanceToDelete) {
      const custId = advanceToDelete.customerId || advanceToDelete.customer_id;
      const numAmount = Number(advanceToDelete.amount || 0);
      const isReturn = !!(advanceToDelete.isReturn || advanceToDelete.is_return);
      const delta = isReturn ? -Math.abs(numAmount) : Math.abs(numAmount);

      if (custId && UUID_REGEX.test(String(custId))) {
        try {
          await conn.query(
            `UPDATE customers 
             SET advance_balance = COALESCE(advance_balance, 0) - $1, 
                 credit_balance = COALESCE(credit_balance, 0) - $1 
             WHERE id = $2 AND user_id = $3`,
            [delta, custId, req.user.id]
          );
        } catch (custErr: any) {
          logger.warn(`Could not reverse customer balance for ${custId}: ${custErr.message}`);
        }
      }
    }

    await conn.commit();
    res.json({ success: true, message: 'Advance payment removed' });
  } catch (err) {
    await conn.rollback();
    logger.error('Error in DELETE /api/advance-payments/:id:', err);
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
