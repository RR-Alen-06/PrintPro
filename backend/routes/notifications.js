const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');

/**
 * Notifications are computed dynamically from live data:
 * - Unpaid / overdue bills
 * - Low stock inventory items
 */

// GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const notifications = [];

    // Overdue unpaid / partial bills
    const [overdue] = await pool.query(
      `SELECT b.id, b.due_date, b.balance, c.name AS customer_name
       FROM bills b
       LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.user_id = ? AND b.status != 'paid' AND b.due_date < CURDATE() AND b.deleted_at IS NULL
       ORDER BY b.due_date ASC LIMIT 20`,
      [req.user.id]
    );

    overdue.forEach((bill) => {
      notifications.push({
        id: `overdue-${bill.id}`,
        title: `Overdue: ${bill.id}`,
        message: `${bill.customer_name} owes ₹${parseFloat(bill.balance).toFixed(2)} — due ${bill.due_date}`,
        type: 'warning',
        read: false,
        date: new Date().toISOString().slice(0, 10),
      });
    });

    // Low stock items
    const [lowStock] = await pool.query(
      `SELECT name, stock, low_stock_alert FROM inventory_items
       WHERE user_id = ? AND stock <= low_stock_alert ORDER BY stock ASC`,
      [req.user.id]
    );

    lowStock.forEach((item) => {
      notifications.push({
        id: `stock-${item.name}`,
        title: `Low stock: ${item.name}`,
        message: `Only ${item.stock} units left (alert threshold: ${item.low_stock_alert})`,
        type: 'info',
        read: false,
        date: new Date().toISOString().slice(0, 10),
      });
    });

    res.json({ success: true, data: notifications });
  } catch (err) { next(err); }
});

module.exports = router;
