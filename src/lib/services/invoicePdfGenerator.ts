import { jsPDF } from 'jspdf';
import { Bill } from '@/lib/types';

export interface InvoiceSummaryData {
  previous_outstanding: number;
  previous_advance: number;
  current_bill_amount: number;
  total_amount_due: number;
  cash_paid: number;
  upi_paid: number;
  advance_used: number;
  total_paid: number;
  remaining_balance: number;
  remaining_advance_balance: number;
  payment_status: 'Fully Paid' | 'Partially Paid' | 'Payment Pending';
}

export interface ShopInfoData {
  shop_name: string;
  address: string;
  phone: string;
  gst_number?: string;
  footer_message?: string;
  terms?: string;
}

export class InvoicePdfGenerator {
  /**
   * Generates a pure vector PDF for an invoice without raster screenshots.
   */
  public static generateInvoicePdf(
    bill: Bill,
    summary: InvoiceSummaryData,
    shop: ShopInfoData,
    format: 'a4' | 'thermal-80' | 'thermal-58' = 'a4'
  ): { pdf: jsPDF; filename: string } {
    const filename = `Invoice-${bill.bill_number || 'receipt'}.pdf`;

    if (format === 'a4') {
      const pdf = this.buildA4VectorInvoice(bill, summary, shop);
      return { pdf, filename };
    } else if (format === 'thermal-80') {
      const pdf = this.buildThermalVectorInvoice(bill, summary, shop, 80);
      return { pdf, filename };
    } else {
      const pdf = this.buildThermalVectorInvoice(bill, summary, shop, 58);
      return { pdf, filename };
    }
  }

  // -------------------------------------------------------------
  // A4 VECTOR INVOICE
  // -------------------------------------------------------------
  private static buildA4VectorInvoice(
    bill: Bill,
    summary: InvoiceSummaryData,
    shop: ShopInfoData
  ): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210
    const margin = 14;
    const contentWidth = pageWidth - margin * 2; // 182
    let y = 14;

    // --- TOP BANNER / SHOP DETAILS ---
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text((shop.shop_name || 'PRINT PRO ERP').toUpperCase(), margin + 6, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240);
    const addressLine = [shop.address, shop.phone ? `Ph: ${shop.phone}` : '', shop.gst_number ? `GSTIN: ${shop.gst_number}` : ''].filter(Boolean).join(' | ');
    doc.text(doc.splitTextToSize(addressLine || 'Official Tax Invoice', contentWidth - 70), margin + 6, y + 14);

    // TAX INVOICE BADGE
    doc.setFillColor(51, 65, 85);
    doc.roundedRect(pageWidth - margin - 55, y + 4, 49, 16, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TAX INVOICE', pageWidth - margin - 30.5, y + 10, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`ORIGINAL FOR RECIPIENT`, pageWidth - margin - 30.5, y + 15, { align: 'center' });

    y += 28;

    // --- METADATA BAR (2 Columns: Customer vs Invoice Meta) ---
    const boxHeight = 24;
    const halfWidth = (contentWidth - 4) / 2;

    // Customer Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, halfWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('BILLED TO (CUSTOMER DETAILS)', margin + 4, y + 5);

    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(bill.customer_name || 'Walk-in Customer', margin + 4, y + 11);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const custContact = [
      bill.customer_mobile ? `Mobile: ${bill.customer_mobile}` : '',
      bill.customer_email ? `Email: ${bill.customer_email}` : ''
    ].filter(Boolean).join(' | ');
    doc.text(custContact || 'No contact details recorded', margin + 4, y + 17);

    // Invoice Meta Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + halfWidth + 4, y, halfWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('INVOICE INFORMATION', margin + halfWidth + 8, y + 5);

    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`Invoice No: `, margin + halfWidth + 8, y + 11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${bill.bill_number}`, margin + halfWidth + 26, y + 11);

    doc.setFont('helvetica', 'normal');
    const invoiceDate = bill.created_at ? new Date(bill.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
    doc.text(`Date & Time: ${invoiceDate}`, margin + halfWidth + 8, y + 17);

    y += boxHeight + 4;

    // --- LINE ITEMS TABLE ---
    const colX = {
      sno: margin + 3,
      item: margin + 12,
      qty: margin + 105,
      rate: margin + 135,
      amount: margin + contentWidth - 4
    };

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 7, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('#', colX.sno, y + 4.8);
    doc.text('DESCRIPTION / SERVICE', colX.item, y + 4.8);
    doc.text('QTY', colX.qty, y + 4.8, { align: 'right' });
    doc.text('UNIT RATE (Rs)', colX.rate, y + 4.8, { align: 'right' });
    doc.text('AMOUNT (Rs)', colX.amount, y + 4.8, { align: 'right' });

    y += 7;

    const items = bill.items || [];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    items.forEach((item, idx) => {
      // Check page overflow
      if (y > 230) {
        doc.addPage();
        y = 15;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6.5, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);

      doc.setTextColor(71, 85, 105);
      doc.text(String(idx + 1), colX.sno, y + 4.5);
      
      doc.setTextColor(15, 23, 42);
      const itemName = item.product_name || 'Item';
      doc.text(itemName.length > 48 ? itemName.substring(0, 48) + '...' : itemName, colX.item, y + 4.5);

      doc.setTextColor(51, 65, 85);
      doc.text(String(item.quantity), colX.qty, y + 4.5, { align: 'right' });
      doc.text(Number(item.price || 0).toFixed(2), colX.rate, y + 4.5, { align: 'right' });
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(Number(item.total || 0).toFixed(2), colX.amount, y + 4.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 6.5;
    });

    y += 3;

    // --- TOTALS & SUMMARY SECTION ---
    const calcWidth = 64;
    const gridWidth = contentWidth - calcWidth - 4;
    const calcX = margin + gridWidth + 4;

    // Draw Mathematical Totals Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(calcX, y, calcWidth, 36, 1.5, 1.5, 'FD');

    let calcY = y + 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text('Subtotal:', calcX + 4, calcY);
    doc.text(`Rs ${Number(bill.total || 0).toFixed(2)}`, calcX + calcWidth - 4, calcY, { align: 'right' });

    if (Number(bill.discount || 0) > 0) {
      calcY += 5;
      doc.text('Discount:', calcX + 4, calcY);
      doc.setTextColor(220, 38, 38);
      doc.text(`- Rs ${Number(bill.discount || 0).toFixed(2)}`, calcX + calcWidth - 4, calcY, { align: 'right' });
      doc.setTextColor(71, 85, 105);
    }

    if (Number(bill.gst_amount || 0) > 0) {
      calcY += 5;
      doc.text('GST / Tax:', calcX + 4, calcY);
      doc.text(`+ Rs ${Number(bill.gst_amount || 0).toFixed(2)}`, calcX + calcWidth - 4, calcY, { align: 'right' });
    }

    if (Number(bill.rounding_adjustment || 0) !== 0) {
      calcY += 5;
      doc.text('Rounding:', calcX + 4, calcY);
      const sign = Number(bill.rounding_adjustment || 0) >= 0 ? '+' : '';
      doc.text(`${sign} Rs ${Number(bill.rounding_adjustment || 0).toFixed(2)}`, calcX + calcWidth - 4, calcY, { align: 'right' });
    }

    calcY += 6;
    doc.setDrawColor(203, 213, 225);
    doc.line(calcX + 3, calcY - 2, calcX + calcWidth - 3, calcY - 2);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Grand Total:', calcX + 4, calcY + 2);
    doc.text(`Rs ${Number(bill.grand_total || 0).toFixed(2)}`, calcX + calcWidth - 4, calcY + 2, { align: 'right' });

    // Draw 2 Financial Grid Cards on Left
    const cardWidth = (gridWidth - 4) / 2;

    // Card 1: Ledger Summary
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, cardWidth, 38, 1.5, 1.5, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('LEDGER SUMMARY', margin + 3, y + 4.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Prev. Due: Rs ${summary.previous_outstanding.toFixed(2)}`, margin + 3, y + 10);
    doc.text(`Prev. Advance: Rs ${summary.previous_advance.toFixed(2)}`, margin + 3, y + 15);
    doc.text(`This Bill: Rs ${summary.current_bill_amount.toFixed(2)}`, margin + 3, y + 20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Net Amount Due: Rs ${summary.total_amount_due.toFixed(2)}`, margin + 3, y + 27);

    // Card 2: Payment & Advance Summary
    const card2X = margin + cardWidth + 2;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(card2X, y, cardWidth, 38, 1.5, 1.5, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('PAYMENT & BALANCE', card2X + 3, y + 4.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    let card2LineY = y + 9.5;
    doc.text(`Cash: Rs ${summary.cash_paid.toFixed(2)} | UPI: Rs ${summary.upi_paid.toFixed(2)}`, card2X + 3, card2LineY);

    card2LineY += 4.5;
    doc.text(`Adv Used: Rs ${summary.advance_used.toFixed(2)} | Total Paid: Rs ${summary.total_paid.toFixed(2)}`, card2X + 3, card2LineY);

    card2LineY += 4.5;
    doc.setFont('helvetica', 'bold');
    if (summary.remaining_balance > 0) {
      doc.setTextColor(217, 119, 6);
      doc.text(`Balance Due: Rs ${summary.remaining_balance.toFixed(2)}`, card2X + 3, card2LineY);
    } else {
      doc.setTextColor(5, 150, 105);
      doc.text(`Balance Due: Rs 0.00 (Cleared)`, card2X + 3, card2LineY);
    }

    if (Number(bill.advance_earned || 0) > 0) {
      card2LineY += 4.5;
      doc.setTextColor(13, 148, 136);
      doc.text(`Advance Credited (This Bill): +Rs ${Number(bill.advance_earned).toFixed(2)}`, card2X + 3, card2LineY);
    }

    if (summary.remaining_advance_balance > 0) {
      card2LineY += 4.5;
      doc.setTextColor(15, 118, 110);
      doc.text(`Customer Advance Wallet: Rs ${summary.remaining_advance_balance.toFixed(2)}`, card2X + 3, card2LineY);
    }

    card2LineY += 4.5;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Status: ${summary.payment_status}`, card2X + 3, card2LineY);

    y += 42;

    // --- FOOTER & TERMS ---
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + contentWidth, y);
    y += 4;

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(shop.terms || 'Terms: Goods once sold will not be taken back or exchanged. Subject to local jurisdiction.', margin, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text(shop.footer_message || 'Thank you for your business! Generated via PrintPro ERP.', margin, y);

    return doc;
  }

  // -------------------------------------------------------------
  // THERMAL VECTOR INVOICE (80mm & 58mm)
  // -------------------------------------------------------------
  private static buildThermalVectorInvoice(
    bill: Bill,
    summary: InvoiceSummaryData,
    shop: ShopInfoData,
    paperWidthMm: number = 80
  ): jsPDF {
    const margin = 4;
    const contentWidth = paperWidthMm - margin * 2;
    const items = bill.items || [];

    const headerHeight = 22;
    const metaHeight = 26;
    const tableHeight = 10 + items.length * 6;
    const totalsHeight = 28;
    const ledgerHeight = 24;
    const paymentHeight = 24;
    const footerHeight = 18;
    const totalHeightMm = headerHeight + metaHeight + tableHeight + totalsHeight + ledgerHeight + paymentHeight + footerHeight + 10;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [paperWidthMm, Math.max(120, totalHeightMm)]
    });

    let y = 5;

    // --- SHOP HEADER ---
    doc.setFont('courier', 'bold');
    doc.setFontSize(paperWidthMm === 58 ? 9 : 11);
    doc.setTextColor(0, 0, 0);
    doc.text((shop.shop_name || 'PRINT PRO SHOP').toUpperCase(), paperWidthMm / 2, y, { align: 'center' });
    y += 4;

    doc.setFont('courier', 'normal');
    doc.setFontSize(paperWidthMm === 58 ? 7 : 8);
    if (shop.address) {
      const splitAddr = doc.splitTextToSize(shop.address, contentWidth);
      doc.text(splitAddr, paperWidthMm / 2, y, { align: 'center' });
      y += (splitAddr.length * 3.5);
    }
    if (shop.phone) {
      doc.text(`Ph: ${shop.phone}`, paperWidthMm / 2, y, { align: 'center' });
      y += 3.5;
    }
    if (shop.gst_number) {
      doc.text(`GSTIN: ${shop.gst_number}`, paperWidthMm / 2, y, { align: 'center' });
      y += 3.5;
    }

    doc.text('-'.repeat(paperWidthMm === 58 ? 26 : 38), paperWidthMm / 2, y, { align: 'center' });
    y += 3.5;

    // --- META ---
    doc.setFontSize(paperWidthMm === 58 ? 7 : 8);
    doc.text(`Bill No : ${bill.bill_number}`, margin, y);
    y += 3.5;

    const invDate = bill.created_at ? new Date(bill.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
    doc.text(`Date    : ${invDate}`, margin, y);
    y += 3.5;

    doc.text(`Cust    : ${bill.customer_name || 'Walk-in Customer'}`, margin, y);
    y += 3.5;

    if (bill.customer_mobile) {
      doc.text(`Mobile  : ${bill.customer_mobile}`, margin, y);
      y += 3.5;
    }

    doc.text(`Status  : ${summary.payment_status}`, margin, y);
    y += 3.5;

    doc.text('-'.repeat(paperWidthMm === 58 ? 26 : 38), paperWidthMm / 2, y, { align: 'center' });
    y += 3.5;

    // --- ITEMS TABLE ---
    doc.setFont('courier', 'bold');
    doc.text('Item', margin, y);
    doc.text('Qty', margin + (contentWidth * 0.52), y, { align: 'right' });
    doc.text('Rate', margin + (contentWidth * 0.76), y, { align: 'right' });
    doc.text('Amt', margin + contentWidth, y, { align: 'right' });
    y += 3.5;

    doc.setFont('courier', 'normal');
    items.forEach((item) => {
      const name = item.product_name || 'Item';
      const truncated = name.length > (paperWidthMm === 58 ? 10 : 16) ? name.substring(0, paperWidthMm === 58 ? 10 : 16) : name;
      doc.text(truncated, margin, y);
      doc.text(String(item.quantity), margin + (contentWidth * 0.52), y, { align: 'right' });
      doc.text(Number(item.price || 0).toFixed(2), margin + (contentWidth * 0.76), y, { align: 'right' });
      doc.text(Number(item.total || 0).toFixed(2), margin + contentWidth, y, { align: 'right' });
      y += 3.5;
    });

    doc.text('-'.repeat(paperWidthMm === 58 ? 26 : 38), paperWidthMm / 2, y, { align: 'center' });
    y += 3.5;

    // --- TOTALS ---
    doc.text('Subtotal', margin, y);
    doc.text(`Rs ${Number(bill.total || 0).toFixed(2)}`, margin + contentWidth, y, { align: 'right' });
    y += 3.5;

    if (Number(bill.discount || 0) > 0) {
      doc.text('Discount', margin, y);
      doc.text(`-Rs ${Number(bill.discount || 0).toFixed(2)}`, margin + contentWidth, y, { align: 'right' });
      y += 3.5;
    }

    if (Number(bill.gst_amount || 0) > 0) {
      doc.text('Tax/GST', margin, y);
      doc.text(`+Rs ${Number(bill.gst_amount || 0).toFixed(2)}`, margin + contentWidth, y, { align: 'right' });
      y += 3.5;
    }

    if (Number(bill.rounding_adjustment || 0) !== 0) {
      doc.text('Rounding', margin, y);
      const sign = Number(bill.rounding_adjustment || 0) >= 0 ? '+' : '';
      doc.text(`${sign}Rs ${Number(bill.rounding_adjustment || 0).toFixed(2)}`, margin + contentWidth, y, { align: 'right' });
      y += 3.5;
    }

    doc.setFont('courier', 'bold');
    doc.text('Grand Total', margin, y);
    doc.text(`Rs ${Number(bill.grand_total || 0).toFixed(2)}`, margin + contentWidth, y, { align: 'right' });
    y += 3.5;

    doc.text('-'.repeat(paperWidthMm === 58 ? 26 : 38), paperWidthMm / 2, y, { align: 'center' });
    y += 3.5;

    // --- LEDGER & PAYMENTS ---
    doc.setFont('courier', 'normal');
    doc.text(`Prev. Due: Rs ${summary.previous_outstanding.toFixed(2)}`, margin, y);
    y += 3.5;
    doc.text(`Total Due: Rs ${summary.total_amount_due.toFixed(2)}`, margin, y);
    y += 3.5;

    doc.text(`Paid (Cash ${summary.cash_paid.toFixed(0)} | UPI ${summary.upi_paid.toFixed(0)}): Rs ${summary.total_paid.toFixed(2)}`, margin, y);
    y += 3.5;

    if (summary.advance_used > 0) {
      doc.text(`Advance Used: Rs ${summary.advance_used.toFixed(2)}`, margin, y);
      y += 3.5;
    }

    if (summary.remaining_balance > 0) {
      doc.setFont('courier', 'bold');
      doc.text(`Remaining Due: Rs ${summary.remaining_balance.toFixed(2)}`, margin, y);
      y += 3.5;
    } else {
      doc.setFont('courier', 'normal');
      doc.text(`Balance Due: Rs 0.00`, margin, y);
      y += 3.5;
    }

    if (Number(bill.advance_earned || 0) > 0) {
      doc.setFont('courier', 'bold');
      doc.text(`Advance Credited: +Rs ${Number(bill.advance_earned).toFixed(2)}`, margin, y);
      y += 3.5;
    }

    if (summary.remaining_advance_balance > 0) {
      doc.setFont('courier', 'bold');
      doc.text(`Customer Advance Wallet: Rs ${summary.remaining_advance_balance.toFixed(2)}`, margin, y);
      y += 3.5;
    }
    y += 0.5;

    doc.text('-'.repeat(paperWidthMm === 58 ? 26 : 38), paperWidthMm / 2, y, { align: 'center' });
    y += 3.5;

    // --- FOOTER ---
    doc.setFont('courier', 'normal');
    doc.setFontSize(paperWidthMm === 58 ? 6.5 : 7);
    doc.text(shop.footer_message || 'Thank you! Visit again.', paperWidthMm / 2, y, { align: 'center' });
    y += 3;

    return doc;
  }
}
