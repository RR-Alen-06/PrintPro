import React, { useState, useMemo } from 'react'
import {
  Download, Wallet, ChevronDown, CheckCircle, Share2, Copy, Link2,
  AlertCircle, MessageCircle, FileText, ArrowDownLeft, ArrowUpRight
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { uploadPDFReceipt } from '../../api/share'
import { LedgerService } from '../../services/ledgerService'
import { SequenceService } from '../../services/sequenceService'
import EmptyState from '../common/EmptyState'
import CustomerStatementModal from './CustomerStatementModal'

const LEDGER_PERIODS = ['all', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']

interface CustomerLedgerTabProps {
  customer: any
  bills: any[]
  payments: any[]
  advancePayments: any[]
  business: any
  settings: any
  onWriteOff?: (billId: string, balance: number) => Promise<void>
  showToast: (msg: string, type?: string) => void
}

export const CustomerLedgerTab: React.FC<CustomerLedgerTabProps> = ({
  customer,
  bills,
  payments,
  advancePayments,
  business,
  settings,
  onWriteOff,
  showToast,
}) => {
  const [ledgerPeriod, setLedgerPeriod] = useState('all')
  const [isUploadingShare, setIsUploadingShare] = useState(false)
  const [sharedPdfUrl, setSharedPdfUrl] = useState('')
  const [showStatementModal, setShowStatementModal] = useState(false)

  // Calculate authoritative chronological ledger entries
  const ledgerEntries = useMemo(() => {
    if (!customer?.id) return []
    try {
      const res = LedgerService.calculateLedger({
        customerId: customer.id,
        bills,
        payments,
        advancePayments,
        period: ledgerPeriod,
        settings,
      })
      return res.entries || []
    } catch (err) {
      console.error('Failed to compute ledger entries:', err)
      return []
    }
  }, [customer?.id, bills, payments, advancePayments, ledgerPeriod, settings])

  // Summaries
  const totalDebits = useMemo(() => ledgerEntries.reduce((s, e) => s + Number(e.debit || 0), 0), [ledgerEntries])
  const totalCredits = useMemo(
    () => ledgerEntries.reduce((s, e) => s + Number(e.credit || 0) + Number(e.advanceIn || 0), 0),
    [ledgerEntries]
  )
  const periodAdvanceReturned = useMemo(
    () => ledgerEntries.reduce((s, e) => s + Number(e.advanceReturn || 0), 0),
    [ledgerEntries]
  )
  const finalBalance = ledgerEntries.length > 0 ? Number(ledgerEntries[ledgerEntries.length - 1].balance || 0) : 0

  const getUpiLink = (amount: number, notesText = 'Ledger Settlement') => {
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

  // Generate jsPDF document
  const generateLedgerPDFDoc = () => {
    if (!customer) return null
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const MARGIN = 12
    const FOOTER_H = 12
    const MAX_Y = H - MARGIN - FOOTER_H
    let y = 16
    let page = 1

    const addFooter = (p: number) => {
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
    const displayCode = customer.customerCode || SequenceService.formatDisplayCode('customer', customer, 'CUS')
    doc.text(`Customer: ${customer.name} (${displayCode})`, MARGIN, y)
    doc.text(`Date: ${new Date().toLocaleDateString()}`, W - MARGIN, y, { align: 'right' })
    y += 5
    if (customer.phone) {
      doc.text(`Phone: ${customer.phone}`, MARGIN, y)
      y += 5
    }
    doc.text(`Period: ${ledgerPeriod.toUpperCase()}`, MARGIN, y)
    y += 8

    // Table Header
    doc.setFillColor(30, 41, 59)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.rect(MARGIN, y, W - 2 * MARGIN, 7, 'F')
    doc.text('Date', MARGIN + 2, y + 5)
    doc.text('Type', MARGIN + 26, y + 5)
    doc.text('Description', MARGIN + 52, y + 5)
    doc.text('Debit (₹)', MARGIN + 115, y + 5, { align: 'right' })
    doc.text('Credit (₹)', MARGIN + 145, y + 5, { align: 'right' })
    doc.text('Balance (₹)', W - MARGIN - 2, y + 5, { align: 'right' })
    y += 9
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')

    ledgerEntries.forEach((e) => {
      checkPage(7)
      const dateStr = e.date ? e.date.slice(0, 10) : ''
      const typeStr = e.type === 'bill' ? 'Invoice' : e.type === 'advance' ? 'Advance' : e.type === 'advance_return' ? 'Adv Return' : 'Payment'
      const debitStr = e.debit > 0 ? e.debit.toFixed(2) : '-'
      const creditStr = e.credit > 0 ? e.credit.toFixed(2) : (e.advanceIn > 0 ? e.advanceIn.toFixed(2) : (e.advanceReturn > 0 ? `-${e.advanceReturn.toFixed(2)}` : '-'))
      const balStr = `₹${e.balance.toFixed(2)}`

      doc.text(dateStr, MARGIN + 2, y)
      doc.text(typeStr, MARGIN + 26, y)
      doc.text(String(e.description || '').slice(0, 28), MARGIN + 52, y)
      doc.text(debitStr, MARGIN + 115, y, { align: 'right' })
      doc.text(creditStr, MARGIN + 145, y, { align: 'right' })
      doc.text(balStr, W - MARGIN - 2, y, { align: 'right' })
      y += 6
    })

    // Totals line
    checkPage(12)
    y += 2
    doc.setDrawColor(200)
    doc.line(MARGIN, y, W - MARGIN, y)
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Closing Running Balance:', MARGIN + 2, y)
    doc.text(`₹${finalBalance.toFixed(2)}`, W - MARGIN - 2, y, { align: 'right' })

    addFooter(page)
    return doc
  }

  // Download PDF
  const handleDownloadPDF = () => {
    const doc = generateLedgerPDFDoc()
    if (!doc) return
    doc.save(`${customer.name}-ledger-${new Date().toISOString().slice(0, 10)}.pdf`)
    showToast('Ledger PDF downloaded successfully!', 'success')
  }

  // Cloud upload & copy link
  const handleShareCloudLink = async () => {
    const doc = generateLedgerPDFDoc()
    if (!doc) return
    setIsUploadingShare(true)
    try {
      const blob = doc.output('blob')
      const res = await uploadPDFReceipt(blob, `ledger-${customer.id}-${Date.now()}`)
      const fileUrl = res?.fileUrl || res?.url || ''
      setSharedPdfUrl(fileUrl)
      if (fileUrl) {
        navigator.clipboard.writeText(fileUrl)
        showToast('PDF uploaded! Shareable link copied to clipboard.', 'success')
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to upload statement to cloud', 'error')
    } finally {
      setIsUploadingShare(false)
    }
  }

  // Share on WhatsApp
  const handleShareWhatsApp = () => {
    if (!customer) return
    let msg = `*ACCOUNT STATEMENT - ${business?.shopName || 'PrintPro'}*\n`
    msg += `*Customer*: ${customer.name}\n`
    msg += `*Date*: ${new Date().toLocaleDateString()}\n`
    msg += `*Period*: ${ledgerPeriod.toUpperCase()}\n`
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
    msg += `Date       | Ref | Debit | Credit\n`

    ledgerEntries.forEach((row: any) => {
      const typeStr = row.refId === 'OB' ? 'OB ' : (row.refId || 'TX')
      const debitVal = Number(row.debit || 0)
      const creditVal = Number(row.credit || row.advanceIn || 0)
      msg += `${row.date?.slice(0, 10) || ''} | ${typeStr} | ₹${debitVal.toFixed(0)} | ₹${creditVal.toFixed(0)}\n`
    })

    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
    msg += `*Net Balance: ₹${finalBalance.toFixed(2)}*\n`

    if (finalBalance > 0 && business?.upiId) {
      const upi = getUpiLink(finalBalance, `Settle account for ${customer.name}`)
      if (upi) msg += `\n*Quick Pay via UPI:* ${upi}\n`
    }
    if (sharedPdfUrl) {
      msg += `\n*View Full Statement PDF:* ${sharedPdfUrl}\n`
    }

    const encoded = encodeURIComponent(msg)
    window.open(`https://api.whatsapp.com/send?phone=${customer.phone || ''}&text=${encoded}`, '_blank')
  }

  // Download CSV
  const handleDownloadCSV = () => {
    const escCell = (v: any) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const displayCode = customer?.customerCode || SequenceService.formatDisplayCode('customer', customer, 'CUS')
    const rows = [
      [`Customer Ledger Statement - ${customer?.name}`],
      [`Customer Code:`, displayCode],
      [`Period:`, ledgerPeriod.toUpperCase()],
      [`Generated:`, new Date().toLocaleString()],
      [],
      ['Date', 'Type', 'Description', 'Debit (Rs)', 'Credit (Rs)', 'Balance (Rs)'],
      ...ledgerEntries.map((e) => [
        e.date ? e.date.slice(0, 10) : '',
        e.type === 'bill' ? 'Invoice' : e.type === 'advance' ? 'Advance' : e.type === 'advance_return' ? 'Adv Return' : 'Payment',
        e.description,
        e.debit > 0 ? e.debit.toFixed(2) : '',
        e.credit > 0 ? e.credit.toFixed(2) : (e.advanceIn > 0 ? e.advanceIn.toFixed(2) : (e.advanceReturn > 0 ? `-${e.advanceReturn.toFixed(2)}` : '')),
        e.balance.toFixed(2),
      ]),
      [],
      ['TOTAL DEBITS', '', '', totalDebits.toFixed(2), '', ''],
      ['TOTAL CREDITS', '', '', '', totalCredits.toFixed(2), ''],
      ['FINAL BALANCE', '', '', '', '', finalBalance.toFixed(2)],
    ]
    const BOM = '\uFEFF'
    const csv = rows.map((r) => r.map(escCell).join(',')).join('\n')
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${customer?.name}-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Period Selector & Export Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {LEDGER_PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              className={`btn btn-sm ${ledgerPeriod === period ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setLedgerPeriod(period)}
              style={{ textTransform: 'capitalize', fontSize: '0.78rem' }}
            >
              {period}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowStatementModal(true)}
            title="Consolidated statement with items and payments"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={14} /> Consolidated Statement
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadPDF} title="Download PDF Statement">
            <Download size={14} /> PDF
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadCSV} title="Download CSV">
            <Download size={14} /> CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleShareCloudLink}
            disabled={isUploadingShare}
            title="Upload PDF to Cloud & Copy Link"
          >
            <Link2 size={14} /> {isUploadingShare ? 'Uploading...' : 'Cloud Link'}
          </button>
          {customer?.phone && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleShareWhatsApp}
              style={{ color: '#25D366' }}
              title="Share Statement via WhatsApp"
            >
              <MessageCircle size={14} /> WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* 2. Ledger Running Summary Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          padding: '12px 16px',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Debits (Bills)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--aurora-pink, #ff2fb0)' }}>₹{totalDebits.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Credits (Paid)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>₹{totalCredits.toFixed(2)}</div>
        </div>
        {periodAdvanceReturned > 0 && (
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Advance Returns</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--aurora-amber, #f59e0b)' }}>-₹{periodAdvanceReturned.toFixed(2)}</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Final Running Balance</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: finalBalance > 0 ? 'var(--aurora-pink, #ff2fb0)' : '#10b981' }}>
            ₹{finalBalance.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 3. Chronological Ledger Table */}
      {ledgerEntries.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Transactions in this Period"
          description="There are no billing or payment entries recorded for the selected timeframe."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '45px' }}>#</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Description</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Debit (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Credit (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Balance (₹)</th>
                  {onWriteOff && <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((row, idx) => {
                  const isDebit = Number(row.debit || 0) > 0
                  const isCredit = Number(row.credit || row.advanceIn || 0) > 0
                  const isReturn = Number(row.advanceReturn || 0) > 0

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        backgroundColor: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {row.date ? row.date.slice(0, 10) : ''}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          className={`badge ${
                            row.type === 'bill'
                              ? 'badge-info'
                              : row.type === 'advance'
                              ? 'badge-success'
                              : row.type === 'advance_return'
                              ? 'badge-warning'
                              : 'badge-success'
                          }`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {row.type === 'bill'
                            ? 'Invoice'
                            : row.type === 'advance'
                            ? 'Advance'
                            : row.type === 'advance_return'
                            ? 'Adv Return'
                            : 'Payment'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>
                        <div style={{ fontWeight: 500 }}>{row.description}</div>
                        {row.refId && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ref: {row.refId}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: isDebit ? 700 : 400, color: isDebit ? 'var(--aurora-pink, #ff2fb0)' : 'var(--text-muted)' }}>
                        {isDebit ? `₹${Number(row.debit).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: isCredit || isReturn ? 700 : 400, color: isCredit ? '#10b981' : isReturn ? 'var(--aurora-amber, #f59e0b)' : 'var(--text-muted)' }}>
                        {isCredit
                          ? `₹${Number(row.credit || row.advanceIn).toFixed(2)}`
                          : isReturn
                          ? `-₹${Number(row.advanceReturn).toFixed(2)}`
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>
                        <span style={{ color: Number(row.balance) > 0 ? 'var(--aurora-pink, #ff2fb0)' : '#10b981' }}>
                          ₹{Number(row.balance).toFixed(2)}
                        </span>
                      </td>
                      {onWriteOff && (
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {row.type === 'bill' && row.rawBillId && Number(row.unpaidBalance || 0) > 0 && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
                              onClick={() => onWriteOff(row.rawBillId, Number(row.unpaidBalance))}
                              title="Write off bad debt balance"
                            >
                              Write off
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Consolidated Statement Modal */}
      <CustomerStatementModal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        customerId={customer?.id}
        customers={customer ? [customer] : []}
        bills={bills}
        payments={payments}
        advancePayments={advancePayments}
        business={business}
        settings={settings}
      />
    </div>
  )
}
