const { getPool } = require('../config/db');

// GET / - List bills
async function listBills(req, res, next) {
  try {
    const pool = getPool();
    const { status, customer_id, date_from, date_to, deleted } = req.query;

    let sql = 'SELECT b.*, c.name AS customer_name FROM bills b LEFT JOIN customers c ON b.customer_id = c.id WHERE 1=1';
    const params = [];

    if (deleted === 'true') {
      sql += ' AND b.deleted_at IS NOT NULL';
    } else {
      sql += ' AND b.deleted_at IS NULL';
    }

    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }

    if (customer_id) {
      sql += ' AND b.customer_id = ?';
      params.push(customer_id);
    }

    if (date_from) {
      sql += ' AND b.date >= ?';
      params.push(date_from);
    }

    if (date_to) {
      sql += ' AND b.date <= ?';
      params.push(date_to);
    }

    sql += ' ORDER BY b.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /deleted - List soft-deleted bills
async function listDeletedBills(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT b.*, c.name AS customer_name
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.deleted_at IS NOT NULL
       ORDER BY b.deleted_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /:id - Get bill with items and payments
async function getBill(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [bills] = await pool.query(
      `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone
       FROM bills b LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ?`,
      [id]
    );

    if (bills.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const [items] = await pool.query('SELECT * FROM bill_items WHERE bill_id = ?', [id]);
    const [payments] = await pool.query('SELECT * FROM payments WHERE bill_id = ? ORDER BY date ASC', [id]);

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
async function createBill(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      customer_id, date, due_date, items,
      discount_type, discount_value, gst_percent, notes
    } = req.body;

    if (!customer_id || !date || !items || items.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, error: 'customer_id, date, and items are required' });
    }

    // Verify customer exists
    const [custRows] = await conn.query('SELECT * FROM customers WHERE id = ?', [customer_id]);
    if (custRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Generate bill ID
    const [maxBill] = await conn.query(
      `SELECT id FROM bills ORDER BY CAST(SUBSTRING_INDEX(id, '-', -1) AS UNSIGNED) DESC LIMIT 1`
    );

    let nextNum = 1;
    if (maxBill.length > 0) {
      const lastNum = parseInt(maxBill[0].id.split('-')[1], 10);
      nextNum = lastNum + 1;
    }
    const billId = `BILL-${String(nextNum).padStart(4, '0')}`;

    // Calculate subtotal from items
    let subtotal = 0;
    const billItems = items.map(item => {
      const amount = parseFloat(item.qty) * parseFloat(item.unit_price);
      subtotal += amount;
      return {
        bill_id: billId,
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
        'UPDATE customers SET credit_balance = credit_balance - ? WHERE id = ?',
        [creditUsed, customer_id]
      );
    }

    // Insert bill
    await conn.query(
      `INSERT INTO bills (id, customer_id, date, due_date, subtotal, discount_type, discount_value, gst_percent, gst_amount, total, amount_paid, balance, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [billId, customer_id, date, due_date || null, subtotal, discType, discVal, gstPct, gstAmount, total, amountPaid, balance, billStatus, notes || '']
    );

    // Insert bill items
    for (const item of billItems) {
      await conn.query(
        `INSERT INTO bill_items (bill_id, item_name, print_type, sides, qty, unit_price, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.bill_id, item.item_name, item.print_type, item.sides, item.qty, item.unit_price, item.amount]
      );
    }

    // If credit was used, create a payment record for it
    if (creditUsed > 0) {
      await conn.query(
        `INSERT INTO payments (bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [billId, customer_id, creditUsed, 0, creditUsed, balance <= 0 ? 'full' : 'partial', 'Auto-applied from credit balance']
      );
    }

    // Audit log
    await conn.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, new_value) VALUES (?, ?, ?, ?)`,
      ['CREATE', 'bill', billId, JSON.stringify({ customer_id, total, items: billItems.length, credit_applied: creditUsed })]
    );

    await conn.commit();
    conn.release();

    // Fetch the created bill
    const [newBill] = await pool.query(
      `SELECT b.*, c.name AS customer_name FROM bills b LEFT JOIN customers c ON b.customer_id = c.id WHERE b.id = ?`,
      [billId]
    );
    const [newItems] = await pool.query('SELECT * FROM bill_items WHERE bill_id = ?', [billId]);

    res.status(201).json({
      success: true,
      data: { ...newBill[0], items: newItems, credit_applied: creditUsed }
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    next(err);
  }
}

// PUT /:id - Update bill
async function updateBill(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const {
      customer_id, date, due_date, items,
      discount_type, discount_value, gst_percent, notes
    } = req.body;

    const [existing] = await conn.query('SELECT * FROM bills WHERE id = ? AND deleted_at IS NULL', [id]);
    if (existing.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const oldBill = existing[0];
    const [oldItems] = await conn.query('SELECT * FROM bill_items WHERE bill_id = ?', [id]);

    // Update basic fields
    const updatedCustomerId = customer_id || oldBill.customer_id;
    const updatedDate = date || oldBill.date;
    const updatedDueDate = due_date !== undefined ? (due_date || null) : oldBill.due_date;
    const updatedNotes = notes !== undefined ? notes : oldBill.notes;

    let subtotal = oldBill.subtotal;
    const discType = discount_type || oldBill.discount_type;
    const discVal = discount_value !== undefined ? parseFloat(discount_value) : parseFloat(oldBill.discount_value);
    const gstPct = gst_percent !== undefined ? parseFloat(gst_percent) : parseFloat(oldBill.gst_percent);

    // If items are provided, recalculate
    if (items && items.length > 0) {
      // Delete old items
      await conn.query('DELETE FROM bill_items WHERE bill_id = ?', [id]);

      subtotal = 0;
      for (const item of items) {
        const amount = parseFloat((item.qty * item.unit_price).toFixed(2));
        subtotal += amount;
        await conn.query(
          `INSERT INTO bill_items (bill_id, item_name, print_type, sides, qty, unit_price, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, item.item_name, item.print_type, item.sides, item.qty, item.unit_price, amount]
        );
      }
      subtotal = parseFloat(subtotal.toFixed(2));
    }

    // Recalculate totals
    let discountAmount = 0;
    if (discType === 'percent') {
      discountAmount = parseFloat(((subtotal * discVal) / 100).toFixed(2));
    } else {
      discountAmount = discVal;
    }

    const afterDiscount = parseFloat((subtotal - discountAmount).toFixed(2));
    const gstAmount = parseFloat(((afterDiscount * gstPct) / 100).toFixed(2));
    const total = parseFloat((afterDiscount + gstAmount).toFixed(2));
    const balance = parseFloat((total - parseFloat(oldBill.amount_paid)).toFixed(2));

    let status = 'unpaid';
    if (balance <= 0) status = 'paid';
    else if (parseFloat(oldBill.amount_paid) > 0) status = 'partial';

    await conn.query(
      `UPDATE bills SET customer_id = ?, date = ?, due_date = ?, subtotal = ?, discount_type = ?,
       discount_value = ?, gst_percent = ?, gst_amount = ?, total = ?, balance = ?, status = ?, notes = ?
       WHERE id = ?`,
      [updatedCustomerId, updatedDate, updatedDueDate, subtotal, discType, discVal, gstPct, gstAmount, total, Math.max(0, balance), status, updatedNotes, id]
    );

    // Audit log
    await conn.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?)`,
      ['UPDATE', 'bill', id, JSON.stringify({ ...oldBill, items: oldItems }), JSON.stringify({ total, balance, status })]
    );

    await conn.commit();
    conn.release();

    // Fetch updated bill
    const [updatedBill] = await pool.query(
      `SELECT b.*, c.name AS customer_name FROM bills b LEFT JOIN customers c ON b.customer_id = c.id WHERE b.id = ?`,
      [id]
    );
    const [updatedItems] = await pool.query('SELECT * FROM bill_items WHERE bill_id = ?', [id]);

    res.json({ success: true, data: { ...updatedBill[0], items: updatedItems } });
  } catch (err) {
    await conn.rollback();
    conn.release();
    next(err);
  }
}

// DELETE /:id - Soft delete
async function deleteBill(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM bills WHERE id = ? AND deleted_at IS NULL', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    await pool.query('UPDATE bills SET deleted_at = NOW() WHERE id = ?', [id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, old_value) VALUES (?, ?, ?, ?)`,
      ['DELETE', 'bill', id, JSON.stringify(existing[0])]
    );

    res.json({ success: true, message: 'Bill soft-deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// POST /:id/restore - Restore deleted bill
async function restoreBill(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM bills WHERE id = ? AND deleted_at IS NOT NULL', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Deleted bill not found' });
    }

    await pool.query('UPDATE bills SET deleted_at = NULL WHERE id = ?', [id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, new_value) VALUES (?, ?, ?, ?)`,
      ['RESTORE', 'bill', id, JSON.stringify({ restored: true })]
    );

    const [restored] = await pool.query('SELECT * FROM bills WHERE id = ?', [id]);
    res.json({ success: true, data: restored[0] });
  } catch (err) {
    next(err);
  }
}

// POST /:id/discount - Apply discount after bill creation
async function applyDiscount(req, res, next) {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { discount_type, discount_value } = req.body;

    if (!discount_type || discount_value === undefined) {
      return res.status(400).json({ success: false, error: 'discount_type and discount_value are required' });
    }

    const [existing] = await pool.query('SELECT * FROM bills WHERE id = ? AND deleted_at IS NULL', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const bill = existing[0];
    const subtotal = parseFloat(bill.subtotal);
    const discVal = parseFloat(discount_value);

    let discountAmount = 0;
    if (discount_type === 'percent') {
      discountAmount = parseFloat(((subtotal * discVal) / 100).toFixed(2));
    } else {
      discountAmount = discVal;
    }

    const afterDiscount = parseFloat((subtotal - discountAmount).toFixed(2));
    const gstPct = parseFloat(bill.gst_percent);
    const gstAmount = parseFloat(((afterDiscount * gstPct) / 100).toFixed(2));
    const total = parseFloat((afterDiscount + gstAmount).toFixed(2));
    const balance = parseFloat((total - parseFloat(bill.amount_paid)).toFixed(2));

    let status = 'unpaid';
    if (balance <= 0) status = 'paid';
    else if (parseFloat(bill.amount_paid) > 0) status = 'partial';

    await pool.query(
      `UPDATE bills SET discount_type = ?, discount_value = ?, gst_amount = ?, total = ?, balance = ?, status = ? WHERE id = ?`,
      [discount_type, discVal, gstAmount, total, Math.max(0, balance), status, id]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?)`,
      ['UPDATE', 'bill', id,
        JSON.stringify({ discount_type: bill.discount_type, discount_value: bill.discount_value, total: bill.total }),
        JSON.stringify({ discount_type, discount_value: discVal, total, balance })
      ]
    );

    const [updated] = await pool.query('SELECT * FROM bills WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBills,
  listDeletedBills,
  getBill,
  createBill,
  updateBill,
  deleteBill,
  restoreBill,
  applyDiscount
};
