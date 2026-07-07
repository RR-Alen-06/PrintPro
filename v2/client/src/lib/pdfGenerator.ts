import { jsPDF } from 'jspdf';

export function generateDocumentPDF(
  docType: 'invoice' | 'estimate' | 'receipt',
  data: any,
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Base configurations
  doc.setFont('Helvetica', 'normal');

  // Helper to draw horizontal line
  const drawLine = (y: number) => {
    doc.setDrawColor(229, 231, 235); // borderGray
    doc.line(15, y, 195, y);
  };

  // Header Title
  doc.setFontSize(22);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('PrintPro Store', 15, 20);

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Owner Workspace · High Quality Production Prints', 15, 25);

  // Document Title
  doc.setFontSize(16);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(147, 51, 234); // purpleText
  const title = docType === 'invoice' ? 'TAX INVOICE' : docType === 'estimate' ? 'ESTIMATE / QUOTE' : 'PAYMENT RECEIPT';
  doc.text(title, 195, 20, { align: 'right' });

  // Document Metadata Table
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.setFont('Helvetica', 'normal');

  let docNo = '';
  if (docType === 'invoice') docNo = data.billNo || data._id?.substring(0, 8) || '';
  else if (docType === 'estimate') docNo = data.estimateNo || '';
  else docNo = data.paymentNo || '';

  doc.text(`Doc No: ${docNo}`, 195, 25, { align: 'right' });
  doc.text(`Date: ${data.date || new Date().toISOString().slice(0, 10)}`, 195, 29, { align: 'right' });
  if (data.dueDate && docType === 'invoice') {
    doc.text(`Due Date: ${data.dueDate}`, 195, 33, { align: 'right' });
  }

  drawLine(38);

  // Client Details
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('BILL TO:', 15, 45);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text(data.customerName || 'Walk-in Customer', 15, 50);
  if (data.phone) {
    doc.text(`Phone: ${data.phone}`, 15, 54);
  }
  if (data.email) {
    doc.text(`Email: ${data.email}`, 15, 58);
  }

  drawLine(65);

  // Item List Table Header
  let y = 73;
  if (docType === 'receipt') {
    // Receipts do not have item lists, they just list the payment amount and details
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Payment Summary:', 15, 75);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text(`Associated Invoice: ${data.billNo || 'N/A'}`, 15, 82);
    doc.text(`Total Amount Paid: INR ${Number(data.totalPaid || 0).toFixed(2)}`, 15, 88);
    doc.text(`Cash Contribution: INR ${Number(data.cashAmount || 0).toFixed(2)}`, 15, 94);
    doc.text(`UPI Contribution: INR ${Number(data.upiAmount || 0).toFixed(2)}`, 15, 100);

    if (data.notes) {
      doc.text(`Remarks / Notes: ${data.notes}`, 15, 110);
    }

    drawLine(120);

    // Totals at bottom
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // green
    doc.setFontSize(12);
    doc.text(`Net Received: INR ${Number(data.totalPaid || 0).toFixed(2)}`, 195, 130, { align: 'right' });
  } else {
    // Invoices and Estimates have item lists
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(9);
    doc.text('ITEM NAME', 15, 72);
    doc.text('QTY', 110, 72, { align: 'right' });
    doc.text('SUBTOTAL', 140, 72, { align: 'right' });
    doc.text('TAX (GST)', 165, 72, { align: 'right' });
    doc.text('TOTAL', 195, 72, { align: 'right' });

    drawLine(75);

    const items = data.items || [];
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(75, 85, 99);

    items.forEach((item: any) => {
      y += 8;
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.text(item.name || 'Print Service Item', 15, y);
      doc.text(String(item.qty || 1), 110, y, { align: 'right' });

      // Support V2 items schema
      const netSub = Number(item.netSubtotal || item.price * (item.qty || 1) || 0).toFixed(2);
      const tax = Number(item.lineGst || (item.tax || 0)).toFixed(2);
      const total = Number(item.total || (item.price * item.qty) || 0).toFixed(2);

      doc.text(`INR ${netSub}`, 140, y, { align: 'right' });
      doc.text(`INR ${tax}`, 165, y, { align: 'right' });
      doc.text(`INR ${total}`, 195, y, { align: 'right' });
    });

    drawLine(y + 6);

    y += 15;
    // Bottom Totals Summary
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    const labelX = 150;
    const valX = 195;

    doc.text('Subtotal Value:', labelX, y, { align: 'right' });
    doc.text(`INR ${Number(data.subtotal || data.total - (data.gst || 0)).toFixed(2)}`, valX, y, { align: 'right' });

    y += 6;
    doc.text('GST Tax Amount:', labelX, y, { align: 'right' });
    doc.text(`INR ${Number(data.gst || 0).toFixed(2)}`, valX, y, { align: 'right' });

    if (data.discount > 0) {
      y += 6;
      doc.text('Discount (-):', labelX, y, { align: 'right' });
      doc.text(`INR ${Number(data.discount).toFixed(2)}`, valX, y, { align: 'right' });
    }

    if (data.advanceUsed > 0) {
      y += 6;
      doc.text('Advance Applied (-):', labelX, y, { align: 'right' });
      doc.text(`INR ${Number(data.advanceUsed).toFixed(2)}`, valX, y, { align: 'right' });
    }

    y += 8;
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.text('Grand Total:', labelX, y, { align: 'right' });
    doc.text(`INR ${Number(data.total || 0).toFixed(2)}`, valX, y, { align: 'right' });

    if (docType === 'invoice') {
      y += 6;
      doc.setFontSize(9);
      doc.text('Remaining Balance:', labelX, y, { align: 'right' });
      doc.text(`INR ${Number(data.balance ?? (data.total - (data.amountPaid || 0))).toFixed(2)}`, valX, y, { align: 'right' });
    }
  }

  // Footer stamp
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.setFont('Helvetica', 'normal');
  doc.text('Thank you for your business. Generated by PrintPro ERP.', 15, 285);

  // Save the PDF
  doc.save(`${docType}_${docNo}.pdf`);
}
