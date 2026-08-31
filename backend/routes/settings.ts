import express from 'express';
import { getPool } from '../config/db';

const router = express.Router();

// DELETE /api/settings/clear-all
// Transactionally erases all data belonging strictly to the authenticated user in FK-safe order
router.delete('/clear-all', async (req: any, res: any, next: any) => {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const userId = req.user.id;

    // 1. Delete payments (references bills & customers)
    await conn.query('DELETE FROM payments WHERE user_id = $1', [userId]);

    // 2. Delete bill items (references bills)
    await conn.query('DELETE FROM bill_items WHERE user_id = $1', [userId]);

    // 3. Delete bills & group bills
    await conn.query('DELETE FROM group_bills WHERE user_id = $1', [userId]);
    await conn.query('DELETE FROM bills WHERE user_id = $1', [userId]);

    // 4. Delete purchases/expenses
    await conn.query('DELETE FROM purchases WHERE user_id = $1', [userId]);

    // 5. Delete inventory items
    await conn.query('DELETE FROM inventory_items WHERE user_id = $1', [userId]);

    // 6. Delete customers
    await conn.query('DELETE FROM customers WHERE user_id = $1', [userId]);

    // 7. Reset business profile embedded JSONB fields (advance_payments, etc.)
    await conn.query(
      `UPDATE business_profile 
       SET advance_payments = '[]'::jsonb
       WHERE user_id = $1`,
      [userId]
    );

    await conn.commit();

    res.json({
      success: true,
      message: 'All user data successfully cleared across database tables.'
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
