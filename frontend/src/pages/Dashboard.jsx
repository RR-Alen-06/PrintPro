import React, { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { TrendingUp, CreditCard, Clock, AlertTriangle, ChevronRight, Wallet, CheckCircle, XCircle, RefreshCw, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import { DashboardService } from '../utils/financialServices'

const Dashboard = () => {
  const { bills, customers, advancePayments, payments, deletedPayments, expenses, syncFromCloud, showToast } = useAppContext()
  const navigate = useNavigate()
  const today = new Date()

  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await syncFromCloud()
      showToast('Data synced successfully', 'success')
    } catch (e) {
      showToast('Failed to sync data', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const [filterType, setFilterType] = useState('all') // 'all', 'today', 'week', 'month', 'fy', 'custom'
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Default to current financial year based on current date
  const [selectedFY, setSelectedFY] = useState(
    new Date().getMonth() >= 3 
      ? String(new Date().getFullYear()) 
      : String(new Date().getFullYear() - 1)
  )

  const activeDateRange = useMemo(() => {
    let start = null
    let end = null
    const today = new Date()

    if (filterType === 'today') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
    } else if (filterType === 'week') {
      const day = today.getDay()
      const diff = today.getDate() - day
      start = new Date(today.getFullYear(), today.getMonth(), diff, 0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (filterType === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (filterType === 'fy') {
      const fyYear = parseInt(selectedFY, 10)
      start = new Date(fyYear, 3, 1, 0, 0, 0, 0) // April 1st
      end = new Date(fyYear + 1, 2, 31, 23, 59, 59, 999) // March 31st
    } else if (filterType === 'custom') {
      start = customStartDate ? new Date(customStartDate) : null
      if (start) start.setHours(0, 0, 0, 0)
      end = customEndDate ? new Date(customEndDate) : null
      if (end) end.setHours(23, 59, 59, 999)
    }

    return { start, end }
  }, [filterType, selectedFY, customStartDate, customEndDate])

  const filteredData = useMemo(() => {
    const { start, end } = activeDateRange
    
    const checkDate = (dateStr) => {
      if (!dateStr) return false
      const d = new Date(dateStr)
      if (start && d < start) return false
      if (end && d > end) return false
      return true
    }

    return {
      bills: bills.filter(b => checkDate(b.date)),
      payments: payments.filter(p => checkDate(p.date)),
      advancePayments: advancePayments.filter(ap => checkDate(ap.date)),
      expenses: expenses.filter(e => checkDate(e.date))
    }
  }, [bills, payments, advancePayments, expenses, activeDateRange])

  const fyStats = useMemo(() => {
    const fyYear = parseInt(selectedFY, 10)
    const startDate = new Date(fyYear, 3, 1, 0, 0, 0, 0) // April 1st
    const endDate = new Date(fyYear + 1, 2, 31, 23, 59, 59, 999) // March 31st

    const isDateInFY = (dateStr) => {
      if (!dateStr) return false
      const d = new Date(dateStr)
      return d >= startDate && d <= endDate
    }

    // 1. Total Invoiced Revenue: sum of active bills' total in this FY
    const fyBills = (bills || []).filter(b => !b.deleted && isDateInFY(b.date) && !b.isGroupParent)
    const revenue = fyBills.reduce((sum, b) => sum + Number(b.total || 0), 0)

    // 2. Refunds: sum of payments and advance returns in this FY
    const fyRefundPayments = (payments || []).filter(p => (p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid) < 0) && isDateInFY(p.date))
    const pRefunds = fyRefundPayments.reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || 0)), 0)
    const fyAdvReturns = (advancePayments || []).filter(ap => (Number(ap.amount) < 0 || ap.isReturn) && isDateInFY(ap.date))
    const advRefunds = fyAdvReturns.reduce((sum, ap) => sum + Math.abs(Number(ap.amount || 0)), 0)
    const refunds = pRefunds + advRefunds

    // 3. Cash Inflow: positive payments + advance deposits in this FY (using capped bill payment logic)
    const fyPayments = (payments || []).filter(p => !p.isRefund && p.paymentType !== 'refund'
      && !(p.notes && p.notes.includes('from advance deposit'))
      && !(p.notes && p.notes.includes('FIFO payment from advance deposit'))
      && (Number(p.cashAmount || 0) + Number(p.upiAmount || 0)) > 0 && isDateInFY(p.date))
    const deletedBillIds = new Set((bills || []).filter(b => b.deleted).map(b => String(b.id)))
    const billMap = new Map((bills || []).map(b => [String(b.id), Number(b.total || 0)]))
    
    const billPaymentsMap = new Map()
    let unlinkedCashTotal = 0
    let unlinkedUpiTotal = 0

    fyPayments.forEach(p => {
      const bId = String(p.billId || '')
      const cash = Number(p.cashAmount || 0)
      const upi = Number(p.upiAmount || 0)
      const total = cash + upi
      if (!deletedBillIds.has(bId) && bId && billMap.has(bId)) {
        if (!billPaymentsMap.has(bId)) {
          billPaymentsMap.set(bId, { cash: 0, upi: 0, total: 0 })
        }
        const curr = billPaymentsMap.get(bId)
        curr.cash += cash
        curr.upi += upi
        curr.total += total
      } else if (!bId || !deletedBillIds.has(bId)) {
        unlinkedCashTotal += cash
        unlinkedUpiTotal += upi
      }
    })

    let pInflowCash = unlinkedCashTotal
    let pInflowUpi = unlinkedUpiTotal

    billPaymentsMap.forEach((pData, bId) => {
      const billTotal = billMap.get(bId)
      if (pData.total > billTotal && billTotal > 0) {
        const ratio = billTotal / pData.total
        pInflowCash += Number((pData.cash * ratio).toFixed(2))
        pInflowUpi += Number((pData.upi * ratio).toFixed(2))
      } else {
        pInflowCash += pData.cash
        pInflowUpi += pData.upi
      }
    })

    const pInflow = pInflowCash + pInflowUpi

    const fyAdvances = (advancePayments || []).filter(ap => !ap.isRefundCredit && !ap.isReturn && !ap.isExcessCredit && !ap.notes?.toLowerCase().includes('excess') && !ap.notes?.toLowerCase().includes('opening') && Number(ap.amount || 0) > 0 && isDateInFY(ap.date))
    const advInflow = fyAdvances.reduce((sum, ap) => {
      const cash = Number(ap.cashAmount || 0)
      const upi = Number(ap.upiAmount || 0)
      return sum + (cash + upi > 0 ? cash + upi : Number(ap.amount || 0))
    }, 0)
    const cashInflow = pInflow + advInflow

    // 4. Expenses: sum of expenses in this FY
    const fyExpenses = (expenses || []).filter(e => isDateInFY(e.date))
    const fyExpTotal = fyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

    const netCashFlow = cashInflow - fyExpTotal - refunds

    return {
      revenue,
      refunds,
      cashInflow,
      expenses: fyExpTotal,
      netCashFlow
    }
  }, [bills, payments, advancePayments, expenses, selectedFY])

  const activeBills = useMemo(() => filteredData.bills.filter((b) => !b.deleted && !b.isGroupParent), [filteredData.bills])
  const paidBills = useMemo(() => activeBills.filter((b) => b.status === 'paid'), [activeBills])
  const partialBills = useMemo(() => activeBills.filter((b) => b.status === 'partial'), [activeBills])
  const unpaidBills = useMemo(() => activeBills.filter((b) => b.status === 'unpaid'), [activeBills])

  // Centralized calculations using DashboardService
  const dashboardStats = useMemo(() => {
    return DashboardService.getSummaryWidgets({ 
      bills: filteredData.bills, 
      payments: filteredData.payments, 
      advancePayments: filteredData.advancePayments, 
      deletedPayments, 
      expenses: filteredData.expenses, 
      customers, 
      inventory: [] 
    })
  }, [filteredData, deletedPayments, customers])

  const netRevenue = dashboardStats.netRevenue
  const pendingAmount = dashboardStats.pendingAmount
  const totalRefunds = dashboardStats.totalRefunds
  const totalCustomerAdvance = dashboardStats.totalCustomerAdvance

  const agingReport = useMemo(() => {
    return DashboardService.calculateAgingReport(bills)
  }, [bills])

  const refundPayments = useMemo(() => {
    return (filteredData.payments || []).filter((p) => p.isRefund || p.paymentType === 'refund' || p.totalPaid < 0)
  }, [filteredData.payments])

  const totalCashInflow = useMemo(() => {
    const deletedBillIds = new Set((filteredData.bills || []).filter(b => b.deleted).map(b => String(b.id)))
    const billMap = new Map((filteredData.bills || []).map(b => [String(b.id), Number(b.total || 0)]))
    
    const billPaymentsMap = new Map()
    let unlinkedCashTotal = 0
    let unlinkedUpiTotal = 0

    const validPayments = (filteredData.payments || []).filter((p) => 
      !p.isRefund && p.paymentType !== 'refund' 
      && !(p.notes && p.notes.includes('from advance deposit'))
      && !(p.notes && p.notes.includes('FIFO payment from advance deposit'))
      && !deletedBillIds.has(String(p.billId))
      && (Number(p.cashAmount || 0) + Number(p.upiAmount || 0)) > 0
    )

    validPayments.forEach(p => {
      const bId = String(p.billId || '')
      const cash = Number(p.cashAmount || 0)
      const upi = Number(p.upiAmount || 0)
      const total = cash + upi
      if (bId && billMap.has(bId)) {
        if (!billPaymentsMap.has(bId)) {
          billPaymentsMap.set(bId, { cash: 0, upi: 0, total: 0 })
        }
        const curr = billPaymentsMap.get(bId)
        curr.cash += cash
        curr.upi += upi
        curr.total += total
      } else {
        unlinkedCashTotal += cash
        unlinkedUpiTotal += upi
      }
    })

    let pInflowCash = unlinkedCashTotal
    let pInflowUpi = unlinkedUpiTotal

    billPaymentsMap.forEach((pData, bId) => {
      const billTotal = billMap.get(bId)
      if (pData.total > billTotal && billTotal > 0) {
        const ratio = billTotal / pData.total
        pInflowCash += Number((pData.cash * ratio).toFixed(2))
        pInflowUpi += Number((pData.upi * ratio).toFixed(2))
      } else {
        pInflowCash += pData.cash
        pInflowUpi += pData.upi
      }
    })

    const pInflow = pInflowCash + pInflowUpi

    // Count advance deposits EXCLUDING excess credits (already handled or capped in pInflow)
    const advInflow = (filteredData.advancePayments || [])
      .filter(ap => !ap.isRefundCredit && !ap.isReturn && !ap.isExcessCredit && !ap.notes?.toLowerCase().includes('excess') && !ap.notes?.toLowerCase().includes('opening') && Number(ap.amount || 0) > 0)
      .reduce((sum, ap) => {
        const cash = Number(ap.cashAmount || 0)
        const upi = Number(ap.upiAmount || 0)
        return sum + (cash + upi > 0 ? cash + upi : Number(ap.amount || 0))
      }, 0)
    return pInflow + advInflow
  }, [filteredData])

  const totalExpenses = useMemo(() => {
    return (filteredData.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [filteredData.expenses])

  const netCashFlow = useMemo(() => {
    // Net Cash Flow = Total Cash Inflow - Total Expenses - Total Refunds
    return totalCashInflow - totalExpenses - totalRefunds
  }, [totalCashInflow, totalExpenses, totalRefunds])

  const overdueBills = useMemo(
    () => activeBills.filter((b) => b.balance > 0 && b.dueDate && new Date(b.dueDate) < today),
    [activeBills]
  )

  // Pending dues per customer — sorted by balance desc
  const pendingDues = useMemo(() => {
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
        if (b.dueDate && new Date(b.dueDate) < today) entry.hasOverdue = true
      })
    return Object.values(map).sort((a, b) => b.totalDue - a.totalDue).slice(0, 8)
  }, [activeBills])

  const trendData = useMemo(() => {
    const today = new Date()
    let units = []
    
    const { start, end } = activeDateRange
    
    const startLimit = start || new Date(today.getFullYear(), today.getMonth() - 5, 1)
    const endLimit = end || today

    const diffDays = Math.ceil((endLimit - startLimit) / (1000 * 60 * 60 * 24))

    if (diffDays <= 1) {
      for (let i = 9; i <= 21; i += 2) {
        const s = new Date(startLimit)
        s.setHours(i, 0, 0, 0)
        const e = new Date(startLimit)
        e.setHours(i + 2, 0, 0, 0)
        units.push({ label: `${i}:00`, start: s, end: e, revenue: 0, expenses: 0 })
      }
    } else if (diffDays <= 8) {
      for (let i = 0; i < diffDays; i++) {
        const s = new Date(startLimit)
        s.setDate(s.getDate() + i)
        s.setHours(0,0,0,0)
        const e = new Date(s)
        e.setHours(23,59,59,999)
        const dayLabel = s.toLocaleDateString('en-IN', { weekday: 'short' })
        units.push({ label: dayLabel, start: s, end: e, revenue: 0, expenses: 0 })
      }
    } else if (diffDays <= 32) {
      for (let i = 0; i < diffDays; i += 5) {
        const s = new Date(startLimit)
        s.setDate(s.getDate() + i)
        s.setHours(0,0,0,0)
        const e = new Date(s)
        e.setDate(e.getDate() + 4)
        e.setHours(23,59,59,999)
        units.push({ label: `${s.getDate()} - ${e.getDate()} ${s.toLocaleDateString('en-US', { month: 'short' })}`, start: s, end: e, revenue: 0, expenses: 0 })
      }
    } else {
      let temp = new Date(startLimit.getFullYear(), startLimit.getMonth(), 1)
      while (temp <= endLimit) {
        const s = new Date(temp)
        const e = new Date(temp.getFullYear(), temp.getMonth() + 1, 0, 23, 59, 59, 999)
        units.push({ label: temp.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), start: s, end: e, revenue: 0, expenses: 0 })
        temp.setMonth(temp.getMonth() + 1)
      }
    }

    units.forEach(u => {
      const uBills = filteredData.bills.filter(b => {
        const d = new Date(b.date)
        return d >= u.start && d <= u.end && !b.deleted && !b.isGroupParent
      })
      u.revenue = uBills.reduce((sum, b) => sum + Number(b.total || 0), 0)

      const uExpenses = filteredData.expenses.filter(exp => {
        const d = new Date(exp.date)
        return d >= u.start && d <= u.end
      })
      u.expenses = uExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)
    })

    return units
  }, [filteredData, activeDateRange])

  const urgencyStyle = (entry) => {
    if (entry.hasOverdue) return { color: 'var(--error)', bg: 'var(--error-bg)', border: 'rgba(239,68,68,0.2)' }
    return { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'rgba(245,158,11,0.2)' }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Dashboard</h1>
          <p>Overview of billing activity, pending dues, and customer status.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--border-light)', padding: '4px 8px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Period:</span>
            <select
              className="form-select"
              style={{ padding: '4px 8px', fontSize: '0.85rem', width: '150px', background: 'transparent', border: 'none' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="fy">Financial Year</option>
              <option value="custom">Custom Range</option>
            </select>
            {filterType === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '2px 6px', fontSize: '0.8rem', width: '120px' }}
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '2px 6px', fontSize: '0.8rem', width: '120px' }}
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            )}
          </div>
          <button className="btn btn-secondary" onClick={handleSync} disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={16} className={isSyncing ? 'spin' : ''} /> {isSyncing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </div>

      {/* Financial Health Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ width: '4px', height: '14px', background: 'var(--gradient-accent)', borderRadius: '2px', display: 'inline-block' }} />
          Financial Performance
        </h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '20px' }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon indigo"><TrendingUp /></div>
              <div>
                <div className="stat-card-label">Total Revenue</div>
                <div className="stat-card-value">₹{netRevenue.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">₹{dashboardStats.totalCollected?.toFixed(2) || '0.00'} collected ({activeBills.length} invoices generated)</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon success" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><TrendingUp /></div>
              <div>
                <div className="stat-card-label">Total Cash Inflow</div>
                <div className="stat-card-value">₹{totalCashInflow.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">Net cash & UPI inflow collected</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon error" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}><XCircle /></div>
              <div>
                <div className="stat-card-label">Total Refunds</div>
                <div className="stat-card-value">₹{totalRefunds.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">Total refund adjustments processed</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon success" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><Wallet /></div>
              <div>
                <div className="stat-card-label">Advance Balance</div>
                <div className="stat-card-value">₹{totalCustomerAdvance.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">Outstanding customer credits</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className={`stat-card-icon ${netCashFlow >= 0 ? 'success' : 'error'}`} style={{ background: netCashFlow >= 0 ? 'var(--success-bg)' : 'var(--error-bg)', color: netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {netCashFlow >= 0 ? <TrendingUp /> : <XCircle />}
              </div>
              <div>
                <div className="stat-card-label">Net Cash Flow</div>
                <div className="stat-card-value" style={{ color: netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  ₹{netCashFlow.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operations & Receivables Section */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ width: '4px', height: '14px', background: 'var(--gradient-accent)', borderRadius: '2px', display: 'inline-block' }} />
          Operations & Receivables
        </h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon warning"><CreditCard /></div>
              <div>
                <div className="stat-card-label">Pending Dues</div>
                <div className="stat-card-value">₹{pendingAmount.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">{partialBills.length + unpaidBills.length} open bills pending</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon error"><Clock /></div>
              <div>
                <div className="stat-card-label">Overdue Bills</div>
                <div className="stat-card-value" style={{ color: overdueBills.length > 0 ? 'var(--error)' : 'var(--text-primary)' }}>{overdueBills.length}</div>
              </div>
            </div>
            <div className="stat-card-sub">Past due date with balance</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon success" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><AlertTriangle /></div>
              <div>
                <div className="stat-card-label">Customers with Dues</div>
                <div className="stat-card-value">{pendingDues.length}</div>
              </div>
            </div>
            <div className="stat-card-sub">Active debtors in ledger</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Pending Dues Widget */}
        <div className="card" style={{ height: '100%', marginBottom: 0 }}>
        <div className="bill-view-header">
          <div>
            <h2>Pending Dues Summary</h2>
            <p className="text-muted">Customers with outstanding balances — sorted by amount owed</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers')}>
            View All <ChevronRight size={14} />
          </button>
        </div>

        {pendingDues.length === 0 ? (
          <EmptyState
            Icon={CheckCircle}
            title="All bills settled"
            description="No outstanding balances at this time. All customer accounts are fully paid."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Bills</th>
                  <th>Date Range</th>
                  <th>Amount Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingDues.map((entry) => {
                  const s = urgencyStyle(entry)
                  return (
                    <tr
                      key={entry.customerId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/customers')}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.customerId}</div>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>

        {/* A/R Aging Summary */}
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
          <div className="bill-view-header">
            <div>
              <h2>Receivables Aging Summary</h2>
              <p className="text-muted">Outstanding invoices grouped by overdue timeframe</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px', flex: 1, justifyContent: 'center' }}>
            {/* 0-30 Days */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                <span>Current (0-30 Days)</span>
                <span>₹{agingReport.current.toFixed(2)}</span>
              </div>
              <div style={{ background: 'var(--border-light)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  background: 'var(--success)',
                  height: '100%',
                  width: `${agingReport.total > 0 ? (agingReport.current / agingReport.total) * 100 : 0}%`
                }} />
              </div>
            </div>

            {/* 31-60 Days */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                <span>Medium (31-60 Days)</span>
                <span>₹{agingReport.medium.toFixed(2)}</span>
              </div>
              <div style={{ background: 'var(--border-light)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  background: 'var(--warning)',
                  height: '100%',
                  width: `${agingReport.total > 0 ? (agingReport.medium / agingReport.total) * 100 : 0}%`
                }} />
              </div>
            </div>

            {/* 61+ Days */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                <span>Aged (61+ Days)</span>
                <span style={{ color: 'var(--error)' }}>₹{agingReport.aged.toFixed(2)}</span>
              </div>
              <div style={{ background: 'var(--border-light)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  background: 'var(--error)',
                  height: '100%',
                  width: `${agingReport.total > 0 ? (agingReport.aged / agingReport.total) * 100 : 0}%`
                }} />
              </div>
            </div>

            {/* Total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              borderTop: '1px solid var(--border)',
              paddingTop: '12px',
              marginTop: '8px',
              fontSize: '1rem'
            }}>
              <span>Total Outstanding:</span>
              <span style={{ color: 'var(--accent)' }}>₹{agingReport.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue vs Expenses Trend Chart */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="bill-view-header" style={{ marginBottom: '16px' }}>
          <div>
            <h2>Revenue vs. Expenses Trend</h2>
            <p className="text-muted">Visual comparison of revenue (gross billing) vs. recorded expenses</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', background: 'var(--success)', borderRadius: '3px' }} />
              Revenue
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', background: 'var(--error)', borderRadius: '3px' }} />
              Expenses
            </span>
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', height: '220px', overflowX: 'auto', overflowY: 'hidden' }}>
          <svg style={{ width: '100%', minWidth: '600px', height: '200px' }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const maxVal = Math.max(...trendData.map(t => Math.max(t.revenue, t.expenses)), 100)
              const val = maxVal * pct
              const y = 160 - pct * 130
              return (
                <g key={idx}>
                  <line x1="45" y1={y} x2="98%" y2={y} stroke="var(--border)" strokeDasharray="4" />
                  <text x="5" y={y + 4} fill="var(--text-muted)" fontSize="10" fontWeight="600">₹{Math.round(val)}</text>
                </g>
              )
            })}

            {/* Bars */}
            {trendData.map((d, idx) => {
              const maxVal = Math.max(...trendData.map(t => Math.max(t.revenue, t.expenses)), 100)
              
              const barWidth = 14
              const gap = 3
              const xStart = 60 + idx * (500 / (trendData.length || 1) + 12)

              const revH = (d.revenue / maxVal) * 130
              const revY = 160 - revH

              const expH = (d.expenses / maxVal) * 130
              const expY = 160 - expH

              return (
                <g key={idx}>
                  {/* Revenue Bar */}
                  <rect
                    x={xStart}
                    y={revY}
                    width={barWidth}
                    height={revH}
                    fill="var(--success)"
                    rx="3"
                    style={{ transition: 'all 0.3s' }}
                  />
                  {/* Expenses Bar */}
                  <rect
                    x={xStart + barWidth + gap}
                    y={expY}
                    width={barWidth}
                    height={expH}
                    fill="var(--error)"
                    rx="3"
                    style={{ transition: 'all 0.3s' }}
                  />
                  {/* Label */}
                  <text
                    x={xStart + barWidth}
                    y="182"
                    fill="var(--text-secondary)"
                    fontSize="10"
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    {d.label}
                  </text>
                </g>
              )
            })}
            
            {/* Base line */}
            <line x1="45" y1="160" x2="98%" y2="160" stroke="var(--border)" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {/* Financial Year Analytics Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Financial Year Analytics</h2>
            <p className="text-muted">Filter historical data by Indian Financial Year (April 1st to March 31st)</p>
          </div>
          <select
            className="form-select"
            style={{ width: '280px', padding: '8px 12px', fontSize: '0.9rem' }}
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
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Cash Inflow</div>
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

      {/* Recent Bills */}
      <div className="card">
        <div className="bill-view-header">
          <div>
            <h2>Recent Bills</h2>
            <p className="text-muted">Latest transactions</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/billing')}>
            All Bills <ChevronRight size={14} />
          </button>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Bill ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activeBills.slice(0, 6).map((bill, index) => (
                <tr key={`${bill.id}-${index}`}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent)' }}>{bill.id}</td>
                  <td>{bill.customerName}</td>
                  <td>{bill.date}</td>
                  <td>₹{bill.total.toFixed(2)}</td>
                  <td>₹{bill.amountPaid.toFixed(2)}</td>
                  <td style={{ color: bill.balance > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                    ₹{bill.balance.toFixed(2)}
                  </td>
                  <td>
                    <span className={`badge badge-${bill.status === 'paid' ? 'paid' : bill.status === 'partial' ? 'partial' : 'unpaid'}`}>
                      {bill.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {activeBills.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '0' }}>
                    <EmptyState
                      Icon={CreditCard}
                      title="No bills generated yet"
                      description="Generate your first print bill invoice to see detailed activity here."
                      actionText="Create First Bill"
                      onAction={() => navigate('/billing')}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer summary */}
      <div className="grid-2" style={{ marginTop: '24px' }}>
        <div className="card">
          <h3>Customer Summary</h3>
          <div style={{ marginTop: '12px', display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Total Customers</span>
              <strong>{customers.filter((c) => !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Regular</span>
              <strong>{customers.filter((c) => c.type === 'regular' && !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Walk-in</span>
              <strong>{customers.filter((c) => c.type === 'random' && !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Archived</span>
              <strong>{customers.filter((c) => c.deleted).length}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Bill Status Breakdown</h3>
          <div style={{ marginTop: '12px', display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> Paid</span>
              <strong>{paidBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Partial</span>
              <strong>{partialBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><XCircle size={14} /> Unpaid</span>
              <strong>{unpaidBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> Overdue</span>
              <strong>{overdueBills.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Appended Feature: Recent Activity Feed */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={18} /> Recent Transactions
        </h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...bills.map(b => ({ ...b, sortDate: new Date(b.createdAt || b.date), actType: 'Bill' })), ...payments.map(p => ({ ...p, sortDate: new Date(p.createdAt || p.date), actType: 'Payment' }))]
                .sort((a, b) => b.sortDate - a.sortDate)
                .slice(0, 5)
                .map((act, i) => (
                  <tr key={i}>
                    <td>{act.date}</td>
                    <td>
                      <span className={`badge ${act.actType === 'Bill' ? 'badge-primary' : 'badge-success'}`}>
                        {act.actType}
                      </span>
                    </td>
                    <td>{act.customerName}</td>
                    <td style={{ fontWeight: 600, color: act.actType === 'Bill' ? 'var(--text-main)' : 'var(--success)' }}>
                      {act.actType === 'Payment' ? '+' : ''}₹{Number(act.total || act.totalPaid || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              {bills.length === 0 && payments.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No recent activity.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Forecast Chart */}
      {(() => {
        // Build last 6 months revenue data
        const monthLabels = []
        const monthRevenues = []
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
          const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
          const revenue = bills
            .filter(b => !b.deleted && !b.isGroupParent)
            .filter(b => {
              const bd = new Date(b.date || b.createdAt)
              return bd >= d && bd <= monthEnd
            })
            .reduce((s, b) => s + Number(b.total || 0), 0)
          monthLabels.push(label)
          monthRevenues.push(revenue)
        }
        
        // Simple linear regression for next 3 months
        const n = monthRevenues.length
        const xMean = (n - 1) / 2
        const yMean = monthRevenues.reduce((a, b) => a + b, 0) / n
        let num = 0, den = 0
        monthRevenues.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2 })
        const slope = den !== 0 ? num / den : 0
        const intercept = yMean - slope * xMean
        
        const forecastLabels = []
        const forecastRevenues = []
        for (let i = 1; i <= 3; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
          forecastLabels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }))
          forecastRevenues.push(Math.max(0, Math.round(slope * (n - 1 + i) + intercept)))
        }
        
        const allValues = [...monthRevenues, ...forecastRevenues]
        const maxVal = Math.max(...allValues, 1)

        return (
          <div className="card" style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} /> Sales Forecast (Next 3 Months)
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '180px', padding: '0 8px' }}>
              {monthLabels.map((label, i) => (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    ₹{(monthRevenues[i] / 1000).toFixed(1)}k
                  </span>
                  <div style={{
                    width: '100%',
                    maxWidth: '40px',
                    height: `${Math.max((monthRevenues[i] / maxVal) * 140, 4)}px`,
                    background: 'linear-gradient(180deg, var(--accent), var(--accent-light, #6366f1))',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.5s ease'
                  }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ))}
              {/* Separator */}
              <div style={{ width: '2px', background: 'var(--border)', height: '140px', margin: '0 4px', alignSelf: 'flex-end' }} />
              {forecastLabels.map((label, i) => (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--success)' }}>
                    ₹{(forecastRevenues[i] / 1000).toFixed(1)}k
                  </span>
                  <div style={{
                    width: '100%',
                    maxWidth: '40px',
                    height: `${Math.max((forecastRevenues[i] / maxVal) * 140, 4)}px`,
                    background: 'linear-gradient(180deg, var(--success), rgba(16,185,129,0.5))',
                    borderRadius: '4px 4px 0 0',
                    border: '2px dashed var(--success)',
                    transition: 'height 0.5s ease'
                  }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--accent)', borderRadius: '2px' }} /> Historical
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--success)', borderRadius: '2px', border: '1px dashed var(--success)' }} /> Projected
              </span>
            </div>
          </div>
        )
      })()}

      {/* Job Delivery Completion Tracker */}
      {(() => {
        const pendingJobs = bills
          .filter(b => !b.deleted && !b.isGroupParent && b.estimatedCompletion && new Date(b.estimatedCompletion) >= new Date(new Date().toISOString().split('T')[0]))
          .sort((a, b) => new Date(a.estimatedCompletion) - new Date(b.estimatedCompletion))
          .slice(0, 10)
        
        const overdueJobs = bills
          .filter(b => !b.deleted && !b.isGroupParent && b.estimatedCompletion && new Date(b.estimatedCompletion) < new Date(new Date().toISOString().split('T')[0]) && b.status !== 'completed')
          .sort((a, b) => new Date(a.estimatedCompletion) - new Date(b.estimatedCompletion))
        
        return (
          <div className="card" style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} /> Job Delivery Tracker
            </h3>
            
            {overdueJobs.length > 0 && (
              <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'var(--error-bg, rgba(239,68,68,0.1))', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ color: 'var(--error)', fontSize: '0.85rem' }}>
                  <AlertTriangle size={14} style={{ verticalAlign: 'middle' }} /> {overdueJobs.length} Overdue Job{overdueJobs.length > 1 ? 's' : ''}
                </strong>
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {overdueJobs.map(j => (
                    <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span>{j.invoiceNumber || j.id} — {j.customerName}</span>
                      <span style={{ color: 'var(--error)' }}>Due: {j.estimatedCompletion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {pendingJobs.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Est. Completion</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingJobs.map(j => {
                      const daysLeft = Math.ceil((new Date(j.estimatedCompletion) - new Date()) / (1000 * 60 * 60 * 24))
                      return (
                        <tr key={j.id}>
                          <td style={{ fontWeight: 600 }}>{j.invoiceNumber || j.id}</td>
                          <td>{j.customerName}</td>
                          <td>{j.estimatedCompletion}</td>
                          <td>
                            <span className={`badge ${daysLeft <= 1 ? 'badge-warning' : 'badge-primary'}`}>
                              {daysLeft <= 0 ? 'Today' : `${daysLeft} day${daysLeft > 1 ? 's' : ''}`}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>
                No upcoming job deliveries. Set estimated completion dates on bills to track them here.
              </p>
            )}
          </div>
        )
      })()}
    </div>
  )
}

export default Dashboard
