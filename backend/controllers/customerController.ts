import { Response, NextFunction } from 'express';
import { getPool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

interface CustomerDbRow {
  id: string;
  user_id: string;
  type: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit: number | string;
  credit_balance: number | string;
  advance_balance?: number | string;
  customer_code?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface BillsSummaryDbRow {
  total_bills: number | string;
  total_billed: number | string;
  total_paid: number | string;
  total_outstanding: number | string;
  unpaid_count: number | string;
  partial_count: number | string;
  paid_count: number | string;
  [key: string]: unknown;
}

interface CustomerBillItemDbRow {
  id: string;
  bill_id: string;
  user_id: string;
  item_name: string;
  print_type: string;
  sides: string;
  qty: number;
  unit_price: number;
  amount: number;
  [key: string]: unknown;
}

interface CustomerBillDbRow {
  id: string;
  user_id: string;
  customer_id: string;
  invoice_number?: string;
  total: number | string;
  amount_paid: number | string;
  balance: number | string;
  status: string;
  date?: string;
  items?: CustomerBillItemDbRow[];
  [key: string]: unknown;
}

interface StatementEntry {
  id: string;
  date?: string;
  entry_type: 'bill' | 'payment';
  sort_date?: Date;
  total?: number | string;
  amount_paid?: number | string;
  balance?: number | string;
  status?: string;
  total_paid?: number | string;
  cash_amount?: number | string;
  upi_amount?: number | string;
  bill_id?: string | null;
  payment_type?: string;
  [key: string]: unknown;
}

// GET / - List all customers
export async function listCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const { type, search } = req.query as { type?: string; search?: string };
    let sql = 'SELECT * FROM customers WHERE user_id = $1';
    const params: (string | number)[] = [userId];

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
export async function getCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const { id } = req.params;

    const [customers] = await pool.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [id, userId]);
    const customerList = customers as CustomerDbRow[];
    if (!customerList || customerList.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customer = customerList[0];

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
      [id, userId]
    );

    const summaryList = billsSummary as BillsSummaryDbRow[];

    res.json({
      success: true,
      data: {
        ...customer,
        bills_summary: summaryList && summaryList.length > 0 ? summaryList[0] : null
      }
    });
  } catch (err) {
    next(err);
  }
}

// POST / - Create customer
export async function createCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const { type, name, phone, email, address, credit_limit, credit_balance } = req.body;

    if (!type || !name) {
      return res.status(400).json({ success: false, error: 'Type and name are required' });
    }

    // Generate human-readable code (e.g. RC0001, RND0001)
    const prefix = type === 'regular' ? 'RC' : 'RND';
    const [maxRows] = await pool.query(
      `SELECT customer_code FROM customers WHERE type = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [type, userId]
    );

    const maxList = maxRows as Array<{ customer_code?: string }>;
    let nextNum = 1;
    if (maxList && maxList.length > 0 && maxList[0].customer_code) {
      const numPart = maxList[0].customer_code.replace(/[^0-9]/g, '');
      nextNum = parseInt(numPart || '0', 10) + 1;
    }

    const customerCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

    // Omit `id` so PostgreSQL assigns gen_random_uuid()
    const [insertedRows] = await pool.query(
      `INSERT INTO customers (user_id, type, name, phone, email, address, credit_limit, credit_balance, customer_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        userId,
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

    const insertedList = insertedRows as CustomerDbRow[];
    const newCustomer = Array.isArray(insertedList) && insertedList.length > 0 ? insertedList[0] : (insertedList as unknown as CustomerDbRow);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'CREATE', 'customer', newCustomer.id, JSON.stringify({ type, name, phone, email, address })]
    );

    res.status(201).json({ success: true, data: newCustomer });
  } catch (err) {
    next(err);
  }
}

// PUT /:id - Update customer
export async function updateCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const { id } = req.params;
    const {
      name,
      phone,
      email,
      address,
      credit_limit,
      creditLimit,
      credit_balance,
      creditBalance,
      advance_balance,
      advanceBalance
    } = req.body;

    const [existing] = await pool.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [id, userId]);
    const existingList = existing as CustomerDbRow[];
    if (!existingList || existingList.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const oldValue = existingList[0];

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    
    const limitVal = credit_limit !== undefined ? credit_limit : creditLimit;
    if (limitVal !== undefined) updates.credit_limit = Number(limitVal);

    const balVal = advance_balance !== undefined
      ? advance_balance
      : (advanceBalance !== undefined
        ? advanceBalance
        : (credit_balance !== undefined ? credit_balance : creditBalance));
    if (balVal !== undefined) {
      updates.credit_balance = Number(balVal);
      updates.advance_balance = Number(balVal);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const keys = Object.keys(updates);
    const setClauses = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id, userId);

    await pool.query(
      `UPDATE customers SET ${setClauses}, updated_at = NOW() WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}`,
      values
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'UPDATE', 'customer', id, JSON.stringify(oldValue), JSON.stringify(updates)]
    );

    const [updated] = await pool.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [id, userId]);
    const updatedList = updated as CustomerDbRow[];
    res.json({ success: true, data: updatedList[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /:id - Delete customer
export async function deleteCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [id, userId]);
    const existingList = existing as CustomerDbRow[];
    if (!existingList || existingList.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Check for unpaid bills
    const [unpaidBills] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bills WHERE customer_id = $1 AND user_id = $2 AND status != 'paid' AND deleted_at IS NULL`,
      [id, userId]
    );

    const unpaidList = unpaidBills as Array<{ cnt: number }>;
    const unpaidCount = Number(unpaidList?.[0]?.cnt || 0);

    if (unpaidCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete customer with ${unpaidCount} unpaid/partial bill(s). Settle all bills first.`
      });
    }

    await pool.query('DELETE FROM customers WHERE id = $1 AND user_id = $2', [id, userId]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value) VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'DELETE', 'customer', id, JSON.stringify(existingList[0])]
    );

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// GET /:id/bills - Get all bills for customer
export async function getCustomerBills(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const { id } = req.params;

    const [customer] = await pool.query('SELECT id FROM customers WHERE id = $1 AND user_id = $2', [id, userId]);
    const customerList = customer as Array<{ id: string }>;
    if (!customerList || customerList.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [bills] = await pool.query(
      'SELECT * FROM bills WHERE customer_id = $1 AND user_id = $2 AND deleted_at IS NULL ORDER BY date DESC',
      [id, userId]
    );

    const billsList = (bills || []) as CustomerBillDbRow[];
    if (billsList.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const billIds = billsList.map((b) => b.id);
    const [allItems] = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = ANY($1::uuid[]) AND user_id = $2',
      [billIds, userId]
    );
    const itemsList = (allItems || []) as CustomerBillItemDbRow[];
    const itemsMap: Record<string, CustomerBillItemDbRow[]> = {};
    itemsList.forEach((item) => {
      if (!itemsMap[item.bill_id]) {
        itemsMap[item.bill_id] = [];
      }
      itemsMap[item.bill_id].push(item);
    });
    billsList.forEach((bill) => {
      bill.items = itemsMap[bill.id] || [];
    });

    res.json({ success: true, data: billsList });
  } catch (err) {
    next(err);
  }
}

// GET /:id/payments - Get all payments for customer
export async function getCustomerPayments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const { id } = req.params;

    const [customer] = await pool.query('SELECT id FROM customers WHERE id = $1 AND user_id = $2', [id, userId]);
    const customerList = customer as Array<{ id: string }>;
    if (!customerList || customerList.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [payments] = await pool.query(
      `SELECT p.*, b.total AS bill_total
       FROM payments p
       LEFT JOIN bills b ON p.bill_id = b.id AND p.user_id = b.user_id
       WHERE p.customer_id = $1 AND p.user_id = $2
       ORDER BY p.date DESC`,
      [id, userId]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

// GET /:id/statement - Full statement (bills + payments timeline)
export async function getCustomerStatement(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const { id } = req.params;

    const [customer] = await pool.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [id, userId]);
    const customerList = customer as CustomerDbRow[];
    if (!customerList || customerList.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Get all bills
    const [bills] = await pool.query(
      `SELECT id, date, total, amount_paid, balance, status, 'bill' AS entry_type
       FROM bills WHERE customer_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId]
    );

    // Get all payments
    const [payments] = await pool.query(
      `SELECT id, date, total_paid, cash_amount, upi_amount, bill_id, payment_type, 'payment' AS entry_type
       FROM payments WHERE customer_id = $1 AND user_id = $2`,
      [id, userId]
    );

    const billsList = (bills || []) as StatementEntry[];
    const paymentsList = (payments || []) as StatementEntry[];

    // Combine and sort by date
    const timeline: StatementEntry[] = [
      ...billsList.map((b) => ({ ...b, sort_date: b.date ? new Date(b.date) : new Date(0) })),
      ...paymentsList.map((p) => ({ ...p, sort_date: p.date ? new Date(p.date) : new Date(0) }))
    ].sort((a, b) => {
      const timeA = a.sort_date ? a.sort_date.getTime() : 0;
      const timeB = b.sort_date ? b.sort_date.getTime() : 0;
      return timeA - timeB;
    });

    // Remove the sort helper
    timeline.forEach((entry) => {
      delete entry.sort_date;
    });

    res.json({
      success: true,
      data: {
        customer: customerList[0],
        statement: timeline
      }
    });
  } catch (err) {
    next(err);
  }
}
