const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');
const { allowlist } = require('../middleware/allowlist');
const { createRateLimiter } = require('../middleware/rateLimiters');
const { validateSchema } = require('../middleware/schemaValidator');
const schemas = require('../config/schemas');

// Dedicated rate limiter for validate endpoint to prevent brute-force promo discovery (30 req / 15 min)
const validateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  serviceName: 'promos:validate',
  message: 'Too many promo validation attempts. Please wait 15 minutes before attempting to validate more discount codes.'
});

// Promo code projection DTO: strips internal auth tenant ID (user_id)
function toPromoCodeDto(p) {
  if (!p) return null;
  return {
    id: p.id,
    code: p.code,
    discount_type: p.discount_type || 'flat',
    discount_value: parseFloat(p.discount_value) || 0,
    min_bill_amount: parseFloat(p.min_bill_amount || p.min_order_amount) || 0,
    max_discount: p.max_discount !== null && p.max_discount !== undefined ? parseFloat(p.max_discount) : null,
    usage_limit: p.usage_limit !== null && p.usage_limit !== undefined ? parseInt(p.usage_limit, 10) : null,
    max_uses_per_customer: p.max_uses_per_customer !== null && p.max_uses_per_customer !== undefined ? parseInt(p.max_uses_per_customer, 10) : 1,
    used_count: parseInt(p.used_count, 10) || 0,
    is_active: p.is_active !== undefined ? Boolean(p.is_active) : true,
    start_date: p.start_date || p.valid_from || null,
    end_date: p.end_date || p.valid_to || p.valid_until || null,
    created_at: p.created_at
  };
}

// GET /api/promo-codes - List all promo codes for the merchant
router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM promo_codes WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ success: true, data: rows.map(toPromoCodeDto) });
  } catch (err) {
    next(err);
  }
});

// POST /api/promo-codes/validate - Server-authoritative promo validation & discount calculation
router.post('/validate', validateLimiter, allowlist(['code', 'customer_id', 'bill_amount']), validateSchema(schemas.promoValidate), async (req, res, next) => {
  try {
    const pool = getPool();
    const { code, customer_id, bill_amount } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, valid: false, error: 'Coupon code is required.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const billAmt = Math.max(0, parseFloat(bill_amount) || 0);

    const [rows] = await pool.query(
      'SELECT * FROM promo_codes WHERE code = ? AND user_id = ?',
      [cleanCode, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, valid: false, error: `Invalid coupon code "${cleanCode}".` });
    }

    const promo = rows[0];

    // 1. Active Check
    if (promo.is_active === false) {
      return res.status(400).json({ success: false, valid: false, error: `Coupon code "${cleanCode}" is disabled.` });
    }

    // 2. Date Range Check
    const today = new Date().toISOString().slice(0, 10);
    const validFrom = promo.valid_from;
    const validUntil = promo.valid_until || promo.valid_to;
    if (validFrom && today < new Date(validFrom).toISOString().slice(0, 10)) {
      return res.status(400).json({ success: false, valid: false, error: `Coupon code "${cleanCode}" is not active yet (starts ${new Date(validFrom).toISOString().slice(0, 10)}).` });
    }
    if (validUntil && today > new Date(validUntil).toISOString().slice(0, 10)) {
      return res.status(400).json({ success: false, valid: false, error: `Coupon code "${cleanCode}" expired on ${new Date(validUntil).toISOString().slice(0, 10)}.` });
    }

    // 3. Minimum Bill Amount Check
    const minBill = parseFloat(promo.min_bill_amount || promo.min_order_amount) || 0;
    if (minBill > 0 && billAmt < minBill) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: `Minimum bill amount of ₹${minBill.toFixed(2)} required for coupon "${cleanCode}" (current bill: ₹${billAmt.toFixed(2)}).`
      });
    }

    // 4. Global Usage Limit Check
    const usageLimit = promo.usage_limit !== null && promo.usage_limit !== undefined ? parseInt(promo.usage_limit, 10) : null;
    const usedCount = parseInt(promo.used_count || promo.times_used || 0, 10);
    if (usageLimit !== null && usedCount >= usageLimit) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: `Coupon code "${cleanCode}" has reached its maximum total usage limit (${usageLimit}).`
      });
    }

    // 5. Per-Customer Usage Limit Check
    const maxCustomerUses = promo.max_uses_per_customer !== null && promo.max_uses_per_customer !== undefined ? parseInt(promo.max_uses_per_customer, 10) : 1;
    if (customer_id && maxCustomerUses > 0) {
      const [usesRows] = await pool.query(
        'SELECT COUNT(*) AS cust_count FROM promo_uses WHERE promo_code_id = ? AND customer_id = ? AND user_id = ?',
        [promo.id, String(customer_id), req.user.id]
      );
      const custUsedCount = parseInt(usesRows[0]?.cust_count || 0, 10);
      if (custUsedCount >= maxCustomerUses) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: `You have already used coupon "${cleanCode}" the maximum allowed times (${maxCustomerUses}).`
        });
      }
    }

    // 6. Calculate Discount Amount
    const dVal = parseFloat(promo.discount_value) || 0;
    const maxDiscount = promo.max_discount !== null && promo.max_discount !== undefined ? parseFloat(promo.max_discount) : null;
    let discountAmount = 0;

    if (promo.discount_type === 'percent') {
      discountAmount = (billAmt * dVal) / 100;
      if (maxDiscount !== null && maxDiscount > 0) {
        discountAmount = Math.min(discountAmount, maxDiscount);
      }
    } else {
      discountAmount = dVal;
    }
    discountAmount = parseFloat(Math.min(discountAmount, billAmt).toFixed(2));

    const remainingUses = usageLimit !== null ? Math.max(0, usageLimit - usedCount) : null;

    res.json({
      success: true,
      valid: true,
      data: {
        promo_id: promo.id,
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: dVal,
        discount_amount: discountAmount,
        min_bill_amount: minBill,
        max_discount: maxDiscount,
        remaining_uses: remainingUses,
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/promo-codes/use - Track application of promo code to a bill
router.post('/use', allowlist(['promo_code_id', 'code', 'bill_id', 'customer_id', 'discount_applied']), validateSchema(schemas.promoUse), async (req, res, next) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { promo_code_id, code, bill_id, customer_id, discount_applied } = req.body;

    let resolvedPromoId = null;
    if (promo_code_id) {
      const [rows] = await conn.query('SELECT id FROM promo_codes WHERE id = ? AND user_id = ?', [promo_code_id, req.user.id]);
      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, error: 'Promo code not found' });
      }
      resolvedPromoId = rows[0].id;
    } else if (code) {
      const [rows] = await conn.query('SELECT id FROM promo_codes WHERE code = ? AND user_id = ?', [code.toUpperCase(), req.user.id]);
      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, error: 'Promo code not found' });
      }
      resolvedPromoId = rows[0].id;
    } else {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'promo_code_id or valid code is required' });
    }

    let resolvedBillId = null;
    if (bill_id) {
      const [billRows] = await conn.query(
        'SELECT id FROM bills WHERE (id::text = ? OR bill_number = ? OR invoice_number = ?) AND user_id = ?',
        [bill_id, bill_id, bill_id, req.user.id]
      );
      if (billRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, error: 'Bill not found' });
      }
      resolvedBillId = billRows[0].id;
    }

    let resolvedCustomerId = null;
    if (customer_id) {
      const [custRows] = await conn.query(
        'SELECT id FROM customers WHERE (id::text = ? OR customer_code = ?) AND user_id = ?',
        [customer_id, customer_id, req.user.id]
      );
      if (custRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      resolvedCustomerId = custRows[0].id;
    }

    // Insert promo usage row
    await conn.query(
      `INSERT INTO promo_uses (user_id, promo_code_id, bill_id, customer_id, discount_applied, used_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, resolvedPromoId, resolvedBillId, resolvedCustomerId, parseFloat(discount_applied) || 0]
    );

    // Increment used_count and times_used on promo_codes table
    await conn.query(
      'UPDATE promo_codes SET used_count = COALESCE(used_count, 0) + 1, times_used = COALESCE(times_used, 0) + 1 WHERE id = ? AND user_id = ?',
      [resolvedPromoId, req.user.id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Promo use tracked successfully' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// POST /api/promo-codes/bulk-generate - Generate N unique promo codes with shared config
router.post('/bulk-generate', allowlist(['count', 'prefix', 'discount_type', 'discount_value', 'min_bill_amount', 'max_discount', 'usage_limit', 'max_uses_per_customer', 'valid_from', 'valid_until', 'is_active']), validateSchema(schemas.promoBulkGenerate), async (req, res, next) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      count = 5,
      prefix = 'PROMO',
      discount_type = 'flat',
      discount_value = 10,
      min_bill_amount = 0,
      max_discount = null,
      usage_limit = 1,
      max_uses_per_customer = 1,
      valid_from = new Date().toISOString().slice(0, 10),
      valid_until = null,
      is_active = true,
    } = req.body;

    const numCodes = Math.min(Math.max(1, parseInt(count, 10) || 5), 100);
    const cleanPrefix = (prefix || 'PROMO').trim().toUpperCase();
    const createdCodes = [];

    for (let i = 0; i < numCodes; i++) {
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${cleanPrefix}-${randomSuffix}-${String(i + 1).padStart(2, '0')}`;

      const [result] = await conn.query(
        `INSERT INTO promo_codes (user_id, code, discount_type, discount_value, min_bill_amount, max_discount, usage_limit, max_uses_per_customer, valid_from, valid_until, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, code) DO NOTHING`,
        [
          req.user.id,
          code,
          discount_type || 'flat',
          parseFloat(discount_value) || 0,
          parseFloat(min_bill_amount) || 0,
          max_discount !== null && max_discount !== undefined ? parseFloat(max_discount) : null,
          usage_limit !== null && usage_limit !== undefined ? parseInt(usage_limit, 10) : null,
          max_uses_per_customer !== null && max_uses_per_customer !== undefined ? parseInt(max_uses_per_customer, 10) : 1,
          valid_from || new Date().toISOString().slice(0, 10),
          valid_until || null,
          is_active !== undefined ? is_active : true,
        ]
      );

      if (result.insertId) {
        createdCodes.push({
          id: result.insertId,
          code,
          discount_type,
          discount_value: parseFloat(discount_value) || 0,
          min_bill_amount: parseFloat(min_bill_amount) || 0,
          max_discount,
          usage_limit,
          max_uses_per_customer,
          valid_from,
          valid_until,
          is_active,
        });
      }
    }

    await conn.commit();
    res.status(201).json({ success: true, count: createdCodes.length, data: createdCodes });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// POST /api/promo-codes - Create single promo code
router.post('/', allowlist(['code', 'discount_type', 'discount_value', 'min_bill_amount', 'max_discount', 'usage_limit', 'max_uses_per_customer', 'valid_from', 'valid_until', 'is_active']), validateSchema(schemas.promoCreate), async (req, res, next) => {
  try {
    const pool = getPool();
    const { code, discount_type, discount_value, min_bill_amount, max_discount, usage_limit, max_uses_per_customer, valid_from, valid_until, is_active } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Code is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO promo_codes (user_id, code, discount_type, discount_value, min_bill_amount, max_discount, usage_limit, max_uses_per_customer, valid_from, valid_until, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        code.trim().toUpperCase(),
        discount_type || 'flat',
        parseFloat(discount_value) || 0,
        parseFloat(min_bill_amount) || 0,
        max_discount !== null && max_discount !== undefined && max_discount !== '' ? parseFloat(max_discount) : null,
        usage_limit !== null && usage_limit !== undefined && usage_limit !== '' ? parseInt(usage_limit, 10) : null,
        max_uses_per_customer !== null && max_uses_per_customer !== undefined && max_uses_per_customer !== '' ? parseInt(max_uses_per_customer, 10) : 1,
        valid_from || new Date().toISOString().slice(0, 10),
        valid_until || null,
        is_active !== undefined ? is_active : true,
      ]
    );

    const [created] = await pool.query('SELECT * FROM promo_codes WHERE id = ? AND user_id = ?', [result.insertId, req.user.id]);
    res.status(201).json({ success: true, data: toPromoCodeDto(created[0]) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/promo-codes/:id - Update promo code
router.put('/:id', allowlist(['code', 'discount_type', 'discount_value', 'min_bill_amount', 'max_discount', 'usage_limit', 'max_uses_per_customer', 'valid_from', 'valid_until', 'is_active']), validateSchema(schemas.promoUpdate), async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { code, discount_type, discount_value, min_bill_amount, max_discount, usage_limit, max_uses_per_customer, valid_from, valid_until, is_active } = req.body;

    const [existing] = await pool.query('SELECT * FROM promo_codes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Promo code not found' });
    }

    await pool.query(
      `UPDATE promo_codes SET
         code = COALESCE(?, code),
         discount_type = COALESCE(?, discount_type),
         discount_value = COALESCE(?, discount_value),
         min_bill_amount = COALESCE(?, min_bill_amount),
         max_discount = ?,
         usage_limit = ?,
         max_uses_per_customer = ?,
         valid_from = COALESCE(?, valid_from),
         valid_until = ?,
         is_active = COALESCE(?, is_active)
       WHERE id = ? AND user_id = ?`,
      [
        code ? code.trim().toUpperCase() : null,
        discount_type,
        discount_value !== undefined ? parseFloat(discount_value) : null,
        min_bill_amount !== undefined ? parseFloat(min_bill_amount) : null,
        max_discount !== undefined && max_discount !== '' ? parseFloat(max_discount) : null,
        usage_limit !== undefined && usage_limit !== '' ? parseInt(usage_limit, 10) : null,
        max_uses_per_customer !== undefined && max_uses_per_customer !== '' ? parseInt(max_uses_per_customer, 10) : 1,
        valid_from,
        valid_until,
        is_active,
        id,
        req.user.id,
      ]
    );

    const [updated] = await pool.query('SELECT * FROM promo_codes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, data: toPromoCodeDto(updated[0]) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/promo-codes/:id - Delete promo code
router.delete('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM promo_codes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Promo code not found' });
    }

    await pool.query('DELETE FROM promo_codes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, message: 'Promo code deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
