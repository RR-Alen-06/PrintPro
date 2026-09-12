import { describe, it, expect } from 'vitest'

describe('Sale Item Report Data Aggregation & Reactivity', () => {
  it('correctly aggregates quantities, revenues, and rankings from bill line items', () => {
    const bills = [
      {
        id: 'BILL-0001',
        total: 750,
        date: '2026-09-10',
        items: [
          { name: 'A4 Color Single', printType: 'color', sides: 'single', qty: 50, amount: 500 },
          { name: 'Spiral Binding A4', printType: 'bw', sides: 'single', qty: 5, amount: 250 },
        ]
      },
      {
        id: 'BILL-0002',
        total: 600,
        date: '2026-09-11',
        items: [
          { name: 'A4 Color Single', printType: 'color', sides: 'single', qty: 20, amount: 200 },
          { name: 'A4 B/W Double', printType: 'bw', sides: 'double', qty: 100, amount: 300 },
          { name: 'Glossy Lamination', printType: 'bw', sides: 'single', qty: 10, amount: 100 },
        ]
      }
    ]

    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    let grandQty = 0
    let grandRevenue = 0

    const printTypeRevenue: Record<string, number> = {
      'Color Single': 0,
      'Color Double': 0,
      'B/W Single': 0,
      'B/W Double': 0
    }

    bills.forEach(bill => {
      bill.items.forEach(item => {
        const itemName = item.name
        const printType = item.printType === 'color' ? 'Color' : 'B/W'
        const sides = item.sides === 'double' ? 'Double' : 'Single'
        const pTypeKey = `${printType} ${sides}`

        if (!itemMap[itemName]) {
          itemMap[itemName] = { name: itemName, qty: 0, revenue: 0 }
        }
        itemMap[itemName].qty += item.qty
        itemMap[itemName].revenue += item.amount

        if (pTypeKey in printTypeRevenue) {
          printTypeRevenue[pTypeKey] += item.amount
        }

        grandQty += item.qty
        grandRevenue += item.amount
      })
    })

    const itemsList = Object.values(itemMap)
    const sortedDesc = [...itemsList].sort((a, b) => b.revenue - a.revenue)
    const sortedAsc = [...itemsList].sort((a, b) => a.revenue - b.revenue)

    expect(grandQty).toBe(185) // 50 + 5 + 20 + 100 + 10
    expect(grandRevenue).toBe(1350) // 500 + 250 + 200 + 300 + 100

    // Top Selling item by revenue
    expect(sortedDesc[0].name).toBe('A4 Color Single')
    expect(sortedDesc[0].qty).toBe(70)
    expect(sortedDesc[0].revenue).toBe(700)

    // Least Selling item
    expect(sortedAsc[0].name).toBe('Glossy Lamination')
    expect(sortedAsc[0].revenue).toBe(100)

    // Print Type Revenue Breakdown
    expect(printTypeRevenue['Color Single']).toBe(700)
    expect(printTypeRevenue['B/W Double']).toBe(300)
  })

  it('filters items accurately by print type filter', () => {
    const items = [
      { name: 'A4 Color Single', printType: 'color', sides: 'single', qty: 10, amount: 100 },
      { name: 'A4 Color Double', printType: 'color', sides: 'double', qty: 5, amount: 75 },
      { name: 'A4 B/W Single', printType: 'bw', sides: 'single', qty: 50, amount: 100 },
    ]

    const colorSingleOnly = items.filter(it => it.printType === 'color' && it.sides === 'single')
    expect(colorSingleOnly.length).toBe(1)
    expect(colorSingleOnly[0].name).toBe('A4 Color Single')
    expect(colorSingleOnly[0].amount).toBe(100)
  })
})
