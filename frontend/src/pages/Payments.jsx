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
  Banknote,
  Smartphone,
  Trash2,
  RotateCcw,
  X,
  Calendar,
  Clock
} from 'lucide-react'
import {
  getDisplayBillId,
  getDisplayCustomerId,
  getDisplayPaymentId,
  getDisplayAdvanceId
} from '../utils/idFormatter'

const Payments = () => {
  const {
    customers,
    bills,
    payments,
    advancePayments,
    recordPayment,
    recordSpecificBillPayment,
    addAdvancePayment,
    deletePayment,
    reversePayment,
    deleteAdvancePayment,
    showConfirm,
    showToast
  } = useAppContext()

  const location = useLocation()
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const initialCustomerId = queryParams.get('customerId') || ''
  const initialBillId = queryParams.get('billId') || ''
  const initialTab = queryParams.get('tab') || 'settle'

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers])

  // Customer & Mode Selection
  const [selectedCustId, setSelectedCustId] = useState(initialCustomerId)
  const [activeTab, setActiveTab] = useState(initialTab === 'advance' || initialTab === 'deposit' ? 'deposit' : 'settle')

  // ── Settle Bills State ──
    // ── Payment Reversal State ──
  const [reversalModalItem, setReversalModalItem] = useState(null)
  const [reversalType, setReversalType] = useState('full') // 'full' | 'partial'
  const [reversalAmountInput, setReversalAmountInput] = useState('')
  const [reversalReasonPreset, setReversalReasonPreset] = useState('Incorrect Cash payment entry')
  const [reversalReason, setReversalReason] = useState('Incorrect Cash payment entry')
  const [reversalAuthorizedBy, setReversalAuthorizedBy] = useState('Admin')
  const [isSubmittingReversal, setIsSubmittingReversal] = useState(false)

  const getRemainingReversible = (item) => {
    if (!item) return 0
    const rawPayment = payments.find(p => p.id === item.rawId)
    const total = Math.abs(Number(item.totalAmount || (rawPayment && rawPayment.totalPaid) || 0))
    const reversed = Number((rawPayment && rawPayment.reversedAmount) || item.reversedAmount || 0)
    return Math.max(0, parseFloat((total - reversed).toFixed(2)))
  }

  const openReversalModal = (item) => {
    setReversalModalItem(item)
    setReversalType('full')
    setReversalAmountInput('')
    setReversalReasonPreset('Incorrect Cash payment entry')
    setReversalReason('Incorrect Cash payment entry')
    setReversalAuthorizedBy('Admin')
  }

  const handleConfirmReversal = async () => {
    if (!reversalModalItem) return
    const reasonText = (reversalReasonPreset === 'other' ? reversalReason : (reversalReason || reversalReasonPreset)).trim()
    if (!reasonText) {
      showToast('A reason for reversal is mandatory.', 'error')
      return
    }
    const remaining = getRemainingReversible(reversalModalItem)
    let amountToRev = remaining
    if (reversalType === 'partial') {
      amountToRev = parseFloat(reversalAmountInput)
      if (isNaN(amountToRev) || amountToRev <= 0) {
        showToast('Please enter a valid reversal amount greater than zero.', 'error')
        return
      }
      if (amountToRev > remaining) {
        showToast(`Reversal amount cannot exceed remaining valid payment (₹${remaining.toFixed(2)}).`, 'error')
        return
      }
    }

    setIsSubmittingReversal(true)
    try {
      await reversePayment({
        paymentId: reversalModalItem.rawId,
        amount: amountToRev,
        reason: reasonText,
        authorizedBy: reversalAuthorizedBy || 'Admin'
      })
      showToast(`Payment successfully reversed (₹${amountToRev.toFixed(2)}).`, 'success')
      setReversalModalItem(null)
    } catch (err) {
      showToast('Failed to reverse payment: ' + err.message, 'error')
    } finally {
      setIsSubmittingReversal(false)
    }
  }

  const [selectedBillId, setSelectedBillId] = useState(initialBillId || 'all')
  const [settleCash, setSettleCash] = useState('')
  const [settleUpi, setSettleUpi] = useState('')
  const [useAdvance, setUseAdvance] = useState(false)
  const [advanceToUse, setAdvanceToUse] = useState('')
  const [settleNotes, setSettleNotes] = useState('')
  const [settleSuccess, setSettleSuccess] = useState('')
  const [settleError, setSettleError] = useState('')
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false)

  // ── Advance Deposit State ──
  const today = new Date().toISOString().slice(0, 10)
  const [advTotalAmount, setAdvTotalAmount] = useState('')
  const [advCashAmount, setAdvCashAmount] = useState('')
  const [advUpiAmount, setAdvUpiAmount] = useState('')
  const [advDate, setAdvDate] = useState(today)
  const [advNotes, setAdvNotes] = useState('')
  const [advSuccess, setAdvSuccess] = useState('')
  const [advError, setAdvError] = useState('')

  // ── Payment History Filters ──
  const [historySearch, setHistorySearch] = useState('')
  const [historyFilterType, setHistoryFilterType] = useState('all') // 'all' | 'bills' | 'advances'
  const [historyPeriod, setHistoryPeriod] = useState('all') // 'all' | 'today' | 'week' | 'month'

  // Deep linking sync
  useEffect(() => {
    if (initialCustomerId) setSelectedCustId(initialCustomerId)
    if (initialBillId) setSelectedBillId(initialBillId)
    if (initialTab) setActiveTab(initialTab === 'advance' || initialTab === 'deposit' ? 'deposit' : 'settle')
  }, [initialCustomerId, initialBillId, initialTab])

  // Current customer object
  const currentCustomer = useMemo(() => {
    return activeCustomers.find((c) => c.id === selectedCustId)
  }, [activeCustomers, selectedCustId])

  // Pending unpaid bills for selected customer
  const customerUnpaidBills = useMemo(() => {
    if (!selectedCustId) return []
    return bills.filter((b) => b.customerId === selectedCustId && !b.deleted && b.status !== 'paid')
  }, [bills, selectedCustId])

  // Total outstanding due across all pending bills
  const customerOutstanding = useMemo(() => {
    return customerUnpaidBills.reduce((acc, b) => acc + (Number(b.balance) || 0), 0)
  }, [customerUnpaidBills])

  // Available customer advance / credit balance
  const customerAdvanceAvailable = useMemo(() => {
    if (!currentCustomer) return 0
    return Math.max(0, Number(currentCustomer.creditBalance || currentCustomer.advanceBalance || 0))
  }, [currentCustomer])

  // Target bill if specific bill chosen
  const targetBill = useMemo(() => {
    if (!selectedBillId || selectedBillId === 'all') return null
    return customerUnpaidBills.find((b) => b.id === selectedBillId)
  }, [customerUnpaidBills, selectedBillId])

  const targetAmountDue = targetBill ? Number(targetBill.balance || 0) : customerOutstanding

  // Auto-set advance to use when toggle changes
  useEffect(() => {
    if (useAdvance && customerAdvanceAvailable > 0) {
      const needed = Math.min(customerAdvanceAvailable, targetAmountDue)
      setAdvanceToUse(needed > 0 ? needed.toFixed(2) : '')
    } else {
      setAdvanceToUse('')
    }
  }, [useAdvance, customerAdvanceAvailable, targetAmountDue])

  // Quick fill settlement amounts
  const fillFullAmount = (mode = 'cash') => {
    const advVal = Number(advanceToUse || 0)
    const neededDirect = Math.max(0, targetAmountDue - advVal)
    if (mode === 'cash') {
      setSettleCash(neededDirect > 0 ? neededDirect.toFixed(2) : '')
      setSettleUpi('')
    } else if (mode === 'upi') {
      setSettleUpi(neededDirect > 0 ? neededDirect.toFixed(2) : '')
      setSettleCash('')
    } else if (mode === 'split') {
      const half = Number((neededDirect / 2).toFixed(2))
      setSettleCash(half > 0 ? half.toFixed(2) : '')
      setSettleUpi(half > 0 ? (neededDirect - half).toFixed(2) : '')
    }
  }

  // Live settlement calculations
  const parsedCash = Number(settleCash || 0)
  const parsedUpi = Number(settleUpi || 0)
  const parsedAdvUsed = useAdvance ? Math.min(Number(advanceToUse || 0), customerAdvanceAvailable) : 0
  const totalDirectPaying = parsedCash + parsedUpi
  const totalSettlementApplying = totalDirectPaying + parsedAdvUsed
  const remainingDueAfterPayment = Math.max(0, targetAmountDue - totalSettlementApplying)
  const excessOverpayment = Math.max(0, totalDirectPaying - Math.max(0, targetAmountDue - parsedAdvUsed))

  // ── Handle Settle Bill Submit ──
  const handleSettleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmittingSettle) return
    setSettleError('')
    setSettleSuccess('')

    if (!selectedCustId) {
      setSettleError('Please select a customer to receive payment.')
      return
    }

    if (customerUnpaidBills.length === 0) {
      setSettleError('This customer has no unpaid bills with outstanding balances.')
      return
    }

    if (totalSettlementApplying <= 0) {
      setSettleError('Please enter a payment amount (Cash, UPI, or use available Advance).')
      return
    }

    const maxDirectAllowed = Math.max(0, targetAmountDue - parsedAdvUsed)
    if (totalDirectPaying > maxDirectAllowed) {
      setSettleError(`Payment amount (₹${totalDirectPaying.toFixed(2)}) exceeds outstanding due (₹${maxDirectAllowed.toFixed(2)}). Ordinary bill payments cannot create an advance balance. To deposit advance credit, please use the Record Advance tab.`)
      return
    }

    setIsSubmittingSettle(true)
    try {
      if (selectedBillId && selectedBillId !== 'all') {
        // Specific Bill Settlement
        recordSpecificBillPayment({
          billId: selectedBillId,
          customerId: selectedCustId,
          cashAmount: parsedCash,
          upiAmount: parsedUpi,
          advanceUsed: parsedAdvUsed,
          notes: settleNotes || `Direct settlement for ${getDisplayBillId(targetBill)}`
        })
        setSettleSuccess(`Recorded payment for ${getDisplayBillId(targetBill)} successfully!`)
      } else {
        // All Pending Bills (Auto-FIFO)
        recordPayment({
          customerId: selectedCustId,
          cashAmount: parsedCash,
          upiAmount: parsedUpi,
          advanceUsed: parsedAdvUsed,
          notes: settleNotes || 'FIFO bill settlement'
        })
        setSettleSuccess(`Payment successfully distributed across customer bills!`)
      }

      setSettleCash('')
      setSettleUpi('')
      setAdvanceToUse('')
      setUseAdvance(false)
      setSettleNotes('')
      showToast('Payment recorded successfully!', 'success')
      setTimeout(() => setSettleSuccess(''), 6000)
    } catch (err) {
      console.error('Failed to record settlement:', err)
      setSettleError('Failed to record payment. Please try again.')
    } finally {
      setIsSubmittingSettle(false)
    }
  }

  // ── Handle Advance Deposit Submit ──
  const handleAdvAmountChange = (val) => {
    setAdvTotalAmount(val)
    setAdvCashAmount(val)
    setAdvUpiAmount('')
  }

  const handleAdvSubmit = (e) => {
    e.preventDefault()
    setAdvError('')
    setAdvSuccess('')

    if (!selectedCustId) {
      setAdvError('Please select a customer for the advance deposit.')
      return
    }

    const totalAmt = Number(advTotalAmount || 0)
    if (totalAmt <= 0) {
      setAdvError('Please enter a valid deposit amount greater than ₹0.')
      return
    }

    const cashVal = Number(advCashAmount || 0)
    const upiVal = Number(advUpiAmount || 0)
    if (Math.abs(cashVal + upiVal - totalAmt) > 0.01) {
      setAdvError(`Cash (₹${cashVal.toFixed(2)}) + UPI (₹${upiVal.toFixed(2)}) must equal total deposit ₹${totalAmt.toFixed(2)}.`)
      return
    }

    try {
      addAdvancePayment({
        customerId: selectedCustId,
        amount: totalAmt,
        cashAmount: cashVal,
        upiAmount: upiVal,
        paymentMode: cashVal > 0 && upiVal > 0 ? 'split' : (cashVal > 0 ? 'cash' : 'upi'),
        date: advDate,
        notes: advNotes || 'Customer advance deposit'
      })

      setAdvSuccess(`Successfully recorded advance deposit of ₹${totalAmt.toFixed(2)} for ${currentCustomer?.name}!`)
      setAdvTotalAmount('')
      setAdvCashAmount('')
      setAdvUpiAmount('')
      setAdvNotes('')
      showToast('Advance deposit recorded!', 'success')
      setTimeout(() => setAdvSuccess(''), 6000)
    } catch (err) {
      console.error('Failed to record advance deposit:', err)
      setAdvError('Failed to record advance deposit. Please try again.')
    }
  }

  // ── Combined Chronological Payment History ──
  const combinedHistory = useMemo(() => {
    const list = []

    // 1. Bill Payments
    if (historyFilterType === 'all' || historyFilterType === 'bills') {
      payments.forEach((p) => {
        const cust = customers.find((c) => c.id === p.customerId)
        const bill = bills.find((b) => b.id === p.billId)
        const totalPaid = Number(p.totalPaid || 0)
        const isRef = p.isRefund || p.paymentType === 'refund' || totalPaid < 0
        const excess = Number(p.excessCredit || 0)

        list.push({
          key: `pay-${p.id}`,
          rawId: p.id,
          displayId: getDisplayPaymentId(p),
          date: p.date,
          customerId: p.customerId,
          customerName: cust?.name || 'Walk-in',
          customerCode: cust ? getDisplayCustomerId(cust) : '',
          purpose: isRef ? 'Refund' : 'Bill Settlement',
          billId: p.billId,
          billDisplay: bill ? getDisplayBillId(bill) : (p.billId ? String(p.billId) : '—'),
          cashAmount: Number(p.cashAmount || 0),
          upiAmount: Number(p.upiAmount || 0),
          totalAmount: totalPaid,
          advanceImpact: excess > 0 ? `+₹${excess.toFixed(2)} Created` : '—',
          status: isRef ? 'Refund' : (p.paymentType === 'full' ? 'Full' : 'Partial'),
          type: 'bill_payment',
          isRefund: isRef,
          notes: p.notes,
          rawItem: p
        })
      })
    }

    // 2. Advance Deposits & Returns
    if (historyFilterType === 'all' || historyFilterType === 'advances') {
      (advancePayments || []).forEach((a) => {
        const cust = customers.find((c) => c.id === a.customerId)
        const amt = Number(a.amount || 0)
        const isRet = a.type === 'return' || a.type === 'refund' || amt < 0
        const bill = a.billId ? bills.find((b) => b.id === a.billId) : null

        list.push({
          key: `adv-${a.id}`,
          rawId: a.id,
          displayId: getDisplayAdvanceId(a),
          date: a.date || a.createdAt,
          customerId: a.customerId,
          customerName: cust?.name || 'Walk-in',
          customerCode: cust ? getDisplayCustomerId(cust) : '',
          purpose: isRet ? 'Advance Return' : (a.isExcessCredit ? 'Overpayment Credit' : 'Advance Deposit'),
          billId: a.billId,
          billDisplay: bill ? getDisplayBillId(bill) : (a.billId ? String(a.billId) : '—'),
          cashAmount: a.paymentMode === 'cash' || !a.paymentMode ? Math.abs(amt) : Number(a.cashAmount || 0),
          upiAmount: a.paymentMode === 'upi' ? Math.abs(amt) : Number(a.upiAmount || 0),
          totalAmount: Math.abs(amt),
          advanceImpact: isRet ? `-₹${Math.abs(amt).toFixed(2)} Returned` : `+₹${Math.abs(amt).toFixed(2)} Deposited`,
          status: isRet ? 'Return' : 'Deposit',
          type: 'advance',
          isRefund: isRet,
          notes: a.notes,
          rawItem: a
        })
      })
    }

    // Filter by period
    const now = new Date()
    const getStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
    let filtered = list

    if (historyPeriod === 'today') {
      const todayStart = getStartOfDay(now)
      filtered = filtered.filter((i) => new Date(i.date) >= todayStart)
    } else if (historyPeriod === 'week') {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - 7)
      filtered = filtered.filter((i) => new Date(i.date) >= weekStart)
    } else if (historyPeriod === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      filtered = filtered.filter((i) => new Date(i.date) >= monthStart)
    }

    // Search filter
    if (historySearch) {
      const q = historySearch.toLowerCase()
      filtered = filtered.filter((i) =>
        i.displayId.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        i.customerCode.toLowerCase().includes(q) ||
        i.billDisplay.toLowerCase().includes(q) ||
        (i.notes && i.notes.toLowerCase().includes(q))
      )
    }

    return filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [payments, advancePayments, customers, bills, historyFilterType, historyPeriod, historySearch])

  // Delete transaction handler
  const handleDeleteTxn = (item) => {
    showConfirm({
      title: 'Delete Payment Transaction?',
      message: `Are you sure you want to delete transaction ${item.displayId} (${item.customerName} · ₹${item.totalAmount.toFixed(2)})? Associated balances will be reversed safely.`,
      confirmText: 'Delete Transaction',
      danger: true,
      onConfirm: async () => {
        try {
          if (item.type === 'bill_payment') {
            await deletePayment(item.rawId)
          } else {
            await deleteAdvancePayment(item.rawId)
          }
          showToast('Transaction deleted and balances updated.', 'success')
        } catch (err) {
          showToast('Failed to delete transaction: ' + err.message, 'error')
        }
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Page Header ── */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wallet size={26} color="var(--accent)" /> Payments & Settlements
          </h1>
          <p>Unified hub for collecting bill settlements, managing customer advance deposits, and tracking payment history.</p>
        </div>
      </div>

      {/* ── Customer Selection & Financial 360 Header ── */}
      <div className="card" style={{ padding: '20px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          {/* Customer Picker */}
          <div style={{ flex: 1, minWidth: '280px', maxWidth: '480px' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>
              Select Customer *
            </label>
            <select
              className="form-select font-medium"
              value={selectedCustId}
              onChange={(e) => {
                setSelectedCustId(e.target.value)
                setSelectedBillId('all')
                setSettleCash('')
                setSettleUpi('')
                setUseAdvance(false)
                setAdvanceToUse('')
                setSettleSuccess('')
                setSettleError('')
                setAdvSuccess('')
                setAdvError('')
              }}
              style={{ padding: '10px 14px', fontSize: '0.95rem' }}
            >
              <option value="">-- Choose Customer --</option>
              {activeCustomers.map((c) => {
                const unpaid = bills.filter((b) => b.customerId === c.id && !b.deleted && b.status !== 'paid')
                const bal = unpaid.reduce((s, b) => s + (Number(b.balance) || 0), 0)
                const adv = Number(c.creditBalance || c.advanceBalance || 0)
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({getDisplayCustomerId(c)}) {bal > 0 ? `· Due: ₹${bal.toFixed(2)}` : '· Due: ₹0.00'}{adv > 0 ? ` | Adv: ₹${adv.toFixed(2)}` : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Quick Metrics Cards */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Outstanding Balance */}
            <div style={{
              padding: '12px 18px',
              background: customerOutstanding > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
              border: `1px solid ${customerOutstanding > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
              borderRadius: 'var(--radius-md)',
              minWidth: '150px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Outstanding Dues
              </span>
              <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: customerOutstanding > 0 ? 'var(--error)' : 'var(--success)', marginTop: '2px' }}>
                ₹{customerOutstanding.toFixed(2)}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {customerUnpaidBills.length} unpaid bill{customerUnpaidBills.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Advance Balance */}
            <div style={{
              padding: '12px 18px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              minWidth: '150px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Advance Balance
              </span>
              <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
                ₹{customerAdvanceAvailable.toFixed(2)}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Funds held for customer
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Operations Card ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Operation Tabs Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          padding: '4px 8px 0 8px'
        }}>
          <button
            type="button"
            className={`tab ${activeTab === 'settle' ? 'active' : ''}`}
            onClick={() => setActiveTab('settle')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontWeight: 600, fontSize: '0.95rem', padding: '12px 20px',
              borderBottom: activeTab === 'settle' ? '2px solid var(--accent)' : 'none',
              background: 'transparent', color: activeTab === 'settle' ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <FileText size={18} /> Settle Customer Bills
            {customerUnpaidBills.length > 0 && (
              <span className="badge badge-warning" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                {customerUnpaidBills.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'deposit' ? 'active' : ''}`}
            onClick={() => setActiveTab('deposit')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontWeight: 600, fontSize: '0.95rem', padding: '12px 20px',
              borderBottom: activeTab === 'deposit' ? '2px solid var(--accent)' : 'none',
              background: 'transparent', color: activeTab === 'deposit' ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <Wallet size={18} /> Deposit Customer Advance
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* ───────────────────────────────────────────────────────────── */}
          {/* OPERATION 1: SETTLE CUSTOMER BILLS                            */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'settle' && (
            <div>
              {settleSuccess && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', marginBottom: '20px',
                  background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.9rem',
                }}>
                  <CheckCircle size={18} /> {settleSuccess}
                </div>
              )}

              {settleError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', marginBottom: '20px',
                  background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.9rem',
                }}>
                  <AlertCircle size={18} /> {settleError}
                </div>
              )}

              {!selectedCustId ? (
                <EmptyState
                  Icon={Wallet}
                  title="Select a customer above"
                  description="Choose any registered or walk-in customer from the selector above to view and settle pending bills."
                />
              ) : customerUnpaidBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: 'rgba(16,185,129,0.12)', color: 'var(--success)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto'
                  }}>
                    <CheckCircle size={32} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>All Bills Settled!</h3>
                  <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '8px auto 20px auto', fontSize: '0.9rem' }}>
                    {currentCustomer?.name} has ₹0.00 outstanding dues. You can deposit advance funds or issue new invoices.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('deposit')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Wallet size={16} /> Deposit Advance Funds
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSettleSubmit}>
                  {/* Bill Selection Grid */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
                        Select Settlement Scope:
                      </label>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {customerUnpaidBills.length} pending bill{customerUnpaidBills.length === 1 ? '' : 's'} totaling ₹{customerOutstanding.toFixed(2)}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '12px' }}>
                      {/* All Bills Option */}
                      <div
                        onClick={() => setSelectedBillId('all')}
                        style={{
                          padding: '14px 16px',
                          border: `2px solid ${selectedBillId === 'all' ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)',
                          background: selectedBillId === 'all' ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="radio"
                          name="billTarget"
                          checked={selectedBillId === 'all'}
                          onChange={() => setSelectedBillId('all')}
                          style={{ cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>All Pending Bills (Auto-FIFO)</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Distributes payment to oldest bills first
                          </div>
                        </div>
                        <div className="font-mono" style={{ fontWeight: 700, color: 'var(--error)' }}>
                          ₹{customerOutstanding.toFixed(2)}
                        </div>
                      </div>

                      {/* Individual Bills */}
                      {customerUnpaidBills.map((b) => {
                        const isSelected = selectedBillId === b.id
                        return (
                          <div
                            key={b.id}
                            onClick={() => setSelectedBillId(b.id)}
                            style={{
                              padding: '14px 16px',
                              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                              borderRadius: 'var(--radius-md)',
                              background: isSelected ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <input
                              type="radio"
                              name="billTarget"
                              checked={isSelected}
                              onChange={() => setSelectedBillId(b.id)}
                              style={{ cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{getDisplayBillId(b)}</span>
                                {b.splitPurchaseId && (
                                  <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600 }}>
                                    Split {b.splitPurchaseId}
                                  </span>
                                )}
                                {b.groupRole && (
                                  <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 600 }}>
                                    {b.groupRole === 'split' ? 'Split Bill' : 'Shared Purchase'}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {new Date(b.date).toLocaleDateString()} · Total: ₹{Number(b.total).toFixed(2)}
                              </div>
                            </div>
                            <div className="font-mono" style={{ fontWeight: 700, color: 'var(--error)' }}>
                              Due: ₹{Number(b.balance).toFixed(2)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Payment Inputs & Advance Usage */}
                  <div className="grid-2" style={{ gap: '24px', alignItems: 'flex-start' }}>
                    {/* Left: Input Fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Advance Usage Checkbox */}
                      {customerAdvanceAvailable > 0 && (
                        <div style={{
                          padding: '14px 16px',
                          background: 'rgba(16,185,129,0.06)',
                          border: '1px solid rgba(16,185,129,0.25)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
                            <input
                              type="checkbox"
                              checked={useAdvance}
                              onChange={(e) => setUseAdvance(e.target.checked)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            Apply Available Advance Credit (Max ₹{customerAdvanceAvailable.toFixed(2)})
                          </label>

                          {useAdvance && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Amount to use:</span>
                              <input
                                className="form-input font-mono"
                                type="number"
                                min="0"
                                max={customerAdvanceAvailable}
                                step="0.01"
                                value={advanceToUse}
                                onChange={(e) => setAdvanceToUse(e.target.value)}
                                style={{ width: '140px', padding: '6px 10px' }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cash and UPI Payment Inputs */}
                      <div className="grid-2" style={{ gap: '14px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Banknote size={15} /> Cash Received (₹)
                          </label>
                          <input
                            className="form-input font-mono"
                            type="number"
                            min="0"
                            step="0.01"
                            value={settleCash}
                            onChange={(e) => setSettleCash(e.target.value)}
                            placeholder="0.00"
                            style={{ fontSize: '1.05rem', fontWeight: 600 }}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Smartphone size={15} /> UPI Received (₹)
                          </label>
                          <input
                            className="form-input font-mono"
                            type="number"
                            min="0"
                            step="0.01"
                            value={settleUpi}
                            onChange={(e) => setSettleUpi(e.target.value)}
                            placeholder="0.00"
                            style={{ fontSize: '1.05rem', fontWeight: 600 }}
                          />
                        </div>
                      </div>

                      {/* Quick fill helper buttons */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => fillFullAmount('cash')}
                          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                        >
                          Fill Full (Cash)
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => fillFullAmount('upi')}
                          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                        >
                          Fill Full (UPI)
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => fillFullAmount('split')}
                          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                        >
                          Split 50/50
                        </button>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Settlement Notes (Optional)</label>
                        <input
                          className="form-input"
                          type="text"
                          value={settleNotes}
                          onChange={(e) => setSettleNotes(e.target.value)}
                          placeholder="e.g., Counter cash payment, Cheque clearance ref"
                        />
                      </div>
                    </div>

                    {/* Right: Live Calculation Preview */}
                    <div style={{
                      padding: '20px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Settlement Summary</h4>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span className="text-muted">Target Bill Due:</span>
                        <strong className="font-mono">₹{targetAmountDue.toFixed(2)}</strong>
                      </div>

                      {parsedAdvUsed > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#10b981' }}>
                          <span>Advance Credit Applied:</span>
                          <strong className="font-mono">-₹{parsedAdvUsed.toFixed(2)}</strong>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span className="text-muted">Direct Cash + UPI:</span>
                        <strong className="font-mono">₹{totalDirectPaying.toFixed(2)}</strong>
                      </div>

                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        borderTop: '1px solid var(--border)', paddingTop: '8px',
                        fontSize: '0.95rem', fontWeight: 600
                      }}>
                        <span>Total Payment Applied:</span>
                        <strong className="font-mono" style={{ color: 'var(--accent)' }}>
                          ₹{Math.min(targetAmountDue, totalSettlementApplying).toFixed(2)}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 600 }}>
                        <span>Remaining Due:</span>
                        <strong className="font-mono" style={{ color: remainingDueAfterPayment > 0 ? 'var(--error)' : 'var(--success)' }}>
                          ₹{remainingDueAfterPayment.toFixed(2)}
                        </strong>
                      </div>

                      {/* Overpayment Error Notice */}
                      {excessOverpayment > 0 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 12px',
                          background: 'var(--error-bg)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.82rem',
                          color: 'var(--error)',
                          fontWeight: 600,
                          marginTop: '6px'
                        }}>
                          <AlertCircle size={16} /> Payment (₹{totalDirectPaying.toFixed(2)}) exceeds outstanding due (₹{Math.max(0, targetAmountDue - parsedAdvUsed).toFixed(2)}). Overpayments are not allowed. To deposit advance credits, use Record Advance.
                        </div>
                      )}

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={
                          isSubmittingSettle ||
                          totalSettlementApplying <= 0 ||
                          totalDirectPaying > Math.max(0, targetAmountDue - parsedAdvUsed)
                        }
                        style={{ marginTop: '12px', width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 600 }}
                      >
                        <CheckCircle size={18} /> {isSubmittingSettle ? 'Recording Settlement...' : `Confirm & Settle Bill${selectedBillId === 'all' ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* OPERATION 2: DEPOSIT CUSTOMER ADVANCE                         */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'deposit' && (
            <div style={{ maxWidth: '640px' }}>
              {advSuccess && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', marginBottom: '20px',
                  background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.9rem',
                }}>
                  <CheckCircle size={18} /> {advSuccess}
                </div>
              )}

              {advError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', marginBottom: '20px',
                  background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.9rem',
                }}>
                  <AlertCircle size={18} /> {advError}
                </div>
              )}

              {!selectedCustId ? (
                <EmptyState
                  Icon={Wallet}
                  title="Select a customer first"
                  description="Choose a registered or walk-in customer from the dropdown above to deposit advance funds."
                />
              ) : (
                <form onSubmit={handleAdvSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Total Advance Deposit (₹) *</label>
                    <input
                      className="form-input font-mono"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={advTotalAmount}
                      onChange={(e) => handleAdvAmountChange(e.target.value)}
                      placeholder="e.g. 500.00"
                      style={{ fontSize: '1.2rem', fontWeight: 700, padding: '12px 14px' }}
                    />
                  </div>

                  <div className="grid-2" style={{ gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Banknote size={15} /> Cash Portion (₹)
                      </label>
                      <input
                        className="form-input font-mono"
                        type="number"
                        min="0"
                        step="0.01"
                        value={advCashAmount}
                        onChange={(e) => setAdvCashAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Smartphone size={15} /> UPI Portion (₹)
                      </label>
                      <input
                        className="form-input font-mono"
                        type="number"
                        min="0"
                        step="0.01"
                        value={advUpiAmount}
                        onChange={(e) => setAdvUpiAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid-2" style={{ gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={15} /> Deposit Date
                      </label>
                      <input
                        className="form-input"
                        type="date"
                        value={advDate}
                        onChange={(e) => setAdvDate(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Notes / Description</label>
                      <input
                        className="form-input"
                        type="text"
                        value={advNotes}
                        onChange={(e) => setAdvNotes(e.target.value)}
                        placeholder="e.g. Advance deposit for upcoming brochures"
                      />
                    </div>
                  </div>

                  {/* Impact preview */}
                  <div style={{
                    padding: '12px 16px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)'
                  }}>
                    Customer advance balance will increase from{' '}
                    <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>₹{customerAdvanceAvailable.toFixed(2)}</strong> to{' '}
                    <strong className="font-mono" style={{ color: '#10b981' }}>
                      ₹{(customerAdvanceAvailable + Number(advTotalAmount || 0)).toFixed(2)}
                    </strong>
                    . This deposit will not be counted as sales revenue until applied against a bill.
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: '12px', fontSize: '1rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Wallet size={18} /> Record Advance Deposit
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Centralized Payment & Advance History ── */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Payment & Advance History
            </h2>
            <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
              Centralized audit trail of all customer settlements, direct payments, and advance fund deposits.
            </p>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search txn, customer, bill..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>

            <select
              className="form-select"
              value={historyFilterType}
              onChange={(e) => setHistoryFilterType(e.target.value)}
              style={{ width: '150px', fontSize: '0.85rem' }}
            >
              <option value="all">All Purposes</option>
              <option value="bills">Bill Settlements</option>
              <option value="advances">Advance Deposits</option>
            </select>

            <select
              className="form-select"
              value={historyPeriod}
              onChange={(e) => setHistoryPeriod(e.target.value)}
              style={{ width: '130px', fontSize: '0.85rem' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>

        {/* History Table */}
        {combinedHistory.length === 0 ? (
          <EmptyState
            Icon={Clock}
            title="No payment records found"
            description="No transactions match your current search or filter criteria."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Txn ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Purpose</th>
                  <th>Related Bill</th>
                  <th style={{ textAlign: 'right' }}>Cash (₹)</th>
                  <th style={{ textAlign: 'right' }}>UPI (₹)</th>
                  <th style={{ textAlign: 'right' }}>Total (₹)</th>
                  <th>Advance Impact</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {combinedHistory.map((item) => (
                  <tr key={item.key}>
                    <td className="font-mono font-medium" style={{ color: 'var(--accent)' }}>
                      {item.displayId}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.customerName}</div>
                      {item.customerCode && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.customerCode}</div>}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                        fontSize: '0.72rem', fontWeight: 600,
                        background: item.type === 'bill_payment' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                        color: item.type === 'bill_payment' ? '#3b82f6' : '#10b981',
                        border: `1px solid ${item.type === 'bill_payment' ? 'rgba(59,130,246,0.25)' : 'rgba(16,185,129,0.25)'}`
                      }}>
                        {item.purpose}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.85rem' }}>
                      {item.billDisplay}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      {item.cashAmount > 0 ? `₹${item.cashAmount.toFixed(2)}` : '—'}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      {item.upiAmount > 0 ? `₹${item.upiAmount.toFixed(2)}` : '—'}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: item.isRefund ? 'var(--error)' : 'var(--text-primary)' }}>
                      {item.isRefund ? '-' : ''}₹{item.totalAmount.toFixed(2)}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: item.advanceImpact.includes('+') ? '#10b981' : item.advanceImpact.includes('-') ? '#f59e0b' : 'var(--text-muted)' }}>
                      {item.advanceImpact}
                    </td>
                    <td>
                      <span className={`badge badge-${item.status.toLowerCase() === 'full' ? 'paid' : item.status.toLowerCase() === 'deposit' ? 'paid' : item.status.toLowerCase() === 'refund' ? 'unpaid' : 'partial'}`} style={{ fontSize: '0.7rem' }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {item.type === 'bill_payment' && !item.isRefund && item.status !== 'reversed' && getRemainingReversible(item) > 0 && (
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => openReversalModal(item)}
                            title="Reverse or Undo payment"
                            style={{ color: 'var(--accent)' }}
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleDeleteTxn(item)}
                          title="Delete transaction and reverse balance"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── Payment Reversal Modal ── */}
      {reversalModalItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
          }}
          onClick={() => setReversalModalItem(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              width: '90%',
              maxWidth: '520px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={18} color="var(--error)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Payment Reversal / Undo</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Reverse payment and reconcile affected bill outstanding
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setReversalModalItem(null)}
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Payment Reference:</span>
                  <span className="font-mono" style={{ fontWeight: 600 }}>{reversalModalItem.displayId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                  <span style={{ fontWeight: 600 }}>{reversalModalItem.customerName}</span>
                </div>
                {reversalModalItem.billDisplay && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Associated Bill:</span>
                    <span className="font-mono">{reversalModalItem.billDisplay}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Original Payment:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{reversalModalItem.totalAmount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Remaining Reversible:</span>
                  <span style={{ fontWeight: 700, color: 'var(--warning)' }}>₹{getRemainingReversible(reversalModalItem).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}>
                  Reversal Scope *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${reversalType === 'full' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'center', fontSize: '0.85rem' }}
                    onClick={() => {
                      setReversalType('full')
                      setReversalAmountInput('')
                    }}
                  >
                    Full Reversal (₹{getRemainingReversible(reversalModalItem).toFixed(2)})
                  </button>
                  <button
                    type="button"
                    className={`btn ${reversalType === 'partial' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'center', fontSize: '0.85rem' }}
                    onClick={() => {
                      setReversalType('partial')
                      setReversalAmountInput(String(Math.min(100, getRemainingReversible(reversalModalItem))))
                    }}
                  >
                    Partial Reversal
                  </button>
                </div>
              </div>

              {reversalType === 'partial' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Amount to Reverse (₹) *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={getRemainingReversible(reversalModalItem)}
                      className="form-input"
                      value={reversalAmountInput}
                      onChange={(e) => setReversalAmountInput(e.target.value)}
                      placeholder="Enter reversal amount"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setReversalAmountInput(String(getRemainingReversible(reversalModalItem)))}
                    >
                      Max
                    </button>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reason for Reversal *</label>
                <select
                  className="form-select"
                  value={reversalReasonPreset}
                  onChange={(e) => {
                    setReversalReasonPreset(e.target.value)
                    if (e.target.value !== 'other') {
                      setReversalReason(e.target.value)
                    } else {
                      setReversalReason('')
                    }
                  }}
                  style={{ marginBottom: '8px' }}
                >
                  <option value="Incorrect Cash payment entry">Incorrect Cash payment entry</option>
                  <option value="Incorrect UPI payment entry">Incorrect UPI payment entry</option>
                  <option value="Wrong payment amount recorded">Wrong payment amount recorded</option>
                  <option value="Duplicate payment entry">Duplicate payment entry</option>
                  <option value="Payment recorded against wrong bill">Payment recorded against wrong bill</option>
                  <option value="Payment recorded against wrong customer">Payment recorded against wrong customer</option>
                  <option value="Payment failed or not received">Payment failed or not received</option>
                  <option value="other">Other / Custom Reason...</option>
                </select>
                {reversalReasonPreset === 'other' && (
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    placeholder="Specify the reason for reversing this payment..."
                  />
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Authorized By *</label>
                <input
                  type="text"
                  className="form-input"
                  value={reversalAuthorizedBy}
                  onChange={(e) => setReversalAuthorizedBy(e.target.value)}
                  placeholder="Admin / Cashier name"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReversalModalItem(null)}
                disabled={isSubmittingReversal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmReversal}
                disabled={isSubmittingReversal}
                style={{ backgroundColor: 'var(--error)', color: '#fff', border: 'none' }}
              >
                {isSubmittingReversal ? 'Processing Reversal...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


export default Payments
