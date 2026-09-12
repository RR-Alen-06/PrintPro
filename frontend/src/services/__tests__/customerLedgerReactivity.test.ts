import { describe, it, expect } from 'vitest'
import { LedgerService } from '../ledgerService'
import { ReminderService } from '../reminderService'
import { CreditService } from '../creditService'

describe('Customer Ledger Reactivity & Unified FIFO Balances', () => {
  it('builds accurate chronological ledger with running balance', () => {
    const mockBills = [
      { id: 'b1', date: '2026-09-01', total: 1000, amount_paid: 400, deleted: false },
      { id: 'b2', date: '2026-09-05', total: 600, amount_paid: 600, deleted: false }
    ]

    const mockPayments = [
      { id: 'p1', date: '2026-09-02', amount: 400, bill_id: 'b1', payment_method: 'Cash' },
      { id: 'p2', date: '2026-09-05', amount: 600, bill_id: 'b2', payment_method: 'UPI' }
    ]

    const ledger = LedgerService.buildCustomerLedger({
      bills: mockBills,
      payments: mockPayments,
      advanceReturns: []
    })

    expect(ledger.totalBilled).toBe(1600)
    expect(ledger.totalPaid).toBe(1000)
    expect(ledger.runningBalance).toBe(600)
    expect(ledger.entries.length).toBeGreaterThan(0)
  })

  it('allocates bulk customer payment via FIFO across multiple unpaid bills', () => {
    const unpaidBills = [
      { id: 'b1', balance: 500, amountPaid: 0, total: 500 },
      { id: 'b2', balance: 700, amountPaid: 0, total: 700 },
      { id: 'b3', balance: 1000, amountPaid: 0, total: 1000 }
    ]

    // Customer pays ₹1000 bulk payment
    const bulkPaymentAmount = 1000
    const allocation = CreditService.allocatePaymentFIFO(bulkPaymentAmount, unpaidBills)

    expect(allocation.allocations.length).toBe(3)
    // b1 should be paid in full (500)
    expect(allocation.allocations[0].billId).toBe('b1')
    expect(allocation.allocations[0].allocatedAmount).toBe(500)
    expect(allocation.allocations[0].remainingBalance).toBe(0)
    expect(allocation.allocations[0].newStatus).toBe('paid')

    // b2 should be partially paid with remaining 500
    expect(allocation.allocations[1].billId).toBe('b2')
    expect(allocation.allocations[1].allocatedAmount).toBe(500)
    expect(allocation.allocations[1].remainingBalance).toBe(200)
    expect(allocation.allocations[1].newStatus).toBe('partial')

    expect(allocation.excessToAdvance).toBe(0)
  })

  it('generates WhatsApp ledger reminder with dynamic UPI link', () => {
    const mockCustomer = { name: 'Pooja Hegde', phone: '9876543210' }
    const closingBalance = 1250
    const business = {
      shopName: 'PrintPro Studio',
      upiId: 'printpro@okaxis',
      phone: '9988776655'
    }

    const message = ReminderService.buildLedgerReminderMessage(mockCustomer, closingBalance, business)

    expect(message).toContain('PrintPro Studio')
    expect(message).toContain('Pooja Hegde')
    expect(message).toContain('₹1250.00')
    expect(message).toContain('upi://pay?pa=printpro%40okaxis')
  })
})
