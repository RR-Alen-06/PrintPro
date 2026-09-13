import { describe, it, expect } from 'vitest'
import { LedgerService } from '../ledgerService'

describe('Customer Selection & Null-Safe Schema Audit Suite', () => {
  it('safely extracts and normalizes bills with missing camelCase or snake_case fields without crashing', () => {
    const rawBills = [
      // Case 1: Supabase snake_case format with grand_total and amount_paid
      {
        id: 'bill-001',
        customer_id: 'cust-101',
        grand_total: '450.50',
        amount_paid: '200.00',
        date: '2026-03-01',
        items: [
          { name: 'Color Print A4', rate: '10.00', qty: 20, total: '200.00' },
          { name: 'Binding', price: '50.00', qty: 1, amount: '50.00' }
        ]
      },
      // Case 2: Incomplete bill without amountPaid or balance
      {
        id: 'bill-002',
        customerId: 'cust-101',
        total: 300,
        date: '2026-03-02',
      },
      // Case 3: Completely undefined numbers / null values
      {
        id: 'bill-003',
        customer_id: 'cust-101',
        total: null,
        grand_total: undefined,
        amount_paid: null,
        balance: undefined,
      }
    ]

    const custId = 'cust-101'
    const customerBills = rawBills.filter((b: any) => {
      const bCustId = String(b.customerId || b.customer_id || '')
      return bCustId === custId && !b.deleted && !b.deleted_at
    })

    expect(customerBills.length).toBe(3)

    const normalizedBills = customerBills.map((bill: any) => {
      const bTotal = Number(bill.total !== undefined && bill.total !== null ? bill.total : (bill.grand_total !== undefined && bill.grand_total !== null ? bill.grand_total : 0))
      const bPaid = Number(bill.amountPaid !== undefined && bill.amountPaid !== null ? bill.amountPaid : (bill.amount_paid !== undefined && bill.amount_paid !== null ? bill.amount_paid : (bill.paid_total !== undefined && bill.paid_total !== null ? bill.paid_total : 0)))
      const bBalance = Number(bill.balance !== undefined && bill.balance !== null ? bill.balance : Math.max(0, bTotal - bPaid))
      const bStatus = bill.status || (bPaid >= bTotal && bTotal > 0 ? 'paid' : (bPaid > 0 ? 'partial' : 'unpaid'))

      return {
        id: bill.id,
        total: bTotal,
        paid: bPaid,
        balance: bBalance,
        status: bStatus,
        totalStr: bTotal.toFixed(2),
        paidStr: bPaid.toFixed(2),
        balanceStr: bBalance.toFixed(2),
      }
    })

    // Bill 1: 450.50 total, 200.00 paid, 250.50 balance
    expect(normalizedBills[0].totalStr).toBe('450.50')
    expect(normalizedBills[0].paidStr).toBe('200.00')
    expect(normalizedBills[0].balanceStr).toBe('250.50')
    expect(normalizedBills[0].status).toBe('partial')

    // Bill 2: 300 total, 0 paid, 300 balance
    expect(normalizedBills[1].totalStr).toBe('300.00')
    expect(normalizedBills[1].paidStr).toBe('0.00')
    expect(normalizedBills[1].balanceStr).toBe('300.00')
    expect(normalizedBills[1].status).toBe('unpaid')

    // Bill 3: 0 total, 0 paid, 0 balance
    expect(normalizedBills[2].totalStr).toBe('0.00')
    expect(normalizedBills[2].paidStr).toBe('0.00')
    expect(normalizedBills[2].balanceStr).toBe('0.00')
    expect(normalizedBills[2].status).toBe('unpaid')
  })

  it('safely extracts line items with variable property names (unitPrice vs rate vs price)', () => {
    const rawItems = [
      { itemName: 'Flex Banner', unitPrice: 25, qty: 10, amount: 250 },
      { name: 'Visiting Cards', rate: 1.5, qty: 500 }, // missing amount & itemName
      { name: 'Lamination', price: 15, qty: 2 }, // price instead of unitPrice
      { name: 'Unknown' }, // missing price and qty
    ]

    const parsedItems = rawItems.map((item: any) => {
      const name = item.itemName || item.name || 'Item'
      const unitPrice = Number(item.unitPrice !== undefined ? item.unitPrice : (item.rate !== undefined ? item.rate : (item.price || 0)))
      const qty = Number(item.qty || 1)
      const amount = Number(item.amount !== undefined ? item.amount : (item.total !== undefined ? item.total : (unitPrice * qty)))

      return {
        name,
        unitPriceStr: unitPrice.toFixed(2),
        qty,
        amountStr: amount.toFixed(2)
      }
    })

    expect(parsedItems[0]).toEqual({ name: 'Flex Banner', unitPriceStr: '25.00', qty: 10, amountStr: '250.00' })
    expect(parsedItems[1]).toEqual({ name: 'Visiting Cards', unitPriceStr: '1.50', qty: 500, amountStr: '750.00' })
    expect(parsedItems[2]).toEqual({ name: 'Lamination', unitPriceStr: '15.00', qty: 2, amountStr: '30.00' })
    expect(parsedItems[3]).toEqual({ name: 'Unknown', unitPriceStr: '0.00', qty: 1, amountStr: '0.00' })
  })

  it('computes customer summary and ledger correctly when customer has advance balances and mixed bills', () => {
    const customer = {
      id: 'cust-42',
      name: 'Cyberdyne Systems',
      advance_balance: 150.00,
    }

    const bills = [
      { id: 'b1', customerId: 'cust-42', total: 600, amountPaid: 0, date: '2026-03-01' },
      { id: 'b2', customer_id: 'cust-42', grand_total: 400, amount_paid: 100, date: '2026-03-05' },
    ]

    const payments = [
      { id: 'p1', customerId: 'cust-42', amount: 100, date: '2026-03-05' }
    ]

    const summary = LedgerService.computeCustomerSummary({
      customer,
      bills,
      payments,
    })

    expect(summary.total_billed).toBe(1000)
    expect(summary.total_paid).toBe(100)
    expect(summary.advance_balance).toBe(150)
    // Balance due = 1000 - 100 - 150 = 750
    expect(summary.balance_due).toBe(750)
  })

  it('safely formats WhatsApp statement with zero errors even with empty or irregular ledger rows', () => {
    const ledgerData = [
      { date: '2026-03-01', type: 'Invoice #BILL-001', refId: 'BILL-001', debit: 500, credit: 0, balance: 500 },
      { date: '2026-03-02', type: 'Payment', refId: 'PAY-001', debit: 0, credit: 200, balance: 300 },
      { date: '', type: 'Adjustment', refId: 'OB', debit: undefined, credit: null, balance: undefined },
    ]

    let msg = `*STATEMENT OF ACCOUNT*\n`
    ledgerData.forEach((row: any) => {
      const typeStr = row.refId === 'OB' ? 'OB ' : row.refId
      msg += `${row.date || 'N/A'} | ${typeStr} | ₹${Number(row.debit || 0).toFixed(0)} | ₹${Number(row.credit || 0).toFixed(0)}\n`
    })

    const outstanding = ledgerData.length > 0 ? Number(ledgerData[ledgerData.length - 1].balance || 0) : 0
    msg += `*Net Outstanding Balance: ₹${outstanding.toFixed(2)}*\n`

    expect(msg).toContain('BILL-001 | ₹500 | ₹0')
    expect(msg).toContain('PAY-001 | ₹0 | ₹200')
    expect(msg).toContain('OB  | ₹0 | ₹0')
    expect(msg).toContain('*Net Outstanding Balance: ₹0.00*')
  })
})
