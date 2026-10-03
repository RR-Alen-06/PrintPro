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

  it('merges duplicate line items by incrementing quantity and updating total amount', () => {
    const existingItems = [
      {
        id: 'row-1',
        itemId: 'inv-a4',
        name: 'A4 Color Single',
        printType: 'color',
        sides: 'single',
        qty: 2,
        pages: 1,
        unitPrice: 10,
        amount: 20,
      },
      {
        id: 'row-2',
        itemId: 'inv-a4',
        name: 'A4 BW Double',
        printType: 'bw',
        sides: 'double',
        qty: 5,
        pages: 1,
        unitPrice: 5,
        amount: 25,
      },
    ]

    // Adding same A4 Color Single with qty 3
    const duplicateItem = {
      id: 'row-3',
      itemId: 'inv-a4',
      name: 'A4 Color Single',
      printType: 'color',
      sides: 'single',
      qty: 3,
      pages: 1,
      unitPrice: 10,
      amount: 30,
    }

    const { items, merged, updatedItem } = GroupBillingService.mergeLineItem(existingItems, duplicateItem)

    expect(merged).toBe(true)
    expect(items.length).toBe(2) // No new row appended
    expect(updatedItem?.qty).toBe(5) // 2 + 3 = 5
    expect(updatedItem?.amount).toBe(50) // 5 * 10 = 50
    expect(items[0].qty).toBe(5)
    expect(items[0].amount).toBe(50)
  })

  it('appends as a new item when item configuration (printType / sides / rate) differs', () => {
    const existingItems = [
      {
        id: 'row-1',
        itemId: 'inv-a4',
        name: 'A4 Color Single',
        printType: 'color',
        sides: 'single',
        qty: 2,
        pages: 1,
        unitPrice: 10,
        amount: 20,
      },
    ]

    // Different sides: double instead of single
    const differentItem = {
      id: 'row-2',
      itemId: 'inv-a4',
      name: 'A4 Color Single',
      printType: 'color',
      sides: 'double',
      qty: 1,
      pages: 1,
      unitPrice: 18,
      amount: 18,
    }

    const { items, merged } = GroupBillingService.mergeLineItem(existingItems, differentItem)

    expect(merged).toBe(false)
    expect(items.length).toBe(2)
    expect(items[1].sides).toBe('double')
  })

  it('validates unique members across group slots and flags duplicate customer selection', () => {
    const validGroup = [
      { id: 'm1', customerId: 'cust-1' },
      { id: 'm2', customerId: 'cust-2' },
      { id: 'm3', customerId: 'cust-3' },
    ]
    expect(GroupBillingService.validateUniqueMembers(validGroup).isValid).toBe(true)

    const duplicateGroup = [
      { id: 'm1', customerId: 'cust-1' },
      { id: 'm2', customerId: 'cust-1' },
    ]
    const duplicateValidation = GroupBillingService.validateUniqueMembers(duplicateGroup)
    expect(duplicateValidation.isValid).toBe(false)
    expect(duplicateValidation.duplicateCustomerIds).toContain('cust-1')

    const emptyGroup = [
      { id: 'm1', customerId: 'cust-1' },
      { id: 'm2', customerId: '' },
    ]
    const emptyValidation = GroupBillingService.validateUniqueMembers(emptyGroup)
    expect(emptyValidation.isValid).toBe(false)
    expect(emptyValidation.emptyMemberIds).toContain('m2')
  })
})

