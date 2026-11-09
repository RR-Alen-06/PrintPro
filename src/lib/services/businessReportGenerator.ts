import { jsPDF } from 'jspdf';
import { Bill, CustomerSummary, ShopSettings, Expense } from '../types';

export interface BusinessReportData {
  shop_settings: Partial<ShopSettings>;
  period_label: string;
  generated_at: string;
  kpi: {
    total_sales: number;
    total_paid: number;
    cash_total: number;
    upi_total: number;
    pending_total: number;
    total_tax: number;
    total_expenses: number;
    net_profit: number;
    total_bills: number;
    avg_bill_value: number;
    total_customers_due: number;
    total_dues_amount: number;
  };
  bills: Bill[];
  item_sales: { name: string; qty: number; total: number }[];
  due_customers: CustomerSummary[];
  expenses?: Expense[];
  cash_payers?: { customer_name: string; ref: string; date: string; amount: number }[];
  upi_payers?: { customer_name: string; ref: string; date: string; amount: number }[];
  transfers?: { transfer_number?: string | null; direction: string; amount: number; reason: string; created_at: string }[];
}

export class BusinessReportGenerator {
  /**
   * Generates a high-contrast, executive-grade Business Performance & Analytics PDF Report.
   */
  static generateReportPdf(data: BusinessReportData): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const renderRunningHeader = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`${data.shop_settings.shop_name || 'Business Analytics'} — Performance Report`, margin, y);
      doc.text(`Period: ${data.period_label}`, pageWidth - margin, y, { align: 'right' });
      y += 3.5;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    };

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 16) {
        doc.addPage();
        y = margin;
        renderRunningHeader();
      }
    };

    // =========================================================================
    // 1. TOP HEADER & METADATA
    // =========================================================================
    doc.setDrawColor(15, 23, 42); // slate-900
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Left Column: Store Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text((data.shop_settings.shop_name || 'SIMPLEBILLING CENTER').toUpperCase(), margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    y += 4.5;

    if (data.shop_settings.address) {
      doc.text(data.shop_settings.address, margin, y);
      y += 4;
    }

    const storeMeta = [
      data.shop_settings.phone ? `Ph: ${data.shop_settings.phone}` : null,
      data.shop_settings.gst_number ? `GSTIN: ${data.shop_settings.gst_number}` : null
    ].filter(Boolean).join('   |   ');

    if (storeMeta) {
      doc.text(storeMeta, margin, y);
      y += 4;
    }

    // Right Column: Report Details
    const rightX = pageWidth - margin;
    let rightY = margin + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('EXECUTIVE BUSINESS REPORT', rightX, rightY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    rightY += 4.5;
    doc.text(`Period Scope: ${data.period_label}`, rightX, rightY, { align: 'right' });
    rightY += 4;
    doc.text(`Generated: ${data.generated_at}`, rightX, rightY, { align: 'right' });

    y = Math.max(y, rightY) + 3;

    // Divider
    doc.setLineWidth(0.2);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // =========================================================================
    // 2. FINANCIAL KPI EXECUTIVE OVERVIEW TABLE
    // =========================================================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1. EXECUTIVE FINANCIAL SUMMARY & NET PROFIT', margin, y);
    y += 4;

    // 3x3 Metric Grid
    const kpiBoxHeight = 11;
    const kpiColWidth = contentWidth / 3;

    // Row 1: Sales, Collected, Expenses
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, kpiColWidth - 2, kpiBoxHeight, 1.5, 1.5, 'FD');
    doc.roundedRect(margin + kpiColWidth, y, kpiColWidth - 2, kpiBoxHeight, 1.5, 1.5, 'FD');
    doc.roundedRect(margin + kpiColWidth * 2, y, kpiColWidth, kpiBoxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL REVENUE', margin + 3, y + 3.5);
    doc.text('TOTAL COLLECTED', margin + kpiColWidth + 3, y + 3.5);
    doc.text('TOTAL EXPENSES', margin + kpiColWidth * 2 + 3, y + 3.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`INR ${data.kpi.total_sales.toFixed(2)}`, margin + 3, y + 8.5);
    doc.text(`INR ${data.kpi.total_paid.toFixed(2)}`, margin + kpiColWidth + 3, y + 8.5);
    doc.setTextColor(220, 38, 38); // red
    doc.text(`INR ${data.kpi.total_expenses.toFixed(2)}`, margin + kpiColWidth * 2 + 3, y + 8.5);

    y += kpiBoxHeight + 2;

    // Row 2: Net Profit, GST / Tax, Period Dues
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, kpiColWidth - 2, kpiBoxHeight, 1.5, 1.5, 'FD');
    doc.roundedRect(margin + kpiColWidth, y, kpiColWidth - 2, kpiBoxHeight, 1.5, 1.5, 'FD');
    doc.roundedRect(margin + kpiColWidth * 2, y, kpiColWidth, kpiBoxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('NET OPERATING PROFIT', margin + 3, y + 3.5);
    doc.text('GST / TAX COLLECTED', margin + kpiColWidth + 3, y + 3.5);
    doc.text('PERIOD PENDING DUES', margin + kpiColWidth * 2 + 3, y + 3.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    if (data.kpi.net_profit >= 0) {
      doc.setTextColor(22, 101, 52); // green
    } else {
      doc.setTextColor(220, 38, 38); // red
    }
    doc.text(`INR ${data.kpi.net_profit.toFixed(2)}`, margin + 3, y + 8.5);

    doc.setTextColor(15, 23, 42);
    doc.text(`INR ${data.kpi.total_tax.toFixed(2)}`, margin + kpiColWidth + 3, y + 8.5);

    doc.setTextColor(180, 83, 9); // amber
    doc.text(`INR ${data.kpi.pending_total.toFixed(2)}`, margin + kpiColWidth * 2 + 3, y + 8.5);

    y += kpiBoxHeight + 2;

    // Row 3: Cash / UPI Split, Invoices Generated, Average Bill
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, kpiColWidth - 2, kpiBoxHeight, 1.5, 1.5, 'FD');
    doc.roundedRect(margin + kpiColWidth, y, kpiColWidth - 2, kpiBoxHeight, 1.5, 1.5, 'FD');
    doc.roundedRect(margin + kpiColWidth * 2, y, kpiColWidth, kpiBoxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('CASH / UPI SPLIT', margin + 3, y + 3.5);
    doc.text('INVOICES GENERATED', margin + kpiColWidth + 3, y + 3.5);
    doc.text('AVERAGE BILL VALUE', margin + kpiColWidth * 2 + 3, y + 3.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Cash: ${data.kpi.cash_total.toFixed(0)} | UPI: ${data.kpi.upi_total.toFixed(0)}`, margin + 3, y + 8.5);
    doc.text(`${data.kpi.total_bills} Invoices`, margin + kpiColWidth + 3, y + 8.5);
    doc.text(`INR ${data.kpi.avg_bill_value.toFixed(2)}`, margin + kpiColWidth * 2 + 3, y + 8.5);

    y += kpiBoxHeight + 6;

    // =========================================================================
    // 3. SALES INVOICES REGISTER
    // =========================================================================
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`2. SALES INVOICES REGISTER (${data.bills.length} Invoices)`, margin, y);
    y += 4;

    const colBill = margin;
    const colDate = margin + 26;
    const colCust = margin + 62;
    const colMode = margin + 110;
    const colAmt = margin + 142;
    const colStatus = pageWidth - margin;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 5.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('BILL #', colBill + 2, y + 3.8);
    doc.text('DATE', colDate, y + 3.8);
    doc.text('CUSTOMER', colCust, y + 3.8);
    doc.text('MODE', colMode, y + 3.8);
    doc.text('TOTAL (INR)', colAmt, y + 3.8, { align: 'right' });
    doc.text('STATUS', colStatus - 2, y + 3.8, { align: 'right' });

    y += 6.5;

    if (data.bills.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('No sales bills recorded in this period.', margin + 2, y + 4);
      y += 8;
    } else {
      data.bills.forEach((b, idx) => {
        checkPageBreak(6);

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 0.5, contentWidth, 5, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(b.bill_number, colBill + 2, y + 3.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(70, 70, 70);
        const billDateStr = new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        doc.text(billDateStr, colDate, y + 3.2);

        const custDisplay = (b.customer_name || 'Walk-in').slice(0, 24);
        doc.text(custDisplay, colCust, y + 3.2);
        doc.text((b.payment_method || 'Cash').slice(0, 14), colMode, y + 3.2);

        doc.setFont('helvetica', 'bold');
        doc.text(Number(b.grand_total).toFixed(2), colAmt, y + 3.2, { align: 'right' });

        const isPaid = Number(b.paid_total || 0) >= Number(b.grand_total || 0) - 0.01;
        doc.setFontSize(7);
        if (isPaid) {
          doc.setTextColor(22, 101, 52); // green
          doc.text('Paid', colStatus - 2, y + 3.2, { align: 'right' });
        } else {
          doc.setTextColor(180, 83, 9); // amber
          doc.text('Pending', colStatus - 2, y + 3.2, { align: 'right' });
        }

        y += 5;
      });
      y += 3;
    }

    // =========================================================================
    // 4. ITEM & SERVICE SALES VOLUME
    // =========================================================================
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`3. ITEM & SERVICE SALES VOLUME (${data.item_sales.length} Items)`, margin, y);
    y += 4;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 5.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('PRODUCT / SERVICE NAME', margin + 2, y + 3.8);
    doc.text('QTY SOLD', margin + 110, y + 3.8, { align: 'center' });
    doc.text('REVENUE (INR)', pageWidth - margin - 2, y + 3.8, { align: 'right' });

    y += 6.5;

    if (data.item_sales.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('No item transactions recorded in this period.', margin + 2, y + 4);
      y += 8;
    } else {
      data.item_sales.forEach((it, idx) => {
        checkPageBreak(6);

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 0.5, contentWidth, 5, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(it.name.slice(0, 50), margin + 2, y + 3.2);

        doc.setFont('helvetica', 'bold');
        doc.text(String(it.qty), margin + 110, y + 3.2, { align: 'center' });
        doc.text(it.total.toFixed(2), pageWidth - margin - 2, y + 3.2, { align: 'right' });

        y += 5;
      });
      y += 3;
    }

    // =========================================================================
    // 5. CUSTOMER LEDGER & BALANCES
    // =========================================================================
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`4. CUSTOMER LEDGER & DUES SUMMARY (${data.due_customers.length} Accounts)`, margin, y);
    y += 4;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 5.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('CUSTOMER NAME', margin + 2, y + 3.8);
    doc.text('MOBILE', margin + 55, y + 3.8);
    doc.text('TOTAL BILLED (INR)', margin + 98, y + 3.8, { align: 'right' });
    doc.text('PAID BY CUST (INR)', margin + 132, y + 3.8, { align: 'right' });
    doc.text('BALANCE DUE (INR)', pageWidth - margin - 2, y + 3.8, { align: 'right' });

    y += 6.5;

    if (data.due_customers.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(22, 101, 52);
      doc.text('✓ All customer accounts are settled. Zero outstanding dues.', margin + 2, y + 4);
      y += 8;
    } else {
      data.due_customers.forEach((c, idx) => {
        checkPageBreak(6);

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 0.5, contentWidth, 5, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(c.name.slice(0, 26), margin + 2, y + 3.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text(c.mobile || 'N/A', margin + 55, y + 3.2);
        doc.text(Number(c.total_billed).toFixed(2), margin + 98, y + 3.2, { align: 'right' });
        doc.text(Number(c.total_paid).toFixed(2), margin + 132, y + 3.2, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        if (Number(c.balance_due) > 0) {
          doc.setTextColor(180, 83, 9);
        } else {
          doc.setTextColor(22, 101, 52);
        }
        doc.text(Number(c.balance_due).toFixed(2), pageWidth - margin - 2, y + 3.2, { align: 'right' });

        y += 5;
      });
      y += 3;
    }

    // =========================================================================
    // 6. OPERATING EXPENSES REGISTER (If expenses present)
    // =========================================================================
    if (data.expenses && data.expenses.length > 0) {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`5. OPERATING EXPENSES REGISTER (${data.expenses.length} Records)`, margin, y);
      y += 4;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('EXPENSE # / TITLE', margin + 2, y + 3.8);
      doc.text('CATEGORY', margin + 70, y + 3.8);
      doc.text('DATE', margin + 110, y + 3.8);
      doc.text('MODE', margin + 140, y + 3.8);
      doc.text('AMOUNT (INR)', pageWidth - margin - 2, y + 3.8, { align: 'right' });

      y += 6.5;

      data.expenses.forEach((exp, idx) => {
        checkPageBreak(6);

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 0.5, contentWidth, 5, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        const titleText = `${exp.expense_number ? exp.expense_number + ' - ' : ''}${exp.title}`.slice(0, 32);
        doc.text(titleText, margin + 2, y + 3.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text((exp.category || 'General').slice(0, 20), margin + 70, y + 3.2);
        
        const expDate = new Date(exp.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        doc.text(expDate, margin + 110, y + 3.2);
        doc.text((exp.payment_mode || 'Cash').slice(0, 14), margin + 140, y + 3.2);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text(Number(exp.amount).toFixed(2), pageWidth - margin - 2, y + 3.2, { align: 'right' });

        y += 5;
      });
      y += 3;
    }

    // =========================================================================
    // 6. CASH PAYERS REGISTER
    // =========================================================================
    if (data.cash_payers && data.cash_payers.length > 0) {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const totalCashAmount = data.cash_payers.reduce((s, c) => s + Number(c.amount || 0), 0);
      doc.text(`6. CASH PAYMENTS BREAKDOWN (${data.cash_payers.length} Payers — Total: INR ${totalCashAmount.toFixed(2)})`, margin, y);
      y += 4;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('CUSTOMER NAME', margin + 2, y + 3.8);
      doc.text('REF / BILL #', margin + 70, y + 3.8);
      doc.text('DATE', margin + 115, y + 3.8);
      doc.text('CASH RECEIVED (INR)', pageWidth - margin - 2, y + 3.8, { align: 'right' });

      y += 6.5;

      data.cash_payers.forEach((cp, idx) => {
        checkPageBreak(6);

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 0.5, contentWidth, 5, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(cp.customer_name.slice(0, 32), margin + 2, y + 3.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text(cp.ref, margin + 70, y + 3.2);

        let dateDisplay = cp.date;
        try {
          dateDisplay = new Date(cp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        } catch {}
        doc.text(dateDisplay, margin + 115, y + 3.2);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129); // green
        doc.text(Number(cp.amount).toFixed(2), pageWidth - margin - 2, y + 3.2, { align: 'right' });

        y += 5;
      });
      y += 3;
    }

    // =========================================================================
    // 7. UPI PAYERS REGISTER
    // =========================================================================
    if (data.upi_payers && data.upi_payers.length > 0) {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const totalUpiAmount = data.upi_payers.reduce((s, u) => s + Number(u.amount || 0), 0);
      doc.text(`7. UPI / BANK PAYMENTS BREAKDOWN (${data.upi_payers.length} Payers — Total: INR ${totalUpiAmount.toFixed(2)})`, margin, y);
      y += 4;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('CUSTOMER NAME', margin + 2, y + 3.8);
      doc.text('REF / BILL #', margin + 70, y + 3.8);
      doc.text('DATE', margin + 115, y + 3.8);
      doc.text('UPI RECEIVED (INR)', pageWidth - margin - 2, y + 3.8, { align: 'right' });

      y += 6.5;

      data.upi_payers.forEach((up, idx) => {
        checkPageBreak(6);

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 0.5, contentWidth, 5, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(up.customer_name.slice(0, 32), margin + 2, y + 3.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text(up.ref, margin + 70, y + 3.2);

        let dateDisplay = up.date;
        try {
          dateDisplay = new Date(up.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        } catch {}
        doc.text(dateDisplay, margin + 115, y + 3.2);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229); // indigo
        doc.text(Number(up.amount).toFixed(2), pageWidth - margin - 2, y + 3.2, { align: 'right' });

        y += 5;
      });
      y += 3;
    }

    // =========================================================================
    // 8. CONTRA TRANSFERS & CONVERSIONS (UPI ⇄ CASH)
    // =========================================================================
    if (data.transfers && data.transfers.length > 0) {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`8. INTERNAL TRANSFERS & CONVERSIONS (${data.transfers.length} Records)`, margin, y);
      y += 4;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('TRANSFER # / REASON', margin + 2, y + 3.8);
      doc.text('CONVERSION DIRECTION', margin + 75, y + 3.8);
      doc.text('DATE', margin + 125, y + 3.8);
      doc.text('AMOUNT (INR)', pageWidth - margin - 2, y + 3.8, { align: 'right' });

      y += 6.5;

      data.transfers.forEach((tr, idx) => {
        checkPageBreak(6);

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 0.5, contentWidth, 5, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        const tTitle = `${tr.transfer_number ? tr.transfer_number + ' - ' : ''}${tr.reason}`.slice(0, 36);
        doc.text(tTitle, margin + 2, y + 3.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const dirLabel = tr.direction === 'CASH_TO_UPI' ? 'Cash -> UPI (Deposit)' : 'UPI -> Cash (Withdrawal)';
        doc.setTextColor(tr.direction === 'CASH_TO_UPI' ? 79 : 16, tr.direction === 'CASH_TO_UPI' ? 70 : 185, tr.direction === 'CASH_TO_UPI' ? 229 : 129);
        doc.text(dirLabel, margin + 75, y + 3.2);

        let dateDisplay = tr.created_at;
        try {
          dateDisplay = new Date(tr.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        } catch {}
        doc.setTextColor(80, 80, 80);
        doc.text(dateDisplay, margin + 125, y + 3.2);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(Number(tr.amount).toFixed(2), pageWidth - margin - 2, y + 3.2, { align: 'right' });

        y += 5;
      });
      y += 3;
    }

    // =========================================================================
    // FOOTER & MULTI-PAGE NUMBERING
    // =========================================================================
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
      doc.text(
        `${data.shop_settings.shop_name || 'SimpleBilling Center'} — Official Business Report`,
        margin,
        pageHeight - 6
      );
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 6,
        { align: 'right' }
      );
    }

    return doc;
  }
}
