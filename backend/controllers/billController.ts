import { getPool } from '../config/db';

// GET / - List bills
export async function listBills(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { status, customer_id, date_from, date_to, deleted } = req.query;

    let sql = 'SELECT b.*, c.name AS customer_name FROM bills b LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id WHERE b.user_id = $1';
    const params: any[] = [req.user.id];

    if (deleted === 'true') {
      sql += ' AND b.deleted_at IS NOT NULL';
    } else {
      sql += ' AND b.deleted_at IS NULL';
    }

    if (status) {
      params.push(status);
      sql += ` AND b.status = $${params.length}`;
    }

    if (customer_id) {
      params.push(customer_id);
      sql += ` AND b.customer_id = $${params.length}`;
    }

    if (date_from) {
      params.push(date_from);
      sql += ` AND b.date >= $${params.length}`;
    }

    if (date_to) {
      params.push(date_to);
      sql += ` AND b.date <= $${params.length}`;
    }

    sql += ' ORDER BY b.created_at DESC';

    const [rows] = await pool.query(sql, params);
    
    // Fetch and map associated bill items
    if (rows.length > 0) {
      const [allItems] = await pool.query('SELECT * FROM bill_items WHERE user_id = $1', [req.user.id]);
      const itemsMap: Record<string, any[]> = {};
      allItems.forEach((item: any) => {
        if (!itemsMap[item.bill_id]) {
          itemsMap[item.bill_id] = [];
        }
        itemsMap[item.bill_id].push(item);
      });
      rows.forEach((bill: any) => {
        bill.items = itemsMap[bill.id] || [];
      });
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /deleted - List soft-deleted bills
export async function listDeletedBills(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT b.*, c.name AS customer_name
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.user_id = $1 AND b.deleted_at IS NOT NULL
       ORDER BY b.deleted_at DESC`,
      [req.user.id]
    );

    if (rows.length > 0) {
      const [allItems] = await pool.query('SELECT * FROM bill_items WHERE user_id = $1', [req.user.id]);
      const itemsMap: Record<string, any[]> = {};
      allItems.forEach((item: any) => {
        if (!itemsMap[item.bill_id]) {
          itemsMap[item.bill_id] = [];
        }
        itemsMap[item.bill_id].push(item);
      });
      rows.forEach((bill: any) => {
        bill.items = itemsMap[bill.id] || [];
      });
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /:id - Get bill with items and payments
export async function getBill(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [bills] = await pool.query(
      `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.id = $1 AND b.user_id = $2`,
      [id, req.user.id]
    );

    if (bills.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const [items] = await pool.query('SELECT * FROM bill_items WHERE bill_id = $1 AND user_id = $2', [id, req.user.id]);
    const [payments] = await pool.query('SELECT * FROM payments WHERE bill_id = $1 AND user_id = $2 ORDER BY date ASC', [id, req.user.id]);

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
export async function createBill(req: any, res: any, next: any) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      customer_id, date, due_date, items,
      discount_type, discount_value, gst_percent, notes
    } = req.body;

    if (!customer_id || !date || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'customer_id, date, and items are required' });
    }

    // Verify customer exists
    const [custRows] = await conn.query('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [customer_id, req.user.id]);
    if (custRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Generate human-readable invoice_number (e.g. BILL0001)
    const [maxBill] = await conn.query(
      `SELECT invoice_number FROM bills WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    let nextNum = 1;
    if (maxBill.length > 0 && maxBill[0].invoice_number) {
      const numPart = maxBill[0].invoice_number.replace(/[^0-9]/g, '');
      nextNum = parseInt(numPart || '0', 10) + 1;
    }
    const invoiceNumber = `BILL${String(nextNum).padStart(4, '0')}`;

    // Calculate subtotal from items
    let subtotal = 0;
    const billItems = items.map((item: any) => {
      const amount = parseFloat(item.qty) * parseFloat(item.unit_price);
      subtotal += amount;
      return {
        item_name: item.item_name,
        print_type: item.print_type,
        sides: item.sides,
        qty: item.qty,
        unit_price: item.unit_price,
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

    // Auto-apply customer credit balance
    const customer = custRows[0];
    let creditUsed = 0;
    if (customer.credit_balance > 0) {
      creditUsed = Math.min(parseFloat(customer.credit_balance), balance);
      amountPaid = parseFloat(creditUsed.toFixed(2));
      balance = parseFloat((balance - creditUsed).toFixed(2));

      if (balance <= 0) {
        billStatus = 'paid';
        balance = 0;
      } else {
        billStatus = 'partial';
      }

      // Reduce customer credit balance
      await conn.query(
        'UPDATE customers SET credit_balance = credit_balance - $1 WHERE id = $2 AND user_id = $3',
        [creditUsed, customer_id, req.user.id]
      );
    }

    // Insert bill (omitting id so gen_random_uuid() is assigned automatically)
    const [insertedBills] = await conn.query(
      `INSERT INTO bills (user_id, customer_id, date, due_date, subtotal, discount_type, discount_value, gst_percent, gst_amount, total, amount_paid, balance, status, notes, invoice_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [req.user.id, customer_id, date, due_date || null, subtotal, discType, discVal, gstPct, gstAmount, total, amountPaid, balance, billStatus, notes || '', invoiceNumber]
    );

    const createdBill = insertedBills && insertedBills.length > 0 ? insertedBills[0] : insertedBills;

    // Insert bill items
    for (const item of billItems) {
      await conn.query(
        `INSERT INTO bill_items (user_id, bill_id, item_name, print_type, sides, qty, unit_price, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [req.user.id, createdBill.id, item.item_name, item.print_type, item.sides, item.qty, item.unit_price, item.amount]
      );
    }

    // If credit was used, create a payment record for it
    if (creditUsed > 0) {
      await conn.query(
        `INSERT INTO payments (user_id, bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [req.user.id, createdBill.id, customer_id, creditUsed, 0, creditUsed, balance <= 0 ? 'full' : 'partial', 'Auto-applied from credit balance']
      );
    }

    // Audit log
    await conn.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'CREATE', 'bill', createdBill.id, JSON.stringify({ customer_id, total, items: billItems.length, credit_applied: creditUsed })]
    );

    await conn.commit();

    // Fetch the created bill
    const [newBill] = await pool.query(
      `SELECT b.*, c.name AS customer_name FROM bills b LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id WHERE b.id = $1 AND b.user_id = $2`,
      [createdBill.id, req.user.id]
    );

    res.status(201).json({ success: true, data: newBill[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// PUT /:id - Update bill
export async function updateBill(req: any, res: any, next: any) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const {
      customer_id,
      date,
      due_date,
      subtotal,
      discount_type,
      discount_value,
      gst_percent,
      gst_amount,
      total,
      amount_paid,
      balance,
      status,
      notes,
      items
    } = req.body;

    const [existing] = await conn.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, req.user.id]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const updates: Record<string, any> = {};
    if (customer_id !== undefined) updates.customer_id = customer_id;
    if (date !== undefined) updates.date = date;
    if (due_date !== undefined) updates.due_date = due_date;
    if (subtotal !== undefined) updates.subtotal = parseFloat(subtotal) || 0;
    if (discount_type !== undefined) updates.discount_type = discount_type;
    if (discount_value !== undefined) updates.discount_value = parseFloat(discount_value) || 0;
    if (gst_percent !== undefined) updates.gst_percent = parseFloat(gst_percent) || 0;
    if (gst_amount !== undefined) updates.gst_amount = parseFloat(gst_amount) || 0;
    if (total !== undefined) updates.total = parseFloat(total) || 0;
    if (amount_paid !== undefined) updates.amount_paid = parseFloat(amount_paid) || 0;
    if (balance !== undefined) updates.balance = parseFloat(balance) || 0;
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length > 0) {
      const keys = Object.keys(updates);
      const setClauses = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
      const values = Object.values(updates);
      values.push(id, req.user.id);

      await conn.query(
        `UPDATE bills SET ${setClauses}, updated_at = NOW() WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}`,
        values
      );
    }

    // If items are provided, replace bill_items
    if (Array.isArray(items) && items.length > 0) {
      await conn.query('DELETE FROM bill_items WHERE bill_id = $1 AND user_id = $2', [id, req.user.id]);
      for (const item of items) {
        const uPrice = parseFloat(item.unit_price) || 0;
        const q = parseFloat(item.qty) || 1;
        const amt = parseFloat((item.amount !== undefined ? parseFloat(item.amount) : q * uPrice).toFixed(2));
        await conn.query(
          `INSERT INTO bill_items (user_id, bill_id, item_name, print_type, sides, qty, unit_price, amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [req.user.id, id, item.item_name || item.name || 'Print Item', item.print_type || 'color', item.sides || 'single', q, uPrice, amt]
        );
      }
    }

    // Audit log
    await conn.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'UPDATE', 'bill', id, JSON.stringify(existing[0]), JSON.stringify({ ...updates, items: items?.length })]
    );

    await conn.commit();

    const [updated] = await pool.query(
      `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id AND b.user_id = c.user_id
       WHERE b.id = $1 AND b.user_id = $2`,
      [id, req.user.id]
    );
    const [updatedItems] = await pool.query('SELECT * FROM bill_items WHERE bill_id = $1 AND user_id = $2', [id, req.user.id]);

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
export async function deleteBill(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    await pool.query(
      'UPDATE bills SET deleted_at = NOW() WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'DELETE', 'bill', id, JSON.stringify(existing[0])]
    );

    res.json({ success: true, message: 'Bill deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// POST /:id/restore - Restore soft-deleted bill
export async function restoreBill(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Soft-deleted bill not found' });
    }

    await pool.query(
      'UPDATE bills SET deleted_at = NULL WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'RESTORE', 'bill', id, JSON.stringify({ restored_at: new Date().toISOString() })]
    );

    const [restored] = await pool.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true, data: restored[0] });
  } catch (err) {
    next(err);
  }
}

// POST /:id/discount - Apply post-bill discount
export async function applyDiscount(req: any, res: any, next: any) {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { discount_type, discount_value } = req.body;

    const [existing] = await pool.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const bill = existing[0];
    const subtotal = parseFloat(bill.subtotal || 0);
    const discType = discount_type || 'flat';
    const discVal = parseFloat(discount_value) || 0;

    let discountAmount = 0;
    if (discType === 'percent') {
      discountAmount = parseFloat(((subtotal * discVal) / 100).toFixed(2));
    } else {
      discountAmount = discVal;
    }

    const newTotal = parseFloat(Math.max(subtotal - discountAmount, 0).toFixed(2));
    const amountPaid = parseFloat(bill.amount_paid || 0);
    const newBalance = parseFloat(Math.max(newTotal - amountPaid, 0).toFixed(2));
    const newStatus = amountPaid >= newTotal ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

    await pool.query(
      `UPDATE bills SET discount_type = $1, discount_value = $2, total = $3, balance = $4, status = $5, updated_at = NOW() WHERE id = $6 AND user_id = $7`,
      [discType, discVal, newTotal, newBalance, newStatus, id, req.user.id]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'DISCOUNT', 'bill', id, JSON.stringify(bill), JSON.stringify({ discount_type: discType, discount_value: discVal, new_total: newTotal, new_balance: newBalance })]
    );

    const [updated] = await pool.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
}
