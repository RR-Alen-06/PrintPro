import React, { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import EmptyState from '../components/common/EmptyState'
import {
  Wallet,
  Search,
  CheckCircle,
  AlertCircle,
  FileText,
  UserPlus,
  Copy,
  QrCode,
  Trash2
} from 'lucide-react'
import {
  getDisplayBillId,
  getDisplayCustomerId,
  getDisplayPaymentId,
  getDisplayAdvanceId
} from '../utils/idFormatter'

const PaymentReceived = () => {
  const {
    business,
    customers,
    bills,
    payments,
    advancePayments,
    recordPayment,
    recordSpecificBillPayment,
    addAdvancePayment,
    returnAdvancePayment,
    deletePayment,
    deleteAdvancePayment,
    addCustomer,
    showConfirm,
    showToast
  } = useAppContext()

  const location = useLocation()

  // Parse URL query parameters for deep linking
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const initialCustomerId = queryParams.get('customerId') || ''
  const initialBillId = queryParams.get('billId') || ''
  const initialTab = queryParams.get('tab') || 'settle'

  const [activeTab, setActiveTab] = useState(initialTab === 'advance' ? 'advance' : 'settle')
  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers])

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 1: SETTLE BILLS STATE
  // ───────────────────────────────────────────────────────────────────────────
  const [selectedCustId, setSelectedCustId] = useState(initialCustomerId)
  const [selectedBillId, setSelectedBillId] = useState(initialBillId || 'all')
  const [settleCash, setSettleCash] = useState('')
  const [settleUpi, setSettleUpi] = useState('')
  const [settleNotes, setSettleNotes] = useState('')
  const [settleSuccess, setSettleSuccess] = useState('')
  const [settleError, setSettleError] = useState('')

  // Sync state if URL query params change
  useEffect(() => {
    if (initialCustomerId) setSelectedCustId(initialCustomerId)
    if (initialBillId) setSelectedBillId(initialBillId)
    if (initialTab) setActiveTab(initialTab === 'advance' ? 'advance' : 'settle')
  }, [initialCustomerId, initialBillId, initialTab])

  const currentCustomer = useMemo(() => {
    return activeCustomers.find((c) => c.id === selectedCustId)
  }, [activeCustomers, selectedCustId])

  // All unpaid bills for this customer
  const customerUnpaidBills = useMemo(() => {
    if (!selectedCustId) return []
    return bills.filter((b) => b.customerId === selectedCustId && !b.deleted && b.status !== 'paid')
  }, [bills, selectedCustId])

  // Total outstanding for selected customer
  const customerOutstanding = useMemo(() => {
    return customerUnpaidBills.reduce((acc, b) => acc + (Number(b.balance) || 0), 0)
  }, [customerUnpaidBills])

  // Active target bill if specific bill is chosen
  const targetBill = useMemo(() => {
    if (!selectedBillId || selectedBillId === 'all') return null
    return customerUnpaidBills.find((b) => b.id === selectedBillId)
  }, [customerUnpaidBills, selectedBillId])

  const targetAmountDue = targetBill ? Number(targetBill.balance || 0) : customerOutstanding

  const fillFullAmount = (mode = 'cash') => {
    if (targetAmountDue <= 0) return
    if (mode === 'cash') {
      setSettleCash(targetAmountDue.toFixed(2))
      setSettleUpi('')
    } else {
      setSettleUpi(targetAmountDue.toFixed(2))
      setSettleCash('')
    }
  }

  const handleSettleSubmit = (e) => {
    e.preventDefault()
    setSettleError('')
    setSettleSuccess('')

    if (!selectedCustId) {
      setSettleError('Please select a customer to receive payment.')
      return
    }

    const cash = Number(settleCash || 0)
    const upi = Number(settleUpi || 0)
    const totalPaying = cash + upi

    if (totalPaying <= 0) {
      setSettleError('Please enter a valid payment amount (Cash or UPI).')
      return
    }

    try {
      if (selectedBillId && selectedBillId !== 'all') {
        // Specific Bill Payment
        recordSpecificBillPayment({
          billId: selectedBillId,
          customerId: selectedCustId,
          cashAmount: cash,
          upiAmount: upi,
          notes: settleNotes || `Direct settlement for ${getDisplayBillId(targetBill)}`
        })
        setSettleSuccess(`Recorded ₹${totalPaying.toFixed(2)} payment for ${getDisplayBillId(targetBill)}!`)
      } else {
        // FIFO distribution across unpaid bills
        recordPayment({
          customerId: selectedCustId,
          cashAmount: cash,
          upiAmount: upi,
          notes: settleNotes || 'Bill settlement',
          paymentMode: cash > 0 && upi > 0 ? 'split' : (cash > 0 ? 'cash' : 'upi')
        })
        setSettleSuccess(`Recorded ₹${totalPaying.toFixed(2)} payment distributed across customer bills!`)
      }

      setSettleCash('')
      setSettleUpi('')
      setSettleNotes('')
      setTimeout(() => setSettleSuccess(''), 5000)
    } catch (err) {
      console.error('Failed to record payment:', err)
      setSettleError('Failed to record payment. Please try again.')
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 2: ADVANCE DEPOSITS STATE
  // ───────────────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const [advActionType, setAdvActionType] = useState('receive') // 'receive' | 'return'
  const [advMode, setAdvMode] = useState('existing') // 'existing' | 'new'
  const [advCustId, setAdvCustId] = useState(initialCustomerId || '')
  // New customer inputs
  const [advNewName, setAdvNewName] = useState('')
  const [advNewPhone, setAdvNewPhone] = useState('')
  const advNewType = 'regular'
  // Payment fields
  const [advAmount, setAdvAmount] = useState('')
  const [advCashAmt, setAdvCashAmt] = useState('')
  const [advUpiAmt, setAdvUpiAmt] = useState('')
  const [advDate, setAdvDate] = useState(today)
  const [advNotes, setAdvNotes] = useState('')
  const [advError, setAdvError] = useState('')
  const [advSuccessRef, setAdvSuccessRef] = useState('')

  const selectedAdvCustomer = useMemo(
    () => activeCustomers.find((c) => c.id === advCustId),
    [activeCustomers, advCustId]
  )

  const handleAdvAmountChange = (val) => {
    setAdvAmount(val)
    setAdvCashAmt(val)
    setAdvUpiAmt('')
  }

  const handleAdvSubmit = (e) => {
    e.preventDefault()
    setAdvError('')
    setAdvSuccessRef('')

    let custIdToUse = advCustId
    if (advActionType === 'receive' && advMode === 'new') {
      if (!advNewName.trim()) {
        setAdvError('Please enter the customer name.')
        return
      }
      const newCust = {
        name: advNewName.trim(),
        phone: advNewPhone.trim(),
        type: advNewType,
      }
      custIdToUse = addCustomer(newCust)
    }

    if (!custIdToUse) {
      setAdvError('Please select or create a customer.')
      return
    }

    const totalAmt = Number(advAmount || 0)
    if (totalAmt <= 0) {
      setAdvError('Please enter a valid amount greater than ₹0.')
      return
    }

    const cashVal = Number(advCashAmt || 0)
    const upiVal = Number(advUpiAmt || 0)
    if (Math.abs(cashVal + upiVal - totalAmt) > 0.01) {
      setAdvError(`Cash (₹${cashVal}) + UPI (₹${upiVal}) must equal total ₹${totalAmt.toFixed(2)}.`)
      return
    }

    if (advActionType === 'receive') {
      addAdvancePayment({
        customerId: custIdToUse,
        amount: totalAmt,
        cashAmount: cashVal,
        upiAmount: upiVal,
        paymentMode: cashVal > 0 && upiVal > 0 ? 'split' : (cashVal > 0 ? 'cash' : 'upi'),
        date: advDate,
        notes: advNotes || 'Advance deposit'
      })
      setAdvSuccessRef(`ADV-${Date.now().toString().slice(-4)}`)
      showToast('Advance deposit recorded successfully!', 'success')
    } else {
      // Return advance
      const currentAdv = Number(selectedAdvCustomer?.advanceBalance || 0)
      if (totalAmt > currentAdv) {
        setAdvError(`Cannot return ₹${totalAmt.toFixed(2)} — customer only has ₹${currentAdv.toFixed(2)} advance balance.`)
        return
      }
      returnAdvancePayment({
        customerId: custIdToUse,
        amount: totalAmt,
        date: advDate,
        notes: advNotes || 'Advance return'
      })
      setAdvSuccessRef(`RET-${Date.now().toString().slice(-4)}`)
      showToast('Advance returned to customer!', 'success')
    }

    setAdvAmount('')
    setAdvCashAmt('')
    setAdvUpiAmt('')
    setAdvNotes('')
    setTimeout(() => setAdvSuccessRef(''), 5000)
  }

  // ── UPI Helpers ────────────────────────────────────────────────────────────
  const getUpiLink = (amt, noteText = 'Payment Received') => {
    if (!business?.upiId || amt <= 0) return ''
    const params = new URLSearchParams({
      pa: business.upiId,
      pn: business.shopName || 'PrintPro',
      am: amt.toFixed(2),
      cu: 'INR',
      tn: noteText,
    })
    return `upi://pay?${params.toString()}`
  }

  // Customers holding positive advance balances
  const advanceSummary = useMemo(() => {
    return activeCustomers.filter((c) => Number(c.advanceBalance || 0) > 0)
  }, [activeCustomers])

  // ───────────────────────────────────────────────────────────────────────────
  // AUDIT LEDGER: ALL RECENT PAYMENTS & ADVANCE DEPOSITS
  // ───────────────────────────────────────────────────────────────────────────
  const [auditSearch, setAuditSearch] = useState('')
  const [auditFilterType, setAuditFilterType] = useState('all') // 'all' | 'bills' | 'advances'

  const combinedAuditList = useMemo(() => {
    const list = []

    if (auditFilterType === 'all' || auditFilterType === 'bills') {
      payments.forEach((p) => {
        const cust = customers.find((c) => c.id === p.customerId)
        const bill = bills.find((b) => b.id === p.billId)
        list.push({
          type: 'bill_payment',
          id: p.id,
          displayId: getDisplayPaymentId(p),
          date: p.date,
          customerId: p.customerId,
          customerName: cust?.name || 'Walk-in',
          customerCode: cust ? getDisplayCustomerId(cust) : '',
          billId: p.billId,
          billCode: bill ? getDisplayBillId(bill) : (p.billId ? String(p.billId) : '-'),
          amount: Number(p.totalPaid || 0),
          cashAmount: Number(p.cashAmount || 0),
          upiAmount: Number(p.upiAmount || 0),
          notes: p.notes,
          rawItem: p
        })
      })
    }

    if (auditFilterType === 'all' || auditFilterType === 'advances') {
      advancePayments.forEach((a) => {
        const cust = customers.find((c) => c.id === a.customerId)
        list.push({
          type: a.type === 'return' ? 'advance_return' : 'advance_deposit',
          id: a.id,
          displayId: getDisplayAdvanceId(a),
          date: a.date || a.createdAt,
          customerId: a.customerId,
          customerName: cust?.name || 'Walk-in',
          customerCode: cust ? getDisplayCustomerId(cust) : '',
          billId: a.billId,
          billCode: a.billId ? String(a.billId) : '-',
          amount: Number(a.amount || 0),
          cashAmount: a.paymentMode === 'cash' ? Number(a.amount || 0) : 0,
          upiAmount: a.paymentMode === 'upi' ? Number(a.amount || 0) : 0,
          notes: a.notes,
          rawItem: a
        })
      })
    }

    return list
      .filter((item) => {
        if (!auditSearch) return true
        const q = auditSearch.toLowerCase()
        return (
          item.displayId.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.customerCode.toLowerCase().includes(q) ||
          item.billCode.toLowerCase().includes(q) ||
          (item.notes && item.notes.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [payments, advancePayments, customers, bills, auditFilterType, auditSearch])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={24} color="var(--accent)" /> Payment Received
          </h1>
          <p>Centralized hub to collect bill payments, specific bill settlements, and customer advance deposits.</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
        <button
          type="button"
          className={`tab ${activeTab === 'settle' ? 'active' : ''}`}
          onClick={() => setActiveTab('settle')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '8px 16px' }}
        >
          <FileText size={16} /> Settle Customer Bills
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'advance' ? 'active' : ''}`}
          onClick={() => setActiveTab('advance')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '8px 16px' }}
        >
          <Wallet size={16} /> Advance Deposits & Balance
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: SETTLE CUSTOMER BILLS                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'settle' && (
        <div className="grid-2" style={{ gap: '24px', alignItems: 'flex-start' }}>
          {/* Payment Collection Form Card */}
          <div className="card">
            <h2 style={{ marginBottom: '16px' }}>Receive Bill Payment</h2>

            {settleSuccess && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', marginBottom: '16px',
                background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem',
              }}>
                <CheckCircle size={16} /> {settleSuccess}
              </div>
            )}

            {settleError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', marginBottom: '16px',
                background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.875rem',
              }}>
                <AlertCircle size={16} /> {settleError}
              </div>
            )}

            <form onSubmit={handleSettleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Customer Selector */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Select Customer *</label>
                <select
                  className="form-select"
                  value={selectedCustId}
                  onChange={(e) => {
                    setSelectedCustId(e.target.value)
                    setSelectedBillId('all')
                    setSettleCash('')
                    setSettleUpi('')
                  }}
                >
                  <option value="">-- Choose Customer --</option>
                  <optgroup label="Regular Customers">
                    {activeCustomers
                      .filter((c) => c.type === 'regular')
                      .map((c) => {
                        const unpaid = bills.filter((b) => b.customerId === c.id && !b.deleted && b.status !== 'paid')
                        const bal = unpaid.reduce((s, b) => s + (Number(b.balance) || 0), 0)
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name} ({getDisplayCustomerId(c)}) {bal > 0 ? `· Due: ₹${bal.toFixed(2)}` : '· Settled'}
                          </option>
                        )
                      })}
                  </optgroup>
                  <optgroup label="Walk-in / Other Customers">
                    {activeCustomers
                      .filter((c) => c.type !== 'regular')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({getDisplayCustomerId(c)})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* Customer Financial Stats */}
              {currentCustomer && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '10px 14px', background: customerOutstanding > 0 ? 'var(--warning-bg)' : 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Total Outstanding</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: customerOutstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      ₹{customerOutstanding.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Advance Credit Available</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--info)' }}>
                      ₹{Number(currentCustomer.advanceBalance || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Target Bill Selection */}
              {selectedCustId && customerUnpaidBills.length > 0 && (
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Payment Allocation Target</label>
                  <select
                    className="form-select"
                    value={selectedBillId}
                    onChange={(e) => {
                      setSelectedBillId(e.target.value)
                      setSettleCash('')
                      setSettleUpi('')
                    }}
                  >
                    <option value="all">Settle Total Balance across Unpaid Bills (FIFO)</option>
                    <optgroup label="Pay Specific Unpaid Bill">
                      {customerUnpaidBills.map((b) => (
                        <option key={b.id} value={b.id}>
                          {getDisplayBillId(b)} · Due: ₹{Number(b.balance).toFixed(2)} (Total: ₹{Number(b.total).toFixed(2)}, {b.date})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Quick Fill Balance Buttons */}
              {targetAmountDue > 0 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Quick Fill:</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fillFullAmount('cash')}
                  >
                    Full Cash (₹{targetAmountDue.toFixed(2)})
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fillFullAmount('upi')}
                  >
                    Full UPI (₹{targetAmountDue.toFixed(2)})
                  </button>
                </div>
              )}

              {/* Payment Split Inputs (Cash & UPI) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Cash Amount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    value={settleCash}
                    onChange={(e) => setSettleCash(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">UPI Amount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    value={settleUpi}
                    onChange={(e) => setSettleUpi(e.target.value)}
                  />
                </div>
              </div>

              {/* Live UPI QR Code Generator */}
              {Number(settleUpi) > 0 && business?.upiId && (
                <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <QrCode size={18} color="var(--info)" />
                      <strong style={{ fontSize: '0.85rem' }}>Scan to Pay ₹{Number(settleUpi).toFixed(2)} via UPI</strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const link = getUpiLink(Number(settleUpi), `Bill payment for ${currentCustomer?.name || 'Customer'}`)
                        if (link) {
                          navigator.clipboard.writeText(link)
                          showToast('UPI payment link copied to clipboard', 'info')
                        }
                      }}
                      title="Copy UPI link"
                    >
                      <Copy size={13} /> Copy Link
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '12px', background: '#ffffff', borderRadius: 'var(--radius-sm)' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getUpiLink(Number(settleUpi), `Payment from ${currentCustomer?.name || 'Customer'}`))}`}
                      alt="UPI QR Code"
                      style={{ width: '150px', height: '150px', display: 'block' }}
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Payment Notes (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Paid in shop, GooglePay transaction reference"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '10px', fontWeight: 600 }}
                disabled={!selectedCustId || (Number(settleCash || 0) + Number(settleUpi || 0) <= 0)}
              >
                Confirm & Record Payment (₹{(Number(settleCash || 0) + Number(settleUpi || 0)).toFixed(2)})
              </button>
            </form>
          </div>

          {/* Customer's Unpaid Bills Side List */}
          <div className="card">
            <h2 style={{ marginBottom: '12px' }}>
              Unpaid Bills {currentCustomer ? `(${customerUnpaidBills.length})` : ''}
            </h2>

            {!selectedCustId ? (
              <EmptyState
                icon={Search}
                title="No customer selected"
                description="Select a customer on the left to inspect their unpaid bills."
              />
            ) : customerUnpaidBills.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="All bills settled!"
                description={`${currentCustomer.name} has zero outstanding balance.`}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {customerUnpaidBills.map((bill) => {
                  const isSelected = selectedBillId === bill.id
                  return (
                    <div
                      key={bill.id}
                      onClick={() => {
                        setSelectedBillId(bill.id)
                        setSettleCash(Number(bill.balance).toFixed(2))
                        setSettleUpi('')
                      }}
                      style={{
                        padding: '12px',
                        background: isSelected ? 'var(--accent-light)' : 'var(--bg-elevated)',
                        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        transition: 'var(--transition)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontFamily: 'monospace' }}>{getDisplayBillId(bill)}</strong>
                          <span className={`badge ${bill.status === 'partial' ? 'badge-warning' : 'badge-error'}`} style={{ fontSize: '0.65rem' }}>
                            {bill.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Date: {bill.date} · Total: ₹{Number(bill.total).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--warning)' }}>
                          ₹{Number(bill.balance).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          Click to pay
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: ADVANCE DEPOSITS & BALANCES                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'advance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Customers with Advance Balance Summary chips */}
          {advanceSummary.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Customers with Advance Credit</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {advanceSummary.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setAdvCustId(c.id)}
                    style={{
                      padding: '8px 14px',
                      background: 'var(--info-bg)',
                      border: '1px solid rgba(59,130,246,0.25)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                    title="Click to select customer"
                  >
                    <Wallet size={14} color="var(--info)" />
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--info)' }}>₹{Number(c.advanceBalance).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid-2" style={{ gap: '24px', alignItems: 'flex-start' }}>
            {/* Advance Deposit / Return Form */}
            <div className="card">
              <h2 style={{ marginBottom: '16px' }}>
                {advActionType === 'receive' ? 'Receive Advance Deposit' : 'Return Advance Deposit'}
              </h2>

              {/* Sub-tabs: Receive vs Return */}
              <div className="tabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className={`tab ${advActionType === 'receive' ? 'active' : ''}`}
                  onClick={() => {
                    setAdvActionType('receive')
                    setAdvError('')
                  }}
                  style={{ flex: 1, padding: '8px', textAlign: 'center' }}
                >
                  Receive Advance
                </button>
                <button
                  type="button"
                  className={`tab ${advActionType === 'return' ? 'active' : ''}`}
                  onClick={() => {
                    setAdvActionType('return')
                    setAdvMode('existing')
                    setAdvError('')
                  }}
                  style={{ flex: 1, padding: '8px', textAlign: 'center' }}
                >
                  Return Advance
                </button>
              </div>

              {advSuccessRef && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', marginBottom: '16px',
                  background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem',
                }}>
                  <CheckCircle size={16} /> Advance recorded! Reference: <strong style={{ fontFamily: 'monospace' }}>{advSuccessRef}</strong>
                </div>
              )}

              {advError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', marginBottom: '16px',
                  background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.875rem',
                }}>
                  <AlertCircle size={16} /> {advError}
                </div>
              )}

              <form onSubmit={handleAdvSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Customer toggle */}
                {advActionType === 'receive' && (
                  <div className="radio-group">
                    <label className={`radio-option ${advMode === 'existing' ? 'selected' : ''}`}>
                      <input type="radio" checked={advMode === 'existing'} onChange={() => setAdvMode('existing')} />
                      Existing Customer
                    </label>
                    <label className={`radio-option ${advMode === 'new' ? 'selected' : ''}`}>
                      <input type="radio" checked={advMode === 'new'} onChange={() => setAdvMode('new')} />
                      <UserPlus size={14} /> New Customer
                    </label>
                  </div>
                )}

                {advActionType === 'return' || advMode === 'existing' ? (
                  <div className="form-group">
                    <label className="form-label">Customer *</label>
                    <select
                      className="form-select"
                      value={advCustId}
                      onChange={(e) => setAdvCustId(e.target.value)}
                    >
                      <option value="">-- Select Customer --</option>
                      {activeCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({getDisplayCustomerId(c)}) · Advance: ₹{Number(c.advanceBalance || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Customer name *"
                      value={advNewName}
                      onChange={(e) => setAdvNewName(e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="tel"
                      placeholder="Phone number (optional)"
                      value={advNewPhone}
                      onChange={(e) => setAdvNewPhone(e.target.value)}
                    />
                  </div>
                )}

                {/* Amount */}
                <div className="form-group">
                  <label className="form-label">Advance Amount (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    value={advAmount}
                    onChange={(e) => handleAdvAmountChange(e.target.value)}
                  />
                </div>

                {/* Split Cash vs UPI for receive */}
                {advActionType === 'receive' && Number(advAmount || 0) > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Cash (₹)</label>
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        value={advCashAmt}
                        onChange={(e) => setAdvCashAmt(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">UPI (₹)</label>
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        value={advUpiAmt}
                        onChange={(e) => setAdvUpiAmt(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Date & Notes */}
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. advance for brochure printing"
                    value={advNotes}
                    onChange={(e) => setAdvNotes(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ padding: '10px' }}>
                  {advActionType === 'receive' ? 'Save Advance Deposit' : 'Process Advance Return'}
                </button>
              </form>
            </div>

            {/* Advance Guidelines Card */}
            <div className="card">
              <h2 style={{ marginBottom: '12px' }}>How Advance Payments Work</h2>
              <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', paddingLeft: '20px' }}>
                <li>When a customer leaves an advance deposit, their <strong>Advance Balance</strong> increases immediately.</li>
                <li>When creating bills on the <strong>Billing page</strong>, PrintPro automatically detects available advance credit and applies it to settle the bill.</li>
                <li>If a customer overpays on a bill (e.g. ₹5 paid for a ₹3 bill), the ₹2 change can be directly credited to their advance balance with one click.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* AUDIT TABLE: RECENT PAYMENTS & VOUCHERS LEDGER                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0 }}>Recent Payment Transactions</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chronological record of collected payments and advance deposits.</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="search"
              className="form-input form-input-sm"
              placeholder="Search by ID, customer..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              style={{ width: '200px' }}
            />
            <select
              className="form-select form-select-sm"
              value={auditFilterType}
              onChange={(e) => setAuditFilterType(e.target.value)}
            >
              <option value="all">All Transactions</option>
              <option value="bills">Bill Payments Only</option>
              <option value="advances">Advance Deposits Only</option>
            </select>
          </div>
        </div>

        {combinedAuditList.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No payment records found"
            description="Recorded bill settlements and advance payments will appear here."
          />
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Bill Ref</th>
                  <th>Cash</th>
                  <th>UPI</th>
                  <th>Total Paid</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {combinedAuditList.slice(0, 25).map((row) => (
                  <tr key={`${row.type}-${row.id}`}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.displayId}</td>
                    <td style={{ fontSize: '0.82rem' }}>{row.date ? String(row.date).slice(0, 10) : '-'}</td>
                    <td>
                      <div><strong>{row.customerName}</strong></div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.customerCode}</div>
                    </td>
                    <td>
                      <span className={`badge ${
                        row.type === 'bill_payment' ? 'badge-success' :
                        row.type === 'advance_deposit' ? 'badge-info' : 'badge-warning'
                      }`} style={{ fontSize: '0.68rem' }}>
                        {row.type === 'bill_payment' ? 'Bill Payment' :
                         row.type === 'advance_deposit' ? 'Advance Deposit' : 'Advance Return'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{row.billCode}</td>
                    <td style={{ fontSize: '0.82rem' }}>₹{row.cashAmount.toFixed(2)}</td>
                    <td style={{ fontSize: '0.82rem' }}>₹{row.upiAmount.toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>₹{row.amount.toFixed(2)}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.notes || '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--error)' }}
                        onClick={() => {
                          showConfirm(
                            'Void Payment Record',
                            `Are you sure you want to void and delete ${row.displayId}? This will restore the bill balance.`,
                            () => {
                              if (row.type === 'bill_payment') {
                                deletePayment(row.id)
                              } else {
                                deleteAdvancePayment(row.id)
                              }
                              showToast(`Deleted ${row.displayId}`, 'info')
                            }
                          )
                        }}
                        title="Delete payment"
                      >
                        <Trash2 size={13} />
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

export default PaymentReceived
