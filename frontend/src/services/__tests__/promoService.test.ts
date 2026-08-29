import { describe, it, expect } from 'vitest'
import { PromoService, PromoCode } from '../promoService'

describe('PromoService', () => {
  const promoList: PromoCode[] = [
    { code: 'SAVE10', type: 'percent', value: 10, minAmount: 100, enabled: true },
    { code: 'FLAT50', type: 'flat', value: 50, minAmount: 300, enabled: true },
    { code: 'CAP20', type: 'percent', value: 20, maxDiscount: 100, enabled: true },
    { code: 'EXPIRED', type: 'flat', value: 100, endDate: '2025-01-01', enabled: true },
    { code: 'FUTURE', type: 'flat', value: 100, startDate: '2099-01-01', enabled: true },
    { code: 'DISABLED', type: 'flat', value: 100, enabled: false },
  ]

  it('applies valid percentage promo code with case-insensitivity and whitespace trimming', () => {
    const result = PromoService.validateAndApplyPromo('  save10  ', 500, promoList)
    expect(result.isValid).toBe(true)
    expect(result.discountAmount).toBe(50) // 10% of 500 = 50
  })

  it('applies flat rupee discount capped at order subtotal', () => {
    const result = PromoService.validateAndApplyPromo('FLAT50', 400, promoList)
    expect(result.isValid).toBe(true)
    expect(result.discountAmount).toBe(50)
  })

  it('enforces maximum discount ceiling (cap)', () => {
    // 20% of 1000 = 200, but capped at 100
    const result = PromoService.validateAndApplyPromo('CAP20', 1000, promoList)
    expect(result.isValid).toBe(true)
    expect(result.discountAmount).toBe(100)
  })

  it('rejects order below minimum order threshold with descriptive error', () => {
    // SAVE10 requires min ₹100
    const result = PromoService.validateAndApplyPromo('SAVE10', 80, promoList)
    expect(result.isValid).toBe(false)
    expect(result.discountAmount).toBe(0)
    expect(result.errorMessage).toContain('requires a minimum order of ₹100.00')
  })

  it('rejects expired, future, disabled, or non-existent coupon codes', () => {
    const expired = PromoService.validateAndApplyPromo('EXPIRED', 500, promoList, new Date('2026-08-29'))
    expect(expired.isValid).toBe(false)
    expect(expired.errorMessage).toContain('expired')

    const future = PromoService.validateAndApplyPromo('FUTURE', 500, promoList, new Date('2026-08-29'))
    expect(future.isValid).toBe(false)
    expect(future.errorMessage).toContain('not active yet')

    const disabled = PromoService.validateAndApplyPromo('DISABLED', 500, promoList)
    expect(disabled.isValid).toBe(false)
    expect(disabled.errorMessage).toContain('inactive')

    const notFound = PromoService.validateAndApplyPromo('UNKNOWN', 500, promoList)
    expect(notFound.isValid).toBe(false)
    expect(notFound.errorMessage).toContain('Invalid coupon code')
  })
})
