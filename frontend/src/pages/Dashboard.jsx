import React, { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { TrendingUp, CreditCard, Clock, AlertTriangle, ChevronRight, Wallet, CheckCircle, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'

const Dashboard = () => {
  const { bills, customers, advancePayments, payments, expenses } = useAppContext()
  const navigate = useNavigate()
  const today = new Date()

  // Default to current financial year based on current date
  const [selectedFY, setSelectedFY] = useState(
    new Date().getMonth() >= 3 
      ? String(new Date().getFullYear()) 
      : String(new Date().getFullYear() - 1)
  )

  const fyStats = useMemo(() => {
    const fyYear = parseInt(selectedFY, 10)
    const startDate = new Date(fyYear, 3, 1, 0, 0, 0, 0) // April 1st
    const endDate = new Date(fyYear + 1, 2, 31, 23, 59, 59, 999) // March 31st

    const isDateInFY = (dateStr) => {
      if (!dateStr) return false
      const d = new Date(dateStr)
      return d >= startDate && d <= endDate
    }

    // 1. Realized Revenue: sum of active bills' amountPaid in this FY
    const fyBills = (bills || []).filter(b => !b.deleted && isDateInFY(b.date) && !b.isGroupParent)
    const revenue = fyBills.reduce((sum, b) => sum + Number(b.amountPaid || 0), 0)

    // 2. Refunds: sum of payments in this FY where totalPaid < 0 or isRefund is true
    const fyRefundPayments = (payments || []).filter(p => (p.isRefund || p.paymentType === 'refund' || p.totalPaid < 0) && isDateInFY(p.date))
    const refunds = fyRefundPayments.reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || 0)), 0)

    // 3. Cash Inflow: payments + advance deposits in this FY
    const fyPayments = (payments || []).filter(p => !p.notes?.includes('from advance deposit') && isDateInFY(p.date))
    const pInflow = fyPayments.reduce((sum, p) => sum + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    const fyAdvances = (advancePayments || []).filter(ap => isDateInFY(ap.date))
    const advInflow = fyAdvances.reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
    const cashInflow = pInflow + advInflow

    // 4. Expenses: sum of expenses in this FY
    const fyExpenses = (expenses || []).filter(e => isDateInFY(e.date))
    const fyExpTotal = fyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

    const netCashFlow = cashInflow - fyExpTotal

    return {
      revenue,
      refunds,
      cashInflow,
      expenses: fyExpTotal,
      netCashFlow
    }
  }, [bills, payments, advancePayments, expenses, selectedFY])

  const activeBills = useMemo(() => bills.filter((b) => !b.deleted && !b.isGroupParent), [bills])
  const paidBills = useMemo(() => activeBills.filter((b) => b.status === 'paid'), [activeBills])
  const partialBills = useMemo(() => activeBills.filter((b) => b.status === 'partial'), [activeBills])
  const unpaidBills = useMemo(() => activeBills.filter((b) => b.status === 'unpaid'), [activeBills])
  const pendingAmount = useMemo(() => activeBills.reduce((sum, b) => sum + Number(b.balance || 0), 0), [activeBills])
  const revenue = useMemo(() => activeBills.reduce((sum, b) => sum + Number(b.amountPaid || 0), 0), [activeBills])

  const refundPayments = useMemo(() => {
    return (payments || []).filter((p) => p.isRefund || p.paymentType === 'refund' || p.totalPaid < 0)
  }, [payments])

  const totalRefunds = useMemo(() => {
    return refundPayments.reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || 0)), 0)
  }, [refundPayments])

  const netRevenue = useMemo(() => revenue, [revenue])
  
  const totalCustomerAdvance = useMemo(() => {
    return customers.filter((c) => !c.deleted).reduce((sum, c) => sum + Number(c.advanceBalance || c.creditBalance || 0), 0)
  }, [customers])

  const totalCashInflow = useMemo(() => {
    const pInflow = (payments || [])
      .filter((p) => !p.notes?.includes('from advance deposit'))
      .reduce((sum, p) => sum + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    const advInflow = (advancePayments || []).reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
    return pInflow + advInflow
  }, [payments, advancePayments])

  const overdueBills = useMemo(
    () => activeBills.filter((b) => b.balance > 0 && b.dueDate && new Date(b.dueDate) < today),
    [activeBills]
  )

  // Pending dues per customer — sorted by balance desc
  const pendingDues = useMemo(() => {
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
        if (b.dueDate && new Date(b.dueDate) < today) entry.hasOverdue = true
      })
    return Object.values(map).sort((a, b) => b.totalDue - a.totalDue).slice(0, 8)
  }, [activeBills])

  const urgencyStyle = (entry) => {
    if (entry.hasOverdue) return { color: 'var(--error)', bg: 'var(--error-bg)', border: 'rgba(239,68,68,0.2)' }
    return { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'rgba(245,158,11,0.2)' }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of billing activity, pending dues, and customer status.</p>
      </div>

      {/* Financial Health Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ width: '4px', height: '14px', background: 'var(--gradient-accent)', borderRadius: '2px', display: 'inline-block' }} />
          Financial Performance
        </h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
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
        </div>
      </div>

      {/* Operations & Receivables Section */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ width: '4px', height: '14px', background: 'var(--gradient-accent)', borderRadius: '2px', display: 'inline-block' }} />
          Operations & Receivables
        </h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
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

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', border: 'none', padding: 0 }}>
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
