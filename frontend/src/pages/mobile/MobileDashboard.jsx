import React, { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import { usePayments, usePaymentMutations } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  TrendingUp, Clock, Wallet, CheckCircle, RefreshCw,
  PlusCircle, UserPlus, Download,
  Receipt, Users, Inbox, BarChart3, Search, ArrowDownRight, DollarSign
} from 'lucide-react'
import '../../styles/mobile.css'

const MetricsRow = React.memo(({ stats }) => {
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
          {stats.unpaidCount} Pending Invoice(s)
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
    business, syncFromCloud, showToast, addCustomer: contextAddCustomer, recordPayment
  } = useAppContext()

  // TanStack Queries & Mutations
  const { data: bills = [], isLoading: isLoadingBills } = useBills()
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: payments = [], isLoading: isLoadingPayments } = usePayments()
  const { data: expenses = [], isLoading: isLoadingExpenses } = useExpenses()
  const { createCustomer: createCustomerMutation, isCreatingCustomer } = useCustomerMutations()
  const { createPayment: createPaymentMutation } = usePaymentMutations()

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

  // Calculate live outstanding dues for selected customer in payment modal
  const selectedCustomerDue = useMemo(() => {
    if (!paymentCustomerId) return 0
    return (bills || [])
      .filter(b => {
        if (b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false
        const bCustId = b.customerId || b.customer_id
        return String(bCustId) === String(paymentCustomerId) && Number(b.balance || 0) > 0
      })
      .reduce((sum, b) => sum + Number(b.balance || 0), 0)
  }, [bills, paymentCustomerId])

  const handleNavigate = useCallback((path) => {
    navigate(path)
  }, [navigate])

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

      // 1. Instant local optimistic FIFO payment recording via AppContext
      if (recordPayment) {
        await recordPayment({
          customerId: paymentCustomerId,
          amount: total,
          paymentMethod: paymentMode === 'split' ? 'split' : paymentMode,
          cashAmount: cash,
          upiAmount: upi,
          notes: paymentNotes || 'Mobile Dashboard Quick Payment'
        })
      }

      // 2. Cloud mutation for remote sync
      if (createPaymentMutation) {
        await createPaymentMutation({
          customerId: paymentCustomerId,
          customerName: custName,
          totalPaid: total,
          cashAmount: cash,
          upiAmount: upi,
          paymentMethod: paymentMode === 'split' ? 'split' : paymentMode,
          notes: paymentNotes || 'Mobile Dashboard Quick Payment',
          date: new Date().toISOString()
        })
      }

      // 3. React Query multi-entity cache invalidation
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bills'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
        queryClient.invalidateQueries({ queryKey: ['accounting'] })
      ])

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
    recordPayment,
    createPaymentMutation,
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
    } catch (e) {
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
      if (b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false
      if (!start || !end) return true
      const d = new Date(b.date)
      return d >= start && d <= end
    })
  }, [bills, activeDateRange])

  // Financial Metric Calculations matching desktop logic
  const stats = useMemo(() => {
    const totalRevenue = filteredBills.reduce((sum, b) => sum + Number(b.total || 0), 0)
    const unpaidBills = filteredBills.filter(b => Number(b.balance || 0) > 0)
    const pendingAmount = unpaidBills.reduce((sum, b) => sum + Number(b.balance || 0), 0)

    const periodPayments = (payments || []).filter((p) => {
      if (p.isRefund || p.is_refund) return false
      const d = new Date(p.date)
      if (activeDateRange.start && d < activeDateRange.start) return false
      if (activeDateRange.end && d > activeDateRange.end) return false
      return true
    })

    let cashTotal = 0
    let upiTotal = 0
    periodPayments.forEach(p => {
      cashTotal += Number(p.cashAmount || p.cash_amount || 0)
      upiTotal += Number(p.upiAmount || p.upi_amount || 0)
    })
    const cashInflow = cashTotal + upiTotal

    const periodExpenses = (expenses || []).filter(e => {
      const d = new Date(e.date)
      if (activeDateRange.start && d < activeDateRange.start) return false
      if (activeDateRange.end && d > activeDateRange.end) return false
      return true
    }).reduce((sum, e) => sum + Number(e.amount || 0), 0)

    const refundPayments = (payments || []).filter(p => (p.isRefund || p.is_refund || p.paymentType === 'refund' || Number(p.totalPaid || p.total_paid || 0) < 0))
    const totalRefunds = refundPayments.reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || p.total_paid || 0)), 0)

    const netCashFlow = cashInflow - periodExpenses - totalRefunds

    return {
      totalRevenue,
      pendingAmount,
      unpaidCount: unpaidBills.length,
      cashInflow,
      cashTotal,
      upiTotal,
      periodExpenses,
      totalRefunds,
      netCashFlow,
    }
  }, [filteredBills, payments, expenses, activeDateRange])

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
      const created = await createCustomerMutation(payload)
      if (contextAddCustomer) {
        contextAddCustomer({
          id: created?.id || `cust-${Date.now()}`,
          ...payload
        })
      }
      showToast(`Customer '${payload.name}' added successfully!`, 'success')
      setNewCustName('')
      setNewCustPhone('')
      setNewCustEmail('')
      setShowAddCustomerModal(false)
    } catch (err) {
      showToast(err.message || 'Failed to add customer', 'error')
    }
  }, [newCustName, newCustPhone, newCustEmail, newCustType, createCustomerMutation, contextAddCustomer, showToast])

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
          onClick={() => navigate('/mobile/create-bill')}
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
          onClick={() => navigate('/mobile/accounting')}
          style={{ minHeight: '48px', fontSize: '0.82rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
        >
          <DollarSign size={18} /> + EXPENSE
        </button>
      </div>

      {/* Quick Navigation Grid (2x3) */}
      <div className="mobile-card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
          QUICK NAVIGATION
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: 'View Bills', path: '/mobile/billing', icon: Receipt, color: 'var(--accent-primary)' },
            { label: 'Customers', path: '/mobile/customers', icon: Users, color: 'var(--accent-secondary)' },
            { label: 'Accounting', path: '/mobile/accounting', icon: Wallet, color: 'var(--success)' },
            { label: 'Analytics', path: '/mobile/analytics', icon: BarChart3, color: 'var(--accent-tertiary)' },
            { label: 'Inventory', path: '/mobile/inventory', icon: Inbox, color: '#ffb800' },
            { label: 'Search', path: '/mobile/search', icon: Search, color: 'var(--info)' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
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
        onClose={() => setShowRecordPaymentModal(false)}
        title="Record Customer Payment"
      >
        <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              SELECT CUSTOMER
            </label>
            <select
              className="mobile-input"
              value={paymentCustomerId}
              onChange={(e) => {
                setPaymentCustomerId(e.target.value)
                const due = (bills || [])
                  .filter(b => {
                    if (b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false
                    const bCustId = b.customerId || b.customer_id
                    return String(bCustId) === String(e.target.value) && Number(b.balance || 0) > 0
                  })
                  .reduce((sum, b) => sum + Number(b.balance || 0), 0)
                if (due > 0) {
                  setPaymentAmount(due.toString())
                }
              }}
              required
              style={{ padding: '10px 12px' }}
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => {
                const due = (bills || [])
                  .filter(b => {
                    if (b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false
                    const bCustId = b.customerId || b.customer_id
                    return String(bCustId) === String(c.id) && Number(b.balance || 0) > 0
                  })
                  .reduce((sum, b) => sum + Number(b.balance || 0), 0)
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} {due > 0 ? `(Due: ₹${due.toLocaleString('en-IN')})` : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Outstanding Balance Banner if customer selected */}
          {paymentCustomerId && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: selectedCustomerDue > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              border: `1px solid ${selectedCustomerDue > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL OUTSTANDING</span>
                <span style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: selectedCustomerDue > 0 ? 'var(--error)' : 'var(--success)'
                }}>
                  ₹{selectedCustomerDue.toLocaleString('en-IN')}
                </span>
              </div>
              {selectedCustomerDue > 0 && (
                <button
                  type="button"
                  onClick={() => setPaymentAmount(selectedCustomerDue.toString())}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--accent-primary)',
                    background: 'rgba(255, 47, 176, 0.15)',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer'
                  }}
                >
                  Pay Full Due
                </button>
              )}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              AMOUNT RECEIVED (₹)
            </label>
            <input
              type="number"
              className="mobile-input"
              placeholder="0.00"
              step="any"
              min="0"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              style={{ fontSize: '1.1rem', fontWeight: 800 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              PAYMENT MODE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {['cash', 'upi', 'split'].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`mobile-btn ${paymentMode === m ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                  onClick={() => setPaymentMode(m)}
                  style={{ minHeight: '36px', fontSize: '0.78rem', textTransform: 'uppercase' }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {paymentMode === 'split' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>CASH (₹)</label>
                <input
                  type="number"
                  className="mobile-input"
                  placeholder="0.00"
                  step="any"
                  value={paymentCash}
                  onChange={(e) => setPaymentCash(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>UPI (₹)</label>
                <input
                  type="number"
                  className="mobile-input"
                  placeholder="0.00"
                  step="any"
                  value={paymentUpi}
                  onChange={(e) => setPaymentUpi(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              REMARKS / REFERENCE (OPTIONAL)
            </label>
            <input
              type="text"
              className="mobile-input"
              placeholder="e.g. GPay / Cash counter settlement"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="mobile-btn mobile-btn-primary"
            style={{ marginTop: '8px', minHeight: '44px' }}
            disabled={isSubmittingPayment}
          >
            {isSubmittingPayment ? 'Recording...' : '✓ Record & Settle Invoices (FIFO)'}
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
