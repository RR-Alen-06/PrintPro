import React, { useState, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { Plus, Search, X, CheckCircle, AlertCircle, Wallet, UserPlus } from 'lucide-react'

const AdvancePayments = () => {
  const { customers, advancePayments, addAdvancePayment, addCustomer } = useAppContext()

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers])

  // ── Form state ────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  // New customer fields
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newType, setNewType] = useState('regular')
  // Payment fields
  const [amount, setAmount] = useState('')
  const [cashAmt, setCashAmt] = useState('')
  const [upiAmt, setUpiAmt] = useState('')
  const [payDate, setPayDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [successRef, setSuccessRef] = useState('')

  // ── Filter/search state ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCustomerId, setFilterCustomerId] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // ── Computed ──────────────────────────────────────────────────────────────
  const selectedCustomer = useMemo(
    () => activeCustomers.find((c) => c.id === selectedCustomerId),
    [activeCustomers, selectedCustomerId]
  )

  const totalAmount = Number(amount || 0)
  const totalSplit = Number(cashAmt || 0) + Number(upiAmt || 0)

  const filteredHistory = useMemo(() => {
    return advancePayments.filter((ap) => {
      const matchSearch =
        !searchQuery ||
        (ap.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        ap.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ap.customerId.toLowerCase().includes(searchQuery.toLowerCase())
      const matchCustomer = !filterCustomerId || ap.customerId === filterCustomerId
      const matchFrom = !filterDateFrom || ap.date >= filterDateFrom
      const matchTo = !filterDateTo || ap.date <= filterDateTo
      return matchSearch && matchCustomer && matchFrom && matchTo
    })
  }, [advancePayments, searchQuery, filterCustomerId, filterDateFrom, filterDateTo])

  // Advance balance summary per customer
  const balanceSummary = useMemo(() => {
    return activeCustomers
      .filter((c) => Number(c.advanceBalance || 0) > 0)
      .sort((a, b) => Number(b.advanceBalance) - Number(a.advanceBalance))
  }, [activeCustomers])

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault()
    setFormError('')

    if (!totalAmount || totalAmount <= 0) {
      setFormError('Enter a valid advance amount.')
      return
    }
    if (cashAmt !== '' || upiAmt !== '') {
      if (Math.abs(totalSplit - totalAmount) > 0.01) {
        setFormError(`Cash (₹${Number(cashAmt||0).toFixed(2)}) + UPI (₹${Number(upiAmt||0).toFixed(2)}) must equal Total ₹${totalAmount.toFixed(2)}.`)
        return
      }
    }

    let custId = selectedCustomerId
    let custName = selectedCustomer?.name || ''

    if (mode === 'new') {
      if (!newName.trim()) { setFormError('Customer name is required.'); return }
      custId = addCustomer({ type: newType, name: newName.trim(), phone: newPhone.trim(), email: '', creditBalance: 0 })
      custName = newName.trim()
    } else {
      if (!custId) { setFormError('Select a customer.'); return }
    }

    const cash = cashAmt !== '' ? Number(cashAmt) : totalAmount
    const upi = cashAmt !== '' ? Number(upiAmt || 0) : 0

    const ref = addAdvancePayment({
      customerId: custId,
      customerName: custName,
      amount: totalAmount,
      cashAmount: cash,
      upiAmount: upi,
      date: payDate,
      notes,
    })

    setSuccessRef(ref)
    // Reset form
    setMode('existing')
    setSelectedCustomerId('')
    setNewName('')
    setNewPhone('')
    setNewType('regular')
    setAmount('')
    setCashAmt('')
    setUpiAmt('')
    setPayDate(today)
    setNotes('')
    setTimeout(() => setSuccessRef(''), 5000)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Advance Payments</h1>
          <p>Record advance deposits from customers for future printing jobs.</p>
        </div>
      </div>

      {/* Balances summary */}
      {balanceSummary.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '12px' }}>Customers with Advance Balance</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {balanceSummary.map((c) => (
              <div key={c.id} style={{
                padding: '8px 16px',
                background: 'var(--info-bg)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <Wallet size={14} style={{ color: 'var(--info)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                <span style={{ fontWeight: 700, color: 'var(--info)' }}>₹{Number(c.advanceBalance).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap: '24px', alignItems: 'flex-start' }}>
        {/* Receive Advance Form */}
        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Receive Advance Payment</h2>

          {successRef && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', marginBottom: '16px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem',
            }}>
              <CheckCircle size={16} />
              Advance recorded! Reference: <strong style={{ fontFamily: 'monospace' }}>{successRef}</strong>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Customer mode toggle */}
            <div className="form-group">
              <label className="form-label">Customer</label>
              <div className="radio-group" style={{ marginBottom: '10px' }}>
                <label className={`radio-option ${mode === 'existing' ? 'selected' : ''}`}>
                  <input type="radio" checked={mode === 'existing'} onChange={() => setMode('existing')} />
                  Existing Customer
                </label>
                <label className={`radio-option ${mode === 'new' ? 'selected' : ''}`}>
                  <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} />
                  <UserPlus size={14} /> New Customer
                </label>
              </div>

              {mode === 'existing' ? (
                <select
                  className="form-select"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">-- Select customer --</option>
                  <optgroup label="Regular Customers">
                    {activeCustomers.filter((c) => c.type === 'regular').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id}){Number(c.advanceBalance || 0) > 0 ? ` · Adv: ₹${Number(c.advanceBalance).toFixed(2)}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Walk-in Customers">
                    {activeCustomers.filter((c) => c.type === 'random').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id}){Number(c.advanceBalance || 0) > 0 ? ` · Adv: ₹${Number(c.advanceBalance).toFixed(2)}` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input className="form-input" type="text" placeholder="Customer name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <input className="form-input" type="tel" placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  <select className="form-select" value={newType} onChange={(e) => setNewType(e.target.value)}>
                    <option value="regular">Regular</option>
                    <option value="random">Walk-in / Random</option>
                  </select>
                </div>
              )}

              {/* Show current advance balance */}
              {selectedCustomer && Number(selectedCustomer.advanceBalance || 0) > 0 && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--info)' }}>
                  Current advance balance: <strong>₹{Number(selectedCustomer.advanceBalance).toFixed(2)}</strong>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="form-group">
              <label className="form-label">Advance Amount (₹) *</label>
              <input
                className="form-input"
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Cash / UPI split */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cash Received (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={cashAmt}
                  onChange={(e) => setCashAmt(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">UPI Received (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={upiAmt}
                  onChange={(e) => setUpiAmt(e.target.value)}
                />
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '-8px' }}>
              Cash + UPI must equal total amount. Leave blank to auto-assign as cash.
            </p>

            {/* Date */}
            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input className="form-input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes / Remarks</label>
              <textarea
                className="form-textarea"
                placeholder="e.g. Advance for bulk printing order"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ minHeight: '60px' }}
              />
            </div>

            {formError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', marginBottom: '12px',
                background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.875rem',
              }}>
                <AlertCircle size={16} /> {formError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              <Plus size={16} /> Record Advance Payment
            </button>
          </form>
        </div>

        {/* Transaction History */}
        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Advance Transaction History</h2>

          {/* Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div className="search-input-wrapper">
              <Search size={16} />
              <input
                className="form-input"
                type="text"
                placeholder="Search by customer name or ref ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '38px' }}
              />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <select className="form-select" value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)}>
                  <option value="">All Customers</option>
                  {activeCustomers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <input className="form-input" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} placeholder="From" style={{ flex: 1 }} />
              <input className="form-input" type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} placeholder="To" style={{ flex: 1 }} />
            </div>
            {(searchQuery || filterCustomerId || filterDateFrom || filterDateTo) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearchQuery(''); setFilterCustomerId(''); setFilterDateFrom(''); setFilterDateTo('') }}>
                <X size={14} /> Clear Filters
              </button>
            )}
          </div>

          {filteredHistory.length === 0 ? (
            <div className="empty-state">
              <Wallet />
              <h4>No advance transactions</h4>
              <p>{advancePayments.length === 0 ? 'Record your first advance payment using the form.' : 'No results match your filters.'}</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ref ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Cash</th>
                    <th>UPI</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((ap) => (
                    <tr key={ap.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ap.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ap.customerName || ap.customerId}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ap.customerId}</div>
                      </td>
                      <td>{ap.date}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>₹{Number(ap.amount).toFixed(2)}</td>
                      <td>₹{Number(ap.cashAmount || 0).toFixed(2)}</td>
                      <td>₹{Number(ap.upiAmount || 0).toFixed(2)}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ap.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdvancePayments
