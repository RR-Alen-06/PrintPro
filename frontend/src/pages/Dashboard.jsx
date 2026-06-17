import React, { useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { TrendingUp, CreditCard, Clock, AlertTriangle, ChevronRight, Wallet, CheckCircle, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const Dashboard = () => {
  const { bills, customers, advancePayments } = useAppContext()
  const navigate = useNavigate()
  const today = new Date()

  const activeBills = useMemo(() => bills.filter((b) => !b.deleted), [bills])
  const paidBills = useMemo(() => activeBills.filter((b) => b.status === 'paid'), [activeBills])
  const partialBills = useMemo(() => activeBills.filter((b) => b.status === 'partial'), [activeBills])
  const unpaidBills = useMemo(() => activeBills.filter((b) => b.status === 'unpaid'), [activeBills])
  const pendingAmount = useMemo(() => activeBills.reduce((sum, b) => sum + Number(b.balance || 0), 0), [activeBills])
  const revenue = useMemo(() => activeBills.reduce((sum, b) => sum + Number(b.amountPaid || 0), 0), [activeBills])
  const totalAdvanceCollected = useMemo(() => {
    return (advancePayments || []).reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
  }, [advancePayments])
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

      {/* Stats grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon indigo"><TrendingUp /></div>
            <div>
              <div className="stat-card-label">Total Revenue</div>
              <div className="stat-card-value">₹{revenue.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">{paidBills.length} bills fully collected</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><TrendingUp /></div>
            <div>
              <div className="stat-card-label">Revenue + Advance</div>
              <div className="stat-card-value">₹{(revenue + totalAdvanceCollected).toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Total cash inflow collected</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon warning"><CreditCard /></div>
            <div>
              <div className="stat-card-label">Pending Balance</div>
              <div className="stat-card-value">₹{pendingAmount.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">{partialBills.length + unpaidBills.length} open bills</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon error"><Clock /></div>
            <div>
              <div className="stat-card-label">Overdue Bills</div>
              <div className="stat-card-value">{overdueBills.length}</div>
            </div>
          </div>
          <div className="stat-card-sub">Past due date with balance</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success"><AlertTriangle /></div>
            <div>
              <div className="stat-card-label">Customers with Dues</div>
              <div className="stat-card-value">{pendingDues.length}</div>
            </div>
          </div>
          <div className="stat-card-sub">Customers with open balance</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><Wallet /></div>
            <div>
              <div className="stat-card-label">Total Advance Collected</div>
              <div className="stat-card-value">₹{totalAdvanceCollected.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Active advances deposited</div>
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
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <TrendingUp />
            <h4>All bills settled</h4>
            <p>No outstanding balances at this time.</p>
          </div>
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
              {activeBills.slice(0, 6).map((bill) => (
                <tr key={bill.id}>
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
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No bills yet.</td></tr>
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
