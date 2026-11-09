import { jsPDF } from 'jspdf';
import { AccountingClosing, ShopSettings } from '../types';

export interface AccountingStatementData {
  shop_settings: Partial<ShopSettings>;
  closing: AccountingClosing;
  bills_count?: number;
  expenses_count?: number;
  transfers_count?: number;
}

export class AccountingStatementGenerator {
  static generateStatementPdf(data: AccountingStatementData): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const { shop_settings, closing } = data;

    // Header / Shop Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(shop_settings.shop_name || 'PrintPro Store', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    let subtitleY = y + 5;
    if (shop_settings.address) {
      doc.text(shop_settings.address, margin, subtitleY);
      subtitleY += 4;
    }
    const contactParts = [];
    if (shop_settings.phone) contactParts.push(`Phone: ${shop_settings.phone}`);
    if (shop_settings.email) contactParts.push(`Email: ${shop_settings.email}`);
    if (shop_settings.gst_number) contactParts.push(`GSTIN: ${shop_settings.gst_number}`);
    if (contactParts.length > 0) {
      doc.text(contactParts.join(' | '), margin, subtitleY);
      subtitleY += 4;
    }

    // Right-aligned Title & Session Ref
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('ACCOUNTING AUDIT STATEMENT', pageWidth - margin, y, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(`Ref: ${closing.closing_number || 'CLOSE-VERIFIED'}`, pageWidth - margin, y + 5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Status: ${closing.status || 'CLOSED'}`, pageWidth - margin, y + 9.5, { align: 'right' });

    y = Math.max(subtitleY + 3, y + 14);

    // Divider Line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Period & Closing Metadata Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

    const fromDateStr = new Date(closing.from_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const toDateStr = new Date(closing.to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const closedAtStr = new Date(closing.closed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('AUDIT PERIOD:', margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${fromDateStr}  to  ${toDateStr}`, margin + 28, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('VERIFIED BY:', margin + 4, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(closing.closed_by || 'Admin', margin + 28, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.text('CLOSED AT:', margin + 100, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(closedAtStr, margin + 122, y + 6);

    if (closing.last_audited_at) {
      const reAuditStr = new Date(closing.last_audited_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      doc.setFont('helvetica', 'bold');
      doc.text('RE-AUDITED AT:', margin + 100, y + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(`${reAuditStr} (${closing.last_audited_by || 'Admin'})`, margin + 127, y + 12);
    }

    y += 24;

    // Reconciliation Summary Table Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Cash & UPI Verification Sheet', margin, y);
    y += 4;

    const colWidths = [62, 40, 40, 40];
    const headers = ['Financial Parameter', 'Physical Cash (₹)', 'Bank / UPI (₹)', 'Combined Total (₹)'];

    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    let currentX = margin;
    headers.forEach((h, i) => {
      if (i === 0) {
        doc.text(h, currentX + 3, y + 4.8);
      } else {
        doc.text(h, currentX + colWidths[i] - 3, y + 4.8, { align: 'right' });
      }
      currentX += colWidths[i];
    });
    y += 7;

    const opCash = Number(closing.opening_cash || 0);
    const opUpi = Number(closing.opening_upi || 0);
    const inCash = Number(closing.cash_inflow || 0);
    const inUpi = Number(closing.upi_inflow || 0);
    const outCash = Number(closing.cash_outflow || 0);
    const outUpi = Number(closing.upi_outflow || 0);
    const transCtoU = Number(closing.transfers_cash_to_upi || 0);
    const transUtoC = Number(closing.transfers_upi_to_cash || 0);
    const expCash = Number(closing.expected_cash || 0);
    const expUpi = Number(closing.expected_upi || 0);
    const actCash = Number(closing.actual_cash !== undefined ? closing.actual_cash : expCash);
    const actUpi = Number(closing.actual_upi !== undefined ? closing.actual_upi : expUpi);
    const diffCash = Number(closing.cash_difference || (actCash - expCash));
    const diffUpi = Number(closing.upi_difference || (actUpi - expUpi));

    const rows: { label: string; cash: number; upi: number; isBold?: boolean; isHighlight?: boolean; isDiff?: boolean }[] = [
      { label: '1. Opening Balance (B/F)', cash: opCash, upi: opUpi },
      { label: '2. Total Collections (Bills & Payments)', cash: inCash, upi: inUpi },
      { label: '3. Total Expenses (Shop Outflow)', cash: -outCash, upi: -outUpi },
      { label: '4. Internal Transfers: Cash -> UPI', cash: -transCtoU, upi: transCtoU },
      { label: '5. Internal Transfers: UPI -> Cash', cash: transUtoC, upi: -transUtoC },
      { label: '6. Calculated Expected Balance', cash: expCash, upi: expUpi, isBold: true, isHighlight: true },
      { label: '7. Actual Physical / Bank Verified Balance', cash: actCash, upi: actUpi, isBold: true },
      { label: '8. Variance / Discrepancy (Actual - Expected)', cash: diffCash, upi: diffUpi, isBold: true, isDiff: true }
    ];

    rows.forEach((r, idx) => {
      const rowHeight = 7;
      if (r.isHighlight) {
        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      } else if (r.isDiff) {
        doc.setFillColor(r.cash !== 0 || r.upi !== 0 ? 254 : 240, r.cash !== 0 || r.upi !== 0 ? 242 : 253, r.cash !== 0 || r.upi !== 0 ? 242 : 244);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      } else if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

      doc.setFont('helvetica', r.isBold ? 'bold' : 'normal');
      doc.setFontSize(8);

      if (r.isDiff) {
        if (r.cash !== 0 || r.upi !== 0) doc.setTextColor(190, 18, 60); // rose-700
        else doc.setTextColor(16, 185, 129); // emerald-600
      } else if (r.isBold) {
        doc.setTextColor(15, 23, 42);
      } else {
        doc.setTextColor(71, 85, 105);
      }

      let rowX = margin;
      doc.text(r.label, rowX + 3, y + 4.8);
      rowX += colWidths[0];

      const cashStr = (r.cash >= 0 ? '' : '-') + '₹' + Math.abs(r.cash).toFixed(2);
      doc.text(cashStr, rowX + colWidths[1] - 3, y + 4.8, { align: 'right' });
      rowX += colWidths[1];

      const upiStr = (r.upi >= 0 ? '' : '-') + '₹' + Math.abs(r.upi).toFixed(2);
      doc.text(upiStr, rowX + colWidths[2] - 3, y + 4.8, { align: 'right' });
      rowX += colWidths[2];

      const totalVal = r.cash + r.upi;
      const totalStr = (totalVal >= 0 ? '' : '-') + '₹' + Math.abs(totalVal).toFixed(2);
      doc.text(totalStr, rowX + colWidths[3] - 3, y + 4.8, { align: 'right' });

      y += rowHeight;
    });

    y += 8;

    // Discrepancy Note Box if present
    if (closing.discrepancy_note || closing.audit_notes) {
      doc.setFillColor(255, 251, 235); // amber-50
      doc.setDrawColor(251, 191, 36); // amber-400
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(146, 64, 14); // amber-800
      doc.text('AUDIT / DISCREPANCY REMARKS:', margin + 4, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9);
      const noteText = closing.discrepancy_note || closing.audit_notes || '';
      doc.text(noteText, margin + 4, y + 10, { maxWidth: contentWidth - 8 });

      y += 20;
    } else {
      y += 6;
    }

    // Signatures Block
    const signY = pageHeight - 34;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);

    // Left Signature
    doc.line(margin + 10, signY, margin + 65, signY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Cashier / Counter In-Charge', margin + 37.5, signY + 4.5, { align: 'center' });

    // Right Signature
    doc.line(pageWidth - margin - 65, signY, pageWidth - margin - 10, signY);
    doc.text('Super Admin / Auditor Signature', pageWidth - margin - 37.5, signY + 4.5, { align: 'center' });

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `PrintPro SimpleBilling ERP — Certified Accounting Closing Statement | Ref: ${closing.closing_number || 'CLOSE'} | Generated: ${new Date().toLocaleString('en-IN')}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );

    return doc;
  }
}
