import { CustomerLedgerEntry, CustomerSummary } from '../types/billing';

export class LedgerService {
  /**
   * Reconstructs an authoritative, chronological customer ledger from bills and payments.
   */
  static buildCustomerLedger({
    bills,
    payments,
    advanceReturns = [],
  }: {
    bills: Array<{
      id: string;
      bill_number?: string;
      invoiceNumber?: string;
      created_at?: string;
      date?: string;
      grand_total?: number;
      total?: number;
      paid_total?: number;
      amount_paid?: number;
      advance_used?: number;
      payment_method?: string;
      loyalty_points_earned?: number;
      deleted?: boolean;
      deleted_at?: string | null;
    }>;
    payments: Array<{
      id: string;
      payment_number?: string;
      created_at?: string;
      date?: string;
      amount?: number;
      payment_method?: string;
      paymentType?: string;
      notes?: string;
      bill_id?: string | null;
      billId?: string | null;
    }>;
    advanceReturns?: Array<{
      id: string;
      created_at?: string;
      date?: string;
      amount: number;
      payment_method?: string;
      notes?: string;
    }>;
  }): {
    entries: CustomerLedgerEntry[];
    totalBilled: number;
    totalPaid: number;
    runningBalance: number;
  } {
    const rawEvents: Array<{
      date: string;
      type: 'BILL' | 'PAYMENT' | 'ADVANCE_RETURN';
      reference_no: string;
      description: string;
      bill_amount: number;
      paid_amount: number;
      advance_used: number;
      loyalty_points: number;
    }> = [];

    const nonDeletedBills = bills.filter((b) => !b.deleted && !b.deleted_at);
    const paymentBillIds = new Set(payments.map((p) => p.bill_id || p.billId).filter(Boolean));

    nonDeletedBills.forEach((b) => {
      const grandTotal = Number(b.grand_total !== undefined ? b.grand_total : (b.total || 0));
      const hasPaymentRecord = paymentBillIds.has(b.id);
      const paidTotal = Number(b.paid_total !== undefined ? b.paid_total : (b.amount_paid || 0));
      const advUsed = Number(b.advance_used || 0);
      const directPaid = hasPaymentRecord ? 0 : Math.max(0, paidTotal - advUsed);
      const effectivePaidOnBill = advUsed + directPaid;

      rawEvents.push({
        date: b.created_at || b.date || new Date().toISOString(),
        type: 'BILL',
        reference_no: b.bill_number || b.invoiceNumber || `BILL-${b.id.slice(0, 6)}`,
        description: `Bill generated (${b.payment_method || 'POS'})`,
        bill_amount: grandTotal,
        paid_amount: effectivePaidOnBill,
        advance_used: advUsed,
        loyalty_points: Number(b.loyalty_points_earned || 0),
      });
    });

    payments.forEach((p) => {
      const amt = Number(p.amount || 0);
      rawEvents.push({
        date: p.created_at || p.date || new Date().toISOString(),
        type: 'PAYMENT',
        reference_no: p.payment_number || `PAY-${p.id.slice(0, 6).toUpperCase()}`,
        description: p.notes || `Payment received via ${p.payment_method || p.paymentType || 'Cash'}`,
        bill_amount: 0,
        paid_amount: amt,
        advance_used: 0,
        loyalty_points: 0,
      });
    });

    advanceReturns.forEach((ar) => {
      const amt = Number(ar.amount || 0);
      rawEvents.push({
        date: ar.created_at || ar.date || new Date().toISOString(),
        type: 'ADVANCE_RETURN',
        reference_no: `RET-${ar.id.slice(0, 6).toUpperCase()}`,
        description: ar.notes || `Advance refunded to customer (${ar.payment_method || 'Cash'})`,
        bill_amount: amt,
        paid_amount: 0,
        advance_used: 0,
        loyalty_points: 0,
      });
    });

    // Chronological ordering
    rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    let totalBilled = 0;
    let totalPaid = 0;

    const entries: CustomerLedgerEntry[] = rawEvents.map((evt, idx) => {
      totalBilled += evt.bill_amount;
      totalPaid += evt.paid_amount;
      balance = balance + evt.bill_amount - evt.paid_amount;

      return {
        id: `ledger-${idx}`,
        date: evt.date,
        type: evt.type,
        reference_no: evt.reference_no,
        description: evt.description,
        bill_amount: evt.bill_amount,
        paid_amount: evt.paid_amount,
        advance_used: evt.advance_used,
        loyalty_points: evt.loyalty_points,
        running_balance: balance,
      };
    });

    return {
      entries,
      totalBilled: Number(totalBilled.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      runningBalance: Math.max(0, Number(balance.toFixed(2))),
    };
  }

  /**
   * Computes a customer's summary metrics (total billed, total paid, balance due, advance balance).
   */
  static computeCustomerSummary({
    customer,
    bills,
    payments,
  }: {
    customer: {
      id: string;
      user_id?: string | null;
      customer_code?: string | null;
      name: string;
      mobile?: string | null;
      phone?: string | null;
      email?: string | null;
      type?: 'regular' | 'walkin';
      credit_limit?: number;
      creditLimit?: number;
      advance_balance?: number;
      advanceBalance?: number;
      creditBalance?: number;
      loyalty_points?: number;
      loyaltyPoints?: number;
      created_at?: string;
      createdAt?: string;
    };
    bills: Array<{
      customer_id?: string;
      customerId?: string;
      grand_total?: number;
      total?: number;
      deleted?: boolean;
      deleted_at?: string | null;
    }>;
    payments: Array<{
      customer_id?: string;
      customerId?: string;
      amount?: number;
    }>;
  }): CustomerSummary {
    const custId = customer.id;
    const custBills = bills.filter(
      (b) => (b.customer_id === custId || b.customerId === custId) && !b.deleted && !b.deleted_at
    );
    const custPayments = payments.filter((p) => p.customer_id === custId || p.customerId === custId);

    const totalBilled = custBills.reduce(
      (sum, b) => sum + Number(b.grand_total !== undefined ? b.grand_total : (b.total || 0)),
      0
    );
    const totalPaid = custPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const advBalance = Number(
      customer.advance_balance !== undefined
        ? customer.advance_balance
        : customer.advanceBalance !== undefined
        ? customer.advanceBalance
        : (customer.creditBalance || 0)
    );

    const balanceDue = Math.max(0, totalBilled - totalPaid - advBalance);

    return {
      id: customer.id,
      user_id: customer.user_id,
      customer_code: customer.customer_code,
      name: customer.name,
      mobile: customer.mobile || customer.phone || null,
      email: customer.email || null,
      type: customer.type || 'regular',
      credit_limit: customer.credit_limit || customer.creditLimit || 0,
      total_billed: Number(totalBilled.toFixed(2)),
      total_paid: Number(totalPaid.toFixed(2)),
      balance_due: Number(balanceDue.toFixed(2)),
      advance_balance: Number(advBalance.toFixed(2)),
      loyalty_points: Number(customer.loyalty_points || customer.loyaltyPoints || 0),
      created_at: customer.created_at || customer.createdAt || new Date().toISOString(),
    };
  }
}
