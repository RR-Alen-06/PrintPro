const path = require('path');
const { getPool } = require('../config/db');
const { generateLedgerPdf } = require('../utils/ledgerPdfGenerator');
const logger = require('../utils/logger');

/**
 * Helper to build the customer ledger statement object.
 */
async function buildLedgerStatement(pool, userId, customerId, startDateStr, endDateStr) {
  // 1. Fetch customer details
  const [customers] = await pool.query(
    'SELECT * FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
    [customerId, customerId, userId]
  );

  if (customers.length === 0) {
    return null;
  }

  const customer = customers[0];
  const actualCustomerId = customer.id;

  // 2. Fetch business profile and user settings
  const [profiles] = await pool.query(
    'SELECT * FROM business_profile WHERE user_id = ?',
    [userId]
  );
  const profile = profiles[0] || {};

  const [settingsRows] = await pool.query(
    'SELECT * FROM user_settings WHERE user_id = ?',
    [userId]
  );
  let userSettings = {};
  if (settingsRows[0]?.settings) {
    try {
      userSettings = typeof settingsRows[0].settings === 'string'
        ? JSON.parse(settingsRows[0].settings)
        : settingsRows[0].settings;
    } catch (_e) {
      userSettings = {};
    }
  }

  const business = {
    shop_name: profile.shop_name || userSettings.shopName || 'PrintPro',
    owner_name: profile.owner_name || userSettings.ownerName || '',
    phone: profile.phone || userSettings.phone || '',
    email: profile.email || userSettings.email || '',
    address: profile.address || userSettings.address || '',
    gstin: profile.gstin || userSettings.gstNumber || '',
    upi_id: profile.upi_id || userSettings.upiId || '',
  };

  // 3. Fetch all raw financial records for this customer (all time)
  // Bills
  const [bills] = await pool.query(
    `SELECT id, total, amount_paid, balance, status,
            date, created_at
     FROM bills
     WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [actualCustomerId, userId]
  );

  // Payments (including refunds)
  const [payments] = await pool.query(
    `SELECT id, bill_id, date, cash_amount, upi_amount,
            total_paid, payment_type, notes
     FROM payments
     WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL
     ORDER BY date ASC`,
    [actualCustomerId, userId]
  );

  // Advance Payments (deposits and returns)
  const [advances] = await pool.query(
    `SELECT id, amount, payment_mode, type, bill_id, notes, date, created_at
     FROM advance_payments
     WHERE customer_id = ? AND user_id = ?
     ORDER BY created_at ASC`,
    [actualCustomerId, userId]
  );

  // Loyalty Events
  const [loyaltyEvents] = await pool.query(
    `SELECT id, bill_id, event_type, points, description, created_at
     FROM loyalty_events
     WHERE customer_id = ? AND user_id = ?
     ORDER BY created_at ASC`,
    [actualCustomerId, userId]
  );



  // Promo Uses
  let promoUses;
  try {
    const [puRows] = await pool.query(
      `SELECT pu.id, pu.promo_code_id, pu.bill_id, pu.discount_applied, pu.created_at, pc.code AS promo_code
       FROM promo_uses pu
       LEFT JOIN promo_codes pc ON pu.promo_code_id = pc.id
       WHERE pu.customer_id = ? AND pu.user_id = ?
       ORDER BY pu.created_at ASC`,
      [actualCustomerId, userId]
    );
    promoUses = puRows;
  } catch (_e) {
    promoUses = [];
  }

  // 4. Combine into standardized chronological ledger events
  const allEvents = [];

  // Map Bills
  for (const b of bills) {
    const total = parseFloat(b.total) || 0;
    const date = b.date || b.created_at;
    allEvents.push({
      id: `bill-${b.id}`,
      rawDate: new Date(date).getTime(),
      date: new Date(date).toISOString(),
      type: 'bill',
      typeLabel: 'Bill',
      referenceId: b.bill_no || `BILL-${b.id}`,
      description: `Invoice #${b.bill_no || b.id}${b.status === 'paid' ? ' (Paid)' : b.status === 'partial' ? ' (Partial)' : ''}`,
      debit: total,
      credit: 0,
      meta: {
        billId: b.id,
        status: b.status,
        advanceUsed: parseFloat(b.advance_used) || 0,
        promoCode: b.promo_code,
        promoDiscount: parseFloat(b.promo_discount) || 0,
        loyaltyPointsEarned: b.loyalty_points_earned || 0,
        loyaltyPointsRedeemed: b.loyalty_points_redeemed || 0,
        loyaltyDiscount: parseFloat(b.loyalty_discount) || 0,
      }
    });
  }

  // Map Payments
  for (const p of payments) {
    const totalPaid = parseFloat(p.total_paid) || 0;
    const isRefund = p.is_refund || p.payment_type === 'refund' || totalPaid < 0;
    const date = p.date || p.payment_date || p.created_at;
    const absPaid = Math.abs(totalPaid);

    if (isRefund) {
      allEvents.push({
        id: `payment-${p.id}`,
        rawDate: new Date(date).getTime(),
        date: new Date(date).toISOString(),
        type: 'refund',
        typeLabel: 'Refund',
        referenceId: p.receipt_no || `REF-${p.id}`,
        description: `Refund${p.notes ? ` - ${p.notes}` : ` (Receipt #${p.receipt_no || p.id})`}`,
        debit: absPaid,
        credit: 0,
        meta: { paymentId: p.id, paymentType: 'refund', notes: p.notes }
      });
    } else {
      allEvents.push({
        id: `payment-${p.id}`,
        rawDate: new Date(date).getTime(),
        date: new Date(date).toISOString(),
        type: 'payment',
        typeLabel: 'Payment',
        referenceId: p.receipt_no || `REC-${p.id}`,
        description: `Payment${p.notes ? ` - ${p.notes}` : ` (Receipt #${p.receipt_no || p.id})`}`,
        debit: 0,
        credit: absPaid,
        meta: {
          paymentId: p.id,
          cashAmount: parseFloat(p.cash_amount) || 0,
          upiAmount: parseFloat(p.upi_amount) || 0,
          notes: p.notes
        }
      });
    }
  }

  // Map Advance Payments
  for (const a of advances) {
    const amount = parseFloat(a.amount) || 0;
    const isReturn = a.type === 'return' || a.type === 'refund' || amount < 0;
    const date = a.date || a.created_at;
    const absAmt = Math.abs(amount);

    if (isReturn) {
      allEvents.push({
        id: `adv-${a.id}`,
        rawDate: new Date(date).getTime(),
        date: new Date(date).toISOString(),
        type: 'advance_return',
        typeLabel: 'Advance Return',
        referenceId: `ADV-RET-${a.id}`,
        description: `Advance Refund / Return${a.notes ? ` - ${a.notes}` : ''}`,
        debit: absAmt,
        credit: 0,
        meta: { advanceId: a.id, paymentMode: a.payment_mode, notes: a.notes }
      });
    } else {
      allEvents.push({
        id: `adv-${a.id}`,
        rawDate: new Date(date).getTime(),
        date: new Date(date).toISOString(),
        type: 'advance_deposit',
        typeLabel: 'Advance Deposit',
        referenceId: `ADV-${a.id}`,
        description: `Advance Deposit${a.notes ? ` - ${a.notes}` : ''}`,
        debit: 0,
        credit: absAmt,
        meta: { advanceId: a.id, paymentMode: a.payment_mode, notes: a.notes }
      });
    }
  }

  // Map Loyalty Events
  for (const le of loyaltyEvents) {
    const pts = parseInt(le.points, 10) || 0;
    const date = le.created_at;
    const isRedeem = le.event_type === 'redeem' || pts < 0;

    allEvents.push({
      id: `loyalty-${le.id}`,
      rawDate: new Date(date).getTime(),
      date: new Date(date).toISOString(),
      type: isRedeem ? 'loyalty_redeem' : 'loyalty_earn',
      typeLabel: isRedeem ? 'Loyalty Redeem' : 'Loyalty Earn',
      referenceId: `LOY-${le.id}`,
      description: isRedeem
        ? `Loyalty Points Redeemed (${pts} pts)${le.description ? ` - ${le.description}` : ''}`
        : `Loyalty Points Earned (+${pts} pts)${le.description ? ` - ${le.description}` : ''}`,
      debit: 0,
      credit: 0,
      loyaltyPoints: pts,
      meta: { eventId: le.id, eventType: le.event_type, points: pts, billId: le.bill_id }
    });
  }

  // 5. Sort chronologically
  allEvents.sort((a, b) => a.rawDate - b.rawDate);

  // 6. Calculate running balance for the entire timeline
  let running = 0;
  for (const ev of allEvents) {
    running += (ev.debit - ev.credit);
    ev.runningBalance = parseFloat(running.toFixed(2));
  }

  // 7. Filter for specified date period if requested
  const startTimestamp = startDateStr ? new Date(startDateStr).getTime() : null;
  const endTimestamp = endDateStr ? new Date(new Date(endDateStr).setHours(23, 59, 59, 999)).getTime() : null;

  let openingBalance = 0;
  const periodRows = [];

  for (const ev of allEvents) {
    if (startTimestamp && ev.rawDate < startTimestamp) {
      openingBalance = ev.runningBalance;
    } else if (!endTimestamp || ev.rawDate <= endTimestamp) {
      if (!startTimestamp || ev.rawDate >= startTimestamp) {
        periodRows.push(ev);
      }
    }
  }

  // If no period filter, opening balance is 0 and periodRows is allEvents
  const finalRows = startTimestamp || endTimestamp ? periodRows : allEvents;
  const closingBalance = finalRows.length > 0
    ? finalRows[finalRows.length - 1].runningBalance
    : openingBalance;

  // 8. Compute summaries
  const totalDebits = finalRows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredits = finalRows.reduce((sum, r) => sum + r.credit, 0);
  const netMovement = totalDebits - totalCredits;

  const periodLoyaltyEarned = finalRows
    .filter(r => r.type === 'loyalty_earn')
    .reduce((sum, r) => sum + (r.loyaltyPoints || 0), 0);

  const periodLoyaltyRedeemed = finalRows
    .filter(r => r.type === 'loyalty_redeem')
    .reduce((sum, r) => sum + Math.abs(r.loyaltyPoints || 0), 0);

  // Promo Summary
  const periodPromoUses = promoUses.filter(pu => {
    const t = new Date(pu.created_at).getTime();
    if (startTimestamp && t < startTimestamp) return false;
    if (endTimestamp && t > endTimestamp) return false;
    return true;
  });

  const totalPromoDiscount = periodPromoUses.reduce((sum, pu) => sum + (parseFloat(pu.discount_applied) || 0), 0);
  const uniquePromoCodes = Array.from(new Set(periodPromoUses.map(pu => pu.promo_code).filter(Boolean)));

  return {
    customer: {
      id: customer.id,
      customer_code: customer.customer_code,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      credit_balance: parseFloat(customer.credit_balance) || 0,
      loyalty_points: customer.loyalty_points || 0,
    },
    business,
    period: {
      startDate: startDateStr || null,
      endDate: endDateStr || null,
    },
    summary: {
      openingBalance: parseFloat(openingBalance.toFixed(2)),
      totalDebits: parseFloat(totalDebits.toFixed(2)),
      totalCredits: parseFloat(totalCredits.toFixed(2)),
      netMovement: parseFloat(netMovement.toFixed(2)),
      closingBalance: parseFloat(closingBalance.toFixed(2)),
      totalTransactions: finalRows.length,
    },
    loyaltySummary: {
      currentBalance: customer.loyalty_points || 0,
      earnedInPeriod: periodLoyaltyEarned,
      redeemedInPeriod: periodLoyaltyRedeemed,
    },
    promoSummary: {
      usesCount: periodPromoUses.length,
      totalDiscount: parseFloat(totalPromoDiscount.toFixed(2)),
      codesUsed: uniquePromoCodes,
    },
    rows: finalRows,
  };
}

// GET /api/ledger/:customerId?startDate=&endDate=
async function getCustomerLedger(req, res, next) {
  try {
    const pool = getPool();
    const customerId = req.params.customerId;
    const { startDate, endDate } = req.query;

    const statement = await buildLedgerStatement(pool, req.user.id, customerId, startDate, endDate);
    if (!statement) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({
      success: true,
      data: statement,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/ledger/:customerId/pdf
async function generateCustomerLedgerPdf(req, res, next) {
  try {
    const pool = getPool();
    const customerId = req.params.customerId;
    const { startDate, endDate } = req.body || {};

    const statement = await buildLedgerStatement(pool, req.user.id, customerId, startDate, endDate);
    if (!statement) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const cleanCustomerId = (statement.customer.customer_code || statement.customer.id || 'cust')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const fileName = `ledger_${cleanCustomerId}_${timestamp}.pdf`;
    const uploadDir = path.join(__dirname, '../uploads/ledger');
    const filePath = path.join(uploadDir, fileName);

    await generateLedgerPdf(statement, filePath);

    const relativeUrl = `/uploads/ledger/${fileName}`;
    const host = req.get('host');
    const protocol = req.protocol || 'http';
    const fullUrl = `${protocol}://${host}${relativeUrl}`;

    res.json({
      success: true,
      pdfUrl: relativeUrl,
      fullUrl,
      fileName,
      statement,
    });
  } catch (err) {
    logger.error(`Failed to generate ledger PDF: ${err.message}`);
    next(err);
  }
}

module.exports = {
  getCustomerLedger,
  generateCustomerLedgerPdf,
  buildLedgerStatement,
};
