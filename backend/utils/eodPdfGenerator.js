const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BASE_UPLOAD_DIR = path.resolve(__dirname, '../uploads');

/**
 * Generates an End-of-Day (EOD) Report PDF using PDFKit.
 * 
 * @param {Object} reportData - The EOD report object
 * @param {string} outputPath - Absolute file path to save PDF
 * @returns {Promise<string>} - Resolves with outputPath on completion
 */
function generateEodPdf(reportData, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const resolvedPath = path.resolve(outputPath);
      const targetDir = path.dirname(resolvedPath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        bufferPages: true,
        info: {
          Title: `EOD Report - ${reportData.date}`,
          Author: reportData.business?.shop_name || 'PrintPro',
          Subject: 'End of Day Financial Report',
          CreationDate: new Date(),
        }
      });

      const writeStream = fs.createWriteStream(resolvedPath);
      doc.pipe(writeStream);

      const business = reportData.business || {};
      const summary = reportData.summary || {};
      const bills = reportData.bills || [];
      const payments = reportData.payments || [];
      const expenses = reportData.expenses_list || [];

      const primaryColor = '#1e293b';
      const accentColor = '#3b82f6';
      const debitColor = '#dc2626';
      const creditColor = '#16a34a';
      const mutedColor = '#64748b';
      const borderColor = '#e2e8f0';
      const bgLight = '#f8fafc';

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 36;
      const contentWidth = pageWidth - (margin * 2);

      // ── Header ─────────────────────────────────────────────────────────────
      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold')
        .text(business.shop_name || 'PrintPro Billing', margin, margin);

      doc.fontSize(8).font('Helvetica').fillColor(mutedColor);
      let busLineY = margin + 20;
      if (business.address) {
        doc.text(business.address, margin, busLineY);
        busLineY += 11;
      }
      const busContacts = [];
      if (business.phone) busContacts.push(`Phone: ${business.phone}`);
      if (business.gstin) busContacts.push(`GSTIN: ${business.gstin}`);
      if (busContacts.length > 0) {
        doc.text(busContacts.join('  |  '), margin, busLineY);
        busLineY += 11;
      }

      // Title & Date on Right
      const rightX = pageWidth - margin - 200;
      doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
        .text('DAILY EOD REPORT', rightX, margin, { width: 200, align: 'right' });

      doc.fontSize(8).font('Helvetica').fillColor(mutedColor);
      doc.text(`Report Date:`, rightX, margin + 20, { width: 200, align: 'right' });
      doc.font('Helvetica-Bold').fillColor(primaryColor)
        .text(reportData.date || new Date().toISOString().slice(0, 10), rightX, margin + 31, { width: 200, align: 'right' });

      doc.font('Helvetica').fillColor(mutedColor)
        .text(`Generated: ${new Date().toLocaleTimeString('en-IN')}`, rightX, margin + 43, { width: 200, align: 'right' });

      // Horizontal Divider
      const headerEndY = Math.max(busLineY, margin + 58) + 6;
      doc.strokeColor(borderColor).lineWidth(1)
        .moveTo(margin, headerEndY)
        .lineTo(pageWidth - margin, headerEndY)
        .stroke();

      // ── 6 Summary Snapshot Cards ──────────────────────────────────────────
      const cardsY = headerEndY + 12;
      const cardHeight = 44;
      const gap = 8;
      const numCols = 3;
      const cardWidth = (contentWidth - (gap * (numCols - 1))) / numCols;

      const metrics = [
        { label: 'TOTAL BILLED', val: `Rs. ${(summary.total_billed || 0).toFixed(2)}`, color: primaryColor },
        { label: 'CASH COLLECTED', val: `Rs. ${(summary.collected_cash || 0).toFixed(2)}`, color: creditColor },
        { label: 'UPI COLLECTED', val: `Rs. ${(summary.collected_upi || 0).toFixed(2)}`, color: '#8b5cf6' },
        { label: 'TOTAL EXPENSES', val: `Rs. ${(summary.expenses || 0).toFixed(2)}`, color: debitColor },
        { label: 'NET PROFIT', val: `Rs. ${(summary.net_profit || 0).toFixed(2)}`, color: (summary.net_profit || 0) >= 0 ? creditColor : debitColor },
        { label: 'PENDING DUES', val: `Rs. ${(summary.pending_dues || 0).toFixed(2)}`, color: (summary.pending_dues || 0) > 0 ? '#d97706' : mutedColor },
      ];

      metrics.forEach((m, idx) => {
        const col = idx % numCols;
        const row = Math.floor(idx / numCols);
        const x = margin + (col * (cardWidth + gap));
        const y = cardsY + (row * (cardHeight + gap));

        doc.rect(x, y, cardWidth, cardHeight).fillAndStroke(bgLight, borderColor);
        doc.fillColor(mutedColor).fontSize(6.5).font('Helvetica-Bold')
          .text(m.label, x + 8, y + 6, { width: cardWidth - 16 });
        doc.fillColor(m.color).fontSize(11).font('Helvetica-Bold')
          .text(m.val, x + 8, y + 20, { width: cardWidth - 16 });
      });

      // Additional stats banner
      const bannerY = cardsY + (cardHeight * 2) + gap + 10;
      doc.rect(margin, bannerY, contentWidth, 22).fillAndStroke('#f1f5f9', borderColor);
      doc.fontSize(7.5).font('Helvetica').fillColor(primaryColor);
      
      const topItemStr = summary.top_item ? `${summary.top_item.name} (${summary.top_item.qty} pcs)` : 'N/A';
      const statsText = `Bills: ${summary.bill_count || 0}  |  Payments: ${summary.payment_count || 0}  |  New Customers: ${summary.new_customers || 0}  |  Top Item: ${topItemStr}`;
      doc.text(statsText, margin + 10, bannerY + 6, { width: contentWidth - 20, align: 'center' });

      let currentY = bannerY + 34;
      const maxY = pageHeight - margin - 40;

      // ── Section 1: Bills for the Day ───────────────────────────────────────
      doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor)
        .text(`Invoices / Bills Generated (${bills.length})`, margin, currentY);
      currentY += 14;

      const billCols = [
        { label: 'BILL ID', x: margin + 4, width: 80, align: 'left' },
        { label: 'CUSTOMER', x: margin + 86, width: 140, align: 'left' },
        { label: 'STATUS', x: margin + 228, width: 60, align: 'left' },
        { label: 'TOTAL (Rs)', x: margin + 290, width: 70, align: 'right' },
        { label: 'PAID (Rs)', x: margin + 362, width: 75, align: 'right' },
        { label: 'BALANCE (Rs)', x: margin + 439, width: 78, align: 'right' },
      ];

      function drawBillHeader(y) {
        doc.rect(margin, y, contentWidth, 16).fillAndStroke('#e2e8f0', borderColor);
        doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold');
        billCols.forEach(c => doc.text(c.label, c.x, y + 4, { width: c.width, align: c.align }));
        return y + 16;
      }

      currentY = drawBillHeader(currentY);

      if (bills.length === 0) {
        doc.rect(margin, currentY, contentWidth, 16).fillAndStroke('#ffffff', borderColor);
        doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica')
          .text('No bills generated on this date.', margin + 8, currentY + 4);
        currentY += 16;
      } else {
        bills.forEach((b, idx) => {
          if (currentY + 16 > maxY) {
            doc.addPage();
            currentY = drawBillHeader(margin);
          }
          const rowBg = idx % 2 === 0 ? '#ffffff' : bgLight;
          doc.rect(margin, currentY, contentWidth, 16).fillAndStroke(rowBg, borderColor);
          doc.fontSize(7.5).font('Helvetica').fillColor(primaryColor);
          doc.text((b.id || '').toString(), billCols[0].x, currentY + 4, { width: billCols[0].width, align: 'left' });
          doc.text((b.customer_name || 'Walk-in').slice(0, 22), billCols[1].x, currentY + 4, { width: billCols[1].width, align: 'left' });
          
          doc.font('Helvetica-Bold').fillColor(b.status === 'paid' ? creditColor : b.status === 'partial' ? '#d97706' : debitColor);
          doc.text((b.status || 'unpaid').toUpperCase(), billCols[2].x, currentY + 4, { width: billCols[2].width, align: 'left' });

          doc.font('Helvetica').fillColor(primaryColor);
          doc.text(parseFloat(b.total || 0).toFixed(2), billCols[3].x, currentY + 4, { width: billCols[3].width, align: 'right' });
          doc.text(parseFloat(b.amount_paid || 0).toFixed(2), billCols[4].x, currentY + 4, { width: billCols[4].width, align: 'right' });
          doc.text(parseFloat(b.balance || 0).toFixed(2), billCols[5].x, currentY + 4, { width: billCols[5].width, align: 'right' });
          currentY += 16;
        });
      }

      currentY += 16;

      // ── Section 2: Payments Collected ─────────────────────────────────────
      if (currentY + 50 > maxY) {
        doc.addPage();
        currentY = margin;
      }

      doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor)
        .text(`Collections & Payments (${payments.length})`, margin, currentY);
      currentY += 14;

      const payCols = [
        { label: 'TIME / ID', x: margin + 4, width: 80, align: 'left' },
        { label: 'CUSTOMER', x: margin + 86, width: 140, align: 'left' },
        { label: 'BILL REF', x: margin + 228, width: 70, align: 'left' },
        { label: 'CASH (Rs)', x: margin + 300, width: 65, align: 'right' },
        { label: 'UPI (Rs)', x: margin + 367, width: 70, align: 'right' },
        { label: 'TOTAL (Rs)', x: margin + 439, width: 78, align: 'right' },
      ];

      function drawPayHeader(y) {
        doc.rect(margin, y, contentWidth, 16).fillAndStroke('#e2e8f0', borderColor);
        doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold');
        payCols.forEach(c => doc.text(c.label, c.x, y + 4, { width: c.width, align: c.align }));
        return y + 16;
      }

      currentY = drawPayHeader(currentY);

      if (payments.length === 0) {
        doc.rect(margin, currentY, contentWidth, 16).fillAndStroke('#ffffff', borderColor);
        doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica')
          .text('No payment transactions recorded on this date.', margin + 8, currentY + 4);
        currentY += 16;
      } else {
        payments.forEach((p, idx) => {
          if (currentY + 16 > maxY) {
            doc.addPage();
            currentY = drawPayHeader(margin);
          }
          const rowBg = idx % 2 === 0 ? '#ffffff' : bgLight;
          doc.rect(margin, currentY, contentWidth, 16).fillAndStroke(rowBg, borderColor);
          doc.fontSize(7.5).font('Helvetica').fillColor(primaryColor);
          
          const timeStr = p.date ? new Date(p.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : `#${p.id}`;
          doc.text(timeStr, payCols[0].x, currentY + 4, { width: payCols[0].width, align: 'left' });
          doc.text((p.customer_name || '-').slice(0, 22), payCols[1].x, currentY + 4, { width: payCols[1].width, align: 'left' });
          doc.text((p.bill_id || '-').toString().slice(0, 12), payCols[2].x, currentY + 4, { width: payCols[2].width, align: 'left' });

          doc.text(parseFloat(p.cash_amount || 0).toFixed(2), payCols[3].x, currentY + 4, { width: payCols[3].width, align: 'right' });
          doc.text(parseFloat(p.upi_amount || 0).toFixed(2), payCols[4].x, currentY + 4, { width: payCols[4].width, align: 'right' });
          
          doc.font('Helvetica-Bold').fillColor(creditColor);
          doc.text(parseFloat(p.total_paid || 0).toFixed(2), payCols[5].x, currentY + 4, { width: payCols[5].width, align: 'right' });
          currentY += 16;
        });
      }

      currentY += 16;

      // ── Section 3: Expenses ────────────────────────────────────────────────
      if (expenses.length > 0) {
        if (currentY + 50 > maxY) {
          doc.addPage();
          currentY = margin;
        }

        doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor)
          .text(`Daily Purchases & Expenses (${expenses.length})`, margin, currentY);
        currentY += 14;

        const expCols = [
          { label: 'ITEM NAME', x: margin + 4, width: 130, align: 'left' },
          { label: 'CATEGORY', x: margin + 136, width: 90, align: 'left' },
          { label: 'VENDOR', x: margin + 228, width: 100, align: 'left' },
          { label: 'METHOD', x: margin + 330, width: 60, align: 'left' },
          { label: 'QTY', x: margin + 392, width: 45, align: 'right' },
          { label: 'TOTAL (Rs)', x: margin + 439, width: 78, align: 'right' },
        ];

        function drawExpHeader(y) {
          doc.rect(margin, y, contentWidth, 16).fillAndStroke('#e2e8f0', borderColor);
          doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold');
          expCols.forEach(c => doc.text(c.label, c.x, y + 4, { width: c.width, align: c.align }));
          return y + 16;
        }

        currentY = drawExpHeader(currentY);

        expenses.forEach((e, idx) => {
          if (currentY + 16 > maxY) {
            doc.addPage();
            currentY = drawExpHeader(margin);
          }
          const rowBg = idx % 2 === 0 ? '#ffffff' : bgLight;
          doc.rect(margin, currentY, contentWidth, 16).fillAndStroke(rowBg, borderColor);
          doc.fontSize(7.5).font('Helvetica').fillColor(primaryColor);
          doc.text((e.item_name || '-').slice(0, 22), expCols[0].x, currentY + 4, { width: expCols[0].width, align: 'left' });
          doc.text((e.category || '-').slice(0, 16), expCols[1].x, currentY + 4, { width: expCols[1].width, align: 'left' });
          doc.text((e.vendor_name || '-').slice(0, 16), expCols[2].x, currentY + 4, { width: expCols[2].width, align: 'left' });
          doc.text((e.payment_method || 'cash').toUpperCase(), expCols[3].x, currentY + 4, { width: expCols[3].width, align: 'left' });
          doc.text((e.qty || 1).toString(), expCols[4].x, currentY + 4, { width: expCols[4].width, align: 'right' });

          doc.font('Helvetica-Bold').fillColor(debitColor);
          doc.text(parseFloat(e.total || 0).toFixed(2), expCols[5].x, currentY + 4, { width: expCols[5].width, align: 'right' });
          currentY += 16;
        });
      }

      // ── Footer on all pages ───────────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.strokeColor(borderColor).lineWidth(0.5)
          .moveTo(margin, pageHeight - margin - 14)
          .lineTo(pageWidth - margin, pageHeight - margin - 14)
          .stroke();

        doc.fontSize(7).font('Helvetica').fillColor(mutedColor)
          .text(`End of Day Financial Settlement Report — ${business.shop_name || 'PrintPro'}`, margin, pageHeight - margin - 8, { width: 300, align: 'left' });

        doc.text(`Page ${i + 1} of ${range.count}`, pageWidth - margin - 100, pageHeight - margin - 8, { width: 100, align: 'right' });
      }

      doc.end();

      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateEodPdf,
};
