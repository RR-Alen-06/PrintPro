const { getPool } = require('../config/db');

// GET /bill/:billId or /api/bills/:id/payments - Get payments for a bill
async function getPaymentsForBill(req, res, next) {
  try {
    const pool = getPool();
    const billId = req.params.billId || req.params.id;

    const [bill] = await pool.query('SELECT id FROM bills WHERE id = ?', [billId]);
    if (bill.length === 0) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const [payments] = await pool.query(
      'SELECT * FROM payments WHERE bill_id = ? ORDER BY date ASC',
      [billId]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

// POST / - Record payment
async function recordPayment(req, res, next) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { bill_id, cash_amount, upi_amount, notes } = req.body;

    if (!bill_id) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, error: 'bill_id is required' });
    }

    const cashAmt = parseFloat(cash_amount) || 0;
    const upiAmt = parseFloat(upi_amount) || 0;
    const totalPaid = parseFloat((cashAmt + upiAmt).toFixed(2));

    if (totalPaid <= 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    // Get the bill
    const [bills] = await conn.query('SELECT * FROM bills WHERE id = ? AND deleted_at IS NULL', [bill_id]);
    if (bills.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const bill = bills[0];

    if (bill.status === 'paid') {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, error: 'Bill is already fully paid' });
    }

    const currentBalance = parseFloat(bill.balance);
    let newAmountPaid = parseFloat((parseFloat(bill.amount_paid) + totalPaid).toFixed(2));
    let newBalance = parseFloat((currentBalance - totalPaid).toFixed(2));
    let newStatus = 'partial';
    let excessAmount = 0;

    // Handle overpayment
    if (newBalance <= 0) {
      newStatus = 'paid';
      if (newBalance < 0) {
        excessAmount = Math.abs(newBalance);
      }
      newBalance = 0;
      newAmountPaid = parseFloat(bill.total);
    }

    // Determine payment_type: does this payment fully pay the remaining balance?
    const paymentType = (newStatus === 'paid') ? 'full' : 'partial';

    // Insert payment
    const [paymentResult] = await conn.query(
      `INSERT INTO payments (bill_id, customer_id, cash_amount, upi_amount, total_paid, payment_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bill_id, bill.customer_id, cashAmt, upiAmt, totalPaid, paymentType, notes || '']
    );

    // Update bill
    await conn.query(
      'UPDATE bills SET amount_paid = ?, balance = ?, status = ? WHERE id = ?',
      [newAmountPaid, newBalance, newStatus, bill_id]
    );

    // Handle overpayment: add excess to customer credit_balance
    if (excessAmount > 0) {
      await conn.query(
        'UPDATE customers SET credit_balance = credit_balance + ? WHERE id = ?',
        [excessAmount, bill.customer_id]
      );
      console.log(`[INFO] Overpayment of Rs. ${excessAmount.toFixed(2)} added to credit balance for customer ${bill.customer_id}`);
    }

    // Audit log
    await conn.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?)`,
      ['PAYMENT', 'payment', String(paymentResult.insertId),
        JSON.stringify({ bill_id, old_balance: currentBalance, old_status: bill.status }),
        JSON.stringify({ total_paid: totalPaid, new_balance: newBalance, new_status: newStatus, excess_to_credit: excessAmount })
      ]
    );

    await conn.commit();
    conn.release();

    // Fetch the created payment
    const [newPayment] = await pool.query('SELECT * FROM payments WHERE id = ?', [paymentResult.insertId]);

    res.status(201).json({
      success: true,
      data: {
        payment: newPayment[0],
        bill_status: newStatus,
        bill_balance: newBalance,
        credit_added: excessAmount
      }
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    next(err);
  }
}

// GET /customer/:customerId - Get all payments by customer
async function getPaymentsByCustomer(req, res, next) {
  try {
    const pool = getPool();
    const { customerId } = req.params;

    const [customer] = await pool.query('SELECT id FROM customers WHERE id = ?', [customerId]);
    if (customer.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const [payments] = await pool.query(
      `SELECT p.*, b.total AS bill_total, b.status AS bill_status
       FROM payments p
       LEFT JOIN bills b ON p.bill_id = b.id
       WHERE p.customer_id = ?
       ORDER BY p.date DESC`,
      [customerId]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPaymentsForBill,
  recordPayment,
  getPaymentsByCustomer
};
