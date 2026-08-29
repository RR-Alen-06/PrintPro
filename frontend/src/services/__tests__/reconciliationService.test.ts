import { describe, it, expect } from 'vitest'
import { ReconciliationService } from '../reconciliationService'

describe('ReconciliationService', () => {
  it('correctly segregates Cash, UPI, and total collections', () => {
    const bills = [
      { id: 'b1', total: 500, date: '2026-08-10', deleted: false },
      { id: 'b2', total: 300, date: '2026-08-15', deleted: false },
    ]

    const payments = [
      { id: 'p1', billId: 'b1', cashAmount: 200, upiAmount: 300, amount: 500, date: '2026-08-10' },
      { id: 'p2', billId: 'b2', cashAmount: 100, upiAmount: 0, amount: 100, date: '2026-08-15' },
    ]

    const result = ReconciliationService.computePaymentReconciliation({
      bills,
      payments,
      customersAdvanceBalance: 150,
    })

    expect(result.cash_collected).toBe(300)
    expect(result.upi_collected).toBe(300)
    expect(result.total_amount_collected).toBe(600)
    expect(result.customer_advance_balance).toBe(150)
  })

  it('filters date intervals correctly for today, weekly, monthly, and custom bounds', () => {
    const range = ReconciliationService.getDateRangeBounds('monthly')
    expect(range.startDate).toBeInstanceOf(Date)
    expect(range.endDate).toBeInstanceOf(Date)
    expect(range.startDate!.getTime()).toBeLessThan(range.endDate!.getTime())
  })
})
