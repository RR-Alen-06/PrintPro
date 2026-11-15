import { Bill, BillFinancialSummary, CustomerStatementData, ShopSettings } from '../types';

export class ReceiptService {
  private static buildSummary(bill: Bill, financialSummary?: BillFinancialSummary): BillFinancialSummary {
    const isFullyPaidFallback = Math.max(0, Number(bill.grand_total || 0) - Number(bill.paid_total || 0)) <= 0.01;
    const ptsEarnedFallback = Number(bill.loyalty_points_earned || 0);

    return financialSummary || bill.financial_summary || {
      previous_outstanding: 0,
      previous_advance: 0,
      current_bill_amount: Number(bill.grand_total || 0),
      total_amount_due: Number(bill.grand_total || 0),
      cash_paid: Number(bill.cash_paid || 0),
      upi_paid: Number(bill.upi_paid || 0),
      advance_used: Number(bill.advance_used || 0),
      total_paid: Number(bill.paid_total || 0),
      remaining_balance: Math.max(0, Number(bill.grand_total || 0) - Number(bill.paid_total || 0)),
      remaining_advance_balance: Number(bill.advance_earned || 0),
      payment_status: isFullyPaidFallback ? 'Fully Paid' : 'Payment Pending',
      loyalty: ptsEarnedFallback > 0 ? {
        enabled: true,
        is_fully_paid: isFullyPaidFallback,
        points_awarded: isFullyPaidFallback,
        previous_points: 0,
        points_earned: ptsEarnedFallback,
        points_redeemed: Number(bill.loyalty_points_redeemed || 0),
        current_points_balance: ptsEarnedFallback,
        message: isFullyPaidFallback ? `Loyalty Earned: +${ptsEarnedFallback} Points` : `Loyalty Points will be credited after this bill is fully paid.`
      } : undefined
    };
  }

  private static formatStatusBadge(summary: BillFinancialSummary): string {
    if (summary.payment_status === 'Fully Paid') {
      return 'Status: Fully Paid [PAID]';
    }
    if (summary.payment_status === 'Partially Paid') {
      return `Status: Partially Paid (Remaining: ₹${summary.remaining_balance.toFixed(2)})`;
    }
    return `Status: Payment Pending (Remaining: ₹${summary.remaining_balance.toFixed(2)})`;
  }

  static generateDigitalReceiptText(
    bill: Bill,
    financialSummary?: BillFinancialSummary,
    shopSettings?: Partial<ShopSettings>
  ): string {
    const formattedDate = new Date(bill.created_at || Date.now()).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const shopName = shopSettings?.shop_name || 'PRINTPRO STORE';
    const shopPhone = shopSettings?.phone ? `Ph: ${shopSettings.phone}` : '';
    const shopAddress = shopSettings?.address ? `${shopSettings.address}` : '';
    const shopGstin = shopSettings?.gst_number ? `GSTIN: ${shopSettings.gst_number}` : '';
    const footerMsg = shopSettings?.footer_message || 'Thank you for your business!';

    const itemsText = (bill.items || []).map((item, idx) =>
      `${idx + 1}. *${item.product_name}*\n   Qty: ${item.quantity} × ₹${Number(item.price).toFixed(2)} = ₹${Number(item.total).toFixed(2)}`
    ).join('\n\n');

    const summary = this.buildSummary(bill, financialSummary);
    const statusBadge = this.formatStatusBadge(summary);
    const currentBillDue = Math.max(0, summary.current_bill_amount - summary.total_paid);
    const advanceEarnedOnBill = Number(bill.advance_earned || 0);

    let text = `*${shopName.toUpperCase()}*`;
    if (shopAddress) text += `\n${shopAddress}`;
    if (shopPhone || shopGstin) {
      text += `\n${[shopPhone, shopGstin].filter(Boolean).join(' | ')}`;
    }

    text += `\n\n----------------------------
*TAX INVOICE / BILL RECEIPT*
Bill No: *${bill.bill_number}*
Date: ${formattedDate}
Customer: *${bill.customer_name || 'Walk-in Customer'}*${bill.customer_mobile ? ` (${bill.customer_mobile})` : ''}
Payment Mode: *${bill.payment_method || 'Cash'}*

----------------------------
*ITEMIZED PURCHASES*

${itemsText || '1. General Purchase\n   Qty: 1 × ₹' + Number(bill.grand_total).toFixed(2) + ' = ₹' + Number(bill.grand_total).toFixed(2)}

----------------------------
*BILL TOTALS*
Subtotal: ₹${Number(bill.total || 0).toFixed(2)}
Discount: -₹${Number(bill.discount || 0).toFixed(2)}`;

    if (Number(bill.gst_amount || 0) > 0) {
      text += `\nGST: +₹${Number(bill.gst_amount).toFixed(2)}`;
    }
    if (Number(bill.rounding_adjustment || 0) !== 0) {
      text += `\nRounding: ${Number(bill.rounding_adjustment) >= 0 ? '+' : ''}₹${Number(bill.rounding_adjustment).toFixed(2)}`;
    }

    text += `\n*Grand Total: ₹${Number(bill.grand_total || 0).toFixed(2)}*

----------------------------
*CUSTOMER ACCOUNT SUMMARY*
Previous Outstanding: ₹${summary.previous_outstanding.toFixed(2)}`;

    if (summary.previous_advance > 0.009) {
      text += `\nPrevious Advance: ₹${summary.previous_advance.toFixed(2)}`;
    }

    text += `\nCurrent Bill Amount: ₹${summary.current_bill_amount.toFixed(2)}
*Total Amount Due: ₹${summary.total_amount_due.toFixed(2)}*

----------------------------
*PAYMENT SUMMARY*
Cash Paid: ₹${summary.cash_paid.toFixed(2)}
UPI Paid: ₹${summary.upi_paid.toFixed(2)}
Advance Used: ₹${summary.advance_used.toFixed(2)}
*Total Paid: ₹${summary.total_paid.toFixed(2)}*

----------------------------
*BALANCE & ADVANCE SUMMARY*
Current Bill Due: ₹${currentBillDue.toFixed(2)}
Net Account Balance Due: ₹${summary.remaining_balance.toFixed(2)}`;

    if (advanceEarnedOnBill > 0) {
      text += `\n*Advance Credited (This Bill): +₹${advanceEarnedOnBill.toFixed(2)}*`;
    }
    if (summary.remaining_advance_balance > 0.009) {
      text += `\nCustomer Advance Wallet: ₹${summary.remaining_advance_balance.toFixed(2)}`;
    }
    text += `\nCustomer Advance Balance: ₹${summary.remaining_advance_balance.toFixed(2)}
${statusBadge}`;

    if (summary.loyalty && summary.loyalty.enabled) {
      text += `\n\n----------------------------\n*LOYALTY REWARDS*`;
      if (summary.remaining_balance <= 0.01 || summary.loyalty.is_fully_paid) {
        text += `\nPoints Earned (This Bill): *+${summary.loyalty.points_earned} Pts*
Previous Points: ${summary.loyalty.previous_points} pts
Points Redeemed: -${summary.loyalty.points_redeemed} pts
*Current Active Loyalty Balance: ${summary.loyalty.current_points_balance} pts*`;
      } else {
        const totalPending = summary.loyalty.total_pending_points || summary.loyalty.points_earned;
        text += `\n*Points on This Bill (Pending): +${summary.loyalty.points_earned} Pts*
*Total Pending on Account: ${totalPending} Pts*
Available Spendable Balance: ${summary.loyalty.previous_points} pts
_(Points will be credited upon bill settlement)_`;
      }
    }

    text += `\n\n----------------------------\n${footerMsg}\n_Powered by PrintPRO_`;

    return text;
  }

  static generateCompactReceiptText(
    bill: Bill,
    financialSummary?: BillFinancialSummary,
    shopSettings?: Partial<ShopSettings>
  ): string {
    const formattedDate = new Date(bill.created_at || Date.now()).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const shopName = shopSettings?.shop_name || 'PRINTPRO STORE';
    const shopPhone = shopSettings?.phone ? `Ph: ${shopSettings.phone}` : '';
    const shopGstin = shopSettings?.gst_number ? `GSTIN: ${shopSettings.gst_number}` : '';
    const footerMsg = shopSettings?.footer_message || 'Thank you for your business!';

    const summary = this.buildSummary(bill, financialSummary);
    const itemsText = (bill.items && bill.items.length > 0)
      ? bill.items.map((item, idx) =>
          `${idx + 1}. *${item.product_name}* (${item.quantity} × ₹${Number(item.price).toFixed(2)}) = ₹${Number(item.total).toFixed(2)}`
        ).join('\n')
      : `1. General Purchase (1 × ₹${Number(bill.grand_total).toFixed(2)}) = ₹${Number(bill.grand_total).toFixed(2)}`;

    const lines: string[] = [`*${shopName.toUpperCase()}*`];
    if (shopPhone || shopGstin) {
      lines.push([shopPhone, shopGstin].filter(Boolean).join(' | '));
    }

    lines.push(
      `----------------------------`,
      `*INVOICE:* *${bill.bill_number}* | ${formattedDate}`,
      `*Customer:* ${bill.customer_name || 'Walk-in Customer'}${bill.customer_mobile ? ` (${bill.customer_mobile})` : ''}`,
      `*Mode:* ${bill.payment_method || 'Cash'}`,
      `----------------------------`,
      itemsText,
      `----------------------------`
    );

    const discount = Number(bill.discount || 0);
    const gst = Number(bill.gst_amount || 0);
    const rounding = Number(bill.rounding_adjustment || 0);
    if (discount > 0.009 || gst > 0.009 || Math.abs(rounding) > 0.009) {
      lines.push(`Subtotal: ₹${Number(bill.total || 0).toFixed(2)}`);
      if (discount > 0.009) lines.push(`Discount: -₹${discount.toFixed(2)}`);
      if (gst > 0.009) lines.push(`GST: +₹${gst.toFixed(2)}`);
      if (Math.abs(rounding) > 0.009) {
        lines.push(`Rounding: ${rounding >= 0 ? '+' : ''}₹${rounding.toFixed(2)}`);
      }
    }
    lines.push(`*Grand Total: ₹${Number(bill.grand_total || 0).toFixed(2)}*`);

    if (summary.previous_outstanding > 0.009) {
      lines.push(`Prev. Outstanding: ₹${summary.previous_outstanding.toFixed(2)}`);
    }
    if (summary.previous_advance > 0.009) {
      lines.push(`Prev. Advance: ₹${summary.previous_advance.toFixed(2)}`);
    }

    const paymentParts: string[] = [];
    if (summary.cash_paid > 0.009) paymentParts.push(`Cash ₹${summary.cash_paid.toFixed(2)}`);
    if (summary.upi_paid > 0.009) paymentParts.push(`UPI ₹${summary.upi_paid.toFixed(2)}`);
    if (summary.advance_used > 0.009) paymentParts.push(`Advance ₹${summary.advance_used.toFixed(2)}`);
    if (paymentParts.length > 1) {
      lines.push(`Paid (${paymentParts.join(' + ')}): *₹${summary.total_paid.toFixed(2)}*`);
    } else {
      lines.push(`*Paid: ₹${summary.total_paid.toFixed(2)}*`);
    }

    if (summary.remaining_balance > 0.009) {
      lines.push(`*Balance Due: ₹${summary.remaining_balance.toFixed(2)}*`);
    }
    if (summary.remaining_advance_balance > 0.009) {
      lines.push(`Advance Balance: ₹${summary.remaining_advance_balance.toFixed(2)}`);
    }
    lines.push(this.formatStatusBadge(summary));

    if (summary.loyalty && summary.loyalty.enabled) {
      if (summary.remaining_balance <= 0.01 || summary.loyalty.is_fully_paid) {
        lines.push(
          `Loyalty: +${summary.loyalty.points_earned} pts (Balance: *${summary.loyalty.current_points_balance} pts*)`
        );
      } else {
        lines.push(
          `Loyalty: +${summary.loyalty.points_earned} pts pending settlement (Available: ${summary.loyalty.previous_points} pts)`
        );
      }
    }

    lines.push(`----------------------------`, footerMsg, `_Powered by PrintPRO_`);
    return lines.join('\n');
  }

  static generateStatementSummaryText(data: CustomerStatementData): string {
    const shopName = data.shop_settings?.shop_name || 'PRINTPRO STORE';
    const shopPhone = data.shop_settings?.phone ? `Ph: ${data.shop_settings.phone}` : '';
    const footerMsg = data.shop_settings?.footer_message || 'Thank you for your business!';

    const lines: string[] = [`*${shopName.toUpperCase()}*`];
    if (shopPhone) lines.push(shopPhone);

    lines.push(
      `----------------------------`,
      `*STATEMENT OF ACCOUNT*`,
      `*Customer:* ${data.customer.name}${data.customer.mobile ? ` (${data.customer.mobile})` : ''}`,
      `*Period:* ${data.period.filter_label}`,
      `----------------------------`,
      `Invoices (${data.kpi.invoices_count}): ₹${data.kpi.total_invoiced.toFixed(2)}`,
      `Payments (${data.kpi.payments_count}): ₹${data.kpi.total_paid.toFixed(2)}`
    );

    if (data.current_balance_due > 0.009) {
      lines.push(`*Outstanding Balance Due: ₹${data.current_balance_due.toFixed(2)}*`);
    } else if (data.current_advance_balance > 0.009) {
      lines.push(`*Advance Balance: ₹${data.current_advance_balance.toFixed(2)}*`);
    } else {
      lines.push(`*Account Balance: ₹0.00 (Settled)*`);
    }

    lines.push(`----------------------------`, footerMsg, `_Powered by PrintPRO_`);
    return lines.join('\n');
  }

  static generateEndOfDaySummaryText(params: {
    shopName?: string;
    shopPhone?: string;
    periodLabel: string;
    totalBills: number;
    totalSales: number;
    totalPaid: number;
    cashTotal: number;
    upiTotal: number;
    pendingTotal: number;
    totalExpenses: number;
    netProfit: number;
    totalDuesAmount: number;
    dueCustomersCount: number;
  }): string {
    const shopName = params.shopName || 'PRINTPRO STORE';
    const lines: string[] = [`*${shopName.toUpperCase()}*`];
    if (params.shopPhone) lines.push(`Ph: ${params.shopPhone}`);

    lines.push(
      `----------------------------`,
      `*END OF DAY / BUSINESS SUMMARY*`,
      `*Period:* ${params.periodLabel}`,
      `----------------------------`,
      `Total Bills: *${params.totalBills}*`,
      `*Total Sales: ₹${params.totalSales.toFixed(2)}*`,
      `Total Collected: ₹${params.totalPaid.toFixed(2)}`
    );

    if (params.cashTotal > 0.009) lines.push(`- Cash Collected: ₹${params.cashTotal.toFixed(2)}`);
    if (params.upiTotal > 0.009) lines.push(`- UPI Collected: ₹${params.upiTotal.toFixed(2)}`);
    if (params.pendingTotal > 0.009) lines.push(`- Period Credit/Pending: ₹${params.pendingTotal.toFixed(2)}`);
    if (params.totalExpenses > 0.009) lines.push(`Expenses: ₹${params.totalExpenses.toFixed(2)}`);

    lines.push(
      `*Net Profit (Collected - Exp): ₹${params.netProfit.toFixed(2)}*`,
      `----------------------------`
    );

    if (params.totalDuesAmount > 0.009) {
      lines.push(`Total Account Dues (${params.dueCustomersCount} customers): ₹${params.totalDuesAmount.toFixed(2)}`);
    } else {
      lines.push(`Customer Dues: Settled (₹0.00)`);
    }

    lines.push(`_Powered by PrintPRO_`);
    return lines.join('\n');
  }

  static generateWhatsAppTextReceipt(
    bill: Bill,
    financialSummary?: BillFinancialSummary,
    shopSettings?: Partial<ShopSettings>
  ): string {
    return this.generateDigitalReceiptText(bill, financialSummary, shopSettings);
  }
}

