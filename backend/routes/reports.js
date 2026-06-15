const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', async (req, res, next) => {
  try {
    const pool = getPool();
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const [bills] = await pool.query(
      `SELECT b.*, c.name AS customer_name FROM bills b
       LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.date = ? AND b.deleted_at IS NULL ORDER BY b.created_at DESC`,
      [date]
    );

    const totalBilled = bills.reduce((s, b) => s + parseFloat(b.total || 0), 0);
    const totalPaid   = bills.reduce((s, b) => s + parseFloat(b.amount_paid || 0), 0);
    const totalDue    = bills.reduce((s, b) => s + parseFloat(b.balance || 0), 0);

    res.json({ success: true, data: { date, bills, summary: { total_billed: totalBilled, total_paid: totalPaid, total_due: totalDue, bill_count: bills.length } } });
  } catch (err) { next(err); }
});

// GET /api/reports/monthly?year=YYYY&month=MM
router.get('/monthly', async (req, res, next) => {
  try {
    const pool = getPool();
    const now   = new Date();
    const year  = parseInt(req.query.year,  10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);
    const pad   = String(month).padStart(2, '0');

    const [bills] = await pool.query(
      `SELECT b.*, c.name AS customer_name FROM bills b
       LEFT JOIN customers c ON b.customer_id = c.id
       WHERE DATE_FORMAT(b.date,'%Y-%m') = ? AND b.deleted_at IS NULL ORDER BY b.date DESC`,
      [`${year}-${pad}`]
    );

    const totalBilled = bills.reduce((s, b) => s + parseFloat(b.total || 0), 0);
    const totalPaid   = bills.reduce((s, b) => s + parseFloat(b.amount_paid || 0), 0);

    res.json({ success: true, data: { year, month, bills, summary: { total_billed: totalBilled, total_paid: totalPaid, bill_count: bills.length } } });
  } catch (err) { next(err); }
});

// GET /api/reports/yearly?year=YYYY
router.get('/yearly', async (req, res, next) => {
  try {
    const pool = getPool();
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const [monthly] = await pool.query(
      `SELECT DATE_FORMAT(date,'%Y-%m') AS month,
              COUNT(*) AS bill_count,
              SUM(total) AS total_billed,
              SUM(amount_paid) AS total_paid
       FROM bills WHERE YEAR(date) = ? AND deleted_at IS NULL
       GROUP BY month ORDER BY month ASC`,
      [year]
    );

    const [totals] = await pool.query(
      `SELECT COUNT(*) AS bill_count, SUM(total) AS total_billed, SUM(amount_paid) AS total_paid
       FROM bills WHERE YEAR(date) = ? AND deleted_at IS NULL`,
      [year]
    );

    res.json({ success: true, data: { year, monthly, summary: totals[0] } });
  } catch (err) { next(err); }
});

// GET /api/reports/receivables
router.get('/receivables', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT b.id, b.date, b.due_date, b.total, b.amount_paid, b.balance, b.status,
              c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone
       FROM bills b
       LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.status != 'paid' AND b.deleted_at IS NULL
       ORDER BY b.balance DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/reports/top-customers?period=monthly|yearly|all
router.get('/top-customers', async (req, res, next) => {
  try {
    const pool = getPool();
    const period = req.query.period || 'all';
    let dateFilter = '';

    if (period === 'monthly') {
      dateFilter = `AND MONTH(b.date) = MONTH(NOW()) AND YEAR(b.date) = YEAR(NOW())`;
    } else if (period === 'yearly') {
      dateFilter = `AND YEAR(b.date) = YEAR(NOW())`;
    }

    const [rows] = await pool.query(
      `SELECT c.id, c.name, COUNT(b.id) AS bill_count,
              SUM(b.total) AS total_billed, SUM(b.amount_paid) AS total_paid
       FROM customers c
       LEFT JOIN bills b ON c.id = b.customer_id AND b.deleted_at IS NULL ${dateFilter}
       GROUP BY c.id, c.name
       ORDER BY total_billed DESC LIMIT 10`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/reports/best-items?period=monthly|yearly|all
router.get('/best-items', async (req, res, next) => {
  try {
    const pool = getPool();
    const period = req.query.period || 'all';
    let dateFilter = '';

    if (period === 'monthly') {
      dateFilter = `AND MONTH(b.date) = MONTH(NOW()) AND YEAR(b.date) = YEAR(NOW())`;
    } else if (period === 'yearly') {
      dateFilter = `AND YEAR(b.date) = YEAR(NOW())`;
    }

    const [rows] = await pool.query(
      `SELECT bi.item_name, bi.print_type, bi.sides,
              SUM(bi.qty) AS total_qty, SUM(bi.amount) AS total_revenue
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       WHERE b.deleted_at IS NULL ${dateFilter}
       GROUP BY bi.item_name, bi.print_type, bi.sides
       ORDER BY total_revenue DESC LIMIT 10`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
