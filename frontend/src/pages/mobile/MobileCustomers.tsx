import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { usePayments, usePaymentMutations, useAdvancePayments, useAdvancePaymentMutations } from '../../hooks/useEntitiesQuery'
import { useUnifiedFinancialHub } from '../../hooks/useUnifiedFinancialHub'
import { ReminderService } from '../../services/reminderService'
import { LedgerService } from '../../services/ledgerService'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import VirtualList from '../../components/mobile/VirtualList'
import SkeletonCustomerRow from '../../components/mobile/SkeletonCustomerRow'
import CustomerStatementModal from '../../components/customers/CustomerStatementModal'
import { SequenceService } from '../../services/sequenceService'
import {
  Users, Search, Plus, ChevronRight, Edit3, Trash2, Loader2, AlertCircle,
  Wallet, FileText, BookOpen, MessageSquare, CheckCircle, ArrowRight, X
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileCustomers() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { business, settings, showToast, bills: contextBills = [], payments: contextPayments = [] } = useAppContext()
  const { getCustomerFinancials } = useUnifiedFinancialHub()

  // Queries & Mutations
  const { data: serverCustomers = [], isLoading: isLoadingCustomers, isError, error } = useCustomers()
  const { data: serverBills, isSuccess: isBillsLoaded } = useBills()
  const { data: serverPayments, isSuccess: isPaymentsLoaded } = usePayments()
  const { data: serverAdvancePayments = [] } = useAdvancePayments()

  const { createCustomer, updateCustomer, deleteCustomer, isCreating, isUpdating } = useCustomerMutations()
  const { updateBill } = useBillMutations()
  const { createPayment } = usePaymentMutations()
  const { addAdvancePayment } = useAdvancePaymentMutations()

  const customers = Array.isArray(serverCustomers) ? serverCustomers : []
  const bills = Array.isArray(isBillsLoaded && serverBills ? serverBills : contextBills) ? (isBillsLoaded && serverBills ? serverBills : contextBills) : []
  const payments = Array.isArray(isPaymentsLoaded && serverPayments ? serverPayments : contextPayments) ? (isPaymentsLoaded && serverPayments ? serverPayments : contextPayments) : []
  const advancePayments = Array.isArray(serverAdvancePayments) ? serverAdvancePayments : []

  // Customer ID & Tab from search params
  const paramCustomerId = searchParams.get('customerId')
  const paramTab = searchParams.get('tab') || 'overview'

  const [selectedCustomerId, setSelectedCustomerId] = useState(paramCustomerId)
  const [activeTab, setActiveTab] = useState(paramTab)
  const [isDetailOpen, setIsDetailOpen] = useState(!!paramCustomerId)
  const [showStatementModal, setShowStatementModal] = useState(false)

  useEffect(() => {
    if (paramCustomerId) {
      setSelectedCustomerId(paramCustomerId)
      setIsDetailOpen(true)
    }
    if (paramTab) {
      setActiveTab(paramTab)
    }
  }, [paramCustomerId, paramTab])

  // Directory filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all')

  // Add/Edit Customer modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState('regular')
  const [creditLimit, setCreditLimit] = useState('')

  // Settle form state inside selected customer
  const [payCash, setPayCash] = useState('')
  const [payUpi, setPayUpi] = useState('')
  const [payAdvance, setPayAdvance] = useState('')
  const [isSettleLoading, setIsSettleLoading] = useState(false)

  // Deposit/Return advance state inside selected customer
  const [advAmount, setAdvAmount] = useState('')
  const [advMethod, setAdvMethod] = useState('cash')
  const [advAction, setAdvAction] = useState('deposit')
  const [autoApplyDues, setAutoApplyDues] = useState(true)
  const [isAdvSubmitting, setIsAdvSubmitting] = useState(false)

  // Ledger period state
  const [ledgerPeriod, setLedgerPeriod] = useState('all')

  // Selected customer object & metrics - supports both sequential code and UUID
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    const target = String(selectedCustomerId).trim().toLowerCase()
    return customers.find((c) => c && (
      String(c.id).toLowerCase() === target ||
      String(c.customerCode || '').toLowerCase() === target
    )) || null
  }, [customers, selectedCustomerId])

  const selectedCustomerBills = useMemo(() => {
    if (!selectedCustomer) return []
    const strId = String(selectedCustomer.id)
    return bills
      .filter((b) => !b.deleted && !b.deleted_at && String(b.customerId || b.customer_id) === strId)
      .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
  }, [bills, selectedCustomer])

  const selectedCustomerOutstanding = useMemo(() => {
    return selectedCustomerBills.reduce((sum, b) => sum + Number(b.balance || 0), 0)
  }, [selectedCustomerBills])

  const selectedCustomerAdvance = useMemo(() => {
    if (!selectedCustomer) return 0
    const fin = getCustomerFinancials(selectedCustomer.id)
    if (fin?.advanceBalance !== undefined) return Number(fin.advanceBalance || 0)
    return Number(
      selectedCustomer.advanceBalance ||
      selectedCustomer.advance_balance ||
      selectedCustomer.creditBalance ||
      selectedCustomer.credit_balance ||
      0
    )
  }, [selectedCustomer, getCustomerFinancials])

  // Ledger calculations for mobile
  const ledgerEntries = useMemo(() => {
    if (!selectedCustomer?.id) return []
    try {
      const res = LedgerService.calculateLedger({
        customerId: selectedCustomer.id,
        bills,
        payments,
        advancePayments,
        period: ledgerPeriod,
        settings,
      })
      return res.entries || []
    } catch {
      return []
    }
  }, [selectedCustomer?.id, bills, payments, advancePayments, ledgerPeriod, settings])

  // Customer advances history (inclusive of deposits, returns, bill advance deductions, and knockoffs)
  const customerAdvances = useMemo(() => {
    if (!selectedCustomer?.id) return []
    const strId = String(selectedCustomer.id)
    const code = selectedCustomer.customerCode ? String(selectedCustomer.customerCode).toLowerCase() : ''

    const list = []

    // 1. Deposits & Returns from advance_payments table
    advancePayments.forEach((ap) => {
      const apCustId = String(ap.customerId || ap.customer_id || '')
      if (apCustId === strId || (code && String(ap.customerCode || '').toLowerCase() === code)) {
        const isRet = Boolean(ap.isReturn || ap.type === 'return' || Number(ap.amount || 0) < 0)
        const amt = Math.abs(Number(ap.amount || 0))
        if (amt > 0) {
          list.push({
            id: `adv-pmt-${ap.id}`,
            type: isRet ? 'return' : 'deposit',
            amount: isRet ? -amt : amt,
            date: ap.date || ap.created_at || new Date().toISOString(),
            title: isRet ? 'Advance Refund / Return' : 'Advance Deposit',
            description: ap.notes || (ap.paymentMethod ? `Method: ${String(ap.paymentMethod).toUpperCase()}` : 'Advance Wallet'),
            badge: isRet ? 'RETURN' : 'DEPOSIT',
            badgeColor: isRet ? 'var(--aurora-pink, #ff2fb0)' : '#10b981',
          })
        }
      }
    })

    // 2. Advance used directly on bills
    selectedCustomerBills.forEach((b) => {
      const advUsed = Number(b.advanceUsed || b.advance_used || b.advanceDeducted || b.advance_deducted || 0)
      if (advUsed > 0) {
        const billNo = b.billNumber || b.bill_number || b.invoiceNumber || SequenceService.formatDisplayCode('bill', b, 'BILL')
        list.push({
          id: `bill-adv-${b.id}`,
          type: 'bill_usage',
          amount: -advUsed,
          date: b.date || b.created_at || new Date().toISOString(),
          title: `Used on Bill #${billNo}`,
          description: `Bill Total: ₹${Number(b.total || 0).toFixed(2)} • Due: ₹${Number(b.balance || 0).toFixed(2)}`,
          badge: 'BILL USAGE',
          badgeColor: 'var(--aurora-amber, #f59e0b)',
        })
      }
    })

    // 3. Multi-method payments / Advance settlements
    payments.forEach((p) => {
      const pCustId = String(p.customerId || p.customer_id || '')
      if (pCustId === strId || (code && String(p.customerCode || '').toLowerCase() === code)) {
        const advMethod = String(p.payment_method || p.paymentType || p.method || '').toLowerCase() === 'advance'
        const advAmt = Number(p.advance_amount || p.advanceAmount || (advMethod ? p.total_paid || p.amount || 0 : 0))
        const isKnockoff = p.notes && p.notes.includes('Knockoff using Advance Wallet')
        if (advAmt > 0 && isKnockoff) {
          list.push({
            id: `pmt-adv-${p.id}`,
            type: 'settlement',
            amount: -advAmt,
            date: p.date || p.created_at || new Date().toISOString(),
            title: 'Applied to Dues (Knockoff)',
            description: p.notes || 'Settlement via Advance Wallet',
            badge: 'KNOCKOFF',
            badgeColor: 'var(--aurora-amber, #f59e0b)',
          })
        }
      }
    })

    return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
  }, [selectedCustomer, advancePayments, selectedCustomerBills, payments])

  const advanceMetrics = useMemo(() => {
    let totalDeposited = 0
    let totalUsed = 0
    let totalReturned = 0

    customerAdvances.forEach((item) => {
      if (item.type === 'deposit') {
        totalDeposited += item.amount
      } else if (item.type === 'bill_usage' || item.type === 'settlement') {
        totalUsed += Math.abs(item.amount)
      } else if (item.type === 'return') {
        totalReturned += Math.abs(item.amount)
      }
    })

    const netFromHistory = Math.max(0, Number((totalDeposited - totalUsed - totalReturned).toFixed(2)))
    const available = selectedCustomerAdvance !== undefined && customerAdvances.length > 0
      ? Math.min(selectedCustomerAdvance, netFromHistory)
      : (selectedCustomerAdvance || netFromHistory)

    return {
      totalDeposited,
      totalUsed,
      totalReturned,
      availableBalance: available,
    }
  }, [customerAdvances, selectedCustomerAdvance])

  const openCustomerDetail = (cust, tab = 'overview') => {
    const targetKey = cust.customerCode || String(cust.id)
    setSelectedCustomerId(targetKey)
    setActiveTab(tab)
    setIsDetailOpen(true)
    setSearchParams({ customerId: targetKey, tab })
  }

  const closeCustomerDetail = () => {
    setIsDetailOpen(false)
    setSelectedCustomerId(null)
    setSearchParams({})
  }

  // 1-Click Quick Advance Knockoff
  const handleQuickAdvanceKnockoff = async () => {
    if (!selectedCustomer) return
    const toKnockoff = Math.min(selectedCustomerAdvance, selectedCustomerOutstanding)
    if (toKnockoff <= 0) return

    setIsSettleLoading(true)
    try {
      const unpaidBills = selectedCustomerBills
        .filter((b) => Number(b.balance || 0) > 0)
        .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

      let remaining = toKnockoff
      for (const b of unpaidBills) {
        if (remaining <= 0) break
        const toPay = Math.min(remaining, Number(b.balance || 0))
        const newBal = Number(Math.max(0, Number(b.balance || 0) - toPay).toFixed(2))
        const currentPaid = Number(b.amountPaid !== undefined ? b.amountPaid : (b.amount_paid || b.paid_total || 0))
        const newPaid = Number((currentPaid + toPay).toFixed(2))
        const newStatus = newBal <= 0.001 ? 'paid' : 'partial'

        await updateBill({
          id: b.id,
          data: { balance: newBal, status: newStatus, amountPaid: newPaid, amount_paid: newPaid },
        })
        remaining = Number((remaining - toPay).toFixed(2))
      }

      const newCustomerAdv = Math.max(0, Number((selectedCustomerAdvance - toKnockoff).toFixed(2)))
      await updateCustomer({
        id: selectedCustomer.id,
        data: {
          advanceBalance: newCustomerAdv,
          advance_balance: newCustomerAdv,
          creditBalance: newCustomerAdv,
          credit_balance: newCustomerAdv,
        },
      })

      await createPayment({
        customer_id: selectedCustomer.id,
        cash_amount: 0,
        upi_amount: 0,
        total_paid: toKnockoff,
        payment_type: 'partial',
        notes: `Knockoff using Advance Wallet (₹${toKnockoff.toFixed(2)})`,
      })

      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      showToast(`Applied ₹${toKnockoff.toFixed(2)} from advance to pending dues!`, 'success')
    } catch (err) {
      showToast(err?.message || 'Failed to knock off dues', 'error')
    } finally {
      setIsSettleLoading(false)
    }
  }

  // Multi-method Bill Settlement
  const handleSettleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedCustomer) return
    const cash = Number(payCash || 0)
    const upi = Number(payUpi || 0)
    const adv = Number(payAdvance || 0)
    const total = cash + upi + adv

    if (total <= 0) {
      showToast('Enter an amount to settle', 'error')
      return
    }
    if (adv > selectedCustomerAdvance) {
      showToast(`Advance cannot exceed available ₹${selectedCustomerAdvance.toFixed(2)}`, 'error')
      return
    }

    setIsSettleLoading(true)
    try {
      const unpaidBills = selectedCustomerBills
        .filter((b) => Number(b.balance || 0) > 0)
        .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

      let remaining = total
      for (const b of unpaidBills) {
        if (remaining <= 0) break
        const toPay = Math.min(remaining, Number(b.balance || 0))
        const newBal = Number(Math.max(0, Number(b.balance || 0) - toPay).toFixed(2))
        const currentPaid = Number(b.amountPaid !== undefined ? b.amountPaid : (b.amount_paid || b.paid_total || 0))
        const newPaid = Number((currentPaid + toPay).toFixed(2))
        const newStatus = newBal <= 0.001 ? 'paid' : 'partial'

        await updateBill({
          id: b.id,
          data: { balance: newBal, status: newStatus, amountPaid: newPaid, amount_paid: newPaid },
        })
        remaining = Number((remaining - toPay).toFixed(2))
      }

      let newCustomerAdv = selectedCustomerAdvance
      if (adv > 0) newCustomerAdv = Math.max(0, Number((newCustomerAdv - adv).toFixed(2)))
      if (remaining > 0) newCustomerAdv = Number((newCustomerAdv + remaining).toFixed(2))

      if (newCustomerAdv !== selectedCustomerAdvance) {
        await updateCustomer({
          id: selectedCustomer.id,
          data: {
            advanceBalance: newCustomerAdv,
            advance_balance: newCustomerAdv,
            creditBalance: newCustomerAdv,
            credit_balance: newCustomerAdv,
          },
        })
      }

      await createPayment({
        customer_id: selectedCustomer.id,
        cash_amount: cash,
        upi_amount: upi,
        total_paid: total,
        payment_type: unpaidBills.length > 0 && remaining === 0 ? 'full' : 'partial',
        notes: `Mobile Settlement (Cash: ₹${cash}, UPI: ₹${upi}, Advance: ₹${adv})`,
      })

      setPayCash('')
      setPayUpi('')
      setPayAdvance('')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      showToast(`Settlement of ₹${total.toFixed(2)} recorded!`, 'success')
    } catch (err) {
      showToast(err?.message || 'Failed to settle bills', 'error')
    } finally {
      setIsSettleLoading(false)
    }
  }

  // Advance Deposit / Return
  const handleAdvanceSubmit = async (e) => {
    e.preventDefault()
    if (!selectedCustomer) return
    const amt = Number(advAmount || 0)
    if (amt <= 0) {
      showToast('Enter valid amount', 'error')
      return
    }

    setIsAdvSubmitting(true)
    try {
      if (advAction === 'deposit') {
        const cashAmt = advMethod === 'cash' ? amt : 0
        const upiAmt = advMethod === 'upi' ? amt : 0

        await addAdvancePayment({
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          amount: amt,
          cashAmount: cashAmt,
          upiAmount: upiAmt,
          paymentMethod: advMethod,
          date: new Date().toISOString().slice(0, 10),
          notes: 'Mobile Advance Deposit',
        })

        if (autoApplyDues && selectedCustomerOutstanding > 0) {
          const toKnockoff = Math.min(amt, selectedCustomerOutstanding)
          const surplus = Math.max(0, Number((amt - toKnockoff).toFixed(2)))

          const unpaidBills = selectedCustomerBills
            .filter((b) => Number(b.balance || 0) > 0)
            .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

          let remaining = toKnockoff
          for (const b of unpaidBills) {
            if (remaining <= 0) break
            const toPay = Math.min(remaining, Number(b.balance || 0))
            const newBal = Number(Math.max(0, Number(b.balance || 0) - toPay).toFixed(2))
            const currentPaid = Number(b.amountPaid !== undefined ? b.amountPaid : (b.amount_paid || b.paid_total || 0))
            const newPaid = Number((currentPaid + toPay).toFixed(2))
            const newStatus = newBal <= 0.001 ? 'paid' : 'partial'

            await updateBill({
              id: b.id,
              data: { balance: newBal, status: newStatus, amountPaid: newPaid, amount_paid: newPaid },
            })
            remaining = Number((remaining - toPay).toFixed(2))
          }

          const newAdv = Number((selectedCustomerAdvance + surplus).toFixed(2))
          await updateCustomer({
            id: selectedCustomer.id,
            data: { advanceBalance: newAdv, creditBalance: newAdv },
          })
          showToast(`₹${toKnockoff.toFixed(2)} applied to dues; ₹${surplus.toFixed(2)} added to advance!`, 'success')
        } else {
          const newAdv = Number((selectedCustomerAdvance + amt).toFixed(2))
          await updateCustomer({
            id: selectedCustomer.id,
            data: { advanceBalance: newAdv, creditBalance: newAdv },
          })
          showToast(`₹${amt.toFixed(2)} added to Advance Wallet!`, 'success')
        }
      } else {
        if (amt > selectedCustomerAdvance) {
          showToast(`Cannot return ₹${amt.toFixed(2)}. Balance is only ₹${selectedCustomerAdvance.toFixed(2)}`, 'error')
          return
        }

        await addAdvancePayment({
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          amount: -amt,
          isReturn: true,
          type: 'return',
          date: new Date().toISOString().slice(0, 10),
          notes: 'Mobile Advance Return',
        })

        const newAdv = Math.max(0, Number((selectedCustomerAdvance - amt).toFixed(2)))
        await updateCustomer({
          id: selectedCustomer.id,
          data: { advanceBalance: newAdv, creditBalance: newAdv },
        })
        showToast(`₹${amt.toFixed(2)} advance returned!`, 'success')
      }

      setAdvAmount('')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['advance-payments'] })
    } catch (err) {
      showToast(err?.message || 'Failed to process advance', 'error')
    } finally {
      setIsAdvSubmitting(false)
    }
  }

  // Filtered customers for list view
  const filteredCustomers = useMemo(() => {
    return (customers || []).filter((c) => {
      if (c.deleted) return false
      if (customerTypeFilter !== 'all' && c.type !== customerTypeFilter) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [customers, customerTypeFilter, searchTerm])

  return (
    <MobileLayout title="Customer Hub">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>UNIFIED CLIENT HUB</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>CUSTOMERS</h2>
        </div>
        <button
          className="mobile-btn mobile-btn-primary"
          onClick={() => {
            setEditMode(false)
            setEditingId(null)
            setName('')
            setPhone('')
            setEmail('')
            setType('regular')
            setCreditLimit('')
            setShowAddModal(true)
          }}
          disabled={isCreating}
          style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', minHeight: '38px' }}
        >
          <Plus size={16} /> + New Client
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
        <input
          type="text"
          className="mobile-input"
          style={{ paddingLeft: '42px' }}
          placeholder="Search name, phone, email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Type Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'all', label: 'All Clients' },
          { id: 'regular', label: 'Regular' },
          { id: 'random', label: 'Walk-in' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setCustomerTypeFilter(t.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: customerTypeFilter === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: customerTypeFilter === t.id ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
              color: customerTypeFilter === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Customer Cards List */}
      {isLoadingCustomers ? (
        <SkeletonCustomerRow count={6} />
      ) : filteredCustomers.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Users size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Customers Match Filter</h4>
        </div>
      ) : (
        <VirtualList
          items={filteredCustomers}
          estimateSize={85}
          renderItem={(customer) => {
            const fin = getCustomerFinancials(customer.id)
            const custBal = fin?.advanceBalance !== undefined
              ? Number(fin.advanceBalance || 0)
              : Number(customer.advanceBalance || customer.advance_balance || customer.creditBalance || customer.credit_balance || 0)
            return (
              <div
                key={customer.id}
                className="mobile-card"
                onClick={() => openCustomerDetail(customer, 'overview')}
                style={{ cursor: 'pointer', marginBottom: '10px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{customer.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--aurora-cyan, #00f0ff)', fontFamily: 'monospace' }}>
                        {customer.customerCode || SequenceService.formatDisplayCode('customer', customer, 'CUS')}
                      </span>
                      {customer.phone && <span>• {customer.phone}</span>}
                    </div>
                  </div>
                  <span className={`mobile-badge ${customer.type === 'regular' ? 'mobile-badge-info' : 'mobile-badge-warning'}`}>
                    {(customer.type || 'REGULAR').toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)', marginTop: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Advance: <strong style={{ color: custBal > 0 ? '#10b981' : 'inherit' }}>₹{custBal.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--aurora-cyan, #00f0ff)', fontWeight: 700 }}>
                    Customer 360° <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            )
          }}
        />
      )}

      {/* ── CUSTOMER 360° BOTTOMSHEET ── */}
      <BottomSheet
        isOpen={isDetailOpen && !!selectedCustomer}
        onClose={closeCustomerDetail}
        title={selectedCustomer?.name || 'Customer Details'}
      >
        {selectedCustomer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '75vh', overflowY: 'auto' }}>
            {/* Top Sub-Tab Navigation Bar */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'bills', label: `Bills (${selectedCustomerBills.length})` },
                { key: 'ledger', label: 'Ledger' },
                { key: 'advances', label: 'Advance' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    border: activeTab === tab.key ? '1px solid var(--aurora-cyan, #00f0ff)' : '1px solid var(--border)',
                    background: activeTab === tab.key ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: activeTab === tab.key ? 'var(--aurora-cyan, #00f0ff)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid var(--aurora-pink, #ff2fb0)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NET DUE</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--aurora-pink, #ff2fb0)' }}>
                      ₹{selectedCustomerOutstanding.toFixed(2)}
                    </div>
                  </div>
                  <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid #10b981' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ADVANCE WALLET</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                      ₹{selectedCustomerAdvance.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* 1-Click Advance Settlement */}
                {selectedCustomerAdvance > 0 && selectedCustomerOutstanding > 0 && (
                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: 600 }}>
                      Available advance: ₹{selectedCustomerAdvance.toFixed(2)}
                    </div>
                    <button
                      type="button"
                      className="mobile-btn mobile-btn-primary"
                      onClick={handleQuickAdvanceKnockoff}
                      disabled={isSettleLoading}
                      style={{ marginTop: '8px', minHeight: '34px', fontSize: '0.78rem', backgroundColor: '#10b981' }}
                    >
                      {isSettleLoading ? 'Applying...' : `Apply ₹${Math.min(selectedCustomerAdvance, selectedCustomerOutstanding).toFixed(2)} to Dues`}
                    </button>
                  </div>
                )}

                {/* Settle Form */}
                {selectedCustomerOutstanding > 0 && (
                  <form onSubmit={handleSettleSubmit} className="mobile-card" style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>Settle Bills</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <input
                        type="number"
                        className="mobile-input"
                        placeholder="Cash ₹"
                        value={payCash}
                        onChange={(e) => setPayCash(e.target.value)}
                      />
                      <input
                        type="number"
                        className="mobile-input"
                        placeholder="UPI ₹"
                        value={payUpi}
                        onChange={(e) => setPayUpi(e.target.value)}
                      />
                      <input
                        type="number"
                        className="mobile-input"
                        placeholder={selectedCustomerAdvance > 0 ? `Adv (Max ${selectedCustomerAdvance.toFixed(0)})` : 'No Adv'}
                        disabled={selectedCustomerAdvance <= 0}
                        value={payAdvance}
                        onChange={(e) => setPayAdvance(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      className="mobile-btn mobile-btn-primary"
                      disabled={isSettleLoading}
                      style={{ minHeight: '36px', fontSize: '0.82rem' }}
                    >
                      {isSettleLoading ? 'Saving...' : 'Confirm Settle'}
                    </button>
                  </form>
                )}

                {/* WhatsApp Reminder */}
                {selectedCustomer.phone && selectedCustomerOutstanding > 0 && (
                  <button
                    type="button"
                    className="mobile-btn mobile-btn-secondary"
                    onClick={() => {
                      const text = ReminderService.buildLedgerReminderMessage(selectedCustomer, selectedCustomerOutstanding, business, settings)
                      window.open(ReminderService.getWhatsAppUrl(selectedCustomer.phone, text), '_blank')
                    }}
                    style={{ color: '#25D366' }}
                  >
                    <MessageSquare size={16} /> Send WhatsApp Reminder
                  </button>
                )}
              </div>
            )}

            {/* TAB 2: BILLS */}
            {activeTab === 'bills' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedCustomerBills.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No bills found</div>
                ) : (
                  selectedCustomerBills.map((b) => {
                    const isPaid = Number(b.balance || 0) <= 0
                    return (
                      <div key={b.id} className="mobile-card" style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>#{b.invoiceNumber || b.id}</span>
                          <span className={`mobile-badge ${isPaid ? 'mobile-badge-info' : 'mobile-badge-warning'}`}>
                            {isPaid ? 'PAID' : `BAL: ₹${Number(b.balance || 0).toFixed(2)}`}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Total: ₹{Number(b.total || b.grand_total || 0).toFixed(2)} • {b.date ? b.date.slice(0, 10) : ''}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* TAB 3: LEDGER */}
            {activeTab === 'ledger' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['all', 'monthly', 'weekly'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setLedgerPeriod(p)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          textTransform: 'capitalize',
                          background: ledgerPeriod === p ? 'var(--aurora-cyan, #00f0ff)' : 'transparent',
                          color: ledgerPeriod === p ? '#000000' : 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStatementModal(true)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      background: 'rgba(0, 240, 255, 0.15)',
                      color: '#00f0ff',
                      border: '1px solid rgba(0, 240, 255, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <FileText size={12} /> Statement
                  </button>
                </div>

                {ledgerEntries.map((e, idx) => (
                  <div key={idx} className="mobile-card" style={{ padding: '8px 12px', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>{e.description}</span>
                      <strong style={{ color: Number(e.balance) > 0 ? 'var(--aurora-pink, #ff2fb0)' : '#10b981' }}>
                        ₹{Number(e.balance).toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                      {e.date ? e.date.slice(0, 10) : ''} • Debit: ₹{Number(e.debit || 0).toFixed(2)} • Credit: ₹{Number(e.credit || e.advanceIn || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 4: ADVANCE */}
            {activeTab === 'advances' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Advance Wallet Metrics Summary Card */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div className="mobile-card" style={{ padding: '10px 6px', borderLeft: '3px solid #10b981', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>AVAILABLE</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
                      ₹{advanceMetrics.availableBalance.toFixed(2)}
                    </div>
                  </div>
                  <div className="mobile-card" style={{ padding: '10px 6px', borderLeft: '3px solid var(--aurora-cyan, #00f0ff)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>DEPOSITED</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--aurora-cyan, #00f0ff)', marginTop: '2px' }}>
                      ₹{advanceMetrics.totalDeposited.toFixed(2)}
                    </div>
                  </div>
                  <div className="mobile-card" style={{ padding: '10px 6px', borderLeft: '3px solid var(--aurora-amber, #f59e0b)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>USED / RET</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--aurora-amber, #f59e0b)', marginTop: '2px' }}>
                      ₹{(advanceMetrics.totalUsed + advanceMetrics.totalReturned).toFixed(2)}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAdvanceSubmit} className="mobile-card" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <button
                      type="button"
                      className={`mobile-btn ${advAction === 'deposit' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                      onClick={() => setAdvAction('deposit')}
                      style={{ minHeight: '32px', fontSize: '0.75rem' }}
                    >
                      Deposit
                    </button>
                    <button
                      type="button"
                      className={`mobile-btn ${advAction === 'return' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                      onClick={() => setAdvAction('return')}
                      style={{ minHeight: '32px', fontSize: '0.75rem' }}
                    >
                      Return
                    </button>
                  </div>

                  <input
                    type="number"
                    className="mobile-input"
                    placeholder="Amount (₹)"
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                    style={{ marginBottom: '10px' }}
                  />

                  {advAction === 'deposit' && selectedCustomerOutstanding > 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', marginBottom: '10px' }}>
                      <input
                        type="checkbox"
                        checked={autoApplyDues}
                        onChange={(e) => setAutoApplyDues(e.target.checked)}
                      />
                      Auto-apply to pending dues (₹{selectedCustomerOutstanding.toFixed(2)}) first
                    </label>
                  )}

                  <button
                    type="submit"
                    className="mobile-btn mobile-btn-primary"
                    disabled={isAdvSubmitting}
                    style={{ minHeight: '36px', fontSize: '0.8rem' }}
                  >
                    {isAdvSubmitting ? 'Processing...' : advAction === 'deposit' ? 'Add Deposit' : 'Process Return'}
                  </button>
                </form>

                {/* Advances Audit Log Stream */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    ADVANCE AUDIT LOG ({customerAdvances.length})
                  </div>
                  {customerAdvances.length === 0 ? (
                    <div className="mobile-card" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      No advance deposits, deductions, or returns recorded yet.
                    </div>
                  ) : (
                    customerAdvances.map((adv) => (
                      <div key={adv.id} className="mobile-card" style={{ padding: '10px 12px', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                              {adv.title}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {adv.date ? String(adv.date).slice(0, 10) : ''} • {adv.description}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ fontSize: '0.88rem', color: adv.badgeColor }}>
                              {adv.amount > 0 ? '+' : ''}₹{Math.abs(adv.amount).toFixed(2)}
                            </strong>
                            <div style={{ marginTop: '2px' }}>
                              <span
                                className="mobile-badge"
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 5px',
                                  backgroundColor: 'rgba(255,255,255,0.06)',
                                  color: adv.badgeColor,
                                  border: `1px solid ${adv.badgeColor}40`,
                                }}
                              >
                                {adv.badge}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Add / Edit Customer Bottom Sheet */}
      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Customer">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!name.trim()) {
              showToast('Customer name is required', 'error')
              return
            }
            try {
              await createCustomer({ name: name.trim(), phone: phone.trim(), email: email.trim(), type, credit_limit: Number(creditLimit || 0) })
              showToast('Customer created!', 'success')
              setShowAddModal(false)
            } catch (err) {
              showToast(err.message, 'error')
            }
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <input
            type="text"
            className="mobile-input"
            placeholder="Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="tel"
            className="mobile-input"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            type="email"
            className="mobile-input"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isCreating}>
            {isCreating ? 'Saving...' : 'Save Customer'}
          </button>
        </form>
      </BottomSheet>

      {/* Customer Statement Modal (Bottom Sheet on Mobile) */}
      <CustomerStatementModal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        customerId={selectedCustomer?.id}
        customers={selectedCustomer ? [selectedCustomer] : []}
        bills={bills}
        payments={payments}
        advancePayments={advancePayments}
        business={business}
        settings={settings}
      />
    </MobileLayout>
  )
}
