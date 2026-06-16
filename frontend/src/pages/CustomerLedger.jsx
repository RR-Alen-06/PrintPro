import React, { useState, useMemo } from 'react'
import { Download, Wallet, ChevronDown } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { jsPDF } from 'jspdf'

const CustomerLedger = () => {
  const { customers, bills, payments, advancePayments } = useAppContext()

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers])
  const [selectedCustomerId, setSelectedCustomerId] = useState(activeCustomers[0]?.id || '')

  const selectedCustomer = useMemo(
    () => activeCustomers.find((c) => c.id === selectedCustomerId),
    [activeCustomers, selectedCustomerId]
  )

  const customerBills = useMemo(
    () => bills.filter((b) => b.customerId === selectedCustomerId && !b.deleted),
    [bills, selectedCustomerId]
  )

  const customerPayments = useMemo(
    () => payments.filter((p) => p.customerId === selectedCustomerId),
    [payments, selectedCustomerId]
  )

  const customerAdvances = useMemo(
    () => (advancePayments || []).filter((a) => a.customerId === selectedCustomerId),
    [advancePayments, selectedCustomerId]
  )

  // Build full ledger timeline: bills (debit), payments (credit), advances (credit deposit)
  const ledgerEntries = useMemo(() => {
    const entries = []

    customerBills.forEach((bill) => {
      entries.push({
        type: 'bill',
        date: bill.date,
        id: bill.id,
        description: `Invoice #${bill.id}`,
        subtext: bill.items ? `${bill.items.length} item(s) · ${bill.status}` : bill.status,
        debit: bill.total,
        credit: 0,
        advanceUsed: Number(bill.advanceUsed || 0),
        discountValue: Number(bill.discountValue || 0),
      })
    })

    customerPayments.forEach((payment) => {
      entries.push({
        type: 'payment',
        date: payment.date,
        id: payment.id,
        description: `Payment — ${payment.billId || 'General'}`,
        subtext: `Cash ₹${Number(payment.cashAmount || 0).toFixed(2)} · UPI ₹${Number(payment.upiAmount || 0).toFixed(2)}`,
        debit: 0,
        credit: payment.totalPaid,
      })
    })

    customerAdvances.forEach((adv) => {
      entries.push({
        type: 'advance',
        date: adv.date,
        id: adv.id,
        description: `Advance Deposit`,
        subtext: `Ref: ${adv.id} · Cash ₹${Number(adv.cashAmount || 0).toFixed(2)} · UPI ₹${Number(adv.upiAmount || 0).toFixed(2)}${adv.notes ? ` · ${adv.notes}` : ''}`,
        debit: 0,
        credit: 0,
        advanceIn: Number(adv.amount),
      })
    })

    entries.sort((a, b) => new Date(a.date) - new Date(b.date))

    let runningBalance = 0
    return entries.map((entry) => {
      runningBalance += (entry.debit || 0) - (entry.credit || 0) - (entry.advanceUsed || 0)
      return { ...entry, balance: runningBalance }
    })
  }, [customerBills, customerPayments, customerAdvances])

  const totalBilled = customerBills.reduce((s, b) => s + Number(b.total || 0), 0)
  const totalPaid = customerPayments.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
  const totalAdvanceIn = customerAdvances.reduce((s, a) => s + Number(a.amount || 0), 0)
  const totalAdvanceUsed = customerBills.reduce((s, b) => s + Number(b.advanceUsed || 0), 0)
  const totalDiscount = customerBills.reduce((s, b) => s + Number(b.discountValue || 0), 0)
  const outstanding = customerBills.reduce((s, b) => s + Number(b.balance || 0), 0)

  // CSV download
  const downloadStatement = () => {
    const date = new Date()
    const rows = [
      [`Customer Ledger Statement — ${selectedCustomer?.name}`],
      [`Customer ID:`, selectedCustomer?.id || ''],
      [`Generated:`, date.toLocaleString()],
      [],
      ['Date', 'Type', 'Description', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'],
      ...ledgerEntries.map((e) => [
        new Date(e.date).toLocaleDateString(),
        e.type,
        `"${e.description}"`,
        e.debit > 0 ? e.debit.toFixed(2) : '',
        e.credit > 0 ? e.credit.toFixed(2) : (e.advanceIn > 0 ? e.advanceIn.toFixed(2) : ''),
        e.balance.toFixed(2),
      ]),
      [],
      ['', '', 'TOTAL BILLED', totalBilled.toFixed(2), '', ''],
      ['', '', 'TOTAL PAID', '', totalPaid.toFixed(2), ''],
      ['', '', 'ADVANCE DEPOSITED', '', totalAdvanceIn.toFixed(2), ''],
      ['', '', 'OUTSTANDING', outstanding.toFixed(2), '', ''],
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${selectedCustomer?.name}-ledger-${date.toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // PDF download
  const downloadPDF = () => {
    if (!selectedCustomer) return
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
      ['Total Billed', `Rs.${totalBilled.toFixed(2)}`],
      ['Total Paid', `Rs.${totalPaid.toFixed(2)}`],
      ['Advance Deposited', `Rs.${totalAdvanceIn.toFixed(2)}`],
      ['Outstanding', `Rs.${outstanding.toFixed(2)}`],
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
      const typeLabel = entry.type === 'bill' ? 'Invoice' : entry.type === 'advance' ? 'Advance' : 'Payment'
      const debitStr = entry.debit > 0 ? `Rs.${entry.debit.toFixed(2)}` : '-'
      const creditStr = entry.credit > 0 ? `Rs.${entry.credit.toFixed(2)}` : entry.advanceIn > 0 ? `Rs.${entry.advanceIn.toFixed(2)}` : '-'
      const balStr = `Rs.${entry.balance.toFixed(2)}`
      doc.text(new Date(entry.date).toLocaleDateString(), cols.date, y)
      doc.text(typeLabel, cols.type, y)
      const shortDesc = entry.description.length > 30 ? entry.description.slice(0, 28) + '…' : entry.description
      doc.text(shortDesc, cols.desc, y)
      doc.setTextColor(entry.debit > 0 ? 200 : 0, 0, 0)
      doc.text(debitStr, cols.debit, y)
      doc.setTextColor(0, entry.credit > 0 || entry.advanceIn > 0 ? 150 : 0, 0)
      doc.text(creditStr, cols.credit, y)
      doc.setTextColor(entry.balance > 0 ? 180 : 0, entry.balance <= 0 ? 150 : 0, 0)
      doc.text(balStr, cols.bal, y)
      doc.setTextColor(0)
      y += 6
    })

    addFooter(page)
    doc.save(`${selectedCustomer.name}-ledger-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const typeColor = (type) => {
    if (type === 'bill') return 'var(--error)'
    if (type === 'advance') return 'var(--info)'
    return 'var(--success)'
  }
  const typeLabel = (type) => {
    if (type === 'bill') return 'Invoice'
    if (type === 'advance') return 'Advance'
    return 'Payment'
  }

  return (
    <div>
      <div className="page-header">
        <h1>Customer Ledger</h1>
        <p>Complete transaction history including bills, payments, and advance deposits.</p>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* Customer Selector */}
        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Select Customer</h2>
          <select
            className="form-select"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
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
            <div style={{ marginTop: '16px', padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.875rem' }}>
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
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Summary</h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            {[
              { label: 'Total Billed', value: totalBilled, color: 'var(--error)' },
              { label: 'Total Paid', value: totalPaid, color: 'var(--success)' },
              { label: 'Outstanding Balance', value: outstanding, color: 'var(--warning)' },
              { label: 'Total Discounts Given', value: totalDiscount, color: 'var(--accent)' },
              { label: 'Advance Deposited', value: totalAdvanceIn, color: 'var(--info)' },
              { label: 'Advance Used in Bills', value: totalAdvanceUsed, color: 'var(--info)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</span>
                <strong style={{ color }}>₹{value.toFixed(2)}</strong>
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
        </div>
      </div>

      {/* Ledger Entries */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="bill-view-header" style={{ marginBottom: '16px' }}>
          <h2>Transaction History ({ledgerEntries.length})</h2>
          <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem' }}>
            {[['Invoice', 'var(--error)'], ['Payment', 'var(--success)'], ['Advance', 'var(--info)']].map(([label, color]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {ledgerEntries.length === 0 ? (
          <p className="text-muted">No transactions found for this customer.</p>
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
                        display: 'inline-block', padding: '2px 8px',
                        borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 600,
                        background: `${typeColor(entry.type)}22`, color: typeColor(entry.type),
                        border: `1px solid ${typeColor(entry.type)}44`,
                      }}>
                        {typeLabel(entry.type)}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{entry.description}</div>
                      {entry.subtext && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.subtext}</div>}
                      {entry.advanceUsed > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--info)' }}>
                          Advance applied: ₹{entry.advanceUsed.toFixed(2)}
                        </div>
                      )}
                      {entry.discountValue > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>
                          Discount: ₹{entry.discountValue.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', color: entry.debit > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                      {entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: (entry.credit > 0 || entry.advanceIn > 0) ? 'var(--success)' : 'var(--text-muted)' }}>
                      {entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : entry.advanceIn > 0 ? `₹${entry.advanceIn.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: entry.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      ₹{entry.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border-light)', fontWeight: 700, background: 'var(--bg-elevated)' }}>
                  <td colSpan={3}>TOTAL</td>
                  <td style={{ textAlign: 'right', color: 'var(--error)' }}>₹{totalBilled.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{(totalPaid + totalAdvanceIn).toFixed(2)}</td>
                  <td style={{ textAlign: 'right', color: outstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
                    ₹{outstanding.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerLedger
