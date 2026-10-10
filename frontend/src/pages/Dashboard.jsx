import React, { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { TrendingUp, CreditCard, Clock, AlertTriangle, ChevronRight, Wallet, CheckCircle, XCircle, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import { DashboardService } from '../utils/financialServices'
import EodModal from '../components/dashboard/EodModal'

const Dashboard = () => {
  const { bills, customers, advancePayments, payments, expenses } = useAppContext()
  const navigate = useNavigate()

  const [showEodModal, setShowEodModal] = useState(false)
  const [periodFilter, setPeriodFilter] = useState('all') // 'all', 'today', 'yesterday', 'week', 'month', 'quarter'

  // Default to current financial year based on current date
  const [selectedFY, setSelectedFY] = useState(
    new Date().getMonth() >= 3 
      ? String(new Date().getFullYear()) 
      : String(new Date().getFullYear() - 1)
  )

  // Filter bills, payments, expenses according to active period filter
  const filteredData = useMemo(() => {
    if (periodFilter === 'all') {
      return {
        bills: (bills || []).filter(b => !b.deleted && !b.isGroupParent),
        payments: payments || [],
        expenses: expenses || [],
        advancePayments: advancePayments || [],
      }
    }

    const now = new Date()
    const getStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
    const getEndOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

    let start = new Date(0)
    let end = new Date()

    if (periodFilter === 'today') {
      start = getStartOfDay(now)
      end = getEndOfDay(now)
    } else if (periodFilter === 'yesterday') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      start = getStartOfDay(y)
      end = getEndOfDay(y)
    } else if (periodFilter === 'week') {
      const w = new Date(now)
      w.setDate(w.getDate() - 7)
      start = getStartOfDay(w)
      end = getEndOfDay(now)
    } else if (periodFilter === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      end = getEndOfDay(now)
    } else if (periodFilter === 'quarter') {
      const currentMonth = now.getMonth()
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3
      start = new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0)
      end = getEndOfDay(now)
    }

    const inRange = (dStr) => {
      if (!dStr) return false
      const d = new Date(dStr)
      return d >= start && d <= end
    }

    return {
      bills: (bills || []).filter(b => !b.deleted && !b.isGroupParent && inRange(b.date)),
      payments: (payments || []).filter(p => inRange(p.date)),
      expenses: (expenses || []).filter(e => inRange(e.date)),
      advancePayments: (advancePayments || []).filter(ap => inRange(ap.date)),
    }
  }, [bills, payments, expenses, advancePayments, periodFilter])

  const activeBills = filteredData.bills
  const paidBills = useMemo(() => activeBills.filter((b) => b.status === 'paid'), [activeBills])
  const partialBills = useMemo(() => activeBills.filter((b) => b.status === 'partial'), [activeBills])
  const unpaidBills = useMemo(() => activeBills.filter((b) => b.status === 'unpaid'), [activeBills])

  // Centralized calculations using DashboardService
  const dashboardStats = useMemo(() => {
    return DashboardService.getSummaryWidgets({
      bills: filteredData.bills,
      payments: filteredData.payments,
      expenses: filteredData.expenses,
      customers,
      inventory: []
    })
  }, [filteredData, customers])

  const netRevenue = dashboardStats.netRevenue
  const pendingAmount = dashboardStats.pendingAmount
  const totalRefunds = dashboardStats.totalRefunds
  const totalCustomerAdvance = dashboardStats.totalCustomerAdvance

  const refundPayments = useMemo(() => {
    return (filteredData.payments || []).filter((p) => p.isRefund || p.paymentType === 'refund' || p.totalPaid < 0)
  }, [filteredData.payments])

  const totalCashInflow = useMemo(() => {
    const pInflow = (filteredData.payments || [])
      .filter((p) => !p.notes?.includes('from advance deposit'))
      .reduce((sum, p) => sum + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    const advInflow = (filteredData.advancePayments || [])
      .filter(ap => !ap.isRefundCredit)
      .reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
    return pInflow + advInflow
  }, [filteredData])

  const totalExpenses = useMemo(() => {
    return (filteredData.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [filteredData.expenses])

  const netCashFlow = useMemo(() => {
    return totalCashInflow - totalExpenses
  }, [totalCashInflow, totalExpenses])

  const overdueBills = useMemo(() => {
    const now = new Date()
    return activeBills.filter((b) => b.balance > 0 && b.dueDate && new Date(b.dueDate) < now)
  }, [activeBills])

  // Financial Year stats computation
  const fyStats = useMemo(() => {
    const startYear = parseInt(selectedFY, 10) || new Date().getFullYear()
    const fyStart = new Date(startYear, 3, 1, 0, 0, 0, 0)
    const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59, 999)

    const inFY = (dStr) => {
      if (!dStr) return false
      const d = new Date(dStr)
      return d >= fyStart && d <= fyEnd
    }

    const fyBills = (bills || []).filter(b => !b.deleted && !b.isGroupParent && inFY(b.date))
    const fyPayments = (payments || []).filter(p => inFY(p.date))
    const fyExpenses = (expenses || []).filter(e => inFY(e.date))
    const fyAdvances = (advancePayments || []).filter(ap => inFY(ap.date))

    const revenue = fyBills.reduce((sum, b) => sum + Number(b.paid || 0), 0)
    const refunds = fyPayments
      .filter((p) => p.isRefund || p.paymentType === 'refund' || p.totalPaid < 0)
      .reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || 0)), 0)

    const pInflow = fyPayments
      .filter((p) => !p.notes?.includes('from advance deposit'))
      .reduce((sum, p) => sum + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    const advInflow = fyAdvances
      .filter((ap) => !ap.isRefundCredit)
      .reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
    const cashInflowVal = pInflow + advInflow

    const totalExp = fyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const netCashFlowVal = cashInflowVal - totalExp

    return {
      revenue,
      refunds,
      cashInflow: cashInflowVal,
      expenses: totalExp,
      netCashFlow: netCashFlowVal,
    }
  }, [bills, payments, expenses, advancePayments, selectedFY])

  // Pending dues per customer — sorted by balance desc
  const pendingDues = useMemo(() => {
    const now = new Date()
    const map = {}
    activeBills
      .filter((b) => b.balance > 0)
      .forEach((b) => {
        if (!map[b.customerId]) {
          map[b.customerId] = {
            customerId: b.customerId,
            customerName: b.customerName,
            totalDue: 0,
            oldestDate: b.date,
            newestDate: b.date,
            billCount: 0,
            hasOverdue: false,
          }
        }
        const entry = map[b.customerId]
        entry.totalDue += Number(b.balance)
        entry.billCount += 1
        if (b.date < entry.oldestDate) entry.oldestDate = b.date
        if (b.date > entry.newestDate) entry.newestDate = b.date
        if (b.dueDate && new Date(b.dueDate) < now) entry.hasOverdue = true
      })
    return Object.values(map).sort((a, b) => b.totalDue - a.totalDue).slice(0, 8)
  }, [activeBills])

  const urgencyStyle = (entry) => {
    if (entry.hasOverdue) return { color: 'var(--error)', bg: 'var(--error-bg)', border: 'rgba(239,68,68,0.2)' }
    return { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'rgba(245,158,11,0.2)' }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Dashboard</h1>
          <p>Overview of billing activity, pending dues, and customer status.</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => setShowEodModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}
        >
          <FileText size={16} color="var(--accent)" />
          EOD Report
        </button>
      </div>

      <EodModal isOpen={showEodModal} onClose={() => setShowEodModal(false)} />

      {/* Google Stitch Period Filter Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '20px' }}>
        {[
          { id: 'all', label: 'All Time' },
          { id: 'today', label: 'Today' },
          { id: 'yesterday', label: 'Yesterday' },
          { id: 'week', label: 'This Week' },
          { id: 'month', label: 'This Month' },
          { id: 'quarter', label: 'This Quarter' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodFilter(p.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: periodFilter === p.id ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: periodFilter === p.id ? 'var(--accent-surface)' : 'var(--bg-card)',
              color: periodFilter === p.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Financial Health Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ width: '4px', height: '14px', background: 'var(--gradient-accent)', borderRadius: '2px', display: 'inline-block' }} />
          Financial Performance ({periodFilter === 'all' ? 'All Time' : periodFilter})
        </h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '20px' }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon indigo"><TrendingUp /></div>
              <div>
                <div className="stat-card-label">Total Revenue</div>
                <div className="stat-card-value">₹{netRevenue.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">{paidBills.length} bills fully collected</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon success" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><TrendingUp /></div>
              <div>
                <div className="stat-card-label">Total Cash Inflow</div>
                <div className="stat-card-value">₹{totalCashInflow.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">Net cash inflow collected</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon error" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}><XCircle /></div>
              <div>
                <div className="stat-card-label">Total Refunds</div>
                <div className="stat-card-value">₹{totalRefunds.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">{refundPayments.length} refund transactions</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon success" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><Wallet /></div>
              <div>
                <div className="stat-card-label">Advance Balance</div>
                <div className="stat-card-value">₹{totalCustomerAdvance.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">Outstanding customer credits</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className={`stat-card-icon ${netCashFlow >= 0 ? 'success' : 'error'}`} style={{ background: netCashFlow >= 0 ? 'var(--success-bg)' : 'var(--error-bg)', color: netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {netCashFlow >= 0 ? <TrendingUp /> : <XCircle />}
              </div>
              <div>
                <div className="stat-card-label">Net Cash Flow</div>
                <div className="stat-card-value" style={{ color: netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  ₹{netCashFlow.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operations & Receivables Section */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ width: '4px', height: '14px', background: 'var(--gradient-accent)', borderRadius: '2px', display: 'inline-block' }} />
          Operations & Receivables
        </h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon warning"><CreditCard /></div>
              <div>
                <div className="stat-card-label">Pending Dues</div>
                <div className="stat-card-value">₹{pendingAmount.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">{partialBills.length + unpaidBills.length} open bills pending</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon error"><Clock /></div>
              <div>
                <div className="stat-card-label">Overdue Bills</div>
                <div className="stat-card-value" style={{ color: overdueBills.length > 0 ? 'var(--error)' : 'var(--text-primary)' }}>{overdueBills.length}</div>
              </div>
            </div>
            <div className="stat-card-sub">Past due date with balance</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon success" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><AlertTriangle /></div>
              <div>
                <div className="stat-card-label">Customers with Dues</div>
                <div className="stat-card-value">{pendingDues.length}</div>
              </div>
            </div>
            <div className="stat-card-sub">Active debtors in ledger</div>
          </div>
        </div>
      </div>

      {/* Pending Dues Widget */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="bill-view-header">
          <div>
            <h2>Pending Dues Summary</h2>
            <p className="text-muted">Customers with outstanding balances — sorted by amount owed</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers')}>
            View All <ChevronRight size={14} />
          </button>
        </div>

        {pendingDues.length === 0 ? (
          <EmptyState
            Icon={CheckCircle}
            title="All bills settled"
            description="No outstanding balances at this time. All customer accounts are fully paid."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Bills</th>
                  <th>Date Range</th>
                  <th>Amount Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingDues.map((entry) => {
                  const s = urgencyStyle(entry)
                  return (
                    <tr
                      key={entry.customerId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/customers')}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.customerId}</div>
                      </td>
                      <td>{entry.billCount}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {entry.oldestDate === entry.newestDate
                          ? entry.oldestDate
                          : `${entry.oldestDate} → ${entry.newestDate}`}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: s.color }}>
                          ₹{entry.totalDue.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 10px', borderRadius: 'var(--radius-full)',
                          background: s.bg, border: `1px solid ${s.border}`,
                          color: s.color, fontSize: '0.72rem', fontWeight: 600,
                        }}>
                          {entry.hasOverdue ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} /> Overdue
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} /> Pending
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Financial Year Analytics Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Financial Year Analytics</h2>
            <p className="text-muted">Filter historical data by Indian Financial Year (April 1st to March 31st)</p>
          </div>
          <select
            className="form-select"
            style={{ width: '280px', padding: '8px 12px', fontSize: '0.9rem' }}
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
          >
            <option value="2026">FY 2026-27 (Apr 2026 - Mar 2027)</option>
            <option value="2025">FY 2025-26 (Apr 2025 - Mar 2026)</option>
            <option value="2024">FY 2024-25 (Apr 2024 - Mar 2025)</option>
          </select>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', border: 'none', padding: 0 }}>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Realized Revenue</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>₹{fyStats.revenue.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Refunds</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning)' }}>₹{fyStats.refunds.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Cash Inflow</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--info)' }}>₹{fyStats.cashInflow.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Expenses</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--error)' }}>₹{fyStats.expenses.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Net Cash Flow</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: fyStats.netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>₹{fyStats.netCashFlow.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Recent Bills */}
      <div className="card">
        <div className="bill-view-header">
          <div>
            <h2>Recent Bills</h2>
            <p className="text-muted">Latest transactions</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/billing')}>
            All Bills <ChevronRight size={14} />
          </button>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Bill ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activeBills.slice(0, 6).map((bill, index) => (
                <tr key={`${bill.id}-${index}`}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent)' }}>{bill.id}</td>
                  <td>{bill.customerName}</td>
                  <td>{bill.date}</td>
                  <td>₹{bill.total.toFixed(2)}</td>
                  <td>₹{bill.amountPaid.toFixed(2)}</td>
                  <td style={{ color: bill.balance > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                    ₹{bill.balance.toFixed(2)}
                  </td>
                  <td>
                    <span className={`badge badge-${bill.status === 'paid' ? 'paid' : bill.status === 'partial' ? 'partial' : 'unpaid'}`}>
                      {bill.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {activeBills.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '0' }}>
                    <EmptyState
                      Icon={CreditCard}
                      title="No bills generated yet"
                      description="Generate your first print bill invoice to see detailed activity here."
                      actionText="Create First Bill"
                      onAction={() => navigate('/billing')}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer summary */}
      <div className="grid-2" style={{ marginTop: '24px' }}>
        <div className="card">
          <h3>Customer Summary</h3>
          <div style={{ marginTop: '12px', display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Total Customers</span>
              <strong>{customers.filter((c) => !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Regular</span>
              <strong>{customers.filter((c) => c.type === 'regular' && !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Walk-in</span>
              <strong>{customers.filter((c) => c.type === 'random' && !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Archived</span>
              <strong>{customers.filter((c) => c.deleted).length}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Bill Status Breakdown</h3>
          <div style={{ marginTop: '12px', display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> Paid</span>
              <strong>{paidBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Partial</span>
              <strong>{partialBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><XCircle size={14} /> Unpaid</span>
              <strong>{unpaidBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> Overdue</span>
              <strong>{overdueBills.length}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
