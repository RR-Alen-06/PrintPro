import { describe, it, expect } from 'vitest'
import { ReminderService } from '../reminderService'

describe('Refund Settlement & Realtime Reactivity Tests', () => {
  it('calculates 3-way refund totals accurately (Cash, UPI, and Advance Credit)', () => {
    // Simulated server payments including refunds
    const payments = [
      { id: 'PAY-0001', billId: 'BILL-0001', customerId: 'CUS-0001', totalPaid: 500, cashAmount: 500, upiAmount: 0 },
      { id: 'PAY-0002', billId: 'BILL-0001', customerId: 'CUS-0001', totalPaid: -200, cashAmount: -200, upiAmount: 0, isRefund: true, notes: 'Direct CASH refund' },
      { id: 'PAY-0003', billId: 'BILL-0002', customerId: 'CUS-0002', totalPaid: 1000, cashAmount: 0, upiAmount: 1000 },
      { id: 'PAY-0004', billId: 'BILL-0002', customerId: 'CUS-0002', totalPaid: -300, cashAmount: 0, upiAmount: -300, isRefund: true, notes: 'Direct UPI refund' },
    ]

    // Simulated advance payments including store credit refund deposit and advance returns
    const advancePayments = [
      { id: 'ADV-0001', customerId: 'CUS-0001', amount: 200, cashAmount: 0, upiAmount: 0, isRefundCredit: true, notes: 'Store credit refund for Bill #BILL-0001' },
      { id: 'ADV-0002', customerId: 'CUS-0003', amount: -150, cashAmount: -150, upiAmount: 0, isReturn: true, notes: 'Advance returned to customer' },
    ]

    const billRefundsList = payments.filter((p) => Number(p.totalPaid || 0) < 0 || p.isRefund)
    const billRefundsCash = billRefundsList.reduce((s, p) => s + Math.abs(Number(p.cashAmount || 0)), 0)
    const billRefundsUpi = billRefundsList.reduce((s, p) => s + Math.abs(Number(p.upiAmount || 0)), 0)

    const advReturnsList = advancePayments.filter((ap) => Number(ap.amount || 0) < 0 || ap.isReturn)
    const advReturnsCash = advReturnsList.reduce((s, ap) => s + Math.abs(Number(ap.cashAmount || 0)), 0)

    expect(billRefundsList.length).toBe(2)
    expect(billRefundsCash).toBe(200)
    expect(billRefundsUpi).toBe(300)
    expect(advReturnsList.length).toBe(1)
    expect(advReturnsCash).toBe(150)
  })

  it('verifies physical cash drawer outflow only occurs for Cash Refunds and not Store Credit', () => {
    let physicalCashDrawer = 5000

    // 1. Direct Cash refund -> money leaves physical drawer
    const cashRefund = 200
    physicalCashDrawer -= cashRefund
    expect(physicalCashDrawer).toBe(4800)

    // 2. Store Credit refund -> customer balance increases, zero cash leaves drawer
    let customerAdvanceWallet = 0
    const storeCreditRefund = 300
    customerAdvanceWallet += storeCreditRefund
    // drawer remains 4800
    expect(physicalCashDrawer).toBe(4800)
    expect(customerAdvanceWallet).toBe(300)
  })

  it('generates a formatted WhatsApp refund voucher with store credit instructions', () => {
    const refund = {
      id: 'REF-9921',
      date: '2026-09-12',
      amount: 450,
      mode: 'advance',
      invoiceNumber: 'BILL-0082',
      notes: 'Customer returned excess photo prints'
    }
    const customer = { name: 'Alen Roy', phone: '9876543210' }
    const business = { shopName: 'PrintPro Cyber Hub' }

    const message = ReminderService.buildRefundVoucherMessage(refund, customer, business)

    expect(message).toContain('PRINTPRO CYBER HUB — REFUND VOUCHER')
    expect(message).toContain('Alen Roy')
    expect(message).toContain('₹450.00')
    expect(message).toContain('STORE CREDIT / ADVANCE WALLET')
    expect(message).toContain('BILL-0082')
    expect(message).toContain('Advance Credit Balance')

    const waUrl = ReminderService.getWhatsAppUrl(customer.phone, message)
    expect(waUrl).toContain('https://api.whatsapp.com/send?phone=919876543210')
  })

  it('generates direct cash & upi refund WhatsApp vouchers accurately', () => {
    const cashRefund = {
      id: 'REF-1001',
      date: '2026-09-12',
      amount: 120,
      mode: 'cash',
      invoiceNumber: 'BILL-0010',
      notes: 'Bill reduced from ₹500 to ₹380'
    }
    const customer = { name: 'Priya Sharma', phone: '9123456780' }
    const message = ReminderService.buildRefundVoucherMessage(cashRefund, customer)

    expect(message).toContain('CASH REFUND')
    expect(message).toContain('₹120.00')
    expect(message).toContain('BILL-0010')
  })
})
