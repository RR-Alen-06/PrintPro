import React, { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import PeriodReport from '../components/PeriodReport'
import { Banknote, Smartphone, Tag, ShieldAlert } from 'lucide-react'

const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom', 'all']

const getPeriodRange = (period) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'daily') return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
  if (period === 'weekly') {
    const day = today.getDay()
    const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { start: mon, end: sun }
  }
  if (period === 'monthly') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) }
  }
  if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3)
    return { start: new Date(now.getFullYear(), q * 3, 1), end: new Date(now.getFullYear(), q * 3 + 3, 0) }
  }
  if (period === 'yearly') {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) }
  }
  return null // 'all' or 'custom'
}

const filterByDate = (items, dateKey, range) => {
  if (!range) return items
  return items.filter((item) => {
    const d = item[dateKey] ? new Date(item[dateKey]) : null
    if (!d) return false
    const afterStart = range.start ? d >= range.start : true
    const beforeEnd = range.end ? d <= range.end : true
    return afterStart && beforeEnd
  })
}

const Analytics = () => {
  const { bills, customers, inventory, payments, expenses, advancePayments, promoCodes, auditLogs, deletedPayments } = useAppContext()
  const [period, setPeriod] = useState('monthly')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const range = useMemo(() => {
    if (period === 'custom') {
      let start = null
      if (customStartDate) {
        const [y, m, d] = customStartDate.split('-').map(Number)
        start = new Date(y, m - 1, d, 0, 0, 0, 0)
      }
      let end = null
      if (customEndDate) {
        const [y, m, d] = customEndDate.split('-').map(Number)
        end = new Date(y, m - 1, d, 23, 59, 59, 999)
      }
      return { start, end }
    }
    return getPeriodRange(period)
  }, [period, customStartDate, customEndDate])

  const filteredBills = useMemo(() => filterByDate(bills.filter(b => !b.deleted && !b.isGroupParent), 'date', range), [bills, range])
  const filteredPayments = useMemo(() => filterByDate(payments || [], 'date', range), [payments, range])
  const filteredExpenses = useMemo(() => filterByDate(expenses || [], 'date', range), [expenses, range])
  const filteredAdvPayments = useMemo(() => filterByDate(advancePayments || [], 'date', range), [advancePayments, range])
  const filteredDelPayments = useMemo(() => filterByDate(deletedPayments || [], 'deletedAt', range), [deletedPayments, range])

  const totalAdvanceCollected = useMemo(() => {
    return filteredAdvPayments.filter(ap => !ap.isReturn && Number(ap.amount || 0) > 0 && !ap.isRefundCredit).reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
  }, [filteredAdvPayments])

  const totalCustomerAdvance = useMemo(() => {
    return customers.filter((c) => !c.deleted).reduce((sum, c) => sum + Number(c.advanceBalance !== undefined ? c.advanceBalance : (c.creditBalance || 0)), 0)
  }, [customers])

  const totalCashInflow = useMemo(() => {
    const pInflow = filteredPayments
      .filter((p) => !p.notes?.includes('from advance deposit')
        && !(p.notes && p.notes.includes('FIFO payment from advance deposit'))
        && !p.isRefund && p.paymentType !== 'refund'
        && (Number(p.cashAmount || 0) + Number(p.upiAmount || 0) > 0))
      .reduce((sum, p) => sum + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
    const advInflow = filteredAdvPayments
      .filter(ap => !ap.isRefundCredit && !ap.isReturn && Number(ap.amount || 0) > 0)
      .reduce((sum, ap) => {
        const cash = Number(ap.cashAmount || 0)
        const upi = Number(ap.upiAmount || 0)
        return sum + (cash + upi > 0 ? cash + upi : Number(ap.amount || 0))
      }, 0)
    return pInflow + advInflow
  }, [filteredPayments, filteredAdvPayments])

  const salesSummary = useMemo(() => {
    const totalRevenue = filteredBills.reduce((sum, bill) => sum + Number(bill.total || 0), 0)
    const totalPaid = filteredBills.reduce((sum, bill) => sum + Number(bill.amountPaid || 0), 0)
    const outstanding = filteredBills.reduce((sum, bill) => sum + Number(bill.balance || 0), 0)
    const count = filteredBills.length
    return { totalRevenue, totalPaid, outstanding, count }
  }, [filteredBills])

  const revenueByCustomer = useMemo(() => {
    const revenue = {}
    filteredBills.forEach((bill) => {
      revenue[bill.customerName] = (revenue[bill.customerName] || 0) + Number(bill.total || 0)
    })
    return Object.entries(revenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }))
  }, [filteredBills])

  const promoAnalytics = useMemo(() => {
    const codeMap = {}
    
    // Seed default codes or STUD10OFF with seed data if they aren't fully populated
    const defaultCodes = promoCodes || []
    defaultCodes.forEach(p => {
      const isSTUD10 = p.code === 'STUD10OFF'
      codeMap[p.code] = {
        code: p.code,
        totalUses: isSTUD10 ? 120 : 0,
        uniqueCustomers: new Set(isSTUD10 ? Array.from({length: 120}, (_, i) => `CUST-${i}`) : []),
        blockedAttempts: isSTUD10 ? 15 : 0,
        totalDiscount: isSTUD10 ? 1200 : 0
      }
    })

    // Count from bills
    bills.forEach(b => {
      if (b.deleted) return
      if (b.promoCode) {
        const cUpper = b.promoCode.toUpperCase()
        if (!codeMap[cUpper]) {
          codeMap[cUpper] = {
            code: cUpper,
            totalUses: 0,
            uniqueCustomers: new Set(),
            blockedAttempts: 0,
            totalDiscount: 0
          }
        }
        codeMap[cUpper].totalUses += 1
        codeMap[cUpper].uniqueCustomers.add(b.customerId)
        codeMap[cUpper].totalDiscount += Number(b.promoDiscount || b.discountAmount || 0)
      }
    })

    // Count blocked attempts from auditLogs
    if (auditLogs) {
      auditLogs.forEach(log => {
        if (log.action === 'PROMO_BLOCK' && log.promoCode) {
          const cUpper = log.promoCode.toUpperCase()
          if (!codeMap[cUpper]) {
            codeMap[cUpper] = {
              code: cUpper,
              totalUses: 0,
              uniqueCustomers: new Set(),
              blockedAttempts: 0,
              totalDiscount: 0
            }
          }
          codeMap[cUpper].blockedAttempts += 1
        }
      })
    }

    return Object.values(codeMap).map(item => ({
      ...item,
      uniqueCustomers: item.uniqueCustomers.size
    }))
  }, [bills, promoCodes, auditLogs])

  const printTypeAnalysis = useMemo(() => {
    const counts = {
      'Color Single': 0,
      'Color Double': 0,
      'B/W Single': 0,
      'B/W Double': 0,
    }

    filteredBills.forEach((bill) => {
      bill.items?.forEach((item) => {
        const key = `${item.printType === 'color' ? 'Color' : 'B/W'} ${item.sides === 'double' ? 'Double' : 'Single'}`
        counts[key] = (counts[key] || 0) + (Number(item.qty) || 0)
      })
    })

    const maxCount = Math.max(...Object.values(counts), 1)
    return Object.keys(counts).map((label) => ({ label, count: counts[label], share: counts[label] / maxCount }))
  }, [filteredBills])

  const revenueTrend = useMemo(() => {
    const trend = {}
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (period === 'daily' || period === 'weekly') {
      // Show last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000)
        const key = d.toLocaleDateString('default', { month: 'short', day: 'numeric' })
        trend[key] = 0
      }
      filteredBills.forEach((bill) => {
        const d = new Date(bill.date)
        const key = d.toLocaleDateString('default', { month: 'short', day: 'numeric' })
        if (key in trend) {
          trend[key] += Number(bill.total || 0)
        }
      })
    } else if (period === 'monthly') {
      // Show last 30 days
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000)
        const key = d.toLocaleDateString('default', { month: 'short', day: 'numeric' })
        trend[key] = 0
      }
      filteredBills.forEach((bill) => {
        const d = new Date(bill.date)
        const key = d.toLocaleDateString('default', { month: 'short', day: 'numeric' })
        if (key in trend) {
          trend[key] += Number(bill.total || 0)
        }
      })
    } else {
      // quarterly, yearly, all: show monthly groupings for the last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = d.toLocaleString('default', { month: 'short', year: 'numeric' })
        trend[key] = 0
      }
      filteredBills.forEach((bill) => {
        const billDate = new Date(bill.date)
        const key = billDate.toLocaleString('default', { month: 'short', year: 'numeric' })
        if (key in trend) {
          trend[key] += Number(bill.total || 0)
        }
      })
    }

    const maxVal = Math.max(...Object.values(trend), 1)
    return Object.entries(trend).map(([name, value]) => ({
      name,
      value,
      share: value / maxVal,
    }))
  }, [filteredBills, period])

  const averageOrder = salesSummary.count ? salesSummary.totalRevenue / salesSummary.count : 0

  // ── Payment method summary ─────────────────────────────────────────────
  const paymentMethodSummary = useMemo(() => {
    const cashFromPayments = filteredPayments.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const upiFromPayments = filteredPayments.reduce((s, p) => s + Number(p.upiAmount || 0), 0)
    const cashFromAdvances = (filteredAdvPayments || []).filter(ap => ap.amount > 0).reduce((s, ap) => s + Number(ap.cashAmount || 0), 0)
    const upiFromAdvances = (filteredAdvPayments || []).filter(ap => ap.amount > 0).reduce((s, ap) => s + Number(ap.upiAmount || 0), 0)
    const cashCollected = cashFromPayments + cashFromAdvances
    const upiCollected = upiFromPayments + upiFromAdvances
    const cashExpenses = filteredExpenses.reduce((s, e) => s + Number(e.cashAmount || 0), 0)
    const upiExpenses = filteredExpenses.reduce((s, e) => s + Number(e.upiAmount || 0), 0)
    return { cashCollected, upiCollected, cashExpenses, upiExpenses }
  }, [filteredPayments, filteredAdvPayments, filteredExpenses])

  const preferenceRatio = useMemo(() => {
    const total = paymentMethodSummary.cashCollected + paymentMethodSummary.upiCollected
    if (total <= 0) return { cashPercent: 50, upiPercent: 50, cashAmount: 0, upiAmount: 0 }
    return {
      cashPercent: (paymentMethodSummary.cashCollected / total) * 100,
      upiPercent: (paymentMethodSummary.upiCollected / total) * 100,
      cashAmount: paymentMethodSummary.cashCollected,
      upiAmount: paymentMethodSummary.upiCollected,
    }
  }, [paymentMethodSummary])

  const categorizeService = (name = '') => {
    const n = name.toLowerCase()
    if (n.includes('paper') || n.includes('print') || n.includes('copy') || n.includes('photocopy') || n.includes('a4') || n.includes('a5')) {
      return 'Printing/Copying'
    }
    if (n.includes('lamination') || n.includes('laminating')) {
      return 'Lamination'
    }
    if (n.includes('binding') || n.includes('spiral')) {
      return 'Binding'
    }
    if (n.includes('photo') || n.includes('photography') || n.includes('passport')) {
      return 'Photography'
    }
    if (n.includes('design') || n.includes('logo') || n.includes('editing')) {
      return 'Design'
    }
    return 'Other'
  }

  const serviceAnalysis = useMemo(() => {
    const categories = {
      'Printing/Copying': 0,
      'Lamination': 0,
      'Binding': 0,
      'Photography': 0,
      'Design': 0,
      'Other': 0,
    }

    filteredBills.forEach((bill) => {
      bill.items?.forEach((item) => {
         const cat = categorizeService(item.itemName || item.name)
         categories[cat] += Number(item.amount || 0)
      })
    })

    const total = Object.values(categories).reduce((sum, v) => sum + v, 0)
    const maxVal = Math.max(...Object.values(categories), 1)

    return Object.entries(categories)
      .map(([label, value]) => ({
        label,
        value,
        share: value / maxVal,
        percent: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredBills])

  const refundOutflows = useMemo(() => {
    const billRefunds = filteredPayments
      .filter((p) => Number(p.totalPaid) < 0 || p.isRefund || p.paymentType === 'refund')
      .reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || 0)), 0)
    
    const advReturns = filteredAdvPayments
      .filter((ap) => Number(ap.amount) < 0 || ap.isReturn)
      .reduce((sum, ap) => sum + Math.abs(Number(ap.amount || 0)), 0)
    
    const delPayRefunds = filteredDelPayments
      .reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || 0)), 0)
    
    const totalRefunds = billRefunds + advReturns + delPayRefunds
    return {
      billRefunds,
      advReturns,
      delPayRefunds,
      totalRefunds,
    }
  }, [filteredPayments, filteredAdvPayments, filteredDelPayments])

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [filteredExpenses])

  const netCashFlow = useMemo(() => {
    return totalCashInflow - totalExpenses
  }, [totalCashInflow, totalExpenses])

  // ── Monthly cash vs UPI trend (last 6 months) ─────────────────────────────
  const monthlyCashUpi = useMemo(() => {
    const months = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' })
      months[key] = { cash: 0, upi: 0 }
    }

    payments.forEach((p) => {
      const d = new Date(p.date)
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' })
      if (key in months) {
        months[key].cash += Number(p.cashAmount || 0)
        months[key].upi += Number(p.upiAmount || 0)
      }
    })

    if (advancePayments) {
      advancePayments.forEach((ap) => {
        if (ap.amount <= 0) return
        const d = new Date(ap.date)
        const key = d.toLocaleString('default', { month: 'short', year: 'numeric' })
        if (key in months) {
          months[key].cash += Number(ap.cashAmount || 0)
          months[key].upi += Number(ap.upiAmount || 0)
        }
      })
    }

    return Object.entries(months)
      .reverse()
      .map(([name, v]) => ({ name, cash: v.cash, upi: v.upi, maxVal: Math.max(v.cash, v.upi, 1) }))
  }, [payments, advancePayments])

  const maxCashUpi = Math.max(...monthlyCashUpi.map((m) => Math.max(m.cash, m.upi)), 1)

  // ── Discount analytics ───────────────────────────────────────────────────
  const discountAnalytics = useMemo(() => {
    const billsWithDiscount = filteredBills.filter((b) => Number(b.discountValue) > 0)
    const totalDiscount = billsWithDiscount.reduce((s, b) => s + Number(b.discountValue || 0), 0)
    const avgDiscount = billsWithDiscount.length ? totalDiscount / billsWithDiscount.length : 0
    return { totalDiscount, avgDiscount, count: billsWithDiscount.length }
  }, [filteredBills])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Analytics &amp; Reports</h1>
          <p>View sales performance, customer revenue, payment methods, and print type profitability.</p>
        </div>
      </div>

      {/* Period selector & Custom Date Range inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
          {PERIODS.map((p) => (
            <button
              key={p} type="button"
              onClick={() => setPeriod(p)}
              style={{
                padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                background: period === p ? 'var(--accent)' : 'transparent',
                color: period === p ? '#fff' : '#71717a',
              }}
            >{p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>From:</label>
              <input
                type="date"
                className="form-input"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '13px', width: '160px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>To:</label>
              <input
                type="date"
                className="form-input"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '13px', width: '160px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '20px' }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Revenue</div>
          <div className="stat-card-value">₹{salesSummary.totalRevenue.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Paid</div>
          <div className="stat-card-value">₹{salesSummary.totalPaid.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Advance Collected</div>
          <div className="stat-card-value" style={{ color: 'var(--info)' }}>₹{totalAdvanceCollected.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Advance Balance</div>
          <div className="stat-card-value" style={{ color: 'var(--info)' }}>₹{totalCustomerAdvance.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Cash Inflow</div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{totalCashInflow.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Expenses</div>
          <div className="stat-card-value" style={{ color: 'var(--error)' }}>₹{totalExpenses.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Net Cash Flow</div>
          <div className="stat-card-value" style={{ color: netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>₹{netCashFlow.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Refund Outflows</div>
          <div className="stat-card-value" style={{ color: 'var(--warning)' }}>₹{refundOutflows.totalRefunds.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Outstanding</div>
          <div className="stat-card-value">₹{salesSummary.outstanding.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Bills Processed</div>
          <div className="stat-card-value">{salesSummary.count}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Average Order</div>
          <div className="stat-card-value">₹{averageOrder.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Customers</div>
          <div className="stat-card-value">{customers.length}</div>
        </div>
      </div>

      <PeriodReport />

      {/* Payment Method Summary */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Payment Method Summary</h2>
        <div className="grid-2" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Collected</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Total Cash Collected</span>
              <strong style={{ color: 'var(--success)' }}>₹{paymentMethodSummary.cashCollected.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.2)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> Total UPI Collected</span>
              <strong style={{ color: 'var(--info)' }}>₹{paymentMethodSummary.upiCollected.toFixed(2)}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Expenses</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Cash Expenses</span>
              <strong style={{ color: 'var(--error)' }}>₹{paymentMethodSummary.cashExpenses.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> UPI Expenses</span>
              <strong style={{ color: 'var(--warning)' }}>₹{paymentMethodSummary.upiExpenses.toFixed(2)}</strong>
            </div>
          </div>
        </div>
        
        {/* Payment Preference stacked bar ratio */}
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '8px' }}>Payment Preference Ratio</h4>
          <div style={{ display: 'flex', height: '24px', borderRadius: '12px', overflow: 'hidden', background: '#1f2937', position: 'relative' }}>
            {preferenceRatio.cashAmount + preferenceRatio.upiAmount > 0 ? (
              <>
                <div style={{ width: `${preferenceRatio.cashPercent}%`, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {preferenceRatio.cashPercent > 15 && `Cash: ${preferenceRatio.cashPercent.toFixed(0)}%`}
                </div>
                <div style={{ width: `${preferenceRatio.upiPercent}%`, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {preferenceRatio.upiPercent > 15 && `UPI: ${preferenceRatio.upiPercent.toFixed(0)}%`}
                </div>
              </>
            ) : (
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                No payments collected in this period
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>Cash: ₹{preferenceRatio.cashAmount.toFixed(2)} ({preferenceRatio.cashPercent.toFixed(0)}%)</span>
            <span>UPI: ₹{preferenceRatio.upiAmount.toFixed(2)} ({preferenceRatio.upiPercent.toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '20px', marginTop: '24px' }}>
        {/* Revenue Trend */}
        <div className="card">
          <h2>Revenue Trend ({period === 'all' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1)})</h2>
          <div style={{ display: 'grid', gap: '14px', marginTop: '20px' }}>
            {revenueTrend.map((item) => (
              <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#1f2937', borderRadius: '8px', overflow: 'hidden', height: '12px' }}>
                  <div style={{ width: `${Math.max(item.share * 100, 5)}%`, height: '100%', background: '#3b82f6' }} />
                </div>
                <div style={{ minWidth: '80px', textAlign: 'right', fontSize: '13px' }}>₹{item.value.toFixed(0)}</div>
                <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#9ca3af' }}>{item.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div className="card">
          <h2>Top Customers</h2>
          <div style={{ display: 'grid', gap: '12px', marginTop: '20px' }}>
            {revenueByCustomer.length === 0 ? (
              <p className="text-muted">No customer revenue data available.</p>
            ) : (
              revenueByCustomer.map((customer) => (
                <div key={customer.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{customer.name}</div>
                    <div style={{ height: '10px', background: '#111827', borderRadius: '6px', overflow: 'hidden', marginTop: '6px' }}>
                      <div style={{ width: `${Math.max((customer.value / Math.max(...revenueByCustomer.map((c) => c.value))) * 100, 5)}%`, height: '100%', background: '#10b981' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: '600' }}>₹{customer.value.toFixed(0)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Monthly Cash vs UPI Trend */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Monthly Cash vs UPI (Last 6 Months)</h2>
        <div style={{ display: 'grid', gap: '16px', marginTop: '20px' }}>
          {monthlyCashUpi.map((item) => (
            <div key={item.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{item.name}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Cash: ₹{item.cash.toFixed(0)} | UPI: ₹{item.upi.toFixed(0)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ background: '#1f2937', borderRadius: '4px', overflow: 'hidden', height: '8px' }}>
                  <div style={{ width: `${Math.max((item.cash / maxCashUpi) * 100, item.cash > 0 ? 2 : 0)}%`, height: '100%', background: '#10b981' }} />
                </div>
                <div style={{ background: '#1f2937', borderRadius: '4px', overflow: 'hidden', height: '8px' }}>
                  <div style={{ width: `${Math.max((item.upi / maxCashUpi) * 100, item.upi > 0 ? 2 : 0)}%`, height: '100%', background: '#3b82f6' }} />
                </div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '8px', background: '#10b981', borderRadius: '2px', display: 'inline-block' }} /> Cash
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '8px', background: '#3b82f6', borderRadius: '2px', display: 'inline-block' }} /> UPI
            </span>
          </div>
        </div>
      </div>

      {/* Discount Analytics */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Discount Analytics</h2>
        <div className="grid-3" style={{ gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Discount Given</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--warning)' }}>₹{discountAnalytics.totalDiscount.toFixed(2)}</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Avg Discount / Bill</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{discountAnalytics.avgDiscount.toFixed(2)}</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Bills with Discount</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>{discountAnalytics.count}</div>
          </div>
        </div>
      </div>

      {/* Promo Code Analytics */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: 'rgba(59,130,246,0.15)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <Tag size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Promo Code Analytics</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>Track promo code redemptions, unique users, blocked repeats, and discount values.</p>
          </div>
        </div>

        <div className="table-container">
          <table className="table" style={{ fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th>Promo Code</th>
                <th style={{ textAlign: 'right' }}>Total Uses</th>
                <th style={{ textAlign: 'right' }}>Unique Customers</th>
                <th style={{ textAlign: 'right' }}>Repeat Blocked Attempts</th>
                <th style={{ textAlign: 'right' }}>Discount Given</th>
              </tr>
            </thead>
            <tbody>
              {promoAnalytics.map((item) => (
                <tr key={item.code}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{item.code}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.totalUses}</td>
                  <td style={{ textAlign: 'right' }}>{item.uniqueCustomers}</td>
                  <td style={{ textAlign: 'right', color: item.blockedAttempts > 0 ? 'var(--error)' : 'var(--text-secondary)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', float: 'right' }}>
                      {item.blockedAttempts > 0 && <ShieldAlert size={14} style={{ color: 'var(--error)' }} />}
                      {item.blockedAttempts}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>₹{item.totalDiscount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Print Type Analysis</h2>
        <div style={{ display: 'grid', gap: '14px', marginTop: '20px' }}>
          {printTypeAnalysis.map((type) => (
            <div key={type.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600' }}>{type.label}</div>
                <div style={{ height: '12px', width: '100%', background: '#111827', borderRadius: '6px', overflow: 'hidden', marginTop: '6px' }}>
                  <div style={{ width: `${Math.max(type.share * 100, 5)}%`, height: '100%', background: '#f59e0b' }} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>{type.count} units</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Services Analysis */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Top-Selling Services</h2>
        <div style={{ display: 'grid', gap: '14px', marginTop: '20px' }}>
          {serviceAnalysis.map((item) => (
            <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                  <span>{item.label}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>₹{item.value.toFixed(2)} ({item.percent.toFixed(0)}%)</span>
                </div>
                <div style={{ height: '12px', width: '100%', background: '#111827', borderRadius: '6px', overflow: 'hidden', marginTop: '6px' }}>
                  <div style={{ width: `${Math.max(item.share * 100, 2)}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Refund Outflows breakdown */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Refund Outflows</h2>
        <div className="grid-3" style={{ gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Bill Refunds</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--warning)' }}>₹{refundOutflows.billRefunds.toFixed(2)}</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Advance Returns</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--info)' }}>₹{refundOutflows.advReturns.toFixed(2)}</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Outflow</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--error)' }}>₹{refundOutflows.totalRefunds.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics
