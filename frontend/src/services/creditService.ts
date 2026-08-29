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
    if (customer.id && typeof customer.id === 'string') {
      const cleanId = customer.id.replace(/-/g, '').slice(0, 6).toUpperCase();
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
}
