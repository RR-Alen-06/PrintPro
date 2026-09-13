import { describe, it, expect } from 'vitest'
import { GroupBillingService } from '../groupBillingService'

describe('Group Billing & Split Invoicing Audit & Synchronization', () => {
  it('splits ₹100 across 3 members with penny-perfect reconciliation (33.33 + 33.33 + 33.34 = 100.00)', () => {
    const split = GroupBillingService.calculateSplitPurchase({
      totalAmount: 100,
      members: [
        { id: 'm1', customerId: 'cust-1' },
        { id: 'm2', customerId: 'cust-2' },
        { id: 'm3', customerId: 'cust-3' },
      ],
      gstPercent: 0,
    })

    expect(split.memberCalculations.length).toBe(3)
    expect(split.memberCalculations[0].subtotal).toBe(33.33)
    expect(split.memberCalculations[1].subtotal).toBe(33.33)
    expect(split.memberCalculations[2].subtotal).toBe(33.34)
    expect(split.aggregateSubtotal).toBe(100)
    expect(split.aggregateTotal).toBe(100)
    expect(split.aggregateBalanceDue).toBe(100)
  })

  it('draws down member advance balance accurately before calculating balance due', () => {
    const split = GroupBillingService.calculateSplitPurchase({
      totalAmount: 100,
      members: [
        {
          id: 'm1',
          customerId: 'cust-1',
          useAdvance: true,
          advanceBalance: 20, // 20 advance available
          cashPaid: 13.33,
        },
        {
          id: 'm2',
          customerId: 'cust-2',
          useAdvance: true,
          advanceBalance: 50, // 50 advance available (exceeds member total 33.33)
          cashPaid: 0,
        },
        {
          id: 'm3',
          customerId: 'cust-3',
          useAdvance: false,
          advanceBalance: 100, // Not used
          cashPaid: 0,
          upiPaid: 33.34,
        },
      ],
      gstPercent: 0,
    })

    // Member 1: 33.33 total, 20 advance, 13.33 cash => 0 balance due
    expect(split.memberCalculations[0].subtotal).toBe(33.33)
    expect(split.memberCalculations[0].advanceUsed).toBe(20)
    expect(split.memberCalculations[0].cashPaid).toBe(13.33)
    expect(split.memberCalculations[0].balanceDue).toBe(0)

    // Member 2: 33.33 total, 33.33 advance drawn (capped at total) => 0 balance due
    expect(split.memberCalculations[1].subtotal).toBe(33.33)
    expect(split.memberCalculations[1].advanceUsed).toBe(33.33)
    expect(split.memberCalculations[1].balanceDue).toBe(0)

    // Member 3: 33.34 total, 0 advance, 33.34 UPI => 0 balance due
    expect(split.memberCalculations[2].subtotal).toBe(33.34)
    expect(split.memberCalculations[2].advanceUsed).toBe(0)
    expect(split.memberCalculations[2].upiPaid).toBe(33.34)
    expect(split.memberCalculations[2].balanceDue).toBe(0)

    // Aggregate summary
    expect(split.aggregateAdvanceUsed).toBe(53.33)
    expect(split.aggregateCashPaid).toBe(13.33)
    expect(split.aggregateUpiPaid).toBe(33.34)
    expect(split.aggregateBalanceDue).toBe(0)
  })

  it('calculates single payer settlement with advance deposit and cash/upi', () => {
    const settlement = GroupBillingService.calculateSinglePayerSettlement({
      aggregateTotal: 1500,
      payerAdvance: 500,
      useAdvance: true,
      cashPaid: 600,
      upiPaid: 400,
    })

    expect(settlement.advanceUsed).toBe(500)
    expect(settlement.cashPaid).toBe(600)
    expect(settlement.upiPaid).toBe(400)
    expect(settlement.totalPaid).toBe(1500)
    expect(settlement.balanceDue).toBe(0)
    expect(settlement.isFullyPaid).toBe(true)
  })

  it('calculates single payer partial settlement when unpaid balance remains', () => {
    const settlement = GroupBillingService.calculateSinglePayerSettlement({
      aggregateTotal: 1000,
      payerAdvance: 200,
      useAdvance: true,
      cashPaid: 300,
      upiPaid: 0,
    })

    expect(settlement.advanceUsed).toBe(200)
    expect(settlement.cashPaid).toBe(300)
    expect(settlement.totalPaid).toBe(500)
    expect(settlement.balanceDue).toBe(500)
    expect(settlement.isFullyPaid).toBe(false)
  })

  it('deterministically distributes payment across child member bills in order', () => {
    const memberBills = [
      { id: 'BILL-001', balance: 300, total: 300, customerName: 'Alice' },
      { id: 'BILL-002', balance: 500, total: 500, customerName: 'Bob' },
      { id: 'BILL-003', balance: 200, total: 200, customerName: 'Charlie' },
    ]

    // Payer pays 650
    const distribution = GroupBillingService.distributePaymentAcrossMemberBills({
      memberBills,
      paymentAmount: 650,
    })

    expect(distribution.totalSettled).toBe(650)
    expect(distribution.remainingPayment).toBe(0)
    expect(distribution.settlements.length).toBe(3)

    // Bill 1: 300 balance => 300 applied, 0 remaining balance, fully paid
    expect(distribution.settlements[0].billId).toBe('BILL-001')
    expect(distribution.settlements[0].appliedAmount).toBe(300)
    expect(distribution.settlements[0].newBalance).toBe(0)
    expect(distribution.settlements[0].isFullyPaid).toBe(true)

    // Bill 2: 500 balance => 350 applied, 150 remaining balance, not fully paid
    expect(distribution.settlements[1].billId).toBe('BILL-002')
    expect(distribution.settlements[1].appliedAmount).toBe(350)
    expect(distribution.settlements[1].newBalance).toBe(150)
    expect(distribution.settlements[1].isFullyPaid).toBe(false)

    // Bill 3: 200 balance => 0 applied, 200 remaining balance, not fully paid
    expect(distribution.settlements[2].billId).toBe('BILL-003')
    expect(distribution.settlements[2].appliedAmount).toBe(0)
    expect(distribution.settlements[2].newBalance).toBe(200)
    expect(distribution.settlements[2].isFullyPaid).toBe(false)
  })

  it('handles group discounts with GST rate calculation accurately', () => {
    const split = GroupBillingService.calculateSplitPurchase({
      totalAmount: 200,
      members: [
        { id: 'm1', customerId: 'cust-1' },
        { id: 'm2', customerId: 'cust-2' },
      ],
      gstPercent: 18,
      discountMode: 'group',
      groupDiscount: { type: 'flat', value: 20 }, // 20 flat discount split (10 each)
    })

    expect(split.aggregateSubtotal).toBe(200)
    expect(split.aggregateDiscount).toBe(20)

    // Member 1: base 100, disc 10, taxable 90, GST 18% of 90 = 16.20, total = 106.20
    expect(split.memberCalculations[0].taxableAmount).toBe(90)
    expect(split.memberCalculations[0].gstAmount).toBe(16.2)
    expect(split.memberCalculations[0].total).toBe(106.2)

    // Member 2: base 100, disc 10, taxable 90, GST 18% of 90 = 16.20, total = 106.20
    expect(split.memberCalculations[1].taxableAmount).toBe(90)
    expect(split.memberCalculations[1].gstAmount).toBe(16.2)
    expect(split.memberCalculations[1].total).toBe(106.2)

    expect(split.aggregateGst).toBe(32.4)
    expect(split.aggregateTotal).toBe(212.4)
  })
})
