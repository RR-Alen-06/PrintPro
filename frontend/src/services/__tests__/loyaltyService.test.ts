import { describe, it, expect } from 'vitest'
import { LoyaltyService } from '../loyaltyService'

describe('LoyaltyService', () => {
  it('calculates points earned based on net spend tiers', () => {
    const config = {
      loyaltyEnabled: true,
      loyaltyTiers: [
        { from: 1, to: 100, points: 2 },
        { from: 101, to: 500, points: 10 },
        { from: 501, to: 1000, points: 25 },
      ],
    }

    expect(LoyaltyService.calculatePointsEarned(50, true, config)).toBe(2)
    expect(LoyaltyService.calculatePointsEarned(250, true, config)).toBe(10)
    expect(LoyaltyService.calculatePointsEarned(800, true, config)).toBe(25)
    // Higher than max tier should fallback to max tier points
    expect(LoyaltyService.calculatePointsEarned(2000, true, config)).toBe(25)
  })

  it('restricts points accrual for random/walk-in customers when loyaltyForRandomCustomers is false', () => {
    const config = {
      loyaltyEnabled: true,
      loyaltyForRandomCustomers: false,
    }

    expect(LoyaltyService.calculatePointsEarned(500, false, config)).toBe(0)
    expect(LoyaltyService.calculatePointsEarned(500, true, config)).toBe(5) // Default 1 pt per 100
  })

  it('converts redeemed points to rupee discount using predefined redemption options', () => {
    const config = {
      loyaltyEnabled: true,
      loyaltyRedeemEnabled: true,
      loyaltyRedeemOptions: [
        { points: 100, rupees: 5 },
        { points: 200, rupees: 12 },
      ],
    }

    const result = LoyaltyService.calculateRedemptionDiscount(100, 150, 500, config)
    expect(result.pointsRedeemed).toBe(100)
    expect(result.discountAmount).toBe(5)
  })

  it('converts redeemed points using ratio and prevents discount exceeding bill total', () => {
    const config = {
      loyaltyEnabled: true,
      loyaltyRedeemEnabled: true,
      loyaltyRedeemRatioPoints: 100,
      loyaltyRedeemRatioRupees: 10, // ₹10 per 100 points
    }

    // Bill total is ₹15, but 300 points would yield ₹30 -> should be capped at ₹15
    const result = LoyaltyService.calculateRedemptionDiscount(300, 500, 15, config)
    expect(result.pointsRedeemed).toBe(300)
    expect(result.discountAmount).toBe(15)
  })

  it('handles negative, non-integer, and disabled loyalty edge-cases cleanly', () => {
    const disabledConfig = { loyaltyEnabled: false }
    expect(LoyaltyService.calculatePointsEarned(500, true, disabledConfig)).toBe(0)
    expect(LoyaltyService.calculateRedemptionDiscount(100, 100, 500, disabledConfig).discountAmount).toBe(0)

    const negativePoints = LoyaltyService.calculateRedemptionDiscount(-50, 100, 500, {})
    expect(negativePoints.pointsRedeemed).toBe(0)
    expect(negativePoints.discountAmount).toBe(0)
  })
})
