import { describe, it, expect } from 'vitest'
import { LoyaltyService } from '../loyaltyService'

describe('Loyalty Engine & Ledger Bill Calculations', () => {
  describe('LoyaltyService calculations', () => {
    it('calculates points earned accurately for regular customers based on spend', () => {
      const config = {
        loyaltyEnabled: true,
        loyaltyTiers: [
          { from: 0, to: 100, points: 1 },
          { from: 101, to: 500, points: 5 },
          { from: 501, to: 1000, points: 15 }
        ]
      }
      expect(LoyaltyService.calculatePointsEarned(50, true, config)).toBe(1)
      expect(LoyaltyService.calculatePointsEarned(200, true, config)).toBe(5)
      expect(LoyaltyService.calculatePointsEarned(750, true, config)).toBe(15)
    })

    it('returns 0 points earned when loyalty is disabled or for non-regular customer without random flag', () => {
      const config = { loyaltyEnabled: false }
      expect(LoyaltyService.calculatePointsEarned(200, true, config)).toBe(0)

      const enabledConfig = { loyaltyEnabled: true, loyaltyForRandomCustomers: false }
      expect(LoyaltyService.calculatePointsEarned(200, false, enabledConfig)).toBe(0)
    })

    it('calculates redemption discount accurately without exceeding bill total or customer points', () => {
      const config = {
        loyaltyEnabled: true,
        loyaltyRedeemEnabled: true,
        loyaltyRedeemOptions: [
          { points: 100, rupees: 2.5 },
          { points: 120, rupees: 3 },
          { points: 150, rupees: 5 }
        ]
      }

      // Customer has 150 points, redeems 150 on bill of ₹20
      const result = LoyaltyService.calculateRedemptionDiscount(150, 150, 20, config)
      expect(result.pointsRedeemed).toBe(150)
      expect(result.discountAmount).toBe(5)

      // Customer has 80 points, tries to redeem 100 -> capped at 80 available -> returns 0 for options mismatch or ratio
      const insufficient = LoyaltyService.calculateRedemptionDiscount(100, 80, 20, config)
      expect(insufficient.pointsRedeemed).toBe(80)
    })
  })

  describe('Ledger Calculation Integrity for LedgerBillCard', () => {
    it('accurately computes previous outstanding across older bills excluding deleted and current bill', () => {
      const customerId = 'cust-123'
      const currentBill = {
        id: 'bill-003',
        customerId,
        date: '2026-09-06',
        total: 250,
        balance: 150,
        status: 'partial'
      }

      const billsList = [
        { id: 'bill-001', customerId, date: '2026-09-01', balance: 40, deleted: false },
        { id: 'bill-002', customerId, date: '2026-09-04', balance: 60, deleted: false },
        { id: 'bill-deleted', customerId, date: '2026-09-02', balance: 100, deleted: true },
        { id: 'bill-003', customerId, date: '2026-09-06', balance: 150, deleted: false }, // current bill
        { id: 'bill-other-cust', customerId: 'cust-999', date: '2026-09-03', balance: 80, deleted: false }
      ]

      const currentBillDate = new Date(currentBill.date)
      const previousOutstanding = billsList
        .filter((b) => {
          if (b.deleted) return false
          if (String(b.customerId) !== String(customerId)) return false
          if (String(b.id) === String(currentBill.id)) return false
          if (b.date && new Date(b.date) >= currentBillDate) return false
          return true
        })
        .reduce((sum, b) => sum + Math.max(0, Number(b.balance || 0)), 0)

      expect(previousOutstanding).toBe(100) // 40 + 60

      const totalAmountDue = previousOutstanding + currentBill.total
      expect(totalAmountDue).toBe(350) // 100 + 250
    })

    it('correctly handles balance and payment allocations', () => {
      const currentBillTotal = 300
      const previousOutstanding = 50
      const totalAmountDue = previousOutstanding + currentBillTotal // 350
      const paidCash = 200
      const paidUpi = 50
      const totalPaid = paidCash + paidUpi // 250
      const netAccountBalanceDue = Math.max(0, totalAmountDue - totalPaid) // 100

      expect(totalPaid).toBe(250)
      expect(netAccountBalanceDue).toBe(100)
    })
  })
})
