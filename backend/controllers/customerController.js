const { getPool } = require('../config/db');

// Customer projection DTO: strips internal auth tenant ID (user_id) and raw DB columns
function toCustomerDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type || 'regular',
    customer_code: row.customer_code || '',
    name: row.name || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    credit_balance: parseFloat(row.credit_balance) || 0,
    advance_balance: parseFloat(row.advance_balance) || 0,
    credit_limit: parseFloat(row.credit_limit) || 0,
    loyalty_points: parseInt(row.loyalty_points, 10) || 0,
    created_at: row.created_at
  };
}

// GET / - List all customers
async function listCustomers(req, res, next) {
  try {
    const pool = getPool();
    const { type, search } = req.query;
    let sql = 'SELECT id, type, customer_code, name, phone, email, address, credit_balance, advance_balance, credit_limit, loyalty_points, created_at FROM customers WHERE user_id = ?';
    const params = [req.user.id];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows.map(toCustomerDto) });
  } catch (err) {
    next(err);
  }
}

// GET /:id - Get customer by ID with bills summary
async function getCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [customers] = await pool.query(
      'SELECT id, type, customer_code, name, phone, email, address, credit_balance, advance_balance, credit_limit, loyalty_points, created_at FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [id, id, req.user.id]
    );
    if (customers.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customer = customers[0];

    // Bills summary
    const [billsSummary] = await pool.query(
      `SELECT
        COUNT(*) AS total_bills,
        COALESCE(SUM(total), 0) AS total_billed,
        COALESCE(SUM(amount_paid), 0) AS total_paid,
        COALESCE(SUM(balance), 0) AS total_outstanding,
        SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_count,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) AS partial_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count
      FROM bills WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL`,
      [customer.id, req.user.id]
    );

    res.json({
      success: true,
      data: {
        ...toCustomerDto(customer),
        bills_summary: billsSummary[0]
      }
    });
  } catch (err) {
    next(err);
  }
}

// POST / - Create customer
async function createCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { type, name, phone, email, address, credit_limit, customer_code } = req.body;

    if (!type || !name) {
      return res.status(400).json({ success: false, error: 'Type and name are required' });
    }

    let customerId = require('crypto').randomUUID();
    let customerCode = customer_code || req.body.customerCode;

    if (!customerCode) {
      const prefix = type === 'regular' ? 'RC' : 'RND';
      const [maxRows] = await pool.query(
        `SELECT customer_code FROM customers WHERE type = ? AND user_id = ? AND customer_code IS NOT NULL ORDER BY CAST(NULLIF(regexp_replace(customer_code, '[^0-9]', '', 'g'), '') AS INTEGER) DESC LIMIT 1`,
        [type, req.user.id]
      );

      let nextNum = 1;
      if (maxRows.length > 0 && maxRows[0]?.customer_code) {
        const lastCode = maxRows[0].customer_code;
        const numPart = lastCode.replace(/[^0-9]/g, '');
        nextNum = parseInt(numPart || '0', 10) + 1;
      }

      customerCode = `${prefix}-${String(nextNum).padStart(4, '0')}`;
    }

    // Idempotent check for offline sync retry
    const [existing] = await pool.query(
      'SELECT id, type, customer_code, name, phone, email, address, credit_balance, advance_balance, credit_limit, loyalty_points, created_at FROM customers WHERE customer_code = ? AND user_id = ?',
      [customerCode, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(200).json({ success: true, data: toCustomerDto(existing[0]) });
    }

    const creditBalance = 0;
    const advanceBalance = 0;

    await pool.query(
      `INSERT INTO customers (id, user_id, type, name, phone, email, address, credit_limit, customer_code, credit_balance, advance_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, req.user.id, type, name, phone || '', email || '', address || '', credit_limit || 0, customerCode, creditBalance, advanceBalance]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'CREATE', 'customer', customerId, JSON.stringify({ type, name, phone, email, address, customer_code: customerCode })]
    );

    const [newCustomer] = await pool.query(
      'SELECT id, type, customer_code, name, phone, email, address, credit_balance, advance_balance, credit_limit, loyalty_points, created_at FROM customers WHERE id = ? AND user_id = ?',
      [customerId, req.user.id]
    );
    res.status(201).json({ success: true, data: toCustomerDto(newCustomer[0]) });
  } catch (err) {
    next(err);
  }
}

// PUT /:id - Update customer
const ALLOWED_CUSTOMER_COLUMNS = [
  'name', 'phone', 'email', 'address', 'type', 'credit_limit',
  'customer_code', 'credit_balance', 'advance_balance', 'loyalty_points'
];

const CUSTOMER_COLUMN_MAP = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  address: 'address',
  type: 'type',
  credit_limit: 'credit_limit',
  creditLimit: 'credit_limit',
  customer_code: 'customer_code',
  customerCode: 'customer_code',
  credit_balance: 'credit_balance',
  creditBalance: 'credit_balance',
  advance_balance: 'advance_balance',
  advanceBalance: 'advance_balance',
  loyalty_points: 'loyalty_points',
  loyaltyPoints: 'loyalty_points'
};

async function updateCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [id, id, req.user.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const oldValue = existing[0];
    const customerId = oldValue.id;

    const updates = {};
    for (const [key, dbCol] of Object.entries(CUSTOMER_COLUMN_MAP)) {
      if (req.body[key] !== undefined) {
        if (dbCol === 'type') {
          let t = req.body[key];
          if (t === 'walkin') t = 'random';
          if (t !== 'regular' && t !== 'random') t = 'random';
          updates[dbCol] = t;
        } else if (dbCol === 'credit_balance' || dbCol === 'advance_balance' || dbCol === 'credit_limit') {
          updates[dbCol] = parseFloat(req.body[key]) || 0;
        } else if (dbCol === 'loyalty_points') {
          updates[dbCol] = parseInt(req.body[key], 10) || 0;
        } else {
          updates[dbCol] = req.body[key];
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const validKeys = Object.keys(updates).filter(key => ALLOWED_CUSTOMER_COLUMNS.includes(key));
      const setClauses = validKeys.map(key => `"${key}" = ?`).join(', ');
      const values = validKeys.map(key => updates[key]);
      values.push(customerId, req.user.id);

      await pool.query(`UPDATE customers SET ${setClauses} WHERE id = ? AND user_id = ?`, values);

      // Audit log
      await pool.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, 'UPDATE', 'customer', customerId, JSON.stringify(oldValue), JSON.stringify(updates)]
      );
    }

    const [updated] = await pool.query(
      'SELECT id, type, customer_code, name, phone, email, address, credit_balance, advance_balance, credit_limit, loyalty_points, created_at FROM customers WHERE id = ? AND user_id = ?',
      [customerId, req.user.id]
    );
    res.json({ success: true, data: toCustomerDto(updated[0]) });
  } catch (err) {
    next(err);
  }
}

// DELETE /:id - Delete customer
async function deleteCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [id, id, req.user.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customerId = existing[0].id;

    // Check for unpaid bills
    const [unpaidBills] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bills WHERE customer_id = ? AND user_id = ? AND status != 'paid' AND deleted_at IS NULL`,
      [customerId, req.user.id]
    );

    if (unpaidBills[0].cnt > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete customer with ${unpaidBills[0].cnt} unpaid/partial bill(s). Settle all bills first.`
      });
    }

    await pool.query('DELETE FROM customers WHERE id = ? AND user_id = ?', [customerId, req.user.id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'DELETE', 'customer', customerId, JSON.stringify(existing[0])]
    );

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// GET /:id/bills - Get all bills for customer
async function getCustomerBills(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [customer] = await pool.query(
      'SELECT id FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [id, id, req.user.id]
    );
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [bills] = await pool.query(
      'SELECT id, bill_number, invoice_number, customer_id, date, due_date, subtotal, discount_type, discount_value, gst_percent, gst_amount, total, amount_paid, balance, status, notes, created_at FROM bills WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL ORDER BY date DESC',
      [customer[0].id, req.user.id]
    );

    res.json({ success: true, data: bills });
  } catch (err) {
    next(err);
  }
}

// GET /:id/payments - Get all payments for customer
async function getCustomerPayments(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [customer] = await pool.query(
      'SELECT id FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [id, id, req.user.id]
    );
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [payments] = await pool.query(
      `SELECT p.id, p.bill_id, p.customer_id, p.payment_number, p.date, p.cash_amount, p.upi_amount, p.total_paid, p.payment_type, p.is_refund, p.notes, b.total AS bill_total
       FROM payments p
       LEFT JOIN bills b ON (p.bill_id::text = b.id::text OR p.bill_id = b.bill_number OR p.bill_id = b.invoice_number) AND p.user_id = b.user_id
       WHERE p.customer_id = ? AND p.user_id = ?
       ORDER BY p.date DESC`,
      [customer[0].id, req.user.id]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

// GET /:id/statement - Full statement (bills + payments timeline)
async function getCustomerStatement(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [customer] = await pool.query(
      'SELECT id, type, customer_code, name, phone, email, address, credit_balance, advance_balance, credit_limit, loyalty_points, created_at FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [id, id, req.user.id]
    );
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customerId = customer[0].id;

    // Get all bills
    const [bills] = await pool.query(
      `SELECT id, bill_number, invoice_number, date, total, amount_paid, balance, status, 'bill' AS entry_type
       FROM bills WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL`,
      [customerId, req.user.id]
    );

    // Get all payments
    const [payments] = await pool.query(
      `SELECT id, payment_number, date, total_paid, cash_amount, upi_amount, bill_id, payment_type, notes, 'payment' AS entry_type
       FROM payments WHERE customer_id = ? AND user_id = ?`,
      [customerId, req.user.id]
    );

    // Combine and sort by date
    const timeline = [
      ...bills.map(b => ({ ...b, sort_date: new Date(b.date) })),
      ...payments.map(p => ({ ...p, sort_date: new Date(p.date) }))
    ].sort((a, b) => a.sort_date - b.sort_date);

    // Remove the sort helper
    timeline.forEach(entry => delete entry.sort_date);

    res.json({
      success: true,
      data: {
        customer: toCustomerDto(customer[0]),
        statement: timeline
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBills,
  getCustomerPayments,
  getCustomerStatement
};
