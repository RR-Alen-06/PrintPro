import { useState, useMemo, useEffect } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  AlertTriangle,
  Trash2,
  CheckCircle,
  Plus,
  Banknote,
  Smartphone,
  CreditCard,
  Wallet,
  Clock,
  FileText,
  Download,
  Search,
  ShieldAlert,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  Printer
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Doughnut } from 'react-chartjs-2'
import '../utils/chartSetup'
import PeriodReport from '../components/PeriodReport'
import { getDisplayBillId, getDisplayCustomerId } from '../utils/idFormatter'
import { exportToCSV } from '../utils/csvExport'
import { jsPDF } from 'jspdf'

const EXPENSE_CATEGORIES = [
  'General',
  'Paper & Printing',
  'Ink & Toner',
  'Maintenance',
  'Utilities',
  'Rent',
  'Supplies',
  'Salaries',
  'Other'
]

const Accounting = () => {
  const { bills, payments, expenses, advancePayments, customers, business, addExpense, deleteExpense, deletedPayments } = useAppContext()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const validTabs = ['overview', 'income', 'expenses', 'receivables', 'advances', 'payments', 'ledger', 'reports']
  const urlTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => {
    return validTabs.includes(urlTab) ? urlTab : 'overview'
  })

  useEffect(() => {
    if (urlTab && validTabs.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
    }
  }, [urlTab, activeTab])

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId }, { replace: true })
  }

  // ── Period & Date Filter ────────────────────────────────────────────────────
  const [periodFilter, setPeriodFilter] = useState('all') // 'all', 'today', 'yesterday', 'week', 'last_week', 'month', 'last_month', 'quarter', 'year', 'fy', 'custom'
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedFY, setSelectedFY] = useState(
    new Date().getMonth() >= 3
      ? String(new Date().getFullYear())
      : String(new Date().getFullYear() - 1)
  )

  // Sub-filters & Searches
  const [incomeSearch, setIncomeSearch] = useState('')
  const [incomeTypeFilter, setIncomeTypeFilter] = useState('all') // 'all', 'regular', 'walkin', 'group'
  const [expenseSearch, setExpenseSearch] = useState('')
  const [expenseCatFilter, setExpenseCatFilter] = useState('all')
  const [receivablesSearch, setReceivablesSearch] = useState('')
  const [advancesSearch, setAdvancesSearch] = useState('')

  // Expense form state
  const today = new Date().toISOString().slice(0, 10)
  const [expForm, setExpForm] = useState({
    date: today,
    description: '',
    category: 'General',
    vendorName: '',
    amount: '',
    paymentMethod: 'cash',
    upiRef: '',
    cashAmount: '',
    upiAmount: '',
  })
  const [expError, setExpError] = useState('')
  const [expSuccess, setExpSuccess] = useState(false)

  // ── Date Range Calculation ──────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const now = new Date()
    const getStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
    const getEndOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

    let start = new Date(0)
    let end = new Date()

    if (periodFilter === 'today') {
      start = getStartOfDay(now)
      end = getEndOfDay(now)
    } else if (periodFilter === 'yesterday') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      start = getStartOfDay(y)
      end = getEndOfDay(y)
    } else if (periodFilter === 'week') {
      const day = now.getDay()
      const mon = new Date(now)
      mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      start = getStartOfDay(mon)
      end = getEndOfDay(now)
    } else if (periodFilter === 'last_week') {
      const day = now.getDay()
      const mon = new Date(now)
      mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      start = getStartOfDay(mon)
      end = getEndOfDay(sun)
    } else if (periodFilter === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      end = getEndOfDay(now)
    } else if (periodFilter === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    } else if (periodFilter === 'quarter') {
      const currentMonth = now.getMonth()
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3
      start = new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0)
      end = getEndOfDay(now)
    } else if (periodFilter === 'year') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      end = getEndOfDay(now)
    } else if (periodFilter === 'fy') {
      const startYear = parseInt(selectedFY, 10) || now.getFullYear()
      start = new Date(startYear, 3, 1, 0, 0, 0, 0)
      end = new Date(startYear + 1, 2, 31, 23, 59, 59, 999)
    } else if (periodFilter === 'custom') {
      if (customStartDate) start = new Date(customStartDate + 'T00:00:00')
      if (customEndDate) end = new Date(customEndDate + 'T23:59:59.999')
    }

    const inRange = (dStr) => {
      if (periodFilter === 'all') return true
      if (!dStr) return false
      const d = new Date(dStr)
      return d >= start && d <= end
    }

    return { start, end, inRange }
  }, [periodFilter, selectedFY, customStartDate, customEndDate])

  // ── Filtered Datasets ───────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    const { inRange } = dateRange
    return {
      bills: (bills || []).filter(b => !b.deleted && !b.isGroupParent && inRange(b.date)),
      payments: (payments || []).filter(p => inRange(p.date)),
      expenses: (expenses || []).filter(e => inRange(e.date)),
      advancePayments: (advancePayments || []).filter(ap => inRange(ap.date)),
    }
  }, [bills, payments, expenses, advancePayments, dateRange])

  // ── Strict Financial Calculations (Zero Formula Alterations) ────────────────
  const stats = useMemo(() => {
    const activeBills = filteredData.bills

    // 1. Separate normal payments from refund payments
    const isPaymentRefund = p => !!p.isRefund || !!p.is_refund || p.paymentType === 'refund' || p.payment_type === 'refund' || Number(p.totalPaid ?? p.total_paid ?? p.amount ?? 0) < 0
    const normalPayments = (filteredData.payments || []).filter(p => !isPaymentRefund(p) && Number(p.totalPaid ?? p.total_paid ?? p.amount ?? 0) >= 0)
    const refundPaymentsList = (filteredData.payments || []).filter(p => isPaymentRefund(p))

    // Realized Revenue = sum of amountPaid on active bills
    const realizedRevenue = activeBills.reduce((s, b) => s + Number(b.amountPaid || 0), 0)
    const totalBilled = activeBills.reduce((s, b) => s + Number(b.total || 0), 0)

    // Total refund outflow
    const totalRefundOutflow = refundPaymentsList.reduce((s, p) => s + Math.abs(Number(p.totalPaid ?? p.total_paid ?? p.amount ?? 0)), 0)

    const totalExpenses = (filteredData.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)

    // Net Profit = Realized Revenue − Total Expenses
    const netProfit = realizedRevenue - totalExpenses

    // Active customer advance balances
    const totalCustomerAdvance = customers
      .filter((c) => !c.deleted)
      .reduce((sum, c) => sum + Math.max(0, Number(c.advanceBalance || 0), Number(c.creditBalance || 0)), 0)

    const isAdvNote = (notes) => {
      if (!notes) return false
      const n = String(notes).toLowerCase()
      return n.includes('from advance deposit') || n.includes('advance deposit') || n.includes('credit balance')
    }

    // Cash inflow from payments (normal payments only)
    const pInflow = (filteredData.payments || [])
      .filter((p) => !isAdvNote(p.notes) && !isPaymentRefund(p) && Number(p.totalPaid ?? p.total_paid ?? p.amount ?? 0) >= 0)
      .reduce((sum, p) => sum + Number(p.cashAmount ?? p.cash_amount ?? 0) + Number(p.upiAmount ?? p.upi_amount ?? 0), 0)

    // Advance inflow EXCLUDING refund-credit advance deposits and EXCLUDING advance returns
    const isAdvReturn = (ap) => ap.isReturn || ap.type === 'return' || ap.type === 'refund' || ap.type === 'refunded' || Number(ap.amount || 0) < 0
    const validAdvances = (filteredData.advancePayments || [])
      .filter(ap => !ap.isRefundCredit && !isAdvReturn(ap) && Number(ap.amount || 0) > 0)

    const advInflow = validAdvances.reduce((sum, ap) => sum + Number(ap.amount || 0), 0)

    const totalCashInflow = pInflow + advInflow
    const netCashFlow = totalCashInflow - totalExpenses

    const pendingReceivables = activeBills
      .filter((b) => b.status !== 'paid')
      .reduce((s, b) => s + Number(b.balance || 0), 0)

    // Cash/UPI collected from NORMAL payments
    const cashFromNormalPayments = normalPayments.reduce((s, p) => s + Number(p.cashAmount ?? p.cash_amount ?? 0), 0)
    const upiFromNormalPayments = normalPayments.reduce((s, p) => s + Number(p.upiAmount ?? p.upi_amount ?? 0), 0)

    // Cash/UPI refunded out
    const cashRefunded = refundPaymentsList.reduce((s, p) => s + Math.abs(Number(p.cashAmount ?? p.cash_amount ?? 0)), 0)
    const upiRefunded = refundPaymentsList.reduce((s, p) => s + Math.abs(Number(p.upiAmount ?? p.upi_amount ?? 0)), 0)

    // Cash/UPI from advances
    const cashFromAdvances = validAdvances.reduce((s, ap) => {
      if (ap.cashAmount !== undefined && ap.cashAmount !== null && Number(ap.cashAmount) !== 0) {
        return s + Number(ap.cashAmount)
      }
      const mode = (ap.paymentMode || ap.payment_mode || ap.paymentMethod || 'cash').toLowerCase()
      return s + (mode.includes('cash') || !mode.includes('upi') ? Number(ap.amount || 0) : 0)
    }, 0)

    const upiFromAdvances = validAdvances.reduce((s, ap) => {
      if (ap.upiAmount !== undefined && ap.upiAmount !== null && Number(ap.upiAmount) !== 0) {
        return s + Number(ap.upiAmount)
      }
      const mode = (ap.paymentMode || ap.payment_mode || ap.paymentMethod || '').toLowerCase()
      return s + (mode.includes('upi') ? Number(ap.amount || 0) : 0)
    }, 0)

    const cashCollected = cashFromNormalPayments + cashFromAdvances
    const upiCollected = upiFromNormalPayments + upiFromAdvances

    // Mixed payments (cash > 0 && upi > 0)
    const mixedPayments = normalPayments.filter(p => Number(p.cashAmount || 0) > 0 && Number(p.upiAmount || 0) > 0)
    const mixedPaymentsTotal = mixedPayments.reduce((s, p) => s + Number(p.totalPaid || 0), 0)

    // Customer Advance aggregates
    const totalAdvanceDeposits = validAdvances.reduce((s, ap) => s + Number(ap.amount || 0), 0)
    const totalAdvanceUsed = activeBills.reduce((s, b) => s + Number(b.advanceUsed || 0), 0)
    const totalAdvanceRefunded = (filteredData.advancePayments || [])
      .filter(ap => isAdvReturn(ap))
      .reduce((s, ap) => s + Math.abs(Number(ap.amount || 0)), 0)

    // Cash/UPI from expenses
    const cashSpent = (filteredData.expenses || []).reduce((s, e) => s + Number(e.cashAmount || 0), 0)
    const upiSpent = (filteredData.expenses || []).reduce((s, e) => s + Number(e.upiAmount || 0), 0)

    const pendingBillsCount = activeBills.filter(b => b.status !== 'paid').length
    const paidBillsCount = activeBills.filter(b => b.status === 'paid').length
    const totalPaymentsCount = normalPayments.length

    return {
      realizedRevenue,
      totalBilled,
      totalExpenses,
      netCashFlow,
      pendingReceivables,
      cashCollected,
      upiCollected,
      cashSpent,
      upiSpent,
      totalCustomerAdvance,
      totalCashInflow,
      netProfit,
      totalRefundOutflow,
      cashRefunded,
      upiRefunded,
      mixedPaymentsCount: mixedPayments.length,
      mixedPaymentsTotal,
      totalAdvanceDeposits,
      totalAdvanceUsed,
      totalAdvanceRefunded,
      pendingBillsCount,
      paidBillsCount,
      totalPaymentsCount,
      normalPaymentsCount: normalPayments.length,
      refundPaymentsCount: refundPaymentsList.length,
    }
  }, [filteredData, customers])

  // ── Refund & Reversal Detailed Log ──────────────────────────────────────────
  const refundStats = useMemo(() => {
    const isPaymentRefund = p => !!p.isRefund || !!p.is_refund || p.paymentType === 'refund' || p.payment_type === 'refund' || Number(p.totalPaid ?? p.total_paid ?? p.amount ?? 0) < 0
    const billRefundsList = (filteredData.payments || []).filter(isPaymentRefund)
    const billRefundsTotal = billRefundsList.reduce((s, p) => s + Math.abs(Number(p.totalPaid ?? p.total_paid ?? p.amount ?? 0)), 0)
    const billRefundsCash = billRefundsList.reduce((s, p) => {
      const c = Math.abs(Number(p.cashAmount ?? p.cash_amount ?? 0))
      if (c > 0) return s + c
      const m = String(p.paymentMethod || p.payment_method || '').toLowerCase()
      if (m === 'cash') return s + Math.abs(Number(p.totalPaid ?? p.total_paid ?? p.amount ?? 0))
      return s
    }, 0)
    const billRefundsUpi = billRefundsList.reduce((s, p) => {
      const u = Math.abs(Number(p.upiAmount ?? p.upi_amount ?? 0))
      if (u > 0) return s + u
      const m = String(p.paymentMethod || p.payment_method || '').toLowerCase()
      if (m === 'upi') return s + Math.abs(Number(p.totalPaid ?? p.total_paid ?? p.amount ?? 0))
      return s
    }, 0)

    const delPaymentsList = deletedPayments || []
    const delPaymentsTotal = delPaymentsList.reduce((s, p) => s + Math.abs(Number(p.totalPaid ?? p.total_paid ?? p.amount ?? 0)), 0)

    const isAdvReturn = (ap) => ap.isReturn || ap.type === 'return' || ap.type === 'refund' || ap.type === 'refunded' || Number(ap.amount || 0) < 0
    const advReturnsList = (filteredData.advancePayments || []).filter(isAdvReturn)
    const advReturnsTotal = advReturnsList.reduce((s, ap) => s + Math.abs(Number(ap.amount || 0)), 0)

    return {
      billRefundsTotal,
      billRefundsCash,
      billRefundsUpi,
      billRefundsList,
      delPaymentsTotal,
      delPaymentsList,
      advReturnsTotal,
      advReturnsList,
    }
  }, [filteredData, deletedPayments])

  const refundLogs = useMemo(() => {
    const logs = []

    refundStats.billRefundsList.forEach(r => {
      const bill = (bills || []).find(b => String(b.id) === String(r.billId || r.bill_id))
      const billCode = bill ? getDisplayBillId(bill) : (r.billId || r.bill_id ? getDisplayBillId(r.billId || r.bill_id) : 'N/A')
      const tot = Math.abs(Number(r.refundAmount || r.totalPaid || r.total_paid || r.amount || 0))
      const c = Math.abs(Number(r.cashAmount ?? r.cash_amount ?? 0))
      const u = Math.abs(Number(r.upiAmount ?? r.upi_amount ?? 0))
      const m = String(r.paymentMethod || r.payment_method || 'upi').toLowerCase()
      const cashVal = c > 0 ? c : (m === 'cash' ? tot : 0)
      const upiVal = u > 0 ? u : (m === 'upi' ? tot : 0)
      logs.push({
        id: String(r.id),
        date: r.date,
        type: 'Bill / Change Refund',
        description: `Refund for Bill #${billCode}`,
        cash: cashVal,
        upi: upiVal,
        total: tot,
        utr: r.utr || '',
        status: r.status || (r.utr ? 'completed' : 'manual_pending'),
        notes: r.notes || '',
      })
    })

    refundStats.delPaymentsList.forEach(r => {
      const bill = (bills || []).find(b => String(b.id) === String(r.billId || r.bill_id))
      const billCode = bill ? getDisplayBillId(bill) : (r.billId || r.bill_id ? getDisplayBillId(r.billId || r.bill_id) : 'N/A')
      const tot = Math.abs(Number(r.totalPaid ?? r.total_paid ?? r.amount ?? 0))
      logs.push({
        id: String(r.id),
        date: r.deletedAt || r.deleted_at || r.date,
        type: 'Payment Deletion',
        description: `Deleted Payment for Bill #${billCode}`,
        cash: Math.abs(Number(r.cashAmount || 0)),
        upi: Math.abs(Number(r.upiAmount || 0)),
        total: tot,
        utr: '',
        status: 'reversed',
        notes: r.notes || '',
      })
    })

    refundStats.advReturnsList.forEach(r => {
      const cust = (customers || []).find(c => String(c.id) === String(r.customerId || r.customer_id))
      const custLabel = cust ? `${cust.name} (${getDisplayCustomerId(cust)})` : (r.customerId || r.customer_id ? `Customer #${r.customerId || r.customer_id}` : 'Customer')
      const amt = Math.abs(Number(r.amount || 0))
      logs.push({
        id: String(r.id),
        date: r.date,
        type: 'Advance Return',
        description: `Returned Advance to ${custLabel}`,
        cash: r.cashAmount ? Math.abs(Number(r.cashAmount)) : amt,
        upi: r.upiAmount ? Math.abs(Number(r.upiAmount)) : 0,
        total: amt,
        utr: '',
        status: 'completed',
        notes: r.notes || '',
      })
    })

    return logs.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [refundStats, bills, customers])

  // ── Expense Handlers ────────────────────────────────────────────────────────
  const handleExpenseChange = (field, value) => {
    setExpForm((f) => ({ ...f, [field]: value }))
    setExpError('')
  }

  const handleAddExpense = (e) => {
    e.preventDefault()
    const amount = Number(expForm.amount)

    if (!expForm.description.trim()) { setExpError('Description is required.'); return }
    if (!amount || amount <= 0) { setExpError('Enter a valid amount.'); return }

    const paymentMethod = expForm.paymentMethod || 'cash'
    const cash = paymentMethod === 'cash' ? amount : 0
    const upi = paymentMethod === 'upi' ? amount : 0

    addExpense({
      date: expForm.date || today,
      description: expForm.description.trim(),
      category: expForm.category || 'General',
      vendorName: expForm.vendorName?.trim() || '',
      paymentMethod,
      upiRef: expForm.upiRef?.trim() || '',
      amount,
      cashAmount: cash,
      upiAmount: upi,
    })

    setExpForm({
      date: today,
      description: '',
      category: 'General',
      vendorName: '',
      amount: '',
      paymentMethod: 'cash',
      upiRef: '',
      cashAmount: '',
      upiAmount: '',
    })
    setExpSuccess(true)
    setTimeout(() => setExpSuccess(false), 3000)
  }

  const sortedExpenses = useMemo(() => {
    let list = [...(filteredData.expenses || [])]
    if (expenseCatFilter !== 'all') {
      list = list.filter(e => (e.category || 'General') === expenseCatFilter)
    }
    if (expenseSearch.trim()) {
      const q = expenseSearch.toLowerCase().trim()
      list = list.filter(e =>
        (e.description || '').toLowerCase().includes(q) ||
        (e.vendorName || e.vendor_name || '').toLowerCase().includes(q) ||
        (e.upiRef || '').toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [filteredData.expenses, expenseCatFilter, expenseSearch])

  const expensesByCategory = useMemo(() => {
    const map = {}
      ; (filteredData.expenses || []).forEach(e => {
        const cat = e.category || 'General'
        map[cat] = (map[cat] || 0) + Number(e.amount || e.total || 0)
      })
    return map
  }, [filteredData.expenses])

  // ── General Ledger Chronological Running Statement ──────────────────────────
  const ledgerEntries = useMemo(() => {
    const list = []

    // 1. Invoices Billed & Settled
    filteredData.bills.forEach(b => {
      list.push({
        date: b.date,
        id: b.id,
        ref: getDisplayBillId(b),
        party: b.customerName || 'Customer',
        type: 'Invoice Sale',
        debit: 0,
        credit: Number(b.amountPaid || 0),
        billed: Number(b.total || 0),
        method: b.paymentMode || 'cash',
        status: b.status,
        description: `Billed ₹${Number(b.total || 0).toFixed(2)} (${b.status})`,
      })
    })

      // 2. Direct Advance Deposits
      ; (filteredData.advancePayments || []).forEach(ap => {
        const isRet = ap.isReturn || ap.type === 'return' || ap.type === 'refund' || Number(ap.amount || 0) < 0
        list.push({
          date: ap.date,
          id: ap.id,
          ref: ap.id,
          party: ap.customerName || `Customer #${ap.customerId}`,
          type: isRet ? 'Advance Return' : 'Advance Deposit',
          debit: isRet ? Math.abs(Number(ap.amount || 0)) : 0,
          credit: isRet ? 0 : Number(ap.amount || 0),
          billed: 0,
          method: ap.paymentMethod || 'cash',
          status: isRet ? 'returned' : 'active',
          description: ap.notes || (isRet ? 'Advance returned to customer' : 'Customer advance credit received'),
        })
      })

    // 3. Operating Expenses
    filteredData.expenses.forEach(e => {
      list.push({
        date: e.date,
        id: e.id,
        ref: e.id,
        party: e.vendorName || e.vendor_name || 'Vendor',
        type: 'Operating Expense',
        debit: Number(e.amount || e.total || 0),
        credit: 0,
        billed: 0,
        method: e.paymentMethod || 'cash',
        status: 'paid',
        description: `${e.category || 'General'}: ${e.description}`,
      })
    })

    // 4. Refunds & Reversals
    refundLogs.forEach(r => {
      list.push({
        date: r.date,
        id: r.id,
        ref: r.id,
        party: r.description,
        type: r.type,
        debit: Number(r.total || 0),
        credit: 0,
        billed: 0,
        method: r.cash > 0 && r.upi > 0 ? 'mixed' : (r.upi > 0 ? 'upi' : 'cash'),
        status: r.status,
        description: r.notes || r.description,
      })
    })

    // Sort ascending for running balance calculation
    list.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))

    let running = 0
    return list.map(item => {
      running = running + item.credit - item.debit
      return { ...item, runningBalance: running }
    }).reverse() // Return descending for presentation
  }, [filteredData, refundLogs])

  // ── Customer Receivables Breakdown ──────────────────────────────────────────
  const customerReceivables = useMemo(() => {
    const map = {}
    const now = new Date()

    filteredData.bills.filter(b => b.status !== 'paid' && Number(b.balance || 0) > 0).forEach(b => {
      const cid = b.customerId || 'WALK-IN'
      if (!map[cid]) {
        map[cid] = {
          customerId: cid,
          customerName: b.customerName || 'Walk-in Customer',
          customerType: b.customerType || 'regular',
          totalDue: 0,
          bills: [],
          overdueCount: 0,
          oldestDate: b.date,
        }
      }
      const entry = map[cid]
      const bal = Number(b.balance || 0)
      entry.totalDue += bal
      const isOverdue = b.dueDate && new Date(b.dueDate) < now
      if (isOverdue) entry.overdueCount += 1
      if (b.date < entry.oldestDate) entry.oldestDate = b.date
      entry.bills.push({
        id: b.id,
        billNumber: getDisplayBillId(b),
        date: b.date,
        dueDate: b.dueDate,
        total: Number(b.total || 0),
        amountPaid: Number(b.amountPaid || 0),
        balance: bal,
        isOverdue,
        daysOverdue: b.dueDate && isOverdue ? Math.floor((now - new Date(b.dueDate)) / (1000 * 60 * 60 * 24)) : 0
      })
    })

    let result = Object.values(map)
    if (receivablesSearch.trim()) {
      const q = receivablesSearch.toLowerCase().trim()
      result = result.filter(r => r.customerName.toLowerCase().includes(q) || r.customerId.toLowerCase().includes(q))
    }
    return result.sort((a, b) => b.totalDue - a.totalDue)
  }, [filteredData.bills, receivablesSearch])

  // ── Customer Advance Balances Table ─────────────────────────────────────────
  const customerAdvancesList = useMemo(() => {
    let list = customers.filter(c => !c.deleted && Math.max(0, Number(c.advanceBalance || 0), Number(c.creditBalance || 0)) > 0)
    if (advancesSearch.trim()) {
      const q = advancesSearch.toLowerCase().trim()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || (c.phone || '').includes(q))
    }
    return list.sort((a, b) => Number(b.advanceBalance || 0) - Number(a.advanceBalance || 0))
  }, [customers, advancesSearch])

  // ── Income / Billed Transactions Filter ─────────────────────────────────────
  const incomeTransactions = useMemo(() => {
    let list = [...filteredData.bills]
    if (incomeTypeFilter === 'regular') list = list.filter(b => b.customerType === 'regular')
    if (incomeTypeFilter === 'walkin') list = list.filter(b => b.customerType !== 'regular')
    if (incomeTypeFilter === 'group') list = list.filter(b => b.groupBillId || b.splitPurchaseId)

    if (incomeSearch.trim()) {
      const q = incomeSearch.toLowerCase().trim()
      list = list.filter(b =>
        (b.customerName || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().includes(q) ||
        getDisplayBillId(b).toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [filteredData.bills, incomeTypeFilter, incomeSearch])

  // ── Export Handlers ─────────────────────────────────────────────────────────
  const handleExportExpensesCSV = () => {
    const rows = sortedExpenses.map(e => ({
      Date: e.date,
      ID: e.id,
      Description: e.description,
      Category: e.category || 'General',
      Vendor: e.vendorName || e.vendor_name || '—',
      PaymentMethod: (e.paymentMethod || 'cash').toUpperCase(),
      UTR: e.upiRef || '',
      Amount: Number(e.amount || e.total || 0).toFixed(2),
    }))
    exportToCSV(`Expenses_${periodFilter}`, rows, ['Date', 'ID', 'Description', 'Category', 'Vendor', 'Payment Method', 'UTR', 'Amount'])
  }

  const handleExportLedgerCSV = () => {
    const rows = ledgerEntries.map(l => ({
      Date: l.date,
      ID: l.id,
      Reference: l.ref,
      Party: l.party,
      Type: l.type,
      Debit: l.debit > 0 ? l.debit.toFixed(2) : '0.00',
      Credit: l.credit > 0 ? l.credit.toFixed(2) : '0.00',
      RunningBalance: l.runningBalance.toFixed(2),
      PaymentMethod: l.method,
      Status: l.status,
      Description: l.description,
    }))
    exportToCSV(`General_Ledger_${periodFilter}`, rows, ['Date', 'ID', 'Reference', 'Party', 'Type', 'Debit', 'Credit', 'Running Balance', 'Method', 'Status', 'Description'])
  }

  const handleDownloadStatementPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210
    const MARGIN = 14
    let y = 16

    // Header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(30, 41, 59)
    doc.text((business?.shopName || 'PRINTPRO ERP').toUpperCase(), MARGIN, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`Official Statement of Financial Accounts • Period: ${periodFilter.toUpperCase()}`, MARGIN, y)
    y += 4
    doc.text(`Generated on: ${new Date().toLocaleString()}`, MARGIN, y)
    y += 8

    doc.setDrawColor(226, 232, 240)
    doc.line(MARGIN, y, W - MARGIN, y)
    y += 8

    // KPI Summary Block in PDF
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text('FINANCIAL OVERVIEW', MARGIN, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const summaryRows = [
      ['Total Sales Billed:', `Rs.${stats.totalBilled.toFixed(2)}`, 'Total Expenses:', `Rs.${stats.totalExpenses.toFixed(2)}`],
      ['Realized Revenue:', `Rs.${stats.realizedRevenue.toFixed(2)}`, 'Net Profit:', `Rs.${stats.netProfit.toFixed(2)}`],
      ['Total Cash Inflow:', `Rs.${stats.totalCashInflow.toFixed(2)}`, 'Net Cash Flow:', `Rs.${stats.netCashFlow.toFixed(2)}`],
      ['Pending Receivables:', `Rs.${stats.pendingReceivables.toFixed(2)}`, 'Customer Advances:', `Rs.${stats.totalCustomerAdvance.toFixed(2)}`],
    ]

    summaryRows.forEach(row => {
      doc.text(row[0], MARGIN, y)
      doc.setFont('helvetica', 'bold')
      doc.text(row[1], MARGIN + 40, y)
      doc.setFont('helvetica', 'normal')
      doc.text(row[2], MARGIN + 85, y)
      doc.setFont('helvetica', 'bold')
      doc.text(row[3], MARGIN + 130, y)
      doc.setFont('helvetica', 'normal')
      y += 5
    })
    y += 6

    doc.line(MARGIN, y, W - MARGIN, y)
    y += 8

    // Statement Table
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('STATEMENT TRANSACTIONS', MARGIN, y)
    y += 6

    doc.setFontSize(8)
    doc.text('Date', MARGIN, y)
    doc.text('ID / Ref', MARGIN + 22, y)
    doc.text('Party / Details', MARGIN + 52, y)
    doc.text('Debit', MARGIN + 120, y, { align: 'right' })
    doc.text('Credit', MARGIN + 145, y, { align: 'right' })
    doc.text('Balance', W - MARGIN, y, { align: 'right' })
    y += 3
    doc.line(MARGIN, y, W - MARGIN, y)
    y += 4

    doc.setFont('helvetica', 'normal')
    ledgerEntries.slice(0, 35).forEach(l => {
      if (y > 275) {
        doc.addPage()
        y = 16
      }
      doc.text(l.date || '—', MARGIN, y)
      doc.text(String(l.ref || l.id).slice(0, 14), MARGIN + 22, y)
      doc.text(String(l.party || '').slice(0, 32), MARGIN + 52, y)
      doc.text(l.debit > 0 ? `Rs.${l.debit.toFixed(2)}` : '—', MARGIN + 120, y, { align: 'right' })
      doc.text(l.credit > 0 ? `Rs.${l.credit.toFixed(2)}` : '—', MARGIN + 145, y, { align: 'right' })
      doc.text(`Rs.${l.runningBalance.toFixed(2)}`, W - MARGIN, y, { align: 'right' })
      y += 5
    })

    doc.save(`Statement_of_Account_${periodFilter}.pdf`)
  }

  // ── Charts Data ─────────────────────────────────────────────────────────────
  const expenseCatChartData = useMemo(() => {
    const labels = Object.keys(expensesByCategory)
    const data = Object.values(expensesByCategory)
    return {
      labels: labels.length > 0 ? labels : ['No Expenses'],
      datasets: [
        {
          data: data.length > 0 ? data : [0],
          backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'],
          borderColor: '#0f172a',
          borderWidth: 2,
        }
      ]
    }
  }, [expensesByCategory])

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Accounting &amp; Financial Management <BookOpen size={22} style={{ color: 'var(--accent)' }} />
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Unified financial control: sales revenue, cash/UPI inflow, operating expenses, customer receivables, and general ledger.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleDownloadStatementPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}
          >
            <Download size={16} /> Statement PDF
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleSelectTab('expenses')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}
          >
            <Plus size={16} /> Record Expense
          </button>
        </div>
      </div>

      {/* ── Persistent Period Filter Bar ───────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-elevated)',
        padding: '12px 18px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>
            Accounting Period:
          </span>
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'last_week', label: 'Last Week' },
            { id: 'month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'quarter', label: 'This Quarter' },
            { id: 'year', label: 'This Year' },
            { id: 'fy', label: 'Financial Year' },
            { id: 'custom', label: 'Custom Range' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodFilter(p.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: periodFilter === p.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: periodFilter === p.id ? 'var(--accent-surface)' : 'var(--bg-card)',
                color: periodFilter === p.id ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periodFilter === 'fy' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FY:</span>
            <select
              className="form-select"
              style={{ width: '220px', padding: '6px 10px', fontSize: '0.82rem' }}
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
            >
              <option value="2026">FY 2026-27 (Apr 2026 - Mar 2027)</option>
              <option value="2025">FY 2025-26 (Apr 2025 - Mar 2026)</option>
              <option value="2024">FY 2024-25 (Apr 2024 - Mar 2025)</option>
            </select>
          </div>
        )}

        {periodFilter === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              className="form-input"
              style={{ padding: '4px 10px', fontSize: '0.82rem' }}
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <input
              type="date"
              className="form-input"
              style={{ padding: '4px 10px', fontSize: '0.82rem' }}
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* ── Main Tab Navigation ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        {[
          { id: 'overview', label: 'Financial Overview & KPIs', icon: DollarSign },
          { id: 'income', label: 'Income & Revenue', icon: TrendingUp },
          { id: 'expenses', label: 'Expense Management', icon: TrendingDown },
          { id: 'receivables', label: 'Customer Receivables', icon: CreditCard },
          { id: 'advances', label: 'Customer Advances', icon: Wallet },
          { id: 'payments', label: 'Payments & Refunds', icon: Banknote },
          { id: 'ledger', label: 'General Ledger', icon: BookOpen },
          { id: 'reports', label: 'Financial & Period Reports', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                border: 'none',
                background: 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: OVERVIEW & KPIS                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div>
          {/* Summary KPI Cards Grid (16 Key Financial Metrics) */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {/* 1. Realized Revenue */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon success"><DollarSign size={22} /></div>
                <div>
                  <div className="stat-card-label">Total Realized Revenue</div>
                  <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--success)' }}>
                    ₹{stats.realizedRevenue.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">{stats.paidBillsCount} fully settled bills</div>
            </div>

            {/* 2. Total Sales Billed */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon indigo"><TrendingUp size={22} /></div>
                <div>
                  <div className="stat-card-label">Total Sales Billed</div>
                  <div className="stat-card-value font-mono tabular-nums">
                    ₹{stats.totalBilled.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">{filteredData.bills.length} total invoices issued</div>
            </div>

            {/* 3. Cash Inflow */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent)' }}>
                  <Banknote size={22} />
                </div>
                <div>
                  <div className="stat-card-label">Total Cash Inflow</div>
                  <div className="stat-card-value font-mono tabular-nums">
                    ₹{stats.totalCashInflow.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">Gross cash + UPI collected</div>
            </div>

            {/* 4. Net Profit */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className={`stat-card-icon ${stats.netProfit >= 0 ? 'success' : 'error'}`} style={{
                  background: stats.netProfit >= 0 ? 'var(--success-bg)' : 'var(--error-bg)',
                  color: stats.netProfit >= 0 ? 'var(--success)' : 'var(--error)',
                }}>
                  <TrendingUp size={22} />
                </div>
                <div>
                  <div className="stat-card-label">Net Operating Profit</div>
                  <div className="stat-card-value font-mono tabular-nums" style={{ color: stats.netProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                    ₹{stats.netProfit.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">Revenue − Total Expenses</div>
            </div>

            {/* 5. Total Expenses */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon error"><TrendingDown size={22} /></div>
                <div>
                  <div className="stat-card-label">Total Operating Expenses</div>
                  <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--error)' }}>
                    ₹{stats.totalExpenses.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">{filteredData.expenses.length} expense entries recorded</div>
            </div>

            {/* 6. Net Cash Flow */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className={`stat-card-icon ${stats.netCashFlow >= 0 ? 'success' : 'error'}`} style={{
                  background: stats.netCashFlow >= 0 ? 'var(--success-bg)' : 'var(--error-bg)',
                  color: stats.netCashFlow >= 0 ? 'var(--success)' : 'var(--error)',
                }}>
                  {stats.netCashFlow >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
                </div>
                <div>
                  <div className="stat-card-label">Net Cash Flow</div>
                  <div className="stat-card-value font-mono tabular-nums" style={{ color: stats.netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
                    ₹{stats.netCashFlow.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">Cash Inflow minus Expenses</div>
            </div>

            {/* 7. Pending Receivables */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon warning"><AlertCircle size={22} /></div>
                <div>
                  <div className="stat-card-label">Pending Receivables</div>
                  <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--warning)' }}>
                    ₹{stats.pendingReceivables.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">{stats.pendingBillsCount} open customer bills</div>
            </div>

            {/* 8. Customer Advance Balance */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon info" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                  <Wallet size={22} />
                </div>
                <div>
                  <div className="stat-card-label">Customer Advance Balance</div>
                  <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--info)' }}>
                    ₹{stats.totalCustomerAdvance.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">Active unspent customer credits</div>
            </div>
          </div>

          {/* Cash vs UPI Breakdown Card */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '16px' }}>Cash vs UPI Channel Breakdown</h2>
            <div className="grid-2" style={{ gap: '20px' }}>
              <div>
                <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Gross Collected from Customers
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Banknote size={18} style={{ color: 'var(--success)' }} /> Cash Collected
                    </span>
                    <strong className="font-mono tabular-nums" style={{ fontSize: '1.1rem', color: 'var(--success)' }}>
                      ₹{stats.cashCollected.toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Smartphone size={18} style={{ color: 'var(--info)' }} /> UPI Collected
                    </span>
                    <strong className="font-mono tabular-nums" style={{ fontSize: '1.1rem', color: 'var(--info)' }}>
                      ₹{stats.upiCollected.toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CreditCard size={18} /> Mixed Cash+UPI Payments
                    </span>
                    <strong className="font-mono tabular-nums" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                      {stats.mixedPaymentsCount} txns (₹{stats.mixedPaymentsTotal.toFixed(2)})
                    </strong>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Operating Expenses Paid Out
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Banknote size={18} style={{ color: 'var(--error)' }} /> Cash Spent on Expenses
                    </span>
                    <strong className="font-mono tabular-nums" style={{ fontSize: '1.1rem', color: 'var(--error)' }}>
                      ₹{stats.cashSpent.toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Smartphone size={18} style={{ color: 'var(--warning)' }} /> UPI Spent on Expenses
                    </span>
                    <strong className="font-mono tabular-nums" style={{ fontSize: '1.1rem', color: 'var(--warning)' }}>
                      ₹{stats.upiSpent.toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldAlert size={18} /> Total Refunds Issued
                    </span>
                    <strong className="font-mono tabular-nums" style={{ fontSize: '1rem', color: 'var(--warning)' }}>
                      ₹{stats.totalRefundOutflow.toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '14px' }}>Expense Distribution by Category</h3>
              <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={expenseCatChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: 'rgba(255,255,255,0.7)' } }
                    }
                  }}
                />
              </div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '14px' }}>Customer Advance Accounting Movement</h3>
              <div style={{ display: 'grid', gap: '10px', fontSize: '0.88rem', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <span className="text-muted">Total Advance Deposits</span>
                  <strong className="font-mono tabular-nums" style={{ color: 'var(--success)' }}>+₹{stats.totalAdvanceDeposits.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <span className="text-muted">Advance Used Against Invoices</span>
                  <strong className="font-mono tabular-nums" style={{ color: 'var(--info)' }}>-₹{stats.totalAdvanceUsed.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <span className="text-muted">Advance Refunds / Returns</span>
                  <strong className="font-mono tabular-nums" style={{ color: 'var(--warning)' }}>-₹{stats.totalAdvanceRefunded.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Active Customer Advance Balance</span>
                  <strong className="font-mono tabular-nums" style={{ color: 'var(--accent)', fontSize: '1.05rem' }}>₹{stats.totalCustomerAdvance.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: INCOME & REVENUE MANAGEMENT                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'income' && (
        <div>
          {/* Income Summary Strip */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">Total Billed Invoices</div>
              <div className="stat-card-value font-mono tabular-nums">₹{stats.totalBilled.toFixed(2)}</div>
              <div className="stat-card-sub">{filteredData.bills.length} invoices</div>
            </div>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">Actual Collections</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--success)' }}>
                ₹{stats.realizedRevenue.toFixed(2)}
              </div>
              <div className="stat-card-sub">Collected towards bills</div>
            </div>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">Advance Used</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--info)' }}>
                ₹{stats.totalAdvanceUsed.toFixed(2)}
              </div>
              <div className="stat-card-sub">Settled via customer credit</div>
            </div>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">Uncollected Balance</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--warning)' }}>
                ₹{stats.pendingReceivables.toFixed(2)}
              </div>
              <div className="stat-card-sub">{stats.pendingBillsCount} pending bills</div>
            </div>
          </div>

          {/* Income Search and Type Filters */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: '260px' }}>
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search income by customer or bill ID…"
                  value={incomeSearch}
                  onChange={(e) => setIncomeSearch(e.target.value)}
                  style={{ maxWidth: '360px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'all', label: 'All Invoices' },
                  { id: 'regular', label: 'Regular Customer' },
                  { id: 'walkin', label: 'Walk-in' },
                  { id: 'group', label: 'Group Billing' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setIncomeTypeFilter(f.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: incomeTypeFilter === f.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: incomeTypeFilter === f.id ? 'var(--accent-surface)' : 'transparent',
                      color: incomeTypeFilter === f.id ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Income Invoices Table */}
          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice ID</th>
                    <th>Customer</th>
                    <th>Category</th>
                    <th>Subtotal</th>
                    <th>GST</th>
                    <th>Total Billed</th>
                    <th>Amount Collected</th>
                    <th>Advance Used</th>
                    <th>Balance Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeTransactions.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{b.date}</td>
                      <td className="font-mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{getDisplayBillId(b)}</td>
                      <td style={{ fontWeight: 500 }}>{b.customerName}</td>
                      <td>
                        <span className={`badge ${b.groupBillId || b.splitPurchaseId ? 'badge-info' : b.customerType === 'regular' ? 'badge-paid' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                          {b.groupBillId || b.splitPurchaseId ? 'Group Bill' : b.customerType === 'regular' ? 'Regular' : 'Walk-in'}
                        </span>
                      </td>
                      <td className="font-mono tabular-nums">₹{Number(b.subtotal || 0).toFixed(2)}</td>
                      <td className="font-mono tabular-nums">₹{Number(b.gstAmount || 0).toFixed(2)}</td>
                      <td className="font-mono tabular-nums" style={{ fontWeight: 700 }}>₹{Number(b.total || 0).toFixed(2)}</td>
                      <td className="font-mono tabular-nums" style={{ color: 'var(--success)', fontWeight: 600 }}>₹{Number(b.amountPaid || 0).toFixed(2)}</td>
                      <td className="font-mono tabular-nums" style={{ color: 'var(--info)' }}>₹{Number(b.advanceUsed || 0).toFixed(2)}</td>
                      <td className="font-mono tabular-nums" style={{ color: Number(b.balance || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 600 }}>
                        ₹{Number(b.balance || 0).toFixed(2)}
                      </td>
                      <td>
                        <span className={`badge badge-${b.status === 'paid' ? 'paid' : b.status === 'partial' ? 'partial' : 'unpaid'}`} style={{ fontSize: '0.7rem' }}>
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {incomeTransactions.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No billing transactions found for selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: EXPENSE MANAGEMENT                                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'expenses' && (
        <div>
          {/* Add Expense Form */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} style={{ color: 'var(--accent)' }} /> Add Operating Expense
            </h2>
            <form onSubmit={handleAddExpense}>
              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Expense Date</label>
                  <input className="form-input" type="date" value={expForm.date} onChange={(e) => handleExpenseChange('date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description / Item Name *</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. A4 Paper Rim, Black Toner cartridge, Xerox repair…"
                    value={expForm.description}
                    onChange={(e) => handleExpenseChange('description', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expense Category</label>
                  <select
                    className="form-select"
                    value={expForm.category}
                    onChange={(e) => handleExpenseChange('category', e.target.value)}
                  >
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor / Supplier Name</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Ravi Paper Mart, Canon Care…"
                    value={expForm.vendorName}
                    onChange={(e) => handleExpenseChange('vendorName', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={expForm.amount}
                    onChange={(e) => handleExpenseChange('amount', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <div style={{ display: 'flex', gap: '14px', marginTop: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem' }}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cash"
                        checked={expForm.paymentMethod === 'cash'}
                        onChange={() => handleExpenseChange('paymentMethod', 'cash')}
                      />
                      <span>Cash</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem' }}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="upi"
                        checked={expForm.paymentMethod === 'upi'}
                        onChange={() => handleExpenseChange('paymentMethod', 'upi')}
                      />
                      <span>UPI / Netbanking</span>
                    </label>
                  </div>
                </div>
                {expForm.paymentMethod === 'upi' && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Bank UTR / Transaction Reference (Optional)</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. 12-digit UTR reference"
                      value={expForm.upiRef}
                      onChange={(e) => handleExpenseChange('upiRef', e.target.value)}
                    />
                  </div>
                )}
              </div>

              {expError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', marginBottom: '12px', marginTop: '12px',
                  background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.875rem'
                }}>
                  <AlertCircle size={16} /> {expError}
                </div>
              )}

              {expSuccess && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', marginBottom: '12px', marginTop: '12px',
                  background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
                }}>
                  <CheckCircle size={16} /> Expense recorded successfully!
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontWeight: 600 }}>
                  Save Expense Entry
                </button>
              </div>
            </form>
          </div>

          {/* Expenses Table Header & Search */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: '260px' }}>
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search expense description, vendor, or UTR…"
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  style={{ maxWidth: '340px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  className="form-select"
                  value={expenseCatFilter}
                  onChange={(e) => setExpenseCatFilter(e.target.value)}
                  style={{ width: '160px', padding: '6px 10px', fontSize: '0.82rem' }}
                >
                  <option value="all">All Categories</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <button className="btn btn-secondary btn-sm" onClick={handleExportExpensesCSV}>
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Vendor</th>
                    <th>Payment Mode</th>
                    <th>Amount (₹)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedExpenses.map((exp) => (
                    <tr key={exp.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{exp.date}</td>
                      <td className="font-mono text-muted" style={{ fontSize: '0.78rem' }}>{exp.id}</td>
                      <td style={{ fontWeight: 500 }}>{exp.description || exp.itemName}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                          {exp.category || 'General'}
                        </span>
                      </td>
                      <td>{exp.vendorName || exp.vendor_name || '—'}</td>
                      <td>
                        <span className={`badge badge-${(exp.paymentMethod || exp.payment_method) === 'upi' ? 'upi' : 'cash'}`} style={{ fontSize: '0.72rem' }}>
                          {(exp.paymentMethod || exp.payment_method || 'cash').toUpperCase()}
                          {(exp.upiRef || exp.upi_ref) ? ` (${exp.upiRef || exp.upi_ref})` : ''}
                        </span>
                      </td>
                      <td className="font-mono tabular-nums" style={{ fontWeight: 600, color: 'var(--error)' }}>
                        ₹{Number(exp.amount || exp.total || 0).toFixed(2)}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--error)' }}
                          onClick={() => {
                            if (window.confirm(`Delete expense "${exp.description || exp.itemName}"?`)) deleteExpense(exp.id)
                          }}
                          title="Delete expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedExpenses.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No operating expenses recorded for selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: CUSTOMER RECEIVABLES & OUTSTANDING                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'receivables' && (
        <div>
          {/* Receivables Summary Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="stat-card" style={{ padding: '16px 20px' }}>
              <div className="stat-card-label">Total Outstanding Due</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--warning)' }}>
                ₹{stats.pendingReceivables.toFixed(2)}
              </div>
              <div className="stat-card-sub">{stats.pendingBillsCount} unpaid or partially paid bills</div>
            </div>
            <div className="stat-card" style={{ padding: '16px 20px' }}>
              <div className="stat-card-label">Customers with Dues</div>
              <div className="stat-card-value font-mono tabular-nums">{customerReceivables.length}</div>
              <div className="stat-card-sub">Active ledger debtors</div>
            </div>
            <div className="stat-card" style={{ padding: '16px 20px' }}>
              <div className="stat-card-label">Overdue Bills Total</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--error)' }}>
                ₹{customerReceivables.reduce((s, c) => s + c.bills.filter(b => b.isOverdue).reduce((sb, b) => sb + b.balance, 0), 0).toFixed(2)}
              </div>
              <div className="stat-card-sub">Bills past payment due date</div>
            </div>
          </div>

          {/* Search Box */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search debtor by customer name or ID…"
                value={receivablesSearch}
                onChange={(e) => setReceivablesSearch(e.target.value)}
                style={{ maxWidth: '380px' }}
              />
            </div>
          </div>

          {/* Customer-wise Outstanding Table */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '14px' }}>Customer Outstanding Summary</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Account Type</th>
                    <th>Open Bills</th>
                    <th>Oldest Invoice Date</th>
                    <th>Total Outstanding Due</th>
                    <th>Overdue Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customerReceivables.map(cust => (
                    <tr key={cust.customerId}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cust.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{getDisplayCustomerId(cust.customerId)}</div>
                      </td>
                      <td>
                        <span className={`badge ${cust.customerType === 'regular' ? 'badge-paid' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                          {cust.customerType.toUpperCase()}
                        </span>
                      </td>
                      <td>{cust.bills.length} bills</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{cust.oldestDate}</td>
                      <td>
                        <strong className="font-mono tabular-nums" style={{ color: 'var(--warning)', fontSize: '1rem' }}>
                          ₹{cust.totalDue.toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        {cust.overdueCount > 0 ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                            background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.2)',
                            color: 'var(--error)', fontSize: '0.72rem', fontWeight: 600,
                          }}>
                            <AlertTriangle size={12} /> {cust.overdueCount} Overdue
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                            background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.2)',
                            color: 'var(--warning)', fontSize: '0.72rem', fontWeight: 600,
                          }}>
                            <Clock size={12} /> In Terms
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate('/payments')}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          Collect Payment
                        </button>
                      </td>
                    </tr>
                  ))}
                  {customerReceivables.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No pending customer receivables found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: CUSTOMER ADVANCE ACCOUNTING                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'advances' && (
        <div>
          {/* Advance Accounting KPI Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">Active Advance Balance</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--accent)' }}>
                ₹{stats.totalCustomerAdvance.toFixed(2)}
              </div>
              <div className="stat-card-sub">Current liabilities to customers</div>
            </div>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">New Advance Inflow</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--success)' }}>
                ₹{stats.totalAdvanceDeposits.toFixed(2)}
              </div>
              <div className="stat-card-sub">Deposits received in period</div>
            </div>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">Advance Used in Billing</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--info)' }}>
                ₹{stats.totalAdvanceUsed.toFixed(2)}
              </div>
              <div className="stat-card-sub">Consumed against print invoices</div>
            </div>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">Advance Returned / Refunded</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--warning)' }}>
                ₹{stats.totalAdvanceRefunded.toFixed(2)}
              </div>
              <div className="stat-card-sub">Returned to customers</div>
            </div>
          </div>

          {/* Search Box */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search customers with advance balances…"
                value={advancesSearch}
                onChange={(e) => setAdvancesSearch(e.target.value)}
                style={{ maxWidth: '360px' }}
              />
            </div>
          </div>

          {/* Customers with Advance Balances Table */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '14px' }}>Customer Advance Balances</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Account ID</th>
                    <th>Phone</th>
                    <th>Account Type</th>
                    <th>Current Advance Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customerAdvancesList.map(cust => (
                    <tr key={cust.id}>
                      <td style={{ fontWeight: 600 }}>{cust.name}</td>
                      <td className="font-mono text-muted">{getDisplayCustomerId(cust)}</td>
                      <td>{cust.phone || '—'}</td>
                      <td>
                        <span className="badge badge-paid" style={{ fontSize: '0.7rem' }}>
                          {cust.type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <strong className="font-mono tabular-nums" style={{ color: 'var(--accent)', fontSize: '1rem' }}>
                          ₹{Number(cust.advanceBalance || cust.creditBalance || 0).toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate('/payments')}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          Manage Advance
                        </button>
                      </td>
                    </tr>
                  ))}
                  {customerAdvancesList.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No customers holding active advance credit balances found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 6: PAYMENTS & REFUNDS                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div>
          {/* Payment Summary */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">Direct Collections</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--success)' }}>
                ₹{stats.cashCollected + stats.upiCollected}
              </div>
              <div className="stat-card-sub">{stats.normalPaymentsCount} payment receipts</div>
            </div>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">Cash Collected</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--success)' }}>
                ₹{stats.cashCollected.toFixed(2)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">UPI Collected</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--info)' }}>
                ₹{stats.upiCollected.toFixed(2)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '14px 18px' }}>
              <div className="stat-card-label">Refund Outflows</div>
              <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--warning)' }}>
                ₹{stats.totalRefundOutflow.toFixed(2)}
              </div>
              <div className="stat-card-sub">{stats.refundPaymentsCount} refund records</div>
            </div>
          </div>

          {/* Refund Log Table */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '14px' }}>Refund &amp; Reversals Audit Log ({refundLogs.length})</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Cash (₹)</th>
                    <th>UPI (₹)</th>
                    <th>Total (₹)</th>
                    <th>UTR / Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {refundLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(log.date).toLocaleDateString()}</td>
                      <td className="font-mono text-muted" style={{ fontSize: '0.78rem' }}>{log.id}</td>
                      <td>
                        <span className={`badge badge-${log.type.includes('Refund') ? 'partial' : 'info'}`} style={{ fontSize: '0.7rem' }}>
                          {log.type}
                        </span>
                      </td>
                      <td>{log.description}</td>
                      <td className="font-mono tabular-nums">₹{log.cash.toFixed(2)}</td>
                      <td className="font-mono tabular-nums">₹{log.upi.toFixed(2)}</td>
                      <td className="font-mono tabular-nums" style={{ fontWeight: 600, color: 'var(--warning)' }}>
                        ₹{log.total.toFixed(2)}
                      </td>
                      <td className="font-mono" style={{ fontSize: '0.78rem' }}>{log.utr || '—'}</td>
                      <td>
                        <span className={`badge badge-${log.status === 'completed' ? 'paid' : log.status === 'manual_pending' ? 'partial' : 'unpaid'}`} style={{ fontSize: '0.7rem' }}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {refundLogs.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No refund transactions found for selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 7: GENERAL LEDGER & STATEMENT OF ACCOUNT                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'ledger' && (
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Statement of Accounts / General Ledger</h2>
                <p className="text-muted" style={{ fontSize: '0.82rem' }}>Comprehensive double-entry chronological record of all inflows, outflows, and running balances</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleExportLedgerCSV}>
                  <Download size={14} /> Export CSV
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleDownloadStatementPDF}>
                  <Printer size={14} /> Download Statement PDF
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>ID / Ref</th>
                    <th>Party</th>
                    <th>Transaction Type</th>
                    <th>Debit (Outflow)</th>
                    <th>Credit (Inflow)</th>
                    <th>Running Balance</th>
                    <th>Payment Mode</th>
                    <th>Status</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((l, index) => (
                    <tr key={`${l.id}-${index}`}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{l.date ? l.date.slice(0, 10) : '—'}</td>
                      <td className="font-mono text-muted" style={{ fontSize: '0.78rem' }}>{l.ref || l.id}</td>
                      <td style={{ fontWeight: 500 }}>{l.party}</td>
                      <td>
                        <span className={`badge badge-${l.debit > 0 ? 'unpaid' : 'paid'}`} style={{ fontSize: '0.7rem' }}>
                          {l.type}
                        </span>
                      </td>
                      <td className="font-mono tabular-nums" style={{ color: l.debit > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                        {l.debit > 0 ? `₹${l.debit.toFixed(2)}` : '—'}
                      </td>
                      <td className="font-mono tabular-nums" style={{ color: l.credit > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {l.credit > 0 ? `₹${l.credit.toFixed(2)}` : '—'}
                      </td>
                      <td className="font-mono tabular-nums" style={{ fontWeight: 700, color: l.runningBalance >= 0 ? 'var(--success)' : 'var(--error)' }}>
                        ₹{l.runningBalance.toFixed(2)}
                      </td>
                      <td>
                        <span className={`badge badge-${l.method === 'upi' ? 'upi' : l.method === 'mixed' ? 'info' : 'cash'}`} style={{ fontSize: '0.7rem' }}>
                          {String(l.method).toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${l.status === 'paid' || l.status === 'completed' ? 'paid' : l.status === 'partial' ? 'partial' : 'unpaid'}`} style={{ fontSize: '0.7rem' }}>
                          {String(l.status).toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{l.description}</td>
                    </tr>
                  ))}
                  {ledgerEntries.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No general ledger entries found for selected accounting period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 8: PERIOD REPORTS                                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div>
          <PeriodReport />
        </div>
      )}
    </div>
  )
}

export default Accounting
