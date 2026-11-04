import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useAppContext } from '../context/AppContext'
import { AlertCircle,
  Plus,
  X,
  RotateCcw,
  Banknote, Smartphone, RefreshCw, User, Share2, Copy, Check, Calendar } from 'lucide-react'
import EmptyState from '../components/common/EmptyState'
import { getDeletedPayments, getRefundPayments } from '../api/payments'
import { getDisplayBillId, getDisplayCustomerId, getDisplayPaymentId, getDisplayAdvanceId } from '../utils/idFormatter'

const Refunds = () => {
  const { advancePayments = [], customers = [], bills = [], editBill, reverseRefund, settings, showConfirm, showToast, business } = useAppContext()
  
  const [refundPayments, setRefundPayments] = useState([])
  const [deletedPayments, setDeletedPayments] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [period, setPeriod] = useState('all') // 'all' | 'daily' | 'yesterday' | 'weekly' | 'monthly' | 'custom'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Receipt Modal State
    // ── Process Refund Modal State ──
  const [isProcessRefundOpen, setIsProcessRefundOpen] = useState(false)
  const [refundBillId, setRefundBillId] = useState('')
  const [refundScope, setRefundScope] = useState('full') // 'full' | 'partial' | 'item'
  const [partialRefundAmt, setPartialRefundAmt] = useState('')
  const [selectedItemsToReturn, setSelectedItemsToReturn] = useState({}) // { [itemId/index]: returnQty }
  const [issueRefundMethod, setIssueRefundMethod] = useState('upi') // 'upi' | 'advance' | 'cash'
  const [refundUtr, setRefundUtr] = useState('')
  const [refundReason, setRefundReason] = useState('Customer returned goods')
  const [securityPinInput, setSecurityPinInput] = useState('')
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false)

  // Eligible bills with payments
  const eligibleBills = useMemo(() => {
    return bills.filter(b => !b.deleted && Number(b.amountPaid || 0) > 0)
  }, [bills])

  const selectedRefundBill = useMemo(() => {
    return eligibleBills.find(b => b.id === refundBillId) || null
  }, [eligibleBills, refundBillId])

  // Calculate item return total
  const itemReturnCalculations = useMemo(() => {
    if (!selectedRefundBill || refundScope !== 'item') return { totalReturn: 0, itemsSummary: [] }
    let totalReturn = 0
    const itemsSummary = []
    const billItems = selectedRefundBill.items || []
    const billSubtotal = Number(selectedRefundBill.subtotal || selectedRefundBill.total || 1)
    const billTotal = Number(selectedRefundBill.total || 1)
    const ratio = billTotal / (billSubtotal > 0 ? billSubtotal : 1)

    billItems.forEach((it, idx) => {
      const key = it.id || `item-${idx}`
      const retQty = Number(selectedItemsToReturn[key] || 0)
      if (retQty > 0) {
        const unitP = Number(it.unitPrice || it.unit_price || 0)
        const itemLineTotal = retQty * unitP * ratio
        totalReturn += itemLineTotal
        itemsSummary.push({
          ...it,
          returnQty: retQty,
          refundAmount: Number(itemLineTotal.toFixed(2))
        })
      }
    })
    return {
      totalReturn: Math.min(Number(totalReturn.toFixed(2)), Number(selectedRefundBill.amountPaid || 0)),
      itemsSummary
    }
  }, [selectedRefundBill, refundScope, selectedItemsToReturn])

  const computedRefundAmount = useMemo(() => {
    if (!selectedRefundBill) return 0
    const maxPaid = Number(selectedRefundBill.amountPaid || 0)
    if (refundScope === 'full') return maxPaid
    if (refundScope === 'partial') {
      const val = parseFloat(partialRefundAmt) || 0
      return Math.min(val, maxPaid)
    }
    if (refundScope === 'item') {
      return itemReturnCalculations.totalReturn
    }
    return 0
  }, [selectedRefundBill, refundScope, partialRefundAmt, itemReturnCalculations])

  const handleExecuteRefund = async () => {
    if (!selectedRefundBill) {
      showToast('Please select a bill to refund.', 'error')
      return
    }
    if (computedRefundAmount <= 0) {
      showToast('Refund amount must be greater than zero.', 'error')
      return
    }
    if (!refundReason.trim()) {
      showToast('A reason for the refund is mandatory.', 'error')
      return
    }

    // 48-Hour check
    const billCreated = selectedRefundBill.createdAt || selectedRefundBill.created_at || selectedRefundBill.date
    const isOlderThan48h = billCreated ? (Date.now() - new Date(billCreated).getTime()) > 48 * 60 * 60 * 1000 : false
    if (isOlderThan48h) {
      const expectedPin = String(settings?.securityPin || '0000').trim()
      if (securityPinInput.trim() !== expectedPin) {
        showToast('Incorrect Master Security PIN. Refunds after 48 hours require valid Master PIN.', 'error')
        return
      }
    }

    setIsSubmittingRefund(true)
    try {
      const refundAction = {
        type: issueRefundMethod === 'advance' ? 'advance' : 'direct',
        method: issueRefundMethod === 'advance' ? 'upi' : issueRefundMethod,
        directAmount: issueRefundMethod === 'advance' ? 0 : computedRefundAmount,
        advanceAmount: issueRefundMethod === 'advance' ? computedRefundAmount : 0,
        utr: refundUtr,
        reason: refundReason
      }

      // If full bill refund, new total is 0. If partial/item, new total is oldTotal - refundAmount
      const newTotal = Math.max(0, Number((selectedRefundBill.total - computedRefundAmount).toFixed(2)))
      
      let updatedItems = selectedRefundBill.items || []
      if (refundScope === 'full') {
        updatedItems = []
      } else if (refundScope === 'item') {
        updatedItems = updatedItems.map((it, idx) => {
          const key = it.id || `item-${idx}`
          const retQty = Number(selectedItemsToReturn[key] || 0)
          if (retQty > 0) {
            const newQty = Math.max(0, Number(it.qty || 1) - retQty)
            return { ...it, qty: newQty, amount: newQty * Number(it.unitPrice || 0) }
          }
          return it
        }).filter(it => it.qty > 0)
      }

      const payload = {
        ...selectedRefundBill,
        total: newTotal,
        subtotal: newTotal,
        items: updatedItems,
        reason: refundReason
      }

      await editBill(selectedRefundBill.id, payload, refundAction)
      showToast(`Refund of ₹${computedRefundAmount.toFixed(2)} processed successfully.`, 'success')
      
      // Auto open receipt for this refund
      setSelectedReceipt({
        id: `REF-${Date.now()}`,
        billId: selectedRefundBill.id,
        customerName: selectedRefundBill.customerName,
        date: new Date().toISOString(),
        total: computedRefundAmount,
        cash: issueRefundMethod === 'cash' ? computedRefundAmount : 0,
        upi: issueRefundMethod === 'upi' ? computedRefundAmount : 0,
        advance: issueRefundMethod === 'advance' ? computedRefundAmount : 0,
        method: issueRefundMethod,
        notes: refundReason,
        utr: refundUtr,
        remainingBalance: selectedRefundBill.balance
      })

      setIsProcessRefundOpen(false)
      setRefundBillId('')
      setPartialRefundAmt('')
      setSelectedItemsToReturn({})
      setRefundUtr('')
      setSecurityPinInput('')
      fetchRefundData()
    } catch (err) {
      showToast('Failed to process refund: ' + err.message, 'error')
    } finally {
      setIsSubmittingRefund(false)
    }
  }

  const handleVoidRefund = (item) => {
    showConfirm({
      title: 'Void / Reverse Refund?',
      message: `Are you sure you want to void refund ${item.id} (₹${item.total.toFixed(2)})? This will restore the bill's payment balance.`,
      confirmText: 'Void Refund',
      danger: true,
      onConfirm: async () => {
        try {
          if (reverseRefund) {
            await reverseRefund({ refundPaymentId: item.rawId, reason: 'Refund voided by admin' })
          }
          showToast('Refund voided and balances restored.', 'success')
          fetchRefundData()
        } catch (err) {
          showToast('Failed to void refund: ' + err.message, 'error')
        }
      }
    })
  }

  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [copied, setCopied] = useState(false)

  // Fetch API data for deleted payments and refunds
  const fetchRefundData = useCallback(async () => {
    setIsLoading(true)
    try {
      let params = {}
      const today = new Date().toISOString().slice(0, 10)

      if (period === 'daily') {
        params.startDate = today
        params.endDate = today
      } else if (period === 'yesterday') {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        const yStr = d.toISOString().slice(0, 10)
        params.startDate = yStr
        params.endDate = yStr
      } else if (period === 'weekly') {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        params.startDate = d.toISOString().slice(0, 10)
        params.endDate = today
      } else if (period === 'monthly') {
        const d = new Date()
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
        params.startDate = firstDay
        params.endDate = today
      } else if (period === 'custom' && startDate) {
        params.startDate = startDate
        if (endDate) params.endDate = endDate
      }

      const [refRes, delRes] = await Promise.all([
        getRefundPayments(params).catch(() => ({ data: { data: [] } })),
        getDeletedPayments().catch(() => ({ data: { data: [] } })),
      ])

      setRefundPayments(refRes.data?.data || [])
      setDeletedPayments(delRes.data?.data || [])
    } catch (err) {
      console.error('Failed to load refund data:', err)
      showToast?.('Failed to load live refund records', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [period, startDate, endDate, showToast])

  useEffect(() => {
    fetchRefundData()
  }, [fetchRefundData])

  // Helper to resolve customer name
  const getCustomerName = useCallback((cId) => {
    const c = (customers || []).find((cust) => cust.id === cId)
    return c ? c.name : 'Unknown Customer'
  }, [customers])

  // 1. Calculate Refund Stats
  const refundStats = useMemo(() => {
    // Bill Refunds (negative payments / is_refund from API)
    const billRefundsList = refundPayments || []
    const billRefundsTotal = billRefundsList.reduce((s, p) => s + Math.abs(Number(p.total_paid || p.totalPaid || p.amount || 0)), 0)
    const billRefundsCash = billRefundsList.reduce((s, p) => {
      const c = Math.abs(Number(p.cash_amount || p.cashAmount || 0))
      if (c > 0) return s + c
      const m = String(p.payment_method || p.paymentMethod || '').toLowerCase()
      if (m === 'cash') return s + Math.abs(Number(p.total_paid || p.totalPaid || p.amount || 0))
      return s
    }, 0)
    const billRefundsUpi = billRefundsList.reduce((s, p) => {
      const u = Math.abs(Number(p.upi_amount || p.upiAmount || 0))
      if (u > 0) return s + u
      const m = String(p.payment_method || p.paymentMethod || '').toLowerCase()
      if (m === 'upi') return s + Math.abs(Number(p.total_paid || p.totalPaid || p.amount || 0))
      return s
    }, 0)

    // Payment Deletions (from API)
    const delPaymentsList = deletedPayments || []
    const delPaymentsTotal = delPaymentsList.reduce((s, p) => s + Math.abs(Number(p.total_paid || p.totalPaid || p.amount || 0)), 0)
    const delPaymentsCash = delPaymentsList.reduce((s, p) => {
      const c = Math.abs(Number(p.cash_amount || p.cashAmount || 0))
      if (c > 0) return s + c
      const m = String(p.payment_method || p.paymentMethod || '').toLowerCase()
      if (m === 'cash') return s + Math.abs(Number(p.total_paid || p.totalPaid || p.amount || 0))
      return s
    }, 0)
    const delPaymentsUpi = delPaymentsList.reduce((s, p) => {
      const u = Math.abs(Number(p.upi_amount || p.upiAmount || 0))
      if (u > 0) return s + u
      const m = String(p.payment_method || p.paymentMethod || '').toLowerCase()
      if (m === 'upi') return s + Math.abs(Number(p.total_paid || p.totalPaid || p.amount || 0))
      return s
    }, 0)

    // Advance Returns (negative advance payments or refund/return types)
    const advReturnsList = (advancePayments || []).filter((ap) => Number(ap.amount || 0) < 0 || ap.isReturn || ap.type === 'refund' || ap.type === 'return' || ap.type === 'refunded')
    const advReturnsTotal = advReturnsList.reduce((s, ap) => s + Math.abs(Number(ap.amount || 0)), 0)
    const advReturnsCash = advReturnsList.reduce((s, ap) => {
      const c = Math.abs(Number(ap.cashAmount || ap.cash_amount || 0))
      if (c > 0) return s + c
      const m = String(ap.paymentMode || ap.payment_mode || ap.paymentMethod || 'cash').toLowerCase()
      if (m.includes('cash') || !m.includes('upi')) return s + Math.abs(Number(ap.amount || 0))
      return s
    }, 0)
    const advReturnsUpi = advReturnsList.reduce((s, ap) => {
      const u = Math.abs(Number(ap.upiAmount || ap.upi_amount || 0))
      if (u > 0) return s + u
      const m = String(ap.paymentMode || ap.payment_mode || ap.paymentMethod || '').toLowerCase()
      if (m.includes('upi')) return s + Math.abs(Number(ap.amount || 0))
      return s
    }, 0)

    const grandTotal = billRefundsTotal + delPaymentsTotal + advReturnsTotal
    const grandCash = billRefundsCash + delPaymentsCash + advReturnsCash
    const grandUpi = billRefundsUpi + delPaymentsUpi + advReturnsUpi

    return {
      billRefundsTotal,
      billRefundsCash,
      billRefundsUpi,
      billRefundsList,

      delPaymentsTotal,
      delPaymentsCash,
      delPaymentsUpi,
      delPaymentsList,

      advReturnsTotal,
      advReturnsCash,
      advReturnsUpi,
      advReturnsList,

      grandTotal,
      grandCash,
      grandUpi,
    }
  }, [refundPayments, deletedPayments, advancePayments])

  // 2. Build Unified Refund Logs
  const refundLogs = useMemo(() => {
    const logs = []

    // Add bill refunds
    refundStats.billRefundsList.forEach((r) => {
      const tot = Math.abs(Number(r.total_paid || r.totalPaid || r.amount || 0))
      const c = Math.abs(Number(r.cash_amount || r.cashAmount || 0))
      const u = Math.abs(Number(r.upi_amount || r.upiAmount || 0))
      const m = String(r.payment_method || r.paymentMethod || '').toLowerCase()
      const cashVal = c > 0 ? c : (m === 'cash' ? tot : 0)
      const upiVal = u > 0 ? u : (m === 'upi' ? tot : 0)
      const billCode = r.bill_id ? getDisplayBillId(r.bill_id) : 'N/A'
      const custObj = (customers || []).find((c) => String(c.id) === String(r.customer_id))
      const custCode = getDisplayCustomerId(custObj || r.customer_id)

      logs.push({
        id: getDisplayPaymentId(r),
        rawId: String(r.id),
        billId: billCode,
        rawBillId: r.bill_id,
        date: r.date || r.created_at,
        type: 'Bill Refund',
        customerId: custCode,
        rawCustomerId: r.customer_id,
        customerName: r.customer_name || getCustomerName(r.customer_id),
        description: r.bill_id ? `Refund for Bill #${billCode}` : 'Direct Customer Refund',
        cash: cashVal,
        upi: upiVal,
        total: tot,
        notes: r.notes || '',
        method: cashVal > 0 && upiVal > 0 ? 'mixed' : (cashVal > 0 ? 'cash' : (upiVal > 0 ? 'upi' : 'mixed')),
      })
    })

    // Add deleted payments
    refundStats.delPaymentsList.forEach((r) => {
      const tot = Math.abs(Number(r.total_paid || r.totalPaid || r.amount || 0))
      const c = Math.abs(Number(r.cash_amount || r.cashAmount || 0))
      const u = Math.abs(Number(r.upi_amount || r.upiAmount || 0))
      const m = String(r.payment_method || r.paymentMethod || '').toLowerCase()
      const cashVal = c > 0 ? c : (m === 'cash' ? tot : 0)
      const upiVal = u > 0 ? u : (m === 'upi' ? tot : 0)
      const billCode = r.bill_id ? getDisplayBillId(r.bill_id) : 'N/A'
      const custObj = (customers || []).find((c) => String(c.id) === String(r.customer_id))
      const custCode = getDisplayCustomerId(custObj || r.customer_id)

      logs.push({
        id: getDisplayPaymentId(r),
        rawId: String(r.id),
        billId: billCode,
        rawBillId: r.bill_id,
        date: r.deleted_at || r.date,
        type: 'Payment Deletion',
        customerId: custCode,
        rawCustomerId: r.customer_id,
        customerName: r.customer_name || getCustomerName(r.customer_id),
        description: r.bill_id ? `Deleted Payment for Bill #${billCode}` : 'Deleted Payment',
        cash: cashVal,
        upi: upiVal,
        total: tot,
        notes: `Deleted on ${r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : 'N/A'}`,
        method: cashVal > 0 && upiVal > 0 ? 'mixed' : (cashVal > 0 ? 'cash' : (upiVal > 0 ? 'upi' : 'mixed')),
      })
    })

    // Add advance returns
    refundStats.advReturnsList.forEach((r) => {
      const tot = Math.abs(Number(r.amount || 0))
      const c = Math.abs(Number(r.cashAmount || r.cash_amount || 0))
      const u = Math.abs(Number(r.upiAmount || r.upi_amount || 0))
      const m = String(r.payment_mode || r.paymentMode || r.paymentMethod || 'cash').toLowerCase()
      const cashVal = c > 0 ? c : (m.includes('cash') || !m.includes('upi') ? tot : 0)
      const upiVal = u > 0 ? u : (m.includes('upi') ? tot : 0)
      const custId = r.customerId || r.customer_id
      const custObj = (customers || []).find((c) => String(c.id) === String(custId))
      const custCode = getDisplayCustomerId(custObj || custId)

      logs.push({
        id: getDisplayAdvanceId(r),
        rawId: String(r.id),
        billId: r.billId ? getDisplayBillId(r.billId) : 'N/A',
        rawBillId: r.billId,
        date: r.date,
        type: 'Advance Return',
        customerId: custCode,
        rawCustomerId: custId,
        customerName: r.customerName || getCustomerName(custId),
        description: 'Returned Advance to Customer',
        cash: cashVal,
        upi: upiVal,
        total: tot,
        notes: r.notes || '',
        method: cashVal > 0 && upiVal > 0 ? 'mixed' : (cashVal > 0 ? 'cash' : (upiVal > 0 ? 'upi' : 'mixed')),
      })
    })

    // Sort by date descending
    return logs.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [refundStats, getCustomerName, customers])

  // Filter and search refund logs
  const filteredLogs = useMemo(() => {
    return refundLogs.filter((log) => {
      const matchesType = filterType === 'all' || log.type.toLowerCase().replace(' ', '_') === filterType
      const matchesMethod = filterMethod === 'all' || log.method === filterMethod
      const matchesSearch =
        searchQuery.trim() === '' ||
        log.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(log.customerId).toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.id.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesType && matchesMethod && matchesSearch
    })
  }, [refundLogs, filterType, filterMethod, searchQuery])

  // Format Receipt text for WhatsApp or clipboard
  const generateReceiptText = (receipt) => {
    const shop = business?.shopName || 'PrintPro'
    const dateStr = new Date(receipt.date).toLocaleDateString()
    return `*REFUND RECEIPT*\n${shop}\n----------------------------\nRefund ID: #${receipt.id}\nDate: ${dateStr}\nCustomer: ${receipt.customerName}\nReference: ${receipt.description}\nAmount Refunded: ₹${receipt.total.toFixed(2)} (${receipt.method.toUpperCase()})\nNotes: ${receipt.notes || 'N/A'}\n----------------------------\nThank you!`
  }

  const handleShareWhatsApp = (receipt) => {
    const text = generateReceiptText(receipt)
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const handleCopyReceipt = (receipt) => {
    const text = generateReceiptText(receipt)
    navigator.clipboard.writeText(text)
    setCopied(true)
    showToast?.('Refund receipt text copied to clipboard', 'success')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Refunds & Reversals</h1>
          <p>Live cloud audit of cash & UPI refund transactions, payment deletions, and advance returns.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => setIsProcessRefundOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} />
            <span>Process Bill Refund / Return</span>
          </button>
          <button className="btn btn-secondary" onClick={fetchRefundData} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '12px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Calendar size={16} color="var(--accent)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Period Filter:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'daily', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'weekly', label: 'This Week' },
              { id: 'monthly', label: 'This Month' },
              { id: 'custom', label: 'Custom' }
            ].map((p) => (
              <button
                key={p.id}
                className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '20px' }}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards (Now backed by live API data) */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon error" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}><RefreshCw /></div>
            <div>
              <div className="stat-card-label">Total Outflows</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--error)' }}>₹{refundStats.grandTotal.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Combined reversals & refunds</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}><Banknote /></div>
            <div>
              <div className="stat-card-label">Cash Refunds</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: '#10b981' }}>₹{refundStats.grandCash.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Total cash refunded out</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon info" style={{ background: 'rgba(59,130,246,0.08)', color: '#3b82f6' }}><Smartphone /></div>
            <div>
              <div className="stat-card-label">UPI Refunds</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: '#3b82f6' }}>₹{refundStats.grandUpi.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Total UPI refunded out</div>
        </div>
      </div>

      {/* Refunds by Category Grid */}
      <div className="grid-3" style={{ gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Bill Edit Refunds</h4>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--warning)' }}>₹{refundStats.billRefundsTotal.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span className="font-mono">Cash: ₹{refundStats.billRefundsCash.toFixed(2)}</span>
            <span className="font-mono">UPI: ₹{refundStats.billRefundsUpi.toFixed(2)}</span>
          </div>
        </div>

        <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Payment Deletions</h4>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--error)' }}>₹{refundStats.delPaymentsTotal.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span className="font-mono">Cash: ₹{refundStats.delPaymentsCash.toFixed(2)}</span>
            <span className="font-mono">UPI: ₹{refundStats.delPaymentsUpi.toFixed(2)}</span>
          </div>
        </div>

        <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Advance Returns</h4>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--info)' }}>₹{refundStats.advReturnsTotal.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span className="font-mono">Cash: ₹{refundStats.advReturnsCash.toFixed(2)}</span>
            <span className="font-mono">UPI: ₹{refundStats.advReturnsUpi.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Filters and List */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h2>Refund Logs ({filteredLogs.length})</h2>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by customer, bill ID..."
              className="form-input"
              style={{ width: '220px', padding: '6px 12px', fontSize: '0.85rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="form-select"
              style={{ width: '150px', padding: '6px 12px', fontSize: '0.85rem' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="bill_refund">Bill Refund</option>
              <option value="payment_deletion">Payment Deletion</option>
              <option value="advance_return">Advance Return</option>
            </select>

            <select
              className="form-select"
              style={{ width: '130px', padding: '6px 12px', fontSize: '0.85rem' }}
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash Mode</option>
              <option value="upi">UPI Mode</option>
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <EmptyState
            Icon={AlertCircle}
            title="No refund records found"
            description="No refund, deletion, or return logs match your search query and selected filter options."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>Description</th>
                  <th>Cash (₹)</th>
                  <th>UPI (₹)</th>
                  <th>Total (₹)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={`${log.type}-${log.id}`}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.date).toLocaleDateString()}</td>
                    <td className="font-mono text-muted" style={{ fontSize: '0.78rem' }}>{log.id}</td>
                    <td>
                      <span className={`badge badge-${log.type === 'Bill Refund' ? 'partial' : log.type === 'Payment Deletion' ? 'unpaid' : 'info'}`} style={{ fontSize: '0.7rem' }}>
                        {log.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} className="text-muted" />
                        <div>
                          <span style={{ fontWeight: 500 }}>{log.customerName}</span>
                          <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.customerId}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{log.description}</div>
                      {log.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{log.notes}</div>}
                    </td>
                    <td className="font-mono tabular-nums">₹{log.cash.toFixed(2)}</td>
                    <td className="font-mono tabular-nums">₹{log.upi.toFixed(2)}</td>
                    <td className="font-mono tabular-nums" style={{ fontWeight: 600, color: 'var(--warning)' }}>₹{log.total.toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => setSelectedReceipt(log)}
                          title="View & Share Refund Receipt"
                        >
                          <Share2 size={12} />
                          <span>Receipt</span>
                        </button>
                        {log.type === 'Refund Payment' && (
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleVoidRefund(log)}
                            title="Void / Reverse this Refund"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refund Receipt Modal */}
      {/* ── Process Refund Modal ── */}
      {isProcessRefundOpen && (
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
          onClick={() => setIsProcessRefundOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              width: '90%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Process Bill Refund / Item Return</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Issue full, partial, or item-level refunds with audit trail
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsProcessRefundOpen(false)}
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Select Bill */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Select Paid / Partially Paid Bill *</label>
                <select
                  className="form-select"
                  value={refundBillId}
                  onChange={(e) => {
                    setRefundBillId(e.target.value)
                    setRefundScope('full')
                    setPartialRefundAmt('')
                    setSelectedItemsToReturn({})
                  }}
                >
                  <option value="">-- Choose a bill to refund --</option>
                  {eligibleBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {getDisplayBillId(b)} · {b.customerName || 'Customer'} (Total: ₹{Number(b.total || 0).toFixed(2)}, Paid: ₹{Number(b.amountPaid || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedRefundBill && (
                <>
                  {/* Bill Summary Banner */}
                  <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Customer: </span>
                      <strong>{selectedRefundBill.customerName}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Bill Total: </span>
                      <strong>₹{Number(selectedRefundBill.total).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Amount Paid: </span>
                      <strong style={{ color: 'var(--success)' }}>₹{Number(selectedRefundBill.amountPaid).toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Scope Selector */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}>
                      Refund Scope *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${refundScope === 'full' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setRefundScope('full')}
                        style={{ justifyContent: 'center' }}
                      >
                        Full Refund
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${refundScope === 'partial' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setRefundScope('partial')
                          setPartialRefundAmt(String(Math.min(100, Number(selectedRefundBill.amountPaid || 0))))
                        }}
                        style={{ justifyContent: 'center' }}
                      >
                        Partial Amount
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${refundScope === 'item' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setRefundScope('item')}
                        style={{ justifyContent: 'center' }}
                      >
                        Item Return
                      </button>
                    </div>
                  </div>

                  {/* Partial Input */}
                  {refundScope === 'partial' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Partial Refund Amount (₹) *</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={Number(selectedRefundBill.amountPaid || 0)}
                          className="form-input"
                          value={partialRefundAmt}
                          onChange={(e) => setPartialRefundAmt(e.target.value)}
                          placeholder="Amount to refund"
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setPartialRefundAmt(String(selectedRefundBill.amountPaid))}
                        >
                          Max
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Item-Level Return Table */}
                  {refundScope === 'item' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Select Items to Return *</label>
                      <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                        <table className="table" style={{ margin: 0, fontSize: '0.82rem' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}>Ret</th>
                              <th>Item</th>
                              <th style={{ textAlign: 'center' }}>Sold</th>
                              <th style={{ textAlign: 'center', width: '90px' }}>Return Qty</th>
                              <th style={{ textAlign: 'right' }}>Refund (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedRefundBill.items || []).map((it, idx) => {
                              const key = it.id || `item-${idx}`
                              const currentRet = Number(selectedItemsToReturn[key] || 0)
                              const isSelected = currentRet > 0
                              const itemPrice = Number(it.unitPrice || it.unit_price || 0)
                              return (
                                <tr key={key}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        setSelectedItemsToReturn(prev => ({
                                          ...prev,
                                          [key]: e.target.checked ? Number(it.qty || 1) : 0
                                        }))
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 500 }}>{it.name || it.itemName || 'Item'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹{itemPrice.toFixed(2)} / unit</div>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>{it.qty || 1}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max={it.qty || 1}
                                      className="form-input"
                                      style={{ padding: '2px 6px', textAlign: 'center', width: '70px', margin: '0 auto' }}
                                      value={currentRet}
                                      onChange={(e) => {
                                        const v = Math.min(Number(it.qty || 1), Math.max(0, parseInt(e.target.value, 10) || 0))
                                        setSelectedItemsToReturn(prev => ({ ...prev, [key]: v }))
                                      }}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                    ₹{(currentRet * itemPrice).toFixed(2)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Method Selector */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}>
                      Refund Disbursement Method *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${issueRefundMethod === 'upi' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setIssueRefundMethod('upi')}
                        style={{ justifyContent: 'center' }}
                      >
                        UPI Return
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${issueRefundMethod === 'advance' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setIssueRefundMethod('advance')}
                        style={{ justifyContent: 'center' }}
                      >
                        Advance Credit
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${issueRefundMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setIssueRefundMethod('cash')}
                        style={{ justifyContent: 'center' }}
                      >
                        Cash Return
                      </button>
                    </div>
                  </div>

                  {issueRefundMethod === 'upi' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>UPI UTR / Reference ID</label>
                      <input
                        type="text"
                        className="form-input"
                        value={refundUtr}
                        onChange={(e) => setRefundUtr(e.target.value)}
                        placeholder="e.g. 312456789012 (optional or pending)"
                      />
                    </div>
                  )}

                  {/* Reason */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Refund Reason *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="e.g. Customer returned goods / order cancellation"
                    />
                  </div>

                  {/* Security PIN check if >48 hours */}
                  {selectedRefundBill && selectedRefundBill.createdAt && (Date.now() - new Date(selectedRefundBill.createdAt).getTime()) > 48 * 60 * 60 * 1000 && (
                    <div className="form-group" style={{ marginBottom: 0, backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--warning)' }}>
                        Master Security PIN (Bill &gt; 48 hrs old) *
                      </label>
                      <input
                        type="password"
                        className="form-input"
                        value={securityPinInput}
                        onChange={(e) => setSecurityPinInput(e.target.value)}
                        placeholder="Enter master PIN"
                      />
                    </div>
                  )}

                  {/* Total to be refunded summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Total Refund Amount:</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--error)' }}>
                      ₹{computedRefundAmount.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsProcessRefundOpen(false)}
                disabled={isSubmittingRefund}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleExecuteRefund}
                disabled={isSubmittingRefund || !selectedRefundBill || computedRefundAmount <= 0}
                style={{ backgroundColor: 'var(--error)', color: '#fff', border: 'none' }}
              >
                {isSubmittingRefund ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReceipt && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
          }}
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              width: '90%',
              maxWidth: '440px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Refund Receipt
              </h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px dashed var(--border)',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                color: 'var(--text-primary)',
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
                {business?.shopName || 'PrintPro'}
              </div>
              <div style={{ borderBottom: '1px dashed var(--border)', marginBottom: '8px', paddingBottom: '4px' }}>
                <div><strong>Type:</strong> {selectedReceipt.type}</div>
                <div className="font-mono"><strong>Refund ID:</strong> #{selectedReceipt.id}</div>
                <div><strong>Date:</strong> {new Date(selectedReceipt.date).toLocaleString()}</div>
                <div><strong>Customer:</strong> {selectedReceipt.customerName} ({selectedReceipt.customerId})</div>
                <div><strong>Reference:</strong> {selectedReceipt.description}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b', margin: '8px 0' }}>
                <span>Amount Refunded:</span>
                <span className="font-mono tabular-nums">₹{selectedReceipt.total.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <div>Mode: {selectedReceipt.method.toUpperCase()} (Cash: ₹{selectedReceipt.cash.toFixed(2)}, UPI: ₹{selectedReceipt.upi.toFixed(2)})</div>
                {selectedReceipt.notes && <div>Notes: {selectedReceipt.notes}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleCopyReceipt(selectedReceipt)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={() => handleShareWhatsApp(selectedReceipt)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', backgroundColor: '#25D366', borderColor: '#25D366' }}
              >
                <Share2 size={14} />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Refunds
