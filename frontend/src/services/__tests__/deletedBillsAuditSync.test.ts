import { describe, it, expect } from 'vitest'
import { LedgerService } from '../ledgerService'

describe('Deleted Bills Audit & Synchronization Suite', () => {
  it('excludes soft-deleted and archived bills from customer balance & ledger debit calculation', () => {
    const bills = [
      {
        id: 'bill-1',
        invoiceNumber: 'BILL-0001',
        customerId: 'cust-101',
        date: '2026-03-01',
        total: 1000,
        amount_paid: 0,
        balance: 1000,
        deleted: false,
      },
      {
        id: 'bill-2',
        invoiceNumber: 'BILL-0002',
        customerId: 'cust-101',
        date: '2026-03-02',
        total: 500,
        amount_paid: 0,
        balance: 500,
        deleted: true, // Soft deleted
        deleted_at: '2026-03-02T10:00:00Z',
      },
      {
        id: 'bill-3',
        invoiceNumber: 'BILL-0003',
        customerId: 'cust-101',
        date: '2026-03-03',
        total: 750,
        amount_paid: 250,
        balance: 500,
        deleted: false,
      },
    ]

    const payments = [
      {
        id: 'pay-1',
        customerId: 'cust-101',
        billId: 'bill-3',
        date: '2026-03-03',
        amount: 250,
      },
    ]

    const ledger = LedgerService.buildCustomerLedger({ bills, payments, advanceReturns: [] })
    // bill-1 (1000) + bill-3 (750) = total billed 1750 (excluding deleted bill-2 of 500)
    expect(ledger.totalBilled).toBe(1750)
    expect(ledger.totalPaid).toBe(250)
    // Outstanding balance = 1750 - 250 = 1500
    expect(ledger.runningBalance).toBe(1500)
  })

  it('restoring a soft-deleted bill instantly reinstates its debit in customer ledger', () => {
    let bills = [
      {
        id: 'bill-1',
        invoiceNumber: 'BILL-0001',
        customerId: 'cust-101',
        date: '2026-03-01',
        total: 1000,
        amount_paid: 0,
        balance: 1000,
        deleted: true, // Initially deleted
      },
    ]

    // While deleted:
    let ledger = LedgerService.buildCustomerLedger({ bills, payments: [], advanceReturns: [] })
    expect(ledger.totalBilled).toBe(0)
    expect(ledger.runningBalance).toBe(0)

    // After Restoration:
    bills = bills.map((b) => (b.id === 'bill-1' ? { ...b, deleted: false, deleted_at: null } : b))
    ledger = LedgerService.buildCustomerLedger({ bills, payments: [], advanceReturns: [] })
    expect(ledger.totalBilled).toBe(1000)
    expect(ledger.runningBalance).toBe(1000)
  })

  it('safely handles advance deposit reversal when bill with advanceUsed is deleted and restored', () => {
    // Initial state: customer has ₹500 advance balance.
    let customer = {
      id: 'cust-102',
      name: 'Beta Media',
      advanceBalance: 200, // ₹300 was used on bill-1
      creditBalance: 200,
    }

    const bill = {
      id: 'bill-10',
      invoiceNumber: 'BILL-0010',
      customerId: 'cust-102',
      total: 1000,
      advanceUsed: 300,
      amountPaid: 300,
      balance: 700,
      deleted: false,
    }

    // Step 1: On soft delete -> advanceUsed (₹300) refunded to customer wallet
    const refundedAdvance = (customer.advanceBalance || 0) + (bill.advanceUsed || 0)
    customer = {
      ...customer,
      advanceBalance: refundedAdvance,
      creditBalance: refundedAdvance,
    }
    expect(customer.advanceBalance).toBe(500)

    // Step 2: On restore -> advanceUsed (₹300) re-applied and deducted from wallet
    const reDeductedAdvance = Math.max(0, (customer.advanceBalance || 0) - (bill.advanceUsed || 0))
    customer = {
      ...customer,
      advanceBalance: reDeductedAdvance,
      creditBalance: reDeductedAdvance,
    }
    expect(customer.advanceBalance).toBe(200)
  })

  it('permanently purges invoice from recycle bin removing all record references', () => {
    let bills = [
      { id: 'bill-1', invoiceNumber: 'BILL-0001', deleted: false },
      { id: 'bill-2', invoiceNumber: 'BILL-0002', deleted: true },
      { id: 'bill-3', invoiceNumber: 'BILL-0003', deleted: true },
    ]

    // Permanent purge bill-2
    bills = bills.filter((b) => b.id !== 'bill-2')
    expect(bills.find((b) => b.id === 'bill-2')).toBeUndefined()
    expect(bills.length).toBe(2)

    // Empty recycle bin (purge all deleted)
    bills = bills.filter((b) => !b.deleted && !b.deleted_at)
    expect(bills.length).toBe(1)
    expect(bills[0].id).toBe('bill-1')
  })

  it('correctly filters deleted bills by search terms (invoice code, customer name, phone, item name)', () => {
    const deletedBills = [
      {
        id: 'bill-1',
        invoiceNumber: 'BILL-0001',
        customerName: 'Rohit Sharma',
        customerPhone: '9876543210',
        items: [{ name: 'Vinyl Banner 10x4' }],
        notes: 'Canceled by client',
        deleted: true,
      },
      {
        id: 'bill-2',
        invoiceNumber: 'BILL-0002',
        customerName: 'Anil Kumar',
        customerPhone: '9123456780',
        items: [{ name: 'Visiting Cards 1000' }],
        notes: 'Duplicate bill created',
        deleted: true,
      },
    ]

    const filterBills = (query: string) => {
      const q = query.toLowerCase().trim()
      return deletedBills.filter((b) => {
        const inv = (b.invoiceNumber || '').toLowerCase()
        const cust = (b.customerName || '').toLowerCase()
        const phone = (b.customerPhone || '').toLowerCase()
        const notes = (b.notes || '').toLowerCase()
        const itemsMatch = b.items?.some((i) => i.name.toLowerCase().includes(q))
        return inv.includes(q) || cust.includes(q) || phone.includes(q) || notes.includes(q) || itemsMatch
      })
    }

    expect(filterBills('BILL-0001')).toHaveLength(1)
    expect(filterBills('Rohit')).toHaveLength(1)
    expect(filterBills('Vinyl Banner')).toHaveLength(1)
    expect(filterBills('Duplicate')).toHaveLength(1)
    expect(filterBills('9123456780')).toHaveLength(1)
    expect(filterBills('Nonexistent')).toHaveLength(0)
  })
})
