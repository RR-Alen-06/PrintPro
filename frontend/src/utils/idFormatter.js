/**
 * Utility functions for displaying clean, human-readable identifiers
 * across the PrintPro frontend application.
 *
 * Guarantees that internal database UUIDs are never directly shown to the user.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (val) => {
  if (!val || typeof val !== 'string') return false;
  return UUID_REGEX.test(val);
};

/**
 * Format a Bill for display.
 * Prefers bill_number (e.g. 'BILL-0001'), then clean non-UUID id, otherwise clean fallback.
 */
export const getDisplayBillId = (bill) => {
  if (!bill) return 'BILL-0000';
  if (typeof bill === 'string') {
    if (!isUuid(bill)) return bill;
    return `BILL-${bill.slice(0, 4).toUpperCase()}`;
  }
  if (bill.bill_number) return bill.bill_number;
  if (bill.billNumber) return bill.billNumber;
  if (bill.invoice_number) return bill.invoice_number;
  if (bill.invoiceNumber) return bill.invoiceNumber;
  if (bill.id && !isUuid(String(bill.id))) return String(bill.id);
  if (bill.id) return `BILL-${String(bill.id).slice(0, 4).toUpperCase()}`;
  return 'BILL-0001';
};

/**
 * Format a Customer for display.
 * Prefers customer_code (e.g. 'RC-0001', 'WI-0001'), then clean non-UUID id, otherwise clean fallback.
 */
export const getDisplayCustomerId = (customer) => {
  if (!customer) return 'CUST-0000';
  if (typeof customer === 'string') {
    if (!isUuid(customer)) return customer;
    return `CUST-${customer.slice(0, 4).toUpperCase()}`;
  }
  if (customer.customer_code) return customer.customer_code;
  if (customer.customerCode) return customer.customerCode;
  if (customer.id && !isUuid(String(customer.id))) return String(customer.id);
  const prefix = customer.type === 'walk-in' || customer.type === 'random' ? 'WI' : 'RC';
  if (customer.id) return `${prefix}-${String(customer.id).slice(0, 4).toUpperCase()}`;
  return `${prefix}-0001`;
};

/**
 * Format a Payment for display.
 * Handles standard payments (PAY-0001), reversals (REV-0001), and refunds (REF-0001).
 */
export const getDisplayPaymentId = (payment) => {
  if (!payment) return 'PAY-0000';
  if (typeof payment === 'string') {
    if (!isUuid(payment)) return payment;
    return `PAY-${payment.slice(0, 4).toUpperCase()}`;
  }
  if (payment.payment_number) return payment.payment_number;
  if (payment.paymentNumber) return payment.paymentNumber;

  const isRev = payment.is_reversal || payment.payment_type === 'reversal';
  const isRef = payment.is_refund || payment.payment_type === 'refund';
  const prefix = isRev ? 'REV' : (isRef ? 'REF' : 'PAY');

  if (payment.id && !isUuid(String(payment.id))) {
    const s = String(payment.id);
    return s.startsWith(prefix) ? s : `${prefix}-${s.padStart(4, '0')}`;
  }
  if (payment.id) return `${prefix}-${String(payment.id).slice(0, 4).toUpperCase()}`;
  return `${prefix}-0001`;
};

/**
 * Format an Advance Payment for display.
 */
export const getDisplayAdvanceId = (adv) => {
  if (!adv) return 'ADV-0000';
  if (typeof adv === 'string') {
    if (!isUuid(adv)) return adv;
    return `ADV-${adv.slice(0, 4).toUpperCase()}`;
  }
  if (adv.advance_number) return adv.advance_number;
  if (adv.advanceNumber) return adv.advanceNumber;
  if (adv.id && !isUuid(String(adv.id))) return String(adv.id);
  if (adv.id) return `ADV-${String(adv.id).slice(0, 4).toUpperCase()}`;
  return 'ADV-0001';
};

/**
 * Format a Purchase / Expense for display.
 */
export const getDisplayExpenseId = (expense) => {
  if (!expense) return 'EXP-0000';
  if (typeof expense === 'string') {
    if (!isUuid(expense)) return expense;
    return `EXP-${expense.slice(0, 4).toUpperCase()}`;
  }
  if (expense.expense_number) return expense.expense_number;
  if (expense.expenseNumber) return expense.expenseNumber;
  if (expense.id && !isUuid(String(expense.id))) {
    const s = String(expense.id);
    return s.startsWith('EXP') ? s : `EXP-${s.padStart(4, '0')}`;
  }
  if (expense.id) return `EXP-${String(expense.id).slice(0, 4).toUpperCase()}`;
  return 'EXP-0001';
};

/**
 * Format a Customer Group / Split Purchase for display.
 */
export const getDisplayGroupId = (group) => {
  if (!group) return 'GRP-0000';
  if (typeof group === 'string') {
    if (!isUuid(group)) return group;
    return `GRP-${group.slice(0, 4).toUpperCase()}`;
  }
  if (group.split_purchase_id) return group.split_purchase_id;
  if (group.splitPurchaseId) return group.splitPurchaseId;
  if (group.group_code) return group.group_code;
  if (group.groupCode) return group.groupCode;
  if (group.id && !isUuid(String(group.id))) return String(group.id);
  if (group.id) return `GRP-${String(group.id).slice(0, 4).toUpperCase()}`;
  return 'GRP-0001';
};

/**
 * Format a Split Purchase ID for display.
 */
export const getDisplaySplitPurchaseId = (groupOrId) => {
  if (!groupOrId) return 'SP-0001';
  if (typeof groupOrId === 'string') {
    if (groupOrId.startsWith('SP')) return groupOrId;
    if (!isUuid(groupOrId)) return groupOrId;
    return `SP-${groupOrId.slice(0, 4).toUpperCase()}`;
  }
  if (groupOrId.split_purchase_id) return groupOrId.split_purchase_id;
  if (groupOrId.splitPurchaseId) return groupOrId.splitPurchaseId;
  if (groupOrId.id && typeof groupOrId.id === 'string' && groupOrId.id.startsWith('SP')) return groupOrId.id;
  return getDisplayGroupId(groupOrId);
};

/**
 * Format a Cash Session ID for display.
 */
export const getDisplaySessionId = (session) => {
  if (!session) return 'SESS-0000';
  if (typeof session === 'string') {
    if (!isUuid(session)) return session;
    return `SESS-${session.slice(0, 4).toUpperCase()}`;
  }
  if (session.session_number) return session.session_number;
  if (session.sessionNumber) return session.sessionNumber;
  if (session.id && !isUuid(String(session.id))) {
    const s = String(session.id);
    return s.startsWith('SESS') ? s : `SESS-${s.padStart(4, '0')}`;
  }
  if (session.id) return `SESS-${String(session.id).slice(0, 4).toUpperCase()}`;
  return 'SESS-0001';
};

/**
 * Generic display helper for any item.
 */
export const formatDisplayId = (item, entityType = 'generic') => {
  if (!item) return '';
  switch (entityType) {
    case 'bill':
      return getDisplayBillId(item);
    case 'customer':
      return getDisplayCustomerId(item);
    case 'payment':
    case 'payment_reversal':
    case 'reversal':
    case 'refund':
      return getDisplayPaymentId(item);
    case 'advance':
      return getDisplayAdvanceId(item);
    case 'expense':
    case 'purchase':
      return getDisplayExpenseId(item);
    case 'group':
      return getDisplayGroupId(item);
    case 'split_purchase':
      return getDisplaySplitPurchaseId(item);
    case 'cash_session':
    case 'session':
      return getDisplaySessionId(item);
    default: {
      const raw = typeof item === 'object' ? (item.id || '') : String(item);
      if (!isUuid(raw)) return raw;
      return raw.slice(0, 8).toUpperCase();
    }
  }
};
