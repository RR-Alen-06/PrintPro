import { describe, it, expect } from 'vitest'

describe('Customer Advance Reactivity & Audit Stream', () => {
  it('correctly aggregates advance deposits, bill usage, knockoffs, and returns into chronological audit log', () => {
    const advancePayments = [
      { id: 'ap1', customerId: 'c1', amount: 5.0, isReturn: false, date: '2026-10-01T10:00:00Z', paymentMethod: 'cash' },
      { id: 'ap2', customerId: 'c1', amount: -1.0, isReturn: true, type: 'return', date: '2026-10-02T12:00:00Z', notes: 'Refund to customer' },
    ]
    const customerBills = [
      { id: 'b1', customerId: 'c1', billNumber: 'BILL0001', total: 10.0, balance: 0, advanceUsed: 1.0, date: '2026-10-01T15:00:00Z' },
    ]
    const payments = [
      { id: 'p1', customerId: 'c1', total_paid: 1.0, advance_amount: 1.0, notes: 'Knockoff using Advance Wallet (₹1.00)', date: '2026-10-02T09:00:00Z' },
    ]

    const list: any[] = []

    advancePayments.forEach((ap) => {
      const isRet = Boolean(ap.isReturn || ap.type === 'return' || Number(ap.amount || 0) < 0)
      const amt = Math.abs(Number(ap.amount || 0))
      list.push({
        id: `adv-pmt-${ap.id}`,
        type: isRet ? 'return' : 'deposit',
        amount: isRet ? -amt : amt,
        date: ap.date,
        title: isRet ? 'Advance Refund / Return' : 'Advance Deposit',
      })
    })

    customerBills.forEach((b) => {
      if (b.advanceUsed > 0) {
        list.push({
          id: `bill-adv-${b.id}`,
          type: 'bill_usage',
          amount: -b.advanceUsed,
          date: b.date,
          title: `Used on Bill #${b.billNumber}`,
        })
      }
    })

    payments.forEach((p) => {
      if (p.notes?.includes('Knockoff using Advance Wallet')) {
        list.push({
          id: `pmt-adv-${p.id}`,
          type: 'settlement',
          amount: -p.advance_amount,
          date: p.date,
          title: 'Applied to Dues (Knockoff)',
        })
      }
    })

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    expect(list.length).toBe(4)
    expect(list[0].title).toBe('Advance Refund / Return')
    expect(list[1].title).toBe('Applied to Dues (Knockoff)')
    expect(list[2].title).toBe('Used on Bill #BILL0001')
    expect(list[3].title).toBe('Advance Deposit')

    // Summing calculations
    const deposits = list.filter((i) => i.type === 'deposit').reduce((s, i) => s + i.amount, 0)
    const usage = list.filter((i) => i.type === 'bill_usage' || i.type === 'settlement').reduce((s, i) => s + Math.abs(i.amount), 0)
    const returns = list.filter((i) => i.type === 'return').reduce((s, i) => s + Math.abs(i.amount), 0)

    expect(deposits).toBe(5.0)
    expect(usage).toBe(2.0)
    expect(returns).toBe(1.0)
  })
})
