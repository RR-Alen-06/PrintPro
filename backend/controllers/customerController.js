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

    const [customers] = await pool.query('SELECT * FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
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
      [id, req.user.id]
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
    const { type, name, phone, email, address, credit_limit, credit_balance } = req.body;

    if (!type || !name) {
      return res.status(400).json({ success: false, error: 'Type and name are required' });
    }

    // Use client-provided ID if sent (reconciliation), otherwise generate one
    let customerId = req.body.id;
    if (!customerId) {
      const prefix = type === 'regular' ? 'RC' : 'RND';
      const [maxRows] = await pool.query(
        `SELECT id FROM customers WHERE type = ? AND user_id = ? ORDER BY CAST(NULLIF(regexp_replace(id, '[^0-9]', '', 'g'), '') AS INTEGER) DESC LIMIT 1`,
        [type, req.user.id]
      );

      let nextNum = 1;
      if (maxRows.length > 0) {
        const lastId = maxRows[0].id;
        const numPart = lastId.replace(/[^0-9]/g, '');
        nextNum = parseInt(numPart || '0', 10) + 1;
      }

      customerId = `${prefix}-${String(nextNum).padStart(3, '0')}`;
    }

    await pool.query(
      `INSERT INTO customers (id, user_id, type, name, phone, email, address, credit_limit, credit_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, req.user.id, type, name, phone || '', email || '', address || '', credit_limit || 0, credit_balance || 0]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'CREATE', 'customer', customerId, JSON.stringify({ type, name, phone, email, address })]
    );

    const [newCustomer] = await pool.query('SELECT * FROM customers WHERE id = ? AND user_id = ?', [customerId, req.user.id]);
    res.status(201).json({ success: true, data: newCustomer[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /:id - Update customer
async function updateCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, phone, email, address, credit_limit } = req.body;

    const [existing] = await pool.query('SELECT * FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const oldValue = existing[0];

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    if (credit_limit !== undefined) updates.credit_limit = credit_limit;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id, req.user.id);

    await pool.query(`UPDATE customers SET ${setClauses} WHERE id = ? AND user_id = ?`, values);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, 'UPDATE', 'customer', id, JSON.stringify(oldValue), JSON.stringify(updates)]
    );

    const [updated] = await pool.query('SELECT * FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
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

    const [existing] = await pool.query('SELECT * FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Check for unpaid bills
    const [unpaidBills] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bills WHERE customer_id = ? AND user_id = ? AND status != 'paid' AND deleted_at IS NULL`,
      [id, req.user.id]
    );

    if (unpaidBills[0].cnt > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete customer with ${unpaidBills[0].cnt} unpaid/partial bill(s). Settle all bills first.`
      });
    }

    await pool.query('DELETE FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'DELETE', 'customer', id, JSON.stringify(existing[0])]
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

    const [customer] = await pool.query('SELECT id FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [bills] = await pool.query(
      'SELECT * FROM bills WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL ORDER BY date DESC',
      [id, req.user.id]
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

    const [customer] = await pool.query('SELECT id FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [payments] = await pool.query(
      `SELECT p.*, b.total AS bill_total
       FROM payments p
       LEFT JOIN bills b ON p.bill_id = b.id AND p.user_id = b.user_id
       WHERE p.customer_id = ? AND p.user_id = ?
       ORDER BY p.date DESC`,
      [id, req.user.id]
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

    const [customer] = await pool.query('SELECT * FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Get all bills
    const [bills] = await pool.query(
      `SELECT id, date, total, amount_paid, balance, status, 'bill' AS entry_type
       FROM bills WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, req.user.id]
    );

    // Get all payments
    const [payments] = await pool.query(
      `SELECT id, date, total_paid, cash_amount, upi_amount, bill_id, payment_type, 'payment' AS entry_type
       FROM payments WHERE customer_id = ? AND user_id = ?`,
      [id, req.user.id]
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
