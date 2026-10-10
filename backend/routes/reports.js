const express = require('express');
const router = express.Router();
const path = require('path');
const { getPool } = require('../config/db');
const { generateEodPdf } = require('../utils/eodPdfGenerator');
const logger = require('../utils/logger');

/**
 * Helper to build comprehensive End-of-Day (EOD) report data.
 */
async function buildEodReportData(pool, userId, targetDate) {
  const dateStr = targetDate || new Date().toISOString().slice(0, 10);

  // 1. Fetch business profile and user settings
  const [profiles] = await pool.query('SELECT * FROM business_profile WHERE user_id = ?', [userId]);
  const profile = profiles[0] || {};

  const [settingsRows] = await pool.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
  let userSettings = {};
  if (settingsRows[0]?.settings) {
    try {
      userSettings = typeof settingsRows[0].settings === 'string'
        ? JSON.parse(settingsRows[0].settings)
        : settingsRows[0].settings;
    } catch (_e) { userSettings = {}; }
  }

  const business = {
    shop_name: profile.shop_name || userSettings.shopName || 'PrintPro',
    phone: profile.phone || userSettings.phone || '',
    address: profile.address || userSettings.address || '',
    gstin: profile.gstin || userSettings.gstNumber || '',
    upi_id: profile.upi_id || userSettings.upiId || '',
  };

  // 2. Fetch bills for the target day
  const [bills] = await pool.query(
    `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone
     FROM bills b
     LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
     WHERE b.user_id = ? AND b.date = ? AND b.deleted_at IS NULL
     ORDER BY b.id DESC`,
    [userId, dateStr]
  );

  // 3. Fetch payments for the target day
  const [payments] = await pool.query(
    `SELECT p.*, c.name AS customer_name
     FROM payments p
     LEFT JOIN customers c ON p.customer_id = c.id AND p.user_id = c.user_id
     WHERE p.user_id = ? AND DATE(p.date) = ? AND p.deleted_at IS NULL
     ORDER BY p.date DESC`,
    [userId, dateStr]
  );

  // 4. Fetch daily purchases / expenses
  const [expensesList] = await pool.query(
    `SELECT * FROM purchases
     WHERE user_id = ? AND date = ?
     ORDER BY id DESC`,
    [userId, dateStr]
  );

  // 5. Count new customers registered on target date
  const [custRows] = await pool.query(
    `SELECT COUNT(*) AS new_count
     FROM customers
     WHERE user_id = ? AND DATE(created_at) = ?`,
    [userId, dateStr]
  );
  const newCustomersCount = parseInt(custRows[0]?.new_count || 0, 10);

  // 6. Top selling item on target date
  const [topItemRows] = await pool.query(
    `SELECT bi.item_name, SUM(bi.qty) AS total_qty, SUM(bi.amount) AS total_revenue
     FROM bill_items bi
     JOIN bills b ON bi.bill_id::text = b.id::text AND bi.user_id = b.user_id
     WHERE b.user_id = ? AND b.date = ? AND b.deleted_at IS NULL
     GROUP BY bi.item_name
     ORDER BY total_qty DESC, total_revenue DESC LIMIT 1`,
    [userId, dateStr]
  );
  const topItem = topItemRows.length > 0 ? {
    name: topItemRows[0].item_name,
    qty: parseInt(topItemRows[0].total_qty, 10),
    revenue: parseFloat(topItemRows[0].total_revenue),
  } : null;

  // 7. Calculations
  const totalBilled = bills.reduce((sum, b) => sum + (parseFloat(b.total) || 0), 0);
  const pendingDues = bills.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0);

  const nonRefundPayments = payments.filter(p => !p.is_refund && p.payment_type !== 'refund' && parseFloat(p.total_paid || 0) >= 0);
  const refundPayments = payments.filter(p => p.is_refund || p.payment_type === 'refund' || parseFloat(p.total_paid || 0) < 0);

  const collectedCash = nonRefundPayments.reduce((sum, p) => sum + (parseFloat(p.cash_amount) || 0), 0);
  const collectedUpi = nonRefundPayments.reduce((sum, p) => sum + (parseFloat(p.upi_amount) || 0), 0);
  const totalCollected = collectedCash + collectedUpi;
  const totalRefunds = refundPayments.reduce((sum, p) => sum + Math.abs(parseFloat(p.total_paid) || 0), 0);

  const totalExpenses = expensesList.reduce((sum, e) => sum + (parseFloat(e.total) || 0), 0);
  const netProfit = totalBilled - totalExpenses;
  const cashNetProfit = totalCollected - totalExpenses - totalRefunds;

  return {
    date: dateStr,
    business,
    summary: {
      total_billed: parseFloat(totalBilled.toFixed(2)),
      collected_cash: parseFloat(collectedCash.toFixed(2)),
      collected_upi: parseFloat(collectedUpi.toFixed(2)),
      total_collected: parseFloat(totalCollected.toFixed(2)),
      total_refunds: parseFloat(totalRefunds.toFixed(2)),
      pending_dues: parseFloat(pendingDues.toFixed(2)),
      expenses: parseFloat(totalExpenses.toFixed(2)),
      net_profit: parseFloat(netProfit.toFixed(2)),
      cash_net_profit: parseFloat(cashNetProfit.toFixed(2)),
      new_customers: newCustomersCount,
      top_item: topItem,
      bill_count: bills.length,
      payment_count: payments.length,
    },
    bills,
    payments,
    expenses_list: expensesList,
  };
}

// GET /api/reports/eod?date=YYYY-MM-DD
router.get('/eod', async (req, res, next) => {
  try {
    const pool = getPool();
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const reportData = await buildEodReportData(pool, req.user.id, date);
    res.json({ success: true, data: reportData });
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/eod/pdf
router.post('/eod/pdf', async (req, res, next) => {
  try {
    const pool = getPool();
    const date = req.body.date || req.query.date || new Date().toISOString().slice(0, 10);
    const reportData = await buildEodReportData(pool, req.user.id, date);

    const cleanDate = date.replace(/[^0-9-]/g, '_');
    const timestamp = Date.now();
    const fileName = `eod_${cleanDate}_${timestamp}.pdf`;
    const uploadDir = path.join(__dirname, '../uploads/reports');
    const filePath = path.join(uploadDir, fileName);

    await generateEodPdf(reportData, filePath);

    const relativeUrl = `/uploads/reports/${fileName}`;
    const host = req.get('host');
    const protocol = req.protocol || 'http';
    const fullUrl = `${protocol}://${host}${relativeUrl}`;

    res.json({
      success: true,
      pdfUrl: relativeUrl,
      fullUrl,
      fileName,
      data: reportData,
    });
  } catch (err) {
    logger.error(`Failed to generate EOD PDF: ${err.message}`);
    next(err);
  }
});

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', async (req, res, next) => {
  try {
    const pool = getPool();
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const [bills] = await pool.query(
      `SELECT b.*, c.name AS customer_name FROM bills b
       LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.user_id = ? AND b.date = ? AND b.deleted_at IS NULL ORDER BY b.created_at DESC`,
      [req.user.id, date]
    );

    // Compute refund totals for the day from the payments table
    const [refundRows] = await pool.query(
      `SELECT COALESCE(SUM(ABS(total_paid)), 0) AS total_refunds,
              COALESCE(SUM(ABS(cash_amount)), 0) AS cash_refunded,
              COALESCE(SUM(ABS(upi_amount)), 0) AS upi_refunded
       FROM payments
       WHERE user_id = ? AND DATE(date) = ? AND (is_refund = true OR payment_type = 'refund' OR total_paid < 0)`,
      [req.user.id, date]
    );

    const totalBilled   = bills.reduce((s, b) => s + parseFloat(b.total || 0), 0);
    const totalPaid     = bills.reduce((s, b) => s + parseFloat(b.amount_paid || 0), 0);
    const totalDue      = bills.reduce((s, b) => s + parseFloat(b.balance || 0), 0);
    const totalRefunds  = parseFloat(refundRows[0]?.total_refunds || 0);
    const netSales      = totalBilled; // bill.total already net after refund edit
    const netPaid       = totalPaid;   // bill.amount_paid already net after ADD_PAYMENT fix

    res.json({
      success: true,
      data: {
        date, bills,
        summary: {
          total_billed:  totalBilled,
          total_paid:    totalPaid,
          total_due:     totalDue,
          total_refunds: totalRefunds,
          net_sales:     netSales,
          net_paid:      netPaid,
          cash_refunded: parseFloat(refundRows[0]?.cash_refunded || 0),
          upi_refunded:  parseFloat(refundRows[0]?.upi_refunded || 0),
          bill_count:    bills.length,
        }
      }
    });
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
       LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.user_id = ? AND TO_CHAR(b.date, 'YYYY-MM') = ? AND b.deleted_at IS NULL ORDER BY b.date DESC`,
      [req.user.id, `${year}-${pad}`]
    );

    // Compute refund totals for the month
    const [refundRows] = await pool.query(
      `SELECT COALESCE(SUM(ABS(total_paid)), 0) AS total_refunds,
              COALESCE(SUM(ABS(cash_amount)), 0) AS cash_refunded,
              COALESCE(SUM(ABS(upi_amount)), 0) AS upi_refunded
       FROM payments
       WHERE user_id = ? AND TO_CHAR(date, 'YYYY-MM') = ? AND (is_refund = true OR payment_type = 'refund' OR total_paid < 0)`,
      [req.user.id, `${year}-${pad}`]
    );

    const totalBilled  = bills.reduce((s, b) => s + parseFloat(b.total || 0), 0);
    const totalPaid    = bills.reduce((s, b) => s + parseFloat(b.amount_paid || 0), 0);
    const totalRefunds = parseFloat(refundRows[0]?.total_refunds || 0);

    res.json({
      success: true,
      data: {
        year, month, bills,
        summary: {
          total_billed:  totalBilled,
          total_paid:    totalPaid,
          total_refunds: totalRefunds,
          net_sales:     totalBilled,  // already net after refund-edit
          net_paid:      totalPaid,    // already net after ADD_PAYMENT fix
          cash_refunded: parseFloat(refundRows[0]?.cash_refunded || 0),
          upi_refunded:  parseFloat(refundRows[0]?.upi_refunded || 0),
          bill_count:    bills.length,
        }
      }
    });
  } catch (err) { next(err); }
});

// GET /api/reports/yearly?year=YYYY
router.get('/yearly', async (req, res, next) => {
  try {
    const pool = getPool();
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const [monthly] = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') AS month,
              COUNT(*) AS bill_count,
              SUM(total) AS total_billed,
              SUM(amount_paid) AS total_paid
       FROM bills WHERE user_id = ? AND EXTRACT(YEAR FROM date) = ? AND deleted_at IS NULL
       GROUP BY TO_CHAR(date, 'YYYY-MM') ORDER BY TO_CHAR(date, 'YYYY-MM') ASC`,
      [req.user.id, year]
    );

    const [totals] = await pool.query(
      `SELECT COUNT(*) AS bill_count, SUM(total) AS total_billed, SUM(amount_paid) AS total_paid
       FROM bills WHERE user_id = ? AND EXTRACT(YEAR FROM date) = ? AND deleted_at IS NULL`,
      [req.user.id, year]
    );

    // Compute refund totals for the year from payments table
    const [refundRows] = await pool.query(
      `SELECT COALESCE(SUM(ABS(total_paid)), 0) AS total_refunds,
              COALESCE(SUM(ABS(cash_amount)), 0) AS cash_refunded,
              COALESCE(SUM(ABS(upi_amount)), 0) AS upi_refunded
       FROM payments
       WHERE user_id = ? AND EXTRACT(YEAR FROM date) = ? AND (is_refund = true OR payment_type = 'refund' OR total_paid < 0)`,
      [req.user.id, year]
    );

    const totalRefunds = parseFloat(refundRows[0]?.total_refunds || 0);
    const summary = {
      ...totals[0],
      total_refunds: totalRefunds,
      net_sales:     parseFloat(totals[0]?.total_billed || 0),  // already net after refund-edit
      net_paid:      parseFloat(totals[0]?.total_paid || 0),    // already net after ADD_PAYMENT fix
      cash_refunded: parseFloat(refundRows[0]?.cash_refunded || 0),
      upi_refunded:  parseFloat(refundRows[0]?.upi_refunded || 0),
    };

    res.json({ success: true, data: { year, monthly, summary } });
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
       LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.user_id = ? AND b.status != 'paid' AND b.deleted_at IS NULL
       ORDER BY b.balance DESC`,
      [req.user.id]
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
      dateFilter = `AND EXTRACT(MONTH FROM b.date) = EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM b.date) = EXTRACT(YEAR FROM NOW())`;
    } else if (period === 'yearly') {
      dateFilter = `AND EXTRACT(YEAR FROM b.date) = EXTRACT(YEAR FROM NOW())`;
    }

    const [rows] = await pool.query(
      `SELECT c.id, c.name, COUNT(b.id) AS bill_count,
              SUM(b.total) AS total_billed, SUM(b.amount_paid) AS total_paid
       FROM customers c
       LEFT JOIN bills b ON c.id = b.customer_id AND c.user_id = b.user_id AND b.deleted_at IS NULL ${dateFilter}
       WHERE c.user_id = ?
       GROUP BY c.id, c.name
       ORDER BY total_billed DESC LIMIT 10`,
      [req.user.id]
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
      dateFilter = `AND EXTRACT(MONTH FROM b.date) = EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM b.date) = EXTRACT(YEAR FROM NOW())`;
    } else if (period === 'yearly') {
      dateFilter = `AND EXTRACT(YEAR FROM b.date) = EXTRACT(YEAR FROM NOW())`;
    }

    const [rows] = await pool.query(
      `SELECT bi.item_name, bi.print_type, bi.sides,
              SUM(bi.qty) AS total_qty, SUM(bi.amount) AS total_revenue
       FROM bill_items bi
       JOIN bills b ON bi.bill_id::text = b.id::text AND bi.user_id = b.user_id
       WHERE b.user_id = ? AND b.deleted_at IS NULL ${dateFilter}
       GROUP BY bi.item_name, bi.print_type, bi.sides
       ORDER BY total_revenue DESC LIMIT 10`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
