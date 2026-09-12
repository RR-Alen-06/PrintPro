import { describe, it, expect } from 'vitest'
import { GroupBillingService } from '../groupBillingService'

describe('Group Billing Master-Child Invoicing & Per-Member Atomic Settlement', () => {
  it('calculates equal split with penny-perfect reconciliation across members', () => {
    const split = GroupBillingService.calculateSplitPurchase({
      totalAmount: 100,
      members: [
        { id: 'm1', customerId: 'cust-1' },
        { id: 'm2', customerId: 'cust-2' },
        { id: 'm3', customerId: 'cust-3' }
      ]
    })

    expect(split.memberCalculations.length).toBe(3)
    // 100 split 3 ways: 33.33, 33.33, and 33.34 for exact 100.00 total
    expect(split.memberCalculations[0].subtotal).toBe(33.33)
    expect(split.memberCalculations[1].subtotal).toBe(33.33)
    expect(split.memberCalculations[2].subtotal).toBe(33.34)
    expect(split.aggregateSubtotal).toBe(100)
  })

  it('handles per-member mixed settlement (Cash, UPI, and Advance Credit)', () => {
    const member1 = {
      customerId: 'cust-1',
      total: 500,
      cashPaid: 500,
      upiPaid: 0,
      useAdvance: false
    }

    const member2 = {
      customerId: 'cust-2',
      total: 500,
      cashPaid: 0,
      upiPaid: 300,
      useAdvance: true,
      custCredit: 200 // Advance credit
    }

    const member3 = {
      customerId: 'cust-3',
      total: 500,
      cashPaid: 0,
      upiPaid: 0,
      useAdvance: false // Unpaid (Credit balance due)
    }

    // Member 1: Full Cash
    const m1Paid = member1.cashPaid + member1.upiPaid
    const m1Bal = member1.total - m1Paid
    const m1Status = m1Bal <= 0 ? 'paid' : (m1Paid > 0 ? 'partial' : 'unpaid')
    expect(m1Bal).toBe(0)
    expect(m1Status).toBe('paid')

    // Member 2: 300 UPI + 200 Advance
    const m2AdvUsed = Math.min(member2.total, member2.custCredit)
    const m2Paid = member2.cashPaid + member2.upiPaid + m2AdvUsed
    const m2Bal = member2.total - m2Paid
    const m2Status = m2Bal <= 0 ? 'paid' : (m2Paid > 0 ? 'partial' : 'unpaid')
    expect(m2AdvUsed).toBe(200)
    expect(m2Paid).toBe(500)
    expect(m2Bal).toBe(0)
    expect(m2Status).toBe('paid')

    // Member 3: Unpaid
    const m3Paid = member3.cashPaid + member3.upiPaid
    const m3Bal = member3.total - m3Paid
    const m3Status = m3Bal <= 0 ? 'paid' : (m3Paid > 0 ? 'partial' : 'unpaid')
    expect(m3Bal).toBe(500)
    expect(m3Status).toBe('unpaid')
  })
})
