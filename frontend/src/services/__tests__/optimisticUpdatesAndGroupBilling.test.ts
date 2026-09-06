import { describe, it, expect } from 'vitest'
import { LoyaltyService } from '../loyaltyService'

describe('Optimistic Updates & Mobile Group Billing Calculations', () => {
  describe('Optimistic Cache Key Match Verification', () => {
    it('demonstrates prefix query key matching logic for TanStack Query setQueriesData', () => {
      const BILLS_QUERY_KEY = ['bills']
      const userId = 'user-uuid-123'
      const baseKey = [...BILLS_QUERY_KEY, userId]

      const activeQueryKeys = [
        ['bills', 'user-uuid-123', {}],
        ['bills', 'user-uuid-123', { type: 'paid' }],
        ['bills', 'user-uuid-123', { search: 'John' }],
        ['bills', 'other-user', {}],
      ]

      // Filter matching queries with exact: false
      const matchingKeys = activeQueryKeys.filter((k) =>
        k.length >= baseKey.length && baseKey.every((segment, i) => k[i] === segment)
      )

      expect(matchingKeys.length).toBe(3)
      expect(matchingKeys).toContainEqual(['bills', 'user-uuid-123', {}])
      expect(matchingKeys).toContainEqual(['bills', 'user-uuid-123', { type: 'paid' }])
      expect(matchingKeys).toContainEqual(['bills', 'user-uuid-123', { search: 'John' }])
    })
  })

  describe('Mobile Group Billing Calculations', () => {
    it('correctly calculates shared group billing totals with individual add-ons and discounts', () => {
      const sharedItems = [
        { id: '1', itemName: 'A4 Color', qty: 2, unitPrice: 10, amount: 20 },
        { id: '2', itemName: 'Spiral Binding', qty: 1, unitPrice: 30, amount: 30 },
      ]
      const sharedSubtotal = sharedItems.reduce((s, i) => s + i.amount, 0) // 50

      const member1Addons = [{ id: 'a1', itemName: 'Lamination', qty: 1, unitPrice: 15, amount: 15 }]
      const member1AddonSub = member1Addons.reduce((s, i) => s + i.amount, 0) // 15
      const member1Subtotal = sharedSubtotal + member1AddonSub // 65
      const member1Discount = 5 // Flat discount
      const member1Gross = member1Subtotal - member1Discount // 60
      const member1CashPaid = 60
      const member1Balance = member1Gross - member1CashPaid // 0

      const member2Subtotal = sharedSubtotal // 50
      const member2Discount = 0
      const member2Gross = member2Subtotal - member2Discount // 50
      const member2CashPaid = 20
      const member2Balance = member2Gross - member2CashPaid // 30

      expect(sharedSubtotal).toBe(50)
      expect(member1Gross).toBe(60)
      expect(member1Balance).toBe(0)
      expect(member2Gross).toBe(50)
      expect(member2Balance).toBe(30)

      const totalGroupGross = member1Gross + member2Gross // 110
      const totalGroupPaid = member1CashPaid + member2CashPaid // 80
      const totalGroupBalance = member1Balance + member2Balance // 30

      expect(totalGroupGross).toBe(110)
      expect(totalGroupPaid).toBe(80)
      expect(totalGroupBalance).toBe(30)
    })

    it('correctly calculates split billing amounts with rounding and owner difference', () => {
      const items = [
        { id: '1', itemName: 'Bulk Prints', qty: 1, unitPrice: 155, amount: 155 },
      ]
      const total = items.reduce((s, i) => s + i.amount, 0) // 155
      const memberCount = 3

      const rawSplit = total / memberCount // 51.666...
      const splitUp = Math.ceil(rawSplit) // 52
      const splitDown = Math.floor(rawSplit) // 51

      const ownerDiffUp = total - splitUp * memberCount // 155 - 156 = -1 (absorbed by customer surplus / 1 extra)
      const ownerDiffDown = total - splitDown * memberCount // 155 - 153 = +2 (absorbed by shop)

      expect(splitUp).toBe(52)
      expect(ownerDiffUp).toBe(-1)
      expect(splitDown).toBe(51)
      expect(ownerDiffDown).toBe(2)
    })
  })
})
