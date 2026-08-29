import { describe, it, expect } from 'vitest'
import { GroupBillingService } from '../groupBillingService'

describe('GroupBillingService', () => {
  it('splits ₹100 across 3 members with exact penny reconciliation (33.33 + 33.33 + 33.34 = 100.00)', () => {
    const members = [
      { id: 'm1', customerId: 'cust-1' },
      { id: 'm2', customerId: 'cust-2' },
      { id: 'm3', customerId: 'cust-3' },
    ]

    const result = GroupBillingService.calculateSplitPurchase({
      totalAmount: 100,
      members,
      gstPercent: 0,
    })

    expect(result.memberCalculations.length).toBe(3)
    expect(result.aggregateSubtotal).toBe(100)
    expect(result.aggregateTotal).toBe(100)

    expect(result.memberCalculations[0].subtotal).toBe(33.33)
    expect(result.memberCalculations[1].subtotal).toBe(33.33)
    expect(result.memberCalculations[2].subtotal).toBe(33.34) // Last member absorbs 1-paisa rounding remainder

    const sumTotals = result.memberCalculations.reduce((sum, m) => sum + m.total, 0)
    expect(Number(sumTotals.toFixed(2))).toBe(100)
  })

  it('applies group discount (10% off) and 18% GST across split purchase members correctly', () => {
    const members = [
      { id: 'm1', customerId: 'cust-1', cashPaid: 50 },
      { id: 'm2', customerId: 'cust-2', upiPaid: 53.1 },
    ]

    const result = GroupBillingService.calculateSplitPurchase({
      totalAmount: 100,
      members,
      gstPercent: 18,
      discountMode: 'group',
      groupDiscount: { type: 'percent', value: 10 }, // 10% off
    })

    expect(result.memberCalculations.length).toBe(2)
    // Base per member: 50
    // Discount per member: 5 (10% of 50)
    // Taxable: 45
    // GST (18% of 45): 8.10
    // Total per member: 53.10
    expect(result.memberCalculations[0].subtotal).toBe(50)
    expect(result.memberCalculations[0].discountAmount).toBe(5)
    expect(result.memberCalculations[0].taxableAmount).toBe(45)
    expect(result.memberCalculations[0].gstAmount).toBe(8.1)
    expect(result.memberCalculations[0].total).toBe(53.1)
    expect(result.memberCalculations[0].balanceDue).toBe(3.1) // 53.10 - 50 = 3.10

    expect(result.memberCalculations[1].total).toBe(53.1)
    expect(result.memberCalculations[1].balanceDue).toBe(0) // 53.10 - 53.10 = 0
  })
})
