const { getPool } = require('../config/db');

// GET / - List all customers
async function listCustomers(req, res, next) {
  try {
    const pool = getPool();
    const { type, search } = req.query;
    let sql = 'SELECT * FROM customers WHERE user_id = ?';
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
    res.json({ success: true, data: rows });
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
      'SELECT * FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
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
        ...customer,
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

    const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

    let customerId = req.body.id;
    let customerCode = customer_code || req.body.customerCode;

    if (!isUuid(customerId)) {
      if (customerId && !customerCode) {
        customerCode = customerId;
      }
      customerId = require('crypto').randomUUID();
    }

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
      'SELECT * FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
      [customerId, customerCode, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(200).json({ success: true, data: existing[0] });
    }

    const creditBalance = parseFloat(req.body.credit_balance || req.body.creditBalance || 0);
    const advanceBalance = parseFloat(req.body.advance_balance || req.body.advanceBalance || creditBalance);

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

    const [newCustomer] = await pool.query('SELECT * FROM customers WHERE id = ? AND user_id = ?', [customerId, req.user.id]);
    res.status(201).json({ success: true, data: newCustomer[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /:id - Update customer
const ALLOWED_CUSTOMER_COLUMNS = ['name', 'phone', 'email', 'address', 'type', 'credit_limit', 'credit_balance', 'advance_balance', 'loyalty_points', 'customer_code'];


async function updateCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const invalidKeys = Object.keys(req.body).filter(k => !ALLOWED_CUSTOMER_COLUMNS.includes(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({ success: false, error: `Invalid column(s): ${invalidKeys.join(', ')}` });
    }

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
    for (const key of ALLOWED_CUSTOMER_COLUMNS) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(customerId, req.user.id);

    await pool.query(`UPDATE customers SET ${setClauses} WHERE id = ? AND user_id = ?`, values);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, 'UPDATE', 'customer', customerId, JSON.stringify(oldValue), JSON.stringify(updates)]
    );

    const [updated] = await pool.query('SELECT * FROM customers WHERE id = ? AND user_id = ?', [customerId, req.user.id]);
    res.json({ success: true, data: updated[0] });
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
      'SELECT * FROM bills WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL ORDER BY date DESC',
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
      `SELECT p.*, b.total AS bill_total
       FROM payments p
       LEFT JOIN bills b ON p.bill_id::text = b.id::text AND p.user_id = b.user_id
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
      'SELECT * FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
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
        customer: customer[0],
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
