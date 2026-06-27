/**
 * ── FinancialCalculationService ──────────────────────────────────────────────
 * High-precision, mathematically correct calculations for totals, taxes, and discounts.
 */
export const FinancialCalculationService = {
  /**
   * Calculates bill totals (Subtotal, Discount, Net Subtotal, GST, Total)
   * under configurable mixed discount rules.
   */
  calculateBillTotals: ({
    items = [],
    discountType = 'flat',
    discountValue = 0,
    gstPercent = 0,
    customGst = null,
    loyaltyDiscount = 0,
    rounding = 0,
    policy = 'apply_invoice_first' // 'individual_only' | 'invoice_only' | 'apply_invoice_first' | 'apply_item_first'
  }) => {
    // 1. Calculate individual items
    let itemsSubtotal = 0;
    const computedItems = items.map((item) => {
      const qty = Number(item.qty || 0);
      const unitPrice = Number(item.unitPrice || item.unit_price || 0);
      const itemDiscVal = Number(item.discountValue || item.discount_value || 0);
      const itemDiscType = item.discountType || item.discount_type || 'flat';
      
      const lineSubtotal = qty * unitPrice;
      let lineDiscount = 0;
      
      if (policy !== 'invoice_only') {
        if (itemDiscType === 'percent') {
          lineDiscount = Number(((lineSubtotal * itemDiscVal) / 100).toFixed(2));
        } else {
          lineDiscount = Math.min(itemDiscVal, lineSubtotal);
        }
      }
      
      const netLineSubtotal = Math.max(0, Number((lineSubtotal - lineDiscount).toFixed(2)));
      itemsSubtotal += netLineSubtotal;

      return {
        ...item,
        qty,
        unitPrice,
        subtotal: lineSubtotal,
        discountAmount: lineDiscount,
        netSubtotal: netLineSubtotal
      };
    });

    // 2. Calculate invoice level discount
    let invoiceDiscount = 0;
    if (policy !== 'individual_only' && discountValue > 0) {
      if (discountType === 'percent') {
        invoiceDiscount = Number(((itemsSubtotal * discountValue) / 100).toFixed(2));
      } else {
        invoiceDiscount = Math.min(discountValue, itemsSubtotal);
      }
    }

    // 3. Pro-rata distribution of invoice discount (Enterprise standard)
    let distributedDiscountTotal = 0;
    const itemsCount = computedItems.length;
    
    const finalItems = computedItems.map((item, idx) => {
      let allocatedInvoiceDiscount = 0;
      if (invoiceDiscount > 0 && itemsSubtotal > 0) {
        if (idx === itemsCount - 1) {
          // Assign rounding leftovers to the last item
          allocatedInvoiceDiscount = Number((invoiceDiscount - distributedDiscountTotal).toFixed(2));
        } else {
          allocatedInvoiceDiscount = Number(((item.netSubtotal / itemsSubtotal) * invoiceDiscount).toFixed(2));
          distributedDiscountTotal = Number((distributedDiscountTotal + allocatedInvoiceDiscount).toFixed(2));
        }
      }
      
      const finalLineNet = Math.max(0, Number((item.netSubtotal - allocatedInvoiceDiscount).toFixed(2)));
      
      // Calculate Line Tax
      const gstRate = Number(item.gstRate || item.gst_percent || gstPercent || 0);
      const lineGst = Number(((finalLineNet * gstRate) / 100).toFixed(2));
      
      return {
        ...item,
        allocatedInvoiceDiscount,
        finalLineNet,
        gstRate,
        lineGst,
        lineTotal: Number((finalLineNet + lineGst).toFixed(2))
      };
    });

    const calculatedSubtotal = finalItems.reduce((s, item) => s + item.subtotal, 0);
    const calculatedItemDiscount = finalItems.reduce((s, item) => s + item.discountAmount, 0);
    const netAfterItemDiscount = calculatedSubtotal - calculatedItemDiscount;
    const finalTotalDiscount = calculatedItemDiscount + invoiceDiscount;

    let computedGstAmount = finalItems.reduce((s, item) => s + item.lineGst, 0);
    if (customGst !== null && customGst !== undefined && customGst !== '') {
      computedGstAmount = Number(Number(customGst).toFixed(2));
    }

    // Final total calculation
    const rawTotal = Math.max(0, calculatedSubtotal - finalTotalDiscount + computedGstAmount - loyaltyDiscount);
    const finalTotal = Number((rawTotal + rounding).toFixed(2));

    return {
      subtotal: Number(calculatedSubtotal.toFixed(2)),
      discountAmount: Number(finalTotalDiscount.toFixed(2)),
      gstAmount: Number(computedGstAmount.toFixed(2)),
      cgst: Number((computedGstAmount / 2).toFixed(2)),
      sgst: Number((computedGstAmount / 2).toFixed(2)),
      total: finalTotal,
      items: finalItems
    };
  }
};

/**
 * ── AccountingService ────────────────────────────────────────────────────────
 * Generates and validates double-entry ledger journal entries for auditing.
 */
export const AccountingService = {
  generateJournalEntries: (transactionType, transactionPayload) => {
    const entries = [];
    const id = transactionPayload.id || `TXN-${Date.now()}`;
    const date = transactionPayload.date || new Date().toISOString();
    const customerId = transactionPayload.customerId || 'CUST-GENERAL';
    const amount = Number(transactionPayload.total || transactionPayload.amount || 0);

    const makeEntry = (account, debit, credit) => ({
      transactionId: id,
      date,
      customerId,
      account,
      debit: Number(debit.toFixed(2)),
      credit: Number(credit.toFixed(2))
    });

    switch (transactionType) {
      case 'INVOICE': {
        const subtotal = Number((transactionPayload.subtotal || 0).toFixed(2));
        const discount = Number((transactionPayload.discountAmount || 0).toFixed(2));
        const gst = Number((transactionPayload.gstAmount || 0).toFixed(2));
        const netSales = Number((subtotal - discount).toFixed(2));

        // Debit Accounts Receivable
        entries.push(makeEntry('Accounts Receivable', amount, 0));
        // Credit Sales
        entries.push(makeEntry('Sales', 0, netSales));
        // Credit Tax Payable
        if (gst > 0) {
          entries.push(makeEntry('Tax Payable', 0, gst));
        }
        break;
      }
      case 'PAYMENT': {
        const cash = Number((transactionPayload.cashAmount || 0).toFixed(2));
        const upi = Number((transactionPayload.upiAmount || 0).toFixed(2));
        const total = Number((transactionPayload.totalPaid || 0).toFixed(2));

        if (cash > 0) entries.push(makeEntry('Cash', cash, 0));
        if (upi > 0) entries.push(makeEntry('Bank (UPI)', upi, 0));
        entries.push(makeEntry('Accounts Receivable', 0, total));
        break;
      }
      case 'EXPENSE': {
        const cash = Number((transactionPayload.cashAmount || 0).toFixed(2));
        const upi = Number((transactionPayload.upiAmount || 0).toFixed(2));
        entries.push(makeEntry(`Expense: ${transactionPayload.category || 'General'}`, amount, 0));
        if (cash > 0) entries.push(makeEntry('Cash', 0, cash));
        if (upi > 0) entries.push(makeEntry('Bank (UPI)', 0, upi));
        break;
      }
      case 'REFUND': {
        const cash = Number((transactionPayload.cashAmount || 0).toFixed(2));
        const upi = Number((transactionPayload.upiAmount || 0).toFixed(2));
        const gst = Number((transactionPayload.gstAmount || 0).toFixed(2));
        const subtotal = Number((transactionPayload.subtotal || 0).toFixed(2));

        entries.push(makeEntry('Sales Return', subtotal, 0));
        if (gst > 0) entries.push(makeEntry('Tax Adjustment', gst, 0));
        if (cash > 0) entries.push(makeEntry('Cash', 0, cash));
        if (upi > 0) entries.push(makeEntry('Bank (UPI)', 0, upi));
        break;
      }
      default:
        break;
    }

    // Validation: Total Debit must equal Total Credit
    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.02) {
      console.warn(`Unbalanced journal entry generated for ${transactionType} ${id}. Debits: ${totalDebit}, Credits: ${totalCredit}`);
    }

    return entries;
  }
};

/**
 * ── LedgerService ────────────────────────────────────────────────────────────
 * Rebuilds chronological and mathematically correct customer ledgers.
 */
export const LedgerService = {
  calculateLedger: ({ customerId, bills = [], payments = [], advancePayments = [], period = 'all', settings = {} }) => {
    const entries = [];
    const selectedBills = bills.filter(b => b.customerId === customerId && !b.deleted);
    const selectedPayments = payments.filter(p => p.customerId === customerId && !p.notes?.includes('advance deposit'));
    const selectedAdvances = (advancePayments || []).filter(a => a.customerId === customerId);

    // Initial pass of bills
    selectedBills.forEach((bill) => {
      const advUsed = Number(bill.advanceUsed || 0);
      const bal = Number(bill.balance || 0);
      const statusText = bill.settledByGroupPayment ? 'Settled By Group Payment' : bill.status.toUpperCase();
      const breakdown = `₹${bill.total.toFixed(2)}${advUsed > 0 ? `; ₹${advUsed.toFixed(2)} advance used` : ''}${bal > 0 ? `, ₹${bal.toFixed(2)} pending` : ''}`;

      entries.push({
        type: 'bill',
        date: bill.date,
        id: bill.id,
        description: `Invoice #${bill.id}`,
        subtext: `${bill.items ? `${bill.items.length} item(s) · ` : ''}${statusText} (${breakdown})`,
        debit: bill.total,
        credit: 0,
        balance: 0
      });

      if (bill.settledByGroupPayment) {
        entries.push({
          type: 'group_settlement',
          date: bill.date,
          id: `SETTLE-${bill.id}`,
          description: `Settled By Group Payment (${bill.groupBillId})`,
          subtext: `Paid on behalf by Customer ID ${bill.groupPayerId}`,
          debit: 0,
          credit: bill.total,
          balance: 0
        });
      }
    });

    // Initial pass of payments
    selectedPayments.forEach((payment) => {
      const excess = Number(payment.excessCredit || 0);
      const isRefund = Number(payment.totalPaid || 0) < 0 || payment.paymentType === 'refund' || payment.isRefund;
      const creditAmt = Number(payment.totalPaid || 0) + excess;

      entries.push({
        type: isRefund ? 'refund' : (payment.isGroupPayment ? 'group_payment' : 'payment'),
        date: payment.date,
        id: payment.id,
        description: isRefund 
          ? `Refund — Bill #${payment.billId}` 
          : (payment.isGroupPayment 
              ? `Full Group Payment — ${payment.groupBillId}` 
              : `Payment — ${payment.billId || 'General'}`),
        subtext: payment.isGroupPayment 
          ? `Paid ₹${payment.totalPaid.toFixed(2)} for Split Group ${payment.groupBillId}`
          : `Cash ₹${Number(payment.cashAmount || 0).toFixed(2)} · UPI ₹${Number(payment.upiAmount || 0).toFixed(2)}`,
        debit: isRefund ? Math.abs(creditAmt) : 0,
        credit: isRefund ? 0 : creditAmt,
        balance: 0
      });
    });

    // Initial pass of advance deposits
    selectedAdvances.forEach((adv) => {
      const isReturn = adv.isReturn || adv.amount < 0;
      const amt = Number(adv.amount);
      entries.push({
        type: isReturn ? 'advance_return' : 'advance',
        date: adv.date,
        id: adv.id,
        description: isReturn ? `Advance Return` : `Advance Deposit`,
        subtext: `Ref: ${adv.id}${adv.notes ? ` · ${adv.notes}` : ''}`,
        debit: isReturn ? Math.abs(amt) : 0,
        credit: isReturn ? 0 : amt,
        balance: 0
      });
    });

    // Chronological Sort
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate rolling balances
    let rolling = 0;
    const finalEntries = entries.map((entry) => {
      rolling = Number((rolling + entry.credit - entry.debit).toFixed(2));
      return { ...entry, balance: rolling };
    });

    return {
      entries: finalEntries,
      closingBalance: rolling
    };
  }
};

/**
 * ── ReportService ────────────────────────────────────────────────────────────
 * Centralized financial reporting generator for Sales, Profit, and Expenses.
 */
export const ReportService = {
  generateFinancialSummary: ({ bills = [], payments = [], expenses = [], inventory = [] }) => {
    const activeBills = bills.filter(b => !b.deleted && !b.isGroupParent);
    const grossSales = activeBills.reduce((s, b) => s + b.subtotal, 0);
    const discounts = activeBills.reduce((s, b) => s + (b.discountAmount || 0), 0);
    const gstCollected = activeBills.reduce((s, b) => s + (b.gstAmount || 0), 0);
    const netSales = grossSales - discounts;

    const cashPayments = payments.filter(p => !p.notes?.includes('advance deposit'));
    const totalRevenue = cashPayments.reduce((s, p) => s + Number(p.totalPaid || 0), 0);

    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const refunds = payments.filter(p => p.totalPaid < 0 || p.isRefund).reduce((s, p) => s + Math.abs(p.totalPaid), 0);

    // Inventory Value = current_stock * cost (Weighted average cost)
    const inventoryVal = inventory.reduce((s, i) => s + (Number(i.stock || 0) * Number(i.bw_single || 0)), 0);

    return {
      grossSales: Number(grossSales.toFixed(2)),
      discounts: Number(discounts.toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
      gstCollected: Number(gstCollected.toFixed(2)),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      refunds: Number(refunds.toFixed(2)),
      inventoryValue: Number(inventoryVal.toFixed(2)),
      netProfit: Number((netSales - totalExpenses - refunds).toFixed(2))
    };
  }
};

/**
 * ── DashboardService ─────────────────────────────────────────────────────────
 * Computes centralized widgets for the main dashboard view.
 */
export const DashboardService = {
  getSummaryWidgets: ({ bills = [], payments = [], expenses = [], customers = [], inventory = [] }) => {
    const activeBills = bills.filter(b => !b.deleted && !b.isGroupParent);
    const pendingAmount = activeBills.reduce((sum, b) => sum + Number(b.balance || 0), 0);
    const grossRevenue = activeBills.reduce((sum, b) => sum + Number(b.amountPaid || 0), 0);
    const totalRefunds = payments.filter((p) => p.totalPaid < 0 || p.isRefund).reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || 0)), 0);
    const totalCustomerAdvance = customers.filter((c) => !c.deleted).reduce((sum, c) => sum + Number(c.advanceBalance || c.creditBalance || 0), 0);

    return {
      netRevenue: grossRevenue,
      pendingAmount,
      totalRefunds,
      totalCustomerAdvance,
      billCount: activeBills.length,
      customerCount: customers.filter(c => !c.deleted).length
    };
  }
};

/**
 * ── AnalyticsService ─────────────────────────────────────────────────────────
 * Generates structured analytics charts and summaries.
 */
export const AnalyticsService = {
  getChartSummaries: ({ bills = [], payments = [], expenses = [] }) => {
    // Generate simple dynamic chart trends
    const dailyMap = {};
    bills.filter(b => !b.deleted && !b.isGroupParent).forEach(b => {
      dailyMap[b.date] = (dailyMap[b.date] || 0) + b.total;
    });

    return {
      dailyTrend: Object.entries(dailyMap).map(([name, value]) => ({ name, value }))
    };
  }
};

/**
 * ── RefundService ────────────────────────────────────────────────────────────
 * Settle accounting reversals, refund adjustments, and inventory restock calculations.
 */
export const RefundService = {
  calculateRefundReversal: (bill, refundAmount) => {
    if (!bill) return null;
    const ratio = refundAmount / bill.total;
    return {
      salesReturn: Number((bill.subtotal * ratio).toFixed(2)),
      taxAdjustment: Number((bill.gstAmount * ratio).toFixed(2)),
      netRefunded: refundAmount
    };
  }
};
