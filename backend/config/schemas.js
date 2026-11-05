/**
 * Centralized Explicit Schemas for All Data-Accepting Endpoints.
 * Defines exact types, required status, length limits, formats, and allowed values.
 * Used with validateSchema middleware to validate payloads and protect endpoints.
 */

const schemas = {
  // ── 1. Customers ─────────────────────────────────────────────────────────────
  customerCreate: {
    id: { type: 'string', required: false, maxLength: 100 },
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    type: { type: 'string', required: false, allowedValues: ['regular', 'random', 'walkin', 'wholesale'] },
    phone: { type: 'string', required: false, maxLength: 25, format: 'phone' },
    email: { type: 'string', required: false, maxLength: 100, format: 'email' },
    address: { type: 'string', required: false, maxLength: 300 },
    gstin: { type: 'string', required: false, maxLength: 20 },
    credit_limit: { type: 'number', required: false, min: 0 },
    creditLimit: { type: 'number', required: false, min: 0 },
    credit_balance: { type: 'number', required: false },
    advance_balance: { type: 'number', required: false },
    openingBalance: { type: 'number', required: false },
    creditBalance: { type: 'number', required: false },
    advanceBalance: { type: 'number', required: false },
    openingCash: { type: 'number', required: false },
    openingUpi: { type: 'number', required: false },
    loyalty_points: { type: 'number', required: false },
    loyaltyPoints: { type: 'number', required: false },
    groupId: { type: 'string', required: false, maxLength: 100 },
    group_id: { type: 'string', required: false, maxLength: 100 },
    customer_code: { type: 'string', required: false, maxLength: 50 },
    customerCode: { type: 'string', required: false, maxLength: 50 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  customerUpdate: {
    id: { type: 'string', required: false, maxLength: 100 },
    name: { type: 'string', required: false, minLength: 1, maxLength: 100 },
    type: { type: 'string', required: false, allowedValues: ['regular', 'random', 'walkin', 'wholesale'] },
    phone: { type: 'string', required: false, maxLength: 25, format: 'phone' },
    email: { type: 'string', required: false, maxLength: 100, format: 'email' },
    address: { type: 'string', required: false, maxLength: 300 },
    gstin: { type: 'string', required: false, maxLength: 20 },
    credit_limit: { type: 'number', required: false, min: 0 },
    creditLimit: { type: 'number', required: false, min: 0 },
    credit_balance: { type: 'number', required: false },
    advance_balance: { type: 'number', required: false },
    openingBalance: { type: 'number', required: false },
    creditBalance: { type: 'number', required: false },
    advanceBalance: { type: 'number', required: false },
    loyalty_points: { type: 'number', required: false },
    loyaltyPoints: { type: 'number', required: false },
    groupId: { type: 'string', required: false, maxLength: 100 },
    group_id: { type: 'string', required: false, maxLength: 100 },
    customer_code: { type: 'string', required: false, maxLength: 50 },
    customerCode: { type: 'string', required: false, maxLength: 50 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  // ── 2. Bills ─────────────────────────────────────────────────────────────────
  billCreate: {
    id: { type: 'string', required: false, maxLength: 100 },
    bill_number: { type: 'string', required: false, maxLength: 50 },
    invoice_number: { type: 'string', required: false, maxLength: 50 },
    customer_id: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    date: { type: 'string', required: true, format: 'date' },
    due_date: { type: 'string', required: false, format: 'date' },
    items: {
      type: 'array',
      required: true,
      minItems: 1,
      maxItems: 200,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: false, maxLength: 100 },
          name: { type: 'string', required: false, minLength: 1, maxLength: 150 },
          item_name: { type: 'string', required: false, minLength: 1, maxLength: 150 },
          itemName: { type: 'string', required: false, minLength: 1, maxLength: 150 },
          category: { type: 'string', required: false, maxLength: 50 },
          item_type: { type: 'string', required: false, maxLength: 50 },
          print_type: { type: 'string', required: false, maxLength: 50 },
          printType: { type: 'string', required: false, maxLength: 50 },
          sides: { type: 'string', required: false, maxLength: 50 },
          qty: { type: 'number', required: true, min: 0.01 },
          unit_price: { type: 'number', required: false, min: 0 },
          unitPrice: { type: 'number', required: false, min: 0 },
          rate: { type: 'number', required: false, min: 0 },
          amount: { type: 'number', required: false, min: 0 },
          unit: { type: 'string', required: false, maxLength: 30 }
        }
      }
    },
    subtotal: { type: 'number', required: false, min: 0 },
    discount_type: { type: 'string', required: false, allowedValues: ['flat', 'percentage', 'percent'] },
    discount_value: { type: 'number', required: false, min: 0 },
    gst_percent: { type: 'number', required: false, min: 0, max: 100 },
    gst_amount: { type: 'number', required: false, min: 0 },
    total: { type: 'number', required: false, min: 0 },
    amount_paid: { type: 'number', required: false, min: 0 },
    balance: { type: 'number', required: false, min: 0 },
    status: { type: 'string', required: false, allowedValues: ['unpaid', 'partial', 'paid', 'cancelled'] },
    payment_method: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'mixed', 'split', 'credit', 'pending'] },
    notes: { type: 'string', required: false, maxLength: 1000 },
    apply_advance: { type: 'boolean', required: false },
    advance_used: { type: 'number', required: false, min: 0 },
    advanceUsed: { type: 'number', required: false, min: 0 },
    creditUsed: { type: 'number', required: false, min: 0 },
    upi_ref: { type: 'string', required: false, maxLength: 100 }
  },

  billUpdate: {
    id: { type: 'string', required: false, maxLength: 100 },
    bill_number: { type: 'string', required: false, maxLength: 50 },
    invoice_number: { type: 'string', required: false, maxLength: 50 },
    customer_id: { type: 'string', required: false, minLength: 1, maxLength: 100 },
    date: { type: 'string', required: false, format: 'date' },
    due_date: { type: 'string', required: false, format: 'date' },
    items: {
      type: 'array',
      required: false,
      minItems: 1,
      maxItems: 200,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: false, maxLength: 100 },
          name: { type: 'string', required: false, minLength: 1, maxLength: 150 },
          item_name: { type: 'string', required: false, minLength: 1, maxLength: 150 },
          itemName: { type: 'string', required: false, minLength: 1, maxLength: 150 },
          category: { type: 'string', required: false, maxLength: 50 },
          item_type: { type: 'string', required: false, maxLength: 50 },
          print_type: { type: 'string', required: false, maxLength: 50 },
          printType: { type: 'string', required: false, maxLength: 50 },
          sides: { type: 'string', required: false, maxLength: 50 },
          qty: { type: 'number', required: false, min: 0.01 },
          unit_price: { type: 'number', required: false, min: 0 },
          unitPrice: { type: 'number', required: false, min: 0 },
          rate: { type: 'number', required: false, min: 0 },
          amount: { type: 'number', required: false, min: 0 },
          unit: { type: 'string', required: false, maxLength: 30 }
        }
      }
    },
    subtotal: { type: 'number', required: false, min: 0 },
    discount_type: { type: 'string', required: false, allowedValues: ['flat', 'percentage', 'percent'] },
    discount_value: { type: 'number', required: false, min: 0 },
    gst_percent: { type: 'number', required: false, min: 0, max: 100 },
    gst_amount: { type: 'number', required: false, min: 0 },
    total: { type: 'number', required: false, min: 0 },
    amount_paid: { type: 'number', required: false, min: 0 },
    balance: { type: 'number', required: false, min: 0 },
    status: { type: 'string', required: false, allowedValues: ['unpaid', 'partial', 'paid', 'cancelled'] },
    advance_used: { type: 'number', required: false, min: 0 },
    advanceUsed: { type: 'number', required: false, min: 0 },
    notes: { type: 'string', required: false, maxLength: 1000 },
    pin_override: { type: 'boolean', required: false },
    pinOverride: { type: 'boolean', required: false },
    security_pin: { type: 'string', required: false, maxLength: 50 },
    refund_action: { type: 'string', required: false, maxLength: 50 },
    refundAction: { type: 'string', required: false, maxLength: 50 },
    is_refund: { type: 'boolean', required: false }
  },

  billRestore: {
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  billDiscount: {
    discount_value: { type: 'number', required: true, min: 0 },
    discount_type: { type: 'string', required: false, allowedValues: ['flat', 'percentage', 'percent'] },
    pin_override: { type: 'string', required: false, maxLength: 50 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  // ── 3. Payments ──────────────────────────────────────────────────────────────
  paymentCreate: {
    id: { type: 'string', required: false, maxLength: 100 },
    bill_id: { type: 'string', required: false, maxLength: 100 },
    customer_id: { type: 'string', required: false, maxLength: 100 },
    cash_amount: { type: 'number', required: false, min: 0 },
    upi_amount: { type: 'number', required: false, min: 0 },
    total_paid: { type: 'number', required: false, min: 0 },
    payment_type: { type: 'string', required: false, allowedValues: ['full', 'partial', 'refund'] },
    is_refund: { type: 'boolean', required: false },
    amount: { type: 'number', required: false, min: 0 },
    notes: { type: 'string', required: false, maxLength: 500 },
    upi_ref: { type: 'string', required: false, maxLength: 100 },
    session_id: { type: 'number', required: false, min: 0 },
    date: { type: 'string', required: false, format: 'datetime' }
  },

  paymentRefund: {
    payment_id: { type: 'number', required: false, min: 1 },
    bill_id: { type: 'string', required: false, maxLength: 100 },
    customer_id: { type: 'string', required: false, maxLength: 100 },
    amount: { type: 'number', required: false, min: 0 },
    refund_amount: { type: 'number', required: false, min: 0 },
    cash_amount: { type: 'number', required: false, min: 0 },
    upi_amount: { type: 'number', required: false, min: 0 },
    advance_refund_amount: { type: 'number', required: false, min: 0 },
    refund_method: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'credit', 'original', 'direct'] },
    reason: { type: 'string', required: false, maxLength: 500 },
    notes: { type: 'string', required: false, maxLength: 500 },
    session_id: { type: 'number', required: false, min: 0 },
    pin_override: { type: 'boolean', required: false },
    pinOverride: { type: 'boolean', required: false },
    security_pin: { type: 'string', required: false, maxLength: 50 }
  },

  // ── 4. Inventory ─────────────────────────────────────────────────────────────
  inventoryCreate: {
    id: { type: 'string', required: false, maxLength: 100 },
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    category: { type: 'string', required: false, maxLength: 50 },
    unit: { type: 'string', required: false, maxLength: 30 },
    unit_cost: { type: 'number', required: false, min: 0 },
    unitCost: { type: 'number', required: false, min: 0 },
    selling_price: { type: 'number', required: false, min: 0 },
    sellingPrice: { type: 'number', required: false, min: 0 },
    color_single: { type: 'number', required: false, min: 0 },
    colorSingle: { type: 'number', required: false, min: 0 },
    color_double: { type: 'number', required: false, min: 0 },
    colorDouble: { type: 'number', required: false, min: 0 },
    bw_single: { type: 'number', required: false, min: 0 },
    bwSingle: { type: 'number', required: false, min: 0 },
    bw_double: { type: 'number', required: false, min: 0 },
    bwDouble: { type: 'number', required: false, min: 0 },
    stock: { type: 'number', required: false, min: 0 },
    low_stock_alert: { type: 'number', required: false, min: 0 },
    lowStockAlert: { type: 'number', required: false, min: 0 },
    item_type: { type: 'string', required: false, maxLength: 50 },
    itemType: { type: 'string', required: false, maxLength: 50 },
    unit_price: { type: 'number', required: false, min: 0 },
    unitPrice: { type: 'number', required: false, min: 0 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  inventoryUpdate: {
    id: { type: 'string', required: false, maxLength: 100 },
    name: { type: 'string', required: false, minLength: 1, maxLength: 100 },
    category: { type: 'string', required: false, maxLength: 50 },
    unit: { type: 'string', required: false, maxLength: 30 },
    unit_cost: { type: 'number', required: false, min: 0 },
    unitCost: { type: 'number', required: false, min: 0 },
    selling_price: { type: 'number', required: false, min: 0 },
    sellingPrice: { type: 'number', required: false, min: 0 },
    color_single: { type: 'number', required: false, min: 0 },
    colorSingle: { type: 'number', required: false, min: 0 },
    color_double: { type: 'number', required: false, min: 0 },
    colorDouble: { type: 'number', required: false, min: 0 },
    bw_single: { type: 'number', required: false, min: 0 },
    bwSingle: { type: 'number', required: false, min: 0 },
    bw_double: { type: 'number', required: false, min: 0 },
    bwDouble: { type: 'number', required: false, min: 0 },
    stock: { type: 'number', required: false, min: 0 },
    low_stock_alert: { type: 'number', required: false, min: 0 },
    lowStockAlert: { type: 'number', required: false, min: 0 },
    item_type: { type: 'string', required: false, maxLength: 50 },
    itemType: { type: 'string', required: false, maxLength: 50 },
    unit_price: { type: 'number', required: false, min: 0 },
    unitPrice: { type: 'number', required: false, min: 0 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  inventoryStock: {
    stock: { type: 'number', required: true, min: 0 }
  },

  // ── 5. Purchases ─────────────────────────────────────────────────────────────
  purchaseCreate: {
    id: { type: 'string', required: false, maxLength: 100 },
    expense_number: { type: 'string', required: false, maxLength: 50 },
    expenseNumber: { type: 'string', required: false, maxLength: 50 },
    date: { type: 'string', required: true, format: 'date' },
    item_name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    itemName: { type: 'string', required: false, minLength: 1, maxLength: 100 },
    name: { type: 'string', required: false, minLength: 1, maxLength: 100 },
    category: { type: 'string', required: true, minLength: 1, maxLength: 50 },
    qty: { type: 'number', required: false, min: 1 },
    unit_cost: { type: 'number', required: false, min: 0 },
    unitCost: { type: 'number', required: false, min: 0 },
    amount: { type: 'number', required: false, min: 0 },
    total: { type: 'number', required: false, min: 0 },
    notes: { type: 'string', required: false, maxLength: 500 },
    vendor_name: { type: 'string', required: false, maxLength: 100 },
    vendorName: { type: 'string', required: false, maxLength: 100 },
    payment_method: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'bank_transfer', 'credit'] },
    paymentMethod: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'bank_transfer', 'credit'] },
    upi_ref: { type: 'string', required: false, maxLength: 100 },
    upiRef: { type: 'string', required: false, maxLength: 100 },
    session_id: { type: 'number', required: false, min: 0 }
  },

  purchaseUpdate: {
    id: { type: 'string', required: false, maxLength: 100 },
    expense_number: { type: 'string', required: false, maxLength: 50 },
    expenseNumber: { type: 'string', required: false, maxLength: 50 },
    date: { type: 'string', required: false, format: 'date' },
    item_name: { type: 'string', required: false, minLength: 1, maxLength: 100 },
    itemName: { type: 'string', required: false, minLength: 1, maxLength: 100 },
    category: { type: 'string', required: false, minLength: 1, maxLength: 50 },
    qty: { type: 'number', required: false, min: 1 },
    unit_cost: { type: 'number', required: false, min: 0 },
    unitCost: { type: 'number', required: false, min: 0 },
    total: { type: 'number', required: false, min: 0 },
    notes: { type: 'string', required: false, maxLength: 500 },
    vendor_name: { type: 'string', required: false, maxLength: 100 },
    vendorName: { type: 'string', required: false, maxLength: 100 },
    payment_method: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'bank_transfer', 'credit'] },
    paymentMethod: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'bank_transfer', 'credit'] },
    upi_ref: { type: 'string', required: false, maxLength: 100 }
  },

  // ── 6. Advance Payments ──────────────────────────────────────────────────────
  advancePaymentCreate: {
    id: { type: 'string', required: false, maxLength: 100 },
    advance_number: { type: 'string', required: false, maxLength: 50 },
    advanceNumber: { type: 'string', required: false, maxLength: 50 },
    customer_id: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    customerId: { type: 'string', required: false, maxLength: 100 },
    amount: { type: 'number', required: true, min: 0.01 },
    payment_mode: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] },
    paymentMode: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] },
    paymentMethod: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] },
    type: { type: 'string', required: false, allowedValues: ['deposit', 'applied', 'refund', 'return'] },
    bill_id: { type: 'string', required: false, maxLength: 100 },
    notes: { type: 'string', required: false, maxLength: 500 },
    date: { type: 'string', required: false, format: 'datetime' }
  },

  advancePaymentUpdate: {
    id: { type: 'string', required: false, maxLength: 100 },
    advance_number: { type: 'string', required: false, maxLength: 50 },
    advanceNumber: { type: 'string', required: false, maxLength: 50 },
    amount: { type: 'number', required: false, min: 0.01 },
    payment_mode: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] },
    paymentMode: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] },
    paymentMethod: { type: 'string', required: false, allowedValues: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] },
    type: { type: 'string', required: false, allowedValues: ['deposit', 'applied', 'refund', 'return'] },
    bill_id: { type: 'string', required: false, maxLength: 100 },
    notes: { type: 'string', required: false, maxLength: 500 },
    date: { type: 'string', required: false, format: 'datetime' }
  },

  // ── 7. Customer Groups & Group Bills ─────────────────────────────────────────
  customerGroupCreate: {
    id: { type: 'string', required: false, maxLength: 100 },
    group_code: { type: 'string', required: false, maxLength: 50 },
    groupCode: { type: 'string', required: false, maxLength: 50 },
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    description: { type: 'string', required: false, maxLength: 500 },
    member_ids: { type: 'array', required: false, maxItems: 100 },
    memberIds: { type: 'array', required: false, maxItems: 100 },
    members: { type: 'array', required: false, maxItems: 100 }
  },

  customerGroupUpdate: {
    id: { type: 'string', required: false, maxLength: 100 },
    group_code: { type: 'string', required: false, maxLength: 50 },
    groupCode: { type: 'string', required: false, maxLength: 50 },
    name: { type: 'string', required: false, minLength: 1, maxLength: 100 },
    description: { type: 'string', required: false, maxLength: 500 },
    member_ids: { type: 'array', required: false, maxItems: 100 },
    memberIds: { type: 'array', required: false, maxItems: 100 },
    members: { type: 'array', required: false, maxItems: 100 }
  },

  customerGroupBill: {
    id: { type: 'string', required: false, maxLength: 100 },
    title: { type: 'string', required: false, maxLength: 150 },
    date: { type: 'string', required: false, format: 'date' },
    total_amount: { type: 'number', required: false, min: 0 },
    totalAmount: { type: 'number', required: false, min: 0 },
    amount_paid: { type: 'number', required: false, min: 0 },
    amountPaid: { type: 'number', required: false, min: 0 },
    status: { type: 'string', required: false, allowedValues: ['unpaid', 'partial', 'paid', 'cancelled'] },
    member_shares: { type: 'array', required: false, maxItems: 100 },
    memberShares: { type: 'array', required: false, maxItems: 100 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  groupBillCreate: {
    id: { type: 'string', required: false, maxLength: 100 },
    group_id: { type: 'string', required: false, maxLength: 100 },
    groupId: { type: 'string', required: false, maxLength: 100 },
    title: { type: 'string', required: false, maxLength: 150 },
    date: { type: 'string', required: false, format: 'date' },
    total_amount: { type: 'number', required: false, min: 0 },
    totalAmount: { type: 'number', required: false, min: 0 },
    amount_paid: { type: 'number', required: false, min: 0 },
    amountPaid: { type: 'number', required: false, min: 0 },
    status: { type: 'string', required: false, allowedValues: ['unpaid', 'partial', 'paid', 'cancelled'] },
    member_shares: { type: 'array', required: false, maxItems: 100 },
    memberShares: { type: 'array', required: false, maxItems: 100 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  groupBillUpdate: {
    id: { type: 'string', required: false, maxLength: 100 },
    title: { type: 'string', required: false, maxLength: 150 },
    date: { type: 'string', required: false, format: 'date' },
    total_amount: { type: 'number', required: false, min: 0 },
    totalAmount: { type: 'number', required: false, min: 0 },
    amount_paid: { type: 'number', required: false, min: 0 },
    amountPaid: { type: 'number', required: false, min: 0 },
    status: { type: 'string', required: false, allowedValues: ['unpaid', 'partial', 'paid', 'cancelled'] },
    member_shares: { type: 'array', required: false, maxItems: 100 },
    memberShares: { type: 'array', required: false, maxItems: 100 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  groupBillPayMember: {
    memberId: { type: 'string', required: false, maxLength: 100 },
    customerId: { type: 'string', required: false, maxLength: 100 },
    paymentAmount: { type: 'number', required: true, min: 0.01 },
    paymentMethod: { type: 'object', required: false },
    notes: { type: 'string', required: false, maxLength: 500 },
    upi_ref: { type: 'string', required: false, maxLength: 100 }
  },

  // ── 8. Cash Sessions ─────────────────────────────────────────────────────────
  cashSessionOpen: {
    opening_cash: { type: 'number', required: false, min: 0 },
    opening_float: { type: 'number', required: false, min: 0 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  cashSessionClose: {
    closing_cash: { type: 'number', required: false, min: 0 },
    physical_count: { type: 'number', required: false, min: 0 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  // ── 9. Promo Codes ───────────────────────────────────────────────────────────
  promoValidate: {
    code: { type: 'string', required: true, minLength: 1, maxLength: 50 },
    customer_id: { type: 'string', required: false, maxLength: 100 },
    bill_amount: { type: 'number', required: false, min: 0 }
  },

  promoUse: {
    promo_code_id: { type: 'number', required: false, min: 1 },
    code: { type: 'string', required: false, maxLength: 50 },
    bill_id: { type: 'string', required: false, maxLength: 100 },
    customer_id: { type: 'string', required: false, maxLength: 100 },
    discount_applied: { type: 'number', required: false, min: 0 }
  },

  promoBulkGenerate: {
    count: { type: 'number', required: false, min: 1, max: 100 },
    prefix: { type: 'string', required: false, minLength: 1, maxLength: 20 },
    discount_type: { type: 'string', required: false, allowedValues: ['flat', 'percentage', 'percent'] },
    discount_value: { type: 'number', required: false, min: 0 },
    min_bill_amount: { type: 'number', required: false, min: 0 },
    max_discount: { type: 'number', required: false, min: 0 },
    usage_limit: { type: 'number', required: false, min: 1 },
    max_uses_per_customer: { type: 'number', required: false, min: 1 },
    valid_from: { type: 'string', required: false, format: 'date' },
    valid_until: { type: 'string', required: false, format: 'date' },
    is_active: { type: 'boolean', required: false }
  },

  promoCreate: {
    code: { type: 'string', required: true, minLength: 1, maxLength: 50 },
    discount_type: { type: 'string', required: false, allowedValues: ['flat', 'percentage', 'percent'] },
    discount_value: { type: 'number', required: false, min: 0 },
    min_bill_amount: { type: 'number', required: false, min: 0 },
    max_discount: { type: 'number', required: false, min: 0 },
    usage_limit: { type: 'number', required: false, min: 1 },
    max_uses_per_customer: { type: 'number', required: false, min: 1 },
    valid_from: { type: 'string', required: false, format: 'date' },
    valid_until: { type: 'string', required: false, format: 'date' },
    is_active: { type: 'boolean', required: false }
  },

  promoUpdate: {
    code: { type: 'string', required: false, minLength: 1, maxLength: 50 },
    discount_type: { type: 'string', required: false, allowedValues: ['flat', 'percentage', 'percent'] },
    discount_value: { type: 'number', required: false, min: 0 },
    min_bill_amount: { type: 'number', required: false, min: 0 },
    max_discount: { type: 'number', required: false, min: 0 },
    usage_limit: { type: 'number', required: false, min: 1 },
    max_uses_per_customer: { type: 'number', required: false, min: 1 },
    valid_from: { type: 'string', required: false, format: 'date' },
    valid_until: { type: 'string', required: false, format: 'date' },
    is_active: { type: 'boolean', required: false }
  },

  // ── 10. Loyalty ──────────────────────────────────────────────────────────────
  loyaltySettings: {
    points_per_rupee: { type: 'number', required: false, min: 0 },
    rupee_per_point: { type: 'number', required: false, min: 0 },
    min_points_redeem: { type: 'number', required: false, min: 0 },
    tier_config: { type: 'array', required: false },
    redeem_options: { type: 'array', required: false },
    is_enabled: { type: 'boolean', required: false }
  },

  loyaltyAdjust: {
    points: { type: 'number', required: true },
    event_type: { type: 'string', required: false, allowedValues: ['manual_add', 'manual_deduct', 'adjustment'] },
    notes: { type: 'string', required: false, maxLength: 500 },
    operation: { type: 'string', required: false, allowedValues: ['add', 'deduct'] }
  },

  loyaltyEarn: {
    customer_id: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    bill_id: { type: 'string', required: false, maxLength: 100 },
    points: { type: 'number', required: true, min: 1 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  loyaltyRedeem: {
    customer_id: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    bill_id: { type: 'string', required: false, maxLength: 100 },
    points: { type: 'number', required: true, min: 1 },
    notes: { type: 'string', required: false, maxLength: 500 }
  },

  // ── 11. Profile & Settings ───────────────────────────────────────────────────
  profileUpdate: {
    shop_name: { type: 'string', required: false, maxLength: 100 },
    shopName: { type: 'string', required: false, maxLength: 100 },
    owner_name: { type: 'string', required: false, maxLength: 100 },
    ownerName: { type: 'string', required: false, maxLength: 100 },
    phone: { type: 'string', required: false, maxLength: 25, format: 'phone' },
    address: { type: 'string', required: false, maxLength: 300 },
    gstin: { type: 'string', required: false, maxLength: 20 },
    upi_id: { type: 'string', required: false, maxLength: 100 },
    upiId: { type: 'string', required: false, maxLength: 100 }
  },

  settingsUpdate: {
    settings: { type: 'object', required: true }
  },

  // ── 12. Share & UPI Transactions ─────────────────────────────────────────────
  shareUploadPdf: {
    billId: { type: 'string', required: true, minLength: 1, maxLength: 100 }
  },

  upiTransactionCreate: {
    payment_id: { type: 'number', required: false, min: 1 },
    bill_id: { type: 'string', required: false, maxLength: 100 },
    customer_id: { type: 'string', required: false, maxLength: 100 },
    amount: { type: 'number', required: true, min: 0.01 },
    upi_ref: { type: 'string', required: false, maxLength: 100 },
    upi_id: { type: 'string', required: false, maxLength: 100 },
    date: { type: 'string', required: false, format: 'datetime' },
    metadata: { type: 'object', required: false }
  },

  upiTransactionUpdate: {
    upi_ref: { type: 'string', required: false, maxLength: 100 },
    status: { type: 'string', required: false, allowedValues: ['pending', 'confirmed', 'failed'] },
    upi_id: { type: 'string', required: false, maxLength: 100 },
    metadata: { type: 'object', required: false }
  },

  upiTransactionBulkConfirm: {
    ids: { type: 'array', required: true, minItems: 1, maxItems: 100 },
    status: { type: 'string', required: false, allowedValues: ['confirmed', 'failed', 'pending'] }
  },

  // ── 13. PDF Export Schemas ───────────────────────────────────────────────────
  ledgerPdf: {
    startDate: { type: 'string', required: false, format: 'date' },
    endDate: { type: 'string', required: false, format: 'date' }
  },

  reportsEodPdf: {
    date: { type: 'string', required: false, format: 'date' }
  }
};

module.exports = schemas;
