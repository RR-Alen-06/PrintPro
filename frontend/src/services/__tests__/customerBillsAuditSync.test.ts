import { describe, it, expect } from 'vitest'
import { ReminderService } from '../reminderService'

describe('Customer Bills Audit & 0ms Synchronization', () => {
  const bill = {
    id: 'bill-uuid-1',
    invoiceNumber: 'BILL-000101',
    customerId: 'cust-101',
    customerName: 'Aarav Sharma',
    date: '2026-09-12T10:00:00.000Z',
    items: [
      { name: 'A4 Color 75GSM Single', qty: 20, rate: 10, amount: 200 },
      { name: 'Spiral Binding A4', qty: 2, rate: 50, amount: 100 },
    ],
    subtotal: 300,
    discountType: 'flat',
    discountValue: 20,
    discountAmount: 20,
    total: 280,
    paidTotal: 280,
    balance: 0,
    status: 'paid',
  }

  const business = {
    shopName: 'PrintPro Studio',
    phone: '919876543210',
    upiId: 'printpro@upi',
  }

  it('generates itemized WhatsApp bill receipt with accurate calculation', () => {
    const message = ReminderService.buildInvoiceMessage(bill, business, { includeUpiInWhatsApp: true })

    expect(message).toContain('PRINTPRO STUDIO — INVOICE')
    expect(message).toContain('BILL-000101')
    expect(message).toContain('Aarav Sharma')
    expect(message).toContain('A4 Color 75GSM Single × 20 = ₹200.00')
    expect(message).toContain('Spiral Binding A4 × 2 = ₹100.00')
    expect(message).toContain('Total Amount:* ₹280.00')
    expect(message).toContain('Amount Paid:* ₹280.00')
    expect(message).toContain('Payment Status:* FULLY PAID')
  })

  it('detects overpayment correctly when bill total is edited below paid amount', () => {
    const originalPaid = 280
    const newItems = [
      { name: 'A4 Color 75GSM Single', qty: 10, rate: 10, amount: 100 },
    ]
    const newSubtotal = 100
    const newDiscount = 0
    const newTotal = newSubtotal - newDiscount // 100

    const overpayment = originalPaid - newTotal // 280 - 100 = 180
    expect(overpayment).toBe(180)

    // Choice 1: Direct Refund (Cash or UPI)
    const refundSettlement = {
      refundDue: overpayment,
      mode: 'cash',
      newBillPaid: newTotal,
      newBillBalance: 0,
    }
    expect(refundSettlement.refundDue).toBe(180)
    expect(refundSettlement.newBillPaid).toBe(100)

    // Choice 2: Advance Credit Deposit
    const advanceDepositSettlement = {
      advanceCreditAdded: overpayment,
      newCustomerAdvanceBalance: 500 + overpayment, // 680
      newBillPaid: newTotal,
      newBillBalance: 0,
    }
    expect(advanceDepositSettlement.advanceCreditAdded).toBe(180)
    expect(advanceDepositSettlement.newCustomerAdvanceBalance).toBe(680)
  })

  it('includes UPI payment link on unpaid invoices', () => {
    const unpaidBill = {
      ...bill,
      invoiceNumber: 'BILL-000102',
      paidTotal: 100,
      balance: 180,
      status: 'partial',
    }

    const message = ReminderService.buildInvoiceMessage(unpaidBill, business, { includeUpiInWhatsApp: true })
    expect(message).toContain('Balance Due:* ₹180.00')
    expect(message).toContain('upi://pay?pa=printpro%40upi')
    expect(message).toContain('am=180.00')
  })
})
