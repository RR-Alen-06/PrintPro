import React, { useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import { usePayments, useInventory, useAdvancePayments, useDeletedPayments } from '../../hooks/useEntitiesQuery'
import { useExpenses, useExpenseMutations } from '../../hooks/useExpensesQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { ProductAnalyticsService } from '../../services/productAnalyticsService'
import { STATEMENT_PERIOD_OPTIONS } from '../../services/statementService'
import { ReconciliationService } from '../../services/reconciliationService'
import ProductDrilldownModal from '../../components/accounting/ProductDrilldownModal'
import CustomServiceDrilldownModal from '../../components/accounting/CustomServiceDrilldownModal'
import {
  DollarSign, Wallet, FileText, RotateCcw, TrendingUp, Layers, Calculator,
  Calendar, CheckCircle, AlertTriangle, Smartphone, ChevronRight, BarChart2, Plus, MessageSquare, X, Tag, Wrench,
  CreditCard, Clock, ArrowRight
} from 'lucide-react'
import '../../styles/mobile.css'

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1]
const EXPENSE_CATEGORIES = [
  'Paper & Media',
  'Ink & Toners',
  'Equipment & Repairs',
  'Electricity & Utilities',
  'Staff Wages',
  'Shop Rent',
  'General Supplies',
  'Miscellaneous',
]

export default function MobileAccounting() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { business, settings, showToast, processRefund } = useAppContext()

  // Queries
  const { data: serverBills = [] } = useBills()
  const { data: serverPayments = [] } = usePayments()
  const { data: serverExpenses = [] } = useExpenses()
  const { data: serverRefunds = [] } = useDeletedPayments()
  const { data: serverInventory = [] } = useInventory()
  const { data: serverCustomers = [] } = useCustomers()
  const { data: serverAdvancePayments = [] } = useAdvancePayments()

  const { createExpenseMutation } = useExpenseMutations()

  const bills = Array.isArray(serverBills) ? serverBills : []
  const payments = Array.isArray(serverPayments) ? serverPayments : []
  const expenses = Array.isArray(serverExpenses) ? serverExpenses : []
  const inventory = Array.isArray(serverInventory) ? serverInventory : []
  const customers = Array.isArray(serverCustomers) ? serverCustomers : []
  const advancePayments = Array.isArray(serverAdvancePayments) ? serverAdvancePayments : []

  // Active Tab
  const paramTab = searchParams.get('tab') || 'register'
  const [activeTab, setActiveTab] = useState(paramTab)

  // Daybook state
  const todayStr = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [openingCash, setOpeningCash] = useState(1000)

  // Item Sales Analytics state
  const [itemPeriod, setItemPeriod] = useState('this_month')
  const [itemSubTab, setItemSubTab] = useState('catalog')
  const [selectedItemProduct, setSelectedItemProduct] = useState(null)
  const [selectedItemCustom, setSelectedItemCustom] = useState(null)

  const catalogAnalytics = useMemo(() => {
    return ProductAnalyticsService.getAllCatalogProductsAnalytics({
      filter: itemPeriod,
      bills,
      products: inventory,
    })
  }, [itemPeriod, bills, inventory])

  const customAnalytics = useMemo(() => {
    return ProductAnalyticsService.getCustomItemsAnalytics({
      filter: itemPeriod,
      bills,
      products: inventory,
    })
  }, [itemPeriod, bills, inventory])

  // Modals state
  const [showDenomSheet, setShowDenomSheet] = useState(false)
  const [showAddExpenseSheet, setShowAddExpenseSheet] = useState(false)
  const [showRefundSheet, setShowRefundSheet] = useState(false)

  // Denomination counter state
  const [denomCounts, setDenomCounts] = useState({
    500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
  })

  // Add Expense form state
  const [expName, setExpName] = useState('')
  const [expCat, setExpCat] = useState('Paper & Media')
  const [expAmount, setExpAmount] = useState('')
  const [expMethod, setExpMethod] = useState('cash')
  const [isSubmittingExp, setIsSubmittingExp] = useState(false)

  // Refund form state
  const [refCustomerId, setRefCustomerId] = useState('')
  const [refAmount, setRefAmount] = useState('')
  const [refMethod, setRefMethod] = useState('cash')
  const [refReason, setRefReason] = useState('')
  const [isSubmittingRef, setIsSubmittingRef] = useState(false)

  const navigate = useNavigate()

  // Reconciled Accounts Receivables & Debtors (synced exactly with Dashboard and Customer Ledger)
  const accountsReceivableData = useMemo(() => {
    return ReconciliationService.calculateAccountsReceivables({
      bills,
      payments,
      customers,
    })
  }, [bills, payments, customers])

  // Daily Calculations
  const dayCalculations = useMemo(() => {
    let cashIn = 0
    let upiIn = 0
    let cashOut = 0
    let upiOut = 0

    // 1. Payments collected on this date (excluding non-cash advance applications)
    payments.forEach((p) => {
      const pDate = (p.date || p.created_at || '').slice(0, 10)
      if (pDate === selectedDate && !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0) {
        const notesLower = String(p.notes || '').toLowerCase()
        const isAdvanceApplied =
          notesLower.includes('advance balance applied') ||
          notesLower.includes('from advance deposit') ||
          notesLower.includes('fifo payment from advance deposit') ||
          p.paymentType === 'advance_deduction' ||
          p.payment_type === 'advance_deduction'
        if (isAdvanceApplied) return

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

        cashIn += cash
        upiIn += upi
      }
    })

    // 2. Advance Payments deposited on this date
    advancePayments.forEach((ap) => {
      const apDate = (ap.date || ap.created_at || '').slice(0, 10)
      if (apDate === selectedDate && !ap.isReturn && Number(ap.amount || 0) > 0) {
        let cash = Number(ap.cashAmount || ap.cash_amount || 0)
        let upi = Number(ap.upiAmount || ap.upi_amount || 0)
        const amt = Number(ap.amount || 0)
        if (cash === 0 && upi === 0 && amt > 0) {
          const method = String(ap.paymentMethod || ap.payment_method || 'cash').toLowerCase()
          if (method === 'upi') upi = amt
          else cash = amt
        }
        cashIn += cash
        upiIn += upi
      }
    })

    expenses.forEach((e) => {
      const eDate = (e.date || '').slice(0, 10)
      if (eDate === selectedDate) {
        const c = Number(e.cashAmount !== undefined ? e.cashAmount : (e.upiAmount ? 0 : e.amount || e.total || 0))
        const u = Number(e.upiAmount || 0)
        cashOut += c
        upiOut += u
      }
    })

    const closingCash = Number((openingCash + cashIn - cashOut).toFixed(2))
    return { cashIn, upiIn, cashOut, upiOut, closingCash }
  }, [payments, advancePayments, expenses, selectedDate, openingCash])

  // Counted cash in denomination modal
  const totalCountedCash = useMemo(() => {
    return DENOMINATIONS.reduce((sum, denom) => sum + denom * (Number(denomCounts[denom]) || 0), 0)
  }, [denomCounts])
  const cashVariance = Number((totalCountedCash - dayCalculations.closingCash).toFixed(2))

  // Refunds list
  const refundsList = useMemo(() => {
    return payments.filter((p) => p && (p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0))
  }, [payments])

  // Analytics P&L
  const analyticsData = useMemo(() => {
    const grossRev = bills.filter((b) => !b.deleted && !b.deleted_at).reduce((s, b) => s + Number(b.total !== undefined ? b.total : (b.grand_total || 0)), 0)
    const totalExp = expenses.reduce((s, e) => s + Number(e.amount || e.total || 0), 0)
    const totalRef = refundsList.reduce((s, r) => s + Math.abs(Number(r.amount || r.totalPaid || 0)), 0)
    const netRev = Math.max(0, grossRev - totalRef)
    const netProfit = Number((netRev - totalExp).toFixed(2))
    const netMarginPct = netRev > 0 ? Number(((netProfit / netRev) * 100).toFixed(1)) : 0
    return { netRev, totalExp, totalRef, netProfit, netMarginPct }
  }, [bills, expenses, refundsList])

  // WhatsApp Z-Report
  const handleShareWhatsAppZReport = () => {
    let msg = `*DAILY FINANCIAL Z-REPORT - ${business?.shopName || 'PrintPro'}*\n`
    msg += `*Date:* ${selectedDate}\n`
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
    msg += `• Cash Collections: ₹${dayCalculations.cashIn.toFixed(2)}\n`
    msg += `• Digital UPI: ₹${dayCalculations.upiIn.toFixed(2)}\n`
    msg += `• Total Expenses: ₹${(dayCalculations.cashOut + dayCalculations.upiOut).toFixed(2)}\n`
    msg += `• Opening Cash: ₹${openingCash.toFixed(2)}\n`
    msg += `• *Closing Cash in Drawer: ₹${dayCalculations.closingCash.toFixed(2)}*\n`
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
    const encoded = encodeURIComponent(msg)
    window.open(`https://api.whatsapp.com/send?phone=${business?.phone || ''}&text=${encoded}`, '_blank')
  }

  // Create Expense Submit
  const handleExpenseSubmit = async (e) => {
    e.preventDefault()
    const amt = Number(expAmount || 0)
    if (!expName.trim() || amt <= 0) {
      showToast('Enter valid expense details', 'error')
      return
    }
    setIsSubmittingExp(true)
    try {
      await createExpenseMutation.mutateAsync({
        item_name: expName.trim(),
        category: expCat,
        total: amt,
        amount: amt,
        cash_amount: expMethod === 'cash' ? amt : 0,
        upi_amount: expMethod === 'upi' ? amt : 0,
        date: selectedDate,
      })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      showToast(`Expense of ₹${amt.toFixed(2)} saved!`, 'success')
      setExpName('')
      setExpAmount('')
      setShowAddExpenseSheet(false)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsSubmittingExp(false)
    }
  }

  // Process Refund Submit
  const handleRefundSubmit = async (e) => {
    e.preventDefault()
    const amt = Number(refAmount || 0)
    if (amt <= 0) {
      showToast('Enter valid refund amount', 'error')
      return
    }
    setIsSubmittingRef(true)
    try {
      if (processRefund) {
        processRefund({
          customerId: refCustomerId || undefined,
          amount: amt,
          method: refMethod,
          reason: refReason.trim() || 'Mobile Refund',
        })
      }
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      showToast(`Refund of ₹${amt.toFixed(2)} processed!`, 'success')
      setRefAmount('')
      setRefReason('')
      setShowRefundSheet(false)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsSubmittingRef(false)
    }
  }

  return (
    <MobileLayout title="Finance & Accounts">
      {/* 1. Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>FINANCIAL CENTER</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>ACCOUNTS</h2>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="mobile-btn mobile-btn-secondary"
            onClick={() => setShowDenomSheet(true)}
            style={{ width: 'auto', padding: '0 10px', minHeight: '34px', fontSize: '0.75rem' }}
          >
            <Calculator size={14} color="var(--aurora-cyan, #00f0ff)" /> Count
          </button>
          <button
            type="button"
            className="mobile-btn mobile-btn-primary"
            onClick={handleShareWhatsAppZReport}
            style={{ width: 'auto', padding: '0 10px', minHeight: '34px', fontSize: '0.75rem', backgroundColor: '#25D366' }}
          >
            <MessageSquare size={14} /> Z-Report
          </button>
        </div>
      </div>

      {/* ── ACCOUNTS RECEIVABLE MOBILE SUMMARY BANNER ── */}
      <div
        className="mobile-card"
        style={{
          marginBottom: '14px',
          padding: '12px 14px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 56, 96, 0.3)',
          background: 'linear-gradient(135deg, rgba(255, 56, 96, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/customers?filter=with-dues')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <CreditCard size={13} color="var(--error)" />
              <span>Accounts Receivable (Net Dues)</span>
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--error)', margin: '4px 0 2px' }}>
              ₹{accountsReceivableData.totalReceivables.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {accountsReceivableData.debtorCount} debtor{accountsReceivableData.debtorCount === 1 ? '' : 's'} · ₹{accountsReceivableData.totalGrossDue.toFixed(2)} gross · ₹{accountsReceivableData.totalAdvancePool.toFixed(2)} adv pool
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--accent-secondary)', fontSize: '0.75rem', fontWeight: 700, marginTop: '4px' }}>
            <span>Ledger</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* 2. 5 Sub-Tabs Pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '14px' }}>
        {[
          { key: 'register', label: 'Cashbook' },
          { key: 'expenses', label: `Expenses (${expenses.length})` },
          { key: 'refunds', label: 'Refunds' },
          { key: 'analytics', label: 'P&L & Analytics' },
          { key: 'items', label: 'Item Sales' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key)
              setSearchParams({ tab: tab.key })
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              border: activeTab === tab.key ? '1px solid var(--aurora-cyan, #00f0ff)' : '1px solid var(--border)',
              background: activeTab === tab.key ? 'rgba(0, 240, 255, 0.15)' : 'var(--bg-card)',
              color: activeTab === tab.key ? 'var(--aurora-cyan, #00f0ff)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: CASHBOOK & REGISTER */}
      {activeTab === 'register' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Calendar size={16} color="var(--aurora-cyan, #00f0ff)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date:</span>
            <input
              type="date"
              className="mobile-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ minHeight: '32px', fontSize: '0.8rem', padding: '4px 8px', flex: 1 }}
            />
          </div>

          {/* KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CASH IN DRAWER</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981' }}>
                ₹{dayCalculations.closingCash.toFixed(2)}
              </div>
            </div>

            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid var(--aurora-cyan, #00f0ff)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>UPI INFLOW</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--aurora-cyan, #00f0ff)' }}>
                ₹{dayCalculations.upiIn.toFixed(2)}
              </div>
            </div>

            <div className="mobile-card" style={{ padding: '12px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CASH COLLECTED</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                ₹{dayCalculations.cashIn.toFixed(2)}
              </div>
            </div>

            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid var(--aurora-amber, #f59e0b)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CASH OUTFLOWS</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--aurora-amber, #f59e0b)' }}>
                ₹{dayCalculations.cashOut.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSES */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Operating Expenses</div>
            <button
              type="button"
              className="mobile-btn mobile-btn-primary"
              onClick={() => setShowAddExpenseSheet(true)}
              style={{ width: 'auto', minHeight: '34px', fontSize: '0.75rem', padding: '0 12px' }}
            >
              <Plus size={14} /> + Record Expense
            </button>
          </div>

          {expenses.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No expenses recorded yet.
            </div>
          ) : (
            expenses.slice(0, 30).map((exp) => (
              <div key={exp.id} className="mobile-card" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{exp.itemName || exp.description}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {exp.category} • {exp.date ? exp.date.slice(0, 10) : ''}
                    </div>
                  </div>
                  <strong style={{ color: 'var(--aurora-amber, #f59e0b)', fontSize: '0.95rem' }}>
                    -₹{Number(exp.amount || exp.total || 0).toFixed(2)}
                  </strong>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: REFUNDS */}
      {activeTab === 'refunds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Customer Refunds</div>
            <button
              type="button"
              className="mobile-btn mobile-btn-primary"
              onClick={() => setShowRefundSheet(true)}
              style={{ width: 'auto', minHeight: '34px', fontSize: '0.75rem', padding: '0 12px' }}
            >
              <Plus size={14} /> Process Refund
            </button>
          </div>

          {refundsList.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No refunds recorded.
            </div>
          ) : (
            refundsList.map((ref, idx) => (
              <div key={idx} className="mobile-card" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{ref.customerName || 'Refund'}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ref.reason || ref.notes || 'Reversal'}</div>
                  </div>
                  <strong style={{ color: 'var(--aurora-pink, #ff2fb0)' }}>
                    -₹{Math.abs(Number(ref.amount || ref.totalPaid || 0)).toFixed(2)}
                  </strong>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: ANALYTICS */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NET OPERATING PROFIT</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981' }}>
                ₹{analyticsData.netProfit.toFixed(2)}
              </div>
            </div>

            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid var(--aurora-cyan, #00f0ff)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NET MARGIN HEALTH</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--aurora-cyan, #00f0ff)' }}>
                {analyticsData.netMarginPct}%
              </div>
            </div>
          </div>

          <div className="mobile-card" style={{ padding: '12px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>Net Revenue</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              ₹{analyticsData.netRev.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Total Expenses: ₹{analyticsData.totalExp.toFixed(2)} • Refunds: ₹{analyticsData.totalRef.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ITEM SALES */}
      {activeTab === 'items' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Controls: SubTab & Period */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setItemSubTab('catalog')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: itemSubTab === 'catalog' ? 700 : 500,
                  background: itemSubTab === 'catalog' ? 'var(--aurora-cyan, #00f0ff)' : 'transparent',
                  color: itemSubTab === 'catalog' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Catalog ({catalogAnalytics.length})
              </button>
              <button
                type="button"
                onClick={() => setItemSubTab('custom')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: itemSubTab === 'custom' ? 700 : 500,
                  background: itemSubTab === 'custom' ? 'var(--aurora-cyan, #00f0ff)' : 'transparent',
                  color: itemSubTab === 'custom' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Custom ({customAnalytics.length})
              </button>
            </div>

            <select
              value={itemPeriod}
              onChange={(e) => setItemPeriod(e.target.value)}
              className="mobile-input"
              style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.72rem', width: 'auto' }}
            >
              {STATEMENT_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* List items */}
          {itemSubTab === 'catalog' ? (
            catalogAnalytics.length === 0 ? (
              <div className="mobile-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No catalog sales in selected period.
              </div>
            ) : (
              catalogAnalytics.map((prod) => (
                <div
                  key={prod.product_id}
                  className="mobile-card"
                  onClick={() => setSelectedItemProduct(prod)}
                  style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.product_name}</span>
                      {prod.product_code && (
                        <span style={{ fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px', background: 'rgba(0,240,255,0.1)', color: '#00f0ff', fontFamily: 'monospace' }}>
                          {prod.product_code}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {prod.total_quantity_sold} sold • Avg ₹{prod.average_selling_rate.toFixed(1)}
                      {prod.has_price_variance && (
                        <span style={{ marginLeft: '6px', color: '#f59e0b' }}>• Dynamic</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>
                      ₹{prod.total_revenue.toFixed(2)}
                    </strong>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              ))
            )
          ) : (
            customAnalytics.length === 0 ? (
              <div className="mobile-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No custom services in selected period.
              </div>
            ) : (
              customAnalytics.map((item, idx) => (
                <div
                  key={idx}
                  className="mobile-card"
                  onClick={() => setSelectedItemCustom(item)}
                  style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.product_name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {item.total_quantity} qty • Rate: ₹{item.min_rate.toFixed(0)}-₹{item.max_rate.toFixed(0)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>
                      ₹{item.total_revenue.toFixed(2)}
                    </strong>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* Denomination Counter BottomSheet */}
      <BottomSheet isOpen={showDenomSheet} onClose={() => setShowDenomSheet(false)} title="Cash Drawer Note Counter">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>EXPECTED</div>
              <strong>₹{dayCalculations.closingCash.toFixed(2)}</strong>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>COUNTED</div>
              <strong style={{ color: 'var(--aurora-cyan, #00f0ff)' }}>₹{totalCountedCash.toFixed(2)}</strong>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>VARIANCE</div>
              <strong style={{ color: cashVariance === 0 ? '#10b981' : cashVariance > 0 ? 'var(--aurora-cyan, #00f0ff)' : '#ef4444' }}>
                {cashVariance >= 0 ? '+' : ''}₹{cashVariance.toFixed(2)}
              </strong>
            </div>
          </div>

          {DENOMINATIONS.map((denom) => (
            <div key={denom} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>₹{denom} note</span>
              <input
                type="number"
                min="0"
                className="mobile-input"
                style={{ width: '80px', minHeight: '32px', textAlign: 'center' }}
                placeholder="0"
                value={denomCounts[denom] || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value || '0', 10) || 0
                  setDenomCounts((prev) => ({ ...prev, [denom]: val }))
                }}
              />
            </div>
          ))}

          <button
            type="button"
            className="mobile-btn mobile-btn-primary"
            onClick={() => {
              showToast(`Drawer verified: ₹${totalCountedCash.toFixed(2)}`, 'success')
              setShowDenomSheet(false)
            }}
          >
            Confirm Count
          </button>
        </div>
      </BottomSheet>

      {/* Record Expense BottomSheet */}
      <BottomSheet isOpen={showAddExpenseSheet} onClose={() => setShowAddExpenseSheet(false)} title="Record Business Expense">
        <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            className="mobile-input"
            placeholder="Expense title *"
            value={expName}
            onChange={(e) => setExpName(e.target.value)}
            required
          />
          <select className="mobile-input" value={expCat} onChange={(e) => setExpCat(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            className="mobile-input"
            placeholder="Amount (₹) *"
            value={expAmount}
            onChange={(e) => setExpAmount(e.target.value)}
            required
          />
          <select className="mobile-input" value={expMethod} onChange={(e) => setExpMethod(e.target.value)}>
            <option value="cash">Cash from Register</option>
            <option value="upi">UPI / Bank</option>
          </select>
          <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isSubmittingExp}>
            {isSubmittingExp ? 'Saving...' : 'Save Expense'}
          </button>
        </form>
      </BottomSheet>

      {/* Process Refund BottomSheet */}
      <BottomSheet isOpen={showRefundSheet} onClose={() => setShowRefundSheet(false)} title="Process Refund">
        <form onSubmit={handleRefundSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="number"
            step="0.01"
            className="mobile-input"
            placeholder="Refund Amount (₹) *"
            value={refAmount}
            onChange={(e) => setRefAmount(e.target.value)}
            required
          />
          <select className="mobile-input" value={refMethod} onChange={(e) => setRefMethod(e.target.value)}>
            <option value="cash">Cash Out</option>
            <option value="upi">UPI Transfer</option>
            <option value="credit">Advance Credit</option>
          </select>
          <input
            type="text"
            className="mobile-input"
            placeholder="Reason for refund *"
            value={refReason}
            onChange={(e) => setRefReason(e.target.value)}
            required
          />
          <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isSubmittingRef}>
            {isSubmittingRef ? 'Processing...' : 'Confirm Refund'}
          </button>
        </form>
      </BottomSheet>

      {/* Product Drilldown Modal (Bottom Sheet on Mobile) */}
      <ProductDrilldownModal
        isOpen={!!selectedItemProduct}
        onClose={() => setSelectedItemProduct(null)}
        productData={selectedItemProduct}
        business={business}
        periodLabel={itemPeriod}
      />

      {/* Custom Service Drilldown Modal (Bottom Sheet on Mobile) */}
      <CustomServiceDrilldownModal
        isOpen={!!selectedItemCustom}
        onClose={() => setSelectedItemCustom(null)}
        serviceData={selectedItemCustom}
        business={business}
        periodLabel={itemPeriod}
      />
    </MobileLayout>
  )
}
