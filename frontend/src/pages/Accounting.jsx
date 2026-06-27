import React, { useState, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Trash2, CheckCircle, Plus, Banknote, Smartphone } from 'lucide-react'
import PeriodReport from '../components/PeriodReport'
import EmptyState from '../components/common/EmptyState'

const Accounting = () => {
  const { bills, payments, expenses, advancePayments, customers, addExpense, deleteExpense, deletedPayments } = useAppContext()

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
    const activeBills = bills.filter((b) => !b.deleted && !b.isGroupParent)

    // Separate normal payments from refund payments
    const normalPayments = (payments || []).filter(p => !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0)
    const refundPaymentsList = (payments || []).filter(p => p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0)

    // Realized Revenue = sum of amountPaid on active bills
    // After the ADD_PAYMENT refund fix, bill.amountPaid is already net of refunds.
    const realizedRevenue = activeBills.reduce((s, b) => s + Number(b.amountPaid || 0), 0)

    // Total refund outflow
    const totalRefundOutflow = refundPaymentsList.reduce((s, p) => s + Math.abs(Number(p.totalPaid || 0)), 0)

    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)

    // Net Profit = Net Revenue - Total Expenses
    const netProfit = realizedRevenue - totalExpenses
    
    const totalCustomerAdvance = customers
      .filter((c) => !c.deleted)
      .reduce((sum, c) => sum + Number(c.advanceBalance || c.creditBalance || 0), 0)

    // Cash inflow from payments (refund payments have negative cashAmount, naturally reduces sum)
    const pInflow = (payments || [])
      .filter((p) => !p.notes?.includes('from advance deposit'))
      .reduce((sum, p) => sum + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    // Advance inflow EXCLUDING refund-credit advance deposits (those are internal transfers)
    const advInflow = (advancePayments || [])
      .filter(ap => !ap.isRefundCredit)
      .reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
    const totalCashInflow = pInflow + advInflow

    const netCashFlow = totalCashInflow - totalExpenses
    const pendingReceivables = activeBills
      .filter((b) => b.status !== 'paid')
      .reduce((s, b) => s + Number(b.balance || 0), 0)

    // Cash/UPI collected from NORMAL payments only (not refunds)
    const cashFromNormalPayments = normalPayments.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const upiFromNormalPayments = normalPayments.reduce((s, p) => s + Number(p.upiAmount || 0), 0)
    // Cash/UPI refunded out
    const cashRefunded = refundPaymentsList.reduce((s, p) => s + Math.abs(Number(p.cashAmount || 0)), 0)
    const upiRefunded = refundPaymentsList.reduce((s, p) => s + Math.abs(Number(p.upiAmount || 0)), 0)
    // Net cash/UPI collected (gross - refunds)
    const cashFromAdvances = (advancePayments || []).filter(ap => ap.amount > 0 && !ap.isRefundCredit).reduce((s, ap) => s + Number(ap.cashAmount || 0), 0)
    const upiFromAdvances = (advancePayments || []).filter(ap => ap.amount > 0 && !ap.isRefundCredit).reduce((s, ap) => s + Number(ap.upiAmount || 0), 0)
    const cashCollected = cashFromNormalPayments + cashFromAdvances  // gross cash received
    const upiCollected = upiFromNormalPayments + upiFromAdvances      // gross UPI received

    // Cash/UPI from expenses
    const cashSpent = (expenses || []).reduce((s, e) => s + Number(e.cashAmount || 0), 0)
    const upiSpent = (expenses || []).reduce((s, e) => s + Number(e.upiAmount || 0), 0)

    return {
      realizedRevenue, totalExpenses, netCashFlow, pendingReceivables,
      cashCollected, upiCollected, cashSpent, upiSpent,
      totalCustomerAdvance, totalCashInflow,
      netProfit, totalRefundOutflow, cashRefunded, upiRefunded
    }
  }, [bills, payments, expenses, advancePayments, customers])

  const refundStats = useMemo(() => {
    // 1. Bill Refunds (negative payments)
    const billRefundsList = payments.filter((p) => p.totalPaid < 0 || p.isRefund)
    const billRefundsTotal = billRefundsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    const billRefundsCash = billRefundsList.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const billRefundsUpi = billRefundsList.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    // 2. Payment Deletions (deleted payments)
    const delPaymentsList = deletedPayments || []
    const delPaymentsTotal = delPaymentsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    const delPaymentsCash = delPaymentsList.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const delPaymentsUpi = delPaymentsList.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    // 3. Advance Returns (negative advance payments)
    const advReturnsList = (advancePayments || []).filter((ap) => ap.amount < 0 || ap.isReturn)
    const advReturnsTotal = advReturnsList.reduce((s, ap) => s + Number(ap.amount || 0), 0)
    const advReturnsCash = advReturnsList.reduce((s, ap) => s + Number(ap.cashAmount || 0), 0)
    const advReturnsUpi = advReturnsList.reduce((s, ap) => s + Number(ap.upiAmount || 0), 0)

    return {
      billRefundsTotal: Math.abs(billRefundsTotal),
      billRefundsCash: Math.abs(billRefundsCash),
      billRefundsUpi: Math.abs(billRefundsUpi),
      billRefundsList,

      delPaymentsTotal: Math.abs(delPaymentsTotal),
      delPaymentsCash: Math.abs(delPaymentsCash),
      delPaymentsUpi: Math.abs(delPaymentsUpi),
      delPaymentsList,

      advReturnsTotal: Math.abs(advReturnsTotal),
      advReturnsCash: Math.abs(advReturnsCash),
      advReturnsUpi: Math.abs(advReturnsUpi),
      advReturnsList,
    }
  }, [payments, deletedPayments, advancePayments])

  const refundLogs = useMemo(() => {
    const logs = []
    
    // Add bill refunds
    refundStats.billRefundsList.forEach(r => {
      logs.push({
        id: r.id,
        date: r.date,
        type: 'Bill Refund',
        description: `Refund for Bill #${r.billId}`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.totalPaid || 0),
        notes: r.notes || '',
      })
    })

    // Add deleted payments
    refundStats.delPaymentsList.forEach(r => {
      logs.push({
        id: r.id,
        date: r.deletedAt || r.date,
        type: 'Payment Deletion',
        description: `Deleted Payment for Bill #${r.billId}`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.totalPaid || 0),
        notes: `Deleted on ${new Date(r.deletedAt).toLocaleDateString()}`,
      })
    })

    // Add advance returns
    refundStats.advReturnsList.forEach(r => {
      logs.push({
        id: r.id,
        date: r.date,
        type: 'Advance Return',
        description: `Returned Advance to Customer #${r.customerId}`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.amount || 0),
        notes: r.notes || '',
      })
    })

    // Sort by date descending
    return logs.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [refundStats])

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
              <div className="stat-card-label">Net Revenue</div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{stats.realizedRevenue.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Total collected (after refunds).</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon error" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><DollarSign /></div>
            <div>
              <div className="stat-card-label">Refund Outflows</div>
              <div className="stat-card-value" style={{ color: 'var(--warning)' }}>₹{stats.totalRefundOutflow.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Already deducted from Net Revenue.</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><DollarSign /></div>
            <div>
              <div className="stat-card-label">Total Advance Balance</div>
              <div className="stat-card-value" style={{ color: 'var(--info)' }}>₹{stats.totalCustomerAdvance.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Current customer credits.</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><TrendingUp /></div>
            <div>
              <div className="stat-card-label">Total Cash Inflow</div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{stats.totalCashInflow.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Net cash received (refund credits excluded).</div>
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
            <div className={`stat-card-icon ${stats.netProfit >= 0 ? 'success' : 'error'}`}><TrendingUp /></div>
            <div>
              <div className="stat-card-label">Net Profit</div>
              <div className="stat-card-value" style={{ color: stats.netProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                ₹{stats.netProfit.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="stat-card-sub">Net Revenue − Expenses.</div>
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
          <div className="stat-card-sub">Cash Inflow minus Expenses.</div>
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
            <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Collected (Gross from Customers)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Cash Collected</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>₹{stats.cashCollected.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> UPI Collected</span>
                <span style={{ fontWeight: 700, color: 'var(--info)' }}>₹{stats.upiCollected.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Cash Refunded Out</span>
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>₹{stats.cashRefunded.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> UPI Refunded Out</span>
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>₹{stats.upiRefunded.toFixed(2)}</span>
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

      {/* Refunds & Reversals Summary */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Refunds & Reversals Summary</h2>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', border: 'none', padding: 0 }}>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bill Refunds</h4>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>₹{refundStats.billRefundsTotal.toFixed(2)}</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Cash: ₹{refundStats.billRefundsCash.toFixed(2)}</span>
              <span>UPI: ₹{refundStats.billRefundsUpi.toFixed(2)}</span>
            </div>
          </div>
          
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Payment Deletions</h4>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--error)' }}>₹{refundStats.delPaymentsTotal.toFixed(2)}</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Cash: ₹{refundStats.delPaymentsCash.toFixed(2)}</span>
              <span>UPI: ₹{refundStats.delPaymentsUpi.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Advance Returns</h4>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--info)' }}>₹{refundStats.advReturnsTotal.toFixed(2)}</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Cash: ₹{refundStats.advReturnsCash.toFixed(2)}</span>
              <span>UPI: ₹{refundStats.advReturnsUpi.toFixed(2)}</span>
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
          <EmptyState
            Icon={TrendingDown}
            title="No expenses recorded"
            description="You haven't logged any business expenses yet. Use the form above to add your first expense."
          />
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

      {/* Refund & Reversal Log */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Refund & Reversal Log ({refundLogs.length})</h2>
        {refundLogs.length === 0 ? (
          <EmptyState
            Icon={AlertCircle}
            title="No refund transactions recorded"
            description="All edited bill refunds, deleted payments, and returned advances will be logged here."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Cash (₹)</th>
                  <th>UPI (₹)</th>
                  <th>Total (₹)</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {refundLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.date).toLocaleDateString()}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.id}</td>
                    <td>
                      <span className={`badge badge-${log.type === 'Bill Refund' ? 'partial' : log.type === 'Payment Deletion' ? 'unpaid' : 'info'}`} style={{ fontSize: '0.7rem' }}>
                        {log.type}
                      </span>
                    </td>
                    <td>{log.description}</td>
                    <td>₹{log.cash.toFixed(2)}</td>
                    <td>₹{log.upi.toFixed(2)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--warning)' }}>₹{log.total.toFixed(2)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.notes}</td>
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
