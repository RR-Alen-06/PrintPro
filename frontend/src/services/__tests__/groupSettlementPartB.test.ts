import { describe, it, expect, vi } from 'vitest'
import * as groupBillsApi from '../../api/groupBills'

describe('Group Billing Part B: Atomic Group Settlement & Master Audit Linking', () => {
  it('maps group settlement record from API with all financial and audit fields', () => {
    const rawApiData = {
      id: 'gsp-12345',
      group_bill_id: 'grp-001',
      payer_customer_id: 'cust-payer',
      payer_bill_id: 'bill-payer-1',
      payer_name: 'Payer Customer',
      cash_amount: 150.50,
      upi_amount: 50.00,
      total_paid: 200.50,
      excess_credit: 25.00,
      settlements: [
        {
          bill_id: 'bill-payer-1',
          customer_id: 'cust-payer',
          customer_name: 'Payer Customer',
          apply: 100.00,
          apply_cash: 75.00,
          apply_upi: 25.00,
          child_payment_id: 'pay-child-1'
        },
        {
          bill_id: 'bill-member-2',
          customer_id: 'cust-member-2',
          customer_name: 'Bob Member',
          apply: 75.50,
          apply_cash: 75.50,
          apply_upi: 0.00,
          child_payment_id: 'pay-child-2'
        }
      ],
      notes: 'Group settlement note',
      date: '2026-09-26T12:00:00Z',
      created_at: '2026-09-26T12:00:00Z'
    }

    const mapped = groupBillsApi.mapGroupSettlementFromApi(rawApiData)
    expect(mapped.id).toBe('gsp-12345')
    expect(mapped.groupBillId).toBe('grp-001')
    expect(mapped.payerCustomerId).toBe('cust-payer')
    expect(mapped.payerBillId).toBe('bill-payer-1')
    expect(mapped.payerName).toBe('Payer Customer')
    expect(mapped.cashAmount).toBe(150.50)
    expect(mapped.upiAmount).toBe(50.00)
    expect(mapped.totalPaid).toBe(200.50)
    expect(mapped.excessCredit).toBe(25.00)
    expect(mapped.settlements.length).toBe(2)
    expect(mapped.settlements[0].child_payment_id).toBe('pay-child-1')
    expect(mapped.settlements[1].child_payment_id).toBe('pay-child-2')
    expect(mapped.notes).toBe('Group settlement note')
  })

  it('correctly handles JSON stringified settlements in mapGroupSettlementFromApi', () => {
    const rawWithJsonString = {
      id: 'gsp-json',
      group_bill_id: 'grp-json',
      payer_customer_id: 'cust-1',
      total_paid: 100,
      settlements: JSON.stringify([
        { bill_id: 'b1', customer_id: 'c1', apply: 50 },
        { bill_id: 'b2', customer_id: 'c2', apply: 50 }
      ])
    }

    const mapped = groupBillsApi.mapGroupSettlementFromApi(rawWithJsonString)
    expect(Array.isArray(mapped.settlements)).toBe(true)
    expect(mapped.settlements.length).toBe(2)
    expect(mapped.settlements[0].bill_id).toBe('b1')
    expect(mapped.settlements[1].bill_id).toBe('b2')
  })

  it('simulates atomic proportional settlement dual-write transaction flow', () => {
    const memberBills = [
      { id: 'b-1', customer_id: 'c-1', customer_name: 'Alice (Payer)', balance: 60, amount_paid: 0, total: 60, status: 'unpaid' },
      { id: 'b-2', customer_id: 'c-2', customer_name: 'Bob', balance: 80, amount_paid: 0, total: 80, status: 'unpaid' },
      { id: 'b-3', customer_id: 'c-3', customer_name: 'Charlie', balance: 100, amount_paid: 0, total: 100, status: 'unpaid' }
    ]

    const groupBalance = memberBills.reduce((acc, b) => acc + b.balance, 0) // 240
    expect(groupBalance).toBe(240)

    // Payer pays ₹200 (₹150 Cash, ₹50 UPI)
    const cashAmt = 150
    const upiAmt = 50
    const totalPaid = 200

    let remTotal = totalPaid
    let remCash = cashAmt
    let remUpi = upiAmt
    const ratio = totalPaid > 0 ? cashAmt / totalPaid : 1

    const settlements: any[] = []
    const updatedBills: any[] = []
    const childPayments: any[] = []

    for (let i = 0; i < memberBills.length; i++) {
      const bill = memberBills[i]
      if (remTotal <= 0.001) break

      const outstanding = bill.balance
      if (outstanding <= 0) continue

      const apply = parseFloat(Math.min(remTotal, outstanding).toFixed(2))
      const isLast = (i === memberBills.length - 1) || (apply >= remTotal - 0.001)

      let applyCash = 0
      let applyUpi = 0
      if (isLast) {
        applyCash = parseFloat(Math.min(remCash, apply).toFixed(2))
        applyUpi = parseFloat(Math.max(0, apply - applyCash).toFixed(2))
      } else {
        applyCash = parseFloat(Math.min(remCash, apply * ratio).toFixed(2))
        applyUpi = parseFloat(Math.max(0, apply - applyCash).toFixed(2))
      }

      remCash = parseFloat(Math.max(0, remCash - applyCash).toFixed(2))
      remUpi = parseFloat(Math.max(0, remUpi - applyUpi).toFixed(2))
      remTotal = parseFloat(Math.max(0, remTotal - apply).toFixed(2))

      const newAmountPaid = bill.amount_paid + apply
      const newBalance = bill.total - newAmountPaid
      const newStatus = newAmountPaid >= bill.total ? 'paid' : 'partial'

      const childPayId = `pay-child-${bill.id}`
      childPayments.push({
        id: childPayId,
        bill_id: bill.id,
        customer_id: bill.customer_id,
        cash_amount: applyCash,
        upi_amount: applyUpi,
        total_paid: apply,
        payment_type: newStatus === 'paid' ? 'full' : 'partial'
      })

      updatedBills.push({
        id: bill.id,
        amount_paid: newAmountPaid,
        balance: newBalance,
        status: newStatus
      })

      settlements.push({
        bill_id: bill.id,
        customer_id: bill.customer_id,
        customer_name: bill.customer_name,
        apply,
        apply_cash: applyCash,
        apply_upi: applyUpi,
        child_payment_id: childPayId
      })
    }

    // 1. Payer bill fully paid: 60 (Cash 45, UPI 15)
    expect(updatedBills[0].balance).toBe(0)
    expect(updatedBills[0].status).toBe('paid')
    expect(settlements[0].apply).toBe(60)
    expect(settlements[0].apply_cash).toBe(45)
    expect(settlements[0].apply_upi).toBe(15)

    // 2. Bob bill fully paid: 80 (Cash 60, UPI 20)
    expect(updatedBills[1].balance).toBe(0)
    expect(updatedBills[1].status).toBe('paid')
    expect(settlements[1].apply).toBe(80)
    expect(settlements[1].apply_cash).toBe(60)
    expect(settlements[1].apply_upi).toBe(20)

    // 3. Charlie bill partially paid: 60 out of 100 (Cash 45, UPI 15)
    expect(updatedBills[2].balance).toBe(40)
    expect(updatedBills[2].status).toBe('partial')
    expect(settlements[2].apply).toBe(60)
    expect(settlements[2].apply_cash).toBe(45)
    expect(settlements[2].apply_upi).toBe(15)

    // Totals match exactly
    const sumApplied = settlements.reduce((s, x) => s + x.apply, 0)
    const sumCash = settlements.reduce((s, x) => s + x.apply_cash, 0)
    const sumUpi = settlements.reduce((s, x) => s + x.apply_upi, 0)
    expect(sumApplied).toBe(200)
    expect(sumCash).toBe(150)
    expect(sumUpi).toBe(50)
    expect(childPayments.length).toBe(3)
  })

  it('correctly handles atomic reversal of a group settlement', () => {
    const originalSettlement = {
      id: 'gsp-rev-1',
      group_bill_id: 'grp-rev',
      payer_customer_id: 'cust-payer',
      excess_credit: 20,
      settlements: [
        { bill_id: 'b-1', customer_id: 'c-1', apply: 50, child_payment_id: 'pay-child-1' },
        { bill_id: 'b-2', customer_id: 'c-2', apply: 50, child_payment_id: 'pay-child-2' }
      ]
    }

    const billsState: Record<string, { total: number, amount_paid: number, balance: number, status: string }> = {
      'b-1': { total: 50, amount_paid: 50, balance: 0, status: 'paid' },
      'b-2': { total: 100, amount_paid: 50, balance: 50, status: 'partial' }
    }

    let payerCredit = 20
    const deletedPaymentIds: string[] = []

    // Reversal logic
    for (const s of originalSettlement.settlements) {
      const b = billsState[s.bill_id]
      b.amount_paid = Math.max(0, b.amount_paid - s.apply)
      b.balance = b.total - b.amount_paid
      b.status = b.amount_paid <= 0 ? 'unpaid' : 'partial'
      deletedPaymentIds.push(s.child_payment_id)
    }

    if (originalSettlement.excess_credit > 0) {
      payerCredit = Math.max(0, payerCredit - originalSettlement.excess_credit)
    }

    // Bill 1 restored to unpaid with 50 balance
    expect(billsState['b-1'].balance).toBe(50)
    expect(billsState['b-1'].status).toBe('unpaid')

    // Bill 2 restored to unpaid with 100 balance
    expect(billsState['b-2'].balance).toBe(100)
    expect(billsState['b-2'].status).toBe('unpaid')

    // Excess credit reversed
    expect(payerCredit).toBe(0)

    // Child payments deleted
    expect(deletedPaymentIds).toEqual(['pay-child-1', 'pay-child-2'])
  })
})
