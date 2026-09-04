import { getPool } from '../config/db';

// GET / - List all customers
export async function listCustomers(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { type, search } = req.query;
    let sql = 'SELECT * FROM customers WHERE user_id = $1';
    const params: any[] = [req.user.id];

    if (type && type !== 'all') {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      const searchIdx = params.length;
      sql += ` AND (name ILIKE $${searchIdx} OR phone ILIKE $${searchIdx})`;
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /:id - Get customer by ID with bills summary
export async function getCustomer(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [customers] = await pool.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
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
      FROM bills WHERE customer_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
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
export async function createCustomer(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { type, name, phone, email, address, credit_limit, credit_balance } = req.body;

    if (!type || !name) {
      return res.status(400).json({ success: false, error: 'Type and name are required' });
    }

    // Generate human-readable code (e.g. RC0001, RND0001)
    const prefix = type === 'regular' ? 'RC' : 'RND';
    const [maxRows] = await pool.query(
      `SELECT customer_code FROM customers WHERE type = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [type, req.user.id]
    );

    let nextNum = 1;
    if (maxRows.length > 0 && maxRows[0].customer_code) {
      const numPart = maxRows[0].customer_code.replace(/[^0-9]/g, '');
      nextNum = parseInt(numPart || '0', 10) + 1;
    }

    const customerCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

    // Omit `id` so PostgreSQL assigns gen_random_uuid()
    const [insertedRows] = await pool.query(
      `INSERT INTO customers (user_id, type, name, phone, email, address, credit_limit, credit_balance, customer_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.user.id,
        type,
        name,
        phone || '',
        email || '',
        address || '',
        credit_limit || 0,
        credit_balance || 0,
        customerCode
      ]
    );

    const newCustomer = insertedRows && insertedRows.length > 0 ? insertedRows[0] : insertedRows;

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'CREATE', 'customer', newCustomer.id, JSON.stringify({ type, name, phone, email, address })]
    );

    res.status(201).json({ success: true, data: newCustomer });
  } catch (err) {
    next(err);
  }
}

// PUT /:id - Update customer
export async function updateCustomer(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { name, phone, email, address, credit_limit, credit_balance } = req.body;

    const [existing] = await pool.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const oldValue = existing[0];

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    if (credit_limit !== undefined) updates.credit_limit = credit_limit;
    if (credit_balance !== undefined) updates.credit_balance = credit_balance;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const keys = Object.keys(updates);
    const setClauses = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id, req.user.id);

    await pool.query(
      `UPDATE customers SET ${setClauses}, updated_at = NOW() WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}`,
      values
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'UPDATE', 'customer', id, JSON.stringify(oldValue), JSON.stringify(updates)]
    );

    const [updated] = await pool.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /:id - Delete customer
export async function deleteCustomer(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Check for unpaid bills
    const [unpaidBills] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bills WHERE customer_id = $1 AND user_id = $2 AND status != 'paid' AND deleted_at IS NULL`,
      [id, req.user.id]
    );

    if (unpaidBills[0].cnt > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete customer with ${unpaidBills[0].cnt} unpaid/partial bill(s). Settle all bills first.`
      });
    }

    await pool.query('DELETE FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'DELETE', 'customer', id, JSON.stringify(existing[0])]
    );

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// GET /:id/bills - Get all bills for customer
export async function getCustomerBills(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [customer] = await pool.query('SELECT id FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [bills] = await pool.query(
      'SELECT * FROM bills WHERE customer_id = $1 AND user_id = $2 AND deleted_at IS NULL ORDER BY date DESC',
      [id, req.user.id]
    );

    if (bills.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const billIds = bills.map((b: any) => b.id);
    const [allItems] = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = ANY($1::uuid[]) AND user_id = $2',
      [billIds, req.user.id]
    );
    const itemsMap: Record<string, any[]> = {};
    allItems.forEach((item: any) => {
      if (!itemsMap[item.bill_id]) {
        itemsMap[item.bill_id] = [];
      }
      itemsMap[item.bill_id].push(item);
    });
    bills.forEach((bill: any) => {
      bill.items = itemsMap[bill.id] || [];
    });

    res.json({ success: true, data: bills });
  } catch (err) {
    next(err);
  }
}

// GET /:id/payments - Get all payments for customer
export async function getCustomerPayments(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [customer] = await pool.query('SELECT id FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [payments] = await pool.query(
      `SELECT p.*, b.total AS bill_total
       FROM payments p
       LEFT JOIN bills b ON p.bill_id = b.id AND p.user_id = b.user_id
       WHERE p.customer_id = $1 AND p.user_id = $2
       ORDER BY p.date DESC`,
      [id, req.user.id]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

// GET /:id/statement - Full statement (bills + payments timeline)
export async function getCustomerStatement(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [customer] = await pool.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Get all bills
    const [bills] = await pool.query(
      `SELECT id, date, total, amount_paid, balance, status, 'bill' AS entry_type
       FROM bills WHERE customer_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, req.user.id]
    );

    // Get all payments
    const [payments] = await pool.query(
      `SELECT id, date, total_paid, cash_amount, upi_amount, bill_id, payment_type, 'payment' AS entry_type
       FROM payments WHERE customer_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    // Combine and sort by date
    const timeline = [
      ...bills.map((b: any) => ({ ...b, sort_date: new Date(b.date) })),
      ...payments.map((p: any) => ({ ...p, sort_date: new Date(p.date) }))
    ].sort((a: any, b: any) => a.sort_date - b.sort_date);

    // Remove the sort helper
    timeline.forEach((entry: any) => delete entry.sort_date);

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
