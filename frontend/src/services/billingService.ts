import { RoundingMethod, BillFinancialSummary } from '../types/billing';

export interface CalculationItemInput {
  itemId?: string | null;
  itemName: string;
  printType?: string;
  sides?: string;
  qty: number;
  unitPrice: number;
  discountValue?: number;
  discountType?: 'flat' | 'percent';
  gstRate?: number;
}

export interface ComputedLineItem {
  itemId?: string | null;
  itemName: string;
  printType?: string;
  sides?: string;
  qty: number;
  unitPrice: number;
  lineSubtotal: number;
  itemDiscount: number;
  netLineSubtotal: number;
  allocatedInvoiceDiscount: number;
  finalLineNet: number;
  gstRate: number;
  lineGst: number;
  lineTotal: number;
}

export interface BillCalculationResult {
  items: ComputedLineItem[];
  subtotal: number;
  itemDiscountTotal: number;
  invoiceDiscountTotal: number;
  loyaltyDiscountTotal: number;
  totalDiscount: number;
  taxableAmount: number;
  gstAmount: number;
  preRoundedTotal: number;
  roundedTotal: number;
  roundingAdjustment: number;
  roundingMethod: RoundingMethod;
}

export class BillingService {
  /**
   * Calculates rounding based on method.
   */
  static calculateRounding(
    amount: number,
    method: RoundingMethod = 'None'
  ): { roundedTotal: number; roundingAdjustment: number } {
    let rounded = amount;
    switch (method) {
      case 'Round Down':
        rounded = Math.floor(amount);
        break;
      case 'Round Up':
        rounded = Math.ceil(amount);
        break;
      case 'Standard':
        rounded = Math.round(amount);
        break;
      case 'None':
      default:
        rounded = Number(amount.toFixed(2));
        break;
    }
    const adjustment = Number((rounded - amount).toFixed(2));
    return {
      roundedTotal: rounded,
      roundingAdjustment: adjustment,
    };
  }

  /**
   * Deterministic, single-pass calculation of bill totals, line taxes, discounts, and rounding.
   */
  static calculateBill({
    items,
    discountType = 'flat',
    discountValue = 0,
    loyaltyDiscount = 0,
    gstPercent = 0,
    roundingMethod = 'None',
  }: {
    items: CalculationItemInput[];
    discountType?: 'flat' | 'percent';
    discountValue?: number;
    loyaltyDiscount?: number;
    gstPercent?: number;
    roundingMethod?: RoundingMethod;
  }): BillCalculationResult {
    let itemsSubtotal = 0;
    let itemDiscountTotal = 0;

    // 1. Line item subtotals and individual discounts
    const step1Items = items.map((item) => {
      const qty = Number(item.qty || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const lineSubtotal = Number((qty * unitPrice).toFixed(2));

      let lineDiscount = 0;
      const itemDiscVal = Number(item.discountValue || 0);
      if (itemDiscVal > 0) {
        if (item.discountType === 'percent') {
          lineDiscount = Number(((lineSubtotal * itemDiscVal) / 100).toFixed(2));
        } else {
          lineDiscount = Math.min(itemDiscVal, lineSubtotal);
        }
      }

      const netLineSubtotal = Math.max(0, Number((lineSubtotal - lineDiscount).toFixed(2)));
      itemsSubtotal += lineSubtotal;
      itemDiscountTotal += lineDiscount;

      return {
        ...item,
        qty,
        unitPrice,
        lineSubtotal,
        itemDiscount: lineDiscount,
        netLineSubtotal,
      };
    });

    const netAfterItemDiscount = Math.max(0, itemsSubtotal - itemDiscountTotal);

    // 2. Invoice-level discount
    let invoiceDiscountTotal = 0;
    if (discountValue > 0) {
      if (discountType === 'percent') {
        invoiceDiscountTotal = Number(((netAfterItemDiscount * discountValue) / 100).toFixed(2));
      } else {
        invoiceDiscountTotal = Math.min(discountValue, netAfterItemDiscount);
      }
    }

    const totalInvoiceAndLoyaltyDisc = invoiceDiscountTotal + loyaltyDiscount;

    // 3. Pro-rata discount distribution and line GST computation
    let distributedDiscountTotal = 0;
    const itemsCount = step1Items.length;

    const finalItems: ComputedLineItem[] = step1Items.map((item, idx) => {
      let allocatedDiscount = 0;
      if (totalInvoiceAndLoyaltyDisc > 0 && netAfterItemDiscount > 0) {
        if (idx === itemsCount - 1) {
          allocatedDiscount = Number((totalInvoiceAndLoyaltyDisc - distributedDiscountTotal).toFixed(2));
        } else {
          allocatedDiscount = Number(
            ((item.netLineSubtotal / netAfterItemDiscount) * totalInvoiceAndLoyaltyDisc).toFixed(2)
          );
          distributedDiscountTotal = Number((distributedDiscountTotal + allocatedDiscount).toFixed(2));
        }
      }

      const finalLineNet = Math.max(0, Number((item.netLineSubtotal - allocatedDiscount).toFixed(2)));
      const rate = Number(item.gstRate !== undefined ? item.gstRate : (gstPercent || 0));
      const lineGst = Number(((finalLineNet * rate) / 100).toFixed(2));
      const lineTotal = Number((finalLineNet + lineGst).toFixed(2));

      return {
        itemId: item.itemId,
        itemName: item.itemName,
        printType: item.printType,
        sides: item.sides,
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineSubtotal: item.lineSubtotal,
        itemDiscount: item.itemDiscount,
        netLineSubtotal: item.netLineSubtotal,
        allocatedInvoiceDiscount: allocatedDiscount,
        finalLineNet,
        gstRate: rate,
        lineGst,
        lineTotal,
      };
    });

    const totalDiscount = Number((itemDiscountTotal + totalInvoiceAndLoyaltyDisc).toFixed(2));
    const taxableAmount = finalItems.reduce((sum, item) => sum + item.finalLineNet, 0);
    const gstAmount = finalItems.reduce((sum, item) => sum + item.lineGst, 0);
    const preRoundedTotal = Number((taxableAmount + gstAmount).toFixed(2));

    const { roundedTotal, roundingAdjustment } = this.calculateRounding(preRoundedTotal, roundingMethod);

    return {
      items: finalItems,
      subtotal: Number(itemsSubtotal.toFixed(2)),
      itemDiscountTotal: Number(itemDiscountTotal.toFixed(2)),
      invoiceDiscountTotal: Number(invoiceDiscountTotal.toFixed(2)),
      loyaltyDiscountTotal: Number(loyaltyDiscount.toFixed(2)),
      totalDiscount,
      taxableAmount: Number(taxableAmount.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      preRoundedTotal,
      roundedTotal,
      roundingAdjustment,
      roundingMethod,
    };
  }

  /**
   * Helper to format a rich, structured WhatsApp receipt text.
   */
  static formatWhatsAppReceipt(
    bill: {
      bill_number?: string;
      invoiceNumber?: string;
      created_at?: string;
      customerName?: string;
      customer_name?: string;
      total?: number;
      grand_total?: number;
      discount?: number;
      rounding_adjustment?: number;
      cash_paid?: number;
      upi_paid?: number;
      paid_total?: number;
      advance_used?: number;
      advance_earned?: number;
      loyalty_points_earned?: number;
      items?: any[];
    },
    shopName = 'PrintPro Printing Center',
    financialSummary?: BillFinancialSummary
  ): string {
    const billNo = bill.bill_number || bill.invoiceNumber || 'BILL';
    const dateStr = new Date(bill.created_at || Date.now()).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const itemsText = (bill.items || [])
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.itemName || item.name || item.product_name}\n   Qty: ${item.qty || item.quantity} × ₹${Number(item.unitPrice || item.price || item.unit_price || 0).toFixed(2)} = ₹${Number(item.lineTotal || item.amount || item.total || 0).toFixed(2)}`
      )
      .join('\n\n');

    const grandTotal = Number(bill.grand_total || bill.total || 0);
    const directPaid = Number(bill.cash_paid || 0) + Number(bill.upi_paid || 0);
    const advUsed = Number(bill.advance_used || 0);
    const totalPaid = Number(bill.paid_total || (directPaid + advUsed));
    const isFullyPaid = totalPaid >= grandTotal - 0.01;

    let text = `🧾 *${shopName.toUpperCase()}*

Bill No : ${billNo}
Date : ${dateStr}
Customer : ${bill.customer_name || bill.customerName || 'Walk-in Customer'}

━━━━━━━━━━━━━━━━━━━━━━
*ITEMS*

${itemsText}

━━━━━━━━━━━━━━━━━━━━━━
Subtotal : ₹${Number(bill.total || grandTotal).toFixed(2)}
Discount : ₹${Number(bill.discount || 0).toFixed(2)}
Rounding : ${Number(bill.rounding_adjustment || 0) >= 0 ? '+' : ''}₹${Number(bill.rounding_adjustment || 0).toFixed(2)}
🧾 *Total Amount* : ₹${grandTotal.toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━
*PAYMENTS*
Cash Paid : ₹${Number(bill.cash_paid || 0).toFixed(2)}
UPI Paid : ₹${Number(bill.upi_paid || 0).toFixed(2)}
Advance Used : ₹${advUsed.toFixed(2)}
*Total Paid* : ₹${totalPaid.toFixed(2)}
Balance Due : ₹${Math.max(0, grandTotal - totalPaid).toFixed(2)}
Status : ${isFullyPaid ? 'Fully Paid ✅' : 'Payment Pending ⚠️'}`;

    if (financialSummary?.loyalty?.enabled && financialSummary.loyalty.points_earned > 0) {
      text += `\n\n━━━━━━━━━━━━━━━━━━━━━━\n🎁 Loyalty Earned: +${financialSummary.loyalty.points_earned} Points\nCurrent Balance: ${financialSummary.loyalty.current_points_balance} pts`;
    }

    text += `\n\nThank you for your business!`;
    return text;
  }
}
