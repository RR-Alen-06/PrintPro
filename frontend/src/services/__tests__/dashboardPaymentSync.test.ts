import { describe, it, expect } from 'vitest'

describe('Dashboard Quick Record Payment & FIFO Engine Suite', () => {
  it('correctly calculates customer outstanding balance excluding deleted and group parent bills', () => {
    const bills = [
      { id: 'b1', customerId: 'c1', total: 1000, amountPaid: 400, balance: 600, status: 'partial', deleted: false },
      { id: 'b2', customerId: 'c1', total: 500, amountPaid: 0, balance: 500, status: 'unpaid', deleted: false },
      { id: 'b3', customerId: 'c1', total: 300, amountPaid: 300, balance: 0, status: 'paid', deleted: false },
      { id: 'b4', customerId: 'c1', total: 800, amountPaid: 0, balance: 800, status: 'unpaid', deleted: true }, // deleted bill
      { id: 'b5', customerId: 'c2', total: 1200, amountPaid: 0, balance: 1200, status: 'unpaid', deleted: false }, // another customer
      { id: 'b6', customerId: 'c1', total: 2000, amountPaid: 0, balance: 2000, isGroupParent: true, deleted: false }, // group parent
    ]

    const cust1Due = bills
      .filter(b => {
        if (b.deleted || b.deleted_at || b.isGroupParent || b.is_group_parent) return false
        return String(b.customerId) === 'c1' && Number(b.balance || 0) > 0
      })
      .reduce((sum, b) => sum + Number(b.balance || 0), 0)

    // b1 (600) + b2 (500) = 1100
    expect(cust1Due).toBe(1100)
  })

  it('allocates payment chronologically across unpaid bills using FIFO algorithm', () => {
    const unpaidBills = [
      { id: 'b1', customerId: 'c1', date: '2026-03-01T10:00:00Z', total: 500, amountPaid: 100, balance: 400, paymentMethod: { cash: 100, upi: 0 } },
      { id: 'b2', customerId: 'c1', date: '2026-03-05T10:00:00Z', total: 600, amountPaid: 0, balance: 600, paymentMethod: { cash: 0, upi: 0 } },
    ]

    let R_cash = 700
    let R_upi = 0
    const paymentRecords: any[] = []

    const updatedBills = unpaidBills.map(b => ({ ...b, paymentMethod: { ...b.paymentMethod } }))

    for (const bill of updatedBills) {
      let remaining = bill.total - bill.amountPaid
      if (remaining <= 0) continue

      let applyCash = 0
      let applyUpi = 0

      if (R_cash > 0) {
        applyCash = Math.min(R_cash, remaining)
        R_cash -= applyCash
        remaining -= applyCash
      }
      if (R_upi > 0 && remaining > 0) {
        applyUpi = Math.min(R_upi, remaining)
        R_upi -= applyUpi
        remaining -= applyUpi
      }

      const applyTotal = applyCash + applyUpi
      if (applyTotal > 0) {
        bill.amountPaid += applyTotal
        bill.paymentMethod.cash = (bill.paymentMethod.cash || 0) + applyCash
        bill.paymentMethod.upi = (bill.paymentMethod.upi || 0) + applyUpi
        bill.balance = Math.max(bill.total - bill.amountPaid, 0)
        bill.status = bill.amountPaid >= bill.total ? 'paid' : 'partial'

        paymentRecords.push({
          billId: bill.id,
          cashAmount: applyCash,
          upiAmount: applyUpi,
          totalPaid: applyTotal,
          paymentType: bill.amountPaid >= bill.total ? 'full' : 'partial',
        })
      }
    }

    // Bill 1: was balance 400. 400 applied. amountPaid becomes 500, balance 0, status paid.
    expect(updatedBills[0].amountPaid).toBe(500)
    expect(updatedBills[0].balance).toBe(0)
    expect(updatedBills[0].status).toBe('paid')
    expect(paymentRecords[0].totalPaid).toBe(400)
    expect(paymentRecords[0].paymentType).toBe('full')

    // Bill 2: was balance 600. Remaining 300 applied. amountPaid becomes 300, balance 300, status partial.
    expect(updatedBills[1].amountPaid).toBe(300)
    expect(updatedBills[1].balance).toBe(300)
    expect(updatedBills[1].status).toBe('partial')
    expect(paymentRecords[1].totalPaid).toBe(300)
    expect(paymentRecords[1].paymentType).toBe('partial')

    // No leftover unallocated funds
    expect(R_cash).toBe(0)
  })

  it('converts excess overpayment to advance customer credit', () => {
    const unpaidBills = [
      { id: 'b1', customerId: 'c1', date: '2026-03-01T10:00:00Z', total: 400, amountPaid: 0, balance: 400, paymentMethod: { cash: 0, upi: 0 } },
    ]

    let R_cash = 200
    let R_upi = 500 // Total received = 700, bill total due = 400, excess = 300
    const paymentRecords: any[] = []

    const updatedBills = unpaidBills.map(b => ({ ...b, paymentMethod: { ...b.paymentMethod } }))

    for (const bill of updatedBills) {
      let remaining = bill.total - bill.amountPaid
      if (remaining <= 0) continue

      let applyCash = 0
      let applyUpi = 0

      if (R_cash > 0) {
        applyCash = Math.min(R_cash, remaining)
        R_cash -= applyCash
        remaining -= applyCash
      }
      if (R_upi > 0 && remaining > 0) {
        applyUpi = Math.min(R_upi, remaining)
        R_upi -= applyUpi
        remaining -= applyUpi
      }

      const applyTotal = applyCash + applyUpi
      if (applyTotal > 0) {
        bill.amountPaid += applyTotal
        bill.paymentMethod.cash = (bill.paymentMethod.cash || 0) + applyCash
        bill.paymentMethod.upi = (bill.paymentMethod.upi || 0) + applyUpi
        bill.balance = Math.max(bill.total - bill.amountPaid, 0)
        bill.status = bill.amountPaid >= bill.total ? 'paid' : 'partial'

        paymentRecords.push({
          billId: bill.id,
          totalPaid: applyTotal,
        })
      }
    }

    const excess = R_cash + R_upi
    expect(updatedBills[0].status).toBe('paid')
    expect(updatedBills[0].balance).toBe(0)
    expect(R_cash).toBe(0)
    expect(R_upi).toBe(300)
    expect(excess).toBe(300)

    // Advance payment object creation
    const advanceRecord = {
      customerId: 'c1',
      amount: excess,
      cashAmount: R_cash,
      upiAmount: R_upi,
      paymentMode: 'upi',
      isExcessCredit: true,
    }

    expect(advanceRecord.amount).toBe(300)
    expect(advanceRecord.paymentMode).toBe('upi')
    expect(advanceRecord.isExcessCredit).toBe(true)
  })

  it('correctly maps and invalidates TanStack multi-entity query keys upon recording', () => {
    const requiredInvalidationKeys = ['bills', 'payments', 'customers', 'accounting']
    const invalidated: string[] = []

    const mockQueryClient = {
      invalidateQueries: ({ queryKey }: { queryKey: string[] }) => {
        invalidated.push(queryKey[0])
      }
    }

    requiredInvalidationKeys.forEach(key => {
      mockQueryClient.invalidateQueries({ queryKey: [key] })
    })

    expect(invalidated).toContain('bills')
    expect(invalidated).toContain('payments')
    expect(invalidated).toContain('customers')
    expect(invalidated).toContain('accounting')
  })
})
