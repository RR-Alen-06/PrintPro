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
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const isCash = data.book_type === 'CASH';
    const bookTitle = isCash ? 'CASH BOOK LEDGER' : 'BANK & UPI BOOK LEDGER';
    const primaryColor = isCash ? [16, 185, 129] : [79, 70, 229]; // emerald or indigo

    const totalInflow = data.entries.reduce((sum, e) => sum + Number(e.inflow || 0), 0);
    const totalOutflow = data.entries.reduce((sum, e) => sum + Number(e.outflow || 0), 0);
    const _netChange = totalInflow - totalOutflow;

    const renderHeader = () => {
      // Top Accent Bar
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, y, contentWidth, 2, 'F');
      y += 6;

      // Shop Information
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(data.shop_settings.shop_name || 'SimBilling Store', margin, y);

      // Document Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(bookTitle, pageWidth - margin, y, { align: 'right' });
      y += 5;

      // Sub-details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500

      let addressStr = data.shop_settings.address || '';
      const metaParts: string[] = [];
      if (data.shop_settings.phone) metaParts.push(`Phone: ${data.shop_settings.phone}`);
      if (data.shop_settings.gst_number) metaParts.push(`GSTIN: ${data.shop_settings.gst_number}`);
      if (metaParts.length > 0) {
        addressStr = addressStr ? `${addressStr} | ${metaParts.join(' | ')}` : metaParts.join(' | ');
      }
      if (addressStr) {
        doc.text(addressStr, margin, y);
      }

      doc.text(`Period: ${data.period_label}`, pageWidth - margin, y, { align: 'right' });
      y += 4;
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
      y += 4;

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
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`OPENING ${isCash ? 'CASH' : 'BANK / UPI'}`, margin + 3, y + 5);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`₹${Number(data.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + 3, y + 11.5);

    // Card 2: Total Inflows & Outflows
    doc.roundedRect(margin + cardWidth + 3, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL INFLOW / OUTFLOW', margin + cardWidth + 6, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129); // green
    doc.text(`+₹${totalInflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + cardWidth + 6, y + 11.5);
    doc.setTextColor(239, 68, 68); // red
    doc.text(`-₹${totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + cardWidth + cardWidth - 3, y + 11.5, { align: 'right' });

    // Card 3: Closing Balance
    doc.roundedRect(margin + (cardWidth * 2) + 6, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`CLOSING ${isCash ? 'CASH' : 'BANK / UPI'}`, margin + (cardWidth * 2) + 9, y + 5);
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`₹${Number(data.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, margin + (cardWidth * 2) + 9, y + 11.5);

    y += cardHeight + 6;

    // Table Header
    const colX = {
      date: margin,
      ref: margin + 28,
      desc: margin + 55,
      party: margin + 115,
      inflow: margin + 145,
      outflow: margin + 165,
      balance: pageWidth - margin
    };

    const renderTableHeader = () => {
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);

      doc.text('Date & Time', colX.date + 1, y + 4.8);
      doc.text('Ref #', colX.ref, y + 4.8);
      doc.text('Particulars / Description', colX.desc, y + 4.8);
      doc.text('Party / Customer', colX.party, y + 4.8);
      doc.text('Inflow (₹)', colX.inflow + 15, y + 4.8, { align: 'right' });
      doc.text('Outflow (₹)', colX.outflow + 15, y + 4.8, { align: 'right' });
      doc.text('Balance (₹)', colX.balance - 1, y + 4.8, { align: 'right' });

      y += 7;
    };

    renderTableHeader();

    // Table Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    data.entries.forEach((entry, index) => {
      // Check page break
      if (y + 7 > pageHeight - 20) {
        doc.addPage();
        y = margin;
        renderHeader();
        renderTableHeader();
      }

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6, 'F');
      }

      // Format date
      let dateDisplay = entry.date;
      try {
        const d = new Date(entry.date);
        dateDisplay = `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      } catch {
        dateDisplay = entry.date.slice(0, 16);
      }

      doc.setTextColor(71, 85, 105);
      doc.text(dateDisplay, colX.date + 1, y + 4.2);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(entry.ref_number || '—', colX.ref, y + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const truncatedDesc = entry.description.length > 36 ? `${entry.description.slice(0, 34)}...` : entry.description;
      doc.text(truncatedDesc, colX.desc, y + 4.2);

      const truncatedParty = (entry.party_name || '—').length > 18 ? `${(entry.party_name || '—').slice(0, 16)}...` : (entry.party_name || '—');
      doc.text(truncatedParty, colX.party, y + 4.2);

      // Inflow
      if (entry.inflow > 0) {
        doc.setTextColor(16, 185, 129);
        doc.text(`+${entry.inflow.toFixed(2)}`, colX.inflow + 15, y + 4.2, { align: 'right' });
      } else {
        doc.setTextColor(148, 163, 184);
        doc.text('—', colX.inflow + 15, y + 4.2, { align: 'right' });
      }

      // Outflow
      if (entry.outflow > 0) {
        doc.setTextColor(239, 68, 68);
        doc.text(`-${entry.outflow.toFixed(2)}`, colX.outflow + 15, y + 4.2, { align: 'right' });
      } else {
        doc.setTextColor(148, 163, 184);
        doc.text('—', colX.outflow + 15, y + 4.2, { align: 'right' });
      }

      // Running Balance
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`₹${Number(entry.running_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colX.balance - 1, y + 4.2, { align: 'right' });

      y += 6;
    });

    // Final Totals Bar
    if (y + 12 > pageHeight - 20) {
      doc.addPage();
      y = margin + 10;
    }

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 7, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL MOVEMENTS & CLOSING BALANCE', margin + 3, y + 4.8);

    doc.setTextColor(16, 185, 129);
    doc.text(`+₹${totalInflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colX.inflow + 15, y + 4.8, { align: 'right' });

    doc.setTextColor(239, 68, 68);
    doc.text(`-₹${totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colX.outflow + 15, y + 4.8, { align: 'right' });

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`₹${Number(data.closing_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colX.balance - 1, y + 4.8, { align: 'right' });

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
      doc.text(`SimBilling Certified Audit Ledger — Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
    }

    return doc;
  }
}
