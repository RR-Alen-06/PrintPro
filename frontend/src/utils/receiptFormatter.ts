/**
 * Formats a bill/invoice as a clean, modern, and professional WhatsApp receipt
 * adhering to strict POS ledger accounting standards with multi-template & advance options support.
 */

export interface ReceiptFormatOptions {
  template?: 'itemized' | 'concise' | 'due_reminder' | 'formal_statement';
  includePreviousDues?: boolean;
  includeAdvanceBalance?: boolean;
  includeUpiPayLink?: boolean;
  includeItemSpecs?: boolean;
  includePdfLink?: boolean;
  customNote?: string;
  previousBalance?: number;
}

export interface ExtraReceiptData {
  bills?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  customers?: Array<Record<string, unknown>>;
  previousBalance?: number;
  [key: string]: unknown;
}

/**
 * Generates an intent URL for UPI Payment
 */
export const getUpiPaymentLink = (upiId: string, shopName: string, amount: number, billNumber: string): string => {
  if (!upiId) return '';
  const cleanUpi = encodeURIComponent(upiId.trim());
  const cleanName = encodeURIComponent((shopName || 'PrintPro').trim());
  const cleanAmount = Number(amount || 0).toFixed(2);
  const cleanNote = encodeURIComponent(`Bill ${billNumber || ''}`.trim());
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${cleanNote}`;
};

/**
 * Generates a visual QR code image URL for a UPI payment link
 */
export const getUpiQrCodeUrl = (upiId: string, shopName: string, amount: number, billNumber: string): string => {
  const upiLink = getUpiPaymentLink(upiId, shopName, amount, billNumber);
  if (!upiLink) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
};

/**
 * Main WhatsApp receipt formatter supporting Itemized, Concise, Due Reminder, and Formal Statement templates
 */
export const formatWhatsAppReceipt = (
  bill: Record<string, unknown>,
  settings: Record<string, unknown> = {},
  business: Record<string, unknown> = {},
  pdfUrl: string = '',
  extraData: ExtraReceiptData = {},
  options: ReceiptFormatOptions = {}
): string => {
  if (!bill) return '';

  const template = options.template || 'itemized';
  const includePreviousDues = options.includePreviousDues !== false;
  const includeAdvanceBalance = options.includeAdvanceBalance !== false;
  const includeUpiPayLink = options.includeUpiPayLink !== false;
  const includeItemSpecs = options.includeItemSpecs !== false;
  const includePdfLink = options.includePdfLink !== false;

  const { bills = [], payments = [], customers = [] } = extraData;

  // 1. Find Customer Info
  const custId = bill.customerId || bill.customer_id;
  const customer = customers.find(
    (c) => String(c.id) === String(custId) || (c.customerCode && String(c.customerCode) === String(custId)) || (c.code && String(c.code) === String(custId))
  );
  const customerCode = (customer?.customerCode || customer?.code || '') as string;
  const customerDisplay = (bill.customerName || bill.customer_name || customer?.name || 'Valued Customer') as string;
  const customerSuffix = customerCode ? ` (${customerCode})` : '';

  // 2. Previous Outstanding Calculation
  let previousOutstanding = 0;
  if (options.previousBalance !== undefined) {
    previousOutstanding = Number(options.previousBalance || 0);
  } else if (extraData.previousBalance !== undefined) {
    previousOutstanding = Number(extraData.previousBalance || 0);
  } else if (custId) {
    const currentBillDateStr = (bill.createdAt || bill.created_at || bill.date || '') as string;
    const currentBillTime = currentBillDateStr ? new Date(currentBillDateStr).getTime() : Date.now();

    const pastBills = bills.filter((b) => {
      if (b.deleted || b.deleted_at) return false;
      const bCustId = b.customerId || b.customer_id;
      if (String(bCustId) !== String(custId)) return false;
      if (String(b.id) === String(bill.id)) return false;

      const bDateStr = (b.createdAt || b.created_at || b.date || '') as string;
      const bTime = bDateStr ? new Date(bDateStr).getTime() : 0;
      if (bTime && currentBillTime && bTime !== currentBillTime) {
        return bTime < currentBillTime;
      }
      return true;
    });

    if (pastBills.length > 0) {
      previousOutstanding = pastBills.reduce((sum: number, b) => {
        const bal = b.balance !== undefined ? Number(b.balance) : Math.max(0, Number(b.total || 0) - Number(b.amountPaid || b.amount_paid || 0));
        return sum + (isNaN(bal) ? 0 : bal);
      }, 0);
    } else if (customer) {
      const currentBillBal = bill.balance !== undefined ? Number(bill.balance) : Math.max(0, Number(bill.total || 0) - Number(bill.amountPaid || bill.amount_paid || 0));
      const totalCustDue = Number(customer.balanceDue || customer.balance_due || 0);
      previousOutstanding = Math.max(0, totalCustDue - currentBillBal);
    }
  }

  // 3. Current Bill Total
  const currentBill = Number(
    bill.total !== undefined
      ? bill.total
      : bill.total_amount !== undefined
      ? bill.total_amount
      : bill.totalAmount !== undefined
      ? bill.totalAmount
      : bill.amount !== undefined
      ? bill.amount
      : 0
  );

  // 4. Total Amount Due (Gross Outstanding)
  const totalAmountDue = (includePreviousDues ? previousOutstanding : 0) + currentBill;

  // 5. Payment Received for this Transaction
  const billPayments = payments.filter((p) => !p.deleted && !p.deleted_at && String(p.billId || p.bill_id) === String(bill.id));
  const pm = bill.paymentMethod as Record<string, unknown> | undefined;
  const pmCash = Number(pm?.cash || bill.cash_amount || bill.cashAmount || 0);
  const pmUpi = Number(pm?.upi || bill.upi_amount || bill.upiAmount || 0);
  const cashPaid = billPayments.length > 0
    ? billPayments.reduce((sum: number, p) => sum + Number(p.cashAmount || p.cash_amount || 0), 0)
    : pmCash;
  const upiPaid = billPayments.length > 0
    ? billPayments.reduce((sum: number, p) => sum + Number(p.upiAmount || p.upi_amount || 0), 0)
    : pmUpi;

  const advanceUsed = Number(bill.advanceUsed || bill.advanceDeducted || bill.advance_deducted || 0);
  const rawDirectPaid = bill.amountPaid !== undefined
    ? bill.amountPaid
    : bill.amount_paid !== undefined
    ? bill.amount_paid
    : bill.paid_amount !== undefined
    ? bill.paid_amount
    : (cashPaid + upiPaid);
  const directPaid = Number(rawDirectPaid || 0);
  const paidNow = Math.max(directPaid, cashPaid + upiPaid) + advanceUsed;

  // 6. Remaining Net Balance
  const rawBal = bill.balance !== undefined
    ? bill.balance
    : bill.balance_amount !== undefined
    ? bill.balance_amount
    : bill.balanceAmount !== undefined
    ? bill.balanceAmount
    : undefined;
  const remainingBalance = rawBal !== undefined && !includePreviousDues
    ? Math.max(0, Number(rawBal))
    : Math.max(0, totalAmountDue - paidNow);

  // 7. Customer Advance Balance
  const customerAdvanceBalance = Number(customer?.advanceBalance || customer?.advance_balance || 0);

  // Formatting variables
  const divider = '━━━━━━━━━━━━━━━━━━━━━━';
  const shopName = (business?.shopName || settings?.shopName || 'PrintPro') as string;
  const phone = (business?.phone || settings?.phone || '') as string;
  const address = (business?.address || settings?.address || '') as string;
  const gstin = (business?.gstin || settings?.gstNumber || settings?.taxNumber || '') as string;
  const upiId = (business?.upiId || settings?.upiId || '') as string;
  const billNumber = (
    bill.billNumber ||
    bill.bill_number ||
    bill.billSequence ||
    bill.bill_sequence ||
    bill.invoiceNumber ||
    bill.invoice_number ||
    bill.id ||
    ''
  ) as string;

  let formattedDate = (bill.date || '') as string;
  if (bill.date) {
    try {
      const dObj = new Date(bill.date as string);
      if (!isNaN(dObj.getTime())) {
        const dateOpts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        formattedDate = dObj.toLocaleDateString('en-GB', dateOpts).replace(/ /g, '-');
      }
    } catch (_) {
      formattedDate = String(bill.date);
    }
  }

  // Footer notes fallback
  const footerNote = (options.customNote || settings?.footerNotes || settings?.footerText || business?.footerNotes || '') as string;

  // TEMPLATE 1: DUE REMINDER
  if (template === 'due_reminder') {
    let msg = `⚠️ *PAYMENT REMINDER*\n`;
    msg += `🏪 *${shopName}*\n`;
    if (phone) msg += `📞 Contact: ${phone}\n`;
    msg += `${divider}\n\n`;
    msg += `Dear *${customerDisplay}*${customerSuffix},\n\n`;
    msg += `This is a friendly reminder regarding your outstanding balance with *${shopName}*.\n\n`;
    msg += `📄 *Bill Reference:* #${billNumber}\n`;
    msg += `📅 *Bill Date:* ${formattedDate}\n`;
    msg += `💵 *Bill Amount:* ₹${currentBill.toFixed(2)}\n`;
    if (includePreviousDues && previousOutstanding > 0) {
      msg += `⏮️ *Past Outstanding:* ₹${previousOutstanding.toFixed(2)}\n`;
    }
    msg += `💳 *Total Amount Due:* *₹${(remainingBalance > 0 ? remainingBalance : currentBill).toFixed(2)}*\n\n`;
    msg += `${divider}\n`;

    if (includeUpiPayLink && upiId && remainingBalance > 0) {
      const upiLink = getUpiPaymentLink(upiId, shopName, remainingBalance, billNumber);
      msg += `📲 *Pay Instantly via UPI (GPay / PhonePe / Paytm):*\n${upiLink}\n\n`;
      msg += `*UPI ID:* \`${upiId}\`\n\n`;
    }

    if (includePdfLink && pdfUrl) {
      msg += `📥 *View / Download Bill:* ${pdfUrl}\n\n`;
    }

    if (footerNote) {
      msg += `${footerNote}\n\n`;
    }

    msg += `Kindly clear the pending balance at your earliest convenience.\n`;
    msg += `Thank you for your business!`;
    return msg;
  }

  // TEMPLATE 2: CONCISE RECEIPT
  if (template === 'concise') {
    let msg = `🧾 *${shopName}*\n`;
    msg += `Invoice: *#${billNumber}* • Date: ${formattedDate}\n`;
    msg += `Customer: *${customerDisplay}*${customerSuffix}\n`;
    msg += `${divider}\n`;
    msg += `*Total Amount:* ₹${currentBill.toFixed(2)}\n`;
    msg += `*Paid Amount:* ₹${paidNow.toFixed(2)}\n`;

    if (remainingBalance <= 0) {
      msg += `*Status:* ✅ *Paid in Full*\n`;
    } else {
      msg += `*Balance Due:* ⚠️ *₹${remainingBalance.toFixed(2)}*\n`;
    }

    if (includeAdvanceBalance && customerAdvanceBalance > 0) {
      msg += `*Advance Wallet:* ₹${customerAdvanceBalance.toFixed(2)}\n`;
    }

    if (includeUpiPayLink && upiId && remainingBalance > 0) {
      const upiLink = getUpiPaymentLink(upiId, shopName, remainingBalance, billNumber);
      msg += `\n📲 *Pay UPI:* ${upiLink}\n`;
    }

    if (includePdfLink && pdfUrl) {
      msg += `📥 *PDF Receipt:* ${pdfUrl}\n`;
    }

    if (footerNote) {
      msg += `\n${footerNote}\n`;
    }

    msg += `\nThank you for choosing ${shopName}!`;
    return msg;
  }

  // TEMPLATE 3: FORMAL STATEMENT
  if (template === 'formal_statement') {
    let msg = `📋 *ACCOUNT STATEMENT & INVOICE*\n`;
    msg += `🏪 *${shopName}*\n`;
    if (address) msg += `📍 ${address}\n`;
    if (gstin) msg += `🏛️ GSTIN: ${gstin}\n`;
    if (phone) msg += `📞 Phone: ${phone}\n`;
    msg += `${divider}\n`;
    msg += `*Customer:* ${customerDisplay}${customerSuffix}\n`;
    msg += `*Invoice No:* #${billNumber}\n`;
    msg += `*Date:* ${formattedDate}\n`;
    msg += `${divider}\n`;
    msg += `*TRANSACTION RECONCILIATION*\n`;
    msg += `Current Bill Subtotal:   ₹${Number(bill.subtotal || currentBill).toFixed(2)}\n`;
    if (Number(bill.discount_value || bill.discount || 0) > 0) {
      msg += `Discount Applied:        -₹${Number(bill.discount_value || bill.discount || 0).toFixed(2)}\n`;
    }
    if (Number(bill.gst_amount || 0) > 0) {
      msg += `GST:                     +₹${Number(bill.gst_amount || 0).toFixed(2)}\n`;
    }
    msg += `Current Invoice Total:    ₹${currentBill.toFixed(2)}\n`;

    if (includePreviousDues) {
      msg += `Previous Ledger Balance:  ₹${previousOutstanding.toFixed(2)}\n`;
      msg += `Gross Total Due:          ₹${totalAmountDue.toFixed(2)}\n`;
    }

    msg += `${divider}\n`;
    msg += `*SETTLEMENT STATUS*\n`;
    msg += `Total Paid (This Bill):   ₹${paidNow.toFixed(2)}\n`;
    msg += `Net Outstanding Balance:  *₹${remainingBalance.toFixed(2)}*\n`;

    if (includeAdvanceBalance && customerAdvanceBalance > 0) {
      msg += `Customer Advance Credit:  ₹${customerAdvanceBalance.toFixed(2)}\n`;
    }

    if (includeUpiPayLink && upiId && remainingBalance > 0) {
      const upiLink = getUpiPaymentLink(upiId, shopName, remainingBalance, billNumber);
      msg += `\n💳 *Direct UPI Settlement Link:*\n${upiLink}\n`;
    }

    if (includePdfLink && pdfUrl) {
      msg += `\n📥 *Download Official Tax Invoice (PDF):* ${pdfUrl}\n`;
    }

    if (footerNote) {
      msg += `\n${footerNote}\n`;
    }

    msg += `\nGenerated by ${shopName} ERP.`;
    return msg;
  }

  // TEMPLATE 4 (DEFAULT): FULL ITEMIZED POS RECEIPT
  let result = `🧾 *${shopName}*\n\n`;
  result += `🏪 *${shopName.toUpperCase()}*\n`;
  if (address) result += `📍 ${address}\n`;
  if (phone) result += `📞 ${phone}\n`;
  if (gstin) result += `🏛️ GSTIN: ${gstin}\n`;
  result += `\n`;
  result += `Bill No : ${billNumber}\n`;
  result += `Date : ${formattedDate}\n`;
  result += `Customer : ${customerDisplay}${customerSuffix}\n\n`;

  result += `${divider}\n`;
  result += `*ITEMS*\n\n`;

  const billItems = (bill.items as Array<Record<string, unknown>>) || [];
  if (billItems.length > 0) {
    billItems.forEach((item, index) => {
      const sidesSuffix = includeItemSpecs && item.sides ? ` ${String(item.sides).charAt(0).toUpperCase() + String(item.sides).slice(1)}` : '';
      const printTypeSuffix = includeItemSpecs && item.printType ? ` ${String(item.printType).toUpperCase()}` : (includeItemSpecs && item.print_type ? ` ${String(item.print_type).toUpperCase()}` : '');
      const itemName = item.name || item.itemName || item.item_name || 'Print Item';
      const qty = item.qty || item.quantity || 1;
      const rate = Number(item.unitPrice || item.price || item.unit_price || item.rate || 0);
      const lineTotal = Number(item.amount || item.lineTotal || item.total || (Number(qty) * rate));

      result += `${index + 1}. ${itemName}${printTypeSuffix}${sidesSuffix}\n`;
      result += `   Qty : ${qty} × ₹${rate.toFixed(2)} = ₹${lineTotal.toFixed(2)}\n\n`;
    });
  } else {
    result += `No items\n\n`;
  }

  result += `${divider}\n\n`;
  result += `Subtotal              ₹${Number(bill.subtotal || currentBill).toFixed(2)}\n`;

  const totalDiscount = Number(bill.discountAmount || 0) + Number(bill.promoDiscount || 0) + Number(bill.loyaltyDiscount || 0) + Number(bill.discount || bill.discount_value || 0);
  if (totalDiscount > 0) {
    result += `Discount              -₹${totalDiscount.toFixed(2)}\n`;
  }

  const gstAmount = Number(bill.gstAmount || bill.gst_amount || bill.tax || 0);
  if (gstAmount > 0) {
    result += `GST                   +₹${gstAmount.toFixed(2)}\n`;
  }
  result += `\n`;
  result += `🧾 *Current Bill Total* ₹${currentBill.toFixed(2)}\n\n`;

  if (includePreviousDues) {
    result += `${divider}\n`;
    result += `*LEDGER SUMMARY*\n\n`;
    result += `Previous Outstanding      ₹${previousOutstanding.toFixed(2)}\n`;
    result += `Current Bill              ₹${currentBill.toFixed(2)}\n\n`;
    result += `Total Amount Due          ₹${totalAmountDue.toFixed(2)}\n\n`;
  }

  result += `${divider}\n`;
  result += `*PAYMENT RECEIVED*\n\n`;
  result += `Cash Paid                 ₹${cashPaid.toFixed(2)}\n`;
  result += `UPI Paid                  ₹${upiPaid.toFixed(2)}\n`;
  if (advanceUsed > 0) {
    result += `Advance Used              ₹${advanceUsed.toFixed(2)}\n`;
  }
  result += `\nPaid Now                  ₹${paidNow.toFixed(2)}\n\n`;

  result += `${divider}\n`;
  result += `*BALANCE SUMMARY*\n\n`;
  if (remainingBalance <= 0) {
    result += `Status                    Paid in Full\n\n`;
  } else {
    result += `Remaining to Pay          ₹${remainingBalance.toFixed(2)}\n\n`;
  }
  if (includeAdvanceBalance && customerAdvanceBalance > 0) {
    result += `Customer Advance Balance  ₹${customerAdvanceBalance.toFixed(2)}\n\n`;
  }

  const pointsEarned = Number(bill.loyaltyPointsEarned !== undefined ? bill.loyaltyPointsEarned : (bill.pointsEarned !== undefined ? bill.pointsEarned : 0));
  const pointsRedeemed = Number(bill.loyaltyPointsRedeemed || bill.pointsRedeemed || 0);
  const custTotalPoints = Number(customer?.loyaltyPoints || customer?.loyalty_points || bill.customerTotalLoyaltyPoints || 0);
  const isFullySettled = remainingBalance <= 0;
  const prevPoints = custTotalPoints >= pointsEarned
    ? Math.max(0, custTotalPoints - pointsEarned + pointsRedeemed)
    : custTotalPoints;
  const netPoints = isFullySettled
    ? Math.max(custTotalPoints, prevPoints + pointsEarned - pointsRedeemed)
    : custTotalPoints;

  if (pointsEarned > 0 || pointsRedeemed > 0 || custTotalPoints > 0) {
    result += `${divider}\n`;
    result += `*LOYALTY POINTS SUMMARY*\n\n`;
    result += `Previous Points Balance   ${prevPoints} pts\n`;
    if (pointsEarned > 0) {
      result += `Points Earned (This Bill) +${pointsEarned} pts\n`;
    }
    if (pointsRedeemed > 0) {
      result += `Points Redeemed           -${pointsRedeemed} pts\n`;
    }
    result += `Net Available Balance     ${netPoints} pts\n`;
    if (pointsEarned > 0) {
      result += isFullySettled
        ? `(✅ +${pointsEarned} Points Credited to wallet)\n\n`
        : `(⏳ +${pointsEarned} pts pending settlement)\n\n`;
    } else {
      result += `\n`;
    }
  }

  if (includeUpiPayLink && remainingBalance > 0 && upiId) {
    const upiLink = getUpiPaymentLink(upiId, shopName, remainingBalance, billNumber);
    result += `💳 *Pay Online via UPI (Net Due: ₹${remainingBalance.toFixed(2)}):*\n${upiLink}\nUPI ID: ${upiId}\n\n`;
  }

  if (includePdfLink && pdfUrl) {
    result += `📥 *Download PDF Receipt:* ${pdfUrl}\n\n`;
  }

  if (footerNote) {
    result += `📝 ${footerNote}\n\n`;
  }

  result += `Thank you for visiting.\n`;
  result += `Powered by PrintPro ERP`;

  return result;
};

/**
 * Formats standard bill receipt summary for WhatsApp sharing
 */
export const formatReceiptForWhatsApp = (bill: Record<string, unknown>, settings: Record<string, unknown> = {}): string => {
  return formatWhatsAppReceipt(bill, settings, settings, '', {}, { template: 'itemized' });
};
