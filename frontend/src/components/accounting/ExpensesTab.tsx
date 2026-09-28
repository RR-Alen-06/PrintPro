import React, { useState, useMemo } from 'react'
import { Plus, Search, Trash2, Calendar, Tag, DollarSign, X, Layers, AlertCircle } from 'lucide-react'
import { SequenceService } from '../../services/sequenceService'
import EmptyState from '../common/EmptyState'

export const EXPENSE_CATEGORIES = [
  'Paper & Media',
  'Ink & Toners',
  'Equipment & Repairs',
  'Electricity & Utilities',
  'Staff Wages',
  'Shop Rent',
  'Marketing & Promo',
  'General Supplies',
  'Miscellaneous',
]

interface ExpensesTabProps {
  expenses: any[]
  onCreateExpense: (data: any) => Promise<any>
  onDeleteExpense: (id: string) => Promise<any>
  showToast: (msg: string, type?: string) => void
  showConfirm: (msg: string, onConfirm: () => void) => void
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  expenses = [],
  onCreateExpense,
  onDeleteExpense,
  showToast,
  showConfirm,
}) => {
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Add Expense Form State
  const [itemName, setItemName] = useState('')
  const [category, setCategory] = useState('Paper & Media')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calculations
  const todayStr = new Date().toISOString().slice(0, 10)
  const monthPrefix = todayStr.slice(0, 7)

  const todayExpenses = useMemo(() => {
    return expenses
      .filter((e) => (e.date || '').slice(0, 10) === todayStr)
      .reduce((sum, e) => sum + Number(e.amount || e.total || 0), 0)
  }, [expenses, todayStr])

  const monthExpenses = useMemo(() => {
    return expenses
      .filter((e) => (e.date || '').startsWith(monthPrefix))
      .reduce((sum, e) => sum + Number(e.amount || e.total || 0), 0)
  }, [expenses, monthPrefix])

  // Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach((e) => {
      const cat = e.category || 'Miscellaneous'
      map[cat] = (map[cat] || 0) + Number(e.amount || e.total || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [expenses])

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        if (!e) return false
        const matchCat = selectedCategory === 'all' || e.category === selectedCategory
        const matchSearch =
          !searchQuery ||
          (e.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.itemName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.category || '').toLowerCase().includes(searchQuery.toLowerCase())
        const expDate = (e.date || '').slice(0, 10)
        const matchFrom = !dateFrom || expDate >= dateFrom
        const matchTo = !dateTo || expDate <= dateTo
        return matchCat && matchSearch && matchFrom && matchTo
      })
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
  }, [expenses, selectedCategory, searchQuery, dateFrom, dateTo])

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmt = Number(amount || 0)
    if (!itemName.trim() || numAmt <= 0) {
      showToast('Please enter an expense name and valid amount.', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      await onCreateExpense({
        item_name: itemName.trim(),
        category,
        total: numAmt,
        amount: numAmt,
        cash_amount: paymentMethod === 'cash' ? numAmt : 0,
        upi_amount: paymentMethod === 'upi' ? numAmt : 0,
        date,
        notes: notes.trim(),
      })
      showToast(`Expense of ₹${numAmt.toFixed(2)} recorded!`, 'success')
      setItemName('')
      setAmount('')
      setNotes('')
      setShowAddModal(false)
    } catch (err: any) {
      showToast(err?.message || 'Failed to record expense', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        <div
          className="stat-card"
          style={{
            borderLeft: '4px solid var(--aurora-amber, #f59e0b)',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
          }}
        >
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Today&apos;s Expenses
          </div>
          <div className="currency-num" style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--aurora-amber, #f59e0b)', margin: '4px 0 2px' }}>
            ₹{todayExpenses.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recorded on {todayStr}</div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            This Month&apos;s Spend
          </div>
          <div className="currency-num" style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 2px' }}>
            ₹{monthExpenses.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Month-to-date operating costs</div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Top Expense Category
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--aurora-cyan, #00f0ff)', margin: '8px 0 2px' }}>
            {categoryBreakdown[0]?.[0] || 'None'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {categoryBreakdown[0] ? `₹${categoryBreakdown[0][1].toFixed(2)} total` : 'No expenses recorded'}
          </div>
        </div>
      </div>

      {/* 2. Top Categorized Visual Bars (if expenses exist) */}
      {categoryBreakdown.length > 0 && (
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>
            Expense Breakdown by Category
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {categoryBreakdown.slice(0, 4).map(([cat, totalAmt]) => {
              const maxAmt = categoryBreakdown[0][1] || 1
              const pct = Math.round((totalAmt / maxAmt) * 100)
              return (
                <div key={cat} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{cat}</span>
                    <strong style={{ color: 'var(--aurora-amber, #f59e0b)' }}>₹{totalAmt.toFixed(2)}</strong>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--aurora-amber, #f59e0b)', borderRadius: '3px' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Search, Category Filter, and Add Expense Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ minWidth: '200px', maxWidth: '280px' }}>
            <Search size={14} />
            <input
              type="text"
              className="form-input"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
            />
          </div>

          <select
            className="form-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '170px', height: '34px', fontSize: '0.82rem' }}
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
          <Plus size={14} /> Record Expense
        </button>
      </div>

      {/* 4. Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Expenses Found"
          description="No expenses match your search or filter criteria."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '45px' }}>#</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Expense Item</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Category</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Payment Method</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Notes</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp, idx) => (
                  <tr
                    key={exp.id || idx}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      backgroundColor: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {exp.date ? exp.date.slice(0, 10) : ''}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{exp.itemName || exp.description || 'Expense'}</span>
                        <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontFamily: 'monospace' }}>
                          {exp.expenseCode || SequenceService.formatDisplayCode('expense', exp, 'EXP')}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                        {exp.category || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                      {exp.upiAmount > 0 ? 'UPI' : 'Cash'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--aurora-amber, #f59e0b)' }}>
                      ₹{Number(exp.amount || exp.total || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                      {exp.notes || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          showConfirm(`Delete expense "${exp.itemName || exp.description}"?`, () => {
                            onDeleteExpense(exp.id)
                          })
                        }}
                        style={{ color: 'var(--error)' }}
                        title="Delete expense"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Record Business Expense</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Expense Title / Description *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 5 Reams A4 80GSM Paper / Toner refill"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (₹)*</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-input"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                  >
                    <option value="cash">Cash Out of Register</option>
                    <option value="upi">Digital UPI / Bank</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Vendor Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Paid to Apex Wholesale"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
