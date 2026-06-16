import React, { useState, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { Users, UserPlus, Search, X, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Trash2, RotateCcw, Pencil, Wallet } from 'lucide-react'

const EMPTY_FORM = {
  type: 'regular',
  name: '',
  phone: '',
  email: '',
  creditBalance: '',
}

const Customers = () => {
  const { customers, bills, payments, advancePayments, addCustomer, recordPayment, deleteCustomer, restoreCustomer, updateCustomerFull } = useAppContext()

  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false) // false = add, true = edit
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [successMsg, setSuccessMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [expandedBillId, setExpandedBillId] = useState(null)

  // Payment form state
  const [payCash, setPayCash] = useState(0)
  const [payUpi, setPayUpi] = useState(0)
  const [paySuccess, setPaySuccess] = useState(false)

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filterType === 'deleted') return c.deleted === true
      if (c.deleted) return false  // hide deleted from normal tabs
      const matchesSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone || '').includes(searchQuery)
      const matchesType = filterType === 'all' || c.type === filterType
      return matchesSearch && matchesType
    })
  }, [customers, searchQuery, filterType])

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  )

  // Bills for selected customer (non-deleted, newest first)
  const customerBills = useMemo(() => {
    if (!selectedCustomerId) return []
    return bills
      .filter((b) => !b.deleted && b.customerId === selectedCustomerId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [bills, selectedCustomerId])

  // Outstanding balance for selected customer
  const outstandingBalance = useMemo(() => {
    return customerBills.reduce((sum, b) => sum + Number(b.balance || 0), 0)
  }, [customerBills])

  // Total outstanding for any customer (for list display)
  const getCustomerOutstanding = (customerId) => {
    return bills
      .filter((b) => !b.deleted && b.customerId === customerId)
      .reduce((sum, b) => sum + Number(b.balance || 0), 0)
  }

  // Apply payment to oldest unpaid bills first
  const handleApplyPayment = () => {
    const cash = Number(payCash || 0)
    const upi = Number(payUpi || 0)
    const totalPaying = cash + upi
    if (totalPaying <= 0 || !selectedCustomer) return

    // Get unpaid bills sorted oldest first
    const unpaidBills = customerBills
      .filter((b) => b.balance > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    let remaining = totalPaying
    for (const bill of unpaidBills) {
      if (remaining <= 0) break
      const toApply = Math.min(remaining, bill.balance)
      const billCash = Math.min(cash, toApply)
      const billUpi = toApply - billCash
      recordPayment({
        billId: bill.id,
        customerId: selectedCustomer.id,
        cashAmount: billCash,
        upiAmount: billUpi,
        notes: `Payment from customer page`,
      })
      remaining -= toApply
    }

    setPayCash(0)
    setPayUpi(0)
    setPaySuccess(true)
    setTimeout(() => setPaySuccess(false), 3500)
  }

  const openModal = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setSuccessMsg('')
    setEditMode(false)
    setEditingId(null)
    setShowModal(true)
  }

  const openEditModal = (customer) => {
    setForm({
      type: customer.type,
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      creditBalance: String(customer.creditBalance || 0),
    })
    setErrors({})
    setSuccessMsg('')
    setEditMode(true)
    setEditingId(customer.id)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setErrors({})
    setEditMode(false)
    setEditingId(null)
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required.'
    if (form.phone && !/^\d{7,15}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Enter a valid email.'
    if (form.type === 'regular' && form.creditBalance !== '' && isNaN(Number(form.creditBalance))) {
      errs.creditBalance = 'Enter a valid number.'
    }
    return errs
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    if (editMode && editingId) {
      // Edit mode — preserve ID, update editable fields
      updateCustomerFull(editingId, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        creditBalance: form.type === 'regular' ? Number(form.creditBalance || 0) : undefined,
      })
      setSuccessMsg(`Customer updated successfully!`)
    } else {
      addCustomer({
        type: form.type,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        creditBalance: form.type === 'regular' ? Number(form.creditBalance || 0) : 0,
        status: 'active',
      })
      setSuccessMsg(`Customer "${form.name.trim()}" added successfully!`)
    }

    setTimeout(() => {
      setShowModal(false)
      setSuccessMsg('')
    }, 1500)
  }

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n })
  }

  const regular = customers.filter((c) => c.type === 'regular' && !c.deleted)
  const random = customers.filter((c) => c.type === 'random' && !c.deleted)
  const deletedCustomers = customers.filter((c) => c.deleted)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>View and manage regular and walk-in customers, credit balances, and billing history.</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          <UserPlus size={16} /> Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon indigo"><Users /></div>
            <div>
              <div className="stat-card-label">Regular Customers</div>
              <div className="stat-card-value">{regular.length}</div>
            </div>
          </div>
          <div className="stat-card-sub">Tracked billing &amp; credit history.</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon cyan"><UserPlus /></div>
            <div>
              <div className="stat-card-label">Walk-in / Random</div>
              <div className="stat-card-value">{random.length}</div>
            </div>
          </div>
          <div className="stat-card-sub">One-time &amp; walk-in customers.</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tabs" style={{ marginBottom: '16px' }}>
        {[
          { key: 'all', label: 'All', count: customers.filter((c) => !c.deleted).length },
          { key: 'regular', label: 'Regular', count: regular.length },
          { key: 'random', label: 'Walk-in', count: random.length },
          { key: 'deleted', label: '🗑 Deleted', count: deletedCustomers.length },
        ].map((t) => (
          <button
            key={t.key}
            className={`tab ${filterType === t.key ? 'active' : ''}`}
            onClick={() => { setFilterType(t.key); setSelectedCustomerId(null) }}
          >
            {t.label}
            <span style={{ fontSize: '0.75rem', opacity: 0.75, marginLeft: '4px' }}>
              ({t.count})
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="filters-bar" style={{ marginBottom: '16px' }}>
        <div className="search-input-wrapper" style={{ flex: 1, maxWidth: '360px' }}>
          <Search size={16} />
          <input
            className="form-input"
            type="text"
            placeholder="Search by name, ID or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px' }}
          />
        </div>
        {searchQuery && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSearchQuery('')}><X size={14} /></button>
        )}
      </div>

      {filterType !== 'deleted' && (
        <div className="grid-2" style={{ gap: '24px', alignItems: 'flex-start' }}>
          {/* Customer List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0 }}>
                Customer List{' '}
                <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                  ({filteredCustomers.length})
                </span>
              </h2>
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {filteredCustomers.length === 0 ? (
                <div className="empty-state">
                  <Users />
                  <h4>No customers found</h4>
                  <p>Try adjusting your search or filters.</p>
                </div>
              ) : (
                filteredCustomers.map((customer) => {
                  const outstanding = getCustomerOutstanding(customer.id)
                  const isSelected = selectedCustomerId === customer.id
                  return (
                    <div
                      key={customer.id}
                      onClick={() => {
                        if (customer.deleted) return
                        setSelectedCustomerId(isSelected ? null : customer.id)
                        setPayCash(0)
                        setPayUpi(0)
                        setPaySuccess(false)
                      }}
                      style={{
                        padding: '14px 20px',
                        cursor: customer.deleted ? 'default' : 'pointer',
                        borderBottom: '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-light)' : 'transparent',
                        borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                        transition: 'var(--transition)',
                        opacity: customer.deleted ? 0.6 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{customer.name}</span>
                            <span className={`badge ${customer.type === 'regular' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                              {customer.type === 'regular' ? 'Regular' : 'Walk-in'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {customer.id}{customer.phone ? ` · ${customer.phone}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: outstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
                              ₹{outstanding.toFixed(2)}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {outstanding > 0 ? 'outstanding' : 'settled'}
                            </div>
                          </div>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ flexShrink: 0, color: 'var(--error)' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (outstanding > 0) {
                                alert(`Cannot delete "${customer.name}" — ₹${outstanding.toFixed(2)} outstanding. Settle all bills first.`)
                                return
                              }
                              if (window.confirm(`Move "${customer.name}" to deleted? Can be restored anytime.`)) {
                                deleteCustomer(customer.id)
                                if (selectedCustomerId === customer.id) setSelectedCustomerId(null)
                              }
                            }}
                            title="Delete customer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Customer Detail Panel */}
          {selectedCustomer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header card */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0 }}>{selectedCustomer.name}</h2>
                    <span className={`badge ${selectedCustomer.type === 'regular' ? 'badge-info' : 'badge-warning'}`}>
                      {selectedCustomer.type === 'regular' ? 'Regular' : 'Walk-in'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    ID: <strong style={{ fontFamily: 'monospace' }}>{selectedCustomer.id}</strong>
                    {selectedCustomer.phone && ` · ${selectedCustomer.phone}`}
                    {selectedCustomer.email && ` · ${selectedCustomer.email}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); openEditModal(selectedCustomer) }}
                    title="Edit customer"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomerId(null)}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Balance pills */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  background: outstandingBalance > 0 ? 'var(--warning-bg)' : 'var(--success-bg)',
                  border: `1px solid ${outstandingBalance > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Outstanding</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: outstandingBalance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                    ₹{outstandingBalance.toFixed(2)}
                  </span>
                </div>
                {Number(selectedCustomer.advanceBalance || 0) > 0 && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px', borderRadius: 'var(--radius-md)',
                    background: 'var(--info-bg)', border: '1px solid rgba(59,130,246,0.25)',
                  }}>
                    <Wallet size={13} style={{ color: 'var(--info)' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Advance</span>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--info)' }}>
                      ₹{Number(selectedCustomer.advanceBalance).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Billing History */}
            <div className="card">
              <h3 style={{ marginBottom: '12px' }}>Billing History ({customerBills.length})</h3>
              {customerBills.length === 0 ? (
                <p className="text-muted">No bills found for this customer.</p>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Bill ID</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerBills.map((bill) => (
                        <React.Fragment key={bill.id}>
                          <tr>
                            <td>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px' }}
                                onClick={() => setExpandedBillId(expandedBillId === bill.id ? null : bill.id)}
                              >
                                {expandedBillId === bill.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{bill.id}</td>
                            <td>{bill.date}</td>
                            <td>₹{bill.total.toFixed(2)}</td>
                            <td>₹{bill.amountPaid.toFixed(2)}</td>
                            <td style={{ color: bill.balance > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                              ₹{bill.balance.toFixed(2)}
                            </td>
                            <td>
                              <span className={`badge badge-${bill.status === 'paid' ? 'paid' : bill.status === 'partial' ? 'partial' : 'unpaid'}`}>
                                {bill.status}
                              </span>
                            </td>
                          </tr>
                          {expandedBillId === bill.id && (
                            <tr>
                              <td colSpan={7} style={{ padding: '0 16px 12px', background: 'var(--bg-elevated)' }}>
                                <div style={{ padding: '12px 0' }}>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Line Items</div>
                                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)' }}>Item</th>
                                        <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)' }}>Type</th>
                                        <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)' }}>Sides</th>
                                        <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)' }}>Qty</th>
                                        <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)' }}>Unit</th>
                                        <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)' }}>Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(bill.items || []).map((item, i) => (
                                        <tr key={i}>
                                          <td style={{ padding: '4px 8px', color: 'var(--text-primary)' }}>{item.itemName || item.name}</td>
                                          <td style={{ padding: '4px 8px' }}>{item.printType === 'color' ? 'Color' : 'B/W'}</td>
                                          <td style={{ padding: '4px 8px' }}>{item.sides === 'single' ? 'Single' : 'Double'}</td>
                                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>{item.qty}</td>
                                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>₹{Number(item.unitPrice).toFixed(2)}</td>
                                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>₹{Number(item.amount).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment form (only if outstanding > 0) */}
            {outstandingBalance > 0 && (
              <div className="card">
                <h3 style={{ marginBottom: '12px' }}>Record Payment</h3>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                  Payment will be applied to the oldest unpaid bills first. Total outstanding: <strong style={{ color: 'var(--warning)' }}>₹{outstandingBalance.toFixed(2)}</strong>
                </p>

                {paySuccess && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', marginBottom: '12px',
                    background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
                  }}>
                    <CheckCircle size={16} /> Payment recorded successfully!
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Cash Amount (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={payCash}
                      onChange={(e) => setPayCash(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">UPI Amount (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={payUpi}
                      onChange={(e) => setPayUpi(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Paying Now: <strong style={{ color: 'var(--text-primary)' }}>
                      ₹{(Number(payCash || 0) + Number(payUpi || 0)).toFixed(2)}
                    </strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Balance After: <strong style={{ color: 'var(--accent)' }}>
                      ₹{Math.max(outstandingBalance - (Number(payCash || 0) + Number(payUpi || 0)), 0).toFixed(2)}
                    </strong>
                  </span>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleApplyPayment}
                  disabled={Number(payCash || 0) + Number(payUpi || 0) <= 0}
                >
                  <CheckCircle size={16} /> Apply Payment
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
            <div className="empty-state">
              <Users />
              <h4>Select a customer</h4>
              <p>Click a customer from the list to view their billing history and record payments.</p>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Deleted customers tab */}
      {filterType === 'deleted' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0 }}>
              Deleted Customers{' '}
              <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                ({filteredCustomers.length})
              </span>
            </h2>
          </div>
          {filteredCustomers.length === 0 ? (
            <div className="empty-state">
              <Users />
              <h4>No deleted customers</h4>
              <p>Customers you delete will appear here and can be restored.</p>
            </div>
          ) : (
            <div>
              {filteredCustomers.map((customer) => (
                <div key={customer.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.7 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{customer.name}</span>
                      <span className={`badge ${customer.type === 'regular' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                        {customer.type === 'regular' ? 'Regular' : 'Walk-in'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {customer.id}{customer.phone ? ` · ${customer.phone}` : ''}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => restoreCustomer(customer.id)}
                  >
                    <RotateCcw size={13} /> Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Customer Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editMode ? 'Edit Customer' : 'Add Customer'}</h3>
              <button className="modal-close btn-icon" onClick={closeModal} type="button">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {successMsg && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', marginBottom: '16px',
                    background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
                  }}>
                    <CheckCircle size={16} /> {successMsg}
                  </div>
                )}

                {/* In edit mode, type is read-only */}
                <div className="form-group">
                  <label className="form-label">Customer Type</label>
                  {editMode ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge ${form.type === 'regular' ? 'badge-info' : 'badge-warning'}`}>
                        {form.type === 'regular' ? 'Regular' : 'Walk-in / Random'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(cannot change type after creation)</span>
                    </div>
                  ) : (
                    <div className="radio-group">
                      <label className={`radio-option ${form.type === 'regular' ? 'selected' : ''}`}>
                        <input type="radio" name="type" value="regular" checked={form.type === 'regular'} onChange={() => handleChange('type', 'regular')} />
                        Regular
                      </label>
                      <label className={`radio-option ${form.type === 'random' ? 'selected' : ''}`}>
                        <input type="radio" name="type" value="random" checked={form.type === 'random'} onChange={() => handleChange('type', 'random')} />
                        Walk-in / Random
                      </label>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Name <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input
                    className={`form-input${errors.name ? ' form-input-error' : ''}`}
                    type="text"
                    placeholder="Full name or business name"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                  {errors.name && (
                    <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {errors.name}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className={`form-input${errors.phone ? ' form-input-error' : ''}`}
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                  />
                  {errors.phone && (
                    <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {errors.phone}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className={`form-input${errors.email ? ' form-input-error' : ''}`}
                    type="email"
                    placeholder="e.g. customer@email.com"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                  />
                  {errors.email && (
                    <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {errors.email}
                    </div>
                  )}
                </div>

                {form.type === 'regular' && (
                  <div className="form-group">
                    <label className="form-label">Opening Credit Balance (₹)</label>
                    <input
                      className={`form-input${errors.creditBalance ? ' form-input-error' : ''}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.creditBalance}
                      onChange={(e) => handleChange('creditBalance', e.target.value)}
                    />
                    {errors.creditBalance && (
                      <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} /> {errors.creditBalance}
                      </div>
                    )}
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Leave blank for ₹0. Updated automatically as bills are paid.
                    </p>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editMode ? <><Pencil size={16} /> Save Changes</> : <><UserPlus size={16} /> Add Customer</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Customers
