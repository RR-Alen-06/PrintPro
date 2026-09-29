import { describe, it, expect } from 'vitest'

describe('Unified Finance Hub Workflows', () => {
  describe('Cash Drawer Denomination Counter & Variance Calculation', () => {
    it('calculates total physical cash from denominations and identifies drawer shortage/overage', () => {
      const denominations = [
        { note: 500, count: 4 },  // 2000
        { note: 200, count: 5 },  // 1000
        { note: 100, count: 10 }, // 1000
        { note: 50, count: 4 },   // 200
        { note: 20, count: 5 },   // 100
        { note: 10, count: 10 },  // 100
        { note: 5, count: 10 },   // 50
        { note: 2, count: 10 },   // 20
        { note: 1, count: 30 },   // 30
      ]

      const totalCounted = denominations.reduce((sum, d) => sum + (d.note * d.count), 0)
      expect(totalCounted).toBe(4500)

      // Case 1: Drawer matches expected cash
      const expectedCash1 = 4500
      const variance1 = totalCounted - expectedCash1
      expect(variance1).toBe(0)

      // Case 2: Drawer has cash overage (₹50 extra)
      const expectedCash2 = 4450
      const variance2 = totalCounted - expectedCash2
      expect(variance2).toBe(50)

      // Case 3: Drawer has cash shortage (₹100 short)
      const expectedCash3 = 4600
      const variance3 = totalCounted - expectedCash3
      expect(variance3).toBe(-100)
    })
  })

  describe('Real-time Net Operating Profit & Margin Engine', () => {
    it('accurately computes COGS, Gross Profit, Operating Expenses, Refunds, and Net Margin %', () => {
      const grossRevenue = 50000
      const cogs = 18000 // Paper, Flex, Vinyl, Toner cost
      const grossProfit = grossRevenue - cogs
      expect(grossProfit).toBe(32000)

      const grossMarginPct = (grossProfit / grossRevenue) * 100
      expect(grossMarginPct).toBe(64) // 64%

      const operatingExpenses = [
        { category: 'Rent', amount: 8000 },
        { category: 'Electricity', amount: 3500 },
        { category: 'Tea & Snacks', amount: 500 },
        { category: 'Staff Advance', amount: 2000 },
      ]
      const totalExpenses = operatingExpenses.reduce((s, e) => s + e.amount, 0)
      expect(totalExpenses).toBe(14000)

      const refunds = [
        { type: 'Bill Refund', amount: 1200 },
        { type: 'Advance Return', amount: 800 },
      ]
      const totalRefunds = refunds.reduce((s, r) => s + r.amount, 0)
      expect(totalRefunds).toBe(2000)

      // Net Operating Profit = Gross Profit - Operating Expenses - Refunds
      const netOperatingProfit = grossProfit - totalExpenses - totalRefunds
      expect(netOperatingProfit).toBe(16000)

      // Net Margin % = (Net Profit / Gross Revenue) * 100
      const netMarginPct = Number(((netOperatingProfit / grossRevenue) * 100).toFixed(2))
      expect(netMarginPct).toBe(32) // 32%
    })
  })

  describe('Daily Z-Report Aggregator & WhatsApp Broadcast Formatter', () => {
    it('aggregates daily transactions and creates a complete WhatsApp financial closing dispatch', () => {
      const date = '2026-09-28'
      const bills = [
        { id: 'b1', total: 2500, amountPaid: 2500, cashAmount: 1500, upiAmount: 1000 },
        { id: 'b2', total: 4000, amountPaid: 4000, cashAmount: 4000, upiAmount: 0 },
        { id: 'b3', total: 1500, amountPaid: 1000, cashAmount: 0, upiAmount: 1000 }, // partial
      ]
      const expenses = [
        { amount: 500, category: 'Machine Maintenance' },
        { amount: 200, category: 'Courier' }
      ]
      const refunds = [
        { amount: 300, paymentMethod: 'cash' }
      ]
      const openingCash = 1000

      const billsCount = bills.length
      const totalRevenue = bills.reduce((s, b) => s + b.total, 0)
      const cashCollected = bills.reduce((s, b) => s + (b.cashAmount || 0), 0)
      const upiCollected = bills.reduce((s, b) => s + (b.upiAmount || 0), 0)
      const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
      const totalRefunds = refunds.reduce((s, r) => s + r.amount, 0)

      const expectedDrawerCash = openingCash + cashCollected - totalExpenses - totalRefunds

      expect(billsCount).toBe(3)
      expect(totalRevenue).toBe(8000)
      expect(cashCollected).toBe(5500)
      expect(upiCollected).toBe(2000)
      expect(totalExpenses).toBe(700)
      expect(totalRefunds).toBe(300)
      expect(expectedDrawerCash).toBe(5500) // 1000 + 5500 - 700 - 300 = 5500

      // WhatsApp text generator test
      const formatZReportWhatsApp = (data: {
        date: string
        billsCount: number
        totalRevenue: number
        cashCollected: number
        upiCollected: number
        totalExpenses: number
        totalRefunds: number
        drawerCash: number
      }) => {
        return `*PRINTPRO ERP - DAILY Z-CLOSING REPORT*\n` +
          `Date: ${data.date}\n` +
          `-------------------------------\n` +
          `* Invoices Generated: ${data.billsCount}\n` +
          `* Total Gross Sales: ₹${data.totalRevenue.toFixed(2)}\n` +
          `* Cash Inflow: ₹${data.cashCollected.toFixed(2)}\n` +
          `* UPI Inflow: ₹${data.upiCollected.toFixed(2)}\n` +
          `* Total Expenses: ₹${data.totalExpenses.toFixed(2)}\n` +
          `* Total Refunds: ₹${data.totalRefunds.toFixed(2)}\n` +
          `-------------------------------\n` +
          `* Closing Drawer Cash: ₹${data.drawerCash.toFixed(2)}\n` +
          `-------------------------------\n` +
          `Auto-generated via PrintPro Aurora Terminal`
      }

      const waMessage = formatZReportWhatsApp({
        date,
        billsCount,
        totalRevenue,
        cashCollected,
        upiCollected,
        totalExpenses,
        totalRefunds,
        drawerCash: expectedDrawerCash
      })

      expect(waMessage).toContain('*PRINTPRO ERP - DAILY Z-CLOSING REPORT*')
      expect(waMessage).toContain('Total Gross Sales: ₹8000.00')
      expect(waMessage).toContain('Closing Drawer Cash: ₹5500.00')
    })
  })

  describe('Item Size and Material Velocity Analysis', () => {
    it('aggregates item volume and revenue by print category and material specs', () => {
      const billItems = [
        { itemName: 'A4 Color Print', quantity: 150, rate: 10, total: 1500, category: 'Digital Print' },
        { itemName: 'A3 Glossy Poster', quantity: 20, rate: 50, total: 1000, category: 'Digital Print' },
        { itemName: 'Vinyl Banner 6x3', quantity: 2, rate: 800, total: 1600, category: 'Large Format' },
        { itemName: 'A4 Color Print', quantity: 50, rate: 10, total: 500, category: 'Digital Print' },
      ]

      const itemMap = new Map<string, { qty: number; revenue: number }>()
      for (const item of billItems) {
        const current = itemMap.get(item.itemName) || { qty: 0, revenue: 0 }
        itemMap.set(item.itemName, {
          qty: current.qty + item.quantity,
          revenue: current.revenue + item.total,
        })
      }

      expect(itemMap.get('A4 Color Print')?.qty).toBe(200)
      expect(itemMap.get('A4 Color Print')?.revenue).toBe(2000)
      expect(itemMap.get('Vinyl Banner 6x3')?.revenue).toBe(1600)
    })
  })
})
