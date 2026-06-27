import React, { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { jsPDF } from 'jspdf'
import { Calendar, Download, Share2, Copy, Check, MessageSquare, Mail } from 'lucide-react'

const PeriodReport = () => {
  const { bills, payments, expenses, advancePayments, business } = useAppContext()

  const [reportType, setReportType] = useState('monthly') // 'monthly' | 'yearly'
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const years = useMemo(() => {
    const list = []
    const startYear = 2024
    const currentYear = new Date().getFullYear()
    for (let y = currentYear + 1; y >= startYear; y--) {
      list.push(String(y))
    }
    return list
  }, [])

  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]

  const periodKey = useMemo(() => {
    return reportType === 'monthly' 
      ? `${selectedYear}-${selectedMonth}` 
      : `${selectedYear}`
  }, [reportType, selectedYear, selectedMonth])

  const periodLabel = useMemo(() => {
    if (reportType === 'monthly') {
      const mLabel = months.find(m => m.value === selectedMonth)?.label || ''
      return `${mLabel} ${selectedYear}`
    }
    return `Year ${selectedYear}`
  }, [reportType, selectedYear, selectedMonth])

  // ── Computations for selected period ──
  const reportData = useMemo(() => {
    // Filter payments, advances, expenses, bills in period
    const periodPayments = payments.filter(p => p.date && p.date.startsWith(periodKey))
    const periodAdvances = (advancePayments || []).filter(ap => ap.date && ap.date.startsWith(periodKey))
    const periodExpenses = (expenses || []).filter(e => e.date && e.date.startsWith(periodKey))
    const periodBills = bills.filter(b => !b.deleted && !b.isGroupParent && b.date && b.date.startsWith(periodKey))

    // Separate normal payments from refund payments
    const normalPayments = periodPayments.filter(p => !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0)
    const refundPayments = periodPayments.filter(p => p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0)

    // Revenue = sum of amountPaid on bills (already net of refunds after the ADD_PAYMENT fix)
    const revenue = periodBills.reduce((s, b) => s + Number(b.amountPaid || 0), 0)
    const cashRevenue = normalPayments.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const upiRevenue = normalPayments.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    // Refund totals for period
    const refundTotal = refundPayments.reduce((s, p) => s + Math.abs(Number(p.totalPaid || 0)), 0)
    const cashRefunded = refundPayments.reduce((s, p) => s + Math.abs(Number(p.cashAmount || 0)), 0)
    const upiRefunded = refundPayments.reduce((s, p) => s + Math.abs(Number(p.upiAmount || 0)), 0)

    // Advance collected - EXCLUDE refund-credit advance deposits (isRefundCredit)
    const periodAdvancesFiltered = periodAdvances.filter(ap => !ap.isRefundCredit)
    const advanceCollected = periodAdvancesFiltered.reduce((s, ap) => s + Number(ap.amount || 0), 0)
    const cashAdvance = periodAdvancesFiltered.filter(ap => ap.amount > 0).reduce((s, ap) => s + Number(ap.cashAmount || 0), 0)
    const upiAdvance = periodAdvancesFiltered.filter(ap => ap.amount > 0).reduce((s, ap) => s + Number(ap.upiAmount || 0), 0)

    const totalExpenses = periodExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const cashExpenses = periodExpenses.reduce((s, e) => s + Number(e.cashAmount || 0), 0)
    const upiExpenses = periodExpenses.reduce((s, e) => s + Number(e.upiAmount || 0), 0)

    // pInflow from all period payments (refund payments have negative cashAmount that reduces sum naturally)
    const pInflow = periodPayments.reduce((s, p) => s + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    const totalCashInflow = pInflow + Math.max(0, advanceCollected)
    const netCashFlow = totalCashInflow - totalExpenses
    const netProfit = revenue - totalExpenses

    // Print type breakdown
    const printCounts = {
      'Color Single': 0,
      'Color Double': 0,
      'B/W Single': 0,
      'B/W Double': 0,
    }
    periodBills.forEach(bill => {
      bill.items?.forEach(item => {
        const key = `${item.printType === 'color' ? 'Color' : 'B/W'} ${item.sides === 'double' ? 'Double' : 'Single'}`
        if (key in printCounts) {
          printCounts[key] += (Number(item.qty) || 0)
        }
      })
    })

    return {
      revenue,
      cashRevenue,
      upiRevenue,
      refundTotal,
      cashRefunded,
      upiRefunded,
      advanceCollected,
      cashAdvance,
      upiAdvance,
      totalExpenses,
      cashExpenses,
      upiExpenses,
      totalCashInflow,
      netCashFlow,
      netProfit,
      billsCount: periodBills.length,
      refundedBillsCount: periodPayments.filter(p => p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0).reduce((acc, p) => {
        acc.add(p.billId)
        return acc
      }, new Set()).size,
      printCounts,
    }
  }, [bills, payments, expenses, advancePayments, periodKey])

  // ── Share report text formatting ──
  const shareText = useMemo(() => {
    const shopName = business?.shopName || 'PrintPro'
    return `*** ${shopName} Report - ${periodLabel} ***
---------------------------------
Net Revenue (after refunds): ₹${reportData.revenue.toFixed(2)}
  Cash: ₹${reportData.cashRevenue.toFixed(2)} | UPI: ₹${reportData.upiRevenue.toFixed(2)}
Total Refunds Issued: ₹${reportData.refundTotal.toFixed(2)}
Net Advance Collected: ₹${reportData.advanceCollected.toFixed(2)}
Total Cash Inflow: ₹${reportData.totalCashInflow.toFixed(2)}
Total Expenses: ₹${reportData.totalExpenses.toFixed(2)}
Net Profit (Revenue - Expenses): ₹${reportData.netProfit.toFixed(2)}
Net Cash Flow: ₹${reportData.netCashFlow.toFixed(2)}
---------------------------------
Bills Processed: ${reportData.billsCount}
Refunded Bills: ${reportData.refundedBillsCount || 0}
Generated on: ${new Date().toLocaleDateString()}`
  }, [business, periodLabel, reportData])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`
    window.open(url, '_blank')
  }

  const shareEmail = () => {
    const subject = `PrintPro Report - ${periodLabel}`
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`
    window.location.href = url
  }

  const shareSystem = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `PrintPro Report - ${periodLabel}`,
          text: shareText,
        })
      } catch (err) {
        console.error('Share failed', err)
      }
    }
  }

  // ── PDF export ──
  const downloadReportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    let y = 15

    const text = (str, x, yPos, opts) => doc.text(str, x, yPos, opts)
    const line = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2)

    // Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    text(business?.shopName || 'PrintPro', W / 2, y, { align: 'center' })
    y += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    text(`PERIODICAL BUSINESS REPORT — ${periodLabel.toUpperCase()}`, W / 2, y, { align: 'center' })
    y += 5
    text(`Generated: ${new Date().toLocaleString()}`, W / 2, y, { align: 'center' })
    y += 4
    doc.setLineWidth(0.4)
    line(12, y, W - 12, y)
    y += 8

    // Totals grid in PDF
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    text('Financial Summary', 15, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    
    const printRow = (label, value, isBold = false) => {
      if (isBold) doc.setFont('helvetica', 'bold')
      text(label, 20, y)
      text(`Rs. ${value}`, W - 20, y, { align: 'right' })
      y += 6
      if (isBold) doc.setFont('helvetica', 'normal')
    }

    printRow('Realized Revenue (Bills paid):', reportData.revenue.toFixed(2))
    printRow('  - Cash collected:', reportData.cashRevenue.toFixed(2))
    printRow('  - UPI collected:', reportData.upiRevenue.toFixed(2))
    printRow('Net Advance Deposited:', reportData.advanceCollected.toFixed(2))
    printRow('Total Cash Inflow (Revenue + Advance):', reportData.totalCashInflow.toFixed(2), true)
    y += 2
    printRow('Total Expenses:', reportData.totalExpenses.toFixed(2))
    printRow('  - Cash spent:', reportData.cashExpenses.toFixed(2))
    printRow('  - UPI spent:', reportData.upiExpenses.toFixed(2))
    y += 2
    doc.setLineWidth(0.2)
    line(15, y, W - 15, y)
    y += 6
    printRow('Net Cash Flow:', reportData.netCashFlow.toFixed(2), true)
    y += 8

    // Print Analytics section in PDF
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    text('Print Volume Analytics', 15, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    text(`Total Bills Processed: ${reportData.billsCount}`, 20, y)
    y += 6
    text(`Refunded Bills: ${reportData.refundedBillsCount || 0}`, 20, y)
    y += 6

    Object.entries(reportData.printCounts).forEach(([type, count]) => {
      text(`${type}:`, 20, y)
      text(`${count} prints`, W - 20, y, { align: 'right' })
      y += 6
    })

    y += 10
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    text('PrintPro - Business Management System', W / 2, y, { align: 'center' })

    doc.save(`${periodLabel.replace(/\s+/g, '_')}_Report.pdf`)
  }

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <div className="bill-view-header" style={{ marginBottom: '16px' }}>
        <div>
          <h2>Periodical Business Report</h2>
          <p className="text-muted">Generate detailed financial statements for any month or year.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadReportPDF}>
            <Download size={14} /> Download PDF
          </button>
          
          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShareOpen(!shareOpen)}>
              <Share2 size={14} /> Share Report
            </button>
            {shareOpen && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} onClick={() => setShareOpen(false)} />
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 11, boxShadow: 'var(--shadow-lg)', minWidth: '150px' }}>
                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', gap: '8px', fontSize: '0.8rem', width: '100%', padding: '6px 12px' }} onClick={() => { shareWhatsApp(); setShareOpen(false) }}>
                    <MessageSquare size={14} style={{ color: '#25D366' }} /> WhatsApp
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', gap: '8px', fontSize: '0.8rem', width: '100%', padding: '6px 12px' }} onClick={() => { shareEmail(); setShareOpen(false) }}>
                    <Mail size={14} style={{ color: 'var(--info)' }} /> Email
                  </button>
                  {navigator.share && (
                    <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', gap: '8px', fontSize: '0.8rem', width: '100%', padding: '6px 12px' }} onClick={() => { shareSystem(); setShareOpen(false) }}>
                      <Share2 size={14} /> System Share
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', gap: '8px', fontSize: '0.8rem', width: '100%', padding: '6px 12px' }} onClick={copyToClipboard}>
                    {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy to Text'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid-3" style={{ gap: '16px', marginBottom: '20px', background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Report Period</label>
          <div className="radio-group" style={{ height: '38px', padding: '2px' }}>
            <label className={`radio-option ${reportType === 'monthly' ? 'selected' : ''}`} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
              <input type="radio" checked={reportType === 'monthly'} onChange={() => setReportType('monthly')} />
              Monthly
            </label>
            <label className={`radio-option ${reportType === 'yearly' ? 'selected' : ''}`} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
              <input type="radio" checked={reportType === 'yearly'} onChange={() => setReportType('yearly')} />
              Yearly
            </label>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Select Year</label>
          <select className="form-select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {reportType === 'monthly' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select Month</label>
            <select className="form-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Preview details */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left column: Summary info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} /> Summary Statement for {periodLabel}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {[
              { label: 'Net Revenue (after refunds)', val: reportData.revenue, sub: `Cash: ₹${reportData.cashRevenue.toFixed(2)} | UPI: ₹${reportData.upiRevenue.toFixed(2)}`, color: 'var(--success)' },
              { label: 'Total Refunds Issued', val: reportData.refundTotal, sub: `Cash: ₹${(reportData.cashRefunded || 0).toFixed(2)} | UPI: ₹${(reportData.upiRefunded || 0).toFixed(2)}`, color: 'var(--warning)' },
              { label: 'Net Advance Deposited', val: reportData.advanceCollected, sub: `Cash: ₹${reportData.cashAdvance.toFixed(2)} | UPI: ₹${reportData.upiAdvance.toFixed(2)}`, color: 'var(--info)' },
              { label: 'Total Inflow (Revenue + Advance)', val: reportData.totalCashInflow, sub: 'Combined net cash/UPI receipts', color: 'var(--success)', highlight: true },
              { label: 'Total Expenses Paid', val: reportData.totalExpenses, sub: `Cash: ₹${reportData.cashExpenses.toFixed(2)} | UPI: ₹${reportData.upiExpenses.toFixed(2)}`, color: 'var(--error)' },
              { label: 'Net Profit (Revenue − Expenses)', val: reportData.netProfit, sub: 'Refunds already deducted from Revenue', color: reportData.netProfit >= 0 ? 'var(--success)' : 'var(--error)', highlight: reportData.netProfit >= 0 },
            ].map((item, idx) => (
              <div key={idx} style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: item.highlight ? '1px solid var(--success)' : '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{item.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '6px 0 2px', color: item.color }}>₹{item.val.toFixed(2)}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{item.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: reportData.netCashFlow >= 0 ? 'var(--success-bg)' : 'var(--error-bg)', borderRadius: 'var(--radius-md)', border: `1px solid ${reportData.netCashFlow >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Net Cash Flow (Inflow - Expenses):</span>
            <strong style={{ fontSize: '1.3rem', color: reportData.netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {reportData.netCashFlow >= 0 ? '+' : ''}₹{reportData.netCashFlow.toFixed(2)}
            </strong>
          </div>
        </div>

        {/* Right column: Print volume analytics */}
        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.92rem', marginBottom: '12px', color: 'var(--text-primary)' }}>Print Volume Analytics</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
            <span className="text-muted">Total Orders Processed</span>
            <strong>{reportData.billsCount}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--border)', color: reportData.refundedBillsCount > 0 ? 'var(--error)' : 'inherit' }}>
            <span className="text-muted">Refunded Orders</span>
            <strong>{reportData.refundedBillsCount || 0}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(reportData.printCounts).map(([type, count]) => {
              const maxVal = Math.max(...Object.values(reportData.printCounts), 1)
              const pct = (count / maxVal) * 100
              return (
                <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 500 }}>{type}</span>
                    <strong className="text-muted">{count} prints</strong>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#f59e0b', borderRadius: '3px' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PeriodReport
