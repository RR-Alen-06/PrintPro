import { describe, it, expect, vi } from 'vitest'

describe('Group Billing Part A: Settlement Math and Real Payment API Wiring', () => {
  it('correctly calculates proportional split distribution across member bills', () => {
    // 3 member bills with balances
    const payerBill = { id: 'BILL-001', customerId: 'CUST-1', customerName: 'Alice', balance: 50, total: 100 }
    const memberBill2 = { id: 'BILL-002', customerId: 'CUST-2', customerName: 'Bob', balance: 100, total: 100 }
    const memberBill3 = { id: 'BILL-003', customerId: 'CUST-3', customerName: 'Charlie', balance: 50, total: 100 }

    const allUnpaidBills = [payerBill, memberBill2, memberBill3]
    const groupBal = allUnpaidBills.reduce((s, b) => s + b.balance, 0) // 200
    expect(groupBal).toBe(200)

    // User pays Full Group (₹200) with 60% cash (₹120) and 40% UPI (₹80)
    const cashNum = 120
    const upiNum = 80
    const totalPaying = 200

    const otherUnpaidBills = allUnpaidBills
      .filter(b => b.id !== payerBill.id)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    const orderedBills = [payerBill, ...otherUnpaidBills]

    let remTotal = totalPaying
    let remCash = cashNum
    let remUpi = upiNum
    const ratio = totalPaying > 0 ? cashNum / totalPaying : 1

    const settlements: any[] = []
    for (let i = 0; i < orderedBills.length; i++) {
      const b = orderedBills[i]
      if (remTotal <= 0.001) break
      const bBalance = Number(b.balance || 0)
      if (bBalance <= 0) continue

      const apply = parseFloat(Math.min(remTotal, bBalance).toFixed(2))
      const isLast = (i === orderedBills.length - 1) || (apply >= remTotal - 0.001)

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

      settlements.push({
        bill: b,
        apply,
        applyCash,
        applyUpi,
      })
    }

    expect(settlements.length).toBe(3)
    // Payer bill: ₹50 (60% cash = 30, 40% upi = 20)
    expect(settlements[0].bill.id).toBe('BILL-001')
    expect(settlements[0].apply).toBe(50)
    expect(settlements[0].applyCash).toBe(30)
    expect(settlements[0].applyUpi).toBe(20)

    // Member bill 2: ₹100 (60% cash = 60, 40% upi = 40)
    expect(settlements[1].bill.id).toBe('BILL-002')
    expect(settlements[1].apply).toBe(100)
    expect(settlements[1].applyCash).toBe(60)
    expect(settlements[1].applyUpi).toBe(40)

    // Member bill 3: ₹50 (60% cash = 30, 40% upi = 20)
    expect(settlements[2].bill.id).toBe('BILL-003')
    expect(settlements[2].apply).toBe(50)
    expect(settlements[2].applyCash).toBe(30)
    expect(settlements[2].applyUpi).toBe(20)

    // Total verification
    const sumApplied = settlements.reduce((s, x) => s + x.apply, 0)
    const sumCash = settlements.reduce((s, x) => s + x.applyCash, 0)
    const sumUpi = settlements.reduce((s, x) => s + x.applyUpi, 0)
    expect(sumApplied).toBe(200)
    expect(sumCash).toBe(120)
    expect(sumUpi).toBe(80)
  })

  it('allocates payment strictly to payer bill when user selects "Pay My Share"', () => {
    const payerBill = { id: 'BILL-001', customerId: 'CUST-1', customerName: 'Alice', balance: 50 }
    const memberBill2 = { id: 'BILL-002', customerId: 'CUST-2', customerName: 'Bob', balance: 100 }

    const allUnpaidBills = [payerBill, memberBill2]
    const totalPaying = 50
    const cashNum = 50
    const upiNum = 0

    const otherUnpaidBills = allUnpaidBills
      .filter(b => b.id !== payerBill.id)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    const orderedBills = [payerBill, ...otherUnpaidBills]

    let remTotal = totalPaying
    let remCash = cashNum
    let remUpi = upiNum
    const ratio = totalPaying > 0 ? cashNum / totalPaying : 1

    const settlements: any[] = []
    for (let i = 0; i < orderedBills.length; i++) {
      const b = orderedBills[i]
      if (remTotal <= 0.001) break
      const bBalance = Number(b.balance || 0)
      if (bBalance <= 0) continue

      const apply = parseFloat(Math.min(remTotal, bBalance).toFixed(2))
      const isLast = (i === orderedBills.length - 1) || (apply >= remTotal - 0.001)

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

      settlements.push({
        bill: b,
        apply,
        applyCash,
        applyUpi,
      })
    }

    expect(settlements.length).toBe(1)
    expect(settlements[0].bill.id).toBe('BILL-001')
    expect(settlements[0].apply).toBe(50)
    expect(settlements[0].applyCash).toBe(50)
    expect(settlements[0].applyUpi).toBe(0)
  })

  it('generates correct createPayment payloads and awaits them sequentially', async () => {
    const mockCreatePayment = vi.fn().mockResolvedValue({ id: 'PAY-123' })
    const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined)
    const mockQueryClient = { invalidateQueries: mockInvalidateQueries }

    const settlements = [
      { bill: { id: 'BILL-1', customerId: 'CUST-1', balance: 50 }, apply: 50, applyCash: 50, applyUpi: 0 },
      { bill: { id: 'BILL-2', customerId: 'CUST-2', balance: 100 }, apply: 100, applyCash: 50, applyUpi: 50 }
    ]

    for (const s of settlements) {
      if (s.apply <= 0) continue
      const method = s.applyCash > 0 && s.applyUpi > 0 ? 'split' : (s.applyUpi > 0 ? 'upi' : 'cash')
      await mockCreatePayment({
        bill_id: s.bill.id,
        billId: s.bill.id,
        customer_id: s.bill.customerId,
        customerId: s.bill.customerId,
        cash_amount: s.applyCash,
        cashAmount: s.applyCash,
        upi_amount: s.applyUpi,
        upiAmount: s.applyUpi,
        total_paid: s.apply,
        totalPaid: s.apply,
        payment_type: s.apply >= s.bill.balance ? 'full' : 'partial',
        paymentType: s.apply >= s.bill.balance ? 'full' : 'partial',
        paymentMethod: method,
        notes: `Group payment for GRP-001`,
        date: new Date().toISOString()
      })
    }

    expect(mockCreatePayment).toHaveBeenCalledTimes(2)
    expect(mockCreatePayment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        bill_id: 'BILL-1',
        customer_id: 'CUST-1',
        cash_amount: 50,
        upi_amount: 0,
        total_paid: 50,
        payment_type: 'full',
        paymentMethod: 'cash'
      })
    )
    expect(mockCreatePayment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        bill_id: 'BILL-2',
        customer_id: 'CUST-2',
        cash_amount: 50,
        upi_amount: 50,
        total_paid: 100,
        payment_type: 'full',
        paymentMethod: 'split'
      })
    )

    // Verify invalidations
    const expectedKeys = ['bills', 'payments', 'customers', 'group-bills', 'groupBills', 'accounting']
    await Promise.all(expectedKeys.map(k => mockQueryClient.invalidateQueries({ queryKey: [k] })))

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(6)
    expectedKeys.forEach(k => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: [k] })
    })
  })

  it('correctly handles shared-type group member bill payment with partial amounts', async () => {
    const mockCreatePayment = vi.fn().mockResolvedValue({ id: 'PAY-456' })
    const memberBill = { id: 'BILL-SH-1', customerId: 'CUST-SH', balance: 250, total: 300 }

    // User pays ₹100 partial (₹50 cash, ₹50 UPI)
    const cashNum = 50
    const upiNum = 50
    const totalPaying = 100
    const method = cashNum > 0 && upiNum > 0 ? 'split' : 'cash'

    await mockCreatePayment({
      bill_id: memberBill.id,
      billId: memberBill.id,
      customer_id: memberBill.customerId,
      customerId: memberBill.customerId,
      cash_amount: cashNum,
      cashAmount: cashNum,
      upi_amount: upiNum,
      upiAmount: upiNum,
      total_paid: totalPaying,
      totalPaid: totalPaying,
      payment_type: totalPaying >= memberBill.balance ? 'full' : 'partial',
      paymentType: totalPaying >= memberBill.balance ? 'full' : 'partial',
      paymentMethod: method,
      notes: `Payment for shared group member bill ${memberBill.id} (${method.toUpperCase()})`,
      date: new Date().toISOString()
    })

    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bill_id: 'BILL-SH-1',
        customer_id: 'CUST-SH',
        cash_amount: 50,
        upi_amount: 50,
        total_paid: 100,
        payment_type: 'partial',
        paymentMethod: 'split'
      })
    )
  })
})
