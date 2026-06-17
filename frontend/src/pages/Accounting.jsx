import React, { useState, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Trash2, CheckCircle, Plus, Banknote, Smartphone } from 'lucide-react'
import PeriodReport from '../components/PeriodReport'

const Accounting = () => {
  const { bills, payments, expenses, advancePayments, addExpense, deleteExpense } = useAppContext()

  const today = new Date().toISOString().slice(0, 10)
  const [expForm, setExpForm] = useState({
    date: today,
    description: '',
    amount: '',
    cashAmount: '',
    upiAmount: '',
  })
  const [expError, setExpError] = useState('')
  const [expSuccess, setExpSuccess] = useState(false)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeBills = bills.filter((b) => !b.deleted)

    const realizedRevenue = activeBills.reduce((s, b) => s + Number(b.amountPaid || 0), 0)
    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalAdvanceCollected = (advancePayments || []).reduce((s, ap) => s + Number(ap.amount || 0), 0)
    const netCashFlow = (realizedRevenue + totalAdvanceCollected) - totalExpenses
    const pendingReceivables = activeBills
      .filter((b) => b.status !== 'paid')
      .reduce((s, b) => s + Number(b.balance || 0), 0)

    // Cash/UPI from payments
    const cashCollected = payments.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const upiCollected = payments.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    // Cash/UPI from expenses
    const cashSpent = (expenses || []).reduce((s, e) => s + Number(e.cashAmount || 0), 0)
    const upiSpent = (expenses || []).reduce((s, e) => s + Number(e.upiAmount || 0), 0)

    return { realizedRevenue, totalExpenses, netCashFlow, pendingReceivables, cashCollected, upiCollected, cashSpent, upiSpent, totalAdvanceCollected }
  }, [bills, payments, expenses, advancePayments])

  // ── Expense form ──────────────────────────────────────────────────────────
  const handleExpenseChange = (field, value) => {
    setExpForm((f) => ({ ...f, [field]: value }))
    setExpError('')
  }

  const handleAddExpense = (e) => {
    e.preventDefault()
    const amount = Number(expForm.amount)
    const cash = Number(expForm.cashAmount || 0)
    const upi = Number(expForm.upiAmount || 0)

    if (!expForm.description.trim()) { setExpError('Description is required.'); return }
    if (!amount || amount <= 0) { setExpError('Enter a valid amount.'); return }
    if (Math.abs(cash + upi - amount) > 0.01) {
      setExpError(`Cash (₹${cash}) + UPI (₹${upi}) = ₹${(cash + upi).toFixed(2)} must equal Total ₹${amount.toFixed(2)}.`)
      return
    }

    addExpense({
      date: expForm.date || today,
      description: expForm.description.trim(),
      amount,
      cashAmount: cash,
      upiAmount: upi,
    })

    setExpForm({ date: today, description: '', amount: '', cashAmount: '', upiAmount: '' })
    setExpSuccess(true)
    setTimeout(() => setExpSuccess(false), 3000)
  }

  const sortedExpenses = useMemo(() => {
    return [...(expenses || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [expenses])

  return (
    <div>
      <div className="page-header">
        <h1>Accounting</h1>
        <p>Track revenue, expenses, cash flow, and cash vs UPI breakdowns.</p>
      </div>

      {/* Summary stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success"><DollarSign /></div>
            <div>
              <div className="stat-card-label">Realized Revenue</div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{stats.realizedRevenue.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Total collected from bills.</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><DollarSign /></div>
            <div>
              <div className="stat-card-label">Total Advance Collected</div>
              <div className="stat-card-value" style={{ color: 'var(--info)' }}>₹{stats.totalAdvanceCollected.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Total advance deposits received.</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><TrendingUp /></div>
            <div>
              <div className="stat-card-label">Revenue + Advance</div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{(stats.realizedRevenue + stats.totalAdvanceCollected).toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Realized revenue plus advances.</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon error"><TrendingDown /></div>
            <div>
              <div className="stat-card-label">Total Expenses</div>
              <div className="stat-card-value" style={{ color: 'var(--error)' }}>₹{stats.totalExpenses.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Total amount spent on expenses.</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className={`stat-card-icon ${stats.netCashFlow >= 0 ? 'success' : 'error'}`}><TrendingUp /></div>
            <div>
              <div className="stat-card-label">Net Cash Flow</div>
              <div className="stat-card-value" style={{ color: stats.netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
                ₹{stats.netCashFlow.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="stat-card-sub">Total Inflow minus expenses.</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon warning"><AlertCircle /></div>
            <div>
              <div className="stat-card-label">Pending Receivables</div>
              <div className="stat-card-value" style={{ color: 'var(--warning)' }}>₹{stats.pendingReceivables.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Outstanding from open bills.</div>
        </div>
      </div>

      {/* Cash vs UPI breakdown */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Cash vs UPI Breakdown</h2>
        <div className="grid-2" style={{ gap: '16px' }}>
          <div>
            <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Collected (Revenue)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Cash Collected</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>₹{stats.cashCollected.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> UPI Collected</span>
                <span style={{ fontWeight: 700, color: 'var(--info)' }}>₹{stats.upiCollected.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Spent (Expenses)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Cash Spent</span>
                <span style={{ fontWeight: 700, color: 'var(--error)' }}>₹{stats.cashSpent.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> UPI Spent</span>
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>₹{stats.upiSpent.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PeriodReport />

      {/* Add Expense */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Add Expense</h2>
        <form onSubmit={handleAddExpense}>
          <div className="grid-2" style={{ gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={expForm.date} onChange={(e) => handleExpenseChange('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Paper purchase, ink refill…"
                value={expForm.description}
                onChange={(e) => handleExpenseChange('description', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Amount (₹)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={expForm.amount}
                onChange={(e) => handleExpenseChange('amount', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Cash Paid (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={expForm.cashAmount}
                  onChange={(e) => handleExpenseChange('cashAmount', e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">UPI Paid (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={expForm.upiAmount}
                  onChange={(e) => handleExpenseChange('upiAmount', e.target.value)}
                />
              </div>
            </div>
          </div>

          {expError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', marginBottom: '12px',
              background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.875rem'
            }}>
              <AlertCircle size={16} /> {expError}
            </div>
          )}

          {expSuccess && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', marginBottom: '12px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
            }}>
              <CheckCircle size={16} /> Expense added successfully!
            </div>
          )}

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Cash + UPI must equal total amount.
          </p>
          <button type="submit" className="btn btn-primary">
            <Plus size={16} /> Save Expense
          </button>
        </form>
      </div>

      {/* Expense Log */}
      <div className="card">
        <h2 style={{ marginBottom: '16px' }}>Expense Log ({sortedExpenses.length})</h2>
        {sortedExpenses.length === 0 ? (
          <div className="empty-state">
            <TrendingDown />
            <h4>No expenses recorded</h4>
            <p>Add expenses above to track your spending.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>ID</th>
                  <th>Description</th>
                  <th>Total (₹)</th>
                  <th>Cash (₹)</th>
                  <th>UPI (₹)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>{exp.date}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{exp.id}</td>
                    <td>{exp.description}</td>
                    <td style={{ fontWeight: 600, color: 'var(--error)' }}>₹{Number(exp.amount).toFixed(2)}</td>
                    <td>₹{Number(exp.cashAmount || 0).toFixed(2)}</td>
                    <td>₹{Number(exp.upiAmount || 0).toFixed(2)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--error)' }}
                        onClick={() => {
                          if (window.confirm(`Delete expense "${exp.description}"?`)) deleteExpense(exp.id)
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Accounting
