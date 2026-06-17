import React, { useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import PeriodReport from '../components/PeriodReport'
import { Banknote, Smartphone } from 'lucide-react'

const Analytics = () => {
  const { bills, customers, inventory, payments, expenses, advancePayments } = useAppContext()

  const totalAdvanceCollected = useMemo(() => {
    return (advancePayments || []).reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
  }, [advancePayments])

  const salesSummary = useMemo(() => {
    const totalRevenue = bills.filter((bill) => !bill.deleted).reduce((sum, bill) => sum + Number(bill.total || 0), 0)
    const totalPaid = bills.filter((bill) => !bill.deleted).reduce((sum, bill) => sum + Number(bill.amountPaid || 0), 0)
    const outstanding = bills.filter((bill) => !bill.deleted).reduce((sum, bill) => sum + Number(bill.balance || 0), 0)
    const count = bills.filter((bill) => !bill.deleted).length
    return { totalRevenue, totalPaid, outstanding, count }
  }, [bills])

  const revenueByCustomer = useMemo(() => {
    const revenue = {}
    bills.filter((bill) => !bill.deleted).forEach((bill) => {
      revenue[bill.customerName] = (revenue[bill.customerName] || 0) + Number(bill.total || 0)
    })
    return Object.entries(revenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }))
  }, [bills])

  const printTypeAnalysis = useMemo(() => {
    const counts = {
      'Color Single': 0,
      'Color Double': 0,
      'B/W Single': 0,
      'B/W Double': 0,
    }

    bills.filter((bill) => !bill.deleted).forEach((bill) => {
      bill.items?.forEach((item) => {
        const key = `${item.printType === 'color' ? 'Color' : 'B/W'} ${item.sides === 'double' ? 'Double' : 'Single'}`
        counts[key] = (counts[key] || 0) + (Number(item.qty) || 0)
      })
    })

    const maxCount = Math.max(...Object.values(counts), 1)
    return Object.keys(counts).map((label) => ({ label, count: counts[label], share: counts[label] / maxCount }))
  }, [bills])

  const monthlyTrend = useMemo(() => {
    const months = {}
    const now = new Date()
    for (let i = 0; i < 6; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = date.toLocaleString('default', { month: 'short', year: 'numeric' })
      months[key] = 0
    }

    bills.filter((bill) => !bill.deleted).forEach((bill) => {
      const billDate = new Date(bill.date)
      const key = billDate.toLocaleString('default', { month: 'short', year: 'numeric' })
      if (key in months) {
        months[key] += Number(bill.total || 0)
      }
    })

    return Object.entries(months)
      .reverse()
      .map(([name, value]) => ({ name, value, share: value / Math.max(...Object.values(months), 1) }))
  }, [bills])

  const averageOrder = salesSummary.count ? salesSummary.totalRevenue / salesSummary.count : 0

  // ── Payment method summary ─────────────────────────────────────────────────
  const paymentMethodSummary = useMemo(() => {
    const cashCollected = payments.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const upiCollected = payments.reduce((s, p) => s + Number(p.upiAmount || 0), 0)
    const cashExpenses = (expenses || []).reduce((s, e) => s + Number(e.cashAmount || 0), 0)
    const upiExpenses = (expenses || []).reduce((s, e) => s + Number(e.upiAmount || 0), 0)
    return { cashCollected, upiCollected, cashExpenses, upiExpenses }
  }, [payments, expenses])

  // ── Monthly cash vs UPI trend (last 6 months) ─────────────────────────────
  const monthlyCashUpi = useMemo(() => {
    const months = {}
    const now = new Date()
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' })
      months[key] = { cash: 0, upi: 0 }
    }

    payments.forEach((p) => {
      const d = new Date(p.date)
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' })
      if (key in months) {
        months[key].cash += Number(p.cashAmount || 0)
        months[key].upi += Number(p.upiAmount || 0)
      }
    })

    return Object.entries(months)
      .reverse()
      .map(([name, v]) => ({ name, cash: v.cash, upi: v.upi, maxVal: Math.max(v.cash, v.upi, 1) }))
  }, [payments])

  const maxCashUpi = Math.max(...monthlyCashUpi.map((m) => Math.max(m.cash, m.upi)), 1)

  // ── Discount analytics ─────────────────────────────────────────────────────
  const discountAnalytics = useMemo(() => {
    const billsWithDiscount = bills.filter((b) => !b.deleted && Number(b.discountValue) > 0)
    const totalDiscount = billsWithDiscount.reduce((s, b) => s + Number(b.discountValue || 0), 0)
    const avgDiscount = billsWithDiscount.length ? totalDiscount / billsWithDiscount.length : 0
    return { totalDiscount, avgDiscount, count: billsWithDiscount.length }
  }, [bills])

  return (
    <div>
      <div className="page-header">
        <h1>Analytics & Reports</h1>
        <p>View sales performance, customer revenue, payment methods, and print type profitability.</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Revenue</div>
          <div className="stat-card-value">₹{salesSummary.totalRevenue.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Paid</div>
          <div className="stat-card-value">₹{salesSummary.totalPaid.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Advance Collected</div>
          <div className="stat-card-value" style={{ color: 'var(--info)' }}>₹{totalAdvanceCollected.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Revenue + Advance</div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{(salesSummary.totalPaid + totalAdvanceCollected).toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Outstanding</div>
          <div className="stat-card-value">₹{salesSummary.outstanding.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Bills Processed</div>
          <div className="stat-card-value">{salesSummary.count}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Average Order</div>
          <div className="stat-card-value">₹{averageOrder.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Customers</div>
          <div className="stat-card-value">{customers.length}</div>
        </div>
      </div>

      <PeriodReport />

      {/* Payment Method Summary */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Payment Method Summary</h2>
        <div className="grid-2" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Collected</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Total Cash Collected</span>
              <strong style={{ color: 'var(--success)' }}>₹{paymentMethodSummary.cashCollected.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.2)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> Total UPI Collected</span>
              <strong style={{ color: 'var(--info)' }}>₹{paymentMethodSummary.upiCollected.toFixed(2)}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Expenses</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Cash Expenses</span>
              <strong style={{ color: 'var(--error)' }}>₹{paymentMethodSummary.cashExpenses.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> UPI Expenses</span>
              <strong style={{ color: 'var(--warning)' }}>₹{paymentMethodSummary.upiExpenses.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '20px', marginTop: '24px' }}>
        {/* Revenue Trend */}
        <div className="card">
          <h2>Revenue Trend (Last 6 Months)</h2>
          <div style={{ display: 'grid', gap: '14px', marginTop: '20px' }}>
            {monthlyTrend.map((item) => (
              <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#1f2937', borderRadius: '8px', overflow: 'hidden', height: '12px' }}>
                  <div style={{ width: `${Math.max(item.share * 100, 5)}%`, height: '100%', background: '#3b82f6' }} />
                </div>
                <div style={{ minWidth: '80px', textAlign: 'right', fontSize: '13px' }}>₹{item.value.toFixed(0)}</div>
                <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#9ca3af' }}>{item.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div className="card">
          <h2>Top Customers</h2>
          <div style={{ display: 'grid', gap: '12px', marginTop: '20px' }}>
            {revenueByCustomer.length === 0 ? (
              <p className="text-muted">No customer revenue data available.</p>
            ) : (
              revenueByCustomer.map((customer) => (
                <div key={customer.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{customer.name}</div>
                    <div style={{ height: '10px', background: '#111827', borderRadius: '6px', overflow: 'hidden', marginTop: '6px' }}>
                      <div style={{ width: `${Math.max((customer.value / Math.max(...revenueByCustomer.map((c) => c.value))) * 100, 5)}%`, height: '100%', background: '#10b981' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: '600' }}>₹{customer.value.toFixed(0)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Monthly Cash vs UPI Trend */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Monthly Cash vs UPI (Last 6 Months)</h2>
        <div style={{ display: 'grid', gap: '16px', marginTop: '20px' }}>
          {monthlyCashUpi.map((item) => (
            <div key={item.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{item.name}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Cash: ₹{item.cash.toFixed(0)} | UPI: ₹{item.upi.toFixed(0)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ background: '#1f2937', borderRadius: '4px', overflow: 'hidden', height: '8px' }}>
                  <div style={{ width: `${Math.max((item.cash / maxCashUpi) * 100, item.cash > 0 ? 2 : 0)}%`, height: '100%', background: '#10b981' }} />
                </div>
                <div style={{ background: '#1f2937', borderRadius: '4px', overflow: 'hidden', height: '8px' }}>
                  <div style={{ width: `${Math.max((item.upi / maxCashUpi) * 100, item.upi > 0 ? 2 : 0)}%`, height: '100%', background: '#3b82f6' }} />
                </div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '8px', background: '#10b981', borderRadius: '2px', display: 'inline-block' }} /> Cash
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '8px', background: '#3b82f6', borderRadius: '2px', display: 'inline-block' }} /> UPI
            </span>
          </div>
        </div>
      </div>

      {/* Discount Analytics */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Discount Analytics</h2>
        <div className="grid-3" style={{ gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Discount Given</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--warning)' }}>₹{discountAnalytics.totalDiscount.toFixed(2)}</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Avg Discount / Bill</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{discountAnalytics.avgDiscount.toFixed(2)}</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Bills with Discount</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>{discountAnalytics.count}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Print Type Analysis</h2>
        <div style={{ display: 'grid', gap: '14px', marginTop: '20px' }}>
          {printTypeAnalysis.map((type) => (
            <div key={type.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600' }}>{type.label}</div>
                <div style={{ height: '12px', width: '100%', background: '#111827', borderRadius: '6px', overflow: 'hidden', marginTop: '6px' }}>
                  <div style={{ width: `${Math.max(type.share * 100, 5)}%`, height: '100%', background: '#f59e0b' }} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>{type.count} units</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Analytics
