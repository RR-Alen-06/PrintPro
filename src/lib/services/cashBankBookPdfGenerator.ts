import { jsPDF } from 'jspdf';
import { ShopSettings } from '../types';

export interface BookEntry {
  date: string;
  ref_number: string;
  description: string;
  party_name?: string;
  inflow: number;
  outflow: number;
  running_balance: number;
}

export interface BookReportData {
  book_type: 'CASH' | 'BANK';
  shop_settings: Partial<ShopSettings>;
  period_label: string;
  opening_balance: number;
  closing_balance: number;
  entries: BookEntry[];
}

function formatRs(amount: number, prefix = ''): string {
  const num = Number(amount || 0);
  const rounded = Math.round(num * 100) / 100;
  const signPrefix = prefix !== '' ? prefix : (rounded < 0 ? '-' : '');
  const formatted = Math.abs(rounded).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${signPrefix}Rs. ${formatted}`;
}

export class CashBankBookPdfGenerator {
  static generateBookPdf(data: BookReportData): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2; // 186mm
    let y = margin;

    const isCash = data.book_type === 'CASH';
    const bookTitle = isCash ? 'CASH BOOK LEDGER' : 'BANK & UPI BOOK LEDGER';
    const primaryColor = isCash ? [16, 185, 129] : [79, 70, 229]; // emerald or indigo

    const totalInflow = data.entries.reduce((sum, e) => sum + Number(e.inflow || 0), 0);
    const totalOutflow = data.entries.reduce((sum, e) => sum + Number(e.outflow || 0), 0);

    const renderHeader = () => {
      // Top Accent Bar
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, y, contentWidth, 2, 'F');
      y += 6;

      // Shop Information
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(data.shop_settings.shop_name || 'PrintPro Store', margin, y);

      // Document Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(bookTitle, pageWidth - margin, y, { align: 'right' });
      y += 5;

      // Sub-details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);

      let addressStr = data.shop_settings.address || '';
      const metaParts: string[] = [];
      if (data.shop_settings.phone) metaParts.push(`Phone: ${data.shop_settings.phone}`);
      if (data.shop_settings.gst_number) metaParts.push(`GSTIN: ${data.shop_settings.gst_number}`);
      if (metaParts.length > 0) {
        addressStr = addressStr ? `${addressStr} | ${metaParts.join(' | ')}` : metaParts.join(' | ');
      }
      if (addressStr) {
        const addrLines = doc.splitTextToSize(addressStr, 105) as string[];
        doc.text(addrLines[0], margin, y);
      }

      doc.text(`Period: ${data.period_label}`, pageWidth - margin, y, { align: 'right' });
      y += 4;
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
      y += 3.5;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    };

    renderHeader();

    // Opening Balance & Summary KPI Cards
    const cardWidth = (contentWidth - 6) / 3;
    const cardHeight = 15;

    // Card 1: Opening Balance
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`OPENING ${isCash ? 'CASH' : 'BANK / UPI'}`, margin + 3, y + 5);
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(formatRs(data.opening_balance), margin + 3, y + 11.5);

    // Card 2: Total Inflows & Outflows
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + cardWidth + 3, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL INFLOW / OUTFLOW', margin + cardWidth + 6, y + 5);
    doc.setFontSize(8.5);
    doc.setTextColor(16, 185, 129);
    doc.text(formatRs(totalInflow, '+'), margin + cardWidth + 6, y + 11.5);
    doc.setTextColor(239, 68, 68);
    doc.text(formatRs(totalOutflow, '-'), margin + cardWidth + cardWidth, y + 11.5, { align: 'right' });

    // Card 3: Closing Balance
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + (cardWidth * 2) + 6, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`CLOSING ${isCash ? 'CASH' : 'BANK / UPI'}`, margin + (cardWidth * 2) + 9, y + 5);
    doc.setFontSize(10.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(formatRs(data.closing_balance), margin + (cardWidth * 2) + 9, y + 11.5);

    y += cardHeight + 6;

    // Non-overlapping column layout across 186mm (x = 12 to 198)
    const col = {
      date: margin + 1.5,        // 13.5..39.5 (26mm)
      ref: margin + 28,          // 40..59 (19mm)
      desc: margin + 48,         // 60..112 (52mm)
      party: margin + 102,       // 114..139 (25mm)
      inflowRight: margin + 146, // right-aligned at 158 (19mm)
      outflowRight: margin + 165,// right-aligned at 177 (19mm)
      balanceRight: pageWidth - margin - 1.5 // right-aligned at 196.5 (19.5mm)
    };

    const renderTableHeader = () => {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);

      doc.text('Date & Time', col.date, y + 4.8);
      doc.text('Ref #', col.ref, y + 4.8);
      doc.text('Particulars / Description', col.desc, y + 4.8);
      doc.text('Party / Customer', col.party, y + 4.8);
      doc.text('Inflow (Rs.)', col.inflowRight, y + 4.8, { align: 'right' });
      doc.text('Outflow (Rs.)', col.outflowRight, y + 4.8, { align: 'right' });
      doc.text('Balance (Rs.)', col.balanceRight, y + 4.8, { align: 'right' });

      y += 7;
    };

    renderTableHeader();

    // Opening Balance Row
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('OPENING', col.date, y + 4.2);
    doc.text('—', col.ref, y + 4.2);
    doc.text(`Opening ${isCash ? 'Cash Drawer' : 'Bank / UPI'} Balance`, col.desc, y + 4.2);
    doc.text('—', col.party, y + 4.2);
    doc.text('—', col.inflowRight, y + 4.2, { align: 'right' });
    doc.text('—', col.outflowRight, y + 4.2, { align: 'right' });
    doc.setTextColor(15, 23, 42);
    doc.text(Number(data.opening_balance || 0).toFixed(2), col.balanceRight, y + 4.2, { align: 'right' });
    y += 6;

    // Table Rows
    if (data.entries.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('No transactions recorded in this period.', pageWidth / 2, y + 6, { align: 'center' });
      y += 11;
    } else {
      data.entries.forEach((entry, index) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const descLines = doc.splitTextToSize(entry.description || '—', 51) as string[];
        const partyText = entry.party_name || '—';
        const partyLines = doc.splitTextToSize(partyText, 24) as string[];
        const lineCount = Math.max(1, Math.min(2, descLines.length), Math.min(2, partyLines.length));
        const rowHeight = lineCount === 2 ? 9.5 : 6.2;

        if (y + rowHeight > pageHeight - 22) {
          doc.addPage();
          y = margin;
          renderHeader();
          renderTableHeader();
        }

        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentWidth, rowHeight, 'F');
        }

        let dateDisplay = entry.date;
        try {
          const d = new Date(entry.date);
          dateDisplay = `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
        } catch {
          dateDisplay = entry.date.slice(0, 16);
        }

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(dateDisplay, col.date, y + 4.2);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text((entry.ref_number || '—').slice(0, 14), col.ref, y + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(descLines.slice(0, 2), col.desc, y + 4.2);

        doc.text(partyLines.slice(0, 2), col.party, y + 4.2);

        // Inflow
        if (entry.inflow > 0) {
          doc.setTextColor(16, 185, 129);
          doc.text(`+${Number(entry.inflow).toFixed(2)}`, col.inflowRight, y + 4.2, { align: 'right' });
        } else {
          doc.setTextColor(148, 163, 184);
          doc.text('—', col.inflowRight, y + 4.2, { align: 'right' });
        }

        // Outflow
        if (entry.outflow > 0) {
          doc.setTextColor(239, 68, 68);
          doc.text(`-${Number(entry.outflow).toFixed(2)}`, col.outflowRight, y + 4.2, { align: 'right' });
        } else {
          doc.setTextColor(148, 163, 184);
          doc.text('—', col.outflowRight, y + 4.2, { align: 'right' });
        }

        // Running Balance
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(Number(entry.running_balance || 0).toFixed(2), col.balanceRight, y + 4.2, { align: 'right' });

        y += rowHeight;
      });
    }

    // Final Totals Bar
    if (y + 14 > pageHeight - 20) {
      doc.addPage();
      y = margin + 10;
    }

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 7.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL MOVEMENTS & CLOSING BALANCE', margin + 2.5, y + 5);

    doc.setTextColor(16, 185, 129);
    doc.text(`+${totalInflow.toFixed(2)}`, col.inflowRight, y + 5, { align: 'right' });

    doc.setTextColor(239, 68, 68);
    doc.text(`-${totalOutflow.toFixed(2)}`, col.outflowRight, y + 5, { align: 'right' });

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(formatRs(data.closing_balance), col.balanceRight, y + 5, { align: 'right' });

    y += 18;

    // Verification Signatures Footer
    if (y + 18 > pageHeight - 15) {
      doc.addPage();
      y = margin + 15;
    }

    const sigWidth = 55;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);

    // Left Signature: Prepared By
    doc.line(margin + 5, y, margin + 5 + sigWidth, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Prepared By (Cashier / Accountant)', margin + 5 + (sigWidth / 2), y + 4, { align: 'center' });

    // Right Signature: Verified By Super Admin / Auditor
    doc.line(pageWidth - margin - 5 - sigWidth, y, pageWidth - margin - 5, y);
    doc.text('Certified By (Super Admin / Auditor)', pageWidth - margin - 5 - (sigWidth / 2), y + 4, { align: 'center' });

    // Page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`PrintPro Certified Audit Ledger — Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
    }

    return doc;
  }
}
