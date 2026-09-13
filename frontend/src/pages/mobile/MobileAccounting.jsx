import React, { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { useExpenses, useExpenseMutations } from '../../hooks/useExpensesQuery'
import { usePayments, useInventory, useAdvancePayments, useDeletedPayments } from '../../hooks/useEntitiesQuery'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Trash2, Calendar,
  FileText, Search, Loader2, AlertCircle, RefreshCw, Download,
  Receipt, Wallet, Layers, ShieldCheck, ChevronRight, CheckCircle,
  ArrowDownRight, ArrowUpRight, Clock, Filter, Banknote, Smartphone
} from 'lucide-react'
import { SequenceService } from '../../services/sequenceService'
import '../../styles/mobile.css'

export default function MobileAccounting() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    showToast,
    syncFromCloud,
    settings,
    bills: contextBills = [],
    payments: contextPayments = [],
    customers: contextCustomers = [],
    inventory: contextInventory = [],
    advancePayments: contextAdvances = [],
    deletedPayments: contextDeletedPayments = [],
    addExpense: contextAddExpense,
    deleteExpense: contextDeleteExpense
  } = useAppContext()

  // TanStack Query & Mutation hooks
  const { data: serverExpenses = [], isLoading: isLoadingExpenses, isError, error } = useExpenses()
  const { createExpense, deleteExpense, isCreatingExpense, isDeletingExpense } = useExpenseMutations()
  const { data: serverBills = [] } = useBills()
  const { data: serverPayments = [] } = usePayments()
  const { data: serverCustomers = [] } = useCustomers()
  const { data: serverInventory = [] } = useInventory()
  const { data: serverAdvances = [] } = useAdvancePayments()
  const { data: serverDeletedPayments = [] } = useDeletedPayments()

  // Unified Reactive Data Sources
  const bills = serverBills.length > 0 ? serverBills : contextBills
  const customers = serverCustomers.length > 0 ? serverCustomers : contextCustomers
  const payments = serverPayments.length > 0 ? serverPayments : contextPayments
  const inventory = serverInventory.length > 0 ? serverInventory : contextInventory
  const advancePayments = serverAdvances.length > 0 ? serverAdvances : (contextAdvances || [])
  const deletedPayments = serverDeletedPayments.length > 0 ? serverDeletedPayments : (contextDeletedPayments || [])
  const expenses = serverExpenses

  const previewExpenseCode = useMemo(() => {
    return SequenceService.peekNextSequence(
      'EXPENSE',
      expenses,
      settings?.expPrefix || 'EXP',
      settings?.seqPadding || 6
    )
  }, [expenses, settings?.expPrefix, settings?.seqPadding])

  const [activeTab, setActiveTab] = useState('expenses') // 'expenses' | 'gst'
  const [period, setPeriod] = useState('all') // 'all' | 'today' | 'week' | 'month' | 'fy'
  const [filterCategory, setFilterCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Expense Form State
  const [category, setCategory] = useState('Supplies')
  const [amount, setAmount] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [upiAmount, setUpiAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      if (syncFromCloud) await syncFromCloud()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['bills'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['advancePayments'] }),
        queryClient.invalidateQueries({ queryKey: ['accounting'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      ])
      showToast('Cloud Data Synced Successfully', 'success')
    } catch (e) {
      showToast('Sync Failed: Check network connection', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  // ── Date Range Filtering Helper ──
  const isDateInPeriod = useCallback((itemDateStr, selectedPeriod) => {
    if (!itemDateStr || selectedPeriod === 'all') return true
    try {
      const itemDate = new Date(itemDateStr)
      if (isNaN(itemDate.getTime())) return true
      const now = new Date()

      if (selectedPeriod === 'today') {
        const itemDateOnly = itemDate.toISOString().slice(0, 10)
        const todayOnly = now.toISOString().slice(0, 10)
        return itemDateOnly === todayOnly
      }

      if (selectedPeriod === 'week') {
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(now.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0)
        return itemDate >= sevenDaysAgo
      }

      if (selectedPeriod === 'month') {
        const itemMonthOnly = itemDate.toISOString().slice(0, 7)
        const currentMonthOnly = now.toISOString().slice(0, 7)
        return itemMonthOnly === currentMonthOnly
      }

      if (selectedPeriod === 'fy') {
        const curMonth = now.getMonth() // 0-indexed (3 = April)
        const curYear = now.getFullYear()
        const startYear = curMonth >= 3 ? curYear : curYear - 1
        const fyStart = new Date(startYear, 3, 1, 0, 0, 0)
        const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59)
        return itemDate >= fyStart && itemDate <= fyEnd
      }

      return true
    } catch {
      return true
    }
  }, [])

  // Accounting Financial Calculations matching desktop Accounting.jsx
  const financialTotals = useMemo(() => {
    const periodBills = (bills || []).filter(b => !b.deleted && !b.deleted_at && !b.isGroupParent && !b.is_group_parent && isDateInPeriod(b.date || b.created_at, period))
    const periodExpenses = (expenses || []).filter(e => isDateInPeriod(e.date || e.created_at, period))
    const periodPayments = (payments || []).filter(p => isDateInPeriod(p.date || p.created_at, period))
    const periodAdvances = (advancePayments || []).filter(ap => isDateInPeriod(ap.date || ap.created_at, period))
    const periodDeletedPayments = (deletedPayments || []).filter(dp => isDateInPeriod(dp.date || dp.created_at, period))

    const totalRev = periodBills.reduce((s, b) => s + Number(b.total || 0), 0)
    const totalExp = periodExpenses.reduce((s, e) => s + Number(e.amount || e.total || 0), 0)

    // Normal Inflow Payments
    const deletedBillIds = new Set((bills || []).filter(b => b.deleted || b.deleted_at).map(b => String(b.id)))
    const normalPayments = periodPayments.filter(p => {
      const isRef = p.isRefund || p.is_refund || p.paymentType === 'refund' || Number(p.totalPaid || p.total_paid || 0) < 0
      const isFifoAdv = p.notes?.includes('from advance deposit') || p.notes?.includes('FIFO payment')
      const isDeletedBill = deletedBillIds.has(String(p.billId || p.bill_id))
      return !isRef && !isFifoAdv && !isDeletedBill && Number(p.totalPaid || p.total_paid || 0) >= 0
    })

    // Valid Non-Credit Advance Inflow
    const validAdvances = periodAdvances.filter(ap => {
      const isRefCredit = ap.isRefundCredit || ap.is_refund_credit
      const isRet = ap.isReturn || ap.is_return || Number(ap.amount || 0) < 0
      const isExc = ap.isExcessCredit || ap.is_excess_credit || ap.notes?.toLowerCase().includes('excess')
      const isOp = ap.notes?.toLowerCase().includes('opening')
      return !isRefCredit && !isRet && !isExc && !isOp && Number(ap.amount || 0) > 0
    })

    // Gross Inflows
    const cashFromNormalPayments = normalPayments.reduce((s, p) => s + Number(p.cashAmount || p.cash_amount || 0), 0)
    const upiFromNormalPayments = normalPayments.reduce((s, p) => s + Number(p.upiAmount || p.upi_amount || 0), 0)
    const cashFromAdvances = validAdvances.reduce((s, ap) => s + Number(ap.cashAmount || ap.cash_amount || 0), 0)
    const upiFromAdvances = validAdvances.reduce((s, ap) => s + Number(ap.upiAmount || ap.upi_amount || 0), 0)

    const totalCashInflow = cashFromNormalPayments + cashFromAdvances
    const totalUpiInflow = upiFromNormalPayments + upiFromAdvances
    const totalInflow = totalCashInflow + totalUpiInflow

    // Expenses Outflow (Resilient Zero/Split Fallbacks)
    let cashSpent = 0
    let upiSpent = 0
    periodExpenses.forEach(e => {
      const eAmt = Number(e.amount || e.total || 0)
      const hasExplicitCash = e.cashAmount !== undefined && e.cashAmount !== null
      const hasExplicitCashSnake = e.cash_amount !== undefined && e.cash_amount !== null
      const hasExplicitUpi = e.upiAmount !== undefined && e.upiAmount !== null
      const hasExplicitUpiSnake = e.upi_amount !== undefined && e.upi_amount !== null

      let c = 0
      let u = 0

      if (hasExplicitCash) c = Number(e.cashAmount)
      else if (hasExplicitCashSnake) c = Number(e.cash_amount)

      if (hasExplicitUpi) u = Number(e.upiAmount)
      else if (hasExplicitUpiSnake) u = Number(e.upi_amount)

      // If neither cash nor upi explicitly set, default to 100% Cash
      if (!hasExplicitCash && !hasExplicitCashSnake && !hasExplicitUpi && !hasExplicitUpiSnake) {
        c = eAmt
      }

      cashSpent += c
      upiSpent += u
    })

    // Outflow 1: Bill Refunds (Negative payments or refund flag)
    const refundPayments = periodPayments.filter(p => p.isRefund || p.is_refund || p.paymentType === 'refund' || Number(p.totalPaid || p.total_paid || 0) < 0)
    const refundCash = refundPayments.reduce((s, p) => s + Math.abs(Number(p.cashAmount || p.cash_amount || 0)), 0)
    const refundUpi = refundPayments.reduce((s, p) => s + Math.abs(Number(p.upiAmount || p.upi_amount || 0)), 0)
    const totalRefunds = refundPayments.reduce((s, p) => s + Math.abs(Number(p.totalPaid || p.total_paid || 0)), 0)

    // Outflow 2: Advance Returns
    const advReturns = periodAdvances.filter(ap => Number(ap.amount || 0) < 0 || ap.isReturn || ap.is_return)
    const advReturnCash = advReturns.reduce((s, ap) => s + Math.abs(Number(ap.cashAmount || ap.cash_amount || 0)), 0)
    const advReturnUpi = advReturns.reduce((s, ap) => s + Math.abs(Number(ap.upiAmount || ap.upi_amount || 0)), 0)
    const totalAdvReturns = advReturns.reduce((s, ap) => s + Math.abs(Number(ap.amount || 0)), 0)

    // Outflow 3: Deleted Payments Outflow
    const delPayCash = periodDeletedPayments.reduce((s, dp) => s + Math.abs(Number(dp.cashAmount || dp.cash_amount || 0)), 0)
    const delPayUpi = periodDeletedPayments.reduce((s, dp) => s + Math.abs(Number(dp.upiAmount || dp.upi_amount || 0)), 0)
    const totalDelPayments = periodDeletedPayments.reduce((s, dp) => s + Math.abs(Number(dp.totalPaid || dp.total_paid || 0)), 0)

    // Reconciled Drawer Metrics
    const totalCashOutflow = cashSpent + refundCash + advReturnCash + delPayCash
    const totalUpiOutflow = upiSpent + refundUpi + advReturnUpi + delPayUpi
    const totalOutflow = totalExp + totalRefunds + totalAdvReturns + totalDelPayments

    const netPhysicalCashOnHand = totalCashInflow - totalCashOutflow
    const netUpiDigitalBalance = totalUpiInflow - totalUpiOutflow
    const netProfit = totalInflow - totalOutflow

    return {
      totalRev,
      totalExp,
      totalInflow,
      totalCashInflow,
      totalUpiInflow,
      cashFromNormalPayments,
      cashFromAdvances,
      upiFromNormalPayments,
      upiFromAdvances,
      cashSpent,
      upiSpent,
      totalRefunds,
      refundCash,
      refundUpi,
      refundCount: refundPayments.length,
      totalAdvReturns,
      advReturnCash,
      advReturnUpi,
      advReturnCount: advReturns.length,
      totalCashOutflow,
      totalUpiOutflow,
      netPhysicalCashOnHand,
      netUpiDigitalBalance,
      netProfit
    }
  }, [bills, expenses, payments, advancePayments, deletedPayments, period, isDateInPeriod])

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => {
      if (!isDateInPeriod(e.date || e.created_at, period)) return false
      if (filterCategory !== 'all' && e.category !== filterCategory) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        return (e.description || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q) || (e.expenseCode || e.expense_code || '').toLowerCase().includes(q)
      }
      return true
    }).sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
  }, [expenses, filterCategory, searchTerm, period, isDateInPeriod])

  // ── GST Report Calculations (Matching desktop Accounting.jsx) ──
  const gstReport = useMemo(() => {
    let totalTaxable = 0
    let totalCGST = 0
    let totalSGST = 0
    let totalGST = 0

    const ratesMap = {
      0: { taxable: 0, cgst: 0, sgst: 0, total: 0 },
      5: { taxable: 0, cgst: 0, sgst: 0, total: 0 },
      12: { taxable: 0, cgst: 0, sgst: 0, total: 0 },
      18: { taxable: 0, cgst: 0, sgst: 0, total: 0 },
    }
    const hsnMap = {}
    const b2bList = []
    const b2cList = []

    const validBills = (bills || []).filter(b => !b.deleted && !b.deleted_at && !b.isGroupParent && !b.is_group_parent && isDateInPeriod(b.date || b.created_at, period))

    validBills.forEach(b => {
      const cust = (customers || []).find(c => String(c.id) === String(b.customerId || b.customer_id))
      const gstin = b.customerGstin || b.customer_gstin || cust?.gstin || ''

      let billTaxable = 0
      let billCGST = 0
      let billSGST = 0
      let billGST = 0

      if (b.items && b.items.length > 0) {
        b.items.forEach(item => {
          const rate = Number(item.gstRate ?? item.gst_rate ?? b.gstRate ?? b.gst_rate ?? settings?.gstRate ?? 0)
          const totalAmt = Number(item.amount || 0)
          const qty = Number(item.qty || 1)

          const taxable = rate > 0 ? (totalAmt / (1 + rate / 100)) : totalAmt
          const gst = totalAmt - taxable
          const halfGst = gst / 2

          billTaxable += taxable
          billGST += gst
          billCGST += halfGst
          billSGST += halfGst

          if (!ratesMap[rate]) ratesMap[rate] = { taxable: 0, cgst: 0, sgst: 0, total: 0 }
          ratesMap[rate].taxable += taxable
          ratesMap[rate].cgst += halfGst
          ratesMap[rate].sgst += halfGst
          ratesMap[rate].total += totalAmt

          const invItem = (inventory || []).find(i => String(i.id) === String(item.itemId || item.item_id))
          const hsn = invItem?.hsnCode || invItem?.hsn_code || '9989'
          if (!hsnMap[hsn]) hsnMap[hsn] = { hsn, taxable: 0, cgst: 0, sgst: 0, total: 0, qty: 0 }
          hsnMap[hsn].taxable += taxable
          hsnMap[hsn].cgst += halfGst
          hsnMap[hsn].sgst += halfGst
          hsnMap[hsn].total += totalAmt
          hsnMap[hsn].qty += qty
        })
      } else {
        const totalAmt = Number(b.total || 0)
        const billGstAmount = Number(b.gstAmount || b.gst_amount || 0)
        const taxable = Math.max(0, totalAmt - billGstAmount)
        const rate = Number(b.gstRate ?? b.gst_rate ?? (billGstAmount > 0 && taxable > 0 ? Math.round((billGstAmount / taxable) * 100) : (settings?.gstRate ?? 0)))
        const halfGst = billGstAmount / 2

        billTaxable += taxable
        billGST += billGstAmount
        billCGST += halfGst
        billSGST += halfGst

        if (!ratesMap[rate]) ratesMap[rate] = { taxable: 0, cgst: 0, sgst: 0, total: 0 }
        ratesMap[rate].taxable += taxable
        ratesMap[rate].cgst += halfGst
        ratesMap[rate].sgst += halfGst
        ratesMap[rate].total += totalAmt

        const hsn = '9989'
        if (!hsnMap[hsn]) hsnMap[hsn] = { hsn, taxable: 0, cgst: 0, sgst: 0, total: 0, qty: 0 }
        hsnMap[hsn].taxable += taxable
        hsnMap[hsn].cgst += halfGst
        hsnMap[hsn].sgst += halfGst
        hsnMap[hsn].total += totalAmt
        hsnMap[hsn].qty += 1
      }

      totalTaxable += billTaxable
      totalCGST += billCGST
      totalSGST += billSGST
      totalGST += billGST

      const record = {
        billId: b.invoiceNumber || b.invoice_number || b.id,
        date: b.date || b.created_at,
        customerName: b.customerName || b.customer_name || 'Walk-in',
        gstin,
        taxable: billTaxable,
        cgst: billCGST,
        sgst: billSGST,
        total: Number(b.total || 0)
      }

      if (gstin) {
        b2bList.push(record)
      } else {
        b2cList.push(record)
      }
    })

    return {
      totalTaxable,
      totalCGST,
      totalSGST,
      totalGST,
      rates: Object.entries(ratesMap).map(([rate, vals]) => ({ rate: Number(rate), ...vals })),
      hsn: Object.values(hsnMap),
      b2b: b2bList,
      b2c: b2cList
    }
  }, [bills, customers, inventory, settings?.gstRate, period, isDateInPeriod])

  const exportGSTR1CSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,GSTIN of Recipient,Receiver Name,Invoice Number,Invoice Date,Invoice Value,Taxable Value,CGST Amount,SGST Amount,Total GST\n'
    gstReport.b2b.forEach(row => {
      csvContent += `"${row.gstin || ''}","${row.customerName || ''}","${row.billId || ''}","${row.date || ''}",${Number(row.total || 0).toFixed(2)},${Number(row.taxable || 0).toFixed(2)},${Number(row.cgst || 0).toFixed(2)},${Number(row.sgst || 0).toFixed(2)},${Number((row.cgst || 0) + (row.sgst || 0)).toFixed(2)}\n`
    })

    csvContent += '\nB2C INVOICES SUMMARY\nReceiver Name,Invoice Number,Invoice Date,Invoice Value,Taxable Value,Total GST\n'
    gstReport.b2c.forEach(row => {
      csvContent += `"${row.customerName || ''}","${row.billId || ''}","${row.date || ''}",${Number(row.total || 0).toFixed(2)},${Number(row.taxable || 0).toFixed(2)},${Number((row.cgst || 0) + (row.sgst || 0)).toFixed(2)}\n`
    })

    csvContent += '\nHSN SUMMARY\nHSN Code,Taxable Value,CGST Amount,SGST Amount,Total GST,Quantity\n'
    gstReport.hsn.forEach(row => {
      csvContent += `"${row.hsn || '9989'}",${Number(row.taxable || 0).toFixed(2)},${Number(row.cgst || 0).toFixed(2)},${Number(row.sgst || 0).toFixed(2)},${Number((row.cgst || 0) + (row.sgst || 0)).toFixed(2)},${Number(row.qty || 0)}\n`
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `GSTR1_Report_${period}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('GSTR-1 Tax Report Downloaded!', 'success')
  }

  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault()
    const amt = Number(amount)
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid expense amount', 'error')
      return
    }

    const cAmt = cashAmount !== '' ? Number(cashAmount) : 0
    const uAmt = upiAmount !== '' ? Number(upiAmount) : 0

    if (cashAmount !== '' || upiAmount !== '') {
      if (Math.abs(cAmt + uAmt - amt) > 0.05) {
        showToast('Cash + UPI split must equal total expense amount', 'error')
        return
      }
    }

    const finalCash = (cashAmount === '' && upiAmount === '') ? amt : cAmt
    const finalUpi = uAmt

    try {
      const payload = {
        category,
        amount: amt,
        total: amt,
        cash_amount: finalCash,
        cashAmount: finalCash,
        upi_amount: finalUpi,
        upiAmount: finalUpi,
        description: description.trim() || category,
        item_name: description.trim() || category,
        date,
      }

      // 1. Optimistic update local AppContext if available
      if (contextAddExpense) {
        try {
          contextAddExpense(payload)
        } catch (_) {}
      }

      // 2. TanStack Cloud Mutation
      await createExpense(payload)

      // 3. Invalidate query keys for 0ms reactive UI refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['accounting'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      ])

      showToast(`Recorded ₹${amt.toFixed(2)} expense!`, 'success')
      setAmount('')
      setCashAmount('')
      setUpiAmount('')
      setDescription('')
      setShowAddModal(false)
    } catch (err) {
      showToast(err.message || 'Failed to record expense', 'error')
    }
  }

  const handleDeleteExpense = async (id) => {
    if (window.confirm('Remove this expense entry?')) {
      try {
        if (contextDeleteExpense) {
          try {
            contextDeleteExpense(id)
          } catch (_) {}
        }
        await deleteExpense(id)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['expenses'] }),
          queryClient.invalidateQueries({ queryKey: ['accounting'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        ])
        showToast('Expense entry deleted', 'info')
      } catch (err) {
        showToast(err.message || 'Failed to delete expense', 'error')
      }
    }
  }

  return (
    <MobileLayout title="Accounting & GST">
      {/* Header with Sync Data Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>FINANCIAL LEDGER</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>ACCOUNTING</h2>
        </div>
        <button
          className="mobile-icon-btn"
          onClick={handleSync}
          disabled={isSyncing}
          title="Sync Cloud Data"
          style={{ width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
        >
          <RefreshCw size={18} className={isSyncing ? 'spin' : ''} />
        </button>
      </div>

      {/* Period Time Filtering Selector */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
        {[
          { key: 'all', label: 'All Time' },
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'fy', label: 'FY 2024-25' }
        ].map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem',
              fontWeight: 800,
              border: period === p.key ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: period === p.key ? 'rgba(255, 47, 176, 0.18)' : 'var(--bg-card)',
              color: period === p.key ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Main Tab Toggle: Expenses vs GST Filings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`mobile-btn ${activeTab === 'expenses' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
          onClick={() => setActiveTab('expenses')}
          style={{ minHeight: '40px', fontSize: '0.82rem' }}
        >
          <Wallet size={16} /> Cash Flow & Ledger
        </button>
        <button
          className={`mobile-btn ${activeTab === 'gst' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
          onClick={() => setActiveTab('gst')}
          style={{ minHeight: '40px', fontSize: '0.82rem' }}
        >
          <ShieldCheck size={16} /> GST Tax Filings
        </button>
      </div>

      {/* ── TAB 1: EXPENSES & CASH FLOW ── */}
      {activeTab === 'expenses' && (
        <div>
          {/* Net Cash Flow & Totals Banner */}
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
            <div className="mobile-card mobile-card-glow" style={{ minWidth: '200px', flex: '0 0 auto', borderColor: 'var(--accent-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET CASH PROFIT</span>
                <TrendingUp size={16} style={{ color: financialTotals.netProfit >= 0 ? 'var(--success)' : 'var(--error)' }} />
              </div>
              <div className="currency-num" style={{ fontSize: '1.4rem', color: financialTotals.netProfit >= 0 ? 'var(--success)' : 'var(--error)', marginTop: '4px' }}>
                ₹{financialTotals.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Inflows - Outflows
              </div>
            </div>

            <div className="mobile-card" style={{ minWidth: '180px', flex: '0 0 auto', borderColor: 'var(--accent-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL INFLOW</span>
                <ArrowUpRight size={16} style={{ color: 'var(--accent-secondary)' }} />
              </div>
              <div className="currency-num" style={{ fontSize: '1.4rem', color: 'var(--accent-secondary)', marginTop: '4px' }}>
                ₹{financialTotals.totalInflow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Bills + Advances
              </div>
            </div>

            <div className="mobile-card" style={{ minWidth: '180px', flex: '0 0 auto', borderColor: 'var(--accent-tertiary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL EXPENSES</span>
                <ArrowDownRight size={16} style={{ color: 'var(--accent-tertiary)' }} />
              </div>
              <div className="currency-num" style={{ fontSize: '1.4rem', color: 'var(--accent-tertiary)', marginTop: '4px' }}>
                ₹{financialTotals.totalExp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Operational Spend
              </div>
            </div>
          </div>

          {/* PHYSICAL CASH ON HAND DRAWER RECONCILIATION CARD */}
          <div className="mobile-card" style={{ marginBottom: '16px', borderColor: 'var(--accent-secondary)', background: 'linear-gradient(180deg, rgba(0, 240, 255, 0.04) 0%, rgba(13, 17, 23, 0.8) 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>DRAWER RECONCILIATION</span>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>PHYSICAL CASH ON HAND</h4>
              </div>
              <div className="currency-num" style={{ fontSize: '1.3rem', fontWeight: 900, color: financialTotals.netPhysicalCashOnHand >= 0 ? '#00f0ff' : 'var(--error)' }}>
                ₹{financialTotals.netPhysicalCashOnHand.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
              <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--success)', fontWeight: 800 }}>
                  <ArrowUpRight size={14} /> CASH INFLOW
                </div>
                <div className="currency-num" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                  ₹{financialTotals.totalCashInflow.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Bills: ₹{financialTotals.cashFromNormalPayments.toFixed(2)} | Adv: ₹{financialTotals.cashFromAdvances.toFixed(2)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--error)', fontWeight: 800 }}>
                  <ArrowDownRight size={14} /> CASH OUTFLOW
                </div>
                <div className="currency-num" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-tertiary)', marginTop: '4px' }}>
                  ₹{financialTotals.totalCashOutflow.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Exp: ₹{financialTotals.cashSpent.toFixed(2)} | Ref: ₹{(financialTotals.refundCash + financialTotals.advReturnCash).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* UPI DIGITAL LEDGER BREAKDOWN */}
          <div className="mobile-card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Smartphone size={16} style={{ color: 'var(--accent-primary)' }} />
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  UPI DIGITAL CHANNELS
                </h4>
              </div>
              <span className="currency-num" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                Net: ₹{financialTotals.netUpiDigitalBalance.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
              <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ color: 'var(--text-muted)' }}>UPI Received:</div>
                <div className="currency-num" style={{ fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                  ₹{financialTotals.totalUpiInflow.toFixed(2)}
                </div>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ color: 'var(--text-muted)' }}>UPI Paid / Refunded:</div>
                <div className="currency-num" style={{ fontWeight: 800, color: 'var(--accent-tertiary)', marginTop: '2px' }}>
                  ₹{financialTotals.totalUpiOutflow.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Refunds & Reversals Summary */}
          {(financialTotals.totalRefunds > 0 || financialTotals.totalAdvReturns > 0) && (
            <div className="mobile-card" style={{ marginBottom: '16px', borderColor: 'var(--warning)', background: 'rgba(255, 184, 0, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--warning)' }}>REFUNDS & RETURNS</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {financialTotals.refundCount} Bill Refund(s) • {financialTotals.advReturnCount} Advance Return(s)
                  </div>
                </div>
                <div className="currency-num" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--warning)' }}>
                  -₹{(financialTotals.totalRefunds + financialTotals.totalAdvReturns).toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Expense Journal Header & Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              EXPENSE ENTRIES ({filteredExpenses.length})
            </h3>
            <button
              className="mobile-btn mobile-btn-primary"
              onClick={() => setShowAddModal(true)}
              disabled={isCreatingExpense}
              style={{ width: 'auto', padding: '0 12px', fontSize: '0.78rem', minHeight: '34px' }}
            >
              <Plus size={16} /> + Expense
            </button>
          </div>

          {/* Search and Category Filter */}
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
            <input
              type="text"
              className="mobile-input"
              style={{ paddingLeft: '42px' }}
              placeholder="Search expenses by code, category, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '14px' }}>
            {['all', 'Supplies', 'Rent', 'Utilities', 'Maintenance', 'Salaries', 'Other'].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: filterCategory === cat ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                  background: filterCategory === cat ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
                  color: filterCategory === cat ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          {/* Expenses List */}
          {isLoadingExpenses ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="spin" style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
              <div style={{ fontSize: '0.85rem' }}>Loading expenses from cloud...</div>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <DollarSign size={40} style={{ opacity: 0.5, color: 'var(--accent-primary)', margin: '0 auto 8px auto' }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>No expenses found matching {period === 'all' ? 'filters' : `selected period (${period})`}.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredExpenses.map(e => {
                const eAmt = Number(e.amount || e.total || 0)
                const cPortion = e.cashAmount !== undefined && e.cashAmount !== null ? Number(e.cashAmount) : (e.cash_amount !== undefined ? Number(e.cash_amount) : (e.upiAmount || e.upi_amount ? 0 : eAmt))
                const uPortion = Number(e.upiAmount || e.upi_amount || 0)

                return (
                  <div key={e.id} className="mobile-card" style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-secondary)', marginRight: '6px' }}>
                            {e.expenseCode || e.expense_code || `EXP-${String(e.id).padStart(6, '0')}`}
                          </span>
                          {e.description || e.item_name || 'Expense'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {e.date} • <span style={{ color: 'var(--accent-secondary)' }}>{e.category}</span>
                        </div>
                        {(cPortion > 0 || uPortion > 0) && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {cPortion > 0 && <span style={{ marginRight: '6px' }}>Cash: ₹{cPortion.toFixed(2)}</span>}
                            {uPortion > 0 && <span>UPI: ₹{uPortion.toFixed(2)}</span>}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="currency-num" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-tertiary)' }}>
                          -₹{eAmt.toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          disabled={isDeletingExpense}
                          style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: GST TAX FILINGS ── */}
      {activeTab === 'gst' && (
        <div>
          {/* GST Overview Banner with Export Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>GSTR-1 / GSTR-3B</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>GST TAX SUMMARY</h3>
            </div>
            <button
              className="mobile-btn mobile-btn-primary"
              onClick={exportGSTR1CSV}
              style={{ width: 'auto', padding: '0 12px', fontSize: '0.75rem', minHeight: '34px' }}
            >
              <Download size={14} /> Export GSTR-1
            </button>
          </div>

          {/* 4 Metric Cards Grid (2x2) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div className="mobile-card" style={{ borderColor: 'var(--accent-secondary)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL TAXABLE</div>
              <div className="currency-num" style={{ fontSize: '1.25rem', color: '#ffffff', marginTop: '4px' }}>
                ₹{gstReport.totalTaxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="mobile-card" style={{ borderColor: 'var(--accent-primary)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL GST</div>
              <div className="currency-num" style={{ fontSize: '1.25rem', color: 'var(--accent-primary)', marginTop: '4px' }}>
                ₹{gstReport.totalGST.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="mobile-card">
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>CENTRAL GST (CGST)</div>
              <div className="currency-num" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                ₹{gstReport.totalCGST.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="mobile-card">
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>STATE GST (SGST)</div>
              <div className="currency-num" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                ₹{gstReport.totalSGST.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* B2B vs B2C Split Card */}
          <div className="mobile-card" style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
              B2B / B2C FILING SPLIT
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-secondary)', fontWeight: 800 }}>B2B INVOICES</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>{gstReport.b2b.length} Invoices</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total: ₹{gstReport.b2b.reduce((s, r) => s + (r.total || 0), 0).toFixed(2)}</div>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 800 }}>B2C INVOICES</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>{gstReport.b2c.length} Invoices</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total: ₹{gstReport.b2c.reduce((s, r) => s + (r.total || 0), 0).toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* GST By Rate Breakdown */}
          <div className="mobile-card" style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
              GST BY TAX RATE
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {gstReport.rates.map(r => (
                <div key={r.rate} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>{r.rate}% Slab</span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Taxable: ₹{Number(r.taxable || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="currency-num" style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      GST: ₹{Number((r.cgst || 0) + (r.sgst || 0)).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CGST: ₹{Number(r.cgst || 0).toFixed(2)} • SGST: ₹{Number(r.sgst || 0).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HSN Summary */}
          <div className="mobile-card" style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
              HSN CODE SUMMARY ({gstReport.hsn.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {gstReport.hsn.map(h => (
                <div key={h.hsn} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono' }}>HSN {h.hsn}</span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Qty: {h.qty} • Taxable: ₹{Number(h.taxable || 0).toFixed(2)}</div>
                  </div>
                  <div className="currency-num" style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                    ₹{Number((h.cgst || 0) + (h.sgst || 0)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Bottom Sheet */}
      <BottomSheet
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Record Operational Expense"
      >
        <form onSubmit={handleAddExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-Assigned Code:</span>
            <strong style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#3b82f6' }}>{previewExpenseCode}</strong>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              CATEGORY
            </label>
            <select
              className="mobile-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Supplies">Supplies & Paper</option>
              <option value="Rent">Shop Rent</option>
              <option value="Utilities">Electricity & Internet</option>
              <option value="Maintenance">Machine Maintenance</option>
              <option value="Salaries">Staff Wages</option>
              <option value="Other">Other Miscellaneous</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              TOTAL AMOUNT (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              className="mobile-input currency-num"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Cash / UPI Split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>CASH PORTION (₹)</label>
              <input
                type="number"
                step="0.01"
                className="mobile-input currency-num"
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>UPI PORTION (₹)</label>
              <input
                type="number"
                step="0.01"
                className="mobile-input currency-num"
                placeholder="0.00"
                value={upiAmount}
                onChange={(e) => setUpiAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              DESCRIPTION / NOTES
            </label>
            <input
              type="text"
              className="mobile-input"
              placeholder="e.g. 5 Reams A4 80GSM paper"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              DATE
            </label>
            <input
              type="date"
              className="mobile-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="mobile-btn mobile-btn-primary"
            disabled={isCreatingExpense}
            style={{ marginTop: '8px' }}
          >
            {isCreatingExpense ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <Loader2 size={16} className="spin" /> Recording...
              </span>
            ) : (
              'Save Expense Entry'
            )}
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
