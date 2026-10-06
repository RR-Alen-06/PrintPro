/* eslint-disable security/detect-non-literal-fs-filename -- Path is strictly validated and sandboxed within BASE_UPLOAD_DIR */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BASE_UPLOAD_DIR = path.resolve(__dirname, '../uploads');

/**
 * Generates a bank-statement-style Customer Ledger PDF using PDFKit.
 * 
 * @param {Object} statement - The computed statement object
 * @param {string} outputPath - Absolute file path to save PDF
 * @returns {Promise<string>} - Resolves with outputPath on completion
 */
function generateLedgerPdf(statement, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const resolvedPath = path.resolve(BASE_UPLOAD_DIR, outputPath);
      const relativeToBase = path.relative(BASE_UPLOAD_DIR, resolvedPath);
      if (relativeToBase.startsWith('..') || path.isAbsolute(relativeToBase)) {
        throw new Error('Invalid output path: must be within uploads directory');
      }

      const targetDir = path.dirname(resolvedPath);
      const relativeTargetDir = path.relative(BASE_UPLOAD_DIR, targetDir);
      if (relativeTargetDir.startsWith('..') || path.isAbsolute(relativeTargetDir)) {
        throw new Error('Invalid target directory: must be within uploads directory');
      }

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: 36, // 0.5 inch margins (36pt)
        bufferPages: true,
        info: {
          Title: `Customer Ledger - ${statement.customer?.name || 'Customer'}`,
          Author: statement.business?.shop_name || 'PrintPro',
          Subject: 'Account Statement',
          CreationDate: new Date(),
        }
      });

      const writeStream = fs.createWriteStream(resolvedPath);
      doc.pipe(writeStream);

      const customer = statement.customer || {};
      const business = statement.business || {};
      const summary = statement.summary || {};
      const rows = statement.rows || [];

      const primaryColor = '#1e293b'; // Slate 800
      const accentColor = '#3b82f6';  // Blue 500
      const debitColor = '#dc2626';   // Red 600
      const creditColor = '#16a34a';  // Green 600
      const mutedColor = '#64748b';   // Slate 500
      const borderColor = '#e2e8f0'; // Slate 200
      const bgLight = '#f8fafc';     // Slate 50

      const pageWidth = 595.28; // A4 width in pt
      const pageHeight = 841.89; // A4 height in pt
      const margin = 36;
      const contentWidth = pageWidth - (margin * 2); // 523.28pt

      // ── Header ─────────────────────────────────────────────────────────────
      // Business Name & Info (Left)
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
      if (business.email) busContacts.push(`Email: ${business.email}`);
      if (busContacts.length > 0) {
        doc.text(busContacts.join('  |  '), margin, busLineY);
        busLineY += 11;
      }
      if (business.gstin) {
        doc.text(`GSTIN: ${business.gstin}`, margin, busLineY);
        busLineY += 11;
      }
      if (business.upi_id) {
        doc.text(`UPI ID: ${business.upi_id}`, margin, busLineY);
        busLineY += 11;
      }

      // Statement Title & Metadata (Right)
      const rightX = pageWidth - margin - 200;
      doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
        .text('ACCOUNT STATEMENT', rightX, margin, { width: 200, align: 'right' });

      doc.fontSize(8).font('Helvetica').fillColor(mutedColor);
      const periodText = statement.period 
        ? `${statement.period.startDate || 'Beginning'} to ${statement.period.endDate || 'Current'}`
        : 'All-Time Statement';
      
      doc.text(`Statement Period:`, rightX, margin + 20, { width: 200, align: 'right' });
      doc.font('Helvetica-Bold').fillColor(primaryColor)
        .text(periodText, rightX, margin + 31, { width: 200, align: 'right' });

      doc.font('Helvetica').fillColor(mutedColor)
        .text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, rightX, margin + 43, { width: 200, align: 'right' });

      // Horizontal Divider
      const headerEndY = Math.max(busLineY, margin + 58) + 6;
      doc.strokeColor(borderColor).lineWidth(1)
        .moveTo(margin, headerEndY)
        .lineTo(pageWidth - margin, headerEndY)
        .stroke();

      // ── Customer & Account Summary Box ──────────────────────────────────────
      const boxY = headerEndY + 10;
      const boxHeight = 64;
      const colWidth = (contentWidth - 10) / 2;

      // Customer Info Box
      doc.rect(margin, boxY, colWidth, boxHeight).fillAndStroke(bgLight, borderColor);
      doc.fillColor(mutedColor).fontSize(7).font('Helvetica-Bold')
        .text('STATEMENT FOR', margin + 8, boxY + 6);
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
        .text(customer.name || 'Valued Customer', margin + 8, boxY + 16);
      doc.fontSize(8).font('Helvetica').fillColor(mutedColor);
      let custDetailsY = boxY + 29;
      if (customer.customer_code || customer.id) {
        doc.text(`Customer ID: ${customer.customer_code || customer.id.slice(0, 8)}`, margin + 8, custDetailsY);
        custDetailsY += 10;
      }
      if (customer.phone) {
        doc.text(`Phone: ${customer.phone}`, margin + 8, custDetailsY);
      }

      // Financial Snapshot Box
      const rightBoxX = margin + colWidth + 10;
      doc.rect(rightBoxX, boxY, colWidth, boxHeight).fillAndStroke(bgLight, borderColor);
      
      const snapColW = (colWidth - 16) / 3;
      // Opening Balance
      doc.fillColor(mutedColor).fontSize(7).font('Helvetica-Bold')
        .text('OPENING BALANCE', rightBoxX + 8, boxY + 8, { width: snapColW });
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
        .text(`Rs. ${(summary.openingBalance || 0).toFixed(2)}`, rightBoxX + 8, boxY + 22, { width: snapColW });

      // Net Movement (Debits - Credits)
      doc.fillColor(mutedColor).fontSize(7).font('Helvetica-Bold')
        .text('TOTAL DEBITS', rightBoxX + 8 + snapColW, boxY + 8, { width: snapColW });
      doc.fillColor(debitColor).fontSize(9).font('Helvetica-Bold')
        .text(`Rs. ${(summary.totalDebits || 0).toFixed(2)}`, rightBoxX + 8 + snapColW, boxY + 22, { width: snapColW });

      // Closing Balance
      const isDue = (summary.closingBalance || 0) > 0;
      const isAdvance = (summary.closingBalance || 0) < 0;
      const balColor = isDue ? debitColor : isAdvance ? creditColor : primaryColor;
      const balLabel = isDue ? 'NET OUTSTANDING' : isAdvance ? 'ADVANCE CREDIT' : 'CLOSING BALANCE';
      
      doc.fillColor(mutedColor).fontSize(7).font('Helvetica-Bold')
        .text(balLabel, rightBoxX + 8 + (snapColW * 2), boxY + 8, { width: snapColW });
      doc.fillColor(balColor).fontSize(10).font('Helvetica-Bold')
        .text(`Rs. ${Math.abs(summary.closingBalance || 0).toFixed(2)}`, rightBoxX + 8 + (snapColW * 2), boxY + 22, { width: snapColW });

      // Second row in snapshot box: Total Credits
      doc.fillColor(mutedColor).fontSize(7).font('Helvetica-Bold')
        .text('TOTAL CREDITS', rightBoxX + 8 + snapColW, boxY + 38, { width: snapColW });
      doc.fillColor(creditColor).fontSize(9).font('Helvetica-Bold')
        .text(`Rs. ${(summary.totalCredits || 0).toFixed(2)}`, rightBoxX + 8 + snapColW, boxY + 48, { width: snapColW });

      // ── Transaction Table ──────────────────────────────────────────────────
      let currentY = boxY + boxHeight + 14;

      // Table Column Definitions
      const cols = [
        { key: 'date', label: 'DATE', x: margin + 4, width: 62, align: 'left' },
        { key: 'type', label: 'TYPE', x: margin + 68, width: 72, align: 'left' },
        { key: 'ref', label: 'REF / ID', x: margin + 142, width: 75, align: 'left' },
        { key: 'desc', label: 'DESCRIPTION', x: margin + 219, width: 130, align: 'left' },
        { key: 'debit', label: 'DEBIT (Rs)', x: margin + 351, width: 52, align: 'right' },
        { key: 'credit', label: 'CREDIT (Rs)', x: margin + 405, width: 52, align: 'right' },
        { key: 'balance', label: 'BALANCE (Rs)', x: margin + 459, width: 58, align: 'right' },
      ];

      function drawTableHeader(y) {
        doc.rect(margin, y, contentWidth, 18).fillAndStroke('#f1f5f9', borderColor);
        doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold');
        cols.forEach(col => {
          doc.text(col.label, col.x, y + 5, { width: col.width, align: col.align });
        });
        return y + 18;
      }

      currentY = drawTableHeader(currentY);

      // Opening balance row if non-zero
      if (summary.openingBalance !== undefined && summary.openingBalance !== 0) {
        const rowBg = bgLight;
        doc.rect(margin, currentY, contentWidth, 16).fillAndStroke(rowBg, borderColor);
        doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica')
          .text('-', cols[0].x, currentY + 4, { width: cols[0].width, align: 'left' })
          .text('Opening Balance', cols[1].x, currentY + 4, { width: cols[1].width, align: 'left' })
          .text('-', cols[2].x, currentY + 4, { width: cols[2].width, align: 'left' })
          .text('Balance brought forward', cols[3].x, currentY + 4, { width: cols[3].width, align: 'left' })
          .text('-', cols[4].x, currentY + 4, { width: cols[4].width, align: 'right' })
          .text('-', cols[5].x, currentY + 4, { width: cols[5].width, align: 'right' });
        
        doc.font('Helvetica-Bold').fillColor(primaryColor)
          .text(`Rs. ${(summary.openingBalance || 0).toFixed(2)}`, cols[6].x, currentY + 4, { width: cols[6].width, align: 'right' });
        currentY += 16;
      }

      // Draw Rows
      const rowHeight = 18;
      const maxY = pageHeight - margin - 50; // Leave space for summary / footer

      rows.forEach((row, idx) => {
        if (currentY + rowHeight > maxY) {
          doc.addPage();
          currentY = drawTableHeader(margin);
        }

        const isEven = idx % 2 === 0;
        const rowBg = isEven ? '#ffffff' : bgLight;
        doc.rect(margin, currentY, contentWidth, rowHeight).fillAndStroke(rowBg, borderColor);

        const dateStr = row.date ? new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const typeStr = row.typeLabel || row.type || '-';
        const refStr = (row.referenceId || '-').toString().slice(0, 16);
        const descStr = (row.description || '-').slice(0, 32);
        const debitStr = row.debit > 0 ? row.debit.toFixed(2) : '-';
        const creditStr = row.credit > 0 ? row.credit.toFixed(2) : '-';
        const balStr = row.runningBalance !== undefined ? (row.runningBalance < 0 ? `-${Math.abs(row.runningBalance).toFixed(2)}` : row.runningBalance.toFixed(2)) : '-';

        doc.fontSize(7.5).font('Helvetica').fillColor(primaryColor);
        doc.text(dateStr, cols[0].x, currentY + 5, { width: cols[0].width, align: 'left' });
        
        // Type with subtle badge styling or text
        doc.font('Helvetica-Bold').fillColor(
          row.type === 'bill' ? debitColor :
          row.type === 'payment' ? creditColor :
          row.type === 'advance_deposit' ? accentColor :
          row.type === 'advance_return' ? '#d97706' :
          row.type === 'refund' ? '#d97706' : primaryColor
        );
        doc.text(typeStr, cols[1].x, currentY + 5, { width: cols[1].width, align: 'left' });

        doc.font('Helvetica').fillColor(mutedColor);
        doc.text(refStr, cols[2].x, currentY + 5, { width: cols[2].width, align: 'left' });
        doc.fillColor(primaryColor);
        doc.text(descStr, cols[3].x, currentY + 5, { width: cols[3].width, align: 'left' });

        if (row.debit > 0) {
          doc.font('Helvetica-Bold').fillColor(debitColor);
        } else {
          doc.font('Helvetica').fillColor(mutedColor);
        }
        doc.text(debitStr, cols[4].x, currentY + 5, { width: cols[4].width, align: 'right' });

        if (row.credit > 0) {
          doc.font('Helvetica-Bold').fillColor(creditColor);
        } else {
          doc.font('Helvetica').fillColor(mutedColor);
        }
        doc.text(creditStr, cols[5].x, currentY + 5, { width: cols[5].width, align: 'right' });

        doc.font('Helvetica-Bold').fillColor(
          (row.runningBalance || 0) > 0 ? debitColor :
          (row.runningBalance || 0) < 0 ? creditColor : primaryColor
        );
        doc.text(balStr, cols[6].x, currentY + 5, { width: cols[6].width, align: 'right' });

        currentY += rowHeight;
      });

      // ── Totals / Statement Closing Row ────────────────────────────────────
      if (currentY + 50 > maxY) {
        doc.addPage();
        currentY = margin;
      }

      currentY += 4;
      doc.rect(margin, currentY, contentWidth, 22).fillAndStroke('#e2e8f0', borderColor);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryColor);
      doc.text('STATEMENT TOTALS', cols[0].x, currentY + 6, { width: 200, align: 'left' });

      doc.fillColor(debitColor).text(`Rs. ${(summary.totalDebits || 0).toFixed(2)}`, cols[4].x - 10, currentY + 6, { width: cols[4].width + 10, align: 'right' });
      doc.fillColor(creditColor).text(`Rs. ${(summary.totalCredits || 0).toFixed(2)}`, cols[5].x - 10, currentY + 6, { width: cols[5].width + 10, align: 'right' });
      
      const closeBal = summary.closingBalance || 0;
      doc.fillColor(closeBal > 0 ? debitColor : closeBal < 0 ? creditColor : primaryColor)
        .text(`Rs. ${closeBal < 0 ? '-' + Math.abs(closeBal).toFixed(2) : closeBal.toFixed(2)}`, cols[6].x - 10, currentY + 6, { width: cols[6].width + 10, align: 'right' });

      currentY += 30;

      // ── Additional Summaries (Loyalty & Promos) ───────────────────────────
      const loyaltySum = statement.loyaltySummary || {};
      const promoSum = statement.promoSummary || {};

      const hasLoyalty = loyaltySum.currentBalance !== undefined || loyaltySum.earnedInPeriod > 0 || loyaltySum.redeemedInPeriod > 0;
      const hasPromo = promoSum.totalDiscount > 0 || (promoSum.codesUsed && promoSum.codesUsed.length > 0);

      if (hasLoyalty || hasPromo) {
        if (currentY + 45 > maxY) {
          doc.addPage();
          currentY = margin;
        }

        const sumBoxW = (contentWidth - 10) / 2;
        
        // Loyalty Box
        if (hasLoyalty) {
          doc.rect(margin, currentY, sumBoxW, 36).fillAndStroke(bgLight, borderColor);
          doc.fillColor(accentColor).fontSize(7.5).font('Helvetica-Bold')
            .text('LOYALTY REWARDS SUMMARY', margin + 8, currentY + 5);
          doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica')
            .text(`Current Points: ${loyaltySum.currentBalance || 0} pts  |  Earned in Period: +${loyaltySum.earnedInPeriod || 0} pts  |  Redeemed: -${loyaltySum.redeemedInPeriod || 0} pts`, margin + 8, currentY + 18, { width: sumBoxW - 16 });
        }

        // Promo Box
        if (hasPromo) {
          const promoX = hasLoyalty ? margin + sumBoxW + 10 : margin;
          const promoW = hasLoyalty ? sumBoxW : contentWidth;
          doc.rect(promoX, currentY, promoW, 36).fillAndStroke(bgLight, borderColor);
          doc.fillColor('#8b5cf6').fontSize(7.5).font('Helvetica-Bold')
            .text('PROMOTIONS & DISCOUNTS', promoX + 8, currentY + 5);
          doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica')
            .text(`Total Promo Discounts: Rs. ${(promoSum.totalDiscount || 0).toFixed(2)}  |  Codes Used: ${(promoSum.codesUsed || []).join(', ') || 'None'}`, promoX + 8, currentY + 18, { width: promoW - 16 });
        }

        currentY += 44;
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
          .text(`This is a computer-generated account statement from ${business.shop_name || 'PrintPro'}.`, margin, pageHeight - margin - 8, { width: 300, align: 'left' });

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
  generateLedgerPdf,
};
