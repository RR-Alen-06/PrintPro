import { jsPDF } from 'jspdf';
import { CustomerStatementData, StatementInvoice, StatementLineItem } from '../types/billing';
import { SequenceService } from './sequenceService';

export interface StatementFilterRange {
  startDate?: string | null;
  endDate?: string | null;
}

export const STATEMENT_PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

export class StatementService {
  /**
   * Resolves date boundaries and human-readable label for the selected filter.
   */
  static getFilterBoundaries(filter: string, customRange?: StatementFilterRange): { start: Date | null; end: Date | null; label: string } {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (filter) {
      case 'today':
        return {
          start: todayStart,
          end: todayEnd,
          label: `Today (${todayStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})`,
        };

      case 'yesterday': {
        const yStart = new Date(todayStart);
        yStart.setDate(todayStart.getDate() - 1);
        const yEnd = new Date(yStart);
        yEnd.setHours(23, 59, 59, 999);
        return {
          start: yStart,
          end: yEnd,
          label: `Yesterday (${yStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})`,
        };
      }

      case 'this_week': {
        const day = todayStart.getDay();
        const monday = new Date(todayStart);
        monday.setDate(todayStart.getDate() - (day === 0 ? 6 : day - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return {
          start: monday,
          end: sunday,
          label: `${monday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${sunday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        };
      }

      case 'last_7_days': {
        const start7 = new Date(todayStart);
        start7.setDate(todayStart.getDate() - 6);
        return {
          start: start7,
          end: todayEnd,
          label: `Last 7 Days (${start7.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${todayEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})`,
        };
      }

      case 'this_month': {
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return {
          start: startMonth,
          end: endMonth,
          label: `${startMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        };
      }

      case 'last_month': {
        const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return {
          start: startLastMonth,
          end: endLastMonth,
          label: `${startLastMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        };
      }

      case 'this_quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        const startQ = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
        const endQ = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
        return {
          start: startQ,
          end: endQ,
          label: `Q${quarter + 1} (${startQ.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${endQ.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})`,
        };
      }

      case 'this_year': {
        const startYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        const endYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return {
          start: startYear,
          end: endYear,
          label: `Year ${now.getFullYear()}`,
        };
      }

      case 'custom': {
        let start: Date | null = null;
        let end: Date | null = null;
        if (customRange?.startDate) {
          const [y, m, d] = customRange.startDate.split('-').map(Number);
          start = new Date(y, m - 1, d, 0, 0, 0, 0);
        }
        if (customRange?.endDate) {
          const [y, m, d] = customRange.endDate.split('-').map(Number);
          end = new Date(y, m - 1, d, 23, 59, 59, 999);
        }
        const startStr = start ? start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Beginning';
        const endStr = end ? end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Present';
        return {
          start,
          end,
          label: `${startStr} to ${endStr}`,
        };
      }

      case 'all_time':
      case 'all':
      default:
        return {
          start: null,
          end: null,
          label: 'All Time History',
        };
    }
  }

  /**
   * Aggregates consolidated purchase statement data for a customer.
   */
  static getCustomerStatementData({
    customerId,
    filter = 'all_time',
    customRange,
    customers = [],
    bills = [],
    payments = [],
    advancePayments = [],
    business = {},
    settings = {},
  }: {
    customerId: string | number;
    filter?: string;
    customRange?: StatementFilterRange;
    customers?: any[];
    bills?: any[];
    payments?: any[];
    advancePayments?: any[];
    business?: any;
    settings?: any;
  }): CustomerStatementData | null {
    if (!customerId) return null;

    const customer = customers.find(
      (c) => String(c.id) === String(customerId) || (c.customerCode && String(c.customerCode) === String(customerId))
    );

    const { start, end, label } = this.getFilterBoundaries(filter, customRange);

    // Active bills for this customer
    const allCustomerBills = (bills || []).filter((b) => {
      if (b.deleted || b.deleted_at || b.isGroupParent) return false;
      const bCustId = b.customerId || b.customer_id;
      return String(bCustId) === String(customerId);
    });

    // Filtered bills by date range
    const filteredBills = allCustomerBills.filter((b) => {
      const dateStr = b.date || b.createdAt || b.created_at;
      if (!dateStr) return true;
      const bDate = new Date(dateStr);
      if (start && bDate < start) return false;
      if (end && bDate > end) return false;
      return true;
    });

    // Customer payments
    const allCustomerPayments = (payments || []).filter((p) => {
      if (p.deleted || p.deleted_at) return false;
      const pCustId = p.customerId || p.customer_id;
      return String(pCustId) === String(customerId);
    });

    const filteredPayments = allCustomerPayments.filter((p) => {
      const dateStr = p.date || p.createdAt || p.created_at;
      if (!dateStr) return true;
      const pDate = new Date(dateStr);
      if (start && pDate < start) return false;
      if (end && pDate > end) return false;
      return true;
    });

    // Format Invoices and detailed Line Items
    let totalInvoiced = 0;
    let totalPaidInPeriod = 0;
    let totalUnitsBought = 0;

    const invoices: StatementInvoice[] = filteredBills
      .sort((a, b) => {
        const timeA = new Date(a.date || a.createdAt || a.created_at || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || b.created_at || 0).getTime();
        return timeA - timeB;
      })
      .map((b) => {
        const grandTotal = Number(b.grand_total !== undefined ? b.grand_total : (b.total || 0));
        const subtotal = Number(b.subtotal !== undefined ? b.subtotal : (b.total || 0));
        const discount = Number(b.discount !== undefined ? b.discount : (b.discountValue || 0));
        const taxAmount = Number(b.tax_amount !== undefined ? b.tax_amount : (b.gstAmount || b.tax || 0));
        const paidAmount = Number(
          b.paid_total !== undefined
            ? b.paid_total
            : b.amount_paid !== undefined
            ? b.amount_paid
            : b.amountPaid !== undefined
            ? b.amountPaid
            : b.paidTotal || 0
        );
        const balanceDue = b.balance !== undefined ? Number(b.balance) : Math.max(0, grandTotal - paidAmount);

        totalInvoiced += grandTotal;
        totalPaidInPeriod += paidAmount;

        let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
        if (balanceDue <= 0 || b.status === 'paid') {
          status = 'paid';
        } else if (paidAmount > 0) {
          status = 'partial';
        }

        // Map line items
        const rawItems = b.items || [];
        const items: StatementLineItem[] = rawItems.map((item: any, idx: number) => {
          const qty = Number(item.quantity !== undefined ? item.quantity : (item.qty || 1));
          const unitRate = Number(item.price !== undefined ? item.price : (item.unitPrice || item.rate || 0));
          const lineTotal = Number(item.total !== undefined ? item.total : (item.amount || qty * unitRate));
          totalUnitsBought += qty;

          return {
            item_index: idx + 1,
            product_id: item.product_id || item.productId || null,
            product_name: item.product_name || item.name || item.itemName || 'Custom Item',
            quantity: qty,
            price: unitRate,
            total: lineTotal,
            unit: item.unit || 'pcs',
          };
        });

        const createdDate = b.date || b.createdAt || b.created_at || new Date().toISOString();

        return {
          id: String(b.id),
          bill_number: b.bill_number || b.invoiceNumber || `BILL-${String(b.id).slice(0, 6)}`,
          created_at: createdDate,
          date: createdDate.slice(0, 10),
          subtotal,
          discount,
          tax_amount: taxAmount,
          grand_total: grandTotal,
          paid_amount: paidAmount,
          balance_due: balanceDue,
          payment_status: status,
          items,
        };
      });

    // Group invoices by date
    const dateMap = new Map<string, StatementInvoice[]>();
    invoices.forEach((inv) => {
      const dKey = inv.date;
      if (!dateMap.has(dKey)) {
        dateMap.set(dKey, []);
      }
      dateMap.get(dKey)!.push(inv);
    });

    const groupedByDate = Array.from(dateMap.entries()).map(([date, invs]) => ({
      date,
      invoices: invs,
      day_total: invs.reduce((sum, i) => sum + i.grand_total, 0),
    }));

    // Real-time all-time account status
    const allTimeBilled = allCustomerBills.reduce((s, b) => s + Number(b.grand_total || b.total || 0), 0);
    const directPaidSum = allCustomerBills.reduce((s, b) => s + Number(b.amount_paid || b.amountPaid || b.paid_total || b.paidTotal || 0), 0);
    const paymentRecordsSum = allCustomerPayments.reduce(
      (s, p) => s + Number(p.amount || p.totalPaid || p.total_paid || p.paid_amount || 0),
      0
    );
    const allTimePaid = Math.max(directPaidSum, paymentRecordsSum);

    const advanceBalance = Number(
      customer?.advanceBalance || customer?.advance_balance || customer?.creditBalance || customer?.credit_balance || 0
    );

    const currentOutstanding = allCustomerBills.reduce((s, b) => {
      const bal = b.balance !== undefined ? Number(b.balance) : Math.max(0, Number(b.total || b.grand_total || 0) - Number(b.amount_paid || b.amountPaid || 0));
      return s + (isNaN(bal) ? 0 : bal);
    }, 0);

    const periodPaymentRecords = filteredPayments.reduce(
      (s, p) => s + Number(p.amount || p.totalPaid || p.total_paid || p.paid_amount || 0),
      0
    );
    const effectivePeriodPayments = Math.max(totalPaidInPeriod, periodPaymentRecords);

    return {
      store: {
        shopName: business?.shopName || business?.name || 'PrintPro Digital Print Studio',
        address: business?.address || 'Main Road, Commercial Complex',
        phone: business?.phone || business?.mobile || '',
        email: business?.email || '',
        gstin: business?.gstin || business?.gstNumber || business?.taxId || '',
        taxNumber: business?.taxNumber || business?.panNumber || '',
        upiId: business?.upiId || '',
      },
      customer: {
        id: String(customerId),
        customer_code: customer?.customerCode || customer?.code || SequenceService.formatDisplayCode('customer', customer || customerId, 'CUS'),
        name: customer?.name || 'Walk-in Customer',
        mobile: customer?.mobile || customer?.phone || '',
        email: customer?.email || '',
        address: customer?.address || '',
        gst_number: customer?.gst_number || customer?.gstin || customer?.gstNumber || '',
      },
      period: {
        key: filter,
        label,
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null,
        issueDate: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      kpi: {
        total_invoiced: totalInvoiced,
        total_paid: effectivePeriodPayments,
        invoices_count: invoices.length,
        total_units_bought: totalUnitsBought,
      },
      reconciliation: {
        period_purchases: totalInvoiced,
        period_payments: effectivePeriodPayments,
        all_time_billed: allTimeBilled,
        all_time_paid: allTimePaid,
        current_outstanding_balance: Math.max(0, currentOutstanding),
        advance_balance: advanceBalance,
      },
      invoices,
      grouped_by_date: groupedByDate,
    };
  }

  /**
   * Generates a vector A4 executive printable PDF statement.
   */
  static generateStatementPDF(
    statementData: CustomerStatementData,
    options: { detailed?: boolean; currency?: string } = {}
  ): jsPDF {
    const { detailed = true, currency = 'Rs.' } = options;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MARGIN = 12;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const MAX_Y = PAGE_H - 18;
    let currentY = 14;
    let pageNumber = 1;

    const printHeader = () => {
      // Top store details & Statement Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text(statementData.store.shopName.toUpperCase(), MARGIN, currentY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      doc.text('CONSOLIDATED STATEMENT OF ACCOUNT', PAGE_W - MARGIN, currentY, { align: 'right' });
      currentY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(70, 70, 70);

      const storeSub = [
        statementData.store.address,
        statementData.store.phone ? `Phone: ${statementData.store.phone}` : '',
        statementData.store.gstin ? `GSTIN: ${statementData.store.gstin}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      doc.text(storeSub, MARGIN, currentY);

      doc.text(`Period: ${statementData.period.label}`, PAGE_W - MARGIN, currentY, { align: 'right' });
      currentY += 4.5;
      doc.text(`Generated: ${statementData.period.issueDate}`, PAGE_W - MARGIN, currentY, { align: 'right' });
      currentY += 3;

      // Divider
      doc.setDrawColor(40, 40, 40);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
      currentY += 5;
    };

    const printFooter = (pageNum: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
      doc.text(
        `${statementData.store.shopName} - Confidential Account Statement | Page ${pageNum}`,
        PAGE_W / 2,
        PAGE_H - 7,
        { align: 'center' }
      );
    };

    const checkPageBreak = (neededHeight: number) => {
      if (currentY + neededHeight > MAX_Y) {
        printFooter(pageNumber);
        doc.addPage();
        pageNumber++;
        currentY = 14;
        printHeader();
      }
    };

    printHeader();

    // 1. Customer & Account Summary Box
    const boxH = 26;
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, currentY, CONTENT_W, boxH, 1.5, 1.5, 'FD');

    // Customer Col
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text('BILLED TO / CUSTOMER', MARGIN + 4, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(statementData.customer.name, MARGIN + 4, currentY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Customer Code: ${statementData.customer.customer_code || 'N/A'}`, MARGIN + 4, currentY + 15);
    if (statementData.customer.mobile) {
      doc.text(`Mobile: ${statementData.customer.mobile}`, MARGIN + 4, currentY + 19.5);
    }
    if (statementData.customer.gst_number) {
      doc.text(`GST: ${statementData.customer.gst_number}`, MARGIN + 4, currentY + 24);
    }

    // Ledger Status Col (Right Side of Box)
    const rightColX = MARGIN + CONTENT_W / 2 + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text('ACCOUNT RECONCILIATION', rightColX, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Period Invoiced (${statementData.kpi.invoices_count} bills):`, rightColX, currentY + 10);
    doc.text(`${currency} ${statementData.kpi.total_invoiced.toFixed(2)}`, PAGE_W - MARGIN - 4, currentY + 10, { align: 'right' });

    doc.text('Period Payments Received:', rightColX, currentY + 14.5);
    doc.text(`${currency} ${statementData.kpi.total_paid.toFixed(2)}`, PAGE_W - MARGIN - 4, currentY + 14.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Current Outstanding Balance:', rightColX, currentY + 20);
    doc.setFontSize(9.5);
    doc.text(
      `${currency} ${statementData.reconciliation.current_outstanding_balance.toFixed(2)}`,
      PAGE_W - MARGIN - 4,
      currentY + 20,
      { align: 'right' }
    );

    if (statementData.reconciliation.advance_balance > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 120, 50);
      doc.text(`Advance / Credit Balance: ${currency} ${statementData.reconciliation.advance_balance.toFixed(2)}`, rightColX, currentY + 24.5);
    }

    currentY += boxH + 6;

    // 2. KPI Summary Strip
    const kpiBoxW = CONTENT_W / 4 - 2;
    const kpiH = 14;
    const kpis = [
      { label: 'TOTAL INVOICED', value: `${currency} ${statementData.kpi.total_invoiced.toFixed(2)}` },
      { label: 'TOTAL PAID', value: `${currency} ${statementData.kpi.total_paid.toFixed(2)}` },
      { label: 'INVOICES COUNT', value: `${statementData.kpi.invoices_count} Bills` },
      { label: 'TOTAL UNITS BOUGHT', value: `${statementData.kpi.total_units_bought} Items` },
    ];

    kpis.forEach((k, idx) => {
      const kX = MARGIN + idx * (kpiBoxW + 2.6);
      doc.setFillColor(243, 244, 246);
      doc.setDrawColor(220, 220, 220);
      doc.roundedRect(kX, currentY, kpiBoxW, kpiH, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text(k.label, kX + kpiBoxW / 2, currentY + 4.5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(20, 20, 20);
      doc.text(k.value, kX + kpiBoxW / 2, currentY + 10.5, { align: 'center' });
    });

    currentY += kpiH + 6;

    // 3. Section Title: INVOICE TRANSACTIONS & BREAKDOWN
    checkPageBreak(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text('ITEMIZED INVOICES & PURCHASES LEDGER', MARGIN, currentY);
    currentY += 4.5;

    if (statementData.invoices.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text('No purchase transactions recorded in this period.', MARGIN, currentY + 4);
      currentY += 12;
    } else {
      // Loop over invoices
      statementData.invoices.forEach((inv, invIdx) => {
        const estimatedHeight = detailed ? 16 + inv.items.length * 5.5 + 8 : 8;
        checkPageBreak(Math.min(estimatedHeight, 35));

        // Invoice Header Banner
        doc.setFillColor(235, 238, 242);
        doc.setDrawColor(200, 205, 215);
        doc.rect(MARGIN, currentY, CONTENT_W, 6.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(20, 20, 20);
        doc.text(`Bill #${inv.bill_number}`, MARGIN + 3, currentY + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(`Date: ${inv.date}`, MARGIN + 45, currentY + 4.5);

        const statusLabel = inv.payment_status.toUpperCase();
        doc.setFont('helvetica', 'bold');
        doc.text(`[${statusLabel}]`, MARGIN + 85, currentY + 4.5);

        doc.text(`Total: ${currency} ${inv.grand_total.toFixed(2)}`, PAGE_W - MARGIN - 3, currentY + 4.5, {
          align: 'right',
        });
        currentY += 6.5;

        if (detailed && inv.items.length > 0) {
          // Line items table header
          doc.setFillColor(248, 249, 250);
          doc.rect(MARGIN, currentY, CONTENT_W, 5, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(90, 90, 90);
          doc.text('#', MARGIN + 3, currentY + 3.5);
          doc.text('ITEM / SERVICE DESCRIPTION', MARGIN + 12, currentY + 3.5);
          doc.text('QTY', MARGIN + 110, currentY + 3.5, { align: 'right' });
          doc.text('UNIT RATE', MARGIN + 140, currentY + 3.5, { align: 'right' });
          doc.text('LINE TOTAL', PAGE_W - MARGIN - 4, currentY + 3.5, { align: 'right' });
          currentY += 5;

          // Line items rows
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(40, 40, 40);

          inv.items.forEach((item) => {
            checkPageBreak(6);
            doc.text(String(item.item_index), MARGIN + 3, currentY + 3.5);
            doc.text(item.product_name, MARGIN + 12, currentY + 3.5);
            doc.text(`${item.quantity} ${item.unit || ''}`, MARGIN + 110, currentY + 3.5, { align: 'right' });
            doc.text(`${currency} ${item.price.toFixed(2)}`, MARGIN + 140, currentY + 3.5, { align: 'right' });
            doc.text(`${currency} ${item.total.toFixed(2)}`, PAGE_W - MARGIN - 4, currentY + 3.5, { align: 'right' });

            doc.setDrawColor(240, 240, 240);
            doc.line(MARGIN, currentY + 4.5, PAGE_W - MARGIN, currentY + 4.5);
            currentY += 4.5;
          });

          // Bill subtotal & balance summary line
          doc.setFillColor(252, 252, 252);
          doc.rect(MARGIN, currentY, CONTENT_W, 5, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(60, 60, 60);

          const discText = inv.discount > 0 ? ` | Disc: ${currency} ${inv.discount.toFixed(2)}` : '';
          const taxText = inv.tax_amount > 0 ? ` | GST/Tax: ${currency} ${inv.tax_amount.toFixed(2)}` : '';
          doc.text(`Subtotal: ${currency} ${inv.subtotal.toFixed(2)}${discText}${taxText}`, MARGIN + 12, currentY + 3.5);

          const balText = `Paid: ${currency} ${inv.paid_amount.toFixed(2)} | Due: ${currency} ${inv.balance_due.toFixed(2)}`;
          doc.text(balText, PAGE_W - MARGIN - 4, currentY + 3.5, { align: 'right' });
          currentY += 7.5;
        } else {
          currentY += 2;
        }
      });
    }

    // 4. Statement Summary & Signatory Section
    checkPageBreak(25);
    currentY += 4;
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
    currentY += 6;

    // Reconciliation block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text('STATEMENT RECONCILIATION SUMMARY', MARGIN, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text(
      `Period purchases of ${currency} ${statementData.kpi.total_invoiced.toFixed(2)} against payments of ${currency} ${statementData.kpi.total_paid.toFixed(2)}.`,
      MARGIN,
      currentY + 4.5
    );
    doc.text(
      `Overall All-Time Outstanding Account Balance: ${currency} ${statementData.reconciliation.current_outstanding_balance.toFixed(2)}`,
      MARGIN,
      currentY + 9
    );

    // Signatory line
    const sigX = PAGE_W - MARGIN - 50;
    doc.setDrawColor(120, 120, 120);
    doc.line(sigX, currentY + 12, PAGE_W - MARGIN, currentY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text('Authorized Signatory', sigX + 25, currentY + 16, { align: 'center' });
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(statementData.store.shopName, sigX + 25, currentY + 19.5, { align: 'center' });

    printFooter(pageNumber);
    return doc;
  }
}
