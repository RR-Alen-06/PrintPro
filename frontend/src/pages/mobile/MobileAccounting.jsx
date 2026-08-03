import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { DollarSign, TrendingUp, TrendingDown, Plus, Trash2, Calendar, FileText, Search } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileAccounting() {
  const navigate = useNavigate()
  const { bills, payments, expenses, advancePayments, addExpense, deleteExpense, showToast } = useAppContext()

  const [filterCategory, setFilterCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  // Expense Form State
  const [category, setCategory] = useState('Supplies')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  // Accounting Financial Calculations matching desktop Accounting.jsx
  const financialTotals = useMemo(() => {
    const totalRev = (bills || []).filter(b => !b.deleted).reduce((s, b) => s + Number(b.total || 0), 0)
    const totalExp = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalInflow = (payments || []).filter(p => !p.isRefund).reduce((s, p) => s + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    const netProfit = totalInflow - totalExp

    return {
      totalRev,
      totalExp,
      totalInflow,
      netProfit
    }
  }, [bills, expenses, payments])

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        return (e.description || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q)
      }
      return true
    }).sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [expenses, filterCategory, searchTerm])

  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault()
    const amt = Number(amount)
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid expense amount', 'error')
      return
    }

    try {
      const payload = {
        id: `exp-${Date.now()}`,
        category,
        amount: amt,
        description: description || category,
        date,
        createdAt: new Date().toISOString()
      }

      if (addExpense) {
        await addExpense(payload)
      }

      showToast(`Recorded ₹${amt.toFixed(2)} expense!`, 'success')
      setAmount('')
      setDescription('')
      setShowAddModal(false)
    } catch (err) {
      showToast('Failed to record expense', 'error')
    }
  }

  const handleDeleteExpense = async (id) => {
    try {
      if (deleteExpense) {
        await deleteExpense(id)
      }
      showToast('Expense entry deleted', 'info')
    } catch (err) {
      showToast('Failed to delete expense', 'error')
    }
  }

  return (
    <MobileLayout title="Accounting & Expenses" onSwitchToDesktop={() => navigate('/accounting')}>
      {/* Metrics Horizontally Scrollable Tray */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
        <div className="mobile-card mobile-card-glow" style={{ minWidth: '200px', flex: '0 0 auto', borderColor: 'var(--accent-primary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET CASH PROFIT</div>
          <div className="currency-num" style={{ fontSize: '1.4rem', color: financialTotals.netProfit >= 0 ? 'var(--success)' : 'var(--error)', marginTop: '4px' }}>
            ₹{financialTotals.netProfit.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="mobile-card" style={{ minWidth: '180px', flex: '0 0 auto', borderColor: 'var(--accent-tertiary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL EXPENSES</div>
          <div className="currency-num" style={{ fontSize: '1.4rem', color: 'var(--accent-tertiary)', marginTop: '4px' }}>
            ₹{financialTotals.totalExp.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="mobile-card" style={{ minWidth: '180px', flex: '0 0 auto', borderColor: 'var(--accent-secondary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL CASH INFLOW</div>
          <div className="currency-num" style={{ fontSize: '1.4rem', color: 'var(--accent-secondary)', marginTop: '4px' }}>
            ₹{financialTotals.totalInflow.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>EXPENSE JOURNAL</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>OPERATIONAL EXPENSES</h2>
        </div>
        <button className="mobile-btn mobile-btn-primary" onClick={() => setShowAddModal(true)} style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', minHeight: '38px' }}>
          <Plus size={16} /> + Expense
        </button>
      </div>

      {/* Expenses Stack */}
      {filteredExpenses.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <DollarSign size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Expenses Recorded</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>No expense entries match filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredExpenses.map(exp => (
            <div key={exp.id} className="mobile-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{exp.description || exp.category}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Date: {exp.date} • {exp.category}</div>
                </div>
                <div className="currency-num" style={{ fontSize: '1.15rem', color: 'var(--accent-tertiary)' }}>
                  -₹{Number(exp.amount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <span className="mobile-badge mobile-badge-info" style={{ fontSize: '0.68rem' }}>
                  {(exp.category || 'Expense').toUpperCase()}
                </span>
                <button onClick={() => handleDeleteExpense(exp.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Expense Bottom Sheet */}
      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Record Operational Expense">
        <form onSubmit={handleAddExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>EXPENSE CATEGORY</label>
            <select className="mobile-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="Supplies">Paper & Ink Supplies</option>
              <option value="Rent">Rent & Utilities</option>
              <option value="Salaries">Staff Salaries</option>
              <option value="Maintenance">Machine Maintenance</option>
              <option value="Marketing">Marketing & Ads</option>
              <option value="Misc">Miscellaneous</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>AMOUNT (INR)</label>
              <input type="number" step="0.01" className="mobile-input currency-num" placeholder="500.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>EXPENSE DATE</label>
              <input type="date" className="mobile-input" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>DESCRIPTION / VENDOR</label>
            <input type="text" className="mobile-input" placeholder="e.g. Purchased 10 Reams A4 Paper" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '8px' }}>
            Record Expense
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
