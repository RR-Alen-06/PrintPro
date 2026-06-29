import React, { useRef, useState } from 'react'
import { Download, Upload, CheckCircle, X, AlertTriangle } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useAppContext } from '../context/AppContext'
import { createFullBackup, exportBillsToCSV, exportCustomersToCSV, exportInventoryToCSV, exportPaymentsToCSV, exportExpensesToCSV } from '../utils/dataExport'
import { importFromJSON, importCustomersFromCSV, importInventoryFromCSV, importFromCSV, validateBackupFile, restoreFromBackup } from '../utils/dataImport'

const DataManagement = () => {
  const { business, customers, inventory, bills, payments, expenses, settings, addCustomer, addInventoryItem, currentUser } = useAppContext()
  const [exportMessage, setExportMessage] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importType, setImportType] = useState('backup')
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportPeriod, setReportPeriod] = useState('all') // 'all'|'daily'|'weekly'|'monthly'|'quarterly'|'yearly'|'custom'
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const fileInputRef = useRef(null)

  const showExport = (msg) => { setExportMessage(msg); setTimeout(() => setExportMessage(''), 4000) }
  const showImport = (msg) => { setImportMessage(msg); setTimeout(() => setImportMessage(''), 4000) }

  const handleFullBackup = () => {
    const appState = { business, customers, inventory, bills, payments, expenses, settings }
    createFullBackup(appState)
    showExport('Full backup downloaded successfully')
  }

  const handleExportBills = () => {
    const active = bills.filter((b) => !b.deleted)
    exportBillsToCSV(active)
    showExport(`${active.length} bills exported to CSV`)
  }

  const handleExportCustomers = () => {
    exportCustomersToCSV(customers)
    showExport(`${customers.length} customers exported to CSV`)
  }

  const handleExportInventory = () => {
    exportInventoryToCSV(inventory)
    showExport(`${inventory.length} inventory items exported to CSV`)
  }

  const handleExportPayments = () => {
    exportPaymentsToCSV(payments)
    showExport(`${payments.length} payments exported to CSV`)
  }

  const handleExportExpenses = () => {
    exportExpensesToCSV(expenses || [])
    showExport(`${(expenses || []).length} expenses exported to CSV`)
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (importType === 'backup') {
        const data = await importFromJSON(file)
        if (!validateBackupFile(data)) throw new Error('Invalid backup file format')
        const restored = restoreFromBackup(data)
        showImport('Backup restored — reloading in 2s…')
        const storageKey = currentUser ? `printpro-state-${currentUser.id}` : 'printpro-state'
        localStorage.setItem(storageKey, JSON.stringify(restored))
        setTimeout(() => window.location.reload(), 2000)
      } else if (importType === 'customers') {
        const data = await importFromCSV(file)
        const imported = importCustomersFromCSV(data)
        imported.forEach((c) => addCustomer(c))
        showImport(`${imported.length} customers imported successfully`)
      } else if (importType === 'inventory') {
        const data = await importFromCSV(file)
        const items = importInventoryFromCSV(data)
        items.forEach((item) => addInventoryItem(item))
        showImport(`${items.length} inventory items imported successfully`)
      }
    } catch (error) {
      showImport(`Error: ${error.message}`)
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Period date range helper ──────────────────────────────────────────────
  const getPeriodRange = (period) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (period === 'daily') {
      return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
    }
    if (period === 'weekly') {
      const day = today.getDay()
      const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return { start: mon, end: sun }
    }
    if (period === 'monthly') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start, end }
    }
    if (period === 'quarterly') {
      const q = Math.floor(now.getMonth() / 3)
      const start = new Date(now.getFullYear(), q * 3, 1)
      const end = new Date(now.getFullYear(), q * 3 + 3, 0)
      return { start, end }
    }
    if (period === 'yearly') {
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now.getFullYear(), 11, 31)
      return { start, end }
    }
    if (period === 'custom') {
      let start = null
      if (customStartDate) {
        const [y, m, d] = customStartDate.split('-').map(Number)
        start = new Date(y, m - 1, d, 0, 0, 0, 0)
      }
      let end = null
      if (customEndDate) {
        const [y, m, d] = customEndDate.split('-').map(Number)
        end = new Date(y, m - 1, d, 23, 59, 59, 999)
      }
      return { start, end }
    }
    return null
  }

  const filterByPeriod = (items, dateKey) => {
    if (reportPeriod === 'all') return items
    const range = getPeriodRange(reportPeriod)
    if (!range) return items
    return items.filter((item) => {
      const d = item[dateKey] ? new Date(item[dateKey]) : null
      if (!d) return false
      const afterStart = range.start ? d >= range.start : true
      const beforeEnd = range.end ? d <= range.end : true
      return afterStart && beforeEnd
    })
  }

  const getReportData = (type) => {
    if (type === 'bills') return filterByPeriod(bills.filter(b => !b.deleted), 'date')
    if (type === 'customers') return filterByPeriod(customers, 'createdAt')
    if (type === 'payments') return filterByPeriod(payments, 'date')
    if (type === 'expenses') return filterByPeriod(expenses || [], 'date')
    if (type === 'inventory') return inventory
    return []
  }

  const generateReportPDF = (type, data) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const MARGIN = 12
    let y = 16
    let page = 1

    const fNum = (val) => {
      const num = Number(val)
      return isNaN(num) ? '0.00' : num.toFixed(2)
    }

    let cols = []
    let rows = []
    let title = ""

    if (type === 'bills') {
      title = "Bills Report"
      cols = [
        { label: 'Bill ID', w: 25 },
        { label: 'Customer', w: 45 },
        { label: 'Date', w: 25 },
        { label: 'Subtotal', w: 22 },
        { label: 'Discount', w: 22 },
        { label: 'Total', w: 22 },
        { label: 'Paid', w: 22 },
        { label: 'Balance', w: 22 },
        { label: 'Status', w: 20 }
      ]
      rows = data.map(b => [
        b.id || '',
        b.customerName || '',
        b.date || '',
        fNum(b.subtotal),
        b.discountAmount ? fNum(b.discountAmount) : fNum(b.discountValue),
        fNum(b.total),
        fNum(b.amountPaid),
        fNum(b.balance),
        (b.status || '').toUpperCase()
      ])
    } else if (type === 'customers') {
      title = "Customers Report"
      cols = [
        { label: 'Customer ID', w: 30 },
        { label: 'Type', w: 25 },
        { label: 'Name', w: 55 },
        { label: 'Phone', w: 35 },
        { label: 'Email', w: 50 },
        { label: 'Credit Bal', w: 25 },
        { label: 'Advance Bal', w: 25 }
      ]
      rows = data.map(c => [
        c.id || '',
        (c.type || '').toUpperCase(),
        c.name || '',
        c.phone || '—',
        c.email || '—',
        fNum(c.creditBalance),
        fNum(c.advanceBalance)
      ])
    } else if (type === 'payments') {
      title = "Payments Report"
      cols = [
        { label: 'Payment ID', w: 30 },
        { label: 'Bill ID', w: 30 },
        { label: 'Customer', w: 45 },
        { label: 'Date', w: 30 },
        { label: 'Cash Paid', w: 25 },
        { label: 'UPI Paid', w: 25 },
        { label: 'Total Paid', w: 25 },
        { label: 'Excess Credit', w: 25 }
      ]
      rows = data.map(p => [
        p.id || '',
        p.billId || '',
        p.customerId || '',
        p.date ? p.date.slice(0, 10) : '',
        fNum(p.cashAmount),
        fNum(p.upiAmount),
        fNum(p.totalPaid),
        fNum(p.excessCredit)
      ])
    } else if (type === 'expenses') {
      title = "Expenses Report"
      cols = [
        { label: 'Expense ID', w: 30 },
        { label: 'Date', w: 30 },
        { label: 'Description', w: 85 },
        { label: 'Cash Amount', w: 30 },
        { label: 'UPI Amount', w: 30 },
        { label: 'Total Amount', w: 35 }
      ]
      rows = data.map(e => [
        e.id || '',
        e.date || '',
        e.description || '',
        fNum(e.cashAmount),
        fNum(e.upiAmount),
        fNum(e.amount)
      ])
    } else if (type === 'inventory') {
      title = "Inventory Pricing Report"
      cols = [
        { label: 'Item ID', w: 30 },
        { label: 'Item Name', w: 75 },
        { label: 'Color Single', w: 30 },
        { label: 'Color Double', w: 30 },
        { label: 'B/W Single', w: 30 },
        { label: 'B/W Double', w: 30 }
      ]
      rows = data.map(i => [
        i.id || '',
        i.name || '',
        fNum(i.colorSingle),
        fNum(i.colorDouble),
        fNum(i.bwSingle),
        fNum(i.bwDouble)
      ])
    }

    const printHeaders = () => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setFillColor(240, 240, 240)
      doc.rect(MARGIN, y - 4, W - MARGIN * 2, 6, 'F')
      let curX = MARGIN + 2
      cols.forEach(col => {
        doc.text(col.label, curX, y)
        curX += col.w
      })
      y += 6
      doc.setLineWidth(0.2)
      doc.line(MARGIN, y - 4, W - MARGIN, y - 4)
      doc.setFont('helvetica', 'normal')
    }

    const checkPage = (needed = 8) => {
      if (y + needed > H - 12) {
        doc.setFontSize(8)
        doc.text(`Page ${page}`, W / 2, H - 6, { align: 'center' })
        doc.addPage()
        page++
        y = 16
        printHeaders()
      }
    }

    const getPeriodText = () => {
      if (reportPeriod === 'custom') {
        return `Custom (${customStartDate || 'Start'} to ${customEndDate || 'End'})`
      }
      return reportPeriod.toUpperCase()
    }

    // Title
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(title, MARGIN, y)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Period: ${getPeriodText()} · Generated: ${new Date().toLocaleString()} · Row Count: ${data.length}`, W - MARGIN, y, { align: 'right' })
    y += 10

    printHeaders()

    // Print rows
    doc.setFontSize(8)
    rows.forEach(row => {
      checkPage(7)
      let curX = MARGIN + 2
      row.forEach((cell, idx) => {
        const colWidth = cols[idx].w - 3
        const truncated = String(cell).substring(0, Math.floor(colWidth / 1.5))
        doc.text(truncated, curX, y)
        curX += cols[idx].w
      })
      y += 6
    })

    // Footer on last page
    doc.setFontSize(8)
    doc.text(`Page ${page}`, W / 2, H - 6, { align: 'center' })

    doc.save(`${type}-report-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const exportItems = [
    { label: 'Bills', type: 'bills', count: bills.filter((b) => !b.deleted).length, action: handleExportBills, desc: 'All active bills with full details' },
    { label: 'Customers', type: 'customers', count: customers.length, action: handleExportCustomers, desc: 'All customers with contact & balance info' },
    { label: 'Payments', type: 'payments', count: payments.length, action: handleExportPayments, desc: 'All payment records with cash/UPI split' },
    { label: 'Expenses', type: 'expenses', count: (expenses || []).length, action: handleExportExpenses, desc: 'All expenses with cash/UPI breakdown' },
    { label: 'Inventory', type: 'inventory', count: inventory.length, action: handleExportInventory, desc: 'Item pricing list' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>Data Management</h1>
        <p>Backup, export, and import your data safely.</p>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* Export */}
        <div className="card">
          <div style={{ marginBottom: '16px' }}>
            <h2>Export Data</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>Download data in JSON or CSV format for backup or analysis.</p>
          </div>

          <button className="btn btn-primary" onClick={handleFullBackup} style={{ width: '100%', marginBottom: '8px' }}>
            <Download size={16} /> Full Backup (JSON)
          </button>
          <p className="text-muted" style={{ fontSize: '0.78rem', marginBottom: '16px' }}>
            Complete backup of all data including settings, expenses, and users.
          </p>

          <hr style={{ margin: '8px 0 16px', opacity: 0.15 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {exportItems.map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.label} (CSV)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.desc} · <strong>{item.count}</strong> rows</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedReport(item.type)}>
                    View Report
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={item.action}>
                    <Download size={14} /> Export
                  </button>
                </div>
              </div>
            ))}
          </div>

          {exportMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginTop: '16px', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem' }}>
              <CheckCircle size={16} /> {exportMessage}
            </div>
          )}
        </div>

        {/* Import */}
        <div className="card">
          <div style={{ marginBottom: '16px' }}>
            <h2>Import Data</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>Upload JSON/CSV to restore or bulk-add data.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Import Type</label>
            <select className="form-select" value={importType} onChange={(e) => setImportType(e.target.value)}>
              <option value="backup">Full Backup (JSON) — restores everything</option>
              <option value="customers">Customers (CSV)</option>
              <option value="inventory">Inventory (CSV)</option>
            </select>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {importType === 'backup' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--error)' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span><strong>Format:</strong> JSON backup from this app. Replaces all current data.</span>
              </span>
            )}
            {importType === 'customers' && (
              <><strong>Columns:</strong> Type, Name, Phone, Email, Credit Balance</>
            )}
            {importType === 'inventory' && (
              <><strong>Columns:</strong> Name, Color Single, Color Double, B/W Single, B/W Double</>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={importType === 'backup' ? '.json' : '.csv'}
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />

          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} style={{ width: '100%' }}>
            <Upload size={16} /> Choose File & Import
          </button>

          {importMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              marginTop: '16px',
              background: importMessage.startsWith('Error') ? 'var(--error-bg)' : 'var(--success-bg)',
              border: `1px solid ${importMessage.startsWith('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              borderRadius: 'var(--radius-md)',
              color: importMessage.startsWith('Error') ? 'var(--error)' : 'var(--success)',
              fontSize: '0.875rem'
            }}>
              {importMessage.startsWith('Error') ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
              <span>{importMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Guide */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Backup Guide</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px' }}>
          {[
            { title: 'Regular Backups', desc: 'Create a JSON backup weekly. It includes all bills, customers, payments, expenses, and settings.' },
            { title: 'CSV Exports', desc: 'Export individual modules for Excel analysis. Each file includes all relevant columns.' },
            { title: 'Bulk Import', desc: 'Use CSV import to add multiple customers or inventory items at once from Excel.' },
            { title: 'Recovery', desc: 'Upload a JSON backup to restore everything. Current data will be replaced — always verify first.' },
          ].map((item) => (
            <div key={item.title} style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>{item.title}</div>
              <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Report Preview Section */}
      {selectedReport && (
        <div className="card report-print-area" style={{ marginTop: '24px' }}>
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0 }}>Report Preview: {selectedReport.toUpperCase()}</h2>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>Rows in report: {getReportData(selectedReport).length}</p>
            </div>
            {/* Period selector & Custom Date Range Wrapper */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                {['all', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'].map((p) => (
                  <button
                    key={p} type="button"
                    onClick={() => setReportPeriod(p)}
                    style={{
                      padding: '5px 12px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                      background: reportPeriod === p ? 'var(--accent)' : 'transparent',
                      color: reportPeriod === p ? '#fff' : '#71717a',
                    }}
                  >{p.charAt(0).toUpperCase() + p.slice(1)}</button>
                ))}
              </div>

              {reportPeriod === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>From:</label>
                    <input
                      type="date"
                      className="form-input"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '12px', width: '135px', height: '28px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>To:</label>
                    <input
                      type="date"
                      className="form-input"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '12px', width: '135px', height: '28px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => generateReportPDF(selectedReport, getReportData(selectedReport))}>
                <Download size={14} /> Download PDF
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                Print Report
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedReport(null)}>
                <X size={14} /> Close
              </button>
            </div>
          </div>

          {/* Print-only header */}
          <div className="print-only" style={{ display: 'none', marginBottom: '20px', borderBottom: '2px solid #ddd', paddingBottom: '12px' }}>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 'bold', color: '#111' }}>
              {business?.shopName || 'PrintPro'} — {selectedReport.charAt(0).toUpperCase() + selectedReport.slice(1)} Report
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#555', display: 'flex', gap: '16px' }}>
              <span><strong>Period:</strong> {reportPeriod === 'custom' ? `${customStartDate || 'Start'} to ${customEndDate || 'End'}` : reportPeriod.toUpperCase()}</span>
              <span><strong>Generated:</strong> {new Date().toLocaleString()}</span>
              <span><strong>Total Rows:</strong> {getReportData(selectedReport).length}</span>
            </p>
          </div>

          <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                {selectedReport === 'bills' && (
                  <tr>
                    <th>Bill ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Subtotal (₹)</th>
                    <th style={{ textAlign: 'right' }}>Discount (₹)</th>
                    <th style={{ textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ textAlign: 'right' }}>Paid (₹)</th>
                    <th style={{ textAlign: 'right' }}>Balance (₹)</th>
                    <th>Status</th>
                  </tr>
                )}
                {selectedReport === 'customers' && (
                  <tr>
                    <th>Customer ID</th>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th style={{ textAlign: 'right' }}>Credit Bal (₹)</th>
                    <th style={{ textAlign: 'right' }}>Advance Bal (₹)</th>
                  </tr>
                )}
                {selectedReport === 'payments' && (
                  <tr>
                    <th>Payment ID</th>
                    <th>Bill ID</th>
                    <th>Customer ID</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Cash (₹)</th>
                    <th style={{ textAlign: 'right' }}>UPI (₹)</th>
                    <th style={{ textAlign: 'right' }}>Total Paid (₹)</th>
                    <th style={{ textAlign: 'right' }}>Excess (₹)</th>
                  </tr>
                )}
                {selectedReport === 'expenses' && (
                  <tr>
                    <th>Expense ID</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Cash (₹)</th>
                    <th style={{ textAlign: 'right' }}>UPI (₹)</th>
                    <th style={{ textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                )}
                {selectedReport === 'inventory' && (
                  <tr>
                    <th>Item ID</th>
                    <th>Item Name</th>
                    <th style={{ textAlign: 'right' }}>Color Single (₹)</th>
                    <th style={{ textAlign: 'right' }}>Color Double (₹)</th>
                    <th style={{ textAlign: 'right' }}>B/W Single (₹)</th>
                    <th style={{ textAlign: 'right' }}>B/W Double (₹)</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {getReportData(selectedReport).map((row, idx) => (
                  <tr key={idx}>
                    {selectedReport === 'bills' && (
                      <>
                        <td style={{ fontFamily: 'monospace' }}>{row.id}</td>
                        <td>{row.customerName}</td>
                        <td>{row.date}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.subtotal).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.discountAmount ?? row.discountValue).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.total).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.amountPaid).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.balance).toFixed(2)}</td>
                        <td><span className={`badge badge-${row.status}`}>{row.status.toUpperCase()}</span></td>
                      </>
                    )}
                    {selectedReport === 'customers' && (
                      <>
                        <td style={{ fontFamily: 'monospace' }}>{row.id}</td>
                        <td><span className={`badge ${row.type === 'regular' ? 'badge-info' : 'badge-warning'}`}>{row.type.toUpperCase()}</span></td>
                        <td>{row.name}</td>
                        <td>{row.phone || '—'}</td>
                        <td>{row.email || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.creditBalance || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.advanceBalance || 0).toFixed(2)}</td>
                      </>
                    )}
                    {selectedReport === 'payments' && (
                      <>
                        <td style={{ fontFamily: 'monospace' }}>{row.id}</td>
                        <td>{row.billId}</td>
                        <td>{row.customerId}</td>
                        <td>{row.date ? row.date.slice(0, 10) : ''}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.cashAmount || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.upiAmount || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.totalPaid || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.excessCredit || 0).toFixed(2)}</td>
                      </>
                    )}
                    {selectedReport === 'expenses' && (
                      <>
                        <td style={{ fontFamily: 'monospace' }}>{row.id}</td>
                        <td>{row.date}</td>
                        <td>{row.description}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.cashAmount || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.upiAmount || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.amount || 0).toFixed(2)}</td>
                      </>
                    )}
                    {selectedReport === 'inventory' && (
                      <>
                        <td style={{ fontFamily: 'monospace' }}>{row.id}</td>
                        <td>{row.name}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.colorSingle || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.colorDouble || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.bwSingle || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row.bwDouble || 0).toFixed(2)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print-only styles for reports */}
      <style>{`
        @page {
          size: landscape;
          margin: 10mm 12mm;
        }
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, .sidebar, .header, .page-header, .grid-2, button, .btn {
            display: none !important;
          }
          .card:not(.report-print-area) {
            display: none !important;
          }
          .app-layout, .main-wrapper, .main-content {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            background: transparent !important;
          }
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .report-print-area {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
          }
          .print-only {
            display: block !important;
          }
          .report-print-area .table-container {
            max-height: none !important;
            overflow: visible !important;
          }
          .report-print-area table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 15px !important;
          }
          .report-print-area th,
          .report-print-area td {
            color: #000 !important;
            border: 1px solid #ddd !important;
            padding: 6px 10px !important;
            font-size: 11px !important;
          }
          .report-print-area td {
            word-break: break-word !important;
          }
          /* Keep ID and Status badges on one line */
          .report-print-area td:first-child,
          .report-print-area td .badge {
            white-space: nowrap !important;
          }
          .report-print-area th {
            background: #f4f4f5 !important;
            font-weight: bold !important;
            text-align: left;
          }
          .report-print-area tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  )
}

export default DataManagement
