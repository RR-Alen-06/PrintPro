import { DateFilterOption, PaymentSummary } from '../types/billing';

export interface DrawerVarianceResult {
  openingBalance: number;
  cashSales: number;
  cashExpenses: number;
  expectedCash: number;
  physicalCount: number;
  variance: number;
  status: 'balanced' | 'surplus' | 'shortage';
}

export class ReconciliationService {
  /**
   * Calculates boundary dates for given filter option.
   */
  static getDateRangeBounds(
    filter: DateFilterOption,
    customRange?: { from: string; to: string }
  ): { startDate?: Date; endDate?: Date } {
    const now = new Date();
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    switch (filter) {
      case 'today':
        return { startDate, endDate };
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
        return { startDate, endDate };
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        return { startDate, endDate };
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        return { startDate, endDate };
      case 'quarterly':
        startDate.setMonth(startDate.getMonth() - 3);
        return { startDate, endDate };
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - 1);
        return { startDate, endDate };
      case 'financial_year': {
        const currentYear = now.getFullYear();
        const fyStart = now.getMonth() >= 3 ? new Date(currentYear, 3, 1) : new Date(currentYear - 1, 3, 1);
        return { startDate: fyStart, endDate };
      }
      case 'custom':
        if (customRange?.from && customRange?.to) {
          const s = new Date(customRange.from);
          s.setHours(0, 0, 0, 0);
          const e = new Date(customRange.to);
          e.setHours(23, 59, 59, 999);
          return { startDate: s, endDate: e };
        }
        return {};
      default:
        return {};
    }
  }

  /**
   * Calculates total cash from currency denomination counts.
   */
  static calculateDenominationsTotal(denominations: Record<number | string, number>): number {
    let total = 0;
    Object.entries(denominations || {}).forEach(([denom, count]) => {
      const d = Number(denom);
      const c = Number(count);
      if (!isNaN(d) && !isNaN(c) && c > 0) {
        total += d * c;
      }
    });
    return Number(total.toFixed(2));
  }

  /**
   * Calculates drawer reconciliation variance:
   * expectedCash = openingBalance + cashSales - cashExpenses
   * variance = physicalCount - expectedCash
   */
  static calculateDrawerVariance({
    openingBalance = 0,
    cashSales = 0,
    cashExpenses = 0,
    physicalCount = 0,
  }: {
    openingBalance?: number;
    cashSales?: number;
    cashExpenses?: number;
    physicalCount?: number;
  }): DrawerVarianceResult {
    const opening = Number(openingBalance || 0);
    const sales = Number(cashSales || 0);
    const expenses = Number(cashExpenses || 0);
    const count = Number(physicalCount || 0);

    const expectedCash = Number((opening + sales - expenses).toFixed(2));
    const variance = Number((count - expectedCash).toFixed(2));

    let status: 'balanced' | 'surplus' | 'shortage' = 'balanced';
    if (variance > 0.01) {
      status = 'surplus';
    } else if (variance < -0.01) {
      status = 'shortage';
    }

    return {
      openingBalance: opening,
      cashSales: sales,
      cashExpenses: expenses,
      expectedCash,
      physicalCount: count,
      variance,
      status,
    };
  }

  /**
   * Computes payment reconciliation with single source of truth from payments table,
   * with fallback for bills lacking individual payment records.
   */
  static computePaymentReconciliation({
    bills,
    payments,
    customersAdvanceBalance = 0,
  }: {
    bills: Array<{
      id: string;
      grand_total?: number;
      total?: number;
      paid_total?: number;
      amount_paid?: number;
      cash_paid?: number;
      upi_paid?: number;
      payment_method?: string;
      paymentMethod?: { cash?: number; upi?: number } | string;
      deleted?: boolean;
      deleted_at?: string | null;
      created_at?: string;
      date?: string;
    }>;
    payments: Array<{
      id: string;
      bill_id?: string | null;
      billId?: string | null;
      amount?: number;
      totalPaid?: number;
      payment_method?: string;
      paymentType?: string;
      cashAmount?: number;
      upiAmount?: number;
      created_at?: string;
      date?: string;
    }>;
    customersAdvanceBalance?: number;
  }): PaymentSummary {
    let cashCollected = 0;
    let upiCollected = 0;

    const billsWithPaymentRecords = new Set<string>();

    // 1. Primary: Aggregate from payment records
    payments.forEach((p) => {
      const billId = p.bill_id || p.billId;
      if (billId) billsWithPaymentRecords.add(billId);

      const amt = Number(p.amount !== undefined ? p.amount : (p.totalPaid || 0));
      const method = (p.payment_method || p.paymentType || '').toLowerCase();
      const pCash = Number(p.cashAmount || 0);
      const pUpi = Number(p.upiAmount || 0);

      if (pCash > 0 || pUpi > 0) {
        cashCollected += pCash;
        upiCollected += pUpi;
      } else if (method === 'cash') {
        cashCollected += amt;
      } else if (method === 'upi') {
        upiCollected += amt;
      } else {
        // Default to cash if unspecified
        cashCollected += amt;
      }
    });

    // 2. Fallback: For older bills created without individual payment rows
    const nonDeletedBills = bills.filter((b) => !b.deleted && !b.deleted_at);
    let totalSales = 0;
    let outstandingAmount = 0;

    nonDeletedBills.forEach((b) => {
      const gTotal = Number(b.grand_total !== undefined ? b.grand_total : (b.total || 0));
      const pTotal = Number(b.paid_total !== undefined ? b.paid_total : (b.amount_paid || 0));
      totalSales += gTotal;
      outstandingAmount += Math.max(0, gTotal - pTotal);

      if (!billsWithPaymentRecords.has(b.id)) {
        let bCash = Number(b.cash_paid || 0);
        let bUpi = Number(b.upi_paid || 0);

        if (bCash === 0 && bUpi === 0 && typeof b.paymentMethod === 'object' && b.paymentMethod) {
          bCash = Number(b.paymentMethod.cash || 0);
          bUpi = Number(b.paymentMethod.upi || 0);
        }

        if (bCash === 0 && bUpi === 0 && pTotal > 0) {
          const meth = (typeof b.payment_method === 'string' ? b.payment_method : '').toLowerCase();
          if (meth === 'upi') bUpi = pTotal;
          else bCash = pTotal;
        }

        cashCollected += bCash;
        upiCollected += bUpi;
      }
    });

    const totalAmountCollected = Number((cashCollected + upiCollected).toFixed(2));

    return {
      total_sales: Number(totalSales.toFixed(2)),
      cash_collected: Number(cashCollected.toFixed(2)),
      upi_collected: Number(upiCollected.toFixed(2)),
      total_amount_collected: totalAmountCollected,
      outstanding_amount: Number(outstandingAmount.toFixed(2)),
      customer_advance_balance: Number(customersAdvanceBalance.toFixed(2)),
      payment_method_breakdown: [
        { method: 'Cash', amount: Number(cashCollected.toFixed(2)) },
        { method: 'UPI', amount: Number(upiCollected.toFixed(2)) },
        { method: 'Total Collected', amount: totalAmountCollected },
      ],
      daily_collection_trend: [],
      monthly_collection_trend: [],
    };
  }

  /**
   * Reconciles bills with payment records by applying direct bill-linked payments
   * and distributing unlinked customer payments chronologically across open bills (FIFO).
   */
  static reconcileBillsWithPayments(
    bills: any[] = [],
    payments: any[] = []
  ): any[] {
    const activeBills = (bills || []).filter(
      (b: any) => !b.deleted && !b.deleted_at && !b.isGroupParent && !b.is_group_parent
    );
    const billPaymentsMap = new Map<string, number>();
    const custUnlinkedPaymentsMap = new Map<string, number>();

    (payments || []).forEach((p: any) => {
      const isRefund =
        p.isRefund ||
        p.payment_type === 'refund' ||
        p.paymentType === 'refund' ||
        Number(p.totalPaid !== undefined ? p.totalPaid : (p.amount || 0)) < 0;
      if (isRefund) return;

      const bId = p.bill_id || p.billId;
      const cId = p.customer_id || p.customerId;
      const cash = Number(p.cash_amount !== undefined ? p.cash_amount : (p.cashAmount || 0));
      const upi = Number(p.upi_amount !== undefined ? p.upi_amount : (p.upiAmount || 0));
      const total = Number(
        p.total_paid !== undefined
          ? p.total_paid
          : p.totalPaid !== undefined
          ? p.totalPaid
          : p.amount !== undefined
          ? p.amount
          : cash + upi
      );

      if (bId) {
        const key = String(bId);
        billPaymentsMap.set(key, Number(((billPaymentsMap.get(key) || 0) + total).toFixed(2)));
      } else if (cId && cId !== 'null' && cId !== 'undefined' && cId !== 'Customer' && String(cId).trim() !== '') {
        const key = String(cId).trim();
        custUnlinkedPaymentsMap.set(key, Number(((custUnlinkedPaymentsMap.get(key) || 0) + total).toFixed(2)));
      }
    });

    // Map each active bill with direct payments
    const reconciledBills = activeBills.map((b: any) => {
      const bId = String(b.id);
      let bTotal = Number(
        b.total !== undefined && b.total !== null && Number(b.total) > 0
          ? b.total
          : b.grand_total !== undefined && b.grand_total !== null && Number(b.grand_total) > 0
          ? b.grand_total
          : 0
      );
      if (bTotal === 0 && Array.isArray(b.items) && b.items.length > 0) {
        bTotal = b.items.reduce(
          (s: number, it: any) =>
            s + Number(it.amount !== undefined ? it.amount : Number(it.qty || 1) * Number(it.unit_price || it.unitPrice || 0)),
          0
        );
      }
      if (bTotal === 0) {
        bTotal = Number(b.total || b.grand_total || 0);
      }

      const directPaid = billPaymentsMap.get(bId) || 0;
      const recordedPaid = Number(
        b.amountPaid !== undefined
          ? b.amountPaid
          : b.amount_paid !== undefined
          ? b.amount_paid
          : b.paid_total || 0
      );
      const effectivePaid = Math.min(bTotal, Math.max(recordedPaid, directPaid));
      const effectiveBalance = Math.max(0, Number((bTotal - effectivePaid).toFixed(2)));
      const effectiveStatus = effectiveBalance <= 0.001 ? 'paid' : effectivePaid > 0 ? 'partial' : 'unpaid';
      return {
        ...b,
        total: bTotal,
        amountPaid: effectivePaid,
        amount_paid: effectivePaid,
        balance: effectiveBalance,
        status: effectiveStatus,
      };
    });

    // Distribute unlinked customer payments FIFO (oldest date/id first)
    custUnlinkedPaymentsMap.forEach((unlinkedTotal, cId) => {
      let remaining = unlinkedTotal;
      const customerUnpaidBills = reconciledBills
        .filter((b: any) => {
          const billCust = String(b.customerId || b.customer_id || '').trim();
          return billCust && billCust === cId && b.balance > 0;
        })
        .sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

      for (const bill of customerUnpaidBills) {
        if (remaining <= 0) break;
        const toApply = Math.min(remaining, bill.balance);
        bill.amountPaid = Number((bill.amountPaid + toApply).toFixed(2));
        bill.amount_paid = bill.amountPaid;
        const bTot = Number(bill.total !== undefined ? bill.total : (bill.grand_total || 0));
        bill.balance = Number(Math.max(0, bTot - bill.amountPaid).toFixed(2));
        bill.status = bill.balance <= 0.001 ? 'paid' : 'partial';
        remaining = Number((remaining - toApply).toFixed(2));
      }
    });

    return reconciledBills;
  }
}
