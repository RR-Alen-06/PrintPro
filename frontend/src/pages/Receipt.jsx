import React, { useState } from 'react'
import { jsPDF } from 'jspdf'
import { Printer, Download, X, Search as SearchIcon, FileText } from 'lucide-react'
import { useAppContext } from '../context/AppContext'

const Receipt = () => {
  const { bills, business } = useAppContext()
  const [selectedBill, setSelectedBill] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredBills = bills
    .filter((b) => !b.deleted)
    .filter((b) =>
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase())
    )

  // ── Programmatic PDF using jsPDF text/line API ────────────────────────────
  const generatePDF = (bill) => {
    if (!bill) return

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()  // 210 mm
    const H = doc.internal.pageSize.getHeight() // 297 mm
    const MARGIN = 10
    const FOOTER_H = 14 // reserve for footer
    const MAX_Y = H - MARGIN - FOOTER_H
    let y = 15
    let page = 1

    const ln = (x1, y1, x2, y2, width = 0.3) => {
      doc.setLineWidth(width)
      doc.line(x1, y1, x2, y2)
    }
    const txt = (str, x, yy, opts) => doc.text(String(str), x, yy, opts)

    const addFooter = (pageNum, totalPages) => {
      const fy = H - MARGIN
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text('Thank you for your business!', W / 2, fy - 4, { align: 'center' })
      doc.text(`Page ${pageNum} of ${totalPages}`, W / 2, fy, { align: 'center' })
      doc.setTextColor(0, 0, 0)
    }

    const checkNewPage = (neededSpace = 8) => {
      if (y + neededSpace > MAX_Y) {
        addFooter(page, '?') // placeholder, will be overwritten
        doc.addPage()
        page++
        y = 15
        // Reprint column headers for items table continuation
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        txt('(continued)', W / 2, y, { align: 'center' })
        y += 6
        txt('Item', col.item, y)
        txt('Type', col.type, y)
        txt('Sides', col.sides, y)
        txt('Qty', col.qty, y)
        txt('Unit Price', col.unit, y)
        txt('Amount', col.amt, y)
        y += 2
        ln(MARGIN, y, W - MARGIN, y, 0.4)
        y += 5
        doc.setFont('helvetica', 'normal')
        return true
      }
      return false
    }

    // ── Header (page 1 only) ─────────────────────────────────────────────────
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    txt(business?.shopName || 'PrintPro', W / 2, y, { align: 'center' })
    y += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    if (business?.address) { txt(business.address, W / 2, y, { align: 'center' }); y += 5 }
    if (business?.gstin) { txt(`GSTIN: ${business.gstin}`, W / 2, y, { align: 'center' }); y += 5 }
    if (business?.phone) { txt(`Phone: ${business.phone}`, W / 2, y, { align: 'center' }); y += 5 }

    y += 2
    ln(MARGIN, y, W - MARGIN, y, 0.6)
    y += 6

    // ── Invoice label ────────────────────────────────────────────────────────
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    txt('TAX INVOICE', W / 2, y, { align: 'center' })
    y += 7

    // ── Bill meta ────────────────────────────────────────────────────────────
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    txt(`Bill ID: ${bill.id}`, MARGIN, y)
    txt(`Date: ${bill.date}`, W - MARGIN, y, { align: 'right' })
    y += 5
    txt(`Customer: ${bill.customerName}`, MARGIN, y)
    txt(`Due: ${bill.dueDate}`, W - MARGIN, y, { align: 'right' })
    y += 5
    txt(`Status: ${bill.status.toUpperCase()}`, MARGIN, y)
    y += 3

    ln(MARGIN, y, W - MARGIN, y, 0.3)
    y += 6

    // ── Items table ──────────────────────────────────────────────────────────
    const col = { item: MARGIN, type: 78, sides: 100, qty: 122, unit: 142, amt: 168 }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    txt('Item', col.item, y)
    txt('Type', col.type, y)
    txt('Sides', col.sides, y)
    txt('Qty', col.qty, y)
    txt('Unit Price', col.unit, y)
    txt('Amount', col.amt, y)
    y += 2
    ln(MARGIN, y, W - MARGIN, y, 0.4)
    y += 5

    doc.setFont('helvetica', 'normal')
    bill.items.forEach((item) => {
      checkNewPage(8)
      const name = item.itemName || item.name || '-'
      const shortName = name.length > 28 ? name.slice(0, 26) + '…' : name
      txt(shortName, col.item, y)
      txt(item.printType === 'color' ? 'Color' : 'B/W', col.type, y)
      txt(item.sides === 'single' ? 'Single' : 'Double', col.sides, y)
      txt(String(item.qty), col.qty, y)
      txt(`Rs.${Number(item.unitPrice).toFixed(2)}`, col.unit, y)
      txt(`Rs.${Number(item.amount).toFixed(2)}`, col.amt, y)
      y += 6
    })

    checkNewPage(10)
    y += 2
    ln(MARGIN, y, W - MARGIN, y, 0.4)
    y += 7

    // ── Totals ───────────────────────────────────────────────────────────────
    const labelX = W - 65
    const valX = W - MARGIN

    checkNewPage(30)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    txt('Subtotal:', labelX, y); txt(`Rs.${bill.subtotal.toFixed(2)}`, valX, y, { align: 'right' }); y += 5

    if (Number(bill.discountValue) > 0) {
      txt('Discount:', labelX, y); txt(`-Rs.${Number(bill.discountValue).toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    }

    doc.setFont('helvetica', 'bold')
    txt('Total:', labelX, y); txt(`Rs.${bill.total.toFixed(2)}`, valX, y, { align: 'right' }); y += 5

    doc.setFont('helvetica', 'normal')
    txt('Amount Paid:', labelX, y); txt(`Rs.${bill.amountPaid.toFixed(2)}`, valX, y, { align: 'right' }); y += 5

    if (bill.balance > 0) {
      txt('Balance Due:', labelX, y); txt(`Rs.${bill.balance.toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    }

    y += 3
    ln(MARGIN, y, W - MARGIN, y, 0.3)
    y += 7

    // ── Payment breakdown ────────────────────────────────────────────────────
    checkNewPage(14)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    txt('Payment Breakdown:', MARGIN, y); y += 5
    doc.setFont('helvetica', 'normal')
    txt(`Cash: Rs.${(bill.paymentMethod?.cash || 0).toFixed(2)}`, MARGIN, y)
    txt(`UPI: Rs.${(bill.paymentMethod?.upi || 0).toFixed(2)}`, 70, y)
    y += 10

    // ── Add footer to all pages ───────────────────────────────────────────────
    const totalPages = page
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      addFooter(p, totalPages)
    }

    doc.save(`Receipt-${bill.id}.pdf`)
  }

  const handlePrint = () => {
    if (!selectedBill) return
    window.print()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Print Receipt</h1>
          <p>Generate and download receipts for your bills.</p>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* Bill Selection */}
        <div className="card">
          <h2>Select Bill</h2>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <div className="search-input-wrapper">
              <SearchIcon size={16} />
              <input
                className="form-input"
                type="text"
                placeholder="Search by bill ID or customer name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '38px' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '12px', maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredBills.length === 0 ? (
              <p className="text-muted" style={{ padding: '16px 0' }}>No bills found.</p>
            ) : (
              filteredBills.map((bill) => (
                <button
                  key={bill.id}
                  className={`btn ${selectedBill?.id === bill.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedBill(bill)}
                  style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '10px 14px' }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{bill.id}</div>
                    <div style={{ fontSize: '12px', opacity: 0.75 }}>
                      {bill.customerName} · ₹{bill.total.toFixed(2)} ·{' '}
                      <span style={{ textTransform: 'capitalize' }}>{bill.status}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="card">
          <h2>Actions</h2>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={() => generatePDF(selectedBill)}
              disabled={!selectedBill}
              style={{ width: '100%' }}
            >
              <Download size={16} /> Download PDF
            </button>
            <button
              className="btn btn-secondary"
              onClick={handlePrint}
              disabled={!selectedBill}
              style={{ width: '100%' }}
            >
              <Printer size={16} /> Print Preview
            </button>
            {selectedBill && (
              <button
                className="btn btn-ghost"
                onClick={() => setSelectedBill(null)}
                style={{ width: '100%' }}
              >
                <X size={16} /> Clear Selection
              </button>
            )}
          </div>

          <div style={{ marginTop: '24px', padding: '14px 16px', background: 'var(--info-bg)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--info)' }}>PDF Tips</strong>
            <ul style={{ marginTop: '8px', paddingLeft: '16px', lineHeight: '1.8' }}>
              <li>PDF is A4 portrait with professional header &amp; item table.</li>
              <li>Use "Download PDF" to save a file directly.</li>
              <li>Use "Print Preview" to print via the browser dialog.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Receipt Preview */}
      {selectedBill && (
        <div className="card receipt-print-area" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2>Receipt Preview</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => generatePDF(selectedBill)}>
              <Download size={14} /> Download PDF
            </button>
          </div>

          {/* Visual preview matching the PDF layout */}
          <div style={{
            maxWidth: '540px', margin: '0 auto',
            padding: '28px 32px',
            background: '#fff', color: '#111',
            fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: '1.6',
            border: '1px solid #ddd', borderRadius: '4px',
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '2px solid #333' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 'bold' }}>
                {business?.shopName || 'PrintPro'}
              </h3>
              {business?.address && <p style={{ margin: '2px 0', fontSize: '11px', color: '#555' }}>{business.address}</p>}
              {business?.gstin && <p style={{ margin: '2px 0', fontSize: '11px', color: '#555' }}>GSTIN: {business.gstin}</p>}
              {business?.phone && <p style={{ margin: '2px 0', fontSize: '11px', color: '#555' }}>Phone: {business.phone}</p>}
            </div>

            {/* Invoice title */}
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.06em' }}>TAX INVOICE</span>
            </div>

            {/* Bill meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
              <span><strong>Bill ID:</strong> {selectedBill.id}</span>
              <span><strong>Date:</strong> {selectedBill.date}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
              <span><strong>Customer:</strong> {selectedBill.customerName}</span>
              <span><strong>Due:</strong> {selectedBill.dueDate}</span>
            </div>
            <div style={{ marginBottom: '12px', fontSize: '12px' }}>
              <strong>Status:</strong> {selectedBill.status.toUpperCase()}
            </div>

            <hr style={{ borderColor: '#ccc', margin: '8px 0 12px' }} />

            {/* Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '4px 4px' }}>Type</th>
                  <th style={{ textAlign: 'center', padding: '4px 4px' }}>Sides</th>
                  <th style={{ textAlign: 'center', padding: '4px 4px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '4px 4px' }}>Unit</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedBill.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '4px 0' }}>{item.itemName || item.name}</td>
                    <td style={{ textAlign: 'center', padding: '4px 4px' }}>{item.printType === 'color' ? 'Color' : 'B/W'}</td>
                    <td style={{ textAlign: 'center', padding: '4px 4px' }}>{item.sides === 'single' ? 'Single' : 'Double'}</td>
                    <td style={{ textAlign: 'center', padding: '4px 4px' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>₹{Number(item.unitPrice).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <hr style={{ borderColor: '#333', margin: '8px 0 10px' }} />

            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', fontSize: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                <span>Subtotal:</span><span>₹{selectedBill.subtotal.toFixed(2)}</span>
              </div>
              {Number(selectedBill.discountValue) > 0 && (
                <div style={{ display: 'flex', gap: '24px' }}>
                  <span>Discount:</span><span>-₹{Number(selectedBill.discountValue).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '24px', fontWeight: 'bold', fontSize: '13px', borderTop: '1px solid #ccc', paddingTop: '4px', marginTop: '2px' }}>
                <span>Total:</span><span>₹{selectedBill.total.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                <span>Amount Paid:</span><span>₹{selectedBill.amountPaid.toFixed(2)}</span>
              </div>
              {selectedBill.balance > 0 && (
                <div style={{ display: 'flex', gap: '24px', color: '#d32f2f' }}>
                  <span>Balance Due:</span><span>₹{selectedBill.balance.toFixed(2)}</span>
                </div>
              )}
            </div>

            <hr style={{ borderColor: '#ccc', margin: '8px 0 10px' }} />

            {/* Payment breakdown */}
            <div style={{ fontSize: '11px', marginBottom: '14px', color: '#555' }}>
              <strong style={{ color: '#333' }}>Payment Method: </strong>
              Cash ₹{(selectedBill.paymentMethod?.cash || 0).toFixed(2)} &nbsp;|&nbsp;
              UPI ₹{(selectedBill.paymentMethod?.upi || 0).toFixed(2)}
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', paddingTop: '10px', borderTop: '1px solid #ccc', fontSize: '11px', color: '#555' }}>
              <p style={{ margin: 0, fontStyle: 'italic' }}>Thank you for your business!</p>
              <p style={{ margin: '4px 0 0', fontSize: '10px' }}>Page 1 of 1</p>
            </div>
          </div>
        </div>
      )}

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print-area, .receipt-print-area * { visibility: visible; }
          .receipt-print-area {
            position: fixed; top: 0; left: 0;
            margin: 0; border: none !important; box-shadow: none !important;
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  )
}

export default Receipt
