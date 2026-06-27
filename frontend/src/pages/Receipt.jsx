import React, { useState } from 'react'
import { jsPDF } from 'jspdf'
import { Printer, Download, X, Search as SearchIcon, FileText, Share2, MessageCircle } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { uploadPDFReceipt } from '../api/share'
import { formatWhatsAppReceipt } from '../utils/receiptFormatter'

const Receipt = () => {
  const { bills, customers, business, settings, showAlert, showToast } = useAppContext()
  const [selectedBill, setSelectedBill] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const getUpiLink = (amount) => {
    if (!business?.upiId || amount <= 0) return ''
    const params = new URLSearchParams({
      pa: business.upiId,
      pn: business.shopName || 'PrintPro',
      am: amount.toFixed(2),
      cu: 'INR',
      tn: `Receipt ${selectedBill?.id || ''}`,
    })
    return `upi://pay?${params.toString()}`
  }

  const buildShareText = (bill, pdfUrl = '') => {
    return formatWhatsAppReceipt(bill, settings, business, pdfUrl)
  }

  const handleWhatsApp = () => {
    if (!selectedBill) return
    const customer = customers.find(c => c.id === selectedBill.customerId)
    const phone = customer?.phone || ''
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const text = encodeURIComponent(buildShareText(selectedBill))
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank')
  }

  const handleWebShare = async () => {
    if (!selectedBill) return
    const text = buildShareText(selectedBill)
    if (navigator.share) {
      try {
        await navigator.share({ title: `Receipt ${selectedBill.id}`, text })
      } catch (_) {/* user cancelled */}
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text).then(() => showToast('Receipt text copied to clipboard!', 'success'))
    }
  }

  const filteredBills = bills
    .filter((b) => !b.deleted)
    .filter((b) =>
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const getQrCodeBase64 = (upiLink) => {
    return new Promise((resolve) => {
      if (!upiLink) {
        resolve('')
        return
      }
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiLink)}`
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        } catch (err) {
          console.error("Failed to convert QR code to base64", err)
          resolve('')
        }
      }
      img.onerror = () => {
        resolve('')
      }
    })
  }

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#0f172a')
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 15, g: 23, b: 42 }
  }

  // ── Programmatic PDF using jsPDF text/line API ────────────────────────────
  const createPDFDoc = async (bill) => {
    if (!bill) return null

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()  // 210 mm
    const H = doc.internal.pageSize.getHeight() // 297 mm
    const MARGIN = 10
    const FOOTER_H = 14 // reserve for footer
    const MAX_Y = H - MARGIN - FOOTER_H
    let y = 15
    let page = 1

    const rgb = hexToRgb(settings.primaryColor)

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
        doc.setDrawColor(rgb.r, rgb.g, rgb.b)
        ln(MARGIN, y, W - MARGIN, y, 0.4)
        y += 5
        doc.setFont('helvetica', 'normal')
        return true
      }
      return false
    }

    // Logo (if any)
    if (settings.logoUrl) {
      try {
        doc.addImage(settings.logoUrl, 'PNG', (W - 30) / 2, y, 30, 15)
        y += 18
      } catch (e) {
        console.error("Failed to add logo to PDF", e)
      }
    }

    // Header Shop Info
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(rgb.r, rgb.g, rgb.b)
    txt(business?.shopName || 'PrintPro', W / 2, y, { align: 'center' })
    y += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50, 50, 50)
    if (business?.address) { txt(business.address, W / 2, y, { align: 'center' }); y += 5 }
    if (business?.gstin) { txt(`GSTIN: ${business.gstin}`, W / 2, y, { align: 'center' }); y += 5 }
    if (business?.phone) { txt(`Phone: ${business.phone}`, W / 2, y, { align: 'center' }); y += 5 }

    // Custom Header Notes
    if (settings.headerNotes) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      txt(settings.headerNotes, W / 2, y, { align: 'center' })
      y += 5
    }

    y += 2
    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
    ln(MARGIN, y, W - MARGIN, y, 0.6)
    y += 6

    // Invoice label
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(rgb.r, rgb.g, rgb.b)
    txt('TAX INVOICE', W / 2, y, { align: 'center' })
    y += 7

    // Bill meta
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50, 50, 50)
    txt(`Bill ID: ${bill.id}`, MARGIN, y)
    txt(`Date: ${bill.date}`, W - MARGIN, y, { align: 'right' })
    y += 5
    txt(`Customer: ${bill.customerName}`, MARGIN, y)
    txt(`Due: ${bill.dueDate}`, W - MARGIN, y, { align: 'right' })
    y += 5
    txt(`Status: ${bill.status.toUpperCase()}`, MARGIN, y)
    y += 3

    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
    ln(MARGIN, y, W - MARGIN, y, 0.3)
    y += 6

    // Items table header
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
    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
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
    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
    ln(MARGIN, y, W - MARGIN, y, 0.4)
    y += 7

    // Totals
    const labelX = W - 65
    const valX = W - MARGIN

    checkNewPage(30)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    txt('Subtotal:', labelX, y); txt(`Rs.${bill.subtotal.toFixed(2)}`, valX, y, { align: 'right' }); y += 5

    if (settings.showGstBreakdown !== false && bill.gstAmount > 0) {
      txt('CGST:', labelX, y); txt(`Rs.${(bill.gstAmount / 2).toFixed(2)}`, valX, y, { align: 'right' }); y += 5
      txt('SGST:', labelX, y); txt(`Rs.${(bill.gstAmount / 2).toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    }

    if (bill.promoCode) {
      const promoD = bill.promoDiscount || bill.discountAmount || 0
      if (promoD > 0) {
        txt(`Promo Code (${bill.promoCode}):`, labelX, y); txt(`-Rs.${promoD.toFixed(2)}`, valX, y, { align: 'right' }); y += 5
      }
    } else if (Number(bill.discountAmount || bill.discountValue) > 0) {
      txt('Discount:', labelX, y); txt(`-Rs.${Number(bill.discountAmount || bill.discountValue).toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    }

    if (Number(bill.loyaltyPointsRedeemed) > 0) {
      const loyaltyDisc = bill.loyaltyDiscount || (bill.loyaltyPointsRedeemed * (settings.loyaltyRedeemRatioRupees || 5) / (settings.loyaltyRedeemRatioPoints || 150))
      txt(`Loyalty Discount (${bill.loyaltyPointsRedeemed} pts):`, labelX, y); txt(`-Rs.${loyaltyDisc.toFixed(2)}`, valX, y, { align: 'right' }); y += 5
    }

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(rgb.r, rgb.g, rgb.b)
    txt('Total:', labelX, y); txt(`Rs.${bill.total.toFixed(2)}`, valX, y, { align: 'right' }); y += 5

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50, 50, 50)
    txt('Amount Paid:', labelX, y); txt(`Rs.${bill.amountPaid.toFixed(2)}`, valX, y, { align: 'right' }); y += 5

    if (bill.balance > 0) {
      doc.setTextColor(239, 68, 68)
      txt('Balance Due:', labelX, y); txt(`Rs.${bill.balance.toFixed(2)}`, valX, y, { align: 'right' }); y += 5
      doc.setTextColor(50, 50, 50)
    }

    y += 3
    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
    ln(MARGIN, y, W - MARGIN, y, 0.3)
    y += 7

    // Loyalty points summary
    if (settings.loyaltyEnabled !== false && bill.customerType === 'regular') {
      checkNewPage(12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(rgb.r, rgb.g, rgb.b)
      txt(`Loyalty Points Added: +${bill.loyaltyPointsEarned || 0}`, MARGIN, y)
      txt(`Total Loyalty Balance: ${bill.customerTotalLoyaltyPoints || 0} pts`, W - MARGIN, y, { align: 'right' })
      y += 6
      doc.setTextColor(50, 50, 50)
      doc.setFont('helvetica', 'normal')
      ln(MARGIN, y, W - MARGIN, y, 0.3)
      y += 7
    }

    // Payment breakdown & QR code
    const upiLink = getUpiLink(bill.balance)
    const qrBase64 = (settings.showUpiQrCode !== false && bill.balance > 0) 
      ? await getQrCodeBase64(upiLink) 
      : ''

    if (qrBase64) {
      checkNewPage(35)
      const qrSize = 25
      doc.addImage(qrBase64, 'PNG', W - MARGIN - qrSize, y, qrSize, qrSize)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      txt('Scan QR to Pay Balance', W - MARGIN - qrSize + qrSize/2, y + qrSize + 3, { align: 'center' })
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      txt('Payment Breakdown:', MARGIN, y); y += 4
      doc.setFont('helvetica', 'normal')
      txt(`Cash: Rs.${(bill.paymentMethod?.cash || 0).toFixed(2)}`, MARGIN, y); y += 4
      txt(`UPI: Rs.${(bill.paymentMethod?.upi || 0).toFixed(2)}`, MARGIN, y); y += 4
      if (bill.advanceUsed > 0) {
        txt(`Advance Used: Rs.${bill.advanceUsed.toFixed(2)}`, MARGIN, y); y += 4
      }
      y = Math.max(y, y - 16 + qrSize + 6)
    } else {
      checkNewPage(18)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      txt('Payment Breakdown:', MARGIN, y); y += 5
      doc.setFont('helvetica', 'normal')
      txt(`Cash: Rs.${(bill.paymentMethod?.cash || 0).toFixed(2)}`, MARGIN, y)
      txt(`UPI: Rs.${(bill.paymentMethod?.upi || 0).toFixed(2)}`, 70, y)
      y += 5
      if (bill.advanceUsed > 0) {
        txt(`Advance Used: Rs.${bill.advanceUsed.toFixed(2)}`, 130, y - 5)
      }
      y += 5
    }

    // Custom Footer Notes
    if (settings.footerNotes) {
      checkNewPage(14)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(100, 100, 100)
      const splitFooterNotes = doc.splitTextToSize(settings.footerNotes, W - MARGIN * 2)
      doc.text(splitFooterNotes, MARGIN, y)
      y += splitFooterNotes.length * 4 + 4
      doc.setTextColor(0, 0, 0)
    }

    // Write footer to all pages
    const totalPages = page
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      addFooter(p, totalPages)
    }

    return doc
  }

  const generatePDF = async (bill) => {
    if (!bill) return
    const doc = await createPDFDoc(bill)
    if (doc) {
      doc.save(`Receipt-${bill.id}.pdf`)
    }
  }

  const handleSharePDF = async () => {
    if (!selectedBill) return
    const doc = await createPDFDoc(selectedBill)
    if (!doc) return
    
    try {
      const pdfBlob = doc.output('blob')
      const file = new File([pdfBlob], `Receipt-${selectedBill.id}.pdf`, { type: 'application/pdf' })
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Receipt ${selectedBill.id}`,
          text: `Here is the PDF receipt for Bill ${selectedBill.id} from ${business?.shopName || 'PrintPro'}.`,
        })
      } else {
        showToast('Uploading PDF receipt to share...', 'info')
        const uploadResult = await uploadPDFReceipt(pdfBlob, selectedBill.id)
        if (uploadResult && uploadResult.fileUrl) {
          showToast('Receipt PDF ready to share!', 'success')
          const customer = customers.find(c => c.id === selectedBill.customerId)
          const phone = customer?.phone || ''
          const cleanPhone = phone.replace(/[^0-9]/g, '')
          const text = encodeURIComponent(buildShareText(selectedBill, uploadResult.fileUrl))
          const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`
          window.open(url, '_blank')
        } else {
          throw new Error('No hosted URL returned')
        }
      }
    } catch (err) {
      console.error('Failed to share PDF:', err)
      // Fallback
      doc.save(`Receipt-${selectedBill.id}.pdf`)
      showAlert('Could not upload PDF receipt for direct sharing. The PDF has been downloaded instead.', 'warning')
    }
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
              <Printer size={16} /> Print
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleSharePDF}
              disabled={!selectedBill}
              style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
            >
              <Share2 size={16} /> Share PDF (WhatsApp/Email)
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleWhatsApp}
              disabled={!selectedBill}
              style={{ width: '100%', background: 'linear-gradient(135deg, #25d366, #128c7e)', border: 'none', color: '#fff' }}
            >
              <MessageCircle size={16} /> Share Text on WhatsApp
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleWebShare}
              disabled={!selectedBill}
              style={{ width: '100%' }}
            >
              <Share2 size={16} /> Share Text / Copy
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
          <div className="receipt-preview-header no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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
            {/* Logo */}
            {settings.logoUrl && (
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: '60px', maxWidth: '150px', objectFit: 'contain' }} />
              </div>
            )}
            
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: `2px solid ${settings.primaryColor || '#333'}` }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 'bold', color: settings.primaryColor || '#111' }}>
                {business?.shopName || 'PrintPro'}
              </h3>
              {business?.address && <p style={{ margin: '2px 0', fontSize: '11px', color: '#555' }}>{business.address}</p>}
              {business?.gstin && <p style={{ margin: '2px 0', fontSize: '11px', color: '#555' }}>GSTIN: {business.gstin}</p>}
              {business?.phone && <p style={{ margin: '2px 0', fontSize: '11px', color: '#555' }}>Phone: {business.phone}</p>}
              {settings.headerNotes && <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#666', fontStyle: 'italic' }}>{settings.headerNotes}</p>}
            </div>

            {/* Invoice title */}
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.06em', color: settings.primaryColor || '#111' }}>TAX INVOICE</span>
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

            <hr style={{ borderColor: settings.primaryColor || '#ccc', margin: '8px 0 12px' }} />

            {/* Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${settings.primaryColor || '#333'}` }}>
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

            <hr style={{ borderColor: settings.primaryColor || '#333', margin: '8px 0 10px' }} />

            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', fontSize: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                <span>Subtotal:</span><span>₹{selectedBill.subtotal.toFixed(2)}</span>
              </div>
              
              {settings.showGstBreakdown !== false && selectedBill.gstAmount > 0 && (
                <>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <span>CGST:</span><span>₹{(selectedBill.gstAmount / 2).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <span>SGST:</span><span>₹{(selectedBill.gstAmount / 2).toFixed(2)}</span>
                  </div>
                </>
              )}

              {selectedBill.promoCode ? (
                <div style={{ display: 'flex', gap: '24px' }}>
                  <span>Promo Code ({selectedBill.promoCode}):</span>
                  <span>-₹{(selectedBill.promoDiscount || selectedBill.discountAmount || 0).toFixed(2)}</span>
                </div>
              ) : Number(selectedBill.discountAmount || selectedBill.discountValue) > 0 ? (
                <div style={{ display: 'flex', gap: '24px' }}>
                  <span>Discount:</span><span>-₹{Number(selectedBill.discountAmount || selectedBill.discountValue).toFixed(2)}</span>
                </div>
              ) : null}

              {Number(selectedBill.loyaltyPointsRedeemed) > 0 && (
                <div style={{ display: 'flex', gap: '24px' }}>
                  <span>Loyalty Discount ({selectedBill.loyaltyPointsRedeemed} pts):</span>
                  <span>-₹{(selectedBill.loyaltyDiscount || (selectedBill.loyaltyPointsRedeemed * (settings.loyaltyRedeemRatioRupees || 5)) / (settings.loyaltyRedeemRatioPoints || 150)).toFixed(2)}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '24px', fontWeight: 'bold', fontSize: '13px', borderTop: '1px solid #ccc', paddingTop: '4px', marginTop: '2px', color: settings.primaryColor || '#111' }}>
                <span>Total:</span><span>₹{selectedBill.total.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                <span>Amount Paid:</span><span>₹{selectedBill.amountPaid.toFixed(2)}</span>
              </div>
              {selectedBill.balance > 0 && (
                <div style={{ display: 'flex', gap: '24px', color: '#d32f2f', fontWeight: 'bold' }}>
                  <span>Balance Due:</span><span>₹{selectedBill.balance.toFixed(2)}</span>
                </div>
              )}
            </div>

            <hr style={{ borderColor: '#ccc', margin: '8px 0 10px' }} />

            {/* Loyalty Summary */}
            {settings.loyaltyEnabled !== false && selectedBill.customerType === 'regular' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '11px', color: settings.primaryColor || '#111', fontWeight: 'bold' }}>
                  <span>Loyalty Points Earned: +{selectedBill.loyaltyPointsEarned || 0}</span>
                  <span>Total Points Balance: {selectedBill.customerTotalLoyaltyPoints || 0} pts</span>
                </div>
                <hr style={{ borderColor: '#ccc', margin: '6px 0 10px' }} />
              </>
            )}

            {/* Payment breakdown */}
            <div style={{ fontSize: '11px', marginBottom: '14px', color: '#555' }}>
              <strong style={{ color: '#333' }}>Payment Method: </strong>
              Cash ₹{(selectedBill.paymentMethod?.cash || 0).toFixed(2)} &nbsp;|&nbsp;
              UPI ₹{(selectedBill.paymentMethod?.upi || 0).toFixed(2)}
              {selectedBill.advanceUsed > 0 && ` | Advance Used ₹${selectedBill.advanceUsed.toFixed(2)}`}
            </div>

            {/* UPI QR Code */}
            {settings.showUpiQrCode !== false && selectedBill.balance > 0 && (
              <div style={{ textAlign: 'center', marginTop: '16px', marginBottom: '16px', borderTop: '1px dashed #eee', paddingTop: '12px' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 'bold' }}>Scan QR to Pay Balance</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(getUpiLink(selectedBill.balance))}`}
                  alt="UPI QR Code"
                  style={{ borderRadius: '6px', border: '2px solid #ddd', padding: '4px', background: '#fff' }}
                  width={120} height={120}
                />
              </div>
            )}

            {/* Custom Footer Notes */}
            {settings.footerNotes && (
              <div style={{ marginTop: '12px', marginBottom: '12px', fontSize: '10px', color: '#666', fontStyle: 'italic', borderTop: '1px dashed #eee', paddingTop: '8px', textAlign: 'center' }}>
                {settings.footerNotes}
              </div>
            )}

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
          .no-print, .receipt-preview-header, .sidebar, .header, .page-header, .grid-2, button, .btn {
            display: none !important;
          }
          .app-layout, .main-wrapper, .main-content {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }
          body {
            background: #fff;
            color: #000;
          }
          .receipt-print-area {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: avoid;
          }
          .receipt-print-area > div {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}

export default Receipt
