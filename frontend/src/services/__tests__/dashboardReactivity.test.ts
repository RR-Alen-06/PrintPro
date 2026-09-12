import { describe, it, expect } from 'vitest'
import { DashboardService } from '../dashboardService'

describe('Dashboard Live Reactivity & Metrics Aggregation', () => {
  it('aggregates live sales, cash collected, and refunds accurately', () => {
    const mockBills = [
      { id: 'b1', total: 1000, amountPaid: 600, balance: 400, deleted: false },
      { id: 'b2', total: 500, amountPaid: 500, balance: 0, deleted: false },
      { id: 'b3', total: 2000, amountPaid: 0, balance: 2000, deleted: true } // Deleted bill ignored
    ]

    const mockPayments = [
      { id: 'p1', totalPaid: 600, isRefund: false },
      { id: 'p2', totalPaid: 500, isRefund: false },
      { id: 'p3', totalPaid: -100, isRefund: true } // Refund of 100
    ]

    const mockCustomers = [
      { id: 'c1', name: 'Alice', creditBalance: 250, deleted: false },
      { id: 'c2', name: 'Bob', creditBalance: 0, deleted: false }
    ]

    const stats = DashboardService.getSummaryWidgets({
      bills: mockBills,
      payments: mockPayments,
      advancePayments: [],
      customers: mockCustomers
    })

    expect(stats.grossRevenue).toBe(1500)
    expect(stats.totalRefunds).toBe(100)
    expect(stats.netRevenue).toBe(1400)
    expect(stats.pendingAmount).toBe(400)
    expect(stats.totalCollected).toBe(1100)
    expect(stats.totalCustomerAdvance).toBe(250)
    expect(stats.billCount).toBe(2)
    expect(stats.customerCount).toBe(2)
  })

  it('calculates aging buckets correctly for receivables', () => {
    const today = new Date()
    const daysAgo = (d: number) => {
      const dt = new Date(today)
      dt.setDate(dt.getDate() - d)
      return dt.toISOString().split('T')[0]
    }

    const mockBills = [
      { id: 'b1', date: daysAgo(5), balance: 300, deleted: false }, // 0-30 days
      { id: 'b2', date: daysAgo(40), balance: 700, deleted: false }, // 31-60 days
      { id: 'b3', date: daysAgo(90), balance: 1200, deleted: false }, // 61-90 days
      { id: 'b4', date: daysAgo(120), balance: 500, deleted: false } // 90+ days
    ]

    const aging = DashboardService.calculateAgingReport(mockBills)

    expect(aging.current).toBe(300)
    expect(aging.medium).toBe(700)
    expect(aging.aged).toBe(1700)
    expect(aging.total).toBe(2700)
  })
})
