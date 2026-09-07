import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import {
  BarChart3, Search, Printer, Tag, Loader2, Download,
  FileText, Share2, TrendingUp, TrendingDown, ChevronDown,
  ChevronUp, Layers
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import '../../styles/mobile.css'

const PERIOD_PILLS = [
  { id: 'today', label: 'Today' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
  { id: 'all', label: 'All Time' },
]

const PRINT_TYPE_PILLS = [
  { id: 'all', label: 'All Types' },
  { id: 'color_single', label: 'Color Single' },
  { id: 'color_double', label: 'Color Double' },
  { id: 'bw_single', label: 'B/W Single' },
  { id: 'bw_double', label: 'B/W Double' },
]

const getPeriodRange = (period) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'today') return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
  if (period === 'weekly') {
    const day = today.getDay()
    const mon = new Date(today)
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return { start: mon, end: new Date(sun.getTime() + 86400000 - 1) }
  }
  if (period === 'monthly') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) }
  }
  if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3)
    return { start: new Date(now.getFullYear(), q * 3, 1), end: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999) }
  }
  if (period === 'yearly') {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) }
  }
  return null
}

export default function MobileItemSalesReport() {
  const navigate = useNavigate()
  const { showToast } = useAppContext()
  const { data: bills = [], isLoading: isLoadingBills } = useBills()
  const { data: customers = [] } = useCustomers()

  // Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [period, setPeriod] = useState('monthly')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [printTypeFilter, setPrintTypeFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [showLeastSelling, setShowLeastSelling] = useState(false)

  // 1. Time range calculation
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

  // Filtered bills
  const filteredBills = useMemo(() => {
    return (bills || []).filter((b) => {
      if (b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false

      const d = b.date ? new Date(b.date) : null
      if (range) {
        if (!d) return false
        if (range.start && d < range.start) return false
        if (range.end && d > range.end) return false
      }

      const cId = b.customerId || b.customer_id
      const cType = b.customerType || b.customer_type
      if (customerFilter === 'regular') {
        if (cType !== 'regular') return false
      } else if (customerFilter === 'walkin') {
        if (cType !== 'random' && cId) return false
      } else if (customerFilter !== 'all') {
        if (cId !== customerFilter) return false
      }

      return true
    })
  }, [bills, range, customerFilter])

  // Calculate items breakdown
  const salesData = useMemo(() => {
    const itemMap = {}
    let grandQty = 0
    let grandRevenue = 0

    const printTypeRevenue = {
      'Color Single': 0,
      'Color Double': 0,
      'B/W Single': 0,
      'B/W Double': 0,
    }

    filteredBills.forEach((bill) => {
      ;(bill.items || []).forEach((item) => {
        const itemName = item.name || item.itemName || item.item_name || 'Custom Item'
        const printType = (item.printType || 'bw').toLowerCase()
        const sides = (item.sides || 'single').toLowerCase()
        const qty = Number(item.qty || 0)
        const unitPrice = Number(item.unitPrice || item.price || 0)
        const itemAmount = Number(item.amount || (qty * unitPrice))

        // Search term filter
        if (searchTerm.trim() && !itemName.toLowerCase().includes(searchTerm.toLowerCase().trim())) {
          return
        }

        // Print type filter
        const pTypeKey = `${printType === 'color' ? 'Color' : 'B/W'} ${sides === 'double' ? 'Double' : 'Single'}`
        if (printTypeFilter !== 'all') {
          if (printTypeFilter === 'color_single' && (printType !== 'color' || sides !== 'single')) return
          if (printTypeFilter === 'color_double' && (printType !== 'color' || sides !== 'double')) return
          if (printTypeFilter === 'bw_single' && (printType !== 'bw' || sides !== 'single')) return
          if (printTypeFilter === 'bw_double' && (printType !== 'bw' || sides !== 'double')) return
        }

        if (!itemMap[itemName]) {
          itemMap[itemName] = { name: itemName, qty: 0, revenue: 0, count: 0 }
        }
        itemMap[itemName].qty += qty
        itemMap[itemName].revenue += itemAmount
        itemMap[itemName].count += 1

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
      topSelling: sortedDesc,
      leastSelling: sortedAsc.slice(0, 5),
      printTypeRevenue,
      grandQty,
      grandRevenue,
    }
  }, [filteredBills, searchTerm, printTypeFilter])

  // PDF Export
  const handleDownloadPDF = () => {
    try {
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
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, W - 15, y, { align: 'right' })
      y += 8
      doc.line(12, y, W - 12, y)
      y += 8

      const grandRev = salesData.grandRevenue || 0
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`Total Quantity Sold: ${salesData.grandQty} units`, 15, y)
      doc.text(`Total Revenue: Rs. ${grandRev.toFixed(2)}`, W - 15, y, { align: 'right' })
      y += 12

      doc.setFontSize(12)
      doc.text('Top Selling Items', 15, y)
      y += 6

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Rank', 15, y)
      doc.text('Item Name', 30, y)
      doc.text('Qty Sold', W - 65, y, { align: 'right' })
      doc.text('Revenue', W - 15, y, { align: 'right' })
      y += 5
      doc.line(15, y, W - 15, y)
      y += 5

      doc.setFont('helvetica', 'normal')
      salesData.topSelling.slice(0, 15).forEach((item, idx) => {
        if (y > 270) { doc.addPage(); y = 15 }
        doc.text(String(idx + 1), 15, y)
        doc.text(item.name.substring(0, 30), 30, y)
        doc.text(String(item.qty), W - 65, y, { align: 'right' })
        doc.text(`Rs. ${item.revenue.toFixed(2)}`, W - 15, y, { align: 'right' })
        y += 6
      })

      doc.save(`item_sales_${period}_${new Date().toISOString().slice(0, 10)}.pdf`)
      showToast('Item Sales Report downloaded as PDF', 'success')
    } catch (e) {
      showToast('Failed to export PDF', 'error')
    }
  }

  // CSV Export
  const handleDownloadCSV = () => {
    try {
      const grandRev = salesData.grandRevenue || 0
      let csvContent = 'data:text/csv;charset=utf-8,Rank,Item,Quantity,Revenue,Share %\n'
      salesData.topSelling.forEach((item, index) => {
        const sharePct = grandRev > 0 ? ((item.revenue / grandRev) * 100).toFixed(1) : '0.0'
        csvContent += `${index + 1},"${item.name}",${item.qty},${item.revenue},${sharePct}%\n`
      })
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `item_sales_${period}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('CSV downloaded', 'success')
    } catch (e) {
      showToast('Failed to export CSV', 'error')
    }
  }

  // Share via WhatsApp / Native Share
  const handleShare = async () => {
    let text = `*Item Sales Report Summary*\n`
    text += `Period: ${period.toUpperCase()}\n`
    text += `Total Quantity Sold: ${salesData.grandQty} units\n`
    text += `Total Revenue: ₹${salesData.grandRevenue.toLocaleString('en-IN')}\n\n`
    text += `*Top Selling Items:*\n`
    salesData.topSelling.slice(0, 5).forEach((item, idx) => {
      text += `${idx + 1}. ${item.name} - ₹${item.revenue.toLocaleString('en-IN')} (${item.qty} units)\n`
    })

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Item Sales Report', text })
        return
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err)
      }
    }

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(whatsappUrl, '_blank')
  }

  const maxPrintRev = Math.max(...Object.values(salesData.printTypeRevenue), 1)

  return (
    <MobileLayout title="Item Sales Analytics">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
            CATALOG PERFORMANCE
          </span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
            ITEM SALES REPORT
          </h2>
        </div>
      </div>

      {/* Period Filter Pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '8px' }}>
        {PERIOD_PILLS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            style={{
              padding: '5px 11px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.73rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: period === p.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: period === p.id ? 'rgba(0, 240, 255, 0.15)' : 'var(--bg-input)',
              color: period === p.id ? 'var(--accent-primary)' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom Date Inputs */}
      {period === 'custom' && (
        <div className="mobile-card" style={{ padding: '10px', marginBottom: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                START DATE
              </label>
              <input
                type="date"
                className="mobile-input"
                style={{ fontSize: '0.75rem', padding: '5px 8px' }}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                END DATE
              </label>
              <input
                type="date"
                className="mobile-input"
                style={{ fontSize: '0.75rem', padding: '5px 8px' }}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Print Type Filter Pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '10px' }}>
        {PRINT_TYPE_PILLS.map((pt) => (
          <button
            key={pt.id}
            onClick={() => setPrintTypeFilter(pt.id)}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.7rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: printTypeFilter === pt.id ? '1px solid var(--accent-secondary)' : '1px solid var(--border)',
              background: printTypeFilter === pt.id ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-input)',
              color: printTypeFilter === pt.id ? 'var(--accent-secondary)' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
            }}
          >
            {pt.label}
          </button>
        ))}
      </div>

      {/* Customer Filter Select & Search */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="mobile-input"
            style={{ paddingLeft: '32px', fontSize: '0.78rem', height: '38px' }}
            placeholder="Search item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <select
            className="mobile-input"
            style={{ fontSize: '0.75rem', height: '38px', padding: '0 8px' }}
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="all">All Clients</option>
            <option value="regular">Regular</option>
            <option value="walkin">Walk-in</option>
            {(customers || []).filter(c => !c.deleted && !c.deleted_at).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', padding: '12px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' }}>TOTAL REVENUE</div>
          <div className="currency-num" style={{ fontSize: '1.25rem', fontWeight: 900, marginTop: '2px', color: 'var(--accent-primary)' }}>
            ₹{salesData.grandRevenue.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="mobile-card" style={{ borderColor: 'var(--accent-secondary)', padding: '12px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' }}>TOTAL QTY SOLD</div>
          <div className="currency-num" style={{ fontSize: '1.25rem', fontWeight: 900, marginTop: '2px', color: 'var(--accent-secondary)' }}>
            {salesData.grandQty.toLocaleString('en-IN')} units
          </div>
        </div>
      </div>

      {/* Export & Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <button
          className="mobile-btn mobile-btn-secondary"
          onClick={handleDownloadPDF}
          style={{ minHeight: '36px', fontSize: '0.75rem', padding: '0 6px' }}
        >
          <Download size={13} /> PDF
        </button>
        <button
          className="mobile-btn mobile-btn-secondary"
          onClick={handleDownloadCSV}
          style={{ minHeight: '36px', fontSize: '0.75rem', padding: '0 6px' }}
        >
          <FileText size={13} /> CSV
        </button>
        <button
          className="mobile-btn mobile-btn-primary"
          onClick={handleShare}
          style={{ minHeight: '36px', fontSize: '0.75rem', padding: '0 6px' }}
        >
          <Share2 size={13} /> Share
        </button>
      </div>

      {/* Loading indicator */}
      {isLoadingBills && (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '24px', marginBottom: '14px' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Calculating sales analytics...</p>
        </div>
      )}

      {/* Revenue by Print Type */}
      <div className="mobile-card" style={{ marginBottom: '14px' }}>
        <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Printer size={14} style={{ color: 'var(--accent-primary)' }} /> REVENUE BY PRINT TYPE
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(salesData.printTypeRevenue).map(([type, rev], idx) => {
            const sharePct = (salesData.grandRevenue || 0) > 0 ? ((rev / salesData.grandRevenue) * 100).toFixed(1) : '0.0'
            const barWidth = Math.max(5, (rev / maxPrintRev) * 100)
            return (
              <div key={type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {type} <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>({sharePct}%)</span>
                  </span>
                  <span className="currency-num" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                    ₹{rev.toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ height: '5px', borderRadius: 'var(--radius-full)', background: 'var(--bg-input)', overflow: 'hidden' }}>
                  <div style={{ width: `${barWidth}%`, height: '100%', background: idx % 2 === 0 ? '#00f0ff' : '#ff2fb0' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top Selling Items List */}
      <div className="mobile-card" style={{ marginBottom: '14px' }}>
        <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={14} style={{ color: 'var(--success)' }} /> TOP SELLING ITEMS ({salesData.topSelling.length})
        </h4>

        {salesData.topSelling.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No sales matching current filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {salesData.topSelling.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-input)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {idx + 1}. {item.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {item.qty} units sold • {item.count} orders
                  </div>
                </div>
                <div className="currency-num" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  ₹{item.revenue.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Least Selling Items (Collapsible) */}
      <div className="mobile-card">
        <div
          onClick={() => setShowLeastSelling(!showLeastSelling)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingDown size={14} style={{ color: 'var(--error)' }} /> LEAST SELLING ITEMS
          </div>
          {showLeastSelling ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>

        {showLeastSelling && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {salesData.leastSelling.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                No items found.
              </div>
            ) : (
              salesData.leastSelling.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-input)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {item.name} ({item.qty} units)
                  </div>
                  <div className="currency-num" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--error)' }}>
                    ₹{item.revenue.toLocaleString('en-IN')}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  )
}

