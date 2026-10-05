const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');

// Helper to construct PostgreSQL date filter clauses
function buildDateClause(startDate, endDate, colName = 'b.date') {
  let clause = '';
  const params = [];
  if (startDate) {
    clause += ` AND ${colName} >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    clause += ` AND ${colName} <= ?`;
    params.push(endDate);
  }
  return { clause, params };
}

// ── 1. GET /api/analytics/products ─────────────────────────────────────────────
// Returns per-product performance (inventory + custom items)
router.get('/products', async (req, res, next) => {
  try {
    const pool = getPool();
    const { startDate, endDate } = req.query;

    const { clause: dateFilter, params: dateParams } = buildDateClause(startDate, endDate, 'b.date');

    // First get overall total revenue for percentage calculation
    const [overallRes] = await pool.query(
      `SELECT COALESCE(SUM(bi.amount), 0) AS grand_total_revenue,
              COALESCE(SUM(bi.qty), 0) AS grand_total_qty
       FROM bill_items bi
       JOIN bills b ON bi.bill_id::text = b.id::text AND bi.user_id = b.user_id
       WHERE b.user_id = ? AND b.deleted_at IS NULL ${dateFilter}`,
      [req.user.id, ...dateParams]
    );

    const grandTotalRev = parseFloat(overallRes[0]?.grand_total_revenue || 0);

    // Per-item aggregation
    const [rows] = await pool.query(
      `SELECT
         bi.item_name,
         bi.print_type,
         bi.sides,
         COALESCE(SUM(bi.qty), 0) AS total_qty,
         COALESCE(SUM(bi.amount), 0) AS total_revenue,
         COUNT(DISTINCT bi.bill_id) AS bill_count,
         CASE
           WHEN SUM(bi.qty) > 0 THEN ROUND(SUM(bi.amount) / SUM(bi.qty), 2)
           ELSE 0
         END AS avg_unit_price
       FROM bill_items bi
       JOIN bills b ON bi.bill_id::text = b.id::text AND bi.user_id = b.user_id
       WHERE b.user_id = ? AND b.deleted_at IS NULL ${dateFilter}
       GROUP BY bi.item_name, bi.print_type, bi.sides
       ORDER BY total_revenue DESC, total_qty DESC`,
      [req.user.id, ...dateParams]
    );

    const products = rows.map(r => {
      const rev = parseFloat(r.total_revenue) || 0;
      const pct = grandTotalRev > 0 ? parseFloat(((rev / grandTotalRev) * 100).toFixed(2)) : 0;
      const typeLabel = r.print_type && r.sides ? `${r.print_type === 'bw' ? 'B&W' : 'Color'} ${r.sides === 'double' ? 'Double' : 'Single'}` : '';
      const displayName = typeLabel ? `${r.item_name} (${typeLabel})` : r.item_name;

      return {
        item_name: r.item_name,
        print_type: r.print_type || null,
        sides: r.sides || null,
        display_name: displayName,
        total_qty: parseInt(r.total_qty, 10) || 0,
        total_revenue: rev,
        avg_unit_price: parseFloat(r.avg_unit_price) || 0,
        bill_count: parseInt(r.bill_count, 10) || 0,
        percentage_of_total: pct
      };
    });

    res.json({
      success: true,
      data: {
        products,
        grand_total_revenue: grandTotalRev,
        total_products_count: products.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// ── 2. GET /api/analytics/products/trends ──────────────────────────────────────
// Returns time-series trend (monthly, weekly, daily) for product(s)
router.get('/products/trends', async (req, res, next) => {
  try {
    const pool = getPool();
    const { itemName, period = 'monthly', startDate, endDate } = req.query;

    let itemFilter = '';
    const params = [req.user.id];

    if (itemName) {
      itemFilter = ' AND bi.item_name ILIKE ?';
      params.push(itemName);
    }

    if (startDate) {
      itemFilter += ' AND b.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      itemFilter += ' AND b.date <= ?';
      params.push(endDate);
    }

    let dateTruncField = `TO_CHAR(b.date, 'YYYY-MM')`;
    if (period === 'daily') {
      dateTruncField = `TO_CHAR(b.date, 'YYYY-MM-DD')`;
    } else if (period === 'weekly') {
      dateTruncField = `TO_CHAR(DATE_TRUNC('week', b.date), 'YYYY-MM-DD')`;
    } else if (period === 'yearly') {
      dateTruncField = `TO_CHAR(b.date, 'YYYY')`;
    }

    const [rows] = await pool.query(
      `SELECT
         ${dateTruncField} AS period_key,
         COALESCE(SUM(bi.qty), 0) AS qty,
         COALESCE(SUM(bi.amount), 0) AS revenue,
         COUNT(DISTINCT b.id) AS bill_count
       FROM bill_items bi
       JOIN bills b ON bi.bill_id::text = b.id::text AND bi.user_id = b.user_id
       WHERE b.user_id = ? AND b.deleted_at IS NULL ${itemFilter}
       GROUP BY period_key
       ORDER BY period_key ASC`,
      params
    );

    res.json({
      success: true,
      data: rows.map(r => ({
        period_key: r.period_key,
        period_label: r.period_key,
        qty: parseInt(r.qty, 10) || 0,
        revenue: parseFloat(r.revenue) || 0,
        bill_count: parseInt(r.bill_count, 10) || 0
      }))
    });
  } catch (err) {
    next(err);
  }
});

// ── 3. GET /api/analytics/products/:itemName/customers ─────────────────────────
// Returns top customers purchasing a specific product
router.get('/products/:itemName/customers', async (req, res, next) => {
  try {
    const pool = getPool();
    const { itemName } = req.params;
    const { startDate, endDate, limit = 10 } = req.query;

    const { clause: dateFilter, params: dateParams } = buildDateClause(startDate, endDate, 'b.date');

    const [rows] = await pool.query(
      `SELECT
         c.id AS customer_id,
         COALESCE(c.name, 'Walk-in') AS customer_name,
         c.phone AS customer_phone,
         COALESCE(SUM(bi.qty), 0) AS total_qty,
         COALESCE(SUM(bi.amount), 0) AS total_spent,
         COUNT(DISTINCT b.id) AS order_count,
         MAX(b.date) AS last_purchased
       FROM bill_items bi
       JOIN bills b ON bi.bill_id::text = b.id::text AND bi.user_id = b.user_id
       LEFT JOIN customers c ON (b.customer_id::text = c.id::text OR b.customer_id::text = c.customer_code) AND b.user_id = c.user_id
       WHERE b.user_id = ? AND bi.item_name ILIKE ? AND b.deleted_at IS NULL ${dateFilter}
       GROUP BY c.id, c.name, c.phone
       ORDER BY total_spent DESC, total_qty DESC
       LIMIT ?`,
      [req.user.id, itemName, ...dateParams, parseInt(limit, 10)]
    );

    res.json({
      success: true,
      data: rows.map(r => ({
        customer_id: r.customer_id,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone || '',
        total_qty: parseInt(r.total_qty, 10) || 0,
        total_spent: parseFloat(r.total_spent) || 0,
        order_count: parseInt(r.order_count, 10) || 0,
        last_purchased: r.last_purchased
      }))
    });
  } catch (err) {
    next(err);
  }
});

// ── 4. GET /api/analytics/summary ──────────────────────────────────────────────
// Overall financial metrics: revenue, cash, UPI, expenses, refunds, net profit
router.get('/summary', async (req, res, next) => {
  try {
    const pool = getPool();
    const { startDate, endDate } = req.query;

    const { clause: billDateFilter, params: billParams } = buildDateClause(startDate, endDate, 'b.date');

    // 1. Bills summary
    const [billSummary] = await pool.query(
      `SELECT
         COALESCE(SUM(b.total), 0) AS total_revenue,
         COALESCE(SUM(b.amount_paid), 0) AS total_collected,
         COALESCE(SUM(b.balance), 0) AS total_due,
         COUNT(b.id) AS bill_count,
         COUNT(DISTINCT b.customer_id) AS unique_customers
       FROM bills b
       WHERE b.user_id = ? AND b.deleted_at IS NULL ${billDateFilter}`,
      [req.user.id, ...billParams]
    );

    // 2. Payments summary (cash vs upi vs refunds)
    let payFilter = ' WHERE user_id = ? AND deleted_at IS NULL';
    const payParams = [req.user.id];
    if (startDate) {
      payFilter += ' AND date >= ?';
      payParams.push(startDate);
    }
    if (endDate) {
      payFilter += ' AND date <= ?';
      payParams.push(endDate + ' 23:59:59');
    }

    const [paySummary] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN is_refund = false THEN cash_amount ELSE 0 END), 0) AS cash_collected,
         COALESCE(SUM(CASE WHEN is_refund = false THEN upi_amount ELSE 0 END), 0) AS upi_collected,
         COALESCE(SUM(CASE WHEN is_refund = true THEN ABS(total_paid) ELSE 0 END), 0) AS total_refunds
       FROM payments
       ${payFilter}`,
      payParams
    );

    // 3. Expenses summary
    let expFilter = ' WHERE user_id = ?';
    const expParams = [req.user.id];
    if (startDate) {
      expFilter += ' AND date >= ?';
      expParams.push(startDate);
    }
    if (endDate) {
      expFilter += ' AND date <= ?';
      expParams.push(endDate);
    }

    const [expSummary] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS total_expenses, COUNT(*) AS expense_count
       FROM purchases
       ${expFilter}`,
      expParams
    );

    const totalRev = parseFloat(billSummary[0]?.total_revenue || 0);
    const totalColl = parseFloat(billSummary[0]?.total_collected || 0);
    const totalDue = parseFloat(billSummary[0]?.total_due || 0);
    const cashColl = parseFloat(paySummary[0]?.cash_collected || 0);
    const upiColl = parseFloat(paySummary[0]?.upi_collected || 0);
    const totalRef = parseFloat(paySummary[0]?.total_refunds || 0);
    const totalExp = parseFloat(expSummary[0]?.total_expenses || 0);
    const billCnt = parseInt(billSummary[0]?.bill_count || 0, 10);
    const uniqueCust = parseInt(billSummary[0]?.unique_customers || 0, 10);

    const netProfit = parseFloat((totalRev - totalRef - totalExp).toFixed(2));
    const avgBillVal = billCnt > 0 ? parseFloat((totalRev / billCnt).toFixed(2)) : 0;

    res.json({
      success: true,
      data: {
        total_revenue: totalRev,
        total_collected: totalColl,
        total_due: totalDue,
        cash_revenue: cashColl,
        upi_revenue: upiColl,
        total_refunds: totalRef,
        total_expenses: totalExp,
        net_profit: netProfit,
        bill_count: billCnt,
        unique_customers: uniqueCust,
        average_bill_value: avgBillVal
      }
    });
  } catch (err) {
    next(err);
  }
});

// ── 5. GET /api/analytics/promo-usage ──────────────────────────────────────────
// Promo codes usage & revenue generated
router.get('/promo-usage', async (req, res, next) => {
  try {
    const pool = getPool();
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [req.user.id];
    if (startDate) {
      dateFilter += ' AND pu.used_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND pu.used_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    const [rows] = await pool.query(
      `SELECT
         pc.id,
         pc.code,
         pc.discount_type,
         pc.discount_value,
         pc.is_active,
         COUNT(pu.id) AS times_used,
         COALESCE(SUM(pu.discount_applied), 0) AS total_discount_given,
         COALESCE(SUM(b.total), 0) AS total_sales_generated
       FROM promo_codes pc
       LEFT JOIN promo_uses pu ON pc.id = pu.promo_code_id AND pc.user_id = pu.user_id ${dateFilter}
       LEFT JOIN bills b ON pu.bill_id::text = b.id::text AND pu.user_id = b.user_id AND b.deleted_at IS NULL
       WHERE pc.user_id = ?
       GROUP BY pc.id, pc.code, pc.discount_type, pc.discount_value, pc.is_active
       ORDER BY times_used DESC, total_sales_generated DESC`,
      [...params]
    );

    res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        code: r.code,
        discount_type: r.discount_type,
        discount_value: parseFloat(r.discount_value) || 0,
        is_active: r.is_active,
        times_used: parseInt(r.times_used, 10) || 0,
        total_discount_given: parseFloat(r.total_discount_given) || 0,
        total_sales_generated: parseFloat(r.total_sales_generated) || 0
      }))
    });
  } catch (err) {
    next(err);
  }
});

// ── 6. GET /api/analytics/expenses/vendors ───────────────────────────────────
// Expense breakdown by Vendor
router.get('/expenses/vendors', async (req, res, next) => {
  try {
    const pool = getPool();
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [req.user.id];
    if (startDate) {
      dateFilter += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND date <= ?';
      params.push(endDate);
    }

    // Total expense for percentage calculation
    const [totalRes] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS grand_total FROM purchases WHERE user_id = ? ${dateFilter}`,
      params
    );
    const grandTotal = parseFloat(totalRes[0]?.grand_total || 0);

    const [rows] = await pool.query(
      `SELECT
         COALESCE(NULLIF(TRIM(vendor_name), ''), 'General / Unspecified') AS vendor_name,
         COUNT(*) AS purchase_count,
         COALESCE(SUM(total), 0) AS total_spent,
         COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash_spent,
         COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN total ELSE 0 END), 0) AS upi_spent,
         MAX(date) AS last_purchase_date
       FROM purchases
       WHERE user_id = ? ${dateFilter}
       GROUP BY vendor_name
       ORDER BY total_spent DESC`,
      params
    );

    const vendors = rows.map(r => {
      const spent = parseFloat(r.total_spent) || 0;
      const pct = grandTotal > 0 ? parseFloat(((spent / grandTotal) * 100).toFixed(2)) : 0;
      return {
        vendor_name: r.vendor_name,
        purchase_count: parseInt(r.purchase_count, 10) || 0,
        total_spent: spent,
        cash_spent: parseFloat(r.cash_spent) || 0,
        upi_spent: parseFloat(r.upi_spent) || 0,
        last_purchase_date: r.last_purchase_date,
        percentage_of_total: pct,
      };
    });

    res.json({
      success: true,
      data: {
        vendors,
        grand_total_spent: grandTotal,
        total_vendors_count: vendors.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// ── 7. GET /api/analytics/expenses/categories ────────────────────────────────
// Expense breakdown by Category
router.get('/expenses/categories', async (req, res, next) => {
  try {
    const pool = getPool();
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [req.user.id];
    if (startDate) {
      dateFilter += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND date <= ?';
      params.push(endDate);
    }

    const [totalRes] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS grand_total FROM purchases WHERE user_id = ? ${dateFilter}`,
      params
    );
    const grandTotal = parseFloat(totalRes[0]?.grand_total || 0);

    const [rows] = await pool.query(
      `SELECT
         category,
         COUNT(*) AS purchase_count,
         COALESCE(SUM(total), 0) AS total_spent,
         COALESCE(SUM(qty), 0) AS total_qty
       FROM purchases
       WHERE user_id = ? ${dateFilter}
       GROUP BY category
       ORDER BY total_spent DESC`,
      params
    );

    const categories = rows.map(r => {
      const spent = parseFloat(r.total_spent) || 0;
      const pct = grandTotal > 0 ? parseFloat(((spent / grandTotal) * 100).toFixed(2)) : 0;
      return {
        category: r.category,
        purchase_count: parseInt(r.purchase_count, 10) || 0,
        total_spent: spent,
        total_qty: parseInt(r.total_qty, 10) || 0,
        percentage_of_total: pct,
      };
    });

    res.json({
      success: true,
      data: {
        categories,
        grand_total_spent: grandTotal,
        total_categories_count: categories.length
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
