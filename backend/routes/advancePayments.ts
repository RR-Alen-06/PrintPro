import express from 'express';
import { getPool } from '../config/db';

const router = express.Router();

// GET /api/advance-payments
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT advance_payments FROM business_profile WHERE user_id = $1`,
      [req.user.id]
    );

    const advances = (rows && rows[0] && rows[0].advance_payments) || [];
    res.json({ success: true, data: advances });
  } catch (err) {
    next(err);
  }
});

// POST /api/advance-payments
router.post('/', async (req: any, res: any, next: any) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { customerId, customer_id, customerName, amount, cashAmount, upiAmount, date, notes, isReturn } = req.body;
    const custId = customerId || customer_id;
    const numAmount = Number(amount || 0);

    const newAdvance = {
      id: req.body.id || `ADV-${Date.now()}`,
      customerId: custId,
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

    const currentAdvances = (profileRows && profileRows[0] && profileRows[0].advance_payments) || [];
    const updatedAdvances = [newAdvance, ...currentAdvances];

    await conn.query(
      `UPDATE business_profile SET advance_payments = $1 WHERE user_id = $2`,
      [JSON.stringify(updatedAdvances), req.user.id]
    );

    // 2. Adjust customer advance_balance
    if (custId) {
      const delta = isReturn ? -Math.abs(numAmount) : Math.abs(numAmount);
      await conn.query(
        `UPDATE customers SET advance_balance = COALESCE(advance_balance, 0) + $1, credit_balance = COALESCE(credit_balance, 0) + $1 WHERE id = $2 AND user_id = $3`,
        [delta, custId, req.user.id]
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, data: newAdvance });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// DELETE /api/advance-payments/:id
router.delete('/:id', async (req: any, res: any, next: any) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const [profileRows] = await conn.query(
      `SELECT advance_payments FROM business_profile WHERE user_id = $1`,
      [req.user.id]
    );

    const currentAdvances = (profileRows && profileRows[0] && profileRows[0].advance_payments) || [];
    const advanceToDelete = currentAdvances.find((a: any) => a.id === id);

    const filteredAdvances = currentAdvances.filter((a: any) => a.id !== id);

    await conn.query(
      `UPDATE business_profile SET advance_payments = $1 WHERE user_id = $2`,
      [JSON.stringify(filteredAdvances), req.user.id]
    );

    if (advanceToDelete) {
      const custId = advanceToDelete.customerId || advanceToDelete.customer_id;
      const numAmount = Number(advanceToDelete.amount || 0);
      const isReturn = !!(advanceToDelete.isReturn || advanceToDelete.is_return);
      const delta = isReturn ? -Math.abs(numAmount) : Math.abs(numAmount);

      if (custId) {
        await conn.query(
          `UPDATE customers 
           SET advance_balance = COALESCE(advance_balance, 0) - $1, 
               credit_balance = COALESCE(credit_balance, 0) - $1 
           WHERE id = $2 AND user_id = $3`,
          [delta, custId, req.user.id]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: 'Advance payment removed' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
