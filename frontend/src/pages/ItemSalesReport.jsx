import React, { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { Calendar, Layers, Filter, Printer, Download, Share2, Copy, Check, TrendingUp, TrendingDown, Users, FileText } from 'lucide-react'
import { jsPDF } from 'jspdf'

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom Range' },
  { value: 'all', label: 'All Time' }
]

const getPeriodRange = (period) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'today') return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
  if (period === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    return { start: yesterday, end: new Date(yesterday.getTime() + 86400000 - 1) }
  }
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

const ItemSalesReport = () => {
  const { bills, customers, inventory } = useAppContext()

  // Filter States
  const [period, setPeriod] = useState('monthly')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [itemFilter, setItemFilter] = useState('all') // 'all', 'a4', 'a5', 'letter', 'legal', 'custom'
  const [serviceFilter, setServiceFilter] = useState('all') // 'all', 'printing', 'photocopy', 'lamination', 'binding', 'design', 'photography', 'other'
  const [printTypeFilter, setPrintTypeFilter] = useState('all') // 'all', 'color_single', 'color_double', 'bw_single', 'bw_double'
  const [customerFilter, setCustomerFilter] = useState('all') // 'all', 'regular', 'walkin', or customerId
  
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  // 1. Time range filtering
  const range = useMemo(() => {
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
    return getPeriodRange(period)
  }, [period, customStartDate, customEndDate])

  // Filtered bills by time range and customer
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      if (b.deleted || b.isGroupParent) return false

      // Time Range Filter
      const d = b.date ? new Date(b.date) : null
      if (range) {
        if (!d) return false
        if (range.start && d < range.start) return false
        if (range.end && d > range.end) return false
      }

      // Customer Filter
      if (customerFilter === 'regular') {
        if (b.customerType !== 'regular') return false
      } else if (customerFilter === 'walkin') {
        if (b.customerType !== 'random') return false
      } else if (customerFilter !== 'all') {
        if (b.customerId !== customerFilter) return false
      }

      return true
    })
  }, [bills, range, customerFilter])

  // Calculate items breakdown
  const salesData = useMemo(() => {
    const itemMap = {}
    let grandQty = 0
    let grandRevenue = 0

    // Revenue by print type breakdown
    const printTypeRevenue = {
      'Color Single': 0,
      'Color Double': 0,
      'B/W Single': 0,
      'B/W Double': 0
    }

    filteredBills.forEach(bill => {
      (bill.items || []).forEach(item => {
        const itemName = item.name || item.itemName || 'Custom Item'
        const printType = item.printType || 'bw'
        const sides = item.sides || 'single'
        const qty = Number(item.qty || 0)
        const unitPrice = Number(item.unitPrice || 0)
        const itemAmount = Number(item.amount || (qty * unitPrice))

        // A. Match Item Filter (A4, A5, Letter, Legal, Custom Paper)
        if (itemFilter !== 'all') {
          const lowerName = itemName.toLowerCase()
          if (itemFilter === 'a4' && !lowerName.includes('a4')) return
          if (itemFilter === 'a5' && !lowerName.includes('a5')) return
          if (itemFilter === 'letter' && !lowerName.includes('letter')) return
          if (itemFilter === 'legal' && !lowerName.includes('legal')) return
          if (itemFilter === 'custom' && (lowerName.includes('a4') || lowerName.includes('a5') || lowerName.includes('letter') || lowerName.includes('legal'))) return
        }

        // B. Match Service Filter
        if (serviceFilter !== 'all') {
          const lowerName = itemName.toLowerCase()
          if (serviceFilter === 'printing' && !lowerName.includes('print')) return
          if (serviceFilter === 'photocopy' && !lowerName.includes('copy') && !lowerName.includes('photocopy')) return
          if (serviceFilter === 'lamination' && !lowerName.includes('laminate') && !lowerName.includes('lamination')) return
          if (serviceFilter === 'binding' && !lowerName.includes('bind') && !lowerName.includes('binding')) return
          if (serviceFilter === 'design' && !lowerName.includes('design')) return
          if (serviceFilter === 'photography' && !lowerName.includes('photo') && !lowerName.includes('shoot')) return
          if (serviceFilter === 'other' && (
            lowerName.includes('print') || lowerName.includes('copy') || lowerName.includes('laminate') || 
            lowerName.includes('bind') || lowerName.includes('design') || lowerName.includes('photo')
          )) return
        }

        // C. Match Print Type Filter
        const pTypeKey = `${printType === 'color' ? 'Color' : 'B/W'} ${sides === 'double' ? 'Double' : 'Single'}`
        if (printTypeFilter !== 'all') {
          if (printTypeFilter === 'color_single' && (printType !== 'color' || sides !== 'single')) return
          if (printTypeFilter === 'color_double' && (printType !== 'color' || sides !== 'double')) return
          if (printTypeFilter === 'bw_single' && (printType !== 'bw' || sides !== 'single')) return
          if (printTypeFilter === 'bw_double' && (printType !== 'bw' || sides !== 'double')) return
        }

        // Add to aggregate item map
        if (!itemMap[itemName]) {
          itemMap[itemName] = { name: itemName, qty: 0, revenue: 0 }
        }
        itemMap[itemName].qty += qty
        itemMap[itemName].revenue += itemAmount

        // Add to print type breakdown
        if (pTypeKey in printTypeRevenue) {
          printTypeRevenue[pTypeKey] += itemAmount
        }

        grandQty += qty
        grandRevenue += itemAmount
      })
    })

    const itemsList = Object.values(itemMap)
    const sortedDesc = [...itemsList].sort((a, b) => b.revenue - a.revenue)
    const sortedAsc = [...itemsList].sort((a, b) => a.revenue - b.revenue)

    return {
      topSelling: sortedDesc.slice(0, 10),
      leastSelling: sortedAsc.slice(0, 10),
      printTypeRevenue,
      grandQty,
      grandRevenue
    }
  }, [filteredBills, itemFilter, serviceFilter, printTypeFilter])

  // Share message formatting
  const shareText = useMemo(() => {
    let text = `*Item Sales Report Summary*\nPeriod: ${period.toUpperCase()}\n`
    text += `Total Quantity Sold: ${salesData.grandQty}\n`
    text += `Total Revenue: ₹${salesData.grandRevenue.toFixed(2)}\n\n`
    text += `*Top 3 Selling Items:*\n`
    salesData.topSelling.slice(0, 3).forEach((item, index) => {
      text += `${index + 1}. ${item.name} - ₹${item.revenue.toFixed(2)} (${item.qty} units)\n`
    })
    return text
  }, [salesData, period])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Export PDF
  const downloadPDF = () => {
    const doc = new jsPDF()
    const W = doc.internal.pageSize.getWidth()
    let y = 15

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('ITEM SALES REPORT', W / 2, y, { align: 'center' })
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Period: ${period.toUpperCase()}`, 15, y)
    doc.text(`Generated: ${new Date().toLocaleString()}`, W - 15, y, { align: 'right' })
    y += 8

    doc.line(12, y, W - 12, y)
    y += 8

    // Summary widgets
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`Total Quantity Sold: ${salesData.grandQty} units`, 15, y)
    doc.text(`Total Revenue: Rs. ${salesData.grandRevenue.toFixed(2)}`, W - 15, y, { align: 'right' })
    y += 12

    // Top Selling Table
    doc.setFontSize(12)
    doc.text('Top Selling Items', 15, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Rank', 15, y)
    doc.text('Item Name', 30, y)
    doc.text('Qty Sold', W - 50, y, { align: 'right' })
    doc.text('Revenue', W - 15, y, { align: 'right' })
    y += 5
    doc.line(15, y, W - 15, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    salesData.topSelling.forEach((item, idx) => {
      if (y > 270) { doc.addPage(); y = 15 }
      doc.text(String(idx + 1), 15, y)
      doc.text(item.name.substring(0, 35), 30, y)
      doc.text(String(item.qty), W - 50, y, { align: 'right' })
      doc.text(`Rs. ${item.revenue.toFixed(2)}`, W - 15, y, { align: 'right' })
      y += 6
    })

    y += 10

    // Print Type Revenue Breakdown
    if (y > 240) { doc.addPage(); y = 15 }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Revenue by Print Type', 15, y)
    y += 6

    doc.setFontSize(9)
    Object.entries(salesData.printTypeRevenue).forEach(([type, rev]) => {
      doc.setFont('helvetica', 'normal')
      doc.text(type, 20, y)
      doc.text(`Rs. ${rev.toFixed(2)}`, W - 15, y, { align: 'right' })
      y += 6
    })

    doc.save('Item_Sales_Report.pdf')
  }

  // Export CSV / Excel
  const downloadCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,Rank,Item,Quantity,Revenue\n'
    salesData.topSelling.forEach((item, index) => {
      csvContent += `${index + 1},"${item.name}",${item.qty},${item.revenue}\n`
    })
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'item_sales_report.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Item Sales Report</h1>
        <p>Analyze item and printing sales performance with dynamic filters and volume breakdown.</p>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Filter size={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Filter Options</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {/* Time Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Time Filter</label>
            <select className="form-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Item Size Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Item Filter</label>
            <select className="form-select" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
              <option value="all">All Items</option>
              <option value="a4">A4</option>
              <option value="a5">A5</option>
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
              <option value="custom">Custom Paper</option>
            </select>
          </div>

          {/* Service Type Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Service Filter</label>
            <select className="form-select" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
              <option value="all">All Services</option>
              <option value="printing">Printing</option>
              <option value="photocopy">Photocopy</option>
              <option value="lamination">Lamination</option>
              <option value="binding">Binding</option>
              <option value="design">Design</option>
              <option value="photography">Photography</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Print Type Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Print Type Filter</label>
            <select className="form-select" value={printTypeFilter} onChange={(e) => setPrintTypeFilter(e.target.value)}>
              <option value="all">All Print Types</option>
              <option value="color_single">Color Single Side</option>
              <option value="color_double">Color Double Side</option>
              <option value="bw_single">B/W Single Side</option>
              <option value="bw_double">B/W Double Side</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Customer Filter</label>
            <select className="form-select" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
              <option value="all">All Customers</option>
              <option value="regular">Regular Customers</option>
              <option value="walkin">Walk-in Customers</option>
              {customers.filter(c => !c.deleted).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">From Date</label>
              <input type="date" className="form-input" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">To Date</label>
              <input type="date" className="form-input" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Grid Summary Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
          <TrendingUp size={24} style={{ color: 'var(--success)', marginBottom: '8px' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Total Revenue (Filtered)</span>
          <h2 style={{ fontSize: '2rem', margin: '4px 0', color: 'var(--success)' }}>₹{salesData.grandRevenue.toFixed(2)}</h2>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
          <Layers size={24} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Total Quantity Sold</span>
          <h2 style={{ fontSize: '2rem', margin: '4px 0', color: 'var(--accent)' }}>{salesData.grandQty} units</h2>
        </div>
      </div>

      {/* Main Report Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Side: Top and Least Selling Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} style={{ color: 'var(--success)' }} /> Top Selling Items
            </h2>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Qty Sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.topSelling.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>No sales data matching filters.</td>
                    </tr>
                  ) : (
                    salesData.topSelling.map((item, idx) => (
                      <tr key={idx}>
                        <td><strong>{idx + 1}</strong></td>
                        <td>{item.name}</td>
                        <td style={{ textAlign: 'right' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.revenue.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingDown size={18} style={{ color: 'var(--error)' }} /> Least Selling Items (Inventory Planning)
            </h2>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Qty Sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.leastSelling.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>No sales data matching filters.</td>
                    </tr>
                  ) : (
                    salesData.leastSelling.map((item, idx) => (
                      <tr key={idx}>
                        <td><strong>{idx + 1}</strong></td>
                        <td>{item.name}</td>
                        <td style={{ textAlign: 'right' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.revenue.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Print Type Breakdown & Exports */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Print Type Breakdown */}
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Revenue by Print Type</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(salesData.printTypeRevenue).map(([type, rev]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span className="text-muted">{type}</span>
                  <strong>₹{rev.toFixed(2)}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions / Export Options */}
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Export &amp; Share Options</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-primary" onClick={downloadPDF} style={{ gap: '8px' }}>
                <Download size={16} /> Export as PDF
              </button>
              <button className="btn btn-secondary" onClick={downloadCSV} style={{ gap: '8px' }}>
                <FileText size={16} /> Export as CSV
              </button>
              <button className="btn btn-secondary" onClick={() => window.print()} style={{ gap: '8px' }}>
                <Printer size={16} /> Print Report
              </button>
              <button className="btn btn-secondary" onClick={copyToClipboard} style={{ gap: '8px' }}>
                {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                {copied ? 'Copied to Clipboard!' : 'Copy Summary'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShareOpen(!shareOpen)} style={{ gap: '8px' }}>
                <Share2 size={16} /> Share via WhatsApp
              </button>

              {shareOpen && (
                <div style={{ marginTop: '8px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Send text summary to WhatsApp:</p>
                  <a
                    className="btn btn-primary btn-sm"
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none', display: 'inline-flex', justifyContent: 'center' }}
                  >
                    Open WhatsApp Web
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ItemSalesReport
