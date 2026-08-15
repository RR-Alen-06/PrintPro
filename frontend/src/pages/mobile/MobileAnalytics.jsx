import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { usePayments, useInventory } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import { jsPDF } from 'jspdf'
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Wallet,
  Calendar, Download, Users, Inbox, Banknote, Smartphone,
  Layers, ChevronRight, Activity, Percent, ArrowUpRight, ArrowDownRight, Loader2
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileAnalytics() {
  const navigate = useNavigate()
  const { showToast } = useAppContext()

  // TanStack Queries
  const { data: bills = [], isLoading: isLoadingBills } = useBills()
  const { data: payments = [], isLoading: isLoadingPayments } = usePayments()
  const { data: expenses = [], isLoading: isLoadingExpenses } = useExpenses()
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: inventory = [], isLoading: isLoadingInventory } = useInventory()

  const [period, setPeriod] = useState('monthly') // 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'all'
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Date range calculation
  const activeDateRange = useMemo(() => {
    const today = new Date()
    let start = null
    let end = null

    if (period === 'daily') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
    } else if (period === 'weekly') {
      const day = today.getDay()
      const diff = today.getDate() - day
      start = new Date(today.getFullYear(), today.getMonth(), diff, 0, 0, 0, 0)
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
    } else if (period === 'monthly') {
      start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (period === 'quarterly') {
      const q = Math.floor(today.getMonth() / 3)
      start = new Date(today.getFullYear(), q * 3, 1, 0, 0, 0, 0)
      end = new Date(today.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999)
    } else if (period === 'yearly') {
      start = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0)
      end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999)
    } else if (period === 'custom') {
      start = customStartDate ? new Date(customStartDate) : null
      if (start) start.setHours(0, 0, 0, 0)
      end = customEndDate ? new Date(customEndDate) : null
      if (end) end.setHours(23, 59, 59, 999)
    }

    return { start, end }
  }, [period, customStartDate, customEndDate])

  // Filtered dataset
  const filteredBills = useMemo(() => {
    const { start, end } = activeDateRange
    return (bills || []).filter((b) => {
      if (b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false
      if (!start || !end) return true
      const d = new Date(b.date)
      return d >= start && d <= end
    })
  }, [bills, activeDateRange])

  const filteredPayments = useMemo(() => {
    const { start, end } = activeDateRange
    return (payments || []).filter((p) => {
      if (!start || !end) return true
      const d = new Date(p.date)
      return d >= start && d <= end
    })
  }, [payments, activeDateRange])

  const filteredExpenses = useMemo(() => {
    const { start, end } = activeDateRange
    return (expenses || []).filter((e) => {
      if (!start || !end) return true
      const d = new Date(e.date)
      return d >= start && d <= end
    })
  }, [expenses, activeDateRange])

  // Core Financial Aggregations
  const metrics = useMemo(() => {
    const totalRev = filteredBills.reduce((s, b) => s + Number(b.total || 0), 0)
    const normalPayments = filteredPayments.filter(p => !p.isRefund && !p.is_refund && p.paymentType !== 'refund' && Number(p.totalPaid || p.total_paid || 0) >= 0)
    const refundPayments = filteredPayments.filter(p => p.isRefund || p.is_refund || p.paymentType === 'refund' || Number(p.totalPaid || p.total_paid || 0) < 0)

    const totalCashCollected = normalPayments.reduce((s, p) => s + Number(p.cashAmount || p.cash_amount || 0), 0)
    const totalUpiCollected = normalPayments.reduce((s, p) => s + Number(p.upiAmount || p.upi_amount || 0), 0)
    const totalPaid = totalCashCollected + totalUpiCollected

    const totalCashExpenses = filteredExpenses.reduce((s, e) => s + Number(e.cashAmount || (e.paymentMethod === 'cash' ? e.amount : 0) || 0), 0)
    const totalUpiExpenses = filteredExpenses.reduce((s, e) => s + Number(e.upiAmount || (e.paymentMethod === 'upi' ? e.amount : 0) || (e.cashAmount === undefined ? e.amount : 0)), 0)
    const totalExp = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)

    const totalRefunds = refundPayments.reduce((s, p) => s + Math.abs(Number(p.totalPaid || p.total_paid || 0)), 0)
    const totalOutstanding = filteredBills.reduce((s, b) => s + Number(b.balance || 0), 0)
    const netProfit = totalPaid - totalExp - totalRefunds

    const ordersCount = filteredBills.length
    const averageOrder = ordersCount > 0 ? totalRev / ordersCount : 0
    const activeClientsCount = (customers || []).filter(c => !c.deleted && !c.deleted_at).length

    // Payment preference percentages
    const paySum = totalCashCollected + totalUpiCollected
    const cashPercent = paySum > 0 ? (totalCashCollected / paySum) * 100 : 50
    const upiPercent = paySum > 0 ? (totalUpiCollected / paySum) * 100 : 50

    return {
      totalRev,
      totalPaid,
      totalExp,
      totalRefunds,
      totalOutstanding,
      netProfit,
      ordersCount,
      averageOrder,
      activeClientsCount,
      totalCashCollected,
      totalUpiCollected,
      totalCashExpenses,
      totalUpiExpenses,
      cashPercent,
      upiPercent,
      marginPercent: totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) : '0.0'
    }
  }, [filteredBills, filteredPayments, filteredExpenses, customers])

  // Revenue Trends over past 6 units (e.g. days or months)
  const trendData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const today = new Date()
    const map = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const yr = d.getFullYear()
      const mo = d.getMonth()
      const label = `${monthNames[mo]} ${String(yr).slice(-2)}`

      const sum = (bills || []).filter(b => {
        if (b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false
        const bd = new Date(b.date)
        return bd.getFullYear() === yr && bd.getMonth() === mo
      }).reduce((s, b) => s + Number(b.total || 0), 0)

      map.push({ label, amount: sum })
    }

    const maxVal = Math.max(...map.map(m => m.amount), 1)
    return map.map(m => ({ ...m, percent: Math.max(8, (m.amount / maxVal) * 100) }))
  }, [bills])

  // Top Customers by Revenue in period
  const topCustomers = useMemo(() => {
    const map = {}
    filteredBills.forEach(b => {
      const cId = b.customerId || b.customer_id || 'walkin'
      const name = b.customerName || b.customer_name || 'Walk-in Client'
      if (!map[cId]) map[cId] = { name, total: 0, orders: 0 }
      map[cId].total += Number(b.total || 0)
      map[cId].orders += 1
    })

    const list = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
    const maxCust = Math.max(...list.map(l => l.total), 1)
    return list.map(l => ({ ...l, percent: Math.max(10, (l.total / maxCust) * 100) }))
  }, [filteredBills])

  // Top Items by Revenue
  const topItems = useMemo(() => {
    const map = {}
    filteredBills.forEach(b => {
      ;(b.items || []).forEach(item => {
        const key = item.itemName || item.name || item.item_name || 'Custom Item'
        if (!map[key]) map[key] = { name: key, totalRev: 0, qty: 0 }
        map[key].totalRev += Number(item.amount || 0)
        map[key].qty += Number(item.qty || 1)
      })
    })

    const list = Object.values(map).sort((a, b) => b.totalRev - a.totalRev).slice(0, 5)
    const maxItem = Math.max(...list.map(l => l.totalRev), 1)
    return list.map(l => ({ ...l, percent: Math.max(10, (l.totalRev / maxItem) * 100) }))
  }, [filteredBills])

  // Download PDF Report
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text('PrintPro Store Analytics Report', 14, 20)
      doc.setFontSize(10)
      doc.text(`Period: ${period.toUpperCase()} | Generated: ${new Date().toLocaleDateString()}`, 14, 28)

      doc.text(`Total Invoiced Revenue: Rs. ${metrics.totalRev.toFixed(2)}`, 14, 40)
      doc.text(`Total Realized Inflow: Rs. ${metrics.totalPaid.toFixed(2)}`, 14, 48)
      doc.text(`Total Operating Expenses: Rs. ${metrics.totalExp.toFixed(2)}`, 14, 56)
      doc.text(`Net Cash Profit: Rs. ${metrics.netProfit.toFixed(2)}`, 14, 64)
      doc.text(`Outstanding Balance: Rs. ${metrics.totalOutstanding.toFixed(2)}`, 14, 72)
      doc.text(`Total Orders: ${metrics.ordersCount} | Avg Order: Rs. ${metrics.averageOrder.toFixed(2)}`, 14, 80)

      doc.save(`printpro_analytics_${period}_${new Date().toISOString().slice(0, 10)}.pdf`)
      showToast('Analytics summary downloaded as PDF', 'success')
    } catch (e) {
      showToast('Failed to export PDF', 'error')
    }
  }

  const isLoading = isLoadingBills || isLoadingPayments || isLoadingExpenses

  return (
    <MobileLayout title="Store Analytics" onSwitchToDesktop={() => navigate('/analytics')}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
            BUSINESS INTELLIGENCE
          </span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
            STORE ANALYTICS
          </h2>
        </div>
        <button
          className="mobile-btn mobile-btn-secondary"
          onClick={handleDownloadPDF}
          style={{ width: 'auto', padding: '0 10px', minHeight: '34px', fontSize: '0.75rem' }}
        >
          <Download size={14} /> Export PDF
        </button>
      </div>

      {/* Period Filter Pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
        {[
          { id: 'daily', label: 'Today' },
          { id: 'weekly', label: 'Weekly' },
          { id: 'monthly', label: 'Monthly' },
          { id: 'quarterly', label: 'Quarterly' },
          { id: 'yearly', label: 'Yearly' },
          { id: 'all', label: 'All Time' },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
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

      {/* Loading Indicator */}
      {isLoading && (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '20px', marginBottom: '14px' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 6px auto' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Aggregating analytics data...</div>
        </div>
      )}

      {/* KPI Highlights Carousel / Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>NET CASH PROFIT</div>
          <div
            className="currency-num"
            style={{
              fontSize: '1.25rem',
              fontWeight: 900,
              marginTop: '4px',
              color: metrics.netProfit >= 0 ? 'var(--success)' : 'var(--error)',
            }}
          >
            ₹{metrics.netProfit.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Margin: <strong>{metrics.marginPercent}%</strong>
          </div>
        </div>

        <div className="mobile-card" style={{ borderColor: 'var(--accent-secondary)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>REALIZED INFLOW</div>
          <div
            className="currency-num"
            style={{ fontSize: '1.25rem', fontWeight: 900, marginTop: '4px', color: 'var(--accent-secondary)' }}
          >
            ₹{metrics.totalPaid.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            From {metrics.ordersCount} Orders
          </div>
        </div>

        <div className="mobile-card">
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>TOTAL REVENUE</div>
          <div
            className="currency-num"
            style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}
          >
            ₹{metrics.totalRev.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="mobile-card">
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>OPERATING EXPENSES</div>
          <div
            className="currency-num"
            style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '4px', color: 'var(--error)' }}
          >
            ₹{metrics.totalExp.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="mobile-card">
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>OUTSTANDING DUE</div>
          <div
            className="currency-num"
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              marginTop: '4px',
              color: metrics.totalOutstanding > 0 ? 'var(--warning)' : 'var(--success)',
            }}
          >
            ₹{metrics.totalOutstanding.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="mobile-card">
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>AVG ORDER VALUE</div>
          <div
            className="currency-num"
            style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '4px', color: '#ffffff' }}
          >
            ₹{metrics.averageOrder.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Payment Method Split Breakdown */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
          PAYMENT METHOD BREAKDOWN
        </h4>

        {/* Stacked Preference Bar */}
        <div style={{ height: '18px', borderRadius: 'var(--radius-full)', background: 'var(--bg-input)', overflow: 'hidden', display: 'flex', marginBottom: '8px' }}>
          <div style={{ width: `${metrics.cashPercent}%`, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#0f172a' }}>
            {metrics.cashPercent > 20 && `Cash ${metrics.cashPercent.toFixed(0)}%`}
          </div>
          <div style={{ width: `${metrics.upiPercent}%`, background: '#00f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#0f172a' }}>
            {metrics.upiPercent > 20 && `UPI ${metrics.upiPercent.toFixed(0)}%`}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
          <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Banknote size={12} style={{ color: '#10b981' }} /> Cash Collected
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
              ₹{metrics.totalCashCollected.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Smartphone size={12} style={{ color: '#00f0ff' }} /> UPI Collected
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#00f0ff', marginTop: '2px' }}>
              ₹{metrics.totalUpiCollected.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Monthly Revenue Trends Chart */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px 0' }}>
          6-MONTH REVENUE TRAJECTORY
        </h4>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', gap: '8px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
          {trendData.map((item, idx) => (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                ₹{item.amount >= 1000 ? `${(item.amount / 1000).toFixed(1)}k` : item.amount}
              </div>
              <div
                style={{
                  width: '100%',
                  maxWidth: '30px',
                  height: `${item.percent}%`,
                  background: idx === trendData.length - 1 ? 'linear-gradient(180deg, #ff2fb0, #00f0ff)' : 'rgba(0, 240, 255, 0.4)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.5s ease',
                }}
              />
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '6px' }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 5 Customers by Revenue */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
          TOP CLIENTS BY REVENUE
        </h4>

        {topCustomers.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
            No customer revenue recorded in this period.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topCustomers.map((cust, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cust.name}</span>
                  <span className="currency-num" style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
                    ₹{cust.total.toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: 'var(--radius-full)', background: 'var(--bg-input)', overflow: 'hidden' }}>
                  <div style={{ width: `${cust.percent}%`, height: '100%', background: '#ff2fb0' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top 5 Items by Revenue */}
      <div className="mobile-card">
        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
          TOP PRINT ITEMS / PRODUCTS
        </h4>

        {topItems.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
            No item sales recorded in this period.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topItems.map((item, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.name} ({item.qty} units)</span>
                  <span className="currency-num" style={{ fontWeight: 800, color: 'var(--success)' }}>
                    ₹{item.totalRev.toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: 'var(--radius-full)', background: 'var(--bg-input)', overflow: 'hidden' }}>
                  <div style={{ width: `${item.percent}%`, height: '100%', background: '#10b981' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  )
}
