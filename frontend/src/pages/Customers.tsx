import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../context/AppContext'
import { useCustomers, useCustomerMutations } from '../hooks/useCustomersQuery'
import { useBills, useBillMutations } from '../hooks/useBillsQuery'
import { usePayments, usePaymentMutations, useAdvancePayments, useAdvancePaymentMutations, useInventory } from '../hooks/useEntitiesQuery'
import { SequenceService } from '../services/sequenceService'
import { ReminderService } from '../services/reminderService'
import { ReconciliationService } from '../services/reconciliationService'
import { useUnifiedFinancialHub } from '../hooks/useUnifiedFinancialHub'
import EmptyState from '../components/common/EmptyState'
import { ListSkeleton } from '../components/common/Skeleton'
import {
  Users, UserPlus, Search, X, CheckCircle, AlertCircle, Trash2, RotateCcw,
  Pencil, Wallet, FileText, BookOpen, Layers, MessageSquare, ExternalLink, ShieldAlert
} from 'lucide-react'

// Sub-components
import { CustomerOverviewTab } from '../components/customers/CustomerOverviewTab'
import { CustomerBillsTab } from '../components/customers/CustomerBillsTab'
import { CustomerLedgerTab } from '../components/customers/CustomerLedgerTab'
import { CustomerAdvancesTab } from '../components/customers/CustomerAdvancesTab'
import { GlobalAdvanceRegister } from '../components/customers/GlobalAdvanceRegister'

const EMPTY_FORM = {
  type: 'regular',
  name: '',
  phone: '',
  email: '',
  creditBalance: '',
  creditLimit: '',
  openingBalanceMethod: 'cash',
  openingCash: '',
  openingUpi: '',
}

export default function Customers() {
  const { business, settings, bills: contextBills, payments: contextPayments, restoreCustomer, applyPostDiscount, showAlert, showConfirm, showToast } = useAppContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Queries & Mutations
  const { data: serverCustomers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: serverBills, isSuccess: isBillsLoaded } = useBills()
  const { data: serverPayments, isSuccess: isPaymentsLoaded } = usePayments()
  const { data: serverAdvancePayments = [] } = useAdvancePayments()
  const { data: serverInventory = [] } = useInventory()

  const { createCustomer, updateCustomer, deleteCustomer, isCreating, isUpdating } = useCustomerMutations()
  const { createPayment } = usePaymentMutations()
  const { updateBill, deleteBill } = useBillMutations()
  const { addAdvancePayment, deleteAdvancePayment } = useAdvancePaymentMutations()

  const customers = Array.isArray(serverCustomers) ? serverCustomers : []
  const rawBills = isBillsLoaded || serverBills !== undefined ? serverBills : contextBills
  const bills = Array.isArray(rawBills) ? rawBills : []
  const rawPayments = isPaymentsLoaded || serverPayments !== undefined ? serverPayments : contextPayments
  const payments = Array.isArray(rawPayments) ? rawPayments : []
  const advancePayments = Array.isArray(serverAdvancePayments) ? serverAdvancePayments : []
  const inventory = Array.isArray(serverInventory) ? serverInventory : []

  // Top View State: 'directory' | 'global-advances'
  const currentView = searchParams.get('view') === 'global-advances' ? 'global-advances' : 'directory'
  const paramCustomerId = searchParams.get('customerId')
  const paramTab = (searchParams.get('tab') as 'overview' | 'bills' | 'ledger' | 'advances') || 'overview'

  const [activeTab, setActiveTab] = useState<'overview' | 'bills' | 'ledger' | 'advances'>(paramTab)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(paramCustomerId)

  // Synchronize state when URL search params change
  useEffect(() => {
    if (paramCustomerId) {
      setSelectedCustomerId(paramCustomerId)
    }
    if (paramTab) {
      setActiveTab(paramTab)
    }
  }, [paramCustomerId, paramTab])

  // Customer List Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'regular' | 'random' | 'with-dues' | 'with-adv' | 'deleted'>('all')

  // Customer Add/Edit Modal
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false)

  // Reconciled bills for balance calculations
  const reconciledBills = useMemo(() => {
    try {
      return ReconciliationService.reconcileBillsWithPayments(bills, payments) || []
    } catch (err) {
      console.error('Failed to reconcile bills:', err)
      return bills || []
    }
  }, [bills, payments])

  const { getCustomerFinancials, invalidateAllFinancialQueries } = useUnifiedFinancialHub()

  // Calculate customer outstanding net due directly from unified financial hub
  const getCustomerOutstanding = (custId: string) => {
    if (!custId) return 0
    return getCustomerFinancials(custId)?.netDue ?? 0
  }

  // Selected customer object - supports both sequential code (CUS-0001) and internal ID
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    const target = String(selectedCustomerId).trim().toLowerCase()
    return customers.find((c: any) => c && (
      String(c.id).toLowerCase() === target ||
      String(c.customerCode || '').toLowerCase() === target
    )) || null
  }, [customers, selectedCustomerId])

  // Automatically select first customer if none selected on desktop directory view
  useEffect(() => {
    if (!selectedCustomerId && customers.length > 0 && currentView === 'directory') {
      const firstActive = customers.find((c: any) => c && !c.deleted)
      if (firstActive) {
        setSelectedCustomerId(String(firstActive.customerCode || firstActive.id))
      }
    }
  }, [selectedCustomerId, customers, currentView])

  // Computed values for selected customer
  const selectedCustomerOutstanding = useMemo(() => {
    if (!selectedCustomer) return 0
    return getCustomerFinancials(selectedCustomer.id)?.netDue ?? 0
  }, [selectedCustomer, getCustomerFinancials])

  const selectedCustomerAdvance = useMemo(() => {
    if (!selectedCustomer) return 0
    return getCustomerFinancials(selectedCustomer.id)?.advanceBalance ?? 0
  }, [selectedCustomer, getCustomerFinancials])

  const selectedCustomerBills = useMemo(() => {
    if (!selectedCustomer) return []
    const strId = String(selectedCustomer.id)
    return (reconciledBills || [])
      .filter((b: any) => !b.deleted && !b.deleted_at && String(b.customerId || b.customer_id) === strId)
      .sort((a: any, b: any) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
  }, [reconciledBills, selectedCustomer])

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c: any) => {
      if (!c) return false
      if (filterType === 'deleted') return c.deleted === true
      if (c.deleted) return false

      const q = searchQuery.toLowerCase()
      const matchesSearch =
        !searchQuery ||
        (c.name || '').toLowerCase().includes(q) ||
        String(c.id || '').toLowerCase().includes(q) ||
        (c.customerCode || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(searchQuery)

      if (!matchesSearch) return false

      if (filterType === 'regular') return c.type === 'regular'
      if (filterType === 'random') return c.type === 'random'
      if (filterType === 'with-dues') return getCustomerOutstanding(c.id) > 0
      if (filterType === 'with-adv') return Number(c.advanceBalance || c.advance_balance || c.creditBalance || c.credit_balance || 0) > 0

      return true
    })
  }, [customers, searchQuery, filterType, reconciledBills])

  // Navigation & URL sync helper - masks UUID by passing clean customerCode
  const handleSelectCustomer = (custId: string, tab: 'overview' | 'bills' | 'ledger' | 'advances' = 'overview') => {
    const cust = customers.find((c: any) => c && (String(c.id) === String(custId) || String(c.customerCode) === String(custId)))
    const targetKey = cust?.customerCode || custId
    setSelectedCustomerId(targetKey)
    setActiveTab(tab)
    setSearchParams({ view: 'directory', customerId: targetKey, tab })
  }

  const handleTabChange = (tab: 'overview' | 'bills' | 'ledger' | 'advances') => {
    setActiveTab(tab)
    if (selectedCustomerId) {
      setSearchParams({ view: currentView, customerId: selectedCustomerId, tab })
    }
  }

  const handleViewChange = (view: 'directory' | 'global-advances') => {
    if (view === 'global-advances') {
      setSearchParams({ view: 'global-advances' })
    } else {
      setSearchParams({
        view: 'directory',
        ...(selectedCustomerId ? { customerId: selectedCustomerId, tab: activeTab } : {}),
      })
    }
  }

  // ── SETTLEMENT LOGIC (FIFO with Cash, UPI, and Advance Wallet) ─────────────
  const handleSettleBills = async ({ cash, upi, advance }: { cash: number; upi: number; advance: number }) => {
    if (!selectedCustomer) return
    const totalPaying = cash + upi + advance
    if (totalPaying <= 0) return

    // 1. Oldest unpaid bills FIFO
    const unpaidBills = selectedCustomerBills
      .filter((b: any) => Number(b.balance || 0) > 0)
      .sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

    let remaining = totalPaying
    for (const b of unpaidBills) {
      if (remaining <= 0) break
      const toPay = Math.min(remaining, Number(b.balance || 0))
      const newBal = Number(Math.max(0, Number(b.balance || 0) - toPay).toFixed(2))
      const currentPaid = Number(b.amountPaid !== undefined ? b.amountPaid : (b.amount_paid || b.paid_total || 0))
      const newPaid = Number((currentPaid + toPay).toFixed(2))
      const newStatus = newBal <= 0.001 ? 'paid' : 'partial'

      await updateBill({
        id: b.id,
        data: {
          balance: newBal,
          status: newStatus,
          amountPaid: newPaid,
          amount_paid: newPaid,
        },
      })
      remaining = Number((remaining - toPay).toFixed(2))
    }

    // 2. Adjust Advance Balance
    let newAdvBalance = selectedCustomerAdvance
    if (advance > 0) {
      newAdvBalance = Math.max(0, Number((newAdvBalance - advance).toFixed(2)))
    }
    if (remaining > 0) {
      // Cash/UPI paid beyond all bills goes into advance wallet
      newAdvBalance = Number((newAdvBalance + remaining).toFixed(2))
    }

    if (newAdvBalance !== selectedCustomerAdvance) {
      await updateCustomer({
        id: selectedCustomer.id,
        data: {
          advanceBalance: newAdvBalance,
          advance_balance: newAdvBalance,
          creditBalance: newAdvBalance,
          credit_balance: newAdvBalance,
        },
      })
    }

    // 3. Record Payment
    await createPayment({
      customer_id: selectedCustomer.id,
      cash_amount: cash,
      upi_amount: upi,
      total_paid: totalPaying,
      payment_type: unpaidBills.length > 0 && remaining === 0 ? 'full' : 'partial',
      notes: `Settlement via Customer Hub (Cash: ₹${cash.toFixed(2)}, UPI: ₹${upi.toFixed(2)}, Advance: ₹${advance.toFixed(2)})`,
    })

    queryClient.invalidateQueries({ queryKey: ['customers'] })
    queryClient.invalidateQueries({ queryKey: ['bills'] })
    queryClient.invalidateQueries({ queryKey: ['payments'] })
    queryClient.invalidateQueries({ queryKey: ['advance-payments'] })
    queryClient.invalidateQueries({ queryKey: ['accounting'] })

    showToast(`Settlement of ₹${totalPaying.toFixed(2)} successfully applied!`, 'success')
  }

  // ── DIRECT BILL PAY (Single Bill with Cash, UPI, Advance) ─────────────────
  const handlePaySingleBill = async (bill: any, amounts: { cash: number; upi: number; advance: number }) => {
    if (!selectedCustomer || !bill) return
    const total = amounts.cash + amounts.upi + amounts.advance
    if (total <= 0) return

    const currentBal = Number(bill.balance || 0)
    const newBal = Math.max(0, Number((currentBal - total).toFixed(2)))
    const currentPaid = Number(bill.amountPaid !== undefined ? bill.amountPaid : (bill.amount_paid || bill.paid_total || 0))
    const newPaid = Number((currentPaid + total).toFixed(2))
    const newStatus = newBal <= 0.001 ? 'paid' : 'partial'
    const newAdvUsed = Number((Number(bill.advanceUsed || bill.advance_used || 0) + amounts.advance).toFixed(2))

    await updateBill({
      id: bill.id,
      data: {
        balance: newBal,
        status: newStatus,
        amountPaid: newPaid,
        amount_paid: newPaid,
        advanceUsed: newAdvUsed,
        advance_used: newAdvUsed,
      },
    })

    if (amounts.advance > 0) {
      const newAdvBalance = Math.max(0, Number((selectedCustomerAdvance - amounts.advance).toFixed(2)))
      await updateCustomer({
        id: selectedCustomer.id,
        data: {
          advanceBalance: newAdvBalance,
          advance_balance: newAdvBalance,
          creditBalance: newAdvBalance,
          credit_balance: newAdvBalance,
        },
      })
    }

    await createPayment({
      customer_id: selectedCustomer.id,
      bill_id: bill.id,
      cash_amount: amounts.cash,
      upi_amount: amounts.upi,
      total_paid: total,
      payment_type: newStatus === 'paid' ? 'full' : 'partial',
      notes: `Direct payment on Invoice #${bill.invoiceNumber || bill.id} (Cash: ₹${amounts.cash}, UPI: ₹${amounts.upi}, Advance: ₹${amounts.advance})`,
    })

    queryClient.invalidateQueries({ queryKey: ['customers'] })
    queryClient.invalidateQueries({ queryKey: ['bills'] })
    queryClient.invalidateQueries({ queryKey: ['payments'] })
    queryClient.invalidateQueries({ queryKey: ['advance-payments'] })
  }

  // ── RECEIVE NEW ADVANCE (with Auto-apply to pending dues) ──────────────────
  const handleAddAdvancePayment = async (data: any, autoApplyToBills: boolean) => {
    if (!selectedCustomer) return
    const advAmount = Number(data.amount || 0)
    if (advAmount <= 0) return

    // 1. Record the advance payment log entry
    await addAdvancePayment({
      ...data,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
    })

    if (autoApplyToBills && selectedCustomerOutstanding > 0) {
      // Auto-settle oldest dues via FIFO
      const toKnockoff = Math.min(advAmount, selectedCustomerOutstanding)
      const surplus = Math.max(0, Number((advAmount - toKnockoff).toFixed(2)))

      const unpaidBills = selectedCustomerBills
        .filter((b: any) => Number(b.balance || 0) > 0)
        .sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

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
          data: {
            balance: newBal,
            status: newStatus,
            amountPaid: newPaid,
            amount_paid: newPaid,
          },
        })
        remaining = Number((remaining - toPay).toFixed(2))
      }

      const newCustomerAdv = Number((selectedCustomerAdvance + surplus).toFixed(2))
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
        cash_amount: data.cashAmount || 0,
        upi_amount: data.upiAmount || 0,
        total_paid: toKnockoff,
        payment_type: toKnockoff >= selectedCustomerOutstanding ? 'full' : 'partial',
        notes: `Advance applied to clear pending bills via FIFO (Deposit: ₹${advAmount.toFixed(2)}, Applied: ₹${toKnockoff.toFixed(2)}, Surplus: ₹${surplus.toFixed(2)})`,
      })
    } else {
      // Add entirely to advance balance
      const newCustomerAdv = Number((selectedCustomerAdvance + advAmount).toFixed(2))
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

    queryClient.invalidateQueries({ queryKey: ['customers'] })
    queryClient.invalidateQueries({ queryKey: ['bills'] })
    queryClient.invalidateQueries({ queryKey: ['payments'] })
    queryClient.invalidateQueries({ queryKey: ['advance-payments'] })
  }

  // ── RETURN ADVANCE BALANCE ────────────────────────────────────────────────
  const handleReturnAdvancePayment = async (data: any) => {
    if (!selectedCustomer) return
    const returnAmount = Number(data.amount || 0)
    if (returnAmount <= 0) return

    await addAdvancePayment({
      ...data,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      amount: -returnAmount,
      isReturn: true,
      type: 'return',
    })

    const newCustomerAdv = Math.max(0, Number((selectedCustomerAdvance - returnAmount).toFixed(2)))
    await updateCustomer({
      id: selectedCustomer.id,
      data: {
        advanceBalance: newCustomerAdv,
        advance_balance: newCustomerAdv,
        creditBalance: newCustomerAdv,
        credit_balance: newCustomerAdv,
      },
    })

    queryClient.invalidateQueries({ queryKey: ['customers'] })
    queryClient.invalidateQueries({ queryKey: ['advance-payments'] })
  }

  // ── ADD / EDIT CUSTOMER MODAL HANDLERS ─────────────────────────────────────
  const openAddModal = () => {
    setEditMode(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setShowModal(true)
  }

  const openEditModal = (cust: any) => {
    setEditMode(true)
    setEditingId(cust.id)
    setForm({
      type: cust.type || 'regular',
      name: cust.name || '',
      phone: cust.phone || '',
      email: cust.email || '',
      creditBalance: cust.creditBalance ?? cust.credit_balance ?? '',
      creditLimit: cust.creditLimit ?? cust.credit_limit ?? '',
      openingBalanceMethod: 'cash',
      openingCash: '',
      openingUpi: '',
    })
    setFormErrors({})
    setShowModal(true)
  }

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!form.name?.trim()) errors.name = 'Customer name is required'
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setIsSubmittingCustomer(true)
    try {
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone?.trim() || '',
        email: form.email?.trim() || '',
        type: form.type || 'regular',
        creditLimit: form.creditLimit !== '' ? Number(form.creditLimit) : 0,
      }

      if (editMode && editingId) {
        await updateCustomer({ id: editingId, data: payload })
        showToast('Customer profile updated!', 'success')
      } else {
        const initialAdv = Number(form.creditBalance || 0)
        payload.advanceBalance = initialAdv
        payload.creditBalance = initialAdv
        const newCust = await createCustomer(payload)
        showToast('Customer created successfully!', 'success')
        if (newCust?.id) {
          handleSelectCustomer(newCust.id, 'overview')
        }
      }
      setShowModal(false)
    } catch (err: any) {
      setFormErrors({ submit: err?.message || 'Failed to save customer' })
    } finally {
      setIsSubmittingCustomer(false)
    }
  }

  return (
    <div style={{ paddingBottom: '30px' }}>
      {/* 1. Header with Top Navigation View Switcher */}
      <div className="page-header" style={{ marginBottom: '18px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Users size={26} color="var(--aurora-cyan, #00f0ff)" />
            Customer Hub & Accounts
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Unified workspace for customer directory, billing invoices, running ledgers, and advance payments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Top View Toggle: Customer Directory vs Global Advance Register */}
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={() => handleViewChange('directory')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: currentView === 'directory' ? 700 : 500,
                color: currentView === 'directory' ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: currentView === 'directory' ? 'rgba(0, 240, 255, 0.18)' : 'transparent',
                border: currentView === 'directory' ? '1px solid rgba(0, 240, 255, 0.35)' : '1px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <Users size={14} /> Customer Directory
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('global-advances')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: currentView === 'global-advances' ? 700 : 500,
                color: currentView === 'global-advances' ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: currentView === 'global-advances' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                border: currentView === 'global-advances' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <Wallet size={14} color="#10b981" /> Global Advance Register
            </button>
          </div>

          <button className="btn btn-primary" onClick={openAddModal}>
            <UserPlus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* 2. MAIN VIEW SWITCHER: GLOBAL ADVANCE REGISTER OR MASTER-DETAIL DIRECTORY */}
      {currentView === 'global-advances' ? (
        <GlobalAdvanceRegister
          customers={customers}
          advancePayments={advancePayments}
          onSelectCustomer={handleSelectCustomer}
        />
      ) : (
        /* MASTER-DETAIL WORKSPACE */
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'flex-start' }}>
          {/* ── LEFT PANE: CUSTOMER DIRECTORY LIST ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 170px)' }}>
            {/* Search & Filter Header */}
            <div style={{ padding: '14px', borderBottom: '1px solid var(--border)', background: 'rgba(15, 23, 42, 0.3)' }}>
              <div className="search-input-wrapper" style={{ width: '100%', marginBottom: '10px' }}>
                <Search size={14} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search customer, phone, code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
                />
              </div>

              {/* Filter Chips */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'regular', label: 'Regular' },
                  { key: 'with-dues', label: 'Dues' },
                  { key: 'with-adv', label: 'Advance' },
                  { key: 'deleted', label: 'Deleted' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilterType(f.key as any)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      fontSize: '0.72rem',
                      fontWeight: filterType === f.key ? 700 : 500,
                      backgroundColor: filterType === f.key ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      color: filterType === f.key ? 'var(--aurora-cyan, #00f0ff)' : 'var(--text-secondary)',
                      border: filterType === f.key ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer List Items */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
              {isLoadingCustomers && customers.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading customers...</div>
              ) : filteredCustomers.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No customers found.
                </div>
              ) : (
                filteredCustomers.map((cust: any, idx: number) => {
                  const isSelected = selectedCustomer?.id === cust.id
                  const outDue = getCustomerOutstanding(cust.id)
                  const advBal = Number(cust.advanceBalance || cust.advance_balance || cust.creditBalance || cust.credit_balance || 0)
                  const displayCode = cust.customerCode || SequenceService.formatDisplayCode('customer', cust, 'CUS')

                  return (
                    <div
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust.customerCode || cust.id, activeTab)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        backgroundColor: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
                        border: isSelected ? '1px solid rgba(0, 240, 255, 0.35)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            #{idx + 1}
                          </span>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                            {cust.name}
                          </div>
                        </div>
                        <span className={`badge ${cust.type === 'regular' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                          {cust.type === 'regular' ? 'REG' : 'WALK'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--aurora-cyan, #00f0ff)' }}>{displayCode}</span>
                        {cust.phone && <span>• {cust.phone}</span>}
                      </div>

                      {/* Balances Line */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.74rem' }}>
                        <div>
                          {outDue > 0 ? (
                            <span style={{ color: 'var(--aurora-pink, #ff2fb0)', fontWeight: 700 }}>
                              Due: ₹{outDue.toFixed(2)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Due: ₹0.00</span>
                          )}
                        </div>
                        <div>
                          {advBal > 0 && (
                            <span style={{ color: '#10b981', fontWeight: 700 }}>
                              Adv: ₹{advBal.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── RIGHT PANE: SELECTED CUSTOMER 360 WORKSPACE ── */}
          {selectedCustomer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Customer Header Banner */}
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{selectedCustomer.name}</h2>
                      <span className={`badge ${selectedCustomer.type === 'regular' ? 'badge-info' : 'badge-warning'}`}>
                        {selectedCustomer.type === 'regular' ? 'Regular Customer' : 'Walk-in / Random'}
                      </span>
                      {selectedCustomer.deleted && (
                        <span className="badge badge-danger">DELETED</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Code: <strong style={{ fontFamily: 'monospace', color: 'var(--aurora-cyan, #00f0ff)' }}>
                        {selectedCustomer.customerCode || SequenceService.formatDisplayCode('customer', selectedCustomer, 'CUS')}
                      </strong>
                      {selectedCustomer.phone && ` • Phone: ${selectedCustomer.phone}`}
                      {selectedCustomer.email && ` • Email: ${selectedCustomer.email}`}
                    </div>
                  </div>

                  {/* Top Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditModal(selectedCustomer)}
                    >
                      <Pencil size={13} /> Edit Profile
                    </button>
                    {selectedCustomer.phone && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const text = ReminderService.buildLedgerReminderMessage(selectedCustomer, selectedCustomerOutstanding, business, settings)
                          const url = ReminderService.getWhatsAppUrl(selectedCustomer.phone, text)
                          window.open(url, '_blank')
                        }}
                        style={{ color: '#25D366' }}
                        title="WhatsApp Reminder"
                      >
                        <MessageSquare size={13} /> WhatsApp
                      </button>
                    )}
                    {selectedCustomer.deleted ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => restoreCustomer && restoreCustomer(selectedCustomer.id)}
                      >
                        <RotateCcw size={13} /> Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          showConfirm(`Move "${selectedCustomer.name}" to deleted? Can be restored anytime.`, () => {
                            deleteCustomer(selectedCustomer.id)
                          })
                        }}
                        style={{ color: 'var(--error)' }}
                        title="Delete customer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-Tab Navigation Bar */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'overview', label: 'Overview & Settle', icon: Layers },
                    { key: 'bills', label: `Invoices & Bills (${selectedCustomerBills.length})`, icon: FileText },
                    { key: 'ledger', label: 'Ledger Statement', icon: BookOpen },
                    { key: 'advances', label: `Advance Wallet (₹${selectedCustomerAdvance.toFixed(2)})`, icon: Wallet },
                  ].map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.key
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => handleTabChange(tab.key as any)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '7px',
                          fontSize: '0.82rem',
                          fontWeight: isActive ? 700 : 500,
                          backgroundColor: isActive ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                          color: isActive ? 'var(--aurora-cyan, #00f0ff)' : 'var(--text-secondary)',
                          border: isActive ? '1px solid rgba(0, 240, 255, 0.35)' : '1px solid transparent',
                          boxShadow: isActive ? '0 0 12px rgba(0, 240, 255, 0.2)' : 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <Icon size={14} /> {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Sub-Tab Content Rendering */}
              {activeTab === 'overview' && (
                <CustomerOverviewTab
                  customer={selectedCustomer}
                  outstandingDue={selectedCustomerOutstanding}
                  advanceBalance={selectedCustomerAdvance}
                  bills={selectedCustomerBills}
                  payments={payments}
                  business={business}
                  settings={settings}
                  onSettleBills={handleSettleBills}
                  onSwitchTab={handleTabChange}
                  onEditCustomer={() => openEditModal(selectedCustomer)}
                  showToast={showToast}
                />
              )}

              {activeTab === 'bills' && (
                <CustomerBillsTab
                  customer={selectedCustomer}
                  bills={selectedCustomerBills}
                  inventory={inventory}
                  advanceBalance={selectedCustomerAdvance}
                  business={business}
                  settings={settings}
                  onUpdateBill={async (id, data) => updateBill({ id, data })}
                  onDeleteBill={async (id) => deleteBill(id)}
                  onPayBill={handlePaySingleBill}
                  onApplyPostDiscount={async (billId, amt) => applyPostDiscount && applyPostDiscount(billId, amt)}
                  showToast={showToast}
                  showConfirm={showConfirm}
                />
              )}

              {activeTab === 'ledger' && (
                <CustomerLedgerTab
                  customer={selectedCustomer}
                  bills={bills}
                  payments={payments}
                  advancePayments={advancePayments}
                  business={business}
                  settings={settings}
                  onWriteOff={async (billId, balAmt) => {
                    const targetBill = bills.find((b: any) => b && (String(b.id) === String(billId) || String(b.invoiceNumber) === String(billId)))
                    const invLabel = targetBill?.invoiceNumber || targetBill?.bill_number || SequenceService.formatDisplayCode('bill', billId, 'INV')
                    showConfirm(`Write off unpaid balance of ₹${balAmt.toFixed(2)} for ${invLabel}?`, async () => {
                      await updateBill({ id: billId, data: { status: 'paid', balance: 0, notes: `Written off ₹${balAmt.toFixed(2)}` } })
                      showToast(`Written off ₹${balAmt.toFixed(2)} for ${invLabel}`, 'info')
                    })
                  }}
                  showToast={showToast}
                />
              )}

              {activeTab === 'advances' && (
                <CustomerAdvancesTab
                  customer={selectedCustomer}
                  advanceBalance={selectedCustomerAdvance}
                  outstandingDue={selectedCustomerOutstanding}
                  advancePayments={advancePayments}
                  business={business}
                  onAddAdvancePayment={handleAddAdvancePayment}
                  onReturnAdvancePayment={handleReturnAdvancePayment}
                  onDeleteAdvancePayment={async (id) => deleteAdvancePayment(id)}
                  showToast={showToast}
                  showConfirm={showConfirm}
                />
              )}
            </div>
          ) : (
            /* No customer selected empty state */
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Users size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
              <h3>Select a customer</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '360px', margin: '8px auto 20px' }}>
                Choose a customer from the directory on the left or add a new customer to access their 360° workspace.
              </p>
              <button className="btn btn-primary" onClick={openAddModal}>
                <UserPlus size={16} /> Add New Customer
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ADD / EDIT CUSTOMER MODAL ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{editMode ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} style={{ padding: '20px' }}>
              {formErrors.submit && (
                <div style={{ color: 'var(--error)', fontSize: '0.82rem', marginBottom: '12px' }}>
                  {formErrors.submit}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Customer Type</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="custType"
                      checked={form.type === 'regular'}
                      onChange={() => setForm({ ...form, type: 'regular' })}
                    />
                    Regular
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="custType"
                      checked={form.type === 'random'}
                      onChange={() => setForm({ ...form, type: 'random' })}
                    />
                    Walk-in / One-time
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe / Apex Prints"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                {formErrors.name && (
                  <div style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '4px' }}>
                    {formErrors.name}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="10-digit mobile"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Credit Limit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0 for unlimited"
                    value={form.creditLimit}
                    onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                  />
                </div>
                {!editMode && (
                  <div className="form-group">
                    <label className="form-label">Opening Advance (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                      value={form.creditBalance}
                      onChange={(e) => setForm({ ...form, creditBalance: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingCustomer}>
                  {isSubmittingCustomer ? 'Saving...' : editMode ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
