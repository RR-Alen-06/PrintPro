/**
 * CreditService - Centralized credit limits, customer code formatting, and advance drawdown arithmetic engine.
 */

export interface CustomerCreditProfile {
  id: string;
  customer_code?: string | null;
  name: string;
  type?: 'regular' | 'random';
  credit_limit?: number | null;
  credit_balance?: number | null;
  advance_balance?: number | null;
}

export interface AdvanceDrawdownResult {
  advanceUsed: number;
  remainingAdvance: number;
  netBillAmount: number;
}

export interface CreditCheckResult {
  isAllowed: boolean;
  currentBalance: number;
  creditLimit: number;
  newBalance: number;
  exceededBy: number;
}

export class CreditService {
  /**
   * Formats a robust, fallback-safe customer code.
   * Prevents NULL customer_code from rendering as 'undefined' or blank.
   */
  static formatCustomerCode(customer: { id?: string; customer_code?: string | null; code?: string | null; type?: string }): string {
    if (customer.customer_code && customer.customer_code.trim()) {
      return customer.customer_code.trim().toUpperCase();
    }
    if (customer.code && customer.code.trim()) {
      return customer.code.trim().toUpperCase();
    }
    if (customer.id) {
      const cleanId = String(customer.id).replace(/-/g, '').slice(0, 6).toUpperCase();
      return `CUS-${cleanId}`;
    }
    return customer.type === 'random' ? 'CUS-WALKIN' : 'CUS-GENERAL';
  }

  /**
   * Computes deterministic FIFO advance drawdown against bill total.
   * Strict bug fix: Advance drawdown can NEVER exceed the bill total.
   * Strict arithmetic: Coerces all inputs to numbers to prevent string concatenation bugs.
   */
  static calculateAdvanceDrawdown(
    availableAdvance: number | string,
    billTotal: number | string
  ): AdvanceDrawdownResult {
    const numAdvance = Math.max(0, Number(availableAdvance) || 0);
    const numTotal = Math.max(0, Number(billTotal) || 0);

    // Advance used is the smaller of available advance and bill total
    const advanceUsed = Number(Math.min(numAdvance, numTotal).toFixed(2));
    const remainingAdvance = Number(Math.max(0, numAdvance - advanceUsed).toFixed(2));
    const netBillAmount = Number(Math.max(0, numTotal - advanceUsed).toFixed(2));

    return {
      advanceUsed,
      remainingAdvance,
      netBillAmount,
    };
  }

  /**
   * Checks if an unpaid or partially paid bill exceeds the customer's credit limit.
   */
  static checkCreditLimit(
    currentOutstandingBalance: number | string,
    creditLimit: number | string,
    newBillUnpaidAmount: number | string
  ): CreditCheckResult {
    const currentBalance = Math.max(0, Number(currentOutstandingBalance) || 0);
    const limit = Math.max(0, Number(creditLimit) || 0);
    const unpaidAmount = Math.max(0, Number(newBillUnpaidAmount) || 0);

    const newBalance = Number((currentBalance + unpaidAmount).toFixed(2));

    // If credit limit is 0 or unset, no ceiling is enforced (unlimited/not restricted)
    if (limit <= 0) {
      return {
        isAllowed: true,
        currentBalance,
        creditLimit: 0,
        newBalance,
        exceededBy: 0,
      };
    }

    const isAllowed = newBalance <= limit + 0.01; // Allow 1 paisa floating point tolerance
    const exceededBy = isAllowed ? 0 : Number((newBalance - limit).toFixed(2));

    return {
      isAllowed,
      currentBalance,
      creditLimit: limit,
      newBalance,
      exceededBy,
    };
  }

  /**
   * Safely calculates payment split (Cash + UPI) guarding against string concatenation.
   */
  static calculatePaymentSplit(
    cashAmount: number | string,
    upiAmount: number | string,
    billTotal: number | string
  ): {
    cashPaid: number;
    upiPaid: number;
    totalPaid: number;
    balanceDue: number;
    isFullyPaid: boolean;
  } {
    const cash = Math.max(0, Number(cashAmount) || 0);
    const upi = Math.max(0, Number(upiAmount) || 0);
    const total = Math.max(0, Number(billTotal) || 0);

    const totalPaid = Number((cash + upi).toFixed(2));
    const balanceDue = Number(Math.max(0, total - totalPaid).toFixed(2));
    const isFullyPaid = totalPaid >= total - 0.01;

    return {
      cashPaid: cash,
      upiPaid: upi,
      totalPaid,
      balanceDue,
      isFullyPaid,
    };
  }

  /**
   * Smart Hybrid FIFO payment allocation across a customer's unpaid invoices.
   * Allocates to oldest unpaid bills first; any remaining payment is routed to Advance Balance.
   */
  static allocatePaymentFIFO(
    paymentAmount: number | string,
    unpaidBills: Array<{
      id: string;
      invoiceNumber?: string;
      bill_number?: string;
      date?: string;
      created_at?: string;
      total?: number;
      grand_total?: number;
      balance?: number;
      status?: string;
      deleted?: boolean;
    }>,
    selectedBillIds?: string[]
  ): {
    totalPayment: number;
    totalAllocated: number;
    excessToAdvance: number;
    allocations: Array<{
      billId: string;
      invoiceNumber: string;
      date: string;
      total: number;
      currentBalance: number;
      allocatedAmount: number;
      remainingBalance: number;
      newStatus: 'paid' | 'partial' | 'unpaid';
    }>;
  } {
    const totalPayment = Math.max(0, Number(paymentAmount) || 0);
    let remainingPayment = totalPayment;

    // Filter valid unpaid bills
    let targetBills = unpaidBills.filter(
      (b) => !b.deleted && b.status !== 'paid' && Number(b.balance || 0) > 0
    );

    if (selectedBillIds && selectedBillIds.length > 0) {
      const selectedSet = new Set(selectedBillIds.map(String));
      targetBills = targetBills.filter((b) => selectedSet.has(String(b.id)));
    }

    // Chronological Sort: Oldest unpaid first (FIFO)
    targetBills.sort(
      (a, b) =>
        new Date(a.date || a.created_at || 0).getTime() -
        new Date(b.date || b.created_at || 0).getTime()
    );

    let totalAllocated = 0;
    const allocations = targetBills.map((bill) => {
      const currentBal = Number(bill.balance || 0);
      const billTot = Number(bill.total !== undefined ? bill.total : (bill.grand_total || 0));
      const alloc = Number(Math.min(remainingPayment, currentBal).toFixed(2));

      remainingPayment = Number(Math.max(0, remainingPayment - alloc).toFixed(2));
      totalAllocated = Number((totalAllocated + alloc).toFixed(2));
      const remBal = Number(Math.max(0, currentBal - alloc).toFixed(2));
      const newStatus = remBal <= 0.001 ? ('paid' as const) : alloc > 0 ? ('partial' as const) : ('unpaid' as const);

      return {
        billId: bill.id,
        invoiceNumber: bill.invoiceNumber || bill.bill_number || `INV-${String(bill.id).slice(0, 6)}`,
        date: bill.date || bill.created_at || new Date().toISOString(),
        total: billTot,
        currentBalance: currentBal,
        allocatedAmount: alloc,
        remainingBalance: remBal,
        newStatus,
      };
    });

    const excessToAdvance = Number(remainingPayment.toFixed(2));

    return {
      totalPayment,
      totalAllocated,
      excessToAdvance,
      allocations,
    };
  }
}
