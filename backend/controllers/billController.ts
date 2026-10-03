import { Response, NextFunction } from 'express';
import { getPool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

interface BillItemInput {
  item_name?: string;
  name?: string;
  print_type?: string;
  printType?: string;
  sides?: string;
  qty?: number | string;
  unit_price?: number | string;
  unitPrice?: number | string;
  amount?: number | string;
}

interface BillItemDbRow {
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

interface BillDbRow {
  id: string;
  user_id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  invoice_number: string;
  subtotal: number | string;
  amount_paid: number | string;
  balance: number | string;
  total: number | string;
  status: string;
  items?: BillItemDbRow[];
  [key: string]: unknown;
}

// GET / - List bills
export async function listBills(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const { status, customer_id, date_from, date_to, deleted } = req.query;

    let sql = 'SELECT b.*, c.name AS customer_name FROM bills b LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id WHERE b.user_id = $1';
    const params: (string | number | boolean | null)[] = [userId];

    if (deleted === 'true') {
      sql += ' AND b.deleted_at IS NOT NULL';
    } else {
      sql += ' AND b.deleted_at IS NULL';
    }

    if (status) {
      params.push(status as string);
      sql += ` AND b.status = $${params.length}`;
    }

    if (customer_id) {
      params.push(customer_id as string);
      sql += ` AND b.customer_id = $${params.length}`;
    }

    if (date_from) {
      params.push(date_from as string);
      sql += ` AND b.date >= $${params.length}`;
    }

    if (date_to) {
      params.push(date_to as string);
      sql += ` AND b.date <= $${params.length}`;
    }

    sql += ' ORDER BY b.created_at DESC';

    const [rows] = (await pool.query(sql, params)) as [BillDbRow[], unknown];
    
    // Fetch and map associated bill items
    if (rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const billIds = rows.map((b) => b.id);
    const [allItems] = (await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = ANY($1::uuid[]) AND user_id = $2',
      [billIds, userId]
    )) as [BillItemDbRow[], unknown];

    const itemsMap: Record<string, BillItemDbRow[]> = {};
    allItems.forEach((item) => {
      if (!itemsMap[item.bill_id]) {
        itemsMap[item.bill_id] = [];
      }
      itemsMap[item.bill_id].push(item);
    });
    rows.forEach((bill) => {
      bill.items = itemsMap[bill.id] || [];
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /deleted - List soft-deleted bills
export async function listDeletedBills(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const [rows] = (await pool.query(
      `SELECT b.*, c.name AS customer_name
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.user_id = $1 AND b.deleted_at IS NOT NULL
       ORDER BY b.deleted_at DESC`,
      [userId]
    )) as [BillDbRow[], unknown];

    if (rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const billIds = rows.map((b) => b.id);
    const [allItems] = (await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = ANY($1::uuid[]) AND user_id = $2',
      [billIds, userId]
    )) as [BillItemDbRow[], unknown];

    const itemsMap: Record<string, BillItemDbRow[]> = {};
    allItems.forEach((item) => {
      if (!itemsMap[item.bill_id]) {
        itemsMap[item.bill_id] = [];
      }
      itemsMap[item.bill_id].push(item);
    });
    rows.forEach((bill) => {
      bill.items = itemsMap[bill.id] || [];
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /:id - Get bill with items and payments
export async function getBill(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const id = req.params.id as string;

    const [bills] = (await pool.query(
      `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.id = $1 AND b.user_id = $2`,
      [id, userId]
    )) as [BillDbRow[], unknown];

    if (bills.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const [items] = await pool.query('SELECT * FROM bill_items WHERE bill_id = $1 AND user_id = $2', [id, userId]);
    const [payments] = await pool.query('SELECT * FROM payments WHERE bill_id = $1 AND user_id = $2 ORDER BY date ASC', [id, userId]);

    res.json({
      success: true,
      data: {
        ...bills[0],
        items,
        payments
      }
    });
  } catch (err) {
    next(err);
  }
}

// POST / - Create bill with items
export async function createBill(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const userId = req.user!.id;

    const {
      customer_id, date, due_date, items,
      discount_type, discount_value, gst_percent, notes,
      cash_amount, cashAmount, upi_amount, upiAmount,
      advance_used, advanceUsed
    } = req.body;

    if (!date || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'date and items are required' });
    }

    // Resolve customer (support UUID, Walk-in, or auto-provisioning)
    let resolvedCustId = customer_id;
    let custRows: Record<string, unknown>[] = [];
    const isUuid = typeof customer_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customer_id);

    if (isUuid) {
      const [rows] = (await conn.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [customer_id, userId])) as [Record<string, unknown>[], unknown];
      custRows = rows;
    }

    if (!custRows || custRows.length === 0) {
      const [walkInRows] = (await conn.query(
        "SELECT * FROM customers WHERE user_id = $1 AND (type = 'random' OR LOWER(name) = 'walk-in customer') ORDER BY created_at ASC LIMIT 1",
        [userId]
      )) as [Record<string, unknown>[], unknown];
      if (walkInRows && walkInRows.length > 0) {
        custRows = walkInRows;
        resolvedCustId = walkInRows[0].id as string;
      } else {
        const [insertedWalkIn] = (await conn.query(
          "INSERT INTO customers (user_id, type, name, phone, email, address, credit_limit, credit_balance, customer_code) VALUES ($1, 'random', 'Walk-in Customer', '', '', '', 0, 0, 'RND0001') RETURNING *",
          [userId]
        )) as [Record<string, unknown>[], unknown];
        custRows = insertedWalkIn;
        resolvedCustId = insertedWalkIn[0].id as string;
      }
    }

    // Enforce tenant-scoped transaction concurrency lock to eliminate sequential invoice collision race conditions
    await conn.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [userId]);

    // Generate human-readable invoice_number (e.g. BILL0001)
    const [maxBill] = (await conn.query(
      `SELECT invoice_number FROM bills WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    )) as [{ invoice_number?: string }[], unknown];

    let nextNum = 1;
    if (maxBill.length > 0 && maxBill[0].invoice_number) {
      const numPart = maxBill[0].invoice_number.replace(/[^0-9]/g, '');
      nextNum = parseInt(numPart || '0', 10) + 1;
    }
    const invoiceNumber = `BILL${String(nextNum).padStart(4, '0')}`;

    // Calculate subtotal from items
    let subtotal = 0;
    const billItems = (items as BillItemInput[]).map((item) => {
      const amount = parseFloat(String(item.qty || 1)) * parseFloat(String(item.unit_price || item.unitPrice || 0));
      subtotal += amount;
      return {
        item_name: item.item_name || item.name || 'Print Item',
        print_type: item.print_type || item.printType || 'color',
        sides: item.sides || 'single',
        qty: item.qty || 1,
        unit_price: item.unit_price || item.unitPrice || 0,
        amount: parseFloat(amount.toFixed(2))
      };
    });

    subtotal = parseFloat(subtotal.toFixed(2));

    // Apply discount
    const discType = discount_type || 'flat';
    const discVal = parseFloat(discount_value) || 0;
    let discountAmount = 0;
    if (discType === 'percent') {
      discountAmount = parseFloat(((subtotal * discVal) / 100).toFixed(2));
    } else {
      discountAmount = discVal;
    }

    const afterDiscount = parseFloat((subtotal - discountAmount).toFixed(2));

    // Apply GST
    const gstPct = parseFloat(gst_percent) || 0;
    const gstAmount = parseFloat(((afterDiscount * gstPct) / 100).toFixed(2));
    const total = parseFloat((afterDiscount + gstAmount).toFixed(2));

    let balance = total;
    let amountPaid = 0;
    let billStatus = 'unpaid';

    const customer = custRows[0];
    const customerCredit = parseFloat(String(customer?.credit_balance || '0'));
    
    // Explicit or auto-applied advance balance
    const explicitAdvance = advance_used !== undefined ? parseFloat(advance_used) : (advanceUsed !== undefined ? parseFloat(advanceUsed) : null);
    let creditUsed = 0;
    if (explicitAdvance !== null) {
      creditUsed = Math.min(Math.max(0, explicitAdvance), customerCredit, total);
    } else if (customerCredit > 0) {
      creditUsed = Math.min(customerCredit, total);
    }

    if (creditUsed > 0) {
      await conn.query(
        'UPDATE customers SET credit_balance = credit_balance - $1 WHERE id = $2 AND user_id = $3',
        [creditUsed, resolvedCustId, userId]
      );
    }

    const rawCash = parseFloat(cash_amount !== undefined ? cash_amount : (cashAmount || 0)) || 0;
    const rawUpi = parseFloat(upi_amount !== undefined ? upi_amount : (upiAmount || 0)) || 0;
    const directPaid = rawCash + rawUpi;

    amountPaid = parseFloat((creditUsed + directPaid).toFixed(2));
    balance = parseFloat(Math.max(0, total - amountPaid).toFixed(2));
    billStatus = balance <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid');

    // Insert bill (omitting id so gen_random_uuid() is assigned automatically)
    const [insertedBills] = (await conn.query(
      `INSERT INTO bills (user_id, customer_id, date, due_date, subtotal, discount_type, discount_value, gst_percent, gst_amount, total, amount_paid, balance, status, notes, invoice_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [userId, resolvedCustId, date, due_date || null, subtotal, discType, discVal, gstPct, gstAmount, total, amountPaid, balance, billStatus, notes || '', invoiceNumber]
    )) as [BillDbRow[], unknown];

    const createdBill = insertedBills && insertedBills.length > 0 ? insertedBills[0] : (insertedBills as unknown as BillDbRow);

    // Insert bill items
    for (const item of billItems) {
      await conn.query(
        `INSERT INTO bill_items (user_id, bill_id, item_name, print_type, sides, qty, unit_price, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, createdBill.id, item.item_name, item.print_type, item.sides, item.qty, item.unit_price, item.amount]
      );
    }

    // If credit was used, create a payment record for it
    if (creditUsed > 0) {
      await conn.query(
        `INSERT INTO payments (user_id, bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, createdBill.id, resolvedCustId, 0, 0, creditUsed, balance <= 0 ? 'full' : 'partial', 'Advance Balance applied']
      );
    }

    // If direct Cash or UPI was paid, create a payment record for it
    if (directPaid > 0) {
      await conn.query(
        `INSERT INTO payments (user_id, bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, createdBill.id, resolvedCustId, rawCash, rawUpi, directPaid, balance <= 0 ? 'full' : 'partial', 'Upfront POS bill payment']
      );
    }

    // Audit log
    await conn.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'CREATE', 'bill', createdBill.id, JSON.stringify({ customer_id: resolvedCustId, total, items: billItems.length, credit_applied: creditUsed, direct_paid: directPaid })]
    );

    await conn.commit();

    // Fetch the created bill
    const [newBill] = await pool.query(
      `SELECT b.*, c.name AS customer_name FROM bills b LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id WHERE b.id = $1 AND b.user_id = $2`,
      [createdBill.id, userId]
    );

    res.status(201).json({ success: true, data: (newBill as BillDbRow[])[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// PUT /:id - Update bill
export async function updateBill(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const userId = req.user!.id;
    const id = req.params.id as string;
    const {
      customer_id,
      customerId,
      date,
      due_date,
      dueDate,
      subtotal,
      discount_type,
      discountType,
      discount_value,
      discountValue,
      gst_percent,
      gstPercent,
      gst_amount,
      gstAmount,
      total,
      amount_paid,
      amountPaid,
      balance,
      status,
      notes,
      items
    } = req.body;

    const [existing] = (await conn.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, userId])) as [BillDbRow[], unknown];
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const updates: Record<string, string | number | null> = {};
    const finalCustId = customer_id !== undefined ? customer_id : customerId;
    if (finalCustId !== undefined) updates.customer_id = finalCustId;
    if (date !== undefined) updates.date = date;
    const finalDueDate = due_date !== undefined ? due_date : dueDate;
    if (finalDueDate !== undefined) updates.due_date = finalDueDate;
    if (subtotal !== undefined) updates.subtotal = parseFloat(subtotal) || 0;
    const finalDiscType = discount_type !== undefined ? discount_type : discountType;
    if (finalDiscType !== undefined) updates.discount_type = finalDiscType;
    const finalDiscVal = discount_value !== undefined ? discount_value : discountValue;
    if (finalDiscVal !== undefined) updates.discount_value = parseFloat(finalDiscVal) || 0;
    const finalGstPct = gst_percent !== undefined ? gst_percent : gstPercent;
    if (finalGstPct !== undefined) updates.gst_percent = parseFloat(finalGstPct) || 0;
    const finalGstAmt = gst_amount !== undefined ? gst_amount : gstAmount;
    if (finalGstAmt !== undefined) updates.gst_amount = parseFloat(finalGstAmt) || 0;
    if (total !== undefined) updates.total = parseFloat(total) || 0;
    const finalAmtPaid = amount_paid !== undefined ? amount_paid : amountPaid;
    if (finalAmtPaid !== undefined) updates.amount_paid = parseFloat(finalAmtPaid) || 0;
    if (balance !== undefined) updates.balance = parseFloat(balance) || 0;
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length > 0) {
      const keys = Object.keys(updates);
      const setClauses = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
      const values: (string | number | null)[] = Object.values(updates);
      values.push(id, userId);

      await conn.query(
        `UPDATE bills SET ${setClauses}, updated_at = NOW() WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}`,
        values
      );
    }

    // If items are provided, replace bill_items
    if (Array.isArray(items) && items.length > 0) {
      await conn.query('DELETE FROM bill_items WHERE bill_id = $1 AND user_id = $2', [id, userId]);
      for (const item of items as BillItemInput[]) {
        const uPrice = parseFloat(String(item.unit_price || item.unitPrice || 0)) || 0;
        const q = parseFloat(String(item.qty || 1)) || 1;
        const amt = parseFloat((item.amount !== undefined ? parseFloat(String(item.amount)) : q * uPrice).toFixed(2));
        await conn.query(
          `INSERT INTO bill_items (user_id, bill_id, item_name, print_type, sides, qty, unit_price, amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [userId, id, item.item_name || item.name || 'Print Item', item.print_type || item.printType || 'color', item.sides || 'single', q, uPrice, amt]
        );
      }
    }

    // Audit log
    await conn.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'UPDATE', 'bill', id, JSON.stringify(existing[0]), JSON.stringify({ ...updates, items: items?.length })]
    );

    await conn.commit();

    const [updated] = (await pool.query(
      `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.id = $1 AND b.user_id = $2`,
      [id, userId]
    )) as [BillDbRow[], unknown];
    const [updatedItems] = await pool.query('SELECT * FROM bill_items WHERE bill_id = $1 AND user_id = $2', [id, userId]);

    res.json({
      success: true,
      data: {
        ...updated[0],
        items: updatedItems
      }
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// DELETE /:id - Soft-delete bill
export async function deleteBill(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const id = req.params.id as string;

    const [existing] = (await pool.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, userId])) as [BillDbRow[], unknown];
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    await pool.query(
      'UPDATE bills SET deleted_at = NOW() WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value) VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'DELETE', 'bill', id, JSON.stringify(existing[0])]
    );

    res.json({ success: true, message: 'Bill deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// POST /:id/restore - Restore soft-deleted bill
export async function restoreBill(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const id = req.params.id as string;

    const [existing] = (await pool.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL', [id, userId])) as [BillDbRow[], unknown];
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Soft-deleted bill not found' });
    }

    await pool.query(
      'UPDATE bills SET deleted_at = NULL WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'RESTORE', 'bill', id, JSON.stringify({ restored_at: new Date().toISOString() })]
    );

    const [restored] = (await pool.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2', [id, userId])) as [BillDbRow[], unknown];
    res.json({ success: true, data: restored[0] });
  } catch (err) {
    next(err);
  }
}

// POST /:id/discount - Apply post-bill discount
export async function applyDiscount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const id = req.params.id as string;
    const { discount_type, discount_value } = req.body;

    const [existing] = (await pool.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, userId])) as [BillDbRow[], unknown];
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const bill = existing[0];
    const subtotal = parseFloat(String(bill.subtotal || 0));
    const discType = discount_type || 'flat';
    const discVal = parseFloat(discount_value) || 0;

    let discountAmount = 0;
    if (discType === 'percent') {
      discountAmount = parseFloat(((subtotal * discVal) / 100).toFixed(2));
    } else {
      discountAmount = discVal;
    }

    const newTotal = parseFloat(Math.max(subtotal - discountAmount, 0).toFixed(2));
    const amountPaid = parseFloat(String(bill.amount_paid || 0));
    const newBalance = parseFloat(Math.max(newTotal - amountPaid, 0).toFixed(2));
    const newStatus = amountPaid >= newTotal ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

    await pool.query(
      `UPDATE bills SET discount_type = $1, discount_value = $2, total = $3, balance = $4, status = $5, updated_at = NOW() WHERE id = $6 AND user_id = $7`,
      [discType, discVal, newTotal, newBalance, newStatus, id, userId]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'DISCOUNT', 'bill', id, JSON.stringify(bill), JSON.stringify({ discount_type: discType, discount_value: discVal, new_total: newTotal, new_balance: newBalance })]
    );

    const [updated] = (await pool.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2', [id, userId])) as [BillDbRow[], unknown];
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
}
