import { describe, it, expect } from 'vitest'
import { LedgerService } from '../ledgerService'
import { ReconciliationService } from '../reconciliationService'

describe('Unified Customer Hub Workflow & Advance-to-Due Settlement', () => {
  it('1-click advance knockoff: applies available advance to clear oldest due bills via FIFO', () => {
    let customerAdvanceBalance = 800
    const bills = [
      { id: 'b-1', invoiceNumber: 'INV-101', date: '2026-09-01', total: 300, amountPaid: 0, balance: 300, status: 'unpaid' },
      { id: 'b-2', invoiceNumber: 'INV-102', date: '2026-09-05', total: 400, amountPaid: 0, balance: 400, status: 'unpaid' },
      { id: 'b-3', invoiceNumber: 'INV-103', date: '2026-09-10', total: 500, amountPaid: 0, balance: 500, status: 'unpaid' },
    ]

    const totalDue = bills.reduce((sum, b) => sum + b.balance, 0)
    expect(totalDue).toBe(1200)

    const toKnockoff = Math.min(customerAdvanceBalance, totalDue)
    expect(toKnockoff).toBe(800)

    // Simulate FIFO allocation
    let remaining = toKnockoff
    const updatedBills = bills.map((b) => {
      if (remaining <= 0) return { ...b }
      const toPay = Math.min(remaining, b.balance)
      const newBal = Number((b.balance - toPay).toFixed(2))
      const newPaid = Number((b.amountPaid + toPay).toFixed(2))
      remaining -= toPay
      return {
        ...b,
        balance: newBal,
        amountPaid: newPaid,
        status: newBal <= 0 ? 'paid' : 'partial',
      }
    })

    customerAdvanceBalance = Number((customerAdvanceBalance - toKnockoff).toFixed(2))

    // Bill 1 (300) should be fully paid
    expect(updatedBills[0].balance).toBe(0)
    expect(updatedBills[0].amountPaid).toBe(300)
    expect(updatedBills[0].status).toBe('paid')

    // Bill 2 (400) should be fully paid
    expect(updatedBills[1].balance).toBe(0)
    expect(updatedBills[1].amountPaid).toBe(400)
    expect(updatedBills[1].status).toBe('paid')

    // Bill 3 (500) should be partially paid with remaining 100
    expect(updatedBills[2].balance).toBe(400)
    expect(updatedBills[2].amountPaid).toBe(100)
    expect(updatedBills[2].status).toBe('partial')

    // Remaining customer advance balance should be 0
    expect(customerAdvanceBalance).toBe(0)

    // New total due should be 400
    const newTotalDue = updatedBills.reduce((sum, b) => sum + b.balance, 0)
    expect(newTotalDue).toBe(400)
  })

  it('receive advance with auto-apply toggle: clears dues first and deposits surplus to wallet', () => {
    let customerAdvanceBalance = 50
    const pendingBill = {
      id: 'b-5',
      invoiceNumber: 'INV-105',
      date: '2026-09-15',
      total: 500,
      amountPaid: 0,
      balance: 500,
      status: 'unpaid',
    }

    const newAdvanceDepositAmount = 900
    const autoApplyToBills = true

    let surplus = newAdvanceDepositAmount
    let updatedBill = { ...pendingBill }

    if (autoApplyToBills && pendingBill.balance > 0) {
      const toPay = Math.min(newAdvanceDepositAmount, pendingBill.balance)
      surplus = Number((newAdvanceDepositAmount - toPay).toFixed(2))
      updatedBill.amountPaid += toPay
      updatedBill.balance -= toPay
      updatedBill.status = updatedBill.balance <= 0 ? 'paid' : 'partial'
    }

    customerAdvanceBalance = Number((customerAdvanceBalance + surplus).toFixed(2))

    expect(updatedBill.balance).toBe(0)
    expect(updatedBill.status).toBe('paid')
    expect(surplus).toBe(400)
    expect(customerAdvanceBalance).toBe(450) // 50 existing + 400 surplus
  })

  it('multi-method settlement: pays invoice using Cash, UPI, and Advance Wallet combined', () => {
    let customerAdvanceBalance = 600
    const bill = {
      id: 'b-9',
      invoiceNumber: 'INV-109',
      total: 1000,
      amountPaid: 0,
      balance: 1000,
      status: 'unpaid',
    }

    const paymentAllocation = {
      cash: 300,
      upi: 200,
      advance: 500,
    }

    expect(paymentAllocation.advance).toBeLessThanOrEqual(customerAdvanceBalance)

    const totalPaid = paymentAllocation.cash + paymentAllocation.upi + paymentAllocation.advance
    expect(totalPaid).toBe(1000)

    const newBal = bill.balance - totalPaid
    const newPaid = bill.amountPaid + totalPaid
    const newStatus = newBal <= 0 ? 'paid' : 'partial'

    customerAdvanceBalance -= paymentAllocation.advance

    expect(newBal).toBe(0)
    expect(newPaid).toBe(1000)
    expect(newStatus).toBe('paid')
    expect(customerAdvanceBalance).toBe(100)
  })

  it('calculates authoritative ledger entries including bills, payments, and advance wallet deposits', () => {
    const customerId = 'cust-aurora'
    const bills = [
      { id: 'bill-1', customerId, date: '2026-09-01', total: 1000, amountPaid: 1000, balance: 0, status: 'paid' },
    ]
    const payments = [
      { id: 'pay-1', customerId, date: '2026-09-01', totalPaid: 1000, cashAmount: 1000 },
    ]
    const advancePayments = [
      { id: 'adv-1', customerId, date: '2026-09-05', amount: 500, isReturn: false, notes: 'Advance for next job' },
    ]

    const ledger = LedgerService.calculateLedger({
      customerId,
      bills,
      payments,
      advancePayments,
      period: 'all',
    })

    expect(ledger.entries.length).toBeGreaterThan(0)
    const advEntry = ledger.entries.find((e: any) => e.type === 'advance')
    expect(advEntry).toBeDefined()
    expect(advEntry.advanceIn).toBe(500)
  })
})
