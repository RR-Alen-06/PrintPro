const { body, validationResult } = require('express-validator');

/**
 * Handle validation errors from express-validator.
 * Returns 400 Bad Request with details if validation fails.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

const validateCustomer = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Customer name is required')
    .isLength({ max: 100 })
    .withMessage('Customer name must be under 100 characters'),
  body('type')
    .isIn(['regular', 'random'])
    .withMessage('Customer type must be either "regular" or "random"'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 15 })
    .withMessage('Phone number must be under 15 characters'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .isLength({ max: 100 })
    .withMessage('Email must be under 100 characters'),
  body('address')
    .optional()
    .trim(),
  body('credit_balance')
    .optional()
    .isFloat()
    .withMessage('Credit balance must be a number'),
  body('credit_limit')
    .optional()
    .isFloat()
    .withMessage('Credit limit must be a number'),
  body('customer_code')
    .optional()
    .trim(),
  handleValidationErrors,
];

const validateBill = [
  body('customer_id')
    .trim()
    .notEmpty()
    .withMessage('Customer ID is required'),
  body('date')
    .isISO8601()
    .withMessage('Bill date must be in YYYY-MM-DD format'),
  body('due_date')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Due date must be in YYYY-MM-DD format'),
  body('subtotal')
    .isFloat({ min: 0 })
    .withMessage('Subtotal must be a positive number'),
  body('discount_type')
    .optional()
    .isIn(['percent', 'flat'])
    .withMessage('Discount type must be "percent" or "flat"'),
  body('discount_value')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a positive number'),
  body('gst_percent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('GST percent must be between 0 and 100'),
  body('gst_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('GST amount must be a positive number'),
  body('total')
    .isFloat({ min: 0 })
    .withMessage('Total must be a positive number'),
  body('amount_paid')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Amount paid must be a positive number'),
  body('balance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Balance must be a positive number'),
  body('status')
    .optional()
    .isIn(['unpaid', 'partial', 'paid'])
    .withMessage('Invalid bill status value'),
  body('notes')
    .optional()
    .trim(),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required in the bill'),
  body('items.*')
    .custom((item) => {
      if (!item || typeof item !== 'object') {
        throw new Error('Item must be an object');
      }
      const name = item.name || item.item_name || item.itemName;
      if (!name || !String(name).trim()) {
        throw new Error('Item name is required');
      }
      return true;
    }),
  body('items.*.print_type')
    .optional({ checkFalsy: true })
    .custom((val) => {
      const v = String(val).toLowerCase();
      if (['color', 'bw', 'colour'].includes(v) || v.includes('color') || v.includes('bw')) {
        return true;
      }
      return true;
    }),
  body('items.*.sides')
    .optional({ checkFalsy: true })
    .custom((val) => {
      const v = String(val).toLowerCase();
      if (['single', 'double'].includes(v) || v.includes('single') || v.includes('double')) {
        return true;
      }
      return true;
    }),
  body('items.*.qty')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be an integer greater than 0'),
  body('items.*.unit_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),
  body('items.*.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Item total amount must be a positive number'),
  handleValidationErrors,
];

const validateBillUpdate = [
  body('customer_id')
    .optional({ checkFalsy: true })
    .trim()
    .notEmpty()
    .withMessage('Customer ID cannot be empty'),
  body('date')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Bill date must be in YYYY-MM-DD format'),
  body('due_date')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Due date must be in YYYY-MM-DD format'),
  body('subtotal')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Subtotal must be a positive number'),
  body('discount_type')
    .optional({ checkFalsy: true, nullable: true })
    .isIn(['percent', 'flat'])
    .withMessage('Discount type must be "percent" or "flat"'),
  body('discount_value')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a positive number'),
  body('gst_percent')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('GST percent must be between 0 and 100'),
  body('gst_amount')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('GST amount must be a positive number'),
  body('total')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Total must be a positive number'),
  body('amount_paid')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Amount paid must be a positive number'),
  body('balance')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Balance must be a positive number'),
  body('status')
    .optional({ checkFalsy: true, nullable: true })
    .isIn(['unpaid', 'partial', 'paid'])
    .withMessage('Invalid bill status value'),
  body('notes')
    .optional({ nullable: true })
    .trim(),
  body('items')
    .optional({ nullable: true })
    .isArray()
    .withMessage('Items must be an array'),
  body('items.*')
    .optional()
    .custom((item) => {
      if (!item || typeof item !== 'object') return true;
      const name = item.name || item.item_name || item.itemName;
      if (!name || !String(name).trim()) {
        throw new Error('Item name cannot be empty');
      }
      return true;
    }),
  body('items.*.print_type')
    .optional({ checkFalsy: true })
    .custom((val) => {
      const v = String(val).toLowerCase();
      if (['color', 'bw', 'colour'].includes(v) || v.includes('color') || v.includes('bw')) {
        return true;
      }
      return true;
    }),
  body('items.*.sides')
    .optional({ checkFalsy: true })
    .custom((val) => {
      const v = String(val).toLowerCase();
      if (['single', 'double'].includes(v) || v.includes('single') || v.includes('double')) {
        return true;
      }
      return true;
    }),
  body('items.*.qty')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be an integer greater than 0'),
  body('items.*.unit_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),
  body('items.*.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Item total amount must be a positive number'),
  handleValidationErrors,
];

const validatePayment = [
  body('bill_id')
    .optional({ checkFalsy: true })
    .trim(),
  body('customer_id')
    .optional({ checkFalsy: true })
    .trim(),
  body('cash_amount')
    .optional()
    .isFloat()
    .withMessage('Cash amount must be a number'),
  body('upi_amount')
    .optional()
    .isFloat()
    .withMessage('UPI amount must be a number'),
  body('total_paid')
    .optional()
    .isFloat()
    .withMessage('Total paid must be a number'),
  body('payment_type')
    .optional()
    .isIn(['full', 'partial', 'refund'])
    .withMessage('Payment type must be "full", "partial", or "refund"'),
  body('notes')
    .optional()
    .trim(),
  body().custom((value, { req }) => {
    if (!req.body.bill_id && !req.body.customer_id) {
      throw new Error('Either bill_id or customer_id is required');
    }
    return true;
  }),
  handleValidationErrors,
];

const validateInventoryItem = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Item name is required')
    .isLength({ max: 50 })
    .withMessage('Item name must be under 50 characters'),
  body('color_single')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('color_double')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('bw_single')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('bw_double')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('low_stock_alert')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Low stock alert must be a non-negative integer'),
  handleValidationErrors,
];

const validatePurchase = [
  body('date')
    .isISO8601()
    .withMessage('Purchase date must be in YYYY-MM-DD format'),
  body('item_name')
    .trim()
    .notEmpty()
    .withMessage('Item name is required')
    .isLength({ max: 100 })
    .withMessage('Item name must be under 100 characters'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isLength({ max: 50 })
    .withMessage('Category must be under 50 characters'),
  body('qty')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  body('unit_cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit cost must be a positive number'),
  body('total')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total must be a positive number'),
  body('notes')
    .optional()
    .trim(),
  body('vendor_name')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('payment_method')
    .optional()
    .trim(),
  body('upi_ref')
    .optional()
    .trim(),
  body('session_id')
    .optional(),
  handleValidationErrors,
];

const validateProfile = [
  body('shop_name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Shop name must be under 100 characters'),
  body('shopName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Shop name must be under 100 characters'),
  body('owner_name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Owner name must be under 100 characters'),
  body('ownerName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Owner name must be under 100 characters'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 25 })
    .withMessage('Phone must be under 25 characters'),
  body('address')
    .optional()
    .trim(),
  body('gstin')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage('GSTIN must be under 20 characters'),
  body('upi_id')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('UPI ID must be under 100 characters'),
  body('upiId')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('UPI ID must be under 100 characters'),
  handleValidationErrors,
];

module.exports = {
  validateCustomer,
  validateBill,
  validateBillUpdate,
  validatePayment,
  validateInventoryItem,
  validatePurchase,
  validateProfile,
};
