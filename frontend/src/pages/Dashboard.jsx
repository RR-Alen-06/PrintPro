import React, { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  TrendingUp,
  CreditCard,
  Clock,
  AlertTriangle,
  ChevronRight,
  Wallet,
  CheckCircle,
  XCircle,
  FileText,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  Activity,
  ShieldAlert,
  Sparkles
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import '../utils/chartSetup'
import EmptyState from '../components/common/EmptyState'
import { DashboardService } from '../utils/financialServices'
import { getDisplayBillId, getDisplayCustomerId } from '../utils/idFormatter'
import EodModal from '../components/dashboard/EodModal'

const Dashboard = () => {
  const { bills, customers, advancePayments, payments, expenses } = useAppContext()
  const navigate = useNavigate()

  const [showEodModal, setShowEodModal] = useState(false)
  const [periodFilter, setPeriodFilter] = useState('all') // 'all', 'today', 'yesterday', 'week', 'last_week', 'month', 'last_month', 'quarter', 'year', 'fy', 'custom'
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [activityTab, setActivityTab] = useState('all') // 'all', 'bills', 'payments', 'advances', 'expenses', 'refunds'

  // Default to current financial year based on current date
  const [selectedFY, setSelectedFY] = useState(
    new Date().getMonth() >= 3 
      ? String(new Date().getFullYear()) 
      : String(new Date().getFullYear() - 1)
  )

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

  const activeBills = filteredData.bills
  const paidBills = useMemo(() => activeBills.filter((b) => b.status === 'paid'), [activeBills])
  const partialBills = useMemo(() => activeBills.filter((b) => b.status === 'partial'), [activeBills])
  const unpaidBills = useMemo(() => activeBills.filter((b) => b.status === 'unpaid'), [activeBills])

  // Overdue bills
  const overdueBills = useMemo(() => {
    const now = new Date()
    return activeBills.filter((b) => b.balance > 0 && b.dueDate && new Date(b.dueDate) < now)
  }, [activeBills])

  const overdueAmount = useMemo(() => {
    return overdueBills.reduce((s, b) => s + Number(b.balance || 0), 0)
  }, [overdueBills])

  // ── Centralized Financial Calculations (Strict Source Reuse) ────────────────
  const dashboardStats = useMemo(() => {
    return DashboardService.getSummaryWidgets({
      bills: filteredData.bills,
      payments: filteredData.payments,
      expenses: filteredData.expenses,
      customers,
      inventory: []
    })
  }, [filteredData, customers])

  const netRevenue = dashboardStats.netRevenue // Realized revenue (amountPaid)
  const pendingAmount = dashboardStats.pendingAmount // Pending balance from open bills
  const totalRefunds = dashboardStats.totalRefunds
  const totalCustomerAdvance = dashboardStats.totalCustomerAdvance
  const totalBilled = useMemo(() => activeBills.reduce((s, b) => s + Number(b.total || 0), 0), [activeBills])

  // Refund payments breakdown
  const refundPayments = useMemo(() => {
    return (filteredData.payments || []).filter((p) => p.isRefund || p.paymentType === 'refund' || p.totalPaid < 0)
  }, [filteredData.payments])

  const pendingRefunds = useMemo(() => {
    return (filteredData.payments || []).filter(
      (p) => (p.isRefund || p.paymentType === 'refund') && (p.status === 'manual_pending' || p.status === 'pending')
    )
  }, [filteredData.payments])

  const pendingRefundsAmount = useMemo(() => {
    return pendingRefunds.reduce((s, p) => s + Math.abs(Number(p.refundAmount || p.totalPaid || 0)), 0)
  }, [pendingRefunds])

  const isAdvanceNote = (notes) => {
    if (!notes) return false
    const n = String(notes).toLowerCase()
    return n.includes('from advance deposit') || n.includes('advance deposit') || n.includes('credit balance')
  }

  // Cash Inflow calculations
  const totalCashInflow = useMemo(() => {
    const pInflow = (filteredData.payments || [])
      .filter((p) => !isAdvanceNote(p.notes) && !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0)
      .reduce((sum, p) => sum + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    const isAdvReturn = (ap) => ap.isReturn || ap.type === 'return' || ap.type === 'refund' || ap.type === 'refunded' || Number(ap.amount || 0) < 0
    const advInflow = (filteredData.advancePayments || [])
      .filter(ap => !ap.isRefundCredit && !isAdvReturn(ap) && Number(ap.amount || 0) > 0)
      .reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
    return pInflow + advInflow
  }, [filteredData])

  const totalExpenses = useMemo(() => {
    return (filteredData.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [filteredData.expenses])

  const netCashFlow = useMemo(() => {
    return totalCashInflow - totalExpenses
  }, [totalCashInflow, totalExpenses])

  const netProfit = useMemo(() => {
    return netRevenue - totalExpenses
  }, [netRevenue, totalExpenses])

  // Cash vs UPI Collected (Normal payments + advances)
  const cashCollected = useMemo(() => {
    const pCash = (filteredData.payments || [])
      .filter((p) => !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0)
      .reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const advCash = (filteredData.advancePayments || [])
      .filter(ap => !ap.isRefundCredit && !ap.isReturn && ap.type !== 'return' && ap.type !== 'refund' && Number(ap.amount || 0) > 0)
      .reduce((s, ap) => {
        if (ap.cashAmount !== undefined && ap.cashAmount !== null && Number(ap.cashAmount) !== 0) {
          return s + Number(ap.cashAmount)
        }
        const mode = (ap.paymentMode || ap.payment_mode || ap.paymentMethod || 'cash').toLowerCase()
        return s + (mode.includes('cash') || !mode.includes('upi') ? Number(ap.amount || 0) : 0)
      }, 0)
    return pCash + advCash
  }, [filteredData])

  const upiCollected = useMemo(() => {
    const pUpi = (filteredData.payments || [])
      .filter((p) => !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0)
      .reduce((s, p) => s + Number(p.upiAmount || 0), 0)
    const advUpi = (filteredData.advancePayments || [])
      .filter(ap => !ap.isRefundCredit && !ap.isReturn && ap.type !== 'return' && ap.type !== 'refund' && Number(ap.amount || 0) > 0)
      .reduce((s, ap) => {
        if (ap.upiAmount !== undefined && ap.upiAmount !== null && Number(ap.upiAmount) !== 0) {
          return s + Number(ap.upiAmount)
        }
        const mode = (ap.paymentMode || ap.payment_mode || ap.paymentMethod || '').toLowerCase()
        return s + (mode.includes('upi') ? Number(ap.amount || 0) : 0)
      }, 0)
    return pUpi + advUpi
  }, [filteredData])

  // Today metrics
  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const todayBills = useMemo(() => (bills || []).filter(b => !b.deleted && !b.isGroupParent && b.date === todayDateStr), [bills, todayDateStr])
  const todayBillsCount = todayBills.length
  const todayBillsTotal = useMemo(() => todayBills.reduce((s, b) => s + Number(b.total || 0), 0), [todayBills])
  const todayPayments = useMemo(() => (payments || []).filter(p => p.date && p.date.slice(0, 10) === todayDateStr && !p.isRefund && Number(p.totalPaid || 0) >= 0), [payments, todayDateStr])
  const todayPaymentsCount = todayPayments.length
  const todayPaymentsTotal = useMemo(() => todayPayments.reduce((s, p) => s + Number(p.totalPaid || 0), 0), [todayPayments])

  const averageBillValue = useMemo(() => {
    return activeBills.length > 0 ? totalBilled / activeBills.length : 0
  }, [totalBilled, activeBills])

  // Customer bill type breakdown
  const regularBillsCount = useMemo(() => activeBills.filter(b => b.customerType === 'regular').length, [activeBills])
  const walkinBillsCount = useMemo(() => activeBills.filter(b => b.customerType !== 'regular').length, [activeBills])
  const groupBillsCount = useMemo(() => activeBills.filter(b => b.groupBillId || b.splitPurchaseId).length, [activeBills])

  // Pending dues per customer (sorted desc)
  const pendingDues = useMemo(() => {
    const now = new Date()
    const map = {}
    activeBills
      .filter((b) => b.balance > 0)
      .forEach((b) => {
        if (!map[b.customerId]) {
          map[b.customerId] = {
            customerId: b.customerId,
            customerName: b.customerName,
            totalDue: 0,
            oldestDate: b.date,
            newestDate: b.date,
            billCount: 0,
            hasOverdue: false,
          }
        }
        const entry = map[b.customerId]
        entry.totalDue += Number(b.balance)
        entry.billCount += 1
        if (b.date < entry.oldestDate) entry.oldestDate = b.date
        if (b.date > entry.newestDate) entry.newestDate = b.date
        if (b.dueDate && new Date(b.dueDate) < now) entry.hasOverdue = true
      })
    return Object.values(map).sort((a, b) => b.totalDue - a.totalDue).slice(0, 8)
  }, [activeBills])

  const urgencyStyle = (entry) => {
    if (entry.hasOverdue) return { color: 'var(--error)', bg: 'var(--error-bg)', border: 'rgba(239,68,68,0.2)' }
    return { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'rgba(245,158,11,0.2)' }
  }

  // Date formatter: "04 Nov 2026"
  const formatDisplayDate = (dStr) => {
    if (!dStr) return '—'
    const d = new Date(dStr)
    if (isNaN(d.getTime())) return dStr
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // ── Unified Chronological Activity Feed ────────────────────────────────────
  const recentActivities = useMemo(() => {
    const feed = []

    // Helper to resolve party name cleanly (no raw UUIDs)
    const resolveCustomerName = (custName, custId) => {
      if (custName && custName.trim() && !custName.startsWith('Customer #')) return custName
      if (custId) {
        const found = (customers || []).find(c => String(c.id) === String(custId))
        if (found?.name) return found.name
      }
      return 'Walk-in Customer'
    }

    // 1. Bills
    activeBills.forEach(b => {
      feed.push({
        id: b.id,
        reference: getDisplayBillId(b),
        entityType: 'bill',
        date: b.date || b.createdAt,
        transaction: 'Bill Creation',
        party: resolveCustomerName(b.customerName, b.customerId),
        amount: Number(b.total || 0),
        status: b.status,
        method: b.paymentMode || (b.paymentMethod?.cash > 0 && b.paymentMethod?.upi > 0 ? 'mixed' : (b.paymentMethod?.upi > 0 ? 'upi' : 'cash')),
        details: `${b.items?.length || 0} items • Paid: ₹${Number(b.amountPaid || 0).toFixed(2)}`,
        raw: b
      })
    })

    // 2. Payments
    ;(filteredData.payments || []).forEach(p => {
      const isRef = p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0
      const isGrp = p.isGroupPayment
      const refNum = p.payment_number || (p.id ? (isRef ? `REF-${String(p.id).slice(0, 4).toUpperCase()}` : `PAY-${String(p.id).slice(0, 4).toUpperCase()}`) : 'PAY-0001')
      feed.push({
        id: p.id,
        reference: refNum,
        entityType: isRef ? 'refund' : 'payment',
        date: p.date,
        transaction: isRef ? 'Refund' : (isGrp ? 'Group Settlement' : 'Bill Payment'),
        party: resolveCustomerName(p.customerName, p.customerId),
        amount: Math.abs(Number(p.refundAmount || p.totalPaid || p.amount || 0)),
        status: isRef ? (p.status || 'completed') : (p.paymentType || 'full'),
        method: p.paymentMethod || 'cash',
        details: isRef ? (p.utr ? `UTR: ${p.utr}` : 'Pending verification') : (p.notes || (p.billId ? `Paid against ${p.billId}` : 'Bill payment')),
        raw: p
      })
    })

    // 3. Advances
    ;(filteredData.advancePayments || []).forEach(ap => {
      const isRet = ap.isReturn || ap.type === 'return' || ap.type === 'refund' || Number(ap.amount || 0) < 0
      const refNum = ap.advance_number || (ap.id ? `ADV-${String(ap.id).slice(0, 4).toUpperCase()}` : 'ADV-0001')
      feed.push({
        id: ap.id,
        reference: refNum,
        entityType: 'advance',
        date: ap.date,
        transaction: isRet ? 'Advance Return' : 'Advance Deposit',
        party: resolveCustomerName(ap.customerName, ap.customerId),
        amount: Math.abs(Number(ap.amount || 0)),
        status: isRet ? 'returned' : 'active',
        method: ap.paymentMethod || ap.paymentMode || 'cash',
        details: ap.notes || (isRet ? 'Advance returned' : 'Deposit to advance balance'),
        raw: ap
      })
    })

    // 4. Expenses
    ;(filteredData.expenses || []).forEach(e => {
      feed.push({
        id: e.id,
        reference: e.id ? `EXP-${String(e.id).slice(0, 4).toUpperCase()}` : 'EXP-0001',
        entityType: 'expense',
        date: e.date,
        transaction: 'Expense',
        party: e.vendorName || e.vendor_name || 'Vendor',
        amount: Number(e.amount || e.total || 0),
        status: 'recorded',
        method: e.paymentMethod || 'cash',
        details: `${e.category || 'General'}${e.upiRef ? ` • Ref: ${e.upiRef}` : ''}`,
        raw: e
      })
    })

    const filteredFeed = activityTab === 'all' 
      ? feed 
      : feed.filter(item => {
          if (activityTab === 'bills') return item.entityType === 'bill'
          if (activityTab === 'payments') return item.entityType === 'payment'
          if (activityTab === 'advances') return item.entityType === 'advance'
          if (activityTab === 'expenses') return item.entityType === 'expense'
          if (activityTab === 'refunds') return item.entityType === 'refund'
          return true
        })

    return filteredFeed.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 10)
  }, [activeBills, filteredData, activityTab, customers])

  // ── Charts Configurations ──────────────────────────────────────────────────
  const trendChartData = useMemo(() => {
    const dateMap = {}
    // Collect all dates from activeBills
    activeBills.forEach(b => {
      const d = b.date ? b.date.slice(0, 10) : 'Unknown'
      if (!dateMap[d]) dateMap[d] = { billed: 0, collected: 0 }
      dateMap[d].billed += Number(b.total || 0)
      dateMap[d].collected += Number(b.amountPaid || 0)
    })

    const sortedDates = Object.keys(dateMap).sort()
    const displayDates = sortedDates.length > 0 ? sortedDates : ['No Data']

    return {
      labels: displayDates.map(d => d.slice(5)), // MM-DD
      datasets: [
        {
          label: 'Billed Sales (₹)',
          data: sortedDates.map(d => dateMap[d].billed),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Realized Revenue (₹)',
          data: sortedDates.map(d => dateMap[d].collected),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          tension: 0.3,
          fill: true,
        }
      ]
    }
  }, [activeBills])

  const collectionsDoughnutData = useMemo(() => {
    return {
      labels: ['Cash Collected', 'UPI Collected'],
      datasets: [
        {
          data: [cashCollected, upiCollected],
          backgroundColor: ['#10b981', '#3b82f6'],
          borderColor: ['#0f172a', '#0f172a'],
          borderWidth: 2,
        }
      ]
    }
  }, [cashCollected, upiCollected])

  const incomeVsExpenseData = useMemo(() => {
    return {
      labels: ['Financial Overview'],
      datasets: [
        {
          label: 'Realized Revenue',
          data: [netRevenue],
          backgroundColor: '#10b981',
          borderRadius: 6,
        },
        {
          label: 'Total Expenses',
          data: [totalExpenses],
          backgroundColor: '#ef4444',
          borderRadius: 6,
        },
        {
          label: 'Net Profit',
          data: [netProfit],
          backgroundColor: netProfit >= 0 ? '#6366f1' : '#f59e0b',
          borderRadius: 6,
        }
      ]
    }
  }, [netRevenue, totalExpenses, netProfit])

  // Financial Year stats computation
  const fyStats = useMemo(() => {
    const startYear = parseInt(selectedFY, 10) || new Date().getFullYear()
    const fyStart = new Date(startYear, 3, 1, 0, 0, 0, 0)
    const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59, 999)

    const inFY = (dStr) => {
      if (!dStr) return false
      const d = new Date(dStr)
      return d >= fyStart && d <= fyEnd
    }

    const fyBills = (bills || []).filter(b => !b.deleted && !b.isGroupParent && inFY(b.date))
    const fyPayments = (payments || []).filter(p => inFY(p.date))
    const fyExpenses = (expenses || []).filter(e => inFY(e.date))
    const fyAdvances = (advancePayments || []).filter(ap => inFY(ap.date))

    const revenue = fyBills.reduce((sum, b) => sum + Number(b.amountPaid || b.amount_paid || 0), 0)
    const refunds = fyPayments
      .filter((p) => p.isRefund || p.paymentType === 'refund' || p.totalPaid < 0)
      .reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || 0)), 0)

    const pInflow = fyPayments
      .filter((p) => !isAdvanceNote(p.notes) && !p.isRefund && Number(p.totalPaid || 0) >= 0)
      .reduce((sum, p) => sum + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    const advInflow = fyAdvances
      .filter((ap) => !ap.isRefundCredit && !ap.isReturn && Number(ap.amount || 0) > 0)
      .reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
    const cashInflowVal = pInflow + advInflow

    const totalExp = fyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const netCashFlowVal = cashInflowVal - totalExp

    return {
      revenue,
      refunds,
      cashInflow: cashInflowVal,
      expenses: totalExp,
      netCashFlow: netCashFlowVal,
    }
  }, [bills, payments, expenses, advancePayments, selectedFY])

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Business Dashboard <Sparkles size={20} style={{ color: 'var(--accent)' }} />
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Real-time business intelligence: billing revenue, cash collections, customer dues, and financial health.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowEodModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}
          >
            <FileText size={16} color="var(--accent)" />
            EOD Report
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/accounting')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}
          >
            <DollarSign size={16} color="var(--success)" />
            Accounting Book
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/billing')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}
          >
            + New Bill
          </button>
        </div>
      </div>

      <EodModal isOpen={showEodModal} onClose={() => setShowEodModal(false)} />

      {/* ── Actionable Alerts ──────────────────────────────────────────────── */}
      {(overdueBills.length > 0 || pendingRefunds.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {overdueBills.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--error)',
              fontSize: '0.88rem',
              fontWeight: 500,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} />
                <span>
                  <strong>{overdueBills.length} Overdue Bills</strong> totaling <strong>₹{overdueAmount.toFixed(2)}</strong> require attention.
                </span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/customers?tab=bills')}
                style={{ color: 'var(--error)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Review Overdue <ChevronRight size={14} />
              </button>
            </div>
          )}

          {pendingRefunds.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--warning)',
              fontSize: '0.88rem',
              fontWeight: 500,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={18} />
                <span>
                  <strong>{pendingRefunds.length} UPI Refund(s)</strong> totaling <strong>₹{pendingRefundsAmount.toFixed(2)}</strong> are pending manual verification.
                </span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/accounting')}
                style={{ color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Verify in Accounting <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Period Filter Chips Bar ────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-elevated)',
        padding: '14px 18px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>
            Period:
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
            { id: 'custom', label: 'Custom' },
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
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Select FY:</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

      {/* ── Summary KPI Cards (4 Categories) ───────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {/* Card 1: Sales Billed */}
          <div className="stat-card" style={{ padding: '18px 20px' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon indigo"><TrendingUp size={22} /></div>
              <div>
                <div className="stat-card-label">Total Sales Billed</div>
                <div className="stat-card-value font-mono tabular-nums">₹{totalBilled.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{activeBills.length} bills generated</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>Avg: ₹{averageBillValue.toFixed(2)}</span>
            </div>
          </div>

          {/* Card 2: Realized Revenue */}
          <div className="stat-card" style={{ padding: '18px 20px' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon success" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <div className="stat-card-label">Realized Revenue</div>
                <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--success)' }}>
                  ₹{netRevenue.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="stat-card-sub">{paidBills.length} fully paid • {partialBills.length} partial</div>
          </div>

          {/* Card 3: Total Collections */}
          <div className="stat-card" style={{ padding: '18px 20px' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent)' }}>
                <Banknote size={22} />
              </div>
              <div>
                <div className="stat-card-label">Total Cash Inflow</div>
                <div className="stat-card-value font-mono tabular-nums">₹{totalCashInflow.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub" style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: 'var(--success)' }}>Cash: ₹{cashCollected.toFixed(2)}</span>
              <span>•</span>
              <span style={{ color: 'var(--accent)' }}>UPI: ₹{upiCollected.toFixed(2)}</span>
            </div>
          </div>

          {/* Card 4: Outstanding Receivables */}
          <div className="stat-card" style={{ padding: '18px 20px' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon warning" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                <CreditCard size={22} />
              </div>
              <div>
                <div className="stat-card-label">Pending Receivables</div>
                <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--warning)' }}>
                  ₹{pendingAmount.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="stat-card-sub" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{partialBills.length + unpaidBills.length} open bills</span>
              {overdueBills.length > 0 && <span style={{ color: 'var(--error)' }}>{overdueBills.length} overdue</span>}
            </div>
          </div>
        </div>

        {/* Second Row of KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '16px' }}>
          {/* Card 5: Net Profit */}
          <div className="stat-card" style={{ padding: '18px 20px' }}>
            <div className="stat-card-header">
              <div className={`stat-card-icon ${netProfit >= 0 ? 'success' : 'error'}`} style={{
                background: netProfit >= 0 ? 'var(--success-bg)' : 'var(--error-bg)',
                color: netProfit >= 0 ? 'var(--success)' : 'var(--error)',
              }}>
                <TrendingUp size={22} />
              </div>
              <div>
                <div className="stat-card-label">Net Profit (Operating)</div>
                <div className="stat-card-value font-mono tabular-nums" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  ₹{netProfit.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="stat-card-sub">Revenue (₹{netRevenue.toFixed(2)}) − Expenses (₹{totalExpenses.toFixed(2)})</div>
          </div>

          {/* Card 6: Net Cash Flow */}
          <div className="stat-card" style={{ padding: '18px 20px' }}>
            <div className="stat-card-header">
              <div className={`stat-card-icon ${netCashFlow >= 0 ? 'success' : 'error'}`} style={{
                background: netCashFlow >= 0 ? 'var(--success-bg)' : 'var(--error-bg)',
                color: netCashFlow >= 0 ? 'var(--success)' : 'var(--error)',
              }}>
                {netCashFlow >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
              </div>
              <div>
                <div className="stat-card-label">Net Cash Flow</div>
                <div className="stat-card-value font-mono tabular-nums" style={{ color: netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  ₹{netCashFlow.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="stat-card-sub">Inflow (₹{totalCashInflow.toFixed(2)}) − Outflow (₹{totalExpenses.toFixed(2)})</div>
          </div>

          {/* Card 7: Advance Balance */}
          <div className="stat-card" style={{ padding: '18px 20px' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon info" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                <Wallet size={22} />
              </div>
              <div>
                <div className="stat-card-label">Customer Advance Balance</div>
                <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--info)' }}>
                  ₹{totalCustomerAdvance.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="stat-card-sub">Customer credit balances held</div>
          </div>

          {/* Card 8: Operating Expenses */}
          <div className="stat-card" style={{ padding: '18px 20px' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon error" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
                <XCircle size={22} />
              </div>
              <div>
                <div className="stat-card-label">Total Expenses</div>
                <div className="stat-card-value font-mono tabular-nums" style={{ color: 'var(--error)' }}>
                  ₹{totalExpenses.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="stat-card-sub">{filteredData.expenses.length} operating expense entries</div>
          </div>
        </div>

        {/* Quick Highlights Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginTop: '16px',
        }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today's Bills</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {todayBillsCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>(₹{todayBillsTotal.toFixed(2)})</span>
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today's Payments</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>
              {todayPaymentsCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>(₹{todayPaymentsTotal.toFixed(2)})</span>
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Refunds Issued</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--warning)', marginTop: '2px' }}>
              ₹{totalRefunds.toFixed(2)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({refundPayments.length})</span>
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Billing Breakdown</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
              Regular: {regularBillsCount} • Walk-in: {walkinBillsCount} • Group: {groupBillsCount}
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual Charts Section ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Chart 1: Revenue & Billed Trend */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Sales &amp; Collections Trend</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Billed sales vs realized cash/upi collected</p>
            </div>
          </div>
          <div style={{ height: '220px' }}>
            <Line
              data={trendChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 }, color: 'rgba(255,255,255,0.7)' } },
                  tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                  x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 10 }, color: 'rgba(255,255,255,0.6)' } },
                  y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 10 }, color: 'rgba(255,255,255,0.6)' } }
                }
              }}
            />
          </div>
        </div>

        {/* Chart 2: Cash vs UPI Breakdown */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Collection Channels</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Gross collections split by Cash vs UPI</p>
            </div>
          </div>
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cashCollected + upiCollected > 0 ? (
              <Doughnut
                data={collectionsDoughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: 'rgba(255,255,255,0.7)' } }
                  }
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No collections recorded in selected period
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: Income vs Expenses */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Income vs Expenses</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Operating revenue, expenses, and net profit</p>
            </div>
          </div>
          <div style={{ height: '220px' }}>
            <Bar
              data={incomeVsExpenseData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 }, color: 'rgba(255,255,255,0.7)' } }
                },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 10 }, color: 'rgba(255,255,255,0.6)' } },
                  y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 10 }, color: 'rgba(255,255,255,0.6)' } }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Pending Dues Summary ────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="bill-view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Pending Receivables by Customer</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem' }}>Customers with active outstanding balances — sorted by balance due</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers?tab=ledger')}>
            Customer Ledger <ChevronRight size={14} />
          </button>
        </div>

        {pendingDues.length === 0 ? (
          <EmptyState
            Icon={CheckCircle}
            title="All customer accounts settled"
            description="No outstanding customer balances found for the selected period."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Open Bills</th>
                  <th>Date Range</th>
                  <th>Amount Due</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingDues.map((entry) => {
                  const s = urgencyStyle(entry)
                  return (
                    <tr key={entry.customerId}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{getDisplayCustomerId(entry.customerId)}</div>
                      </td>
                      <td>{entry.billCount}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {entry.oldestDate === entry.newestDate
                          ? entry.oldestDate
                          : `${entry.oldestDate} → ${entry.newestDate}`}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: s.color }}>
                          ₹{entry.totalDue.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 10px', borderRadius: 'var(--radius-full)',
                          background: s.bg, border: `1px solid ${s.border}`,
                          color: s.color, fontSize: '0.72rem', fontWeight: 600,
                        }}>
                          {entry.hasOverdue ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} /> Overdue
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} /> Pending
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          onClick={() => navigate('/payments')}
                        >
                          Settle Dues
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Financial Year Analytics Section ──────────────────────────────── */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Financial Year Performance</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem' }}>Comprehensive performance by Indian Financial Year (April 1st – March 31st)</p>
          </div>
          <select
            className="form-select"
            style={{ width: '280px', padding: '8px 12px', fontSize: '0.85rem' }}
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
          >
            <option value="2026">FY 2026-27 (Apr 2026 - Mar 2027)</option>
            <option value="2025">FY 2025-26 (Apr 2025 - Mar 2026)</option>
            <option value="2024">FY 2024-25 (Apr 2024 - Mar 2025)</option>
          </select>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', border: 'none', padding: 0 }}>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Realized Revenue</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>₹{fyStats.revenue.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Refunds</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning)' }}>₹{fyStats.refunds.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Cash Inflow</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--info)' }}>₹{fyStats.cashInflow.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Expenses</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--error)' }}>₹{fyStats.expenses.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Net Cash Flow</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: fyStats.netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>₹{fyStats.netCashFlow.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* ── Unified Chronological Recent Activity Feed ─────────────────────── */}
      <div className="card">
        <div className="bill-view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: 'var(--accent)' }} /> Recent Activity Stream
            </h2>
            <p className="text-muted" style={{ fontSize: '0.82rem' }}>Chronological view of bills, payments, advances, refunds, and expenses</p>
          </div>
          {/* Activity Category Filter Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'bills', label: 'Bills' },
              { id: 'payments', label: 'Payments' },
              { id: 'advances', label: 'Advances' },
              { id: 'refunds', label: 'Refunds' },
              { id: 'expenses', label: 'Expenses' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivityTab(tab.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: activityTab === tab.id ? 'var(--accent)' : 'transparent',
                  color: activityTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {recentActivities.length === 0 ? (
          <EmptyState
            Icon={CreditCard}
            title="No activity recorded"
            description="No financial transactions match the selected activity filter."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction</th>
                  <th>Reference</th>
                  <th>Party</th>
                  <th>Payment Mode</th>
                  <th>Details</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.map((act, index) => {
                  const isOutflow = act.entityType === 'expense' || act.entityType === 'refund' || (act.entityType === 'advance' && act.status === 'returned')
                  return (
                    <tr key={`${act.id}-${index}`}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDisplayDate(act.date)}
                      </td>
                      <td>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{act.transaction}</strong>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem' }}>
                          {act.reference}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{act.party}</td>
                      <td>
                        <span className={`badge badge-${String(act.method).toLowerCase() === 'upi' ? 'upi' : String(act.method).toLowerCase() === 'mixed' ? 'info' : 'cash'}`} style={{ fontSize: '0.7rem' }}>
                          {String(act.method).toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{act.details}</td>
                      <td>
                        <strong className="font-mono tabular-nums" style={{ color: isOutflow ? 'var(--error)' : 'var(--success)' }}>
                          {isOutflow ? '-' : '+'}₹{act.amount.toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        <span className={`badge badge-${act.status === 'paid' ? 'paid' : act.status === 'completed' ? 'paid' : act.status === 'partial' ? 'partial' : act.status === 'active' ? 'paid' : 'unpaid'}`} style={{ fontSize: '0.7rem' }}>
                          {String(act.status).toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Customer Summary & Bills Breakdown Footer ──────────────────────── */}
      <div className="grid-2" style={{ marginTop: '24px' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Customer Profiles Summary</h3>
          <div style={{ display: 'grid', gap: '10px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              <span className="text-muted">Total Registered Customers</span>
              <strong style={{ color: 'var(--text-primary)' }}>{customers.filter((c) => !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              <span className="text-muted">Regular Account Customers</span>
              <strong>{customers.filter((c) => c.type === 'regular' && !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              <span className="text-muted">Walk-in Customer Profiles</span>
              <strong>{customers.filter((c) => c.type === 'random' && !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Customers Holding Advance Credits</span>
              <strong style={{ color: 'var(--info)' }}>
                {customers.filter((c) => !c.deleted && (c.advanceBalance > 0 || c.creditBalance > 0)).length}
              </strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Billing Settlement Breakdown</h3>
          <div style={{ display: 'grid', gap: '10px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} /> Fully Paid Bills
              </span>
              <strong>{paidBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} /> Partially Paid Bills
              </span>
              <strong>{partialBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <XCircle size={14} /> Fully Unpaid Bills
              </span>
              <strong>{unpaidBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} /> Overdue Past Due Date
              </span>
              <strong style={{ color: 'var(--error)' }}>{overdueBills.length}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
