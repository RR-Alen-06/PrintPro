import { describe, it, expect } from 'vitest'
import { LedgerService } from '../ledgerService'

describe('LedgerService', () => {
  const customerId = 'cust-101'

  it('builds chronological ledger with debits, credits, and exact running balance', () => {
    const bills = [
      { id: 'b1', date: '2026-08-01', total: 100, grand_total: 100, deleted: false },
      { id: 'b2', date: '2026-08-05', total: 200, grand_total: 200, deleted: false },
    ]

    const payments = [
      { id: 'p1', billId: 'b1', date: '2026-08-01', amount: 50 },
      { id: 'p2', date: '2026-08-10', amount: 150 },
    ]

    const result = LedgerService.buildCustomerLedger({
      bills,
      payments,
      advanceReturns: [],
    })

    expect(result.entries.length).toBe(4)
    expect(result.totalBilled).toBe(300)
    expect(result.totalPaid).toBe(200)
    expect(result.runningBalance).toBe(100)

    // First entry should be Bill b1 (bill_amount: 100, running balance: 100)
    expect(result.entries[0].bill_amount).toBe(100)
    expect(result.entries[0].running_balance).toBe(100)
    // Second entry Payment p1 (paid_amount: 50, running balance: 50)
    expect(result.entries[1].paid_amount).toBe(50)
    expect(result.entries[1].running_balance).toBe(50)
  })

  it('computes customer summary correctly', () => {
    const customer = {
      id: customerId,
      user_id: 'user-1',
      customer_code: 'CUS-001',
      name: 'Test Customer',
      type: 'regular' as const,
      advance_balance: 50,
      credit_limit: 1000,
    }

    const bills = [
      { id: 'b1', customerId, date: '2026-08-01', grand_total: 500, total: 500, deleted: false },
    ]
    const payments = [
      { id: 'p1', customerId, billId: 'b1', date: '2026-08-01', amount: 300 },
    ]

    const summary = LedgerService.computeCustomerSummary({
      customer,
      bills,
      payments,
    })

    expect(summary.total_billed).toBe(500)
    expect(summary.total_paid).toBe(300)
    expect(summary.balance_due).toBe(150) // 500 - 300 - 50 = 150
    expect(summary.advance_balance).toBe(50)
    expect(summary.credit_limit).toBe(1000)
  })
})
