import { describe, it, expect } from 'vitest'
import { LedgerService } from '../ledgerService'
import { ReminderService } from '../reminderService'

describe('Customer Ledger Full Audit & 0ms Reactivity', () => {
  const customer = {
    id: 'cust-101',
    customerCode: 'CUS-000101',
    name: 'Apollo Design Studio',
    phone: '9876543210',
    type: 'regular',
    creditBalance: 1500,
  }

  const bills = [
    {
      id: 'b-1',
      invoiceNumber: 'BILL-0001',
      customerId: 'cust-101',
      date: '2026-09-01T10:00:00.000Z',
      total: 1000,
      balance: 1000,
      status: 'unpaid',
      items: [{ name: 'A4 Print', qty: 100, rate: 10, total: 1000 }],
    },
    {
      id: 'b-2',
      invoiceNumber: 'BILL-0002',
      customerId: 'cust-101',
      date: '2026-09-05T10:00:00.000Z',
      total: 2500,
      balance: 2500,
      status: 'unpaid',
      items: [{ name: 'Flex Banner', qty: 1, rate: 2500, total: 2500 }],
    },
  ]

  const payments = [
    {
      id: 'p-1',
      paymentCode: 'PAY-0001',
      customerId: 'cust-101',
      billId: 'b-1',
      date: '2026-09-02T10:00:00.000Z',
      totalPaid: 1000,
      cashAmount: 1000,
      upiAmount: 0,
      paymentType: 'full',
    },
  ]

  const advances = [
    {
      id: 'adv-1',
      customerId: 'cust-101',
      date: '2026-09-03T10:00:00.000Z',
      amount: 500,
      paymentMode: 'upi',
      notes: 'Initial Project Deposit',
    },
  ]

  it('correctly calculates chronologically ordered running balance ledger', () => {
    const result = LedgerService.calculateLedger({
      customerId: 'cust-101',
      bills,
      payments,
      advancePayments: advances,
      period: 'all',
      settings: {},
    })

    expect(result.entries.length).toBe(4)
    // 1. BILL-0001: Debit +1000 => Bal: 1000
    expect(result.entries[0].type).toBe('bill')
    expect(result.entries[0].debit).toBe(1000)
    expect(result.entries[0].balance).toBe(1000)

    // 2. Payment PAY-0001: Credit -1000 => Bal: 0
    expect(result.entries[1].type).toBe('payment')
    expect(result.entries[1].credit).toBe(1000)
    expect(result.entries[1].balance).toBe(0)

    // 3. Advance ADV-1: Credit -500 => Bal: -500 (Customer has 500 advance credit)
    expect(result.entries[2].type).toBe('advance')
    expect(result.entries[2].advanceIn).toBe(500)
    expect(result.entries[2].balance).toBe(-500)

    // 4. BILL-0002: Debit +2500 => Bal: 2000 (2500 - 500 advance = 2000 net closing balance)
    expect(result.entries[3].type).toBe('bill')
    expect(result.entries[3].debit).toBe(2500)
    expect(result.entries[3].balance).toBe(2000)

    expect(result.closingBalance).toBe(2000)
  })

  it('generates a formatted WhatsApp Customer Statement with net balance and period details', () => {
    const message = ReminderService.buildCustomerStatementMessage(
      customer,
      {
        totalDebits: 3500,
        totalCredits: 1000,
        finalBalance: 2000,
        totalAdvanceIn: 500,
        totalAdvanceUsed: 0,
        outstanding: 2500,
        period: 'monthly',
      },
      {
        shopName: 'PrintPro Studio',
        phone: '919876543210',
        upiId: 'printpro@upi',
      },
      {
        includeUpiInWhatsApp: true,
      }
    )

    expect(message).toContain('ACCOUNT STATEMENT')
    expect(message).toContain('Apollo Design Studio')
    expect(message).toContain('Total Invoiced (Debits):* ₹3500.00')
    expect(message).toContain('Total Paid (Credits):* ₹1000.00')
    expect(message).toContain('Advance Deposited:* ₹500.00')
    expect(message).toContain('Net Balance Due:* *₹2000.00*')
    expect(message).toContain('upi://pay?pa=printpro%40upi')
  })

  it('generates a concise WhatsApp payment reminder with instant UPI intent link', () => {
    const message = ReminderService.buildLedgerReminderMessage(
      customer,
      2000,
      {
        shopName: 'PrintPro Studio',
        phone: '919876543210',
        upiId: 'printpro@upi',
      },
      {
        includeUpiInWhatsApp: true,
      }
    )

    expect(message).toContain('PAYMENT REMINDER')
    expect(message).toContain('Outstanding Balance Due:* ₹2000.00')
    expect(message).toContain('upi://pay?pa=printpro%40upi')
  })
})
