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

  it('reconciles unlinked customer payments across open bills via FIFO and fixes pending dues', () => {
    const bills = [
      { id: 'b1', customerId: 'c_arun', date: '2026-09-27T10:00:00Z', total: 5, amountPaid: 0, balance: 5, status: 'unpaid' },
      { id: 'b2', customerId: 'c_arun', date: '2026-09-27T11:00:00Z', total: 7, amountPaid: 0, balance: 7, status: 'unpaid' },
      { id: 'b3', customerId: 'c_akku', date: '2026-09-27T10:00:00Z', total: 5, amountPaid: 5, balance: 0, status: 'paid' },
      { id: 'b4', customerId: 'c_akku', date: '2026-09-27T11:00:00Z', total: 7, amountPaid: 7, balance: 0, status: 'paid' },
    ]

    const payments = [
      { id: 'p1', billId: 'b3', totalPaid: 5, date: '2026-09-27T16:35:48.552Z' },
      { id: 'p2', billId: 'b4', totalPaid: 7, date: '2026-09-27T16:37:13.770Z' },
      { id: 'p3', customerId: 'c_arun', totalPaid: 5, date: '2026-09-27T16:35:29.233Z' }, // unlinked ₹5 payment for Arun
    ]

    const reconciled = ReconciliationService.reconcileBillsWithPayments(bills, payments)

    // b1 (INV-999523 equivalent) should be fully settled by Arun's ₹5 payment
    const b1Reconciled = reconciled.find(b => b.id === 'b1')
    expect(b1Reconciled?.amountPaid).toBe(5)
    expect(b1Reconciled?.balance).toBe(0)
    expect(b1Reconciled?.status).toBe('paid')

    // b2 (BILL0002 equivalent) should remain unpaid with ₹7 balance
    const b2Reconciled = reconciled.find(b => b.id === 'b2')
    expect(b2Reconciled?.amountPaid).toBe(0)
    expect(b2Reconciled?.balance).toBe(7)
    expect(b2Reconciled?.status).toBe('unpaid')

    // Total pending dues across reconciled bills must be exactly ₹7.00 (not ₹12.00)
    const totalPending = reconciled.reduce((sum, b) => sum + Number(b.balance || 0), 0)
    expect(totalPending).toBe(7)

    // Total collected across reconciled bills must be exactly ₹17.00
    const totalCollected = reconciled.reduce((sum, b) => sum + Number(b.amountPaid || 0), 0)
    expect(totalCollected).toBe(17)
  })
})
