import { describe, it, expect } from 'vitest'
import { GstService } from '../gstService'

describe('GstService', () => {
  it('calculates Intra-state GST (50% CGST + 50% SGST) correctly', () => {
    const result = GstService.calculateTax(1000, 18, false)
    expect(result.taxableAmount).toBe(1000)
    expect(result.gstRate).toBe(18)
    expect(result.cgstRate).toBe(9)
    expect(result.sgstRate).toBe(9)
    expect(result.cgstAmount).toBe(90)
    expect(result.sgstAmount).toBe(90)
    expect(result.igstAmount).toBe(0)
    expect(result.totalGstAmount).toBe(180)
    expect(result.grossAmount).toBe(1180)
  })

  it('calculates Inter-state GST (100% IGST) correctly', () => {
    const result = GstService.calculateTax(500, 12, true)
    expect(result.taxableAmount).toBe(500)
    expect(result.gstRate).toBe(12)
    expect(result.cgstAmount).toBe(0)
    expect(result.sgstAmount).toBe(0)
    expect(result.igstAmount).toBe(60)
    expect(result.totalGstAmount).toBe(60)
    expect(result.grossAmount).toBe(560)
  })

  it('handles edge-cases: 0 rate, negative amounts, division-by-zero, and NaN gracefully', () => {
    const zeroRate = GstService.calculateTax(500, 0, false)
    expect(zeroRate.totalGstAmount).toBe(0)
    expect(zeroRate.grossAmount).toBe(500)

    const negativeAmount = GstService.calculateTax(-100, 18, false)
    expect(negativeAmount.taxableAmount).toBe(0)
    expect(negativeAmount.totalGstAmount).toBe(0)

    const nanRate = GstService.calculateTax(500, NaN as any, false)
    expect(nanRate.totalGstAmount).toBe(0)
    expect(nanRate.grossAmount).toBe(500)
  })

  it('aggregates multi-line GST breakdowns with exact 2-decimal precision', () => {
    const lines = [
      { amount: 100, gstRate: 5 },
      { amount: 200, gstRate: 18 },
      { amount: 300, gstRate: 12 },
    ]

    const result = GstService.calculateAggregateTax(lines)
    expect(result.totalTaxable).toBe(600)
    // 5% of 100 = 5, 18% of 200 = 36, 12% of 300 = 36 -> total GST = 77
    expect(result.totalGst).toBe(77)
    expect(result.grandTotal).toBe(677)
    expect(result.lineBreakdowns.length).toBe(3)
  })
})
