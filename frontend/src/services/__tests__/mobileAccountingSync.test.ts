import { describe, it, expect } from 'vitest'

describe('Mobile Accounting Financial Engine & Drawer Reconciliation', () => {
  // Calculation simulator mirroring MobileAccounting.jsx calculation logic
  function calculateMobileAccounting({
    bills = [],
    expenses = [],
    payments = [],
    advancePayments = [],
    deletedPayments = [],
    period = 'all',
    todayStr = new Date().toISOString().slice(0, 10)
  }) {
    const isDateInPeriod = (itemDateStr, selectedPeriod) => {
      if (!itemDateStr || selectedPeriod === 'all') return true
      try {
        const itemDate = new Date(itemDateStr)
        if (isNaN(itemDate.getTime())) return true
        const now = new Date(todayStr)

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
          const curMonth = now.getMonth()
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
    }

    const periodBills = (bills || []).filter(b => !b.deleted && !b.deleted_at && !b.isGroupParent && !b.is_group_parent && isDateInPeriod(b.date || b.created_at, period))
    const periodExpenses = (expenses || []).filter(e => isDateInPeriod(e.date || e.created_at, period))
    const periodPayments = (payments || []).filter(p => isDateInPeriod(p.date || p.created_at, period))
    const periodAdvances = (advancePayments || []).filter(ap => isDateInPeriod(ap.date || ap.created_at, period))
    const periodDeletedPayments = (deletedPayments || []).filter(dp => isDateInPeriod(dp.date || dp.created_at, period))

    const totalRev = periodBills.reduce((s, b) => s + Number(b.total || 0), 0)
    const totalExp = periodExpenses.reduce((s, e) => s + Number(e.amount || e.total || 0), 0)

    const deletedBillIds = new Set((bills || []).filter(b => b.deleted || b.deleted_at).map(b => String(b.id)))
    const normalPayments = periodPayments.filter(p => {
      const isRef = p.isRefund || p.is_refund || p.paymentType === 'refund' || Number(p.totalPaid || p.total_paid || 0) < 0
      const isFifoAdv = p.notes?.includes('from advance deposit') || p.notes?.includes('FIFO payment')
      const isDeletedBill = deletedBillIds.has(String(p.billId || p.bill_id))
      return !isRef && !isFifoAdv && !isDeletedBill && Number(p.totalPaid || p.total_paid || 0) >= 0
    })

    const validAdvances = periodAdvances.filter(ap => {
      const isRefCredit = ap.isRefundCredit || ap.is_refund_credit
      const isRet = ap.isReturn || ap.is_return || Number(ap.amount || 0) < 0
      const isExc = ap.isExcessCredit || ap.is_excess_credit || ap.notes?.toLowerCase().includes('excess')
      const isOp = ap.notes?.toLowerCase().includes('opening')
      return !isRefCredit && !isRet && !isExc && !isOp && Number(ap.amount || 0) > 0
    })

    const cashFromNormalPayments = normalPayments.reduce((s, p) => s + Number(p.cashAmount || p.cash_amount || 0), 0)
    const upiFromNormalPayments = normalPayments.reduce((s, p) => s + Number(p.upiAmount || p.upi_amount || 0), 0)
    const cashFromAdvances = validAdvances.reduce((s, ap) => s + Number(ap.cashAmount || ap.cash_amount || 0), 0)
    const upiFromAdvances = validAdvances.reduce((s, ap) => s + Number(ap.upiAmount || ap.upi_amount || 0), 0)

    const totalCashInflow = cashFromNormalPayments + cashFromAdvances
    const totalUpiInflow = upiFromNormalPayments + upiFromAdvances
    const totalInflow = totalCashInflow + totalUpiInflow

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

      if (!hasExplicitCash && !hasExplicitCashSnake && !hasExplicitUpi && !hasExplicitUpiSnake) {
        c = eAmt
      }

      cashSpent += c
      upiSpent += u
    })

    const refundPayments = periodPayments.filter(p => p.isRefund || p.is_refund || p.paymentType === 'refund' || Number(p.totalPaid || p.total_paid || 0) < 0)
    const refundCash = refundPayments.reduce((s, p) => s + Math.abs(Number(p.cashAmount || p.cash_amount || 0)), 0)
    const refundUpi = refundPayments.reduce((s, p) => s + Math.abs(Number(p.upiAmount || p.upi_amount || 0)), 0)
    const totalRefunds = refundPayments.reduce((s, p) => s + Math.abs(Number(p.totalPaid || p.total_paid || 0)), 0)

    const advReturns = periodAdvances.filter(ap => Number(ap.amount || 0) < 0 || ap.isReturn || ap.is_return)
    const advReturnCash = advReturns.reduce((s, ap) => s + Math.abs(Number(ap.cashAmount || ap.cash_amount || 0)), 0)
    const advReturnUpi = advReturns.reduce((s, ap) => s + Math.abs(Number(ap.upiAmount || ap.upi_amount || 0)), 0)
    const totalAdvReturns = advReturns.reduce((s, ap) => s + Math.abs(Number(ap.amount || 0)), 0)

    const delPayCash = periodDeletedPayments.reduce((s, dp) => s + Math.abs(Number(dp.cashAmount || dp.cash_amount || 0)), 0)
    const delPayUpi = periodDeletedPayments.reduce((s, dp) => s + Math.abs(Number(dp.upiAmount || dp.upi_amount || 0)), 0)
    const totalDelPayments = periodDeletedPayments.reduce((s, dp) => s + Math.abs(Number(dp.totalPaid || dp.total_paid || 0)), 0)

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
  }

  it('correctly calculates Physical Cash on Hand with Payments, Advances, Expenses, and Refunds', () => {
    const bills = [
      { id: 1, total: 2000, date: '2026-09-13' }
    ]
    const payments = [
      // ₹1000 payment: ₹600 Cash + ₹400 UPI
      { id: 1, billId: 1, totalPaid: 1000, cashAmount: 600, upiAmount: 400, date: '2026-09-13' },
      // Refund: -₹200 Cash refund
      { id: 2, billId: 1, totalPaid: -200, cashAmount: -200, upiAmount: 0, isRefund: true, date: '2026-09-13' }
    ]
    const advancePayments = [
      // Advance deposit: ₹500 Cash
      { id: 1, amount: 500, cashAmount: 500, upiAmount: 0, date: '2026-09-13' },
      // Advance return: ₹100 Cash returned to customer
      { id: 2, amount: -100, cashAmount: -100, upiAmount: 0, isReturn: true, date: '2026-09-13' }
    ]
    const expenses = [
      // Expense 1: ₹300 Cash
      { id: 1, amount: 300, cashAmount: 300, upiAmount: 0, date: '2026-09-13' },
      // Expense 2: ₹150 UPI only
      { id: 2, amount: 150, cashAmount: 0, upiAmount: 150, date: '2026-09-13' }
    ]

    const res = calculateMobileAccounting({
      bills,
      payments,
      advancePayments,
      expenses,
      period: 'all'
    })

    // Total Cash Inflow = ₹600 (payment) + ₹500 (advance) = ₹1100
    expect(res.totalCashInflow).toBe(1100)

    // Total Cash Outflow = ₹300 (expense) + ₹200 (refund) + ₹100 (advance return) = ₹600
    expect(res.totalCashOutflow).toBe(600)

    // Net Physical Cash on Hand = 1100 - 600 = ₹500
    expect(res.netPhysicalCashOnHand).toBe(500)

    // UPI Ledger:
    // Inflow = ₹400
    // Outflow = ₹150 (expense)
    // Net UPI = ₹250
    expect(res.totalUpiInflow).toBe(400)
    expect(res.totalUpiOutflow).toBe(150)
    expect(res.netUpiDigitalBalance).toBe(250)

    // Total Net Profit = (1100 + 400) - (450 + 200 + 100) = 1500 - 750 = ₹750
    expect(res.netProfit).toBe(750)
  })

  it('handles zero cash correctly without falsy 0 || amount bugs', () => {
    const expenses = [
      // ₹500 UPI expense with explicit cashAmount: 0
      { id: 1, amount: 500, cashAmount: 0, upiAmount: 500, date: '2026-09-13' }
    ]
    const payments = [
      { id: 1, totalPaid: 1000, cashAmount: 1000, upiAmount: 0, date: '2026-09-13' }
    ]

    const res = calculateMobileAccounting({
      expenses,
      payments,
      period: 'all'
    })

    expect(res.cashSpent).toBe(0)
    expect(res.upiSpent).toBe(500)
    expect(res.netPhysicalCashOnHand).toBe(1000)
    expect(res.netUpiDigitalBalance).toBe(-500)
  })

  it('filters data by period correctly (Today vs All Time)', () => {
    const bills = [
      { id: 1, total: 1000, date: '2026-09-13' },
      { id: 2, total: 2000, date: '2026-08-01' }
    ]
    const expenses = [
      { id: 1, amount: 200, date: '2026-09-13' },
      { id: 2, amount: 400, date: '2026-08-01' }
    ]

    const allRes = calculateMobileAccounting({
      bills,
      expenses,
      period: 'all',
      todayStr: '2026-09-13'
    })
    expect(allRes.totalRev).toBe(3000)
    expect(allRes.totalExp).toBe(600)

    const todayRes = calculateMobileAccounting({
      bills,
      expenses,
      period: 'today',
      todayStr: '2026-09-13'
    })
    expect(todayRes.totalRev).toBe(1000)
    expect(todayRes.totalExp).toBe(200)
  })
})
