import React, { useState, useMemo } from 'react'
import { TrendingUp, DollarSign, PieChart, Clock, Sparkles, ArrowUpRight, BarChart2 } from 'lucide-react'

interface AnalyticsTabProps {
  bills: any[]
  expenses: any[]
  refunds: any[]
  inventory: any[]
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  bills = [],
  expenses = [],
  refunds = [],
  inventory = [],
}) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month')

  // Filter bills by period
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  const activeBills = useMemo(() => {
    return bills.filter((b) => {
      if (!b || b.deleted || b.deleted_at) return false
      const bDate = (b.date || b.created_at || '').slice(0, 10)
      if (period === 'today') return bDate === todayStr
      if (period === 'week') {
        const d = new Date(bDate)
        const diff = (now.getTime() - d.getTime()) / (1000 * 3600 * 24)
        return diff <= 7
      }
      if (period === 'month') {
        return bDate.startsWith(now.toISOString().slice(0, 7))
      }
      return true
    })
  }, [bills, period, todayStr])

  // Filter expenses by period
  const activeExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const eDate = (e.date || '').slice(0, 10)
      if (period === 'today') return eDate === todayStr
      if (period === 'week') {
        const d = new Date(eDate)
        const diff = (now.getTime() - d.getTime()) / (1000 * 3600 * 24)
        return diff <= 7
      }
      if (period === 'month') {
        return eDate.startsWith(now.toISOString().slice(0, 7))
      }
      return true
    })
  }, [expenses, period, todayStr])

  // Filter refunds by period
  const activeRefunds = useMemo(() => {
    return refunds.filter((r) => {
      const rDate = (r.date || r.created_at || '').slice(0, 10)
      if (period === 'today') return rDate === todayStr
      if (period === 'week') {
        const d = new Date(rDate)
        const diff = (now.getTime() - d.getTime()) / (1000 * 3600 * 24)
        return diff <= 7
      }
      if (period === 'month') {
        return rDate.startsWith(now.toISOString().slice(0, 7))
      }
      return true
    })
  }, [refunds, period, todayStr])

  // Financial Calculations
  const grossRevenue = activeBills.reduce((sum, b) => sum + Number(b.total !== undefined ? b.total : (b.grand_total || 0)), 0)
  const totalDiscounts = activeBills.reduce((sum, b) => sum + Number(b.discountAmount || b.discountValue || 0), 0)
  const totalRefundAmt = activeRefunds.reduce((sum, r) => sum + Math.abs(Number(r.amount || r.totalPaid || 0)), 0)
  const netRevenue = Math.max(0, Number((grossRevenue - totalRefundAmt).toFixed(2)))

  const totalExpenseAmt = activeExpenses.reduce((sum, e) => sum + Number(e.amount || e.total || 0), 0)

  // Estimated COGS from bill line items or inventory purchase costs
  const estimatedCogs = useMemo(() => {
    let cogs = 0
    activeBills.forEach((b) => {
      (b.items || []).forEach((item: any) => {
        const invItem = inventory.find((inv) => inv.id === item.itemId)
        const unitCost = Number(invItem?.purchasePrice || invItem?.costPrice || (item.unitPrice ? item.unitPrice * 0.35 : 0))
        cogs += unitCost * Number(item.qty || 1)
      })
    })
    return Number(cogs.toFixed(2))
  }, [activeBills, inventory])

  const grossProfit = Math.max(0, Number((netRevenue - estimatedCogs).toFixed(2)))
  const netProfit = Number((netRevenue - estimatedCogs - totalExpenseAmt).toFixed(2))
  const netMarginPct = netRevenue > 0 ? Number(((netProfit / netRevenue) * 100).toFixed(1)) : 0
  const grossMarginPct = netRevenue > 0 ? Number(((grossProfit / netRevenue) * 100).toFixed(1)) : 0

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    let cash = 0
    let upi = 0
    let advance = 0
    activeBills.forEach((b) => {
      const pm = b.paymentMethod
      if (pm?.cash) cash += Number(pm.cash)
      if (pm?.upi) upi += Number(pm.upi)
      if (b.advanceUsed) advance += Number(b.advanceUsed)
      if (!pm?.cash && !pm?.upi && b.amountPaid) {
        if (b.payment_method === 'upi') upi += Number(b.amountPaid)
        else cash += Number(b.amountPaid)
      }
    })
    const total = cash + upi + advance || 1
    return {
      cash,
      upi,
      advance,
      cashPct: Math.round((cash / total) * 100),
      upiPct: Math.round((upi / total) * 100),
      advancePct: Math.round((advance / total) * 100),
    }
  }, [activeBills])

  // Hourly rush calculation (9:00 to 21:00)
  const hourlyRush = useMemo(() => {
    const hours: Record<number, number> = {}
    for (let h = 9; h <= 21; h++) hours[h] = 0

    activeBills.forEach((b) => {
      const timeStr = b.created_at || b.date
      if (timeStr) {
        const d = new Date(timeStr)
        const h = d.getHours()
        if (hours[h] !== undefined) {
          hours[h] += 1
        }
      }
    })

    const maxCount = Math.max(...Object.values(hours), 1)
    return Object.entries(hours).map(([hour, count]) => ({
      hour: parseInt(hour, 10),
      label: `${hour}:00`,
      count,
      pct: Math.round((count / maxCount) * 100),
    }))
  }, [activeBills])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Period Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Real-Time Financial P&L & Analytics</h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Operating profits, margin health, hourly traffic, and revenue intelligence.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'Last 7 Days' },
            { key: 'month', label: 'This Month' },
            { key: 'all', label: 'All Time' },
          ].map((p) => (
            <button
              key={p.key}
              type="button"
              className={`btn btn-sm ${period === p.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(p.key as any)}
              style={{ fontSize: '0.78rem' }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. REAL-TIME PROFIT & MARGIN GAUGES */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Net Operating Profit */}
        <div
          className="stat-card"
          style={{
            borderLeft: netProfit >= 0 ? '4px solid #10b981' : '4px solid #ef4444',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
              Net Operating Profit
            </div>
            <Sparkles size={16} color={netProfit >= 0 ? '#10b981' : '#ef4444'} />
          </div>
          <div
            className="currency-num"
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              color: netProfit >= 0 ? '#10b981' : '#ef4444',
              margin: '4px 0 2px',
            }}
          >
            ₹{netProfit.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            After raw materials & operating expenses
          </div>
        </div>

        {/* Net Margin % */}
        <div
          className="stat-card"
          style={{
            borderLeft: '4px solid var(--aurora-cyan, #00f0ff)',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Net Margin Health
          </div>
          <div
            className="currency-num"
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              color: netMarginPct >= 20 ? '#10b981' : netMarginPct > 0 ? 'var(--aurora-cyan, #00f0ff)' : '#ef4444',
              margin: '4px 0 2px',
            }}
          >
            {netMarginPct}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Gross Margin: {grossMarginPct}%
          </div>
        </div>

        {/* Net Revenue */}
        <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Net Revenue
          </div>
          <div className="currency-num" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 2px' }}>
            ₹{netRevenue.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Gross: ₹{grossRevenue.toFixed(0)} • Refunds: ₹{totalRefundAmt.toFixed(0)}
          </div>
        </div>

        {/* Operating Costs */}
        <div
          className="stat-card"
          style={{
            borderLeft: '4px solid var(--aurora-amber, #f59e0b)',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Total Costs (COGS + Exp)
          </div>
          <div className="currency-num" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--aurora-amber, #f59e0b)', margin: '4px 0 2px' }}>
            ₹{(estimatedCogs + totalExpenseAmt).toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            COGS: ₹{estimatedCogs.toFixed(0)} • Exp: ₹{totalExpenseAmt.toFixed(0)}
          </div>
        </div>
      </div>

      {/* 3. Payment Method Mix & Peak Rush Hours Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Payment Methods Mix */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <PieChart size={18} color="var(--aurora-cyan, #00f0ff)" />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Payment Method Allocation</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                <span>Digital UPI Payments</span>
                <strong>₹{paymentBreakdown.upi.toFixed(2)} ({paymentBreakdown.upiPct}%)</strong>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${paymentBreakdown.upiPct}%`, height: '100%', background: 'var(--aurora-cyan, #00f0ff)', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                <span>Cash Counter Payments</span>
                <strong>₹{paymentBreakdown.cash.toFixed(2)} ({paymentBreakdown.cashPct}%)</strong>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${paymentBreakdown.cashPct}%`, height: '100%', background: '#10b981', borderRadius: '4px' }} />
              </div>
            </div>

            {paymentBreakdown.advance > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                  <span>Advance Wallet Used</span>
                  <strong>₹{paymentBreakdown.advance.toFixed(2)} ({paymentBreakdown.advancePct}%)</strong>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${paymentBreakdown.advancePct}%`, height: '100%', background: 'var(--aurora-amber, #f59e0b)', borderRadius: '4px' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hourly Rush Distribution */}
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Clock size={18} color="var(--aurora-amber, #f59e0b)" />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Peak Hourly Rush Hours</h4>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', paddingTop: '10px' }}>
            {hourlyRush.map((hr) => (
              <div
                key={hr.hour}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(8, hr.pct)}%`,
                    backgroundColor: hr.count > 0 ? 'var(--aurora-cyan, #00f0ff)' : 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'all 0.3s ease',
                  }}
                  title={`${hr.label}: ${hr.count} invoices`}
                />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {hr.hour}h
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
