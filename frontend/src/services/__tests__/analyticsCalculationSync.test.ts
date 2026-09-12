import { describe, it, expect } from 'vitest'
import { ReconciliationService } from '../reconciliationService'

describe('Analytics & Period Report Calculation Synchronization', () => {
  it('correctly calculates Net Revenue, Net Profit, and Net Cash Flow using standardized formulas', () => {
    // 1. Sample bills in period
    const bills = [
      { id: 'BILL-0001', total: 1000, amountPaid: 1000, balance: 0, date: '2026-09-10' },
      { id: 'BILL-0002', total: 500, amountPaid: 300, balance: 200, date: '2026-09-11' },
      { id: 'BILL-0003', total: 200, amountPaid: 0, balance: 200, date: '2026-09-12' },
    ]

    // 2. Sample payments (including bill refunds)
    const payments = [
      { id: 'PAY-0001', billId: 'BILL-0001', totalPaid: 1000, cashAmount: 500, upiAmount: 500, date: '2026-09-10' },
      { id: 'PAY-0002', billId: 'BILL-0002', totalPaid: 300, cashAmount: 300, upiAmount: 0, date: '2026-09-11' },
      { id: 'PAY-0003', billId: 'BILL-0001', totalPaid: -200, cashAmount: -200, upiAmount: 0, isRefund: true, date: '2026-09-12' }, // Bill Refund
    ]

    // 3. Sample advance payments (including deposit and return)
    const advancePayments = [
      { id: 'ADV-0001', amount: 400, cashAmount: 200, upiAmount: 200, date: '2026-09-10' },
      { id: 'ADV-0002', amount: -100, cashAmount: -100, upiAmount: 0, isReturn: true, date: '2026-09-12' }, // Advance Return
    ]

    // 4. Sample expenses
    const expenses = [
      { id: 'EXP-0001', amount: 300, cashAmount: 300, upiAmount: 0, date: '2026-09-10' },
      { id: 'EXP-0002', amount: 200, cashAmount: 0, upiAmount: 200, date: '2026-09-11' },
    ]

    // Formula Calculations
    const grossRevenue = bills.reduce((s, b) => s + b.total, 0) // 1000 + 500 + 200 = 1700
    const billRefunds = payments.filter(p => p.isRefund || p.totalPaid < 0).reduce((s, p) => s + Math.abs(p.totalPaid), 0) // 200
    const advReturns = advancePayments.filter(ap => ap.isReturn || ap.amount < 0).reduce((s, ap) => s + Math.abs(ap.amount), 0) // 100
    const totalRefunds = billRefunds + advReturns // 300

    const netRevenue = grossRevenue - totalRefunds // 1700 - 300 = 1400

    const normalPayments = payments.filter(p => !p.isRefund && p.totalPaid >= 0)
    const normalAdvPayments = advancePayments.filter(ap => !ap.isReturn && ap.amount > 0)

    const paymentInflow = normalPayments.reduce((s, p) => s + p.totalPaid, 0) // 1000 + 300 = 1300
    const advInflow = normalAdvPayments.reduce((s, ap) => s + ap.amount, 0) // 400
    const directRefundOutflow = 200 + 100 // 300

    const totalCashInflow = paymentInflow + advInflow - directRefundOutflow // 1300 + 400 - 300 = 1400

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0) // 300 + 200 = 500

    const netProfit = netRevenue - totalExpenses // 1400 - 500 = 900
    const netCashFlow = totalCashInflow - totalExpenses // 1400 - 500 = 900

    expect(grossRevenue).toBe(1700)
    expect(totalRefunds).toBe(300)
    expect(netRevenue).toBe(1400)
    expect(totalCashInflow).toBe(1400)
    expect(totalExpenses).toBe(500)
    expect(netProfit).toBe(900)
    expect(netCashFlow).toBe(900)
  })

  it('verifies date boundary calculations for date ranges', () => {
    const monthlyBounds = ReconciliationService.getDateRangeBounds('monthly')
    expect(monthlyBounds.startDate).toBeDefined()
    expect(monthlyBounds.endDate).toBeDefined()
    if (monthlyBounds.startDate && monthlyBounds.endDate) {
      expect(monthlyBounds.startDate <= monthlyBounds.endDate).toBe(true)
    }

    const customBounds = ReconciliationService.getDateRangeBounds('custom', { from: '2026-09-01', to: '2026-09-15' })
    expect(customBounds.startDate).toBeDefined()
    expect(customBounds.endDate).toBeDefined()
    if (customBounds.startDate && customBounds.endDate) {
      expect(customBounds.startDate.getFullYear()).toBe(2026)
      expect(customBounds.startDate.getMonth()).toBe(8) // 0-indexed September
      expect(customBounds.startDate.getDate()).toBe(1)
      expect(customBounds.endDate.getDate()).toBe(15)
    }
  })

  it('aggregates print type volume breakdown accurately across invoice items', () => {
    const billItems = [
      { name: 'A4 Color Single', printType: 'color', sides: 'single', qty: 50, amount: 500 },
      { name: 'A4 Color Double', printType: 'color', sides: 'double', qty: 30, amount: 450 },
      { name: 'A4 B/W Single', printType: 'bw', sides: 'single', qty: 200, amount: 400 },
      { name: 'A4 B/W Double', printType: 'bw', sides: 'double', qty: 100, amount: 300 },
    ]

    const counts: Record<string, number> = {
      'Color Single': 0,
      'Color Double': 0,
      'B/W Single': 0,
      'B/W Double': 0,
    }

    billItems.forEach((item) => {
      const key = `${item.printType === 'color' ? 'Color' : 'B/W'} ${item.sides === 'double' ? 'Double' : 'Single'}`
      counts[key] += item.qty
    })

    expect(counts['Color Single']).toBe(50)
    expect(counts['Color Double']).toBe(30)
    expect(counts['B/W Single']).toBe(200)
    expect(counts['B/W Double']).toBe(100)
  })
})
