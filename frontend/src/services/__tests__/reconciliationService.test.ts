import { describe, it, expect } from 'vitest'
import { ReconciliationService } from '../reconciliationService'

describe('ReconciliationService', () => {
  it('correctly aggregates Cash and UPI payments separately', () => {
    const bills = [
      { id: 'b1', grand_total: 500, paid_total: 500, cash_paid: 200, upi_paid: 300, deleted: false },
      { id: 'b2', grand_total: 250, paid_total: 250, cash_paid: 250, upi_paid: 0, deleted: false },
    ]

    const payments = [
      { id: 'p1', billId: 'b1', amount: 500, cashAmount: 200, upiAmount: 300 },
      { id: 'p2', billId: 'b2', amount: 250, cashAmount: 250, upiAmount: 0 },
    ]

    const result = ReconciliationService.computePaymentReconciliation({
      bills,
      payments,
      customersAdvanceBalance: 100,
    })

    expect(result.total_sales).toBe(750)
    expect(result.cash_collected).toBe(450)
    expect(result.upi_collected).toBe(300)
    expect(result.total_amount_collected).toBe(750)
    expect(result.customer_advance_balance).toBe(100)
  })

  it('calculates physical cash denomination totals accurately', () => {
    const denominations = {
      500: 5,  // 2500
      200: 4,  // 800
      100: 10, // 1000
      50: 6,   // 300
      20: 5,   // 100
      10: 8,   // 80
    }

    const total = ReconciliationService.calculateDenominationsTotal(denominations)
    expect(total).toBe(4780)
  })

  it('calculates drawer variance for balanced, surplus, and shortage states', () => {
    // 1. Balanced: Opening (1000) + Cash Sales (3500) - Expenses (500) = Expected (4000) -> Count (4000)
    const balanced = ReconciliationService.calculateDrawerVariance({
      openingBalance: 1000,
      cashSales: 3500,
      cashExpenses: 500,
      physicalCount: 4000,
    })
    expect(balanced.expectedCash).toBe(4000)
    expect(balanced.variance).toBe(0)
    expect(balanced.status).toBe('balanced')

    // 2. Surplus: Count (4200) vs Expected (4000) -> +200
    const surplus = ReconciliationService.calculateDrawerVariance({
      openingBalance: 1000,
      cashSales: 3500,
      cashExpenses: 500,
      physicalCount: 4200,
    })
    expect(surplus.variance).toBe(200)
    expect(surplus.status).toBe('surplus')

    // 3. Shortage: Count (3850) vs Expected (4000) -> -150
    const shortage = ReconciliationService.calculateDrawerVariance({
      openingBalance: 1000,
      cashSales: 3500,
      cashExpenses: 500,
      physicalCount: 3850,
    })
    expect(shortage.variance).toBe(-150)
    expect(shortage.status).toBe('shortage')
  })

  it('computes correct date range boundaries for date filters', () => {
    const today = ReconciliationService.getDateRangeBounds('today')
    expect(today.startDate).toBeInstanceOf(Date)
    expect(today.endDate).toBeInstanceOf(Date)

    const weekly = ReconciliationService.getDateRangeBounds('weekly')
    expect(weekly.startDate).toBeInstanceOf(Date)
    expect(weekly.endDate).toBeInstanceOf(Date)

    const fy = ReconciliationService.getDateRangeBounds('financial_year')
    expect(fy.startDate?.getMonth()).toBe(3) // April (0-indexed 3)
  })
})
