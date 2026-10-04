import { SequenceService } from './sequenceService'

export interface ReminderBusinessInfo {
  shopName?: string;
  phone?: string;
  upiId?: string;
  address?: string;
  email?: string;
  currency?: string;
  currencyCode?: string;
}

export interface ReminderSettings {
  currency?: string;
  currencyCode?: string;
  enableUpi?: boolean;
  taxLabel?: string;
  whatsappGreeting?: string;
  whatsappFooter?: string;
  includeUpiInWhatsApp?: boolean;
  defaultCountryCode?: string;
}

export class ReminderService {
  /**
   * Cleans and sanitizes phone numbers for WhatsApp API links.
   * Strips spaces, dashes, parentheses and adds default country code if missing.
   */
  static cleanPhone(phone?: string | null, defaultCountryCode = '91'): string {
    if (!phone) return '';
    let digits = phone.replace(/[^0-9]/g, '');
    if (digits.length === 10 && defaultCountryCode) {
      digits = defaultCountryCode.replace(/[^0-9]/g, '') + digits;
    }
    return digits;
  }

  /**
   * Generates a direct WhatsApp web/app link.
   */
  static getWhatsAppUrl(phone: string, text: string, defaultCountryCode?: string): string {
    const cleaned = this.cleanPhone(phone, defaultCountryCode);
    const encoded = encodeURIComponent(text);
    return cleaned
      ? `https://api.whatsapp.com/send?phone=${cleaned}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
  }

  /**
   * Builds an itemized invoice WhatsApp receipt message.
   */
  static buildInvoiceMessage(
    bill: any,
    business?: ReminderBusinessInfo,
    settings?: ReminderSettings
  ): string {
    const shop = business?.shopName || 'PrintPro Studio';
    const curr = settings?.currency || business?.currency || '₹';
    const invCode = bill.invoiceNumber || bill.bill_number || `INV-${String(bill.id).slice(0, 6)}`;
    const dateStr = bill.date ? new Date(bill.date).toLocaleDateString() : new Date().toLocaleDateString();
    const custName = bill.customerName || bill.customer_name || 'Valued Customer';
    const items = bill.items || [];
    const total = Number(bill.total !== undefined ? bill.total : (bill.grand_total || 0));
    const paid = Number(bill.paidTotal !== undefined ? bill.paidTotal : (bill.amount_paid !== undefined ? bill.amount_paid : (bill.totalPaid || 0)));
    const balance = Number(bill.balance !== undefined ? bill.balance : Math.max(0, total - paid));

    const greeting = settings?.whatsappGreeting
      ? settings.whatsappGreeting.replace('{customer_name}', custName)
      : `Dear *${custName}*,`;

    let lines: string[] = [];
    lines.push(`🧾 *${shop.toUpperCase()} — INVOICE*`);
    lines.push(greeting);
    lines.push(`Here is your bill receipt for invoice *#${invCode}* (${dateStr}):\n`);

    if (items.length > 0) {
      lines.push(`📋 *Item Details:*`);
      items.forEach((it: any, idx: number) => {
        const name = it.name || it.description || `Item ${idx + 1}`;
        const qty = Number(it.qty || it.quantity || 1);
        const amt = Number(it.amount || it.total || (qty * (it.rate || 0)));
        lines.push(`• ${name} × ${qty} = ${curr}${amt.toFixed(2)}`);
      });
      lines.push('');
    }

    lines.push(`💰 *Total Amount:* ${curr}${total.toFixed(2)}`);
    lines.push(`✅ *Amount Paid:* ${curr}${paid.toFixed(2)}`);
    if (balance > 0) {
      lines.push(`⚠️ *Balance Due:* ${curr}${balance.toFixed(2)}`);
    } else {
      lines.push(`🎉 *Payment Status:* FULLY PAID`);
    }

    const showUpi = settings?.enableUpi !== false && settings?.includeUpiInWhatsApp !== false && Boolean(business?.upiId);
    if (balance > 0 && showUpi && business?.upiId) {
      const currCode = settings?.currencyCode || 'INR';
      const upiLink = `upi://pay?pa=${encodeURIComponent(business.upiId)}&pn=${encodeURIComponent(shop)}&am=${balance.toFixed(2)}&cu=${currCode}&tn=${encodeURIComponent(`Invoice ${invCode}`)}`;
      lines.push(`\n💳 *Pay Instantly via UPI:*`);
      lines.push(upiLink);
    }

    const footer = settings?.whatsappFooter
      ? settings.whatsappFooter.replace('{shop_name}', shop)
      : `Thank you for choosing *${shop}*! For any queries, contact us at ${business?.phone || ''}.`;

    lines.push(`\n${footer}`);
    return lines.join('\n');
  }

  /**
   * Builds an overdue customer balance reminder with UPI collection link.
   */
  static buildLedgerReminderMessage(
    customer: any,
    closingBalance: number,
    business?: ReminderBusinessInfo,
    settings?: ReminderSettings
  ): string {
    const shop = business?.shopName || 'PrintPro Studio';
    const curr = settings?.currency || business?.currency || '₹';
    const custName = customer.name || 'Customer';
    const balDue = Math.abs(closingBalance);

    const greeting = settings?.whatsappGreeting
      ? settings.whatsappGreeting.replace('{customer_name}', custName)
      : `Dear *${custName}*,`;

    let lines: string[] = [];
    lines.push(`🔔 *PAYMENT REMINDER — ${shop.toUpperCase()}*`);
    lines.push(greeting);
    lines.push(`We hope you are having a wonderful day.`);
    lines.push(`This is a gentle reminder regarding your outstanding ledger balance with *${shop}*.\n`);
    lines.push(`📊 *Outstanding Balance Due:* ${curr}${balDue.toFixed(2)}`);

    const showUpi = settings?.enableUpi !== false && settings?.includeUpiInWhatsApp !== false && Boolean(business?.upiId);
    if (showUpi && business?.upiId) {
      const currCode = settings?.currencyCode || 'INR';
      const upiLink = `upi://pay?pa=${encodeURIComponent(business.upiId)}&pn=${encodeURIComponent(shop)}&am=${balDue.toFixed(2)}&cu=${currCode}&tn=${encodeURIComponent(`Ledger Balance Clear - ${custName}`)}`;
      lines.push(`\n💳 *1-Click Instant UPI Payment:*`);
      lines.push(upiLink);
      lines.push(`_UPI ID: ${business.upiId}_`);
    }

    const footer = settings?.whatsappFooter
      ? settings.whatsappFooter.replace('{shop_name}', shop)
      : `Kindly clear the pending balance at your earliest convenience. Thank you for your continued business!\n— *${shop}*`;

    lines.push(`\n${footer}`);
    return lines.join('\n');
  }

  /**
   * Builds an advance deposit / refund receipt confirmation.
   */
  static buildAdvanceConfirmationMessage(
    advance: any,
    customer: any,
    business?: ReminderBusinessInfo,
    settings?: ReminderSettings
  ): string {
    const shop = business?.shopName || 'PrintPro Studio';
    const curr = settings?.currency || business?.currency || '₹';
    const custName = customer.name || 'Valued Customer';
    const isReturn = advance.isReturn || Number(advance.amount || 0) < 0;
    const amt = Math.abs(Number(advance.amount || 0));
    const ref = advance.id ? `ADV-${String(advance.id).slice(0, 6).toUpperCase()}` : 'ADV';
    const dateStr = advance.date ? new Date(advance.date).toLocaleDateString() : new Date().toLocaleDateString();

    let lines: string[] = [];
    lines.push(`📑 *${shop.toUpperCase()} — ${isReturn ? 'REFUND RECEIPT' : 'ADVANCE DEPOSIT RECEIPT'}*`);
    lines.push(`Dear *${custName}*,`);
    lines.push(`This confirms that an ${isReturn ? 'advance refund' : 'advance deposit'} of *${curr}${amt.toFixed(2)}* was recorded on *${dateStr}*.\n`);
    lines.push(`• *Reference No:* ${ref}`);
    lines.push(`• *Amount:* ${curr}${amt.toFixed(2)}`);
    if (advance.notes) {
      lines.push(`• *Notes:* ${advance.notes}`);
    }
    lines.push(`\nThank you for choosing *${shop}*!`);
    return lines.join('\n');
  }

  /**
   * Builds an itemized refund voucher / return receipt.
   */
  static buildRefundVoucherMessage(
    refund: {
      id?: string;
      date?: string;
      amount: number;
      mode?: string; // 'cash' | 'upi' | 'advance' | 'store_credit' | 'card' | 'bank_transfer'
      invoiceNumber?: string;
      notes?: string;
    },
    customer: any,
    business?: ReminderBusinessInfo,
    settings?: ReminderSettings
  ): string {
    const shop = business?.shopName || 'PrintPro Studio';
    const curr = settings?.currency || business?.currency || '₹';
    const custName = customer?.name || 'Valued Customer';
    const amt = Math.abs(Number(refund.amount || 0));
    const ref = refund.id ? `REF-${String(refund.id).slice(0, 6).toUpperCase()}` : 'REFUND';
    const dateStr = refund.date ? new Date(refund.date).toLocaleDateString() : new Date().toLocaleDateString();
    const modeLabel = refund.mode === 'advance' || refund.mode === 'store_credit'
      ? 'STORE CREDIT / ADVANCE WALLET'
      : (refund.mode === 'upi' ? 'UPI TRANSFER' : (refund.mode === 'card' ? 'CARD REFUND' : (refund.mode === 'bank_transfer' ? 'BANK TRANSFER' : 'CASH REFUND')));

    let lines: string[] = [];
    lines.push(`💳 *${shop.toUpperCase()} — REFUND VOUCHER*`);
    lines.push(`Dear *${custName}*,`);
    lines.push(`This confirms that a refund of *${curr}${amt.toFixed(2)}* has been processed on *${dateStr}*.\n`);
    lines.push(`• *Voucher Reference:* ${ref}`);
    if (refund.invoiceNumber) {
      lines.push(`• *Original Invoice:* #${refund.invoiceNumber}`);
    }
    lines.push(`• *Refund Mode:* ${modeLabel}`);
    lines.push(`• *Refunded Amount:* ${curr}${amt.toFixed(2)}`);
    if (refund.notes) {
      lines.push(`• *Reason / Notes:* ${refund.notes}`);
    }
    if (refund.mode === 'advance' || refund.mode === 'store_credit') {
      lines.push(`\n💰 _The amount has been added to your Advance Credit Balance and is ready for use on your next invoice._`);
    }
    lines.push(`\nThank you for your patience and business with *${shop}*!`);
    return lines.join('\n');
  }

  /**
   * Builds a customer account statement summary message for WhatsApp.
   */
  static buildCustomerStatementMessage(
    customer: any,
    summary: {
      totalDebits: number;
      totalCredits: number;
      finalBalance: number;
      totalAdvanceIn?: number;
      totalAdvanceReturned?: number;
      totalAdvanceUsed?: number;
      outstanding?: number;
      period?: string;
      pdfUrl?: string;
    },
    business?: ReminderBusinessInfo,
    settings?: ReminderSettings
  ): string {
    const shop = business?.shopName || 'PrintPro Studio';
    const curr = settings?.currency || business?.currency || '₹';
    const custName = customer?.name || 'Valued Customer';
    const custCode = customer?.customerCode || (customer?.id ? SequenceService.formatDisplayCode('customer', customer, 'CUS') : '');
    const dateStr = new Date().toLocaleDateString();
    const isDue = summary.finalBalance > 0;
    const isCredit = summary.finalBalance < 0;

    let lines: string[] = [];
    lines.push(`📊 *${shop.toUpperCase()} — ACCOUNT STATEMENT*`);
    lines.push(`Dear *${custName}* ${custCode ? `(${custCode})` : ''},`);
    lines.push(`Here is your latest account statement summary as of *${dateStr}*${summary.period && summary.period !== 'all' ? ` (${summary.period.toUpperCase()})` : ''}:\n`);
    lines.push(`• *Total Invoiced (Debits):* ${curr}${summary.totalDebits.toFixed(2)}`);
    lines.push(`• *Total Paid (Credits):* ${curr}${summary.totalCredits.toFixed(2)}`);
    if (summary.totalAdvanceIn && summary.totalAdvanceIn > 0) {
      lines.push(`• *Advance Deposited:* ${curr}${summary.totalAdvanceIn.toFixed(2)}`);
    }
    if (summary.totalAdvanceUsed && summary.totalAdvanceUsed > 0) {
      lines.push(`• *Advance Used:* ${curr}${summary.totalAdvanceUsed.toFixed(2)}`);
    }
    lines.push(`------------------------`);
    if (isDue) {
      lines.push(`⚠️ *Net Balance Due:* *${curr}${summary.finalBalance.toFixed(2)}*`);
    } else if (isCredit) {
      lines.push(`🎉 *Advance Credit Balance:* *${curr}${Math.abs(summary.finalBalance).toFixed(2)}* (Available for future bills)`);
    } else {
      lines.push(`✅ *Net Balance:* *${curr}0.00* (All Settled)`);
    }

    const showUpi = settings?.enableUpi !== false && settings?.includeUpiInWhatsApp !== false && Boolean(business?.upiId);
    if (isDue && showUpi && business?.upiId) {
      const currCode = settings?.currencyCode || 'INR';
      const upiLink = `upi://pay?pa=${encodeURIComponent(business.upiId)}&pn=${encodeURIComponent(shop)}&am=${summary.finalBalance.toFixed(2)}&cu=${currCode}&tn=${encodeURIComponent(`Statement Pay - ${custName}`)}`;
      lines.push(`\n💳 *Instant 1-Click UPI Payment:*`);
      lines.push(upiLink);
      lines.push(`_UPI ID: ${business.upiId}_`);
    }

    if (summary.pdfUrl) {
      lines.push(`\n📄 *Download Full Statement PDF:* ${summary.pdfUrl}`);
    }

    const footer = settings?.whatsappFooter
      ? settings.whatsappFooter.replace('{shop_name}', shop)
      : `Thank you for your business with *${shop}*! For queries, contact ${business?.phone || ''}.`;

    lines.push(`\n${footer}`);
    return lines.join('\n');
  }
}


