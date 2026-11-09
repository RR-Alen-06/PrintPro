import { jsPDF } from 'jspdf';
import { CustomerStatementData } from '../types';

export class StatementGenerator {
  /**
   * Generates an executive-grade, high-contrast monochrome Customer Statement of Account PDF.
   * Full financial ledger format with Debits (Invoices), Credits (Payments), and Running Balance.
   * Optimized for crystal-clear A4 printing and archival accounting.
   */
  static generateStatementPdf(data: CustomerStatementData): jsPDF {
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

    // Helper for pagination tracking
    const checkPageBreak = (neededHeight: number, onBreak?: () => void) => {
      if (y + neededHeight > pageHeight - 18) {
        doc.addPage();
        y = margin;
        renderRunningHeader();
        if (onBreak) {
          onBreak();
        }
      }
    };

    const renderRunningHeader = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`${data.shop_settings.shop_name} — Statement of Account`, margin, y);
      doc.text(`Customer: ${data.customer.name} | Period: ${data.period.filter_label}`, pageWidth - margin, y, { align: 'right' });
      y += 3.5;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5.5;
    };

    // =========================================================================
    // 1. TOP HEADER & METADATA (Monochrome Executive Dual-Column)
    // =========================================================================
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Store details (Left Column)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(data.shop_settings.shop_name || 'PRINT & BILLING CENTER', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    y += 4.5;
    if (data.shop_settings.address) {
      doc.text(data.shop_settings.address, margin, y);
      y += 4;
    }
    const storeMeta = [
      data.shop_settings.phone ? `Phone: ${data.shop_settings.phone}` : null,
      data.shop_settings.gst_number ? `GSTIN: ${data.shop_settings.gst_number}` : null
    ].filter(Boolean).join('   |   ');
    if (storeMeta) {
      doc.text(storeMeta, margin, y);
      y += 4;
    }

    // Document Details (Right Column)
    const rightX = pageWidth - margin;
    let rightY = margin + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('STATEMENT OF ACCOUNT', rightX, rightY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    rightY += 4.5;
    doc.text(`Statement Period: ${data.period.filter_label}`, rightX, rightY, { align: 'right' });
    rightY += 4;
    doc.text(`Issue Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, rightX, rightY, { align: 'right' });
    rightY += 4;
    doc.text(`Account Code: ${data.customer.customer_code || 'CUST-' + data.customer.id.slice(0, 6).toUpperCase()}`, rightX, rightY, { align: 'right' });

    y = Math.max(y, rightY) + 3;

    // Divider line
    doc.setLineWidth(0.2);
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4.5;

    // =========================================================================
    // 2. CUSTOMER PROFILE CARD (Structured Bordered Box)
    // =========================================================================
    const custBoxHeight = 17;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, custBoxHeight);

    // Box Header Label
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 5, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, y + 5, margin + contentWidth, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text('CUSTOMER ACCOUNT INFORMATION', margin + 3, y + 3.6);

    const isSettled = data.current_balance_due <= 0.01;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`STATUS: ${isSettled ? 'DUES SETTLED (NIL)' : `OUTSTANDING DUE: Rs. ${data.current_balance_due.toFixed(2)}`}`, rightX - 3, y + 3.6, { align: 'right' });

    // Customer details row
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    const infoY = y + 9.5;
    doc.text(`Name: `, margin + 3, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(data.customer.name, margin + 13, infoY);

    doc.setFont('helvetica', 'normal');
    doc.text(`Phone: ${data.customer.mobile || 'N/A'}`, margin + 65, infoY);
    doc.text(`Email: ${data.customer.email || 'N/A'}`, margin + 115, infoY);

    if (data.current_advance_balance > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Advance Credit: Rs. ${data.current_advance_balance.toFixed(2)}`, rightX - 3, infoY, { align: 'right' });
    }

    y += custBoxHeight + 4;

    // =========================================================================
    // 3. EXECUTIVE KPI MATRIX TILES (Opening, Invoiced, Paid, Closing)
    // =========================================================================
    const kpiCount = 4;
    const kpiWidth = contentWidth / kpiCount;
    const kpiHeight = 11;

    const kpiItems = [
      { label: 'OPENING BALANCE', value: `Rs. ${data.opening_balance.toFixed(2)}` },
      { label: 'TOTAL INVOICED (DR)', value: `Rs. ${data.kpi.total_invoiced.toFixed(2)}` },
      { label: 'TOTAL PAID (CR)', value: `Rs. ${data.kpi.total_paid.toFixed(2)}` },
      { label: 'CLOSING BALANCE', value: `Rs. ${data.closing_balance.toFixed(2)}` }
    ];

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, kpiHeight);

    kpiItems.forEach((kpi, idx) => {
      const kX = margin + idx * kpiWidth;
      if (idx > 0) {
        doc.line(kX, y, kX, y + kpiHeight);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(80, 80, 80);
      doc.text(kpi.label, kX + kpiWidth / 2, y + 3.8, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(kpi.value, kX + kpiWidth / 2, y + 8.5, { align: 'center' });
    });

    y += kpiHeight + 2;

    // Collections & Financial Summary Sub-row
    const summary = data.financial_summary || {
      total_cash_received: 0,
      total_upi_received: 0,
      total_advance_utilized: 0,
      total_outstanding: data.current_balance_due
    };
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    const collSummary = `Collections Breakdown — Cash: Rs. ${(summary.total_cash_received || 0).toFixed(2)}   |   UPI: Rs. ${(summary.total_upi_received || 0).toFixed(2)}   |   Adv Utilized: Rs. ${(summary.total_advance_utilized || 0).toFixed(2)}   |   Total Dues: Rs. ${(summary.total_outstanding || data.current_balance_due).toFixed(2)}`;
    doc.text(collSummary, margin, y + 2.5);
    y += 5.5;

    // =========================================================================
    // 4. FINANCIAL STATEMENT LEDGER TABLE (Standard Double-Entry Columns)
    // =========================================================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('STATEMENT OF TRANSACTIONS (DEBITS & CREDITS)', margin, y);
    y += 3;

    // Table Column Coordinates
    const colIdx = margin + 2;               // # (7mm)
    const colDate = margin + 8;              // Date & Time (24mm)
    const colType = margin + 32;             // Type (16mm)
    const colRef = margin + 48;              // Ref # (22mm)
    const colDesc = margin + 70;             // Particulars / Description (56mm)
    const colDebit = margin + 144;           // Debit Dr (18mm, right)
    const colCredit = margin + 165;          // Credit Cr (18mm, right)
    const colBalance = margin + contentWidth;// Balance Dr (21mm, right)

    const renderTableHeader = () => {
      doc.setFillColor(240, 240, 240);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(margin, y, contentWidth, 5.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);

      doc.text('#', colIdx, y + 3.8);
      doc.text('DATE', colDate, y + 3.8);
      doc.text('TYPE', colType, y + 3.8);
      doc.text('REF NO', colRef, y + 3.8);
      doc.text('PARTICULARS / DESCRIPTION', colDesc, y + 3.8);
      doc.text('DEBIT (Rs.)', colDebit, y + 3.8, { align: 'right' });
      doc.text('CREDIT (Rs.)', colCredit, y + 3.8, { align: 'right' });
      doc.text('BALANCE (Rs.)', colBalance - 2, y + 3.8, { align: 'right' });

      y += 5.5;
    };

    renderTableHeader();

    // 4.1 Opening Balance Row
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, y, contentWidth, 4.5, 'F');
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 4.5, margin + contentWidth, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text('—', colIdx, y + 3.2);

    const openDateStr = data.period.start_date 
      ? new Date(data.period.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Initial';
    doc.text(openDateStr, colDate, y + 3.2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('OPENING', colType, y + 3.2);
    doc.setFont('helvetica', 'normal');
    doc.text('—', colRef, y + 3.2);
    doc.setFont('helvetica', 'bold');
    doc.text('Opening Balance Brought Forward', colDesc, y + 3.2);
    doc.setFont('helvetica', 'normal');
    doc.text('—', colDebit, y + 3.2, { align: 'right' });
    doc.text('—', colCredit, y + 3.2, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`${data.opening_balance.toFixed(2)}`, colBalance - 2, y + 3.2, { align: 'right' });

    y += 4.8;

    // 4.2 Chronological Transactions
    const txns = data.transactions || [];
    if (txns.length === 0) {
      checkPageBreak(12, renderTableHeader);
      doc.setDrawColor(180, 180, 180);
      doc.rect(margin, y, contentWidth, 9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text('No transactions recorded in this selected period.', margin + contentWidth / 2, y + 5.5, { align: 'center' });
      y += 11;
    } else {
      txns.forEach((txn, idx) => {
        checkPageBreak(5, renderTableHeader);

        // Row background and bottom border
        doc.setDrawColor(225, 225, 225);
        doc.setLineWidth(0.15);
        doc.line(margin, y + 4.5, margin + contentWidth, y + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);

        // Row Index
        doc.text(`${idx + 1}`, colIdx, y + 3.2);

        // Date
        const shortDate = txn.date.slice(0, 11);
        doc.text(shortDate, colDate, y + 3.2);

        // Type
        doc.setFont('helvetica', 'bold');
        if (txn.type === 'INVOICE') {
          doc.text('INVOICE', colType, y + 3.2);
        } else {
          doc.text('PAYMENT', colType, y + 3.2);
        }
        doc.setFont('helvetica', 'normal');

        // Ref No
        doc.text(txn.reference_no, colRef, y + 3.2);

        // Particulars / Description
        let desc = txn.particulars || '';
        if (txn.type === 'INVOICE' && txn.items && txn.items.length > 0) {
          const itemSummary = txn.items.map(it => `${it.product_name} (x${it.quantity})`).join(', ');
          desc = `${txn.reference_no}: ${itemSummary}`;
        }
        if (desc.length > 34) {
          desc = desc.slice(0, 32) + '..';
        }
        doc.text(desc, colDesc, y + 3.2);

        // Debit
        if (txn.debit > 0) {
          doc.setFont('helvetica', 'bold');
          doc.text(`${txn.debit.toFixed(2)}`, colDebit, y + 3.2, { align: 'right' });
          doc.setFont('helvetica', 'normal');
        } else {
          doc.text('—', colDebit, y + 3.2, { align: 'right' });
        }

        // Credit
        if (txn.credit > 0) {
          doc.setFont('helvetica', 'bold');
          doc.text(`${txn.credit.toFixed(2)}`, colCredit, y + 3.2, { align: 'right' });
          doc.setFont('helvetica', 'normal');
        } else {
          doc.text('—', colCredit, y + 3.2, { align: 'right' });
        }

        // Running Balance
        doc.setFont('helvetica', 'bold');
        doc.text(`${txn.running_balance.toFixed(2)}`, colBalance - 2, y + 3.2, { align: 'right' });

        y += 4.5;
      });
    }

    // 4.3 Closing Balance Row
    checkPageBreak(6, renderTableHeader);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 5, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.line(margin, y, margin + contentWidth, y);
    doc.line(margin, y + 5, margin + contentWidth, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text('—', colIdx, y + 3.5);

    const closeDateStr = data.period.end_date 
      ? new Date(data.period.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Current';
    doc.text(closeDateStr, colDate, y + 3.5);
    doc.text('CLOSING', colType, y + 3.5);
    doc.text('—', colRef, y + 3.5);
    doc.text('Closing Balance Carried Forward', colDesc, y + 3.5);
    doc.text(`${data.kpi.total_invoiced.toFixed(2)}`, colDebit, y + 3.5, { align: 'right' });
    doc.text(`${data.kpi.total_paid.toFixed(2)}`, colCredit, y + 3.5, { align: 'right' });
    doc.text(`${data.closing_balance.toFixed(2)}`, colBalance - 2, y + 3.5, { align: 'right' });

    y += 7.5;

    // =========================================================================
    // 5. FINANCIAL RECONCILIATION SUMMARY (High Contrast Table)
    // =========================================================================
    checkPageBreak(38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('STATEMENT RECONCILIATION & CLOSING BALANCE', margin, y);
    y += 3.5;

    const reconHeight = 22;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, reconHeight);

    const rColWidth = contentWidth / 4;

    // Header row
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 5, 'F');
    doc.line(margin, y + 5, margin + contentWidth, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text('OPENING BALANCE', margin + rColWidth * 0.5, y + 3.5, { align: 'center' });
    doc.text('+ TOTAL INVOICED (DR)', margin + rColWidth * 1.5, y + 3.5, { align: 'center' });
    doc.text('- TOTAL PAID (CR)', margin + rColWidth * 2.5, y + 3.5, { align: 'center' });
    doc.text('= CLOSING BALANCE', margin + rColWidth * 3.5, y + 3.5, { align: 'center' });

    // Vertical column lines
    doc.line(margin + rColWidth, y, margin + rColWidth, y + reconHeight);
    doc.line(margin + rColWidth * 2, y, margin + rColWidth * 2, y + reconHeight);
    doc.line(margin + rColWidth * 3, y, margin + rColWidth * 3, y + reconHeight);

    // Value Row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    const valY = y + 13;
    doc.text(`Rs. ${data.opening_balance.toFixed(2)}`, margin + rColWidth * 0.5, valY, { align: 'center' });
    doc.text(`Rs. ${data.kpi.total_invoiced.toFixed(2)}`, margin + rColWidth * 1.5, valY, { align: 'center' });
    doc.text(`Rs. ${data.kpi.total_paid.toFixed(2)}`, margin + rColWidth * 2.5, valY, { align: 'center' });

    const netClosing = data.closing_balance;
    doc.setFontSize(10.5);
    doc.text(`Rs. ${netClosing.toFixed(2)}`, margin + rColWidth * 3.5, valY, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(90, 90, 90);
    doc.text(netClosing > 0 ? '(Payment Due to Store)' : '(All Accounts Clear)', margin + rColWidth * 3.5, valY + 4.5, { align: 'center' });

    y += reconHeight + 6;

    // =========================================================================
    // 6. SIGNATORY & AUTHORIZATION BLOCK
    // =========================================================================
    checkPageBreak(22);

    const sigY = y + 12;
    // Customer Sign on Left
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin + 5, sigY, margin + 60, sigY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text("Customer's Acknowledgment & Signature", margin + 5, sigY + 4);

    // Store Authorized Sign on Right
    doc.line(pageWidth - margin - 60, sigY, pageWidth - margin - 5, sigY);
    doc.setFont('helvetica', 'bold');
    doc.text(`For ${data.shop_settings.shop_name}`, pageWidth - margin - 60, sigY - 2);
    doc.setFont('helvetica', 'normal');
    doc.text('Authorized Signatory & Stamp', pageWidth - margin - 60, sigY + 4);

    // =========================================================================
    // 7. DYNAMIC PAGINATION & FOOTER (Applies to all pages)
    // =========================================================================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      // Bottom Footer Rule
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      const footerMsg = data.shop_settings.footer_message || 'Thank you for your business. For any queries regarding this statement, please contact the store.';
      doc.text(footerMsg, margin, pageHeight - 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(50, 50, 50);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    return doc;
  }

  /**
   * Generates and downloads the PDF directly in the browser
   */
  static downloadStatementPdf(data: CustomerStatementData): void {
    const doc = this.generateStatementPdf(data);
    const safeCustName = data.customer.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Statement_${safeCustName}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
  }

  /**
   * Opens the statement PDF in a new window/tab for instant printing
   */
  static printCustomerStatementPdf(data: CustomerStatementData): void {
    const doc = this.generateStatementPdf(data);
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl);
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    }
  }
}
