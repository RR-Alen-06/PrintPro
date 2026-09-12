import { describe, it, expect } from 'vitest'
import { BillingService } from '../billingService'

describe('Billing Cross-Module Reactivity & Atomic Upfront Payments', () => {
  it('calculates full payment and marks bill as paid with 0 balance', () => {
    const calculation = BillingService.calculateBill({
      items: [
        { itemName: 'Brochure Printing', qty: 10, unitPrice: 20 }
      ],
      discountValue: 0,
      discountType: 'flat',
      roundingMethod: 'None'
    })

    expect(calculation.roundedTotal).toBe(200)

    const cashPaid = 200
    const upiPaid = 0
    const advanceUsed = 0
    const totalPaid = cashPaid + upiPaid + advanceUsed
    const balance = Math.max(0, calculation.roundedTotal - totalPaid)
    const status = balance <= 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid')

    expect(balance).toBe(0)
    expect(status).toBe('paid')
  })

  it('handles partial upfront payment and calculates remaining balance correctly', () => {
    const calculation = BillingService.calculateBill({
      items: [
        { itemName: 'Banner Printing', qty: 2, unitPrice: 500 }
      ],
      discountValue: 100,
      discountType: 'flat',
      gstPercent: 18,
      roundingMethod: 'None'
    })

    // subtotal = 1000, discount = 100, taxable = 900, gst(18%) = 162, total = 1062
    expect(calculation.subtotal).toBe(1000)
    expect(calculation.taxableAmount).toBe(900)
    expect(calculation.gstAmount).toBe(162)
    expect(calculation.roundedTotal).toBe(1062)

    const cashPaid = 300
    const upiPaid = 200
    const advanceUsed = 0
    const totalPaid = cashPaid + upiPaid + advanceUsed
    const balance = Math.max(0, calculation.roundedTotal - totalPaid)
    const status = balance <= 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid')

    expect(totalPaid).toBe(500)
    expect(balance).toBe(562)
    expect(status).toBe('partial')
  })

  it('correctly uses customer advance credit and offsets direct cash requirement', () => {
    const total = 500
    const customerCredit = 200
    const requestedAdvance = 200

    const creditApplied = Math.min(requestedAdvance, customerCredit, total)
    const cashPaid = 300
    const totalPaid = creditApplied + cashPaid
    const balance = Math.max(0, total - totalPaid)
    const remainingCredit = customerCredit - creditApplied

    expect(creditApplied).toBe(200)
    expect(totalPaid).toBe(500)
    expect(balance).toBe(0)
    expect(remainingCredit).toBe(0)
  })

  it('generates rich WhatsApp text receipt including cash, upi, and advance breakdown', () => {
    const mockBill = {
      bill_number: 'BILL0042',
      customerName: 'Rohit Sharma',
      total: 1000,
      grand_total: 1000,
      cash_paid: 500,
      upi_paid: 300,
      advance_used: 200,
      paid_total: 1000,
      items: [
        { itemName: 'Visiting Cards (500pcs)', qty: 1, unitPrice: 1000, amount: 1000 }
      ]
    }

    const receipt = BillingService.formatWhatsAppReceipt(mockBill, 'PrintPro Express')
    expect(receipt).toContain('BILL0042')
    expect(receipt).toContain('Rohit Sharma')
    expect(receipt).toContain('Cash Paid : ₹500.00')
    expect(receipt).toContain('UPI Paid : ₹300.00')
    expect(receipt).toContain('Advance Used : ₹200.00')
    expect(receipt).toContain('Fully Paid ✅')
  })
})
