import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import { usePayments } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  TrendingUp, CreditCard, Clock, Wallet, CheckCircle, RefreshCw, FileText,
  PlusCircle, UserPlus, ArrowRight, MessageSquare, Download, AlertTriangle, ChevronRight,
  Filter, Calendar, Activity, Receipt, ArrowDownRight, ArrowUpRight, Loader2
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    business, syncFromCloud, showToast, addCustomer: contextAddCustomer, updateBill: contextUpdateBill
  } = useAppContext()

  // TanStack Queries & Mutations
  const { data: bills = [], isLoading: isLoadingBills } = useBills()
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: payments = [], isLoading: isLoadingPayments } = usePayments()
  const { data: expenses = [], isLoading: isLoadingExpenses } = useExpenses()
  const { createCustomer: createCustomerMutation, isCreatingCustomer } = useCustomerMutations()
  const { updateBill: updateBillMutation, isUpdatingBill } = useBillMutations()

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

  const [jobStatusFilter, setJobStatusFilter] = useState('all') // 'all' | 'pending' | 'in_progress' | 'ready' | 'overdue' | 'delivered'
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)

  // Customer Modal Form
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const [newCustType, setNewCustType] = useState('regular')

  // Handle Cloud Sync
  const handleSync = async () => {
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
  }

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

  // Filtered recent orders by job status
  const recentOrders = useMemo(() => {
    let list = [...filteredBills]
    if (jobStatusFilter !== 'all') {
      list = list.filter(b => (b.jobStatus || b.job_status || b.status) === jobStatusFilter)
    }
    list.sort((a, b) => new Date(b.date || b.createdAt || b.created_at) - new Date(a.date || a.createdAt || a.created_at))
    return list.slice(0, 8)
  }, [filteredBills, jobStatusFilter])

  // Direct Job Status Updater
  const handleUpdateJobStatus = async (billId, newStatus) => {
    try {
      await updateBillMutation({
        id: billId,
        data: {
          job_status: newStatus,
          jobStatus: newStatus,
          status: newStatus === 'delivered' ? 'paid' : undefined
        }
      })
      if (contextUpdateBill) {
        contextUpdateBill(billId, { jobStatus: newStatus, status: newStatus === 'delivered' ? 'paid' : undefined })
      }
      showToast(`Job status updated to ${newStatus.toUpperCase()}`, 'success')
    } catch (e) {
      showToast(e.message || 'Failed to update status', 'error')
    }
  }

  // Handle Add Customer Form
  const handleAddCustomerSubmit = async (e) => {
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
  }

  // WhatsApp Alert Trigger
  const handleSendWhatsApp = (bill) => {
    const cust = customers.find(c => String(c.id) === String(bill.customerId || bill.customer_id))
    const phone = bill.customerPhone || bill.customer_phone || cust?.phone || ''
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const shopName = business?.shopName || 'PrintPro'
    const invId = bill.invoiceNumber || bill.invoice_number || bill.id
    const due = Number(bill.balance || bill.total || 0).toFixed(2)

    const text = `Hello ${bill.customerName || bill.customer_name || 'Customer'},\nYour print order *${invId}* is READY for pickup at ${shopName}!\nBalance Due: ₹${due}.\nThank you for choosing ${shopName}!`
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  // Financial CSV Export Trigger
  const handleExportCSV = () => {
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
  }

  return (
    <MobileLayout
      title="PrintPro Mobile Command"
      onSwitchToDesktop={() => {
        localStorage.setItem('printpro_viewport_pref', 'desktop')
        navigate('/dashboard')
      }}
    >
      {/* Top Banner Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-secondary)', letterSpacing: '0.08em' }}>
            STORE COMMAND CENTER
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

      {/* Primary Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        <button
          className="mobile-btn mobile-btn-primary"
          onClick={() => navigate('/mobile/create-bill')}
          style={{ minHeight: '48px' }}
        >
          <PlusCircle size={20} /> + QUICK BILL
        </button>
        <button
          className="mobile-btn mobile-btn-secondary"
          onClick={() => setShowAddCustomerModal(true)}
          style={{ minHeight: '48px' }}
        >
          <UserPlus size={20} /> + CUSTOMER
        </button>
      </div>

      {/* Recent Orders Section */}
      <div className="mobile-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            RECENT ORDERS & JOB STATUS
          </h3>
          <button
            onClick={() => navigate('/mobile/billing')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
          >
            View All <ChevronRight size={14} />
          </button>
        </div>

        {/* Job Status Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
          {[
            { id: 'all', label: 'All Jobs' },
            { id: 'pending', label: 'Pending' },
            { id: 'in_progress', label: 'Printing' },
            { id: 'ready', label: 'Ready' },
            { id: 'delivered', label: 'Delivered' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setJobStatusFilter(s.id)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: jobStatusFilter === s.id ? '1px solid var(--accent-secondary)' : '1px solid var(--border)',
                background: jobStatusFilter === s.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                color: jobStatusFilter === s.id ? 'var(--accent-secondary)' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Orders Stack */}
        {isLoadingBills ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Loader2 size={24} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading recent orders...</div>
          </div>
        ) : recentOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No recent orders match filter.
          </div>
        ) : (
          recentOrders.map((bill) => {
            const isReady = (bill.jobStatus || bill.job_status || bill.status) === 'ready'
            return (
              <div
                key={bill.id}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div onClick={() => navigate(`/mobile/bill/${bill.id}`)} style={{ cursor: 'pointer', flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {bill.customerName || bill.customer_name || 'Walk-in Customer'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
                    #{bill.invoiceNumber || bill.invoice_number || bill.id} • ₹{Number(bill.total || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Job Status Updater Dropdown */}
                  <select
                    value={bill.jobStatus || bill.job_status || bill.status || 'pending'}
                    onChange={(e) => handleUpdateJobStatus(bill.id, e.target.value)}
                    style={{
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.72rem',
                      padding: '4px 6px',
                      fontWeight: 700
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="ready">Ready</option>
                    <option value="delivered">Delivered</option>
                  </select>

                  {/* WhatsApp Ready Alert */}
                  {isReady && (
                    <button
                      className="mobile-icon-btn"
                      onClick={() => handleSendWhatsApp(bill)}
                      title="Send WhatsApp Ready Alert"
                      style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', color: '#25D366' }}
                    >
                      <MessageSquare size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
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
    </MobileLayout>
  )
}
