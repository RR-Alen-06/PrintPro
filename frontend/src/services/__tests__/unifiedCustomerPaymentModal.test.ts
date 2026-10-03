import { describe, it, expect } from 'vitest'

describe('Unified Customer Payment & Advance Logic', () => {
  // Pure allocation function matching UnifiedCustomerPaymentModal engine
  function computePaymentAllocation({
    mode,
    customerAdvance = 0,
    targetBill,
    pendingBills = [],
    cashPaid = 0,
    upiPaid = 0,
    advanceUsed = 0,
  }: {
    mode: 'settle' | 'advance'
    customerAdvance?: number
    targetBill?: any
    pendingBills?: any[]
    cashPaid?: number
    upiPaid?: number
    advanceUsed?: number
  }) {
    const totalInflow = cashPaid + upiPaid
    const totalApplied = totalInflow + advanceUsed

    const billsToSettle = targetBill ? [targetBill] : pendingBills
    const totalOutstanding = billsToSettle.reduce((sum, b) => sum + Number(b.balance || 0), 0)

    if (mode === 'advance') {
      return {
        clearedDues: 0,
        advanceUsed: 0,
        advanceAdded: totalInflow,
        surplus: 0,
        newCustomerAdvance: Number((customerAdvance + totalInflow).toFixed(2)),
        remainingDues: totalOutstanding,
        updatedBills: billsToSettle,
      }
    }

    let remainingToApply = totalApplied
    const updatedBills = billsToSettle.map((b) => {
      const bBal = Number(b.balance || 0)
      if (bBal <= 0 || remainingToApply <= 0) {
        return { ...b }
      }
      const toPay = Math.min(remainingToApply, bBal)
      const newBal = Number(Math.max(0, bBal - toPay).toFixed(2))
      const currPaid = Number(b.amountPaid ?? b.amount_paid ?? 0)
      remainingToApply = Number((remainingToApply - toPay).toFixed(2))

      return {
        ...b,
        balance: newBal,
        amountPaid: Number((currPaid + toPay).toFixed(2)),
        status: newBal <= 0.001 ? 'paid' : 'partial',
      }
    })

    const clearedDues = Math.min(totalApplied, totalOutstanding)
    const surplus = Math.max(0, Number((totalInflow - clearedDues).toFixed(2)))
    const remainingDues = Math.max(0, Number((totalOutstanding - clearedDues).toFixed(2)))

    let netAdvanceChange = 0
    if (advanceUsed > 0) netAdvanceChange -= advanceUsed
    if (surplus > 0) netAdvanceChange += surplus

    const newCustomerAdvance = Math.max(0, Number((customerAdvance + netAdvanceChange).toFixed(2)))

    return {
      clearedDues,
      advanceUsed,
      advanceAdded: surplus,
      surplus,
      newCustomerAdvance,
      remainingDues,
      updatedBills,
    }
  }

  it('correctly settles a single targeted bill with partial and full payment', () => {
    const bill = { id: 'b1', total: 500, amountPaid: 0, balance: 500, status: 'unpaid' }

    // 1. Partial payment of 300
    const partialRes = computePaymentAllocation({
      mode: 'settle',
      customerAdvance: 0,
      targetBill: bill,
      cashPaid: 300,
    })
    expect(partialRes.clearedDues).toBe(300)
    expect(partialRes.remainingDues).toBe(200)
    expect(partialRes.updatedBills[0].balance).toBe(200)
    expect(partialRes.updatedBills[0].amountPaid).toBe(300)
    expect(partialRes.updatedBills[0].status).toBe('partial')

    // 2. Full payment of 500
    const fullRes = computePaymentAllocation({
      mode: 'settle',
      customerAdvance: 0,
      targetBill: bill,
      cashPaid: 500,
    })
    expect(fullRes.clearedDues).toBe(500)
    expect(fullRes.remainingDues).toBe(0)
    expect(fullRes.updatedBills[0].balance).toBe(0)
    expect(fullRes.updatedBills[0].status).toBe('paid')
  })

  it('correctly executes multi-bill waterfall settlement across oldest dues', () => {
    const bill1 = { id: 'b1', balance: 300, amountPaid: 0, status: 'unpaid' }
    const bill2 = { id: 'b2', balance: 400, amountPaid: 0, status: 'unpaid' }

    const res = computePaymentAllocation({
      mode: 'settle',
      customerAdvance: 0,
      pendingBills: [bill1, bill2],
      cashPaid: 200,
      upiPaid: 300, // Total 500
    })

    expect(res.clearedDues).toBe(500)
    expect(res.remainingDues).toBe(200)
    expect(res.updatedBills[0].balance).toBe(0)
    expect(res.updatedBills[0].status).toBe('paid')
    expect(res.updatedBills[1].balance).toBe(200)
    expect(res.updatedBills[1].status).toBe('partial')
  })

  it('automatically deposits overpayments into customer advance wallet', () => {
    const bill1 = { id: 'b1', balance: 250, amountPaid: 50, status: 'partial' }

    const res = computePaymentAllocation({
      mode: 'settle',
      customerAdvance: 50,
      targetBill: bill1,
      cashPaid: 400, // Paying 400 for a 250 due -> 150 surplus
    })

    expect(res.clearedDues).toBe(250)
    expect(res.surplus).toBe(150)
    expect(res.remainingDues).toBe(0)
    expect(res.updatedBills[0].balance).toBe(0)
    expect(res.updatedBills[0].status).toBe('paid')
    // Existing 50 + 150 surplus = 200
    expect(res.newCustomerAdvance).toBe(200)
  })

  it('correctly applies existing customer advance to settle dues without double-deduction', () => {
    const bill = { id: 'b1', balance: 400, amountPaid: 100, status: 'partial' }

    const res = computePaymentAllocation({
      mode: 'settle',
      customerAdvance: 300,
      targetBill: bill,
      advanceUsed: 250,
      cashPaid: 0,
      upiPaid: 0,
    })

    expect(res.clearedDues).toBe(250)
    expect(res.remainingDues).toBe(150)
    expect(res.updatedBills[0].balance).toBe(150)
    // Customer advance should decrease from 300 to 50
    expect(res.newCustomerAdvance).toBe(50)
  })

  it('handles direct advance deposits without requiring pending bills', () => {
    const res = computePaymentAllocation({
      mode: 'advance',
      customerAdvance: 150,
      pendingBills: [],
      cashPaid: 200,
      upiPaid: 150,
    })

    expect(res.clearedDues).toBe(0)
    expect(res.advanceAdded).toBe(350)
    expect(res.newCustomerAdvance).toBe(500)
  })
})
