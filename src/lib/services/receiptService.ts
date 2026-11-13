import { Bill, BillFinancialSummary, ShopSettings } from '../types';

export class ReceiptService {
  static generateDigitalReceiptText(
    bill: Bill,
    financialSummary?: BillFinancialSummary,
    shopSettings?: Partial<ShopSettings>
  ): string {
    const formattedDate = new Date(bill.created_at || Date.now()).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const shopName = shopSettings?.shop_name || 'SIMPLEBILLING STORE';
    const shopPhone = shopSettings?.phone ? `📞 Ph: ${shopSettings.phone}` : '';
    const shopAddress = shopSettings?.address ? `📍 ${shopSettings.address}` : '';
    const shopGstin = shopSettings?.gst_number ? `🏛️ GSTIN: ${shopSettings.gst_number}` : '';
    const footerMsg = shopSettings?.footer_message || 'Thank you for your business!';

    const itemsText = (bill.items || []).map((item, idx) =>
      `${idx + 1}. *${item.product_name}*\n   Qty: ${item.quantity} × ₹${Number(item.price).toFixed(2)} = ₹${Number(item.total).toFixed(2)}`
    ).join('\n\n');

    const isFullyPaidFallback = Math.max(0, Number(bill.grand_total || 0) - Number(bill.paid_total || 0)) <= 0.01;
    const ptsEarnedFallback = Number(bill.loyalty_points_earned || 0);

    const summary: BillFinancialSummary = financialSummary || bill.financial_summary || {
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
        message: isFullyPaidFallback ? `🎁 Loyalty Earned: +${ptsEarnedFallback} Points` : `⏳ Loyalty Points will be credited after this bill is fully paid.`
      } : undefined
    };

    const statusBadge = summary.payment_status === 'Fully Paid'
      ? 'Status: Fully Paid ✅'
      : summary.payment_status === 'Partially Paid'
        ? `Status: Partially Paid ℹ️ (Remaining: ₹${summary.remaining_balance.toFixed(2)})`
        : `Status: Payment Pending ⚠️ (Remaining: ₹${summary.remaining_balance.toFixed(2)})`;

    const currentBillDue = Math.max(0, summary.current_bill_amount - summary.total_paid);
    const advanceEarnedOnBill = Number(bill.advance_earned || 0);

    let text = `🧾 *${shopName.toUpperCase()}*`;
    if (shopAddress) text += `\n${shopAddress}`;
    if (shopPhone || shopGstin) {
      text += `\n${[shopPhone, shopGstin].filter(Boolean).join(' | ')}`;
    }

    text += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 *TAX INVOICE / BILL RECEIPT*
Bill No: *${bill.bill_number}*
Date: ${formattedDate}
Customer: *${bill.customer_name || 'Walk-in Customer'}* ${bill.customer_mobile ? `(${bill.customer_mobile})` : ''}
Payment Mode: *${bill.payment_method || 'Cash'}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛒 *ITEMIZED PURCHASES*

${itemsText || '1. General Purchase\n   Qty: 1 × ₹' + Number(bill.grand_total).toFixed(2) + ' = ₹' + Number(bill.grand_total).toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *BILL TOTALS*
Subtotal: ₹${Number(bill.total || 0).toFixed(2)}
Discount: -₹${Number(bill.discount || 0).toFixed(2)}`;

    if (Number(bill.gst_amount || 0) > 0) {
      text += `\nGST: +₹${Number(bill.gst_amount).toFixed(2)}`;
    }
    if (Number(bill.rounding_adjustment || 0) !== 0) {
      text += `\nRounding: ${Number(bill.rounding_adjustment) >= 0 ? '+' : ''}₹${Number(bill.rounding_adjustment).toFixed(2)}`;
    }

    text += `\n🧾 *Grand Total: ₹${Number(bill.grand_total || 0).toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *CUSTOMER ACCOUNT SUMMARY*
Previous Outstanding: ₹${summary.previous_outstanding.toFixed(2)}`;

    if (summary.previous_advance > 0.009) {
      text += `\nPrevious Advance: ₹${summary.previous_advance.toFixed(2)}`;
    }

    text += `\nCurrent Bill Amount: ₹${summary.current_bill_amount.toFixed(2)}
*Total Amount Due: ₹${summary.total_amount_due.toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *PAYMENT SUMMARY*
Cash Paid: ₹${summary.cash_paid.toFixed(2)}
UPI Paid: ₹${summary.upi_paid.toFixed(2)}
Advance Used: ₹${summary.advance_used.toFixed(2)}
*Total Paid: ₹${summary.total_paid.toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚖️ *BALANCE & ADVANCE SUMMARY*
Current Bill Due: ₹${currentBillDue.toFixed(2)}
Net Account Balance Due: ₹${summary.remaining_balance.toFixed(2)}`;

    if (advanceEarnedOnBill > 0) {
      text += `\n🔵 *Advance Credited (This Bill): +₹${advanceEarnedOnBill.toFixed(2)}*`;
    }
    if (summary.remaining_advance_balance > 0.009) {
      text += `\nCustomer Advance Wallet: ₹${summary.remaining_advance_balance.toFixed(2)}`;
    }
    text += `\nCustomer Advance Balance: ₹${summary.remaining_advance_balance.toFixed(2)}
📌 ${statusBadge}`;

    if (summary.loyalty && summary.loyalty.enabled) {
      text += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *LOYALTY REWARDS*`;
      if (summary.remaining_balance <= 0.01 || summary.loyalty.is_fully_paid) {
        text += `\nPoints Earned (This Bill): *+${summary.loyalty.points_earned} Pts*
Previous Points: ${summary.loyalty.previous_points} pts
Points Redeemed: -${summary.loyalty.points_redeemed} pts
*Current Active Loyalty Balance: ${summary.loyalty.current_points_balance} pts*`;
      } else {
        const totalPending = summary.loyalty.total_pending_points || summary.loyalty.points_earned;
        text += `\n⏳ *Points on This Bill (Pending): +${summary.loyalty.points_earned} Pts*
⏳ *Total Pending on Account: ${totalPending} Pts*
Available Spendable Balance: ${summary.loyalty.previous_points} pts
_(Points will be credited upon bill settlement)_`;
      }
    }

    text += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${footerMsg}\n_Powered by SimpleBilling_`;

    return text;
  }

  static generateWhatsAppTextReceipt(
    bill: Bill,
    financialSummary?: BillFinancialSummary,
    shopSettings?: Partial<ShopSettings>
  ): string {
    return this.generateDigitalReceiptText(bill, financialSummary, shopSettings);
  }
}

