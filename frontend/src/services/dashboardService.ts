export class DashboardService {
  /**
   * Aggregates key summary widget metrics from live collection datasets.
   */
  static getSummaryWidgets({
    bills = [],
    payments = [],
    advancePayments = [],
    customers = [],
  }: {
    bills?: any[];
    payments?: any[];
    advancePayments?: any[];
    expenses?: any[];
    customers?: any[];
    inventory?: any[];
  }) {
    const activeBills = bills.filter((b: any) => !b.deleted && !b.isGroupParent);
    const pendingAmount = activeBills.reduce(
      (sum: number, b: any) => sum + Number(b.balance || 0),
      0
    );
    const grossRevenue = activeBills.reduce(
      (sum: number, b: any) => sum + Number(b.total || 0),
      0
    );
    const invoiceRefunds = payments
      .filter((p: any) => p.totalPaid < 0 || p.isRefund)
      .reduce((sum: number, p: any) => sum + Math.abs(Number(p.totalPaid || 0)), 0);
    const advanceRefunds = (advancePayments || [])
      .filter((a: any) => a.amount < 0 || a.isReturn)
      .reduce((sum: number, a: any) => sum + Math.abs(Number(a.amount || 0)), 0);
    const totalRefunds = invoiceRefunds + advanceRefunds;
    const totalCustomerAdvance = customers
      .filter((c: any) => !c.deleted)
      .reduce(
        (sum: number, c: any) => sum + Number(c.advanceBalance || c.creditBalance || 0),
        0
      );
    const totalCollected = activeBills.reduce(
      (sum: number, b: any) => sum + Number(b.amountPaid || 0),
      0
    );

    return {
      grossRevenue,
      netRevenue: grossRevenue - totalRefunds,
      pendingAmount,
      totalRefunds,
      totalCustomerAdvance,
      totalCollected,
      billCount: activeBills.length,
      customerCount: customers.filter((c: any) => !c.deleted).length,
    };
  }

  /**
   * Calculates outstanding receivables aged buckets (0-30 days, 31-60 days, 61+ days).
   */
  static calculateAgingReport(bills: any[] = []) {
    let bucketCurrent = 0; // 0-30 days
    let bucketMedium = 0; // 31-60 days
    let bucketAged = 0; // 61+ days

    const now = new Date();

    bills
      .filter(
        (b: any) => !b.deleted && b.status !== 'paid' && !b.isGroupParent && Number(b.balance || 0) > 0
      )
      .forEach((b: any) => {
        const billDate = new Date(b.date);
        const diffTime = Math.abs(now.getTime() - billDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          bucketCurrent += Number(b.balance || 0);
        } else if (diffDays <= 60) {
          bucketMedium += Number(b.balance || 0);
        } else {
          bucketAged += Number(b.balance || 0);
        }
      });

    const total = bucketCurrent + bucketMedium + bucketAged;

    return {
      current: Number(bucketCurrent.toFixed(2)),
      medium: Number(bucketMedium.toFixed(2)),
      aged: Number(bucketAged.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  }
}
