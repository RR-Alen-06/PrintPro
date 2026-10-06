import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import EmptyState from '../components/common/EmptyState'
import { Users, UserPlus, Search, X, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Trash2, RotateCcw, Pencil, Wallet, Link2, Copy, ClipboardList, Tag, Gift, Award, History, Plus, Minus } from 'lucide-react'
import { getCustomerLoyalty, adjustCustomerLoyalty, deleteLoyaltyEvent } from '../api/loyalty'

const EMPTY_FORM = {
  type: 'regular',
  name: '',
  phone: '',
  email: '',
  creditBalance: '',
  openingBalanceMethod: 'cash',
  openingCash: '',
  openingUpi: '',
}

const Customers = () => {
  const { business, customers, bills, payments, advancePayments, addCustomer, updateCustomer, recordPayment, recordSpecificBillPayment, recordSplitGroupPayment, deleteCustomer, restoreCustomer, updateCustomerFull, applyPostDiscount, showAlert, showConfirm, showToast } = useAppContext()
  const navigate = useNavigate()

  const copyUpiLink = (link) => {
    if (!link) return
    navigator.clipboard.writeText(link)
  }

  const getUpiLink = (amount, notesText = 'Opening Balance') => {
    if (!business?.upiId || amount <= 0) return ''
    const params = new URLSearchParams({
      pa: business.upiId,
      pn: business.shopName || 'PrintPro',
      am: amount.toFixed(2),
      cu: 'INR',
      tn: notesText,
    })
    return `upi://pay?${params.toString()}`
  }

  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false) // false = add, true = edit
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [successMsg, setSuccessMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [upiCheckoutAmount, setUpiCheckoutAmount] = useState(0)
  const [qrGenerated, setQrGenerated] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [expandedBillId, setExpandedBillId] = useState(null)

  // Loyalty History and Adjustment Modals State
  const [loyaltyCustomer, setLoyaltyCustomer] = useState(null)
  const [loyaltyEvents, setLoyaltyEvents] = useState([])
  const [loyaltyBalance, setLoyaltyBalance] = useState(0)
  const [loadingLoyalty, setLoadingLoyalty] = useState(false)

  const [adjustModalCustomer, setAdjustModalCustomer] = useState(null)
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustOperation, setAdjustOperation] = useState('add')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const openLoyaltyHistory = async (customer) => {
    setLoyaltyCustomer(customer)
    setLoadingLoyalty(true)
    try {
      const res = await getCustomerLoyalty(customer.id)
      setLoyaltyEvents(res.data?.data?.events || [])
      setLoyaltyBalance(res.data?.data?.balance ?? (customer.loyaltyPoints || 0))
    } catch (err) {
      console.error('Failed to load customer loyalty:', err)
      setLoyaltyEvents([])
      setLoyaltyBalance(customer.loyaltyPoints || 0)
    } finally {
      setLoadingLoyalty(false)
    }
  }

  const handleDeleteLoyaltyEvent = async (eventId) => {
    try {
      const res = await deleteLoyaltyEvent(eventId)
      const newBal = res.data?.data?.new_balance ?? 0
      setLoyaltyEvents(prev => prev.filter(e => String(e.id) !== String(eventId)))
      setLoyaltyBalance(newBal)
      if (loyaltyCustomer) {
        updateCustomer(loyaltyCustomer.id, { loyaltyPoints: newBal })
      }
      showToast?.('Loyalty event deleted and balance recalculated', 'success')
    } catch (err) {
      console.error('Failed to delete loyalty event:', err)
      showAlert('Failed to delete loyalty event', 'error')
    }
  }

  const handleOpenAdjustModal = (customer) => {
    setAdjustModalCustomer(customer)
    setAdjustPoints('')
    setAdjustOperation('add')
    setAdjustNotes('')
  }

  const handleSavePointsAdjustment = async (e) => {
    e.preventDefault()
    const pts = parseInt(adjustPoints, 10)
    if (isNaN(pts) || pts <= 0) {
      showAlert('Please enter a valid positive number of points', 'error')
      return
    }

    setAdjusting(true)
    try {
      const res = await adjustCustomerLoyalty(adjustModalCustomer.id, {
        points: pts,
        operation: adjustOperation,
        notes: adjustNotes || 'Manual points adjustment by owner'
      })
      const newBal = res.data?.data?.balance ?? 0
      updateCustomer(adjustModalCustomer.id, { loyaltyPoints: newBal })
      if (loyaltyCustomer && loyaltyCustomer.id === adjustModalCustomer.id) {
        setLoyaltyBalance(newBal)
        const event = res.data?.data?.event
        if (event) setLoyaltyEvents(prev => [event, ...prev])
      }
      showToast?.(`Successfully ${adjustOperation === 'add' ? 'added' : 'deducted'} ${pts} points`, 'success')
      setAdjustModalCustomer(null)
    } catch (err) {
      console.error('Failed to adjust points:', err)
      showAlert('Failed to adjust customer points', 'error')
    } finally {
      setAdjusting(false)
    }
  }

  // Payment form state
  const [payCash, setPayCash] = useState(0)
  const [payUpi, setPayUpi] = useState(0)
  const [paySuccess, setPaySuccess] = useState(false)

  // Targeted bill payment state
  const [targetBillPayId, setTargetBillPayId] = useState(null) // which bill's pay panel is open
  const [targetCash, setTargetCash] = useState(0)
  const [targetUpi, setTargetUpi] = useState(0)
  const [targetPaySuccess, setTargetPaySuccess] = useState(false)
  const [targetBillQrGenerated, setTargetBillQrGenerated] = useState(false)
  const [targetBillUpiCheckoutAmount, setTargetBillUpiCheckoutAmount] = useState(0)

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

  // Apply payment to oldest unpaid bills first via FIFO (handled in AppContext)
  const handleApplyPayment = () => {
    const cash = Number(payCash || 0)
    const upi = Number(payUpi || 0)
    const totalPaying = cash + upi
    if (totalPaying <= 0 || !selectedCustomer) return

    // Pass the lump-sum payment to recordPayment — AppContext handles FIFO
    // distribution across unpaid bills and credits excess to advance balance
    recordPayment({
      customerId: selectedCustomer.id,
      cashAmount: cash,
      upiAmount: upi,
      notes: `Payment from customer page`,
    })

    setPayCash(0)
    setPayUpi(0)
    setPaySuccess(true)
    setTimeout(() => setPaySuccess(false), 3500)
  }

  const handleTargetBillPayment = (bill) => {
    const cash = Number(targetCash || 0)
    const upi = Number(targetUpi || 0)
    if (cash + upi <= 0) { showAlert('Enter a payment amount.', 'error'); return }

    const groupMembers = bills.filter(b => b.groupBillId === bill.groupBillId && !b.deleted && !b.isGroupParent)
    const isSplitGroup = bill.groupBillId && groupMembers.length > 1

    if (isSplitGroup && (cash + upi > bill.balance + 0.01)) {
      recordSplitGroupPayment({
        payerBillId: bill.id,
        payerCustomerId: bill.customerId,
        cashAmount: cash,
        upiAmount: upi,
        groupBillId: bill.groupBillId,
        notes: `Group payment from customer page for bill ${bill.id}`,
      })
    } else {
      recordSpecificBillPayment({
        billId: bill.id,
        customerId: bill.customerId,
        cashAmount: cash,
        upiAmount: upi,
        notes: `Selective payment for bill ${bill.id}`,
      })
    }
    setTargetBillPayId(null)
    setTargetCash(0)
    setTargetUpi(0)
    setTargetPaySuccess(true)
    setTimeout(() => setTargetPaySuccess(false), 3500)
  }

  const openModal = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setSuccessMsg('')
    setEditMode(false)
    setEditingId(null)
    setUpiCheckoutAmount(0)
    setQrGenerated(false)
    setShowModal(true)
  }

  const openEditModal = (customer) => {
    setForm({
      type: customer.type,
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      creditBalance: String(customer.creditBalance || 0),
      openingBalanceMethod: 'cash',
      openingCash: '',
      openingUpi: '',
    })
    setErrors({})
    setSuccessMsg('')
    setEditMode(true)
    setEditingId(customer.id)
    setUpiCheckoutAmount(0)
    setQrGenerated(false)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setErrors({})
    setEditMode(false)
    setEditingId(null)
    setUpiCheckoutAmount(0)
    setQrGenerated(false)
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required.'
    if (form.phone && !/^\d{7,15}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Enter a valid email.'
    
    if (form.type === 'regular' && !editMode) {
      if (form.openingBalanceMethod === 'cash' || form.openingBalanceMethod === 'split') {
        if (form.openingCash !== '' && isNaN(Number(form.openingCash))) {
          errs.openingCash = 'Enter a valid cash amount.'
        }
      }
      if (form.openingBalanceMethod === 'upi' || form.openingBalanceMethod === 'split') {
        if (form.openingUpi !== '' && isNaN(Number(form.openingUpi))) {
          errs.openingUpi = 'Enter a valid UPI amount.'
        }
      }
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
      const isRegular = form.type === 'regular'
      const method = form.openingBalanceMethod
      
      const opCash = isRegular ? (
        method === 'cash' ? Number(form.openingCash || 0) :
        method === 'split' ? Number(form.openingCash || 0) : 0
      ) : 0

      const opUpi = isRegular ? (
        method === 'upi' ? Number(form.openingUpi || 0) :
        method === 'split' ? Number(form.openingUpi || 0) : 0
      ) : 0

      addCustomer({
        type: form.type,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        creditBalance: opCash + opUpi,
        openingCash: opCash,
        openingUpi: opUpi,
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
          { key: 'deleted', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Trash2 size={13} /> Deleted</span>, count: deletedCustomers.length },
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
                <EmptyState
                  Icon={Users}
                  title="No customers found"
                  description="Try adjusting your search query or switching filters."
                />
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'start' }}>
                        {/* Left Side: Identity Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span 
                              style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0 }} 
                              title={customer.name}
                            >
                              {customer.name}
                            </span>
                            <span className={`badge ${customer.type === 'regular' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.62rem', padding: '2px 6px', flexShrink: 0 }}>
                              {customer.type === 'regular' ? 'Regular' : 'Walk-in'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {customer.id}
                          </div>
                          {customer.phone && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {customer.phone}
                            </div>
                          )}
                          {Number(customer.advanceBalance || customer.creditBalance || 0) > 0 && (
                            <div style={{ display: 'flex', marginTop: '2px' }}>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: 'var(--success)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)'
                              }}>
                                Adv: ₹{Number(customer.advanceBalance || customer.creditBalance || 0).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right Side: Balances & Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0, minWidth: '80px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: outstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
                              ₹{outstanding.toFixed(2)}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
                              {outstanding > 0 ? 'outstanding' : 'settled'}
                            </div>
                          </div>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ flexShrink: 0, color: 'var(--error)', padding: '4px', minHeight: 'unset', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (outstanding > 0) {
                                showAlert(`Cannot delete "${customer.name}" — ₹${outstanding.toFixed(2)} outstanding. Settle all bills first.`, 'error')
                                return
                              }
                              showConfirm(
                                'Delete Customer',
                                `Move "${customer.name}" to deleted? Can be restored anytime.`,
                                () => {
                                  deleteCustomer(customer.id)
                                  if (selectedCustomerId === customer.id) setSelectedCustomerId(null)
                                }
                              )
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
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); openLoyaltyHistory(selectedCustomer) }}
                    title="View loyalty point history"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <History size={13} color="#a855f7" /> Loyalty
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleOpenAdjustModal(selectedCustomer) }}
                    title="Manually adjust loyalty points"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Gift size={13} color="#c084fc" /> Adjust Points
                  </button>
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
                <div 
                  onClick={() => openLoyaltyHistory(selectedCustomer)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)',
                    cursor: 'pointer',
                  }}
                  title="Click to view full loyalty event history"
                >
                  <Gift size={14} style={{ color: '#a855f7' }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loyalty Points</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#c084fc' }}>
                    {selectedCustomer.loyaltyPoints || 0} pts
                  </span>
                </div>
              </div>
            </div>

            {/* Billing History */}
            <div className="card">
              <h3 style={{ marginBottom: '12px' }}>Billing History ({customerBills.length})</h3>
              {customerBills.length === 0 ? (
                <EmptyState
                  Icon={ClipboardList}
                  title="No bills found"
                  description="This customer does not have any billing records yet."
                />
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
                        <th>Actions</th>
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
                            <td>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', color: 'var(--warning)' }}
                                  onClick={() => navigate(`/billing?edit=${bill.id}`)}
                                  title="Edit Bill"
                                >
                                  <Pencil size={14} /> Edit
                                </button>
                                {bill.status !== 'paid' && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', color: '#10b981', fontSize: '12px' }}
                                    onClick={() => {
                                      setTargetBillPayId(targetBillPayId === bill.id ? null : bill.id)
                                      setTargetCash(0)
                                      setTargetUpi(0)
                                      setTargetBillQrGenerated(false)
                                      setTargetBillUpiCheckoutAmount(0)
                                    }}
                                    title="Pay This Bill"
                                  >
                                    <Wallet size={13} /> Pay
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                           {expandedBillId === bill.id && (
                             <tr>
                               <td colSpan={8} style={{ padding: '0 16px 12px', background: 'var(--bg-elevated)' }}>
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

                                  {/* Post-Bill Discount Form */}
                                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Post-Bill Discount</div>
                                    <form onSubmit={(e) => {
                                      e.preventDefault()
                                      const formEl = e.target
                                      const type = formEl.discountType.value
                                      const val = Number(formEl.discountValue.value || 0)
                                      if (val < 0) {
                                        showAlert('Discount value cannot be negative.', 'error')
                                        return
                                      }
                                      applyPostDiscount(bill.id, type, val)
                                      showAlert('Post-bill discount applied successfully.', 'success')
                                    }} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                      <select name="discountType" className="form-select" style={{ width: '120px', padding: '6px', height: '32px', fontSize: '0.8rem' }} defaultValue={bill.discountType || 'flat'}>
                                        <option value="flat">Flat (₹)</option>
                                        <option value="percent">Percent (%)</option>
                                      </select>
                                      <input
                                        type="number"
                                        name="discountValue"
                                        step="any"
                                        className="form-input"
                                        style={{ width: '100px', padding: '6px', height: '32px', fontSize: '0.8rem' }}
                                        placeholder="Value"
                                        defaultValue={bill.discountValue || 0}
                                        min="0"
                                      />
                                      <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', height: '32px', fontSize: '0.8rem' }}>
                                        Apply Discount
                                      </button>
                                    </form>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          {/* Pay This Bill Panel */}
                          {targetBillPayId === bill.id && bill.status !== 'paid' && (
                            <tr>
                              <td colSpan={8} style={{ padding: '0 16px 12px', background: 'rgba(16,185,129,0.05)' }}>
                                <div style={{ padding: '12px', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', marginTop: '4px' }}>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Wallet size={13} /> Pay This Bill Only — {bill.id}
                                    <span style={{ color: '#71717a', fontWeight: 400 }}>(Balance: ₹{Number(bill.balance).toFixed(2)})</span>
                                  </div>
                                  {(() => {
                                    const groupMembers = bills.filter(b => b.groupBillId === bill.groupBillId && !b.deleted && !b.isGroupParent)
                                    const isSplit = bill.groupBillId && groupMembers.length > 1
                                    if (!isSplit) return null
                                    const groupBal = groupMembers.reduce((s, b) => s + b.balance, 0)
                                    return (
                                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          style={{ fontSize: '11px', padding: '4px 8px' }}
                                          onClick={() => {
                                            setTargetCash(String(bill.balance))
                                            setTargetUpi('0')
                                          }}
                                        >
                                          Pay My Share (₹{Number(bill.balance).toFixed(2)})
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          style={{ fontSize: '11px', padding: '4px 8px' }}
                                          onClick={() => {
                                            setTargetCash(String(groupBal))
                                            setTargetUpi('0')
                                          }}
                                        >
                                          Pay Full Group (₹{Number(groupBal).toFixed(2)})
                                        </button>
                                      </div>
                                    )
                                  })()}
                                  {targetPaySuccess && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '13px', marginBottom: '8px' }}>
                                      <CheckCircle size={14} /> Payment recorded!
                                    </div>
                                  )}
                                   <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <div>
                                      <label style={{ fontSize: '12px', color: '#71717a', display: 'block', marginBottom: '4px' }}>Cash (₹)</label>
                                      <input className="form-input" type="number" min="0" step="0.01" value={targetCash}
                                        style={{ width: '110px', padding: '6px 8px', fontSize: '13px' }}
                                        onChange={(e) => setTargetCash(e.target.value)} />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '12px', color: '#71717a', display: 'block', marginBottom: '4px' }}>UPI (₹)</label>
                                      <input className="form-input" type="number" min="0" step="0.01" value={targetUpi}
                                        style={{ width: '110px', padding: '6px 8px', fontSize: '13px' }}
                                        onChange={(e) => {
                                          setTargetUpi(e.target.value)
                                          setTargetBillQrGenerated(false)
                                          setTargetBillUpiCheckoutAmount(0)
                                        }} />
                                    </div>
                                    <button
                                      type="button" className="btn btn-primary"
                                      style={{ padding: '7px 16px', fontSize: '13px', background: '#10b981', border: 'none' }}
                                      onClick={() => handleTargetBillPayment(bill)}
                                    >
                                      Record Payment
                                    </button>
                                    <button
                                      type="button" className="btn btn-ghost btn-sm"
                                      onClick={() => setTargetBillPayId(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>

                                  {/* Inline UPI Checkout Option */}
                                  <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
                                    <label className="form-label" style={{ fontSize: '0.78rem', color: '#71717a' }}>UPI Checkout</label>
                                    <div style={{ gap: '12px', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        disabled={!Number(targetUpi || 0)}
                                        onClick={() => {
                                          setTargetBillUpiCheckoutAmount(Number(targetUpi || 0))
                                          setTargetBillQrGenerated(true)
                                        }}
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <Link2 size={14} /> Generate QR
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        disabled={!Number(targetUpi || 0) || !business?.upiId}
                                        onClick={() => copyUpiLink(getUpiLink(Number(targetUpi || 0), `Payment for Bill ${bill.id}`))}
                                        style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <Copy size={14} /> Copy Link
                                      </button>
                                    </div>
                                    {business?.upiId ? (
                                      <>
                                        {targetBillQrGenerated && targetBillUpiCheckoutAmount > 0 && (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '10px', background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', width: 'fit-content' }}>
                                            <img
                                              src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(getUpiLink(targetBillUpiCheckoutAmount, `Payment for Bill ${bill.id}`))}`}
                                              alt="UPI QR Code"
                                              style={{ borderRadius: '8px', border: '3px solid var(--accent)', padding: '4px', background: '#fff' }}
                                              width={110} height={110}
                                            />
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scan with any UPI app to receive ₹{targetBillUpiCheckoutAmount.toFixed(2)}</span>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <p className="text-muted" style={{ marginTop: '6px', fontSize: '0.78rem' }}>Set your UPI ID in Settings to enable QR codes.</p>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#71717a', marginTop: '8px' }}>
                                    ⚠ This payment applies only to {bill.id}, no FIFO reordering.
                                  </div>
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

            {/* Promotions Used section */}
            {(() => {
              const customerPromos = bills
                .filter((b) => !b.deleted && b.customerId === selectedCustomer.id && b.promoCode)
                .map((b) => ({
                  code: b.promoCode,
                  usedOn: b.date,
                  invoice: b.id,
                  discount: b.promoDiscount || b.discountAmount || 0,
                  status: 'Redeemed',
                }))

              return (
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Tag size={16} style={{ color: 'var(--accent)' }} />
                    <h3 style={{ margin: 0 }}>Promotions Used ({customerPromos.length})</h3>
                  </div>
                  {customerPromos.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No promotions used by this customer yet.</p>
                  ) : (
                    <div className="table-container">
                      <table className="table" style={{ fontSize: '0.82rem' }}>
                        <thead>
                          <tr>
                            <th>Promo Code</th>
                            <th>Used On</th>
                            <th>Invoice</th>
                            <th style={{ textAlign: 'right' }}>Discount</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerPromos.map((cp, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{cp.code}</td>
                              <td>{cp.usedOn}</td>
                              <td style={{ fontFamily: 'monospace' }}>{cp.invoice}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>₹{cp.discount.toFixed(2)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badge badge-paid" style={{ textTransform: 'none', fontSize: '0.7rem', padding: '2px 6px' }}>
                                  {cp.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Payment form — always show if customer is selected */}
            <div className="card">
              <h3 style={{ marginBottom: '12px' }}>Record Payment</h3>
              {outstandingBalance > 0 ? (
                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                  Payment applied to oldest unpaid bills first (FIFO). Total outstanding: <strong style={{ color: 'var(--warning)' }}>₹{outstandingBalance.toFixed(2)}</strong>
                </p>
              ) : (
                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                  No outstanding bills. Any payment received will be added to the customer's advance credit balance.
                </p>
              )}

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

              {/* Live payment summary */}
              {(() => {
                const totalPaying = Number(payCash || 0) + Number(payUpi || 0)
                const balanceAfter = Math.max(outstandingBalance - totalPaying, 0)
                const excessToAdvance = Math.max(totalPaying - outstandingBalance, 0)
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Paying Now: <strong style={{ color: 'var(--text-primary)' }}>₹{totalPaying.toFixed(2)}</strong>
                    </span>
                    {outstandingBalance > 0 && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Balance After: <strong style={{ color: balanceAfter > 0 ? 'var(--warning)' : 'var(--success)' }}>₹{balanceAfter.toFixed(2)}</strong>
                      </span>
                    )}
                    {excessToAdvance > 0 && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--info)',
                        background: 'var(--info-bg)', border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: 'var(--radius-sm)', padding: '2px 10px'
                      }}>
                        <Wallet size={13} /> ₹{excessToAdvance.toFixed(2)} will be added to Advance Credit
                      </span>
                    )}
                  </div>
                )
              })()}

              <button
                className="btn btn-primary"
                onClick={handleApplyPayment}
                disabled={Number(payCash || 0) + Number(payUpi || 0) <= 0}
              >
                <CheckCircle size={16} /> Apply Payment
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', padding: '24px' }}>
            <EmptyState
              Icon={Users}
              title="Select a customer"
              description="Click a customer from the list to view their billing history and record payments."
            />
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
            <EmptyState
              Icon={Users}
              title="No deleted customers"
              description="Customers you delete will appear here and can be restored."
            />
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

                {form.type === 'regular' && !editMode && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Opening Credit Balance</h4>
                    
                    <div className="form-group">
                      <label className="form-label">Receiving Method</label>
                      <select
                        className="form-select"
                        value={form.openingBalanceMethod}
                        onChange={(e) => handleChange('openingBalanceMethod', e.target.value)}
                      >
                        <option value="cash">Cash Only</option>
                        <option value="upi">UPI Only</option>
                        <option value="split">Split (Cash + UPI)</option>
                      </select>
                    </div>

                    {(form.openingBalanceMethod === 'cash' || form.openingBalanceMethod === 'split') && (
                      <div className="form-group">
                        <label className="form-label">Cash Amount (₹)</label>
                        <input
                          className={`form-input${errors.openingCash ? ' form-input-error' : ''}`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={form.openingCash}
                          onChange={(e) => handleChange('openingCash', e.target.value)}
                        />
                        {errors.openingCash && (
                          <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} /> {errors.openingCash}
                          </div>
                        )}
                      </div>
                    )}

                    {(form.openingBalanceMethod === 'upi' || form.openingBalanceMethod === 'split') && (
                      <div className="form-group">
                        <label className="form-label">UPI Amount (₹)</label>
                        <input
                          className={`form-input${errors.openingUpi ? ' form-input-error' : ''}`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={form.openingUpi}
                          onChange={(e) => {
                            handleChange('openingUpi', e.target.value)
                            setUpiCheckoutAmount(0)
                            setQrGenerated(false)
                          }}
                        />
                        {errors.openingUpi && (
                          <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} /> {errors.openingUpi}
                          </div>
                        )}
                        
                        <div style={{ marginTop: '12px' }}>
                          <label className="form-label" style={{ fontSize: '0.78rem' }}>UPI Checkout</label>
                          <div className="form-inline" style={{ gap: '12px', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={!Number(form.openingUpi || 0)}
                              onClick={() => {
                                setUpiCheckoutAmount(Number(form.openingUpi || 0))
                                setQrGenerated(true)
                              }}
                              style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Link2 size={14} /> Generate QR
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={!Number(form.openingUpi || 0) || !business?.upiId}
                              onClick={() => copyUpiLink(getUpiLink(Number(form.openingUpi || 0), 'Opening Balance'))}
                              style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Copy size={14} /> Copy Link
                            </button>
                          </div>
                          {business?.upiId ? (
                            <>
                              {qrGenerated && upiCheckoutAmount > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '10px', background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                  <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(getUpiLink(upiCheckoutAmount, 'Opening Balance'))}`}
                                    alt="UPI QR Code"
                                    style={{ borderRadius: '8px', border: '3px solid var(--accent)', padding: '4px', background: '#fff' }}
                                    width={110} height={110}
                                  />
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scan with any UPI app to receive ₹{upiCheckoutAmount.toFixed(2)}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-muted" style={{ marginTop: '6px', fontSize: '0.78rem' }}>Set your UPI ID in Settings to enable QR codes.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const cashVal = Number(form.openingCash || 0)
                      const upiVal = Number(form.openingUpi || 0)
                      const totalVal = (form.openingBalanceMethod === 'cash' ? cashVal :
                                        form.openingBalanceMethod === 'upi' ? upiVal :
                                        (cashVal + upiVal))
                      if (totalVal > 0) {
                        return (
                          <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                              <span className="text-muted">Total Opening Balance:</span>
                              <span style={{ color: 'var(--accent)' }}>₹{totalVal.toFixed(2)}</span>
                            </div>
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                )}

                {form.type === 'regular' && editMode && (
                  <div className="form-group">
                    <label className="form-label">Credit Balance (₹)</label>
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

      {/* Loyalty Event History Modal */}
      {loyaltyCustomer && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
          }}
          onClick={() => setLoyaltyCustomer(null)}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '620px',
              maxHeight: '85vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
                  <Award size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Loyalty Points History</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {loyaltyCustomer.name} (<span style={{ fontFamily: 'monospace' }}>{loyaltyCustomer.id}</span>)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setLoyaltyCustomer(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {/* Current Balance Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: 'rgba(168, 85, 247, 0.08)', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audited Balance</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#c084fc' }}>{loyaltyBalance} Points</div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                onClick={() => handleOpenAdjustModal(loyaltyCustomer)}
              >
                <Gift size={14} color="#c084fc" />
                <span>Adjust Points</span>
              </button>
            </div>

            {/* History Table */}
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: '350px', border: '1px solid var(--border)', borderRadius: '8px' }}>
              {loadingLoyalty ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Loading loyalty events…
                </div>
              ) : loyaltyEvents.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No loyalty points events recorded yet for this customer.
                </div>
              ) : (
                <table className="table" style={{ margin: 0, fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Points</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loyaltyEvents.map((ev) => {
                      const isPositive = Number(ev.points) > 0
                      return (
                        <tr key={ev.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{new Date(ev.created_at || ev.date).toLocaleDateString()}</td>
                          <td>
                            <span
                              className={`badge ${
                                ev.event_type === 'earn'
                                  ? 'badge-success'
                                  : ev.event_type === 'redeem'
                                  ? 'badge-warning'
                                  : 'badge-info'
                              }`}
                              style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}
                            >
                              {ev.event_type ? ev.event_type.replace('_', ' ') : 'Event'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: isPositive ? '#10b981' : '#ef4444' }}>
                            {isPositive ? `+${ev.points}` : ev.points}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{ev.notes || '—'}</td>
                          <td>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--error)', padding: '2px 6px' }}
                              onClick={() => {
                                showConfirm(
                                  'Delete Loyalty Event',
                                  'Are you sure you want to delete this event? The customer balance will be recalculated automatically.',
                                  () => handleDeleteLoyaltyEvent(ev.id)
                                )
                              }}
                              title="Delete event and recalculate balance"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setLoyaltyCustomer(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Points Modal */}
      {adjustModalCustomer && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 100000,
          }}
          onClick={() => setAdjustModalCustomer(null)}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '420px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Adjust Loyalty Points</h3>
              <button
                onClick={() => setAdjustModalCustomer(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePointsAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Customer: <strong>{adjustModalCustomer.name}</strong> ({adjustModalCustomer.id})
                </span>
              </div>

              {/* Add vs Deduct Toggle */}
              <div>
                <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Adjustment Type</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${adjustOperation === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setAdjustOperation('add')}
                  >
                    <Plus size={14} /> Add Points (+)
                  </button>
                  <button
                    type="button"
                    className={`btn ${adjustOperation === 'deduct' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: adjustOperation === 'deduct' ? '#ef4444' : undefined }}
                    onClick={() => setAdjustOperation('deduct')}
                  >
                    <Minus size={14} /> Deduct Points (-)
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Points Amount</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-input"
                  placeholder="e.g. 50"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Goodwill bonus, correction, reward"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustModalCustomer(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={adjusting}>
                  {adjusting ? 'Saving…' : 'Save Adjustment'}
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

