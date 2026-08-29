import { describe, it, expect } from 'vitest'
import { BillingService } from '../billingService'

describe('BillingService', () => {
  it('correctly calculates subtotal, line amounts, and GST for items', () => {
    const items = [
      { itemName: 'A4 Color Print', printType: 'color', sides: 'single', qty: 10, unitPrice: 5, gstRate: 18 },
      { itemName: 'A4 B&W Print', printType: 'bw', sides: 'single', qty: 20, unitPrice: 2, gstRate: 0 },
    ]

    const result = BillingService.calculateBill({
      items,
      discountType: 'flat',
      discountValue: 10,
      roundingMethod: 'None',
    })

    // subtotal = (10*5) + (20*2) = 50 + 40 = 90
    expect(result.subtotal).toBe(90)
    // discount = 10
    expect(result.totalDiscount).toBe(10)
    expect(result.gstAmount).toBeGreaterThan(0)
    expect(result.roundedTotal).toBeGreaterThan(80)
  })

  it('handles percentage discounts accurately', () => {
    const items = [
      { itemName: 'Poster Print', printType: 'color', sides: 'single', qty: 1, unitPrice: 100, gstRate: 0 },
    ]

    const result = BillingService.calculateBill({
      items,
      discountType: 'percent',
      discountValue: 10,
      roundingMethod: 'None',
    })

    expect(result.subtotal).toBe(100)
    expect(result.totalDiscount).toBe(10)
    expect(result.roundedTotal).toBe(90)
  })

  it('generates WhatsApp formatted message text with invoice and items', () => {
    const bill = {
      id: 'BILL-0001',
      bill_number: 'BILL-0001',
      created_at: '2026-08-29T10:00:00Z',
      customer_name: 'Rahul Sharma',
      items: [
        { itemName: 'Xerox Copy', qty: 5, unitPrice: 2, lineTotal: 10 },
      ],
      total: 10,
      grand_total: 10,
      cash_paid: 10,
      upi_paid: 0,
      paid_total: 10,
    }

    const message = BillingService.formatWhatsAppReceipt(bill, 'PrintPro Studio')

    expect(message).toContain('PRINTPRO STUDIO')
    expect(message).toContain('BILL-0001')
    expect(message).toContain('Rahul Sharma')
    expect(message).toContain('Xerox Copy')
    expect(message).toContain('10.00')
  })
})
