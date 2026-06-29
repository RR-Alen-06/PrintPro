import React, { useState, useMemo } from 'react'
import { Download, Wallet, ChevronDown, CheckCircle, Share2, Copy, Link2, AlertCircle, ArrowLeftRight } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { jsPDF } from 'jspdf'
import { uploadPDFReceipt } from '../api/share'
import EmptyState from '../components/common/EmptyState'
import { LedgerService } from '../utils/financialServices'

const LEDGER_PERIODS = ['all', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']

const getLedgerPeriodRange = (period) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'daily') return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
  if (period === 'weekly') {
    const day = today.getDay()
    const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { start: mon, end: sun }
  }
  if (period === 'monthly') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) }
  }
  if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3)
    return { start: new Date(now.getFullYear(), q * 3, 1), end: new Date(now.getFullYear(), q * 3 + 3, 0) }
  }
  if (period === 'yearly') {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) }
  }
  return null
}

const CustomerLedger = () => {
  const { business, customers, settings, bills, payments, advancePayments, recordPayment, showToast } = useAppContext()

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers])

  const getUpiLink = (amount, notesText = 'Ledger Payment') => {
    if (!business?.upiId || amount <= 0) return ''
    const params = new URLSearchParams({
      pa: business.upiId,
      pn: business.shopName || 'PrintPro',
      am: amount.toFixed(2),
      cu: 'INR',
      tn: notesText,
    })
    return `upi://pay?${params.toString()}`
  }

  const [selectedCustomerId, setSelectedCustomerId] = useState(activeCustomers[0]?.id || '')
  const [ledgerPeriod, setLedgerPeriod] = useState('all')
  
  const [payCash, setPayCash] = useState(0)
  const [payUpi, setPayUpi] = useState(0)
  const [returnChange, setReturnChange] = useState(false)
  const [paySuccess, setPaySuccess] = useState(false)
  const [upiCheckoutAmount, setUpiCheckoutAmount] = useState(0)

  const copyUpiLink = (link) => {
    if (!link) return
    navigator.clipboard.writeText(link)
  }

  const selectedCustomer = useMemo(
    () => activeCustomers.find((c) => c.id === selectedCustomerId),
    [activeCustomers, selectedCustomerId]
  )

  const customerBills = useMemo(
    () => bills.filter((b) => b.customerId === selectedCustomerId && !b.deleted),
    [bills, selectedCustomerId]
  )

  const customerPayments = useMemo(
    () => payments.filter((p) => p.customerId === selectedCustomerId && !p.notes?.includes('advance deposit')),
    [payments, selectedCustomerId]
  )

  const customerAdvances = useMemo(
    () => (advancePayments || []).filter((a) => a.customerId === selectedCustomerId),
    [advancePayments, selectedCustomerId]
  )

  const customerSettlements = useMemo(() => {
    return payments.filter(p => {
      if (!p.isGroupPayment) return false
      if (p.customerId === selectedCustomerId) return true
      return (p.groupSettlements || []).some(s => s.customerId === selectedCustomerId)
    })
  }, [payments, selectedCustomerId])

  // Build full ledger timeline with period filter
  // Build full ledger timeline with period filter
  // Build full ledger timeline with period filter using LedgerService
  const ledgerEntries = useMemo(() => {
    const res = LedgerService.calculateLedger({
      customerId: selectedCustomerId,
      bills,
      payments,
      advancePayments,
      period: ledgerPeriod,
      settings
    })
    return res.entries
  }, [bills, payments, advancePayments, selectedCustomerId, ledgerPeriod, settings])

  const handleApplyPayment = () => {
    const cash = Number(payCash || 0)
    const upi = Number(payUpi || 0)
    if (cash + upi <= 0 || !selectedCustomer) return

    recordPayment({
      customerId: selectedCustomer.id,
      cashAmount: cash,
      upiAmount: upi,
      notes: `Payment from ledger page`,
      returnChangeUpi: returnChange ? Math.max(0, (cash + upi) - outstanding) : 0
    })

    setPayCash(0)
    setPayUpi(0)
    setReturnChange(false)
    setPaySuccess(true)
    setTimeout(() => setPaySuccess(false), 3500)
  }

  const totalBilled = customerBills.reduce((s, b) => s + Number(b.total || 0), 0)
  // Separate gross payments and refund payments for clear display
  const nonRefundPayments = customerPayments.filter(p => !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0)
  const refundPaymentsList = customerPayments.filter(p => p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0)
  const totalGrossPaid = nonRefundPayments.reduce((s, p) => s + Number(p.totalPaid || 0) + Number(p.excessCredit || 0), 0)
  const totalRefunded = refundPaymentsList.reduce((s, p) => s + Math.abs(Number(p.totalPaid || 0)), 0)
  const totalPaid = totalGrossPaid - totalRefunded // net paid after refunds
  const totalAdvanceIn = useMemo(() => customerAdvances.filter(a => (a.amount > 0 || !a.isReturn) && !a.isRefundCredit).reduce((s, a) => s + Number(a.amount || 0), 0), [customerAdvances])
  const totalAdvanceReturned = useMemo(() => customerAdvances.filter(a => a.amount < 0 || a.isReturn).reduce((s, a) => s + Math.abs(Number(a.amount || 0)), 0), [customerAdvances])
  const totalAdvanceUsed = customerBills.reduce((s, b) => s + Number(b.advanceUsed || 0), 0)
  const totalDiscount = customerBills.reduce((s, b) => s + Number(b.discountValue || 0), 0)
  const totalGstBilled = customerBills.reduce((s, b) => s + Number(b.gstAmount || 0), 0)
  const outstanding = customerBills.reduce((s, b) => s + Number(b.balance || 0), 0)
  const finalBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : 0
  const totalDebits = useMemo(() => ledgerEntries.reduce((s, e) => s + (e.debit || 0), 0), [ledgerEntries])
  const totalCredits = useMemo(() => ledgerEntries.reduce((s, e) => s + (e.credit || 0) + (e.advanceIn || 0), 0), [ledgerEntries])
  const periodAdvanceReturned = useMemo(() => ledgerEntries.reduce((s, e) => s + (e.advanceReturn || 0), 0), [ledgerEntries])
  const totalGroupSettled = useMemo(() => ledgerEntries.filter(e => e.type === 'group_settlement').reduce((s, e) => s + (e.credit || 0), 0), [ledgerEntries])

  // Loyalty points summary
  const totalLoyaltyEarned = useMemo(
    () => customerBills.filter(b => b.status === 'paid').reduce((s, b) => s + (b.loyaltyPointsEarned || 0), 0),
    [customerBills]
  )
  const totalLoyaltyRedeemed = useMemo(
    () => customerBills.reduce((s, b) => s + (b.loyaltyPointsRedeemed || 0), 0),
    [customerBills]
  )
  const loyaltyBalance = selectedCustomer?.loyaltyPoints || 0

  // CSV download with UTF-8 BOM for Excel compatibility
  const downloadStatement = () => {
    const date = new Date()
    const escCell = (v) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('₹')) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const rows = [
      [`Customer Ledger Statement - ${selectedCustomer?.name}`, '', '', '', '', ''],
      [`Customer ID:`, selectedCustomer?.id || '', '', '', '', ''],
      [`Generated:`, date.toLocaleString(), '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Date', 'Type', 'Description', 'Debit (Rs)', 'Credit (Rs)', 'Balance (Rs)'],
      ...ledgerEntries.map((e) => [
        e.date ? e.date.slice(0, 10) : '',
        e.type === 'bill' ? 'Invoice' : e.type === 'advance' ? 'Advance Deposit' : e.type === 'advance_return' ? 'Advance Return' : e.type === 'refund' ? 'Refund' : 'Payment',
        e.description,
        e.debit > 0 ? e.debit.toFixed(2) : '',
        e.credit > 0 ? e.credit.toFixed(2) : (e.advanceIn > 0 ? e.advanceIn.toFixed(2) : (e.advanceReturn > 0 ? `-${e.advanceReturn.toFixed(2)}` : '')),
        e.balance.toFixed(2),
      ]),
      ['', '', '', '', '', ''],
      ['', '', 'TOTAL DEBITS', totalDebits.toFixed(2), '', ''],
      ['', '', 'TOTAL CREDITS', '', totalCredits.toFixed(2), ''],
      ['', '', 'TOTAL ADVANCE RETURNS', '', `-${periodAdvanceReturned.toFixed(2)}`, ''],
      ['', '', 'FINAL BALANCE', '', '', finalBalance.toFixed(2)],
    ]
    const BOM = '\uFEFF'
    const csv = rows.map((r) => r.map(escCell).join(',')).join('\n')
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${selectedCustomer?.name}-ledger-${date.toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // PDF document generator
  const generateLedgerPDFDoc = () => {
    if (!selectedCustomer) return null
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const MARGIN = 12
    const FOOTER_H = 12
    const MAX_Y = H - MARGIN - FOOTER_H
    let y = 16
    let page = 1

    const addFooter = (p) => {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(150)
      doc.text(`Page ${p}`, W / 2, H - 6, { align: 'center' })
      doc.setTextColor(0)
    }

    const checkPage = (need = 7) => {
      if (y + need > MAX_Y) {
        addFooter(page)
        doc.addPage()
        page++
        y = 16
      }
    }

    // Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Customer Ledger Statement', W / 2, y, { align: 'center' })
    y += 7
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Customer: ${selectedCustomer.name} (${selectedCustomer.id})`, MARGIN, y)
    doc.text(`Generated: ${new Date().toLocaleString()}`, W - MARGIN, y, { align: 'right' })
    y += 5
    doc.setLineWidth(0.4)
    doc.line(MARGIN, y, W - MARGIN, y)
    y += 6

    // Summary row
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    const sumItems = [
      ['Total Debits', `Rs.${totalDebits.toFixed(2)}`],
      ['Total Credits', `Rs.${totalCredits.toFixed(2)}`],
      ['Adv Returned', `Rs.${periodAdvanceReturned.toFixed(2)}`],
      ['Final Balance', `Rs.${finalBalance.toFixed(2)}`],
    ]
    const colW = (W - MARGIN * 2) / sumItems.length
    sumItems.forEach(([label, val], i) => {
      const x = MARGIN + i * colW
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120)
      doc.text(label, x, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0)
      doc.text(val, x, y + 5)
    })
    y += 12
    doc.line(MARGIN, y, W - MARGIN, y)
    y += 6

    // Table header
    const cols = { date: MARGIN, type: MARGIN + 22, desc: MARGIN + 40, debit: MARGIN + 115, credit: MARGIN + 140, bal: MARGIN + 165 }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100)
    doc.text('Date', cols.date, y)
    doc.text('Type', cols.type, y)
    doc.text('Description', cols.desc, y)
    doc.text('Debit', cols.debit, y)
    doc.text('Credit', cols.credit, y)
    doc.text('Balance', cols.bal, y)
    doc.setTextColor(0)
    y += 2
    doc.line(MARGIN, y, W - MARGIN, y)
    y += 5

    // Rows
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    ledgerEntries.forEach((entry) => {
      checkPage(7)
      const typeLabel = entry.type === 'bill' ? 'Invoice' : entry.type === 'advance' ? 'Advance' : entry.type === 'advance_return' ? 'Adv Return' : entry.type === 'refund' ? 'Refund' : 'Payment'
      const debitStr = entry.debit > 0 ? `Rs.${entry.debit.toFixed(2)}` : '-'
      const creditStr = entry.credit > 0 ? `Rs.${entry.credit.toFixed(2)}` : entry.advanceIn > 0 ? `Rs.${entry.advanceIn.toFixed(2)}` : entry.advanceReturn > 0 ? `-Rs.${entry.advanceReturn.toFixed(2)}` : '-'
      const balStr = entry.balance < 0 ? `-Rs.${Math.abs(entry.balance).toFixed(2)}` : `Rs.${entry.balance.toFixed(2)}`
      doc.text(new Date(entry.date).toLocaleDateString(), cols.date, y)
      doc.text(typeLabel, cols.type, y)
      
      let entryDesc = entry.description
      if (settings.loyaltyEnabled !== false) {
        if (entry.loyaltyPointsEarned > 0) {
          entryDesc += ` (+${entry.loyaltyPointsEarned} pts)`
        }
        if (entry.loyaltyPointsRedeemed > 0) {
          entryDesc += ` (-${entry.loyaltyPointsRedeemed} pts)`
        }
      }
      const shortDesc = entryDesc.length > 30 ? entryDesc.slice(0, 28) + '…' : entryDesc
      doc.text(shortDesc, cols.desc, y)
      doc.setTextColor(entry.debit > 0 ? 239 : 0, entry.debit > 0 ? 68 : 0, entry.debit > 0 ? 68 : 0)
      doc.text(debitStr, cols.debit, y)
      doc.setTextColor((entry.credit > 0 || entry.advanceIn > 0) ? 16 : entry.advanceReturn > 0 ? 245 : 0, (entry.credit > 0 || entry.advanceIn > 0) ? 185 : entry.advanceReturn > 0 ? 158 : 0, (entry.credit > 0 || entry.advanceIn > 0) ? 129 : entry.advanceReturn > 0 ? 11 : 0)
      doc.text(creditStr, cols.credit, y)
      if (entry.balance >= 0) {
        doc.setTextColor(16, 185, 129)
      } else {
        doc.setTextColor(239, 68, 68)
      }
      doc.text(balStr, cols.bal, y)
      doc.setTextColor(0)
      y += 6
    })

    addFooter(page)
    return doc
  }

  // PDF download
  const downloadPDF = () => {
    const doc = generateLedgerPDFDoc()
    if (doc && selectedCustomer) {
      doc.save(`${selectedCustomer.name}-ledger-${new Date().toISOString().slice(0, 10)}.pdf`)
    }
  }

  const shareStatementWhatsApp = async () => {
    if (!selectedCustomer) return
    const phone = selectedCustomer.phone || ''
    const dateStr = new Date().toLocaleDateString()

    showToast('Generating and uploading ledger PDF statement...', 'info')
    let pdfUrl = ''
    try {
      const doc = generateLedgerPDFDoc()
      if (doc) {
        const pdfBlob = doc.output('blob')
        // Clean customer name for filename
        const cleanName = selectedCustomer.name.replace(/[^a-zA-Z0-9_-]/g, '')
        const uploadResult = await uploadPDFReceipt(pdfBlob, `ledger-${cleanName}`)
        if (uploadResult && uploadResult.fileUrl) {
          pdfUrl = uploadResult.fileUrl
          showToast('Ledger statement PDF ready to share!', 'success')
        }
      }
    } catch (err) {
      console.error('Failed to upload ledger PDF for WhatsApp share:', err)
      showToast('Sharing statement details without PDF link due to upload issue.', 'warning')
    }
    
    const pdfUrlLine = pdfUrl ? `*Download Ledger PDF:* ${pdfUrl}%0A` : ''

    const text = `*Ledger Statement for ${selectedCustomer.name} (${selectedCustomer.id})*%0A` +
      `*Generated on:* ${dateStr}%0A` +
      `------------------------%0A` +
      `*Total Billed (Debits):* ₹${totalDebits.toFixed(2)}%0A` +
      `*Total Paid (Credits):* ₹${totalCredits.toFixed(2)}%0A` +
      `*Final Balance:* *₹${finalBalance.toFixed(2)}*%0A` +
      `*Advance Deposited:* ₹${totalAdvanceIn.toFixed(2)}%0A` +
      `*Advance Returned:* ₹${totalAdvanceReturned.toFixed(2)}%0A` +
      `*Advance Used:* ₹${totalAdvanceUsed.toFixed(2)}%0A` +
      `*Outstanding Balance:* *₹${outstanding.toFixed(2)}*%0A` +
      `------------------------%0A` +
      pdfUrlLine +
      `Thank you! - ${business?.shopName || 'PrintPro'}`

    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`
    window.open(url, '_blank')
  }

  const typeColor = (type) => {
    if (type === 'bill') return 'var(--error)'
    if (type === 'advance') return 'var(--info)'
    if (type === 'advance_return') return 'var(--warning)'
    if (type === 'opening_balance') return 'var(--text-secondary)'
    if (type === 'refund') return 'var(--warning)'
    if (type === 'group_settlement') return '#818cf8'
    if (type === 'group_payment_behalf') return 'var(--error)'
    return 'var(--success)'
  }
  const typeLabel = (type) => {
    if (type === 'bill') return 'Invoice'
    if (type === 'advance') return 'Advance Deposit'
    if (type === 'advance_return') return 'Advance Return'
    if (type === 'opening_balance') return 'Opening'
    if (type === 'refund') return 'Refund'
    if (type === 'group_settlement') return 'Settled Group'
    if (type === 'group_payment') return 'Group Payment'
    if (type === 'group_payment_behalf') return 'Paid Behalf'
    return 'Payment'
  }

  return (
    <div>
      <div className="page-header">
        <h1>Customer Ledger</h1>
        <p>Complete transaction history including bills, payments, and advance deposits.</p>
      </div>

      <div className="ledger-layout-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Left Control Panel: Selector, Details, and Payment Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Customer Selector */}
          <div className="card" style={{ width: '100%' }}>
            <h2 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 700 }}>Select Customer</h2>
            <select
              className="form-select"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              style={{ marginBottom: '12px' }}
            >
              <optgroup label="Regular Customers">
                {activeCustomers.filter((c) => c.type === 'regular').map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                ))}
              </optgroup>
              <optgroup label="Walk-in Customers">
                {activeCustomers.filter((c) => c.type === 'random').map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                ))}
              </optgroup>
            </select>

            {selectedCustomer && (
              <div style={{ marginTop: '8px', padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.875rem' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">ID</span>
                    <strong style={{ fontFamily: 'monospace' }}>{selectedCustomer.id}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Type</span>
                    <span className={`badge ${selectedCustomer.type === 'regular' ? 'badge-info' : 'badge-warning'}`}>
                      {selectedCustomer.type === 'regular' ? 'Regular' : 'Walk-in'}
                    </span>
                  </div>
                  {selectedCustomer.phone && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Phone</span>
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {Number(selectedCustomer.advanceBalance || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--info)' }}>
                        <Wallet size={13} /> Advance Balance
                      </span>
                      <strong style={{ color: 'var(--info)' }}>₹{Number(selectedCustomer.advanceBalance).toFixed(2)}</strong>
                    </div>
                  )}
                  {settings.loyaltyEnabled !== false && (
                    <div style={{ paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🎁 Loyalty Points Summary
                      </div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(16,185,129,0.08)', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Earned</span>
                          <strong style={{ color: '#10b981', fontSize: '0.875rem' }}>+{totalLoyaltyEarned} pts</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Redeemed</span>
                          <strong style={{ color: '#f59e0b', fontSize: '0.875rem' }}>-{totalLoyaltyRedeemed} pts</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(99,102,241,0.10)', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.2)' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Current Balance</span>
                          <strong style={{ color: 'var(--accent)', fontSize: '1rem' }}>{loyaltyBalance} pts</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Statement Summaries Card */}
          <div className="card">
            <h2 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 700 }}>Ledger Summary</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                { label: 'Total Billed', value: totalBilled, color: 'var(--error)' },
                { label: 'Gross Paid (Before Refunds)', value: totalGrossPaid, color: 'var(--success)' },
                { label: 'Total Refunded', value: totalRefunded, color: 'var(--warning)' },
                { label: 'Group Bills Settled', value: totalGroupSettled, color: 'var(--info)' },
                { label: 'Net Paid (After Refunds)', value: totalPaid, color: 'var(--info)' },
                { label: 'Total Ledger Balance', value: finalBalance, color: finalBalance < 0 ? 'var(--error)' : 'var(--success)' },
                { label: 'Unpaid Bills Only (Without Advances)', value: outstanding, color: 'var(--error)' },
                { label: 'Total GST Charged', value: totalGstBilled, color: '#818cf8' },
                { label: 'Total Discounts Given', value: totalDiscount, color: 'var(--accent)' },
                { label: 'Advance Deposited', value: totalAdvanceIn, color: 'var(--info)' },
                { label: 'Advance/Change Returned', value: periodAdvanceReturned, color: 'var(--warning)' },
                { label: 'Advance Used in Bills', value: totalAdvanceUsed, color: 'var(--info)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</span>
                  <strong style={{ color }}>{value < 0 ? '-' : ''}₹{Math.abs(value).toFixed(2)}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={downloadStatement} style={{ flex: 1 }}>
                <Download size={16} /> CSV
              </button>
              <button className="btn btn-primary" onClick={downloadPDF} style={{ flex: 1 }}>
                <Download size={16} /> PDF
              </button>
            </div>
            <button
              className="btn btn-secondary"
              onClick={shareStatementWhatsApp}
              style={{ width: '100%', marginTop: '8px', color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Share2 size={16} /> Share via WhatsApp
            </button>
          </div>

          {/* Record Payment Form */}
          {selectedCustomer && (
            <div className="card" style={{ width: '100%' }}>
              <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', fontWeight: 600 }}>Record Payment</h3>
              {outstanding > 0 ? (
                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                  FIFO billing logic. Outstanding: <strong style={{ color: 'var(--warning)' }}>₹{outstanding.toFixed(2)}</strong>
                </p>
              ) : (
                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                  No outstanding balance. Added to advance credit.
                </p>
              )}

              {paySuccess && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', marginBottom: '12px',
                  background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
                }}>
                  <CheckCircle size={16} /> Payment recorded successfully!
                </div>
              )}

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Cash (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={payCash}
                    onChange={(e) => setPayCash(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>UPI (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={payUpi}
                    onChange={(e) => {
                      setPayUpi(e.target.value)
                      setUpiCheckoutAmount(0)
                    }}
                  />
                </div>
              </div>

              {(Number(payCash || 0) + Number(payUpi || 0) > outstanding) && outstanding > 0 && (
                <div style={{ marginTop: '10px', background: 'rgba(245,158,11,0.1)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#f59e0b', marginBottom: '6px', fontWeight: 600 }}>
                    Change Due: ₹{((Number(payCash || 0) + Number(payUpi || 0)) - outstanding).toFixed(2)}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <input 
                      type="checkbox" 
                      checked={returnChange}
                      onChange={(e) => setReturnChange(e.target.checked)}
                    />
                    Return change immediately (via UPI) to prevent it from becoming Advance Credit.
                  </label>
                </div>
              )}

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>UPI QR Checkout</label>
                <div className="form-inline" style={{ gap: '12px', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setUpiCheckoutAmount(Number(payUpi || 0))} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Link2 size={14} /> Generate QR
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!upiCheckoutAmount || !business?.upiId}
                    onClick={() => copyUpiLink(getUpiLink(upiCheckoutAmount, 'Ledger payment'))}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy size={14} /> Copy Link
                  </button>
                </div>
                {business?.upiId ? (
                  <>
                    {upiCheckoutAmount > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '10px', background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(getUpiLink(upiCheckoutAmount, 'Ledger payment'))}`}
                          alt="UPI QR Code"
                          style={{ borderRadius: '8px', border: '3px solid var(--accent)', padding: '4px', background: '#fff' }}
                          width={100} height={100}
                        />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scan to pay ₹{upiCheckoutAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted" style={{ marginTop: '6px', fontSize: '0.78rem' }}>Set UPI ID in settings to enable QR codes.</p>
                )}
              </div>

              {(() => {
                const totalPaying = Number(payCash || 0) + Number(payUpi || 0)
                const balanceAfter = Math.max(outstanding - totalPaying, 0)
                const excessToAdvance = Math.max(totalPaying - outstanding, 0)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', background: 'var(--bg-elevated)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span className="text-muted">Paying Now:</span>
                      <strong>₹{totalPaying.toFixed(2)}</strong>
                    </div>
                    {outstanding > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span className="text-muted">Balance After:</span>
                        <strong style={{ color: balanceAfter > 0 ? 'var(--warning)' : 'var(--success)' }}>₹{balanceAfter.toFixed(2)}</strong>
                      </div>
                    )}
                    {excessToAdvance > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'var(--info)', background: 'var(--info-bg)', padding: '4px 8px', borderRadius: '4px', marginTop: '4px' }}>
                        <Wallet size={12} /> ₹{excessToAdvance.toFixed(2)} to Advance Credit
                      </div>
                    )}
                  </div>
                )
              })()}
              <button
                className="btn btn-primary"
                onClick={handleApplyPayment}
                disabled={Number(payCash || 0) + Number(payUpi || 0) <= 0}
                style={{ width: '100%' }}
              >
                <CheckCircle size={16} /> Apply Payment
              </button>
            </div>
          )}
        </div>

        {/* Right Panel: Interactive Timeline & Transaction Statement */}
        <div className="card" style={{ gridColumn: 'span 2', height: '100%', minWidth: 0 }}>
          <div className="bill-view-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Transaction History ({ledgerEntries.length})</h2>
            </div>
            {/* Period selector */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {['all', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map((p) => (
                <button
                  key={p} type="button"
                  onClick={() => setLedgerPeriod(p)}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                    background: ledgerPeriod === p ? 'var(--accent)' : 'transparent',
                    color: ledgerPeriod === p ? '#fff' : '#94a3b8',
                  }}
                >{p.charAt(0).toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem' }}>
              {[['Invoice', 'var(--error)'], ['Payment', 'var(--success)'], ['Advance', 'var(--info)'], ['Opening', 'var(--text-secondary)']].map(([label, color]) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {ledgerEntries.length === 0 ? (
            <EmptyState
              Icon={AlertCircle}
              title="No transactions found"
              description="There are no billing or payment records logged for this customer during the selected time period."
            />
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Debit (₹)</th>
                    <th style={{ textAlign: 'right' }}>Credit (₹)</th>
                    <th style={{ textAlign: 'right' }}>Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((entry, idx) => (
                    <tr key={`${entry.id}-${idx}`}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(entry.date).toLocaleDateString()}</td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px',
                          borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 600,
                          background: `${typeColor(entry.type)}22`, color: typeColor(entry.type),
                          border: `1px solid ${typeColor(entry.type)}44`,
                        }}>
                          {typeLabel(entry.type)}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{entry.description}</div>
                        {entry.subtext && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{entry.subtext}</div>}
                        {entry.advanceUsed > 0 && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--info)', marginTop: '2px' }}>
                            Advance applied: ₹{entry.advanceUsed.toFixed(2)}
                          </div>
                        )}
                        {entry.discountValue > 0 && !entry.promoCode && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--accent)', marginTop: '2px' }}>
                            Manual Discount: ₹{entry.discountValue.toFixed(2)}
                          </div>
                        )}
                        {entry.promoCode && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--accent)', marginTop: '2px' }}>
                            Promo Code ({entry.promoCode}): -₹{(entry.promoDiscount || entry.discountValue || 0).toFixed(2)}
                          </div>
                        )}
                        {((entry.loyaltyDiscount || 0) > 0 || (entry.loyaltyPointsRedeemed || 0) > 0) && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--warning)', marginTop: '2px' }}>
                            Loyalty Discount ({entry.loyaltyPointsRedeemed || 0} pts): -₹{(entry.loyaltyDiscount || (Number(entry.loyaltyPointsRedeemed || 0) * (settings.loyaltyRedeemRatioRupees || 5) / (settings.loyaltyRedeemRatioPoints || 150))).toFixed(2)}
                          </div>
                        )}
                        {entry.gstAmount > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#818cf8', marginTop: '2px' }}>
                            GST Included: ₹{entry.gstAmount.toFixed(2)} (CGST ₹{(entry.gstAmount / 2).toFixed(2)}, SGST ₹{(entry.gstAmount / 2).toFixed(2)})
                          </div>
                        )}
                        {settings.loyaltyEnabled !== false && entry.loyaltyPointsEarned > 0 && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '2px' }}>
                            Loyalty Points Earned: +{entry.loyaltyPointsEarned} pts
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: entry.debit > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                        {entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: (entry.credit > 0 || entry.advanceIn > 0) ? 'var(--success)' : entry.advanceReturn > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : entry.advanceIn > 0 ? `₹${entry.advanceIn.toFixed(2)}` : entry.advanceReturn > 0 ? `-₹${entry.advanceReturn.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: entry.balance >= 0 ? 'var(--success)' : 'var(--error)' }}>
                        {entry.balance < 0 ? `-₹${Math.abs(entry.balance).toFixed(2)}` : entry.balance > 0 ? `+₹${entry.balance.toFixed(2)}` : `₹${entry.balance.toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--border-light)', fontWeight: 600, background: 'var(--bg-elevated)', fontSize: '0.85rem' }}>
                    <td colSpan={3} style={{ color: 'var(--text-secondary)' }}>TOTAL DEBITS (Invoices & Charges)</td>
                    <td style={{ textAlign: 'right', color: 'var(--error)' }}>₹{totalDebits.toFixed(2)}</td>
                    <td></td>
                    <td></td>
                  </tr>
                  <tr style={{ fontWeight: 600, background: 'var(--bg-elevated)', fontSize: '0.85rem' }}>
                    <td colSpan={3} style={{ color: 'var(--text-secondary)' }}>TOTAL CREDITS (Payments & Deposits)</td>
                    <td></td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{totalCredits.toFixed(2)}</td>
                    <td></td>
                  </tr>
                  {periodAdvanceReturned > 0 && (
                    <tr style={{ fontWeight: 600, background: 'var(--bg-elevated)', fontSize: '0.85rem' }}>
                      <td colSpan={3} style={{ color: 'var(--text-secondary)' }}>TOTAL ADVANCE RETURNS</td>
                      <td></td>
                      <td style={{ textAlign: 'right', color: 'var(--warning)' }}>-₹{periodAdvanceReturned.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700, background: 'var(--bg-elevated)' }}>
                    <td colSpan={3}>FINAL BALANCE</td>
                    <td></td>
                    <td></td>
                    <td style={{ 
                      textAlign: 'right', 
                      color: finalBalance >= 0 ? 'var(--success)' : 'var(--error)',
                      fontWeight: 700
                    }}>
                      {finalBalance < 0 ? `-₹${Math.abs(finalBalance).toFixed(2)}` : finalBalance > 0 ? `+₹${finalBalance.toFixed(2)}` : `₹${finalBalance.toFixed(2)}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Split Settlement View ── */}
      {customerSettlements.length > 0 && (
        <div className="card" style={{ marginTop: '24px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8' }}>
            <ArrowLeftRight size={18} /> Split Settlement View
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {customerSettlements.map((settle) => {
              const payerName = customers.find(c => c.id === settle.customerId)?.name || 'Unknown'
              const isPayer = settle.customerId === selectedCustomerId
              
              const groupBillsList = bills.filter(b => b.groupBillId === settle.groupBillId && !b.deleted && !b.isGroupParent)
              const groupTotal = groupBillsList.reduce((sum, b) => sum + b.total, 0)

              return (
                <div key={settle.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 135px), 1fr))', gap: '12px', fontSize: '13px', marginBottom: '12px' }}>
                    <div>
                      <span style={{ color: '#71717a' }}>Group ID:</span> <strong style={{ color: 'var(--accent)' }}>{settle.groupBillId}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#71717a' }}>Total Amount:</span> <strong>₹{groupTotal.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#71717a' }}>Actual Payer:</span> <strong style={{ color: isPayer ? '#10b981' : '#fff' }}>{payerName} {isPayer ? '(You)' : ''}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#71717a' }}>Payment Ref:</span> <strong style={{ fontFamily: 'monospace' }}>{settle.id}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#71717a' }}>Status:</span> <strong style={{ color: '#10b981' }}>Completed</strong>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>Members Settled:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#fff' }}>
                        <span>{payerName} (Payer Share)</span>
                        <span>₹{Number(groupBillsList.find(b => b.customerId === settle.customerId)?.total || 0).toFixed(2)}</span>
                      </div>
                      {(settle.groupSettlements || []).map((s, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: s.customerId === selectedCustomerId ? '#a3e635' : '#a1a1aa' }}>
                          <span>{s.customerName} (Settled Share) {s.customerId === selectedCustomerId ? '(You)' : ''}</span>
                          <span>₹{Number(s.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerLedger
