import { describe, it, expect } from 'vitest'
import { LedgerService } from '../ledgerService'
import { CreditService } from '../creditService'

describe('Customer Selection & Ledger Resilience Audit', () => {
  it('buildCustomerLedger handles numeric bill and payment IDs without TypeError .slice', () => {
    const bills = [
      { id: 101, bill_number: 'INV-101', grand_total: 500, paid_total: 200, date: '2026-09-13' },
      { id: 102, invoiceNumber: 'INV-102', total: 300, amount_paid: 300, date: '2026-09-13' }
    ]
    const payments = [
      { id: 201, payment_number: 'PAY-201', totalPaid: 200, billId: 101, date: '2026-09-13' },
      { id: 202, amount: 300, bill_id: 102, date: '2026-09-13' }
    ]
    const advanceReturns = [
      { id: 301, amount: 50, date: '2026-09-13' }
    ]

    expect(() => {
      const result = LedgerService.buildCustomerLedger({
        bills: bills as any,
        payments: payments as any,
        advanceReturns: advanceReturns as any
      })
      expect(result.entries.length).toBe(5)
      expect(result.totalBilled).toBe(850) // 500 + 300 + 50
      expect(result.totalPaid).toBe(500) // 200 + 300
      expect(result.runningBalance).toBe(350)
    }).not.toThrow()
  })

  it('computeCustomerSummary computes correct balance with string/numeric IDs and payment amount variants', () => {
    const customer = {
      id: 1,
      name: 'Acme Corp',
      credit_balance: 100
    }
    const bills = [
      { customerId: '1', total: 1000 },
      { customer_id: 1, grand_total: 500 }
    ]
    const payments = [
      // Uses totalPaid
      { customerId: '1', totalPaid: 400 },
      // Uses amount
      { customer_id: 1, amount: 200 },
      // Uses total_paid
      { customerId: '1', total_paid: 100 }
    ]

    const summary = LedgerService.computeCustomerSummary({
      customer: customer as any,
      bills: bills as any,
      payments: payments as any
    })

    expect(summary.total_billed).toBe(1500)
    expect(summary.total_paid).toBe(700)
    expect(summary.advance_balance).toBe(100)
    // balanceDue = 1500 - 700 - 100 = 700
    expect(summary.balance_due).toBe(700)
  })

  it('calculateLedger matches entries across number/string customer IDs', () => {
    const bills = [
      { id: 'b1', customerId: 42, total: 600, date: '2026-09-13' }
    ]
    const payments = [
      { id: 'p1', customer_id: '42', totalPaid: 200, date: '2026-09-13' }
    ]
    const advances = [
      { id: 'a1', customerId: 42, amount: 100, date: '2026-09-13' }
    ]

    const res = LedgerService.calculateLedger({
      customerId: '42',
      bills,
      payments,
      advancePayments: advances
    })

    expect(res.entries.length).toBe(3)
    expect(res.totalBilled).toBe(600)
    expect(res.totalPaid).toBe(300) // 200 payment + 100 advance
    expect(res.closingBalance).toBe(300)
  })

  it('CreditService formats customer codes and FIFO allocations without crashing on numeric IDs', () => {
    const code = CreditService.formatCustomerCode({ id: 9999 as any })
    expect(code).toBe('CUS-9999')

    const allocation = CreditService.allocatePaymentFIFO(500, [
      { id: 10 as any, total: 300, balance: 300 },
      { id: 11 as any, total: 400, balance: 400 }
    ])

    expect(allocation.totalAllocated).toBe(500)
    expect(allocation.excessToAdvance).toBe(0)
    expect(allocation.allocations[0].invoiceNumber).toBe('INV-10')
  })
})
