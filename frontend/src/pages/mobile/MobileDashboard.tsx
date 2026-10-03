import React, { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import { usePayments, usePaymentMutations, useAdvancePayments } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'
import { ReconciliationService } from '../../services/reconciliationService'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  TrendingUp, Clock, Wallet, CheckCircle, RefreshCw,
  PlusCircle, UserPlus, Download,
  Receipt, Users, Inbox, BarChart3, Search, ArrowDownRight, DollarSign,
  MessageSquare, CreditCard, ChevronRight,
  User, Smartphone, Banknote, Layers, X, Sparkles, Check, Coins
} from 'lucide-react'
import { SequenceService } from '../../services/sequenceService'
import { ReminderService } from '../../services/reminderService'
import { useUnifiedFinancialHub } from '../../hooks/useUnifiedFinancialHub'
import '../../styles/mobile.css'


interface MetricsRowProps {
  stats: {
    totalRevenue: number
    totalCollected: number
    billCount: number
    pendingAmount: number
    unpaidCount: number
    cashInflow: number
    cashTotal: number
    upiTotal: number
    periodExpenses: number
    totalRefunds: number
    netCashFlow: number
    advancePool?: number
  }
}

const MetricsRow = React.memo(({ stats }: MetricsRowProps) => {
  return (
    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
      {/* Metric Card 1: Total Revenue */}
      <div className="mobile-card mobile-card-glow" style={{ minWidth: '220px', flex: '0 0 auto', borderColor: 'var(--accent-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL REVENUE</span>
          <TrendingUp size={18} style={{ color: 'var(--accent-primary)' }} />
        </div>
        <div className="currency-num" style={{ fontSize: '1.5rem', color: '#ffffff', textShadow: '0 0 10px rgba(255, 47, 176, 0.4)' }}>
          ₹{stats.totalRevenue.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--accent-secondary)', marginTop: '4px' }}>
          Invoiced In Period
        </div>
      </div>

      {/* Metric Card 2: Receivables */}
      <div className="mobile-card" style={{ minWidth: '220px', flex: '0 0 auto', borderColor: 'var(--error-bg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>RECEIVABLES</span>
          <Clock size={18} style={{ color: 'var(--error)' }} />
        </div>
        <div className="currency-num" style={{ fontSize: '1.5rem', color: 'var(--error)', textShadow: '0 0 10px rgba(255, 56, 96, 0.4)' }}>
          ₹{stats.pendingAmount.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          {stats.unpaidCount} Pending Invoice(s){(stats.advancePool || 0) > 0 ? ` • Adv: ₹${(stats.advancePool || 0).toLocaleString('en-IN')}` : ''}
        </div>
      </div>

      {/* Metric Card 3: Cash Inflow (With Cash vs UPI breakdown) */}
      <div className="mobile-card" style={{ minWidth: '220px', flex: '0 0 auto', borderColor: 'var(--accent-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>CASH INFLOW</span>
          <Wallet size={18} style={{ color: 'var(--accent-secondary)' }} />
        </div>
        <div className="currency-num" style={{ fontSize: '1.5rem', color: 'var(--accent-secondary)', textShadow: '0 0 10px rgba(0, 240, 255, 0.4)' }}>
          ₹{stats.cashInflow.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Cash: ₹{stats.cashTotal.toLocaleString('en-IN')} • UPI: ₹{stats.upiTotal.toLocaleString('en-IN')}
        </div>
      </div>

      {/* Metric Card 4: Expenses Total */}
      <div className="mobile-card" style={{ minWidth: '200px', flex: '0 0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL EXPENSES</span>
          <ArrowDownRight size={18} style={{ color: 'var(--accent-tertiary)' }} />
        </div>
        <div className="currency-num" style={{ fontSize: '1.5rem', color: 'var(--accent-tertiary)' }}>
          ₹{stats.periodExpenses.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Operational Outflow
        </div>
      </div>

      {/* Metric Card 5: Net Profit / Cash Flow */}
      <div className="mobile-card" style={{ minWidth: '200px', flex: '0 0 auto', borderColor: 'var(--success-bg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET CASH FLOW</span>
          <CheckCircle size={18} style={{ color: 'var(--success)' }} />
        </div>
        <div className="currency-num" style={{ fontSize: '1.5rem', color: stats.netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
          ₹{stats.netCashFlow.toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Inflow - Expenses - Refunds
        </div>
      </div>
    </div>
  )
})

MetricsRow.displayName = 'MetricsRow'

export default function MobileDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    business, syncFromCloud, showToast
  } = useAppContext()

  // Unified Financial Hub (Single Connection for all financial balances)
  const {
    storeFinancials,
    getCustomerFinancials,
    invalidateAllFinancialQueries,
  } = useUnifiedFinancialHub()

  // TanStack Queries & Mutations
  const { data: bills = [] } = useBills()
  const { data: customers = [] } = useCustomers()
  const { data: payments = [] } = usePayments()
  const { data: advancePayments = [] } = useAdvancePayments()
  const { data: expenses = [] } = useExpenses()
  const { createCustomer: createCustomerMutation, updateCustomer: updateCustomerMutation, isCreating: isCreatingCustomer } = useCustomerMutations()
  const { createPayment: createPaymentMutation } = usePaymentMutations()
  const { updateBill: updateBillMutation } = useBillMutations()


  const [isSyncing, setIsSyncing] = useState(false)
  const [filterPeriod, setFilterPeriod] = useState('today') // 'today' | 'week' | 'month' | 'fy' | 'custom' | 'all'
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedFY, setSelectedFY] = useState(
    new Date().getMonth() >= 3 ? String(new Date().getFullYear()) : String(new Date().getFullYear() - 1)
  )

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false)

  // Payment Form States
  const [paymentCustomerId, setPaymentCustomerId] = useState('')
  const [paymentCustomerSearch, setPaymentCustomerSearch] = useState('')
  const [paymentCustomerFilter, setPaymentCustomerFilter] = useState<'all' | 'due' | 'regular' | 'walkin'>('all')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [paymentCash, setPaymentCash] = useState('')
  const [paymentUpi, setPaymentUpi] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  // Customer Modal Form
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const [newCustType, setNewCustType] = useState('regular')

  // Selected customer object & live financials
  const selectedCustomerObj = useMemo(() => {
    if (!paymentCustomerId) return null
    return (customers || []).find((c) => String(c.id) === String(paymentCustomerId)) || null
  }, [customers, paymentCustomerId])

  const selectedCustomerFinancials = useMemo(() => {
    if (!paymentCustomerId) return null
    return getCustomerFinancials(paymentCustomerId)
  }, [paymentCustomerId, getCustomerFinancials])

  // Calculate live outstanding dues for selected customer in payment modal
  const selectedCustomerDue = useMemo(() => {
    if (!paymentCustomerId) return 0
    if (selectedCustomerFinancials) return selectedCustomerFinancials.netDue
    return (bills || [])
      .filter((b) => {
        if (b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false
        const bCustId = b.customerId || b.customer_id
        return String(bCustId) === String(paymentCustomerId) && Number(b.balance || 0) > 0
      })
      .reduce((sum, b) => sum + Number(b.balance || 0), 0)
  }, [bills, paymentCustomerId, selectedCustomerFinancials])

  // Enriched customer list for searchable picker in payment modal
  const paymentModalFilteredCustomers = useMemo(() => {
    let list = (customers || []).map((c) => {
      const fin = getCustomerFinancials(c.id)
      const due = fin ? fin.netDue : (bills || [])
        .filter((b) => {
          if (b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false
          const bCustId = b.customerId || b.customer_id
          return String(bCustId) === String(c.id) && Number(b.balance || 0) > 0
        })
        .reduce((sum, b) => sum + Number(b.balance || 0), 0)
      const adv = fin ? (fin.advanceBalance || fin.creditSurplus || 0) : Number(c.advanceBalance || c.advance_balance || c.creditBalance || c.credit_balance || 0)
      const displayCode = c.customerCode || SequenceService.formatDisplayCode(c.id, 'CUS')
      return {
        ...c,
        due,
        adv,
        displayCode,
      }
    })

    if (paymentCustomerFilter === 'due') {
      list = list.filter((c) => c.due > 0)
    } else if (paymentCustomerFilter === 'regular') {
      list = list.filter((c) => c.type === 'regular')
    } else if (paymentCustomerFilter === 'walkin') {
      list = list.filter((c) => c.type !== 'regular')
    }

    if (paymentCustomerSearch.trim()) {
      const q = paymentCustomerSearch.toLowerCase().trim()
      list = list.filter((c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.displayCode && c.displayCode.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      )
    }

    // Sort: highest outstanding due first, then alphabetically
    return list.sort((a, b) => {
      if (b.due !== a.due) return b.due - a.due
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [customers, bills, getCustomerFinancials, paymentCustomerFilter, paymentCustomerSearch])

  const handleRecordPaymentSubmit = useCallback(async (e) => {
    e.preventDefault()
    const total = parseFloat(paymentAmount) || 0
    if (!paymentCustomerId) {
      showToast('Please select a customer', 'error')
      return
    }
    if (total <= 0) {
      showToast('Please enter a valid payment amount', 'error')
      return
    }

    let cash = 0
    let upi = 0
    if (paymentMode === 'cash') {
      cash = total
    } else if (paymentMode === 'upi') {
      upi = total
    } else if (paymentMode === 'split') {
      cash = parseFloat(paymentCash) || 0
      upi = parseFloat(paymentUpi) || 0
      if (Math.abs((cash + upi) - total) > 0.01) {
        showToast(`Split total (₹${cash + upi}) must equal ₹${total}`, 'error')
        return
      }
    }

    setIsSubmittingPayment(true)
    try {
      const selectedCust = (customers || []).find(c => String(c.id) === String(paymentCustomerId))
      const custName = selectedCust?.name || 'Customer'

      // Find customer's unpaid active bills sorted chronologically (FIFO)
      const custUnpaidBills = (bills || [])
        .filter(
          (b) =>
            !b.deleted &&
            !b.deleted_at &&
            !b.isGroupParent &&
            !b.is_group_parent &&
            String(b.customerId || b.customer_id) === String(paymentCustomerId) &&
            Number(b.balance || 0) > 0
        )
        .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

      let remaining = total
      for (const b of custUnpaidBills) {
        if (remaining <= 0) break
        const toPay = Math.min(remaining, Number(b.balance || 0))
        const newBal = Number(Math.max(0, Number(b.balance || 0) - toPay).toFixed(2))
        const currentPaid = Number(b.amountPaid !== undefined ? b.amountPaid : (b.amount_paid || 0))
        const newPaid = Number((currentPaid + toPay).toFixed(2))
        const newStatus = newBal <= 0.001 ? 'paid' : 'partial'

        if (updateBillMutation) {
          await updateBillMutation({
            id: b.id,
            data: {
              balance: newBal,
              status: newStatus,
              amountPaid: newPaid,
              amount_paid: newPaid,
            }
          })
        }
        remaining = Number((remaining - toPay).toFixed(2))
      }

      // If customer overpaid (excess), credit customer advance / credit balance
      if (remaining > 0 && selectedCust && updateCustomerMutation) {
        const currentAdv = Number(selectedCust.advanceBalance || selectedCust.advance_balance || selectedCust.creditBalance || selectedCust.credit_balance || 0)
        const newAdv = Number((currentAdv + remaining).toFixed(2))
        await updateCustomerMutation({
          id: selectedCust.id,
          data: {
            advanceBalance: newAdv,
            advance_balance: newAdv,
            creditBalance: newAdv,
            credit_balance: newAdv,
          }
        })
      }

      // Cloud mutation for durable persistence and optimistic React Query update
      if (createPaymentMutation) {
        await createPaymentMutation({
          customerId: paymentCustomerId,
          customerName: custName,
          totalPaid: total,
          cashAmount: cash,
          upiAmount: upi,
          paymentMethod: paymentMode === 'split' ? 'split' : paymentMode,
          payment_type: custUnpaidBills.length > 0 && remaining === 0 ? 'full' : 'partial',
          paymentType: custUnpaidBills.length > 0 && remaining === 0 ? 'full' : 'partial',
          notes: paymentNotes || 'Mobile Dashboard Quick Payment',
          date: new Date().toISOString()
        })
      }

      // Unified financial cache invalidation across all 7 modules
      await invalidateAllFinancialQueries()

      showToast(`Payment of ₹${total.toLocaleString('en-IN')} recorded for ${custName}`, 'success')
      setShowRecordPaymentModal(false)
      setPaymentCustomerId('')
      setPaymentAmount('')
      setPaymentMode('cash')
      setPaymentCash('')
      setPaymentUpi('')
      setPaymentNotes('')
    } catch (err) {
      showToast(err.message || 'Failed to record payment', 'error')
    } finally {
      setIsSubmittingPayment(false)
    }
  }, [
    paymentAmount,
    paymentCustomerId,
    paymentMode,
    paymentCash,
    paymentUpi,
    paymentNotes,
    customers,
    bills,
    createPaymentMutation,
    updateBillMutation,
    updateCustomerMutation,
    queryClient,
    showToast
  ])

  // Handle Cloud Sync
  const handleSync = useCallback(async () => {
    setIsSyncing(true)
    try {
      if (syncFromCloud) {
        await syncFromCloud()
      }
      await queryClient.invalidateQueries()
      showToast('Cloud Data Synced Successfully', 'success')
    } catch (_e) {
      showToast('Sync Failed: Check network connection', 'error')
    } finally {
      setIsSyncing(false)
    }
  }, [syncFromCloud, queryClient, showToast])

  // Filter Data by Period
  const activeDateRange = useMemo(() => {
    const today = new Date()
    let start = null
    let end = null

    if (filterPeriod === 'today') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
    } else if (filterPeriod === 'week') {
      const day = today.getDay()
      const diff = today.getDate() - day
      start = new Date(today.getFullYear(), today.getMonth(), diff, 0, 0, 0, 0)
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
    } else if (filterPeriod === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (filterPeriod === 'fy') {
      const fyYear = parseInt(selectedFY, 10)
      start = new Date(fyYear, 3, 1, 0, 0, 0, 0)
      end = new Date(fyYear + 1, 2, 31, 23, 59, 59, 999)
    } else if (filterPeriod === 'custom') {
      start = customStartDate ? new Date(customStartDate) : null
      if (start) start.setHours(0, 0, 0, 0)
      end = customEndDate ? new Date(customEndDate) : null
      if (end) end.setHours(23, 59, 59, 999)
    }

    return { start, end }
  }, [filterPeriod, selectedFY, customStartDate, customEndDate])

  const filteredBills = useMemo(() => {
    const { start, end } = activeDateRange
    return (bills || []).filter((b) => {
      if (!b || b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false
      if (!start || !end) return true
      const d = new Date(b.date)
      return d >= start && d <= end
    })
  }, [bills, activeDateRange])

  const reconciledBills = useMemo(() => {
    return ReconciliationService.reconcileBillsWithPayments(filteredBills, payments)
  }, [filteredBills, payments])

  // All-time reconciled bills (never clipped by period filter - store lifetime source of truth)
  const allTimeReconciledBills = useMemo(() => {
    return ReconciliationService.reconcileBillsWithPayments(bills, payments)
  }, [bills, payments])

  const allTimeTotalCustomers = useMemo(() => {
    return (customers || []).filter(c => !c.deleted).length
  }, [customers])

  const allTimePendingAmount = storeFinancials.totalAccountsReceivable
  const allTimeAdvancePool = storeFinancials.totalAdvancePool
  const allTimeNetDue = storeFinancials.totalAccountsReceivable

  // Top Debtors (All-Time) with Net Due & CUS-XXXX code — Single Unified Connection
  const topDebtors = useMemo(() => {
    return (storeFinancials.debtorsList || [])
      .slice(0, 5)
      .map(d => ({
        customerId: d.customerId,
        customerName: d.customerName,
        customerCode: d.customerCode,
        phone: d.phone,
        advanceBalance: d.advanceBalance,
        grossDue: d.grossDue,
        billCount: d.openBillsCount,
        netDue: d.netDue,
      }))
  }, [storeFinancials.debtorsList])

  // Financial Metric Calculations matching desktop logic
  const stats = useMemo(() => {
    const totalRevenue = filteredBills.reduce((sum, b) => sum + Number(b.total || 0), 0)
    const unpaidBills = allTimeReconciledBills.filter((b) => Number(b.balance || 0) > 0)
    const pendingAmount = allTimePendingAmount
    const totalCollected = Number(reconciledBills.reduce((sum, b) => sum + Number(b.amountPaid || 0), 0).toFixed(2))

    const periodPayments = (payments || []).filter((p) => {
      if (p.isRefund || p.is_refund) return false
      const notesLower = String(p.notes || '').toLowerCase()
      const isAdvanceApplied =
        notesLower.includes('advance balance applied') ||
        notesLower.includes('from advance deposit') ||
        notesLower.includes('fifo payment from advance deposit') ||
        p.paymentType === 'advance_deduction' ||
        p.payment_type === 'advance_deduction'
      if (isAdvanceApplied) return false

      const d = new Date(p.date || p.created_at)
      if (activeDateRange.start && d < activeDateRange.start) return false
      if (activeDateRange.end && d > activeDateRange.end) return false
      return true
    })

    const periodAdvances = (advancePayments || []).filter((ap) => {
      if (ap.isReturn || ap.type === 'return' || Number(ap.amount || 0) <= 0) return false
      const d = new Date(ap.date || ap.created_at)
      if (activeDateRange.start && d < activeDateRange.start) return false
      if (activeDateRange.end && d > activeDateRange.end) return false
      return true
    })

    let cashTotal = 0
    let upiTotal = 0
    periodPayments.forEach((p) => {
      let cash = Number(p.cashAmount || p.cash_amount || 0)
      let upi = Number(p.upiAmount || p.upi_amount || 0)
      const totalPaid = Number(
        p.totalPaid !== undefined ? p.totalPaid : p.amount !== undefined ? p.amount : p.total_paid || 0
      )
      if (cash === 0 && upi === 0 && totalPaid > 0) {
        const method = String(p.payment_method || p.paymentMethod || p.paymentType || '').toLowerCase()
        if (method === 'upi') upi = totalPaid
        else cash = totalPaid
      }
      cashTotal += cash
      upiTotal += upi
    })

    periodAdvances.forEach((ap) => {
      let cash = Number(ap.cashAmount || ap.cash_amount || 0)
      let upi = Number(ap.upiAmount || ap.upi_amount || 0)
      const amt = Number(ap.amount || 0)
      if (cash === 0 && upi === 0 && amt > 0) {
        const method = String(ap.paymentMethod || ap.payment_method || 'cash').toLowerCase()
        if (method === 'upi') upi = amt
        else cash = amt
      }
      cashTotal += cash
      upiTotal += upi
    })

    const cashInflow = Number((cashTotal + upiTotal).toFixed(2))

    const periodExpenses = (expenses || [])
      .filter((e) => {
        const d = new Date(e.date || e.created_at)
        if (activeDateRange.start && d < activeDateRange.start) return false
        if (activeDateRange.end && d > activeDateRange.end) return false
        return true
      })
      .reduce((sum, e) => sum + Number(e.amount || e.total || 0), 0)

    const refundPayments = (payments || []).filter((p) => {
      const isRef = p.isRefund || p.is_refund || p.paymentType === 'refund' || Number(p.totalPaid || p.total_paid || 0) < 0
      if (!isRef) return false
      const d = new Date(p.date || p.created_at)
      if (activeDateRange.start && d < activeDateRange.start) return false
      if (activeDateRange.end && d > activeDateRange.end) return false
      return true
    })

    const returnAdvances = (advancePayments || []).filter((a) => {
      const isRet = a.isReturn || a.type === 'return' || Number(a.amount || 0) < 0
      if (!isRet) return false
      const d = new Date(a.date || a.created_at)
      if (activeDateRange.start && d < activeDateRange.start) return false
      if (activeDateRange.end && d > activeDateRange.end) return false
      return true
    })

    const totalRefunds = Number((
      refundPayments.reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || p.total_paid || p.amount || 0)), 0) +
      returnAdvances.reduce((sum, a) => sum + Math.abs(Number(a.amount || 0)), 0)
    ).toFixed(2))

    const netCashFlow = Number((cashInflow - periodExpenses - totalRefunds).toFixed(2))

    return {
      totalRevenue,
      totalCollected,
      billCount: filteredBills.length,
      pendingAmount,
      unpaidCount: unpaidBills.length,
      advancePool: allTimeAdvancePool,
      cashInflow,
      cashTotal: Number(cashTotal.toFixed(2)),
      upiTotal: Number(upiTotal.toFixed(2)),
      periodExpenses: Number(periodExpenses.toFixed(2)),
      totalRefunds,
      netCashFlow,
    }
  }, [filteredBills, reconciledBills, allTimeReconciledBills, allTimePendingAmount, allTimeAdvancePool, payments, advancePayments, expenses, activeDateRange])

  // Handle Add Customer Form
  const handleAddCustomerSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!newCustName.trim()) {
      showToast('Please enter customer name', 'error')
      return
    }

    try {
      const payload = {
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        email: newCustEmail.trim(),
        type: newCustType,
        credit_balance: 0,
        creditBalance: 0
      }
      await createCustomerMutation(payload)
      showToast(`Customer '${payload.name}' added successfully!`, 'success')
      setNewCustName('')
      setNewCustPhone('')
      setNewCustEmail('')
      setShowAddCustomerModal(false)
    } catch (err) {
      showToast(err.message || 'Failed to add customer', 'error')
    }
  }, [newCustName, newCustPhone, newCustEmail, newCustType, createCustomerMutation, showToast])

  // Financial CSV Export Trigger
  const handleExportCSV = useCallback(() => {
    const headers = ['Invoice #', 'Date', 'Customer', 'Total (INR)', 'Balance (INR)', 'Status']
    const rows = filteredBills.map(b => [
      `"${b.invoiceNumber || b.invoice_number || b.id}"`,
      `"${b.date}"`,
      `"${b.customerName || b.customer_name || 'Walk-in'}"`,
      Number(b.total || 0).toFixed(2),
      Number(b.balance || 0).toFixed(2),
      `"${b.status}"`
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `PrintPro_Mobile_Financial_${filterPeriod}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Financial CSV Report Downloaded!', 'success')
  }, [filteredBills, filterPeriod, showToast])

  return (
    <MobileLayout
      title="PrintPro Mobile Command"
    >
      {/* Top Banner Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-secondary)', letterSpacing: '0.08em' }}>
              STORE COMMAND CENTER
            </div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '0.65rem',
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 6px #10b981'
              }} />
              LIVE
            </span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
            {business?.shopName || 'PrintPro ERP'}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="mobile-icon-btn"
            onClick={handleExportCSV}
            title="Export CSV"
            style={{ width: '38px', height: '38px', minWidth: '38px', minHeight: '38px' }}
          >
            <Download size={18} />
          </button>
          <button
            className="mobile-icon-btn"
            onClick={handleSync}
            disabled={isSyncing}
            title="Sync Database"
            style={{ width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
          >
            <RefreshCw size={18} className={isSyncing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── PERMANENT UNFILTERED SUMMARY CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div className="mobile-card" style={{ padding: '12px', borderColor: 'rgba(0, 240, 255, 0.3)', background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' }}>TOTAL CLIENTS</span>
            <Users size={16} style={{ color: 'var(--accent-secondary)' }} />
          </div>
          <div className="currency-num" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff' }}>
            {allTimeTotalCustomers}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Permanent Directory
          </div>
        </div>

        <div className="mobile-card" style={{ padding: '12px', borderColor: 'rgba(255, 56, 96, 0.35)', background: 'linear-gradient(135deg, rgba(255, 56, 96, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--error)' }}>TOTAL DUE (ALL-TIME)</span>
            <CreditCard size={16} style={{ color: 'var(--error)' }} />
          </div>
          <div className="currency-num" style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--error)' }}>
            ₹{allTimePendingAmount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Net: ₹{allTimeNetDue.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Date Period Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
        {[
          { id: 'today', label: 'Today' },
          { id: 'week', label: 'This Week' },
          { id: 'month', label: 'This Month' },
          { id: 'fy', label: 'FY Period' },
          { id: 'custom', label: 'Custom Range' },
          { id: 'all', label: 'All Time' },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setFilterPeriod(p.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: filterPeriod === p.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: filterPeriod === p.id ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
              color: filterPeriod === p.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              boxShadow: filterPeriod === p.id ? '0 0 8px rgba(255, 47, 176, 0.3)' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* FY Year Selector Dropdown */}
      {filterPeriod === 'fy' && (
        <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>FY YEAR:</label>
          <select
            className="mobile-input"
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <option value="2025">FY 2025-26</option>
            <option value="2024">FY 2024-25</option>
            <option value="2023">FY 2023-24</option>
          </select>
        </div>
      )}

      {/* Custom Date Range Pickers */}
      {filterPeriod === 'custom' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>START DATE</label>
            <input
              type="date"
              className="mobile-input"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>END DATE</label>
            <input
              type="date"
              className="mobile-input"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Metrics Horizontal Scroll Tray */}
      <MetricsRow stats={stats} />

      {/* 1-Click Quick Actions Command Grid (2x2) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        <button
          className="mobile-btn mobile-btn-primary"
          onClick={() => navigate('/create-bill')}
          style={{ minHeight: '48px', fontSize: '0.82rem' }}
        >
          <PlusCircle size={18} /> + QUICK BILL
        </button>
        <button
          className="mobile-btn mobile-btn-secondary"
          onClick={() => setShowAddCustomerModal(true)}
          style={{ minHeight: '48px', fontSize: '0.82rem' }}
        >
          <UserPlus size={18} /> + CUSTOMER
        </button>
        <button
          className="mobile-btn mobile-btn-secondary"
          onClick={() => setShowRecordPaymentModal(true)}
          style={{ minHeight: '48px', fontSize: '0.82rem', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#3b82f6' }}
        >
          <Receipt size={18} /> + PAYMENT
        </button>
        <button
          className="mobile-btn mobile-btn-secondary"
          onClick={() => navigate('/accounting')}
          style={{ minHeight: '48px', fontSize: '0.82rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
        >
          <DollarSign size={18} /> + EXPENSE
        </button>
      </div>

      {/* Top Debtors & Customer Balances Section */}
      {topDebtors.length > 0 && (
        <div className="mobile-card" style={{ marginBottom: '20px', borderColor: 'rgba(255, 56, 96, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                OUTSTANDING CUSTOMER DUES
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Top debtors (all-time cumulative)</span>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => navigate('/customers')}
              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
            >
              All <ChevronRight size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topDebtors.map((d, idx) => (
              <div
                key={d.customerId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{idx + 1}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.customerName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>
                      {d.customerCode}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      • {d.billCount} bill{d.billCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--error)' }}>
                      ₹{d.netDue.toFixed(2)}
                    </div>
                    {d.advanceBalance > 0 && (
                      <div style={{ fontSize: '0.66rem', color: 'var(--success)' }}>
                        Adv: ₹{d.advanceBalance.toFixed(2)}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setPaymentCustomerId(d.customerId)
                        setPaymentAmount(String(d.netDue > 0 ? d.netDue : d.grossDue))
                        setShowRecordPaymentModal(true)
                      }}
                      style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                      title="Record Payment"
                    >
                      Pay
                    </button>
                    {d.phone && (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          const shop = business?.shopName || 'PrintPro Studio'
                          const msg = `Hello ${d.customerName},\n\nPayment reminder from *${shop}* regarding pending balance ₹${d.netDue.toFixed(2)} (Ref: ${d.customerCode}). Kindly settle soon. Thanks!`
                          window.open(ReminderService.getWhatsAppUrl(d.phone, msg), '_blank')
                        }}
                        style={{ padding: '4px 6px', color: '#25D366' }}
                        title="Send WhatsApp Reminder"
                      >
                        <MessageSquare size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Navigation Grid (2x3) */}
      <div className="mobile-card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
          QUICK NAVIGATION
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: 'View Bills', path: '/billing', icon: Receipt, color: 'var(--accent-primary)' },
            { label: 'Customers', path: '/customers', icon: Users, color: 'var(--accent-secondary)' },
            { label: 'Accounting', path: '/accounting', icon: Wallet, color: 'var(--success)' },
            { label: 'Analytics', path: '/accounting?tab=analytics', icon: BarChart3, color: 'var(--accent-tertiary)' },
            { label: 'Inventory', path: '/inventory', icon: Inbox, color: '#ffb800' },
            {
              label: 'Search',
              action: () => window.dispatchEvent(new CustomEvent('open-command-palette')),
              icon: Search,
              color: 'var(--info)'
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                onClick={() => item.action ? item.action() : navigate(item.path)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 6px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  gap: '6px',
                  transition: 'var(--transition)'
                }}
              >
                <Icon size={20} style={{ color: item.color }} />
                <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Add Customer Modal Drawer */}
      <BottomSheet
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        title="Add New Customer"
      >
        <form onSubmit={handleAddCustomerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              CUSTOMER TYPE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`mobile-btn ${newCustType === 'regular' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setNewCustType('regular')}
                style={{ minHeight: '38px', fontSize: '0.82rem' }}
              >
                Regular Client
              </button>
              <button
                type="button"
                className={`mobile-btn ${newCustType === 'random' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setNewCustType('random')}
                style={{ minHeight: '38px', fontSize: '0.82rem' }}
              >
                Walk-in Client
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              FULL NAME / BUSINESS
            </label>
            <input
              type="text"
              className="mobile-input"
              placeholder="e.g. Cyberdyne Systems"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              PHONE NUMBER
            </label>
            <input
              type="tel"
              className="mobile-input"
              placeholder="+91 9876543210"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              EMAIL ADDRESS
            </label>
            <input
              type="email"
              className="mobile-input"
              placeholder="client@cyberdyne.io"
              value={newCustEmail}
              onChange={(e) => setNewCustEmail(e.target.value)}
            />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '8px' }} disabled={isCreatingCustomer}>
            {isCreatingCustomer ? 'Saving Customer...' : 'Save Customer Record'}
          </button>
        </form>
      </BottomSheet>

      {/* Quick Record Payment Modal Drawer */}
      <BottomSheet
        isOpen={showRecordPaymentModal}
        onClose={() => {
          setShowRecordPaymentModal(false)
          setPaymentCustomerId('')
          setPaymentCustomerSearch('')
          setPaymentAmount('')
          setPaymentNotes('')
        }}
        title="Record Customer Payment"
      >
        <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* 1. SELECT CUSTOMER SECTION */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} color="var(--aurora-cyan, #00f0ff)" />
                SELECT CUSTOMER / CLIENT
              </label>
              {paymentCustomerId && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentCustomerId('')
                    setPaymentCustomerSearch('')
                    setPaymentAmount('')
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--aurora-cyan, #00f0ff)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                  }}
                >
                  <RefreshCw size={11} /> Change Client
                </button>
              )}
            </div>

            {/* If Customer NOT Selected: Render Searchable List */}
            {!paymentCustomerId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search client by name, phone or code..."
                    value={paymentCustomerSearch}
                    onChange={(e) => setPaymentCustomerSearch(e.target.value)}
                    className="mobile-input"
                    style={{ paddingLeft: '32px', paddingRight: paymentCustomerSearch ? '30px' : '10px', fontSize: '0.78rem', minHeight: '34px' }}
                    autoFocus
                  />
                  {paymentCustomerSearch && (
                    <button
                      type="button"
                      onClick={() => setPaymentCustomerSearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
                  {[
                    { key: 'all', label: `All (${customers.length})` },
                    { key: 'due', label: `With Dues (${customers.filter(c => (getCustomerFinancials(c.id)?.netDue || 0) > 0).length})` },
                    { key: 'regular', label: 'Regular' },
                    { key: 'walkin', label: 'Walk-in' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setPaymentCustomerFilter(tab.key as 'all' | 'due' | 'regular' | 'walkin')}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68rem',
                        fontWeight: paymentCustomerFilter === tab.key ? 700 : 500,
                        background: paymentCustomerFilter === tab.key ? 'var(--aurora-cyan, #00f0ff)' : 'var(--bg-card)',
                        color: paymentCustomerFilter === tab.key ? '#000000' : 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Scrollable Customer List */}
                <div style={{
                  maxHeight: '210px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px',
                  background: 'rgba(10, 10, 26, 0.6)',
                }}>
                  {paymentModalFilteredCustomers.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      No customers found matching &quot;{paymentCustomerSearch}&quot;
                    </div>
                  ) : (
                    paymentModalFilteredCustomers.map((c) => {
                      const initials = (c.name || 'C').slice(0, 2).toUpperCase()
                      const hasDue = c.due > 0
                      const hasAdv = c.adv > 0

                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setPaymentCustomerId(c.id)
                            setPaymentCustomerSearch('')
                            if (c.due > 0) {
                              setPaymentAmount(c.due.toString())
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: hasDue ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-card)',
                            border: `1px solid ${hasDue ? 'rgba(239, 68, 68, 0.25)' : 'var(--border)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            {/* Avatar */}
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: hasDue ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.3))' : 'linear-gradient(135deg, rgba(0,240,255,0.15), rgba(147,51,234,0.2))',
                              border: `1px solid ${hasDue ? 'rgba(239,68,68,0.4)' : 'rgba(0,240,255,0.3)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: hasDue ? '#ef4444' : '#00f0ff',
                              flexShrink: 0,
                            }}>
                              {initials}
                            </div>

                            {/* Info */}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {c.name}
                                </span>
                                <span style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 4px',
                                  borderRadius: '4px',
                                  background: c.type === 'regular' ? 'rgba(0,240,255,0.1)' : 'rgba(245,158,11,0.15)',
                                  color: c.type === 'regular' ? '#00f0ff' : '#fbbf24',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                }}>
                                  {c.displayCode}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                {c.phone || 'No mobile'}
                              </div>
                            </div>
                          </div>

                          {/* Dues / Advance Badge */}
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                            {hasDue ? (
                              <div style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                              }}>
                                Due: ₹{c.due.toLocaleString('en-IN')}
                              </div>
                            ) : hasAdv ? (
                              <div style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                              }}>
                                Adv: ₹{c.adv.toLocaleString('en-IN')}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                ₹0 Due
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Selected Customer Profile View */
              <div style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: selectedCustomerDue > 0
                  ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(16,13,35,0.9))'
                  : 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,13,35,0.9))',
                border: `1px solid ${selectedCustomerDue > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: selectedCustomerDue > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                      border: `1px solid ${selectedCustomerDue > 0 ? '#ef4444' : '#10b981'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      color: selectedCustomerDue > 0 ? '#ef4444' : '#10b981',
                    }}>
                      {(selectedCustomerObj?.name || 'C').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#ffffff' }}>
                          {selectedCustomerObj?.name}
                        </strong>
                        <span style={{
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: 'rgba(0,240,255,0.15)',
                          color: '#00f0ff',
                          fontFamily: 'monospace',
                          fontWeight: 700
                        }}>
                          {selectedCustomerObj?.customerCode || SequenceService.formatDisplayCode(selectedCustomerObj?.id, 'CUS')}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {selectedCustomerObj?.phone || 'No phone'} • {selectedCustomerObj?.type === 'regular' ? 'Regular Client' : 'Walk-in'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
                      Total Outstanding
                    </span>
                    <span style={{
                      fontSize: '1.15rem',
                      fontWeight: 900,
                      color: selectedCustomerDue > 0 ? '#ef4444' : '#10b981'
                    }}>
                      ₹{selectedCustomerDue.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Quick Settle Presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {selectedCustomerDue > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(selectedCustomerDue.toString())}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid #ef4444',
                        color: '#fca5a5',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Sparkles size={12} /> Pay Full Due (₹{selectedCustomerDue.toLocaleString('en-IN')})
                    </button>
                  )}
                  {[100, 500, 1000, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPaymentAmount(amt.toString())}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. AMOUNT RECEIVED INPUT */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.04em' }}>
              AMOUNT RECEIVED (₹) *
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '1.2rem',
                fontWeight: 800,
                color: 'var(--aurora-cyan, #00f0ff)'
              }}>
                ₹
              </span>
              <input
                type="number"
                className="mobile-input"
                placeholder="0.00"
                step="any"
                min="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
                style={{
                  paddingLeft: '32px',
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: '#ffffff',
                  minHeight: '44px',
                  background: 'rgba(10, 10, 26, 0.8)',
                  borderColor: paymentAmount ? 'var(--aurora-cyan, #00f0ff)' : 'var(--border)',
                  boxShadow: paymentAmount ? '0 0 10px rgba(0,240,255,0.15)' : 'none'
                }}
              />
            </div>

            {/* Real-time Settlement Guidance */}
            {paymentCustomerId && Number(paymentAmount) > 0 && (
              <div style={{ marginTop: '6px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {Number(paymentAmount) === selectedCustomerDue ? (
                  <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={13} /> Exact settlement: All outstanding invoices will be fully cleared!
                  </span>
                ) : Number(paymentAmount) < selectedCustomerDue ? (
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                    • Partial settlement: ₹{(selectedCustomerDue - Number(paymentAmount)).toFixed(2)} will remain due.
                  </span>
                ) : (
                  <span style={{ color: '#00f0ff', fontWeight: 600 }}>
                    • Overpayment: ₹{(Number(paymentAmount) - selectedCustomerDue).toFixed(2)} will be credited to Advance pool.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 3. PAYMENT MODE SELECTOR */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.04em' }}>
              PAYMENT MODE *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { key: 'cash', label: 'Cash', icon: Banknote, activeColor: '#10b981' },
                { key: 'upi', label: 'UPI / QR', icon: Smartphone, activeColor: '#00f0ff' },
                { key: 'split', label: 'Split (Cash+UPI)', icon: Layers, activeColor: '#a855f7' },
              ].map((m) => {
                const IconComponent = m.icon
                const isActive = paymentMode === m.key
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPaymentMode(m.key)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'rgba(30, 27, 75, 0.8)' : 'var(--bg-card)',
                      border: `1.5px solid ${isActive ? m.activeColor : 'var(--border)'}`,
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      boxShadow: isActive ? `0 0 12px ${m.activeColor}33` : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <IconComponent size={18} color={isActive ? m.activeColor : 'var(--text-muted)'} />
                    <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 800 : 600 }}>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Split Mode Breakdown */}
          {paymentMode === 'split' && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#10b981', marginBottom: '3px' }}>
                    Cash Portion (₹)
                  </label>
                  <input
                    type="number"
                    className="mobile-input"
                    placeholder="0.00"
                    step="any"
                    value={paymentCash}
                    onChange={(e) => {
                      const val = e.target.value
                      setPaymentCash(val)
                      const cVal = parseFloat(val) || 0
                      const tot = parseFloat(paymentAmount) || 0
                      if (tot > cVal) {
                        setPaymentUpi((tot - cVal).toFixed(2))
                      }
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#00f0ff', marginBottom: '3px' }}>
                    UPI Portion (₹)
                  </label>
                  <input
                    type="number"
                    className="mobile-input"
                    placeholder="0.00"
                    step="any"
                    value={paymentUpi}
                    onChange={(e) => {
                      const val = e.target.value
                      setPaymentUpi(val)
                      const uVal = parseFloat(val) || 0
                      const tot = parseFloat(paymentAmount) || 0
                      if (tot > uVal) {
                        setPaymentCash((tot - uVal).toFixed(2))
                      }
                    }}
                  />
                </div>
              </div>

              {/* Split Balance helper */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Sum: ₹{((parseFloat(paymentCash) || 0) + (parseFloat(paymentUpi) || 0)).toFixed(2)} of ₹{parseFloat(paymentAmount) || 0}
                </span>
                {Math.abs(((parseFloat(paymentCash) || 0) + (parseFloat(paymentUpi) || 0)) - (parseFloat(paymentAmount) || 0)) < 0.01 ? (
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Balanced</span>
                ) : (
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠ Diff: ₹{Math.abs((parseFloat(paymentAmount) || 0) - ((parseFloat(paymentCash) || 0) + (parseFloat(paymentUpi) || 0))).toFixed(2)}</span>
                )}
              </div>
            </div>
          )}

          {/* 4. REMARKS / REFERENCE */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.04em' }}>
              REMARKS / PAYMENT REFERENCE (OPTIONAL)
            </label>
            <input
              type="text"
              className="mobile-input"
              placeholder="e.g. GPay / Counter cash settlement / UTR Ref..."
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              style={{ fontSize: '0.78rem' }}
            />
            {/* Quick Reference Chips */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
              {['GPay', 'PhonePe', 'Paytm', 'Cash Counter', 'Bank Transfer'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setPaymentNotes(paymentNotes ? `${paymentNotes}, ${tag}` : tag)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          {/* 5. FIFO SETTLEMENT NOTICE */}
          <div style={{
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'rgba(0, 240, 255, 0.05)',
            border: '1px solid rgba(0, 240, 255, 0.15)',
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <Coins size={13} color="var(--aurora-cyan, #00f0ff)" />
            <span>Automatic FIFO Allocation: Payments settle oldest pending bills first; surplus is added to advance balance.</span>
          </div>

          {/* 6. SUBMIT BUTTON */}
          <button
            type="submit"
            className="mobile-btn mobile-btn-primary"
            style={{
              marginTop: '4px',
              minHeight: '46px',
              fontSize: '0.88rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, var(--aurora-cyan, #00f0ff), #3b82f6)',
              color: '#000000',
              boxShadow: '0 4px 15px rgba(0, 240, 255, 0.3)',
            }}
            disabled={isSubmittingPayment}
          >
            {isSubmittingPayment ? 'Recording...' : `✓ Record ${paymentAmount ? `₹${parseFloat(paymentAmount).toFixed(2)}` : 'Payment'} & Auto-Settle (FIFO)`}
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
