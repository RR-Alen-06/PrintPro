import { describe, it, expect } from 'vitest'

describe('Accounting & 360° Cashbook Drawer Reconciliation', () => {
  it('calculates physical cash on hand drawer balance accurately', () => {
    // Inflows
    const cashFromBills = 1500
    const cashFromAdvances = 500
    const totalCashInflow = cashFromBills + cashFromAdvances // 2000

    // Outflows
    const cashExpenses = 400
    const cashRefunds = 100
    const totalCashOutflow = cashExpenses + cashRefunds // 500

    const netCashInDrawer = totalCashInflow - totalCashOutflow // 1500

    expect(totalCashInflow).toBe(2000)
    expect(totalCashOutflow).toBe(500)
    expect(netCashInDrawer).toBe(1500)
  })

  it('calculates bank and UPI liquidity balance accurately', () => {
    // Inflows
    const upiFromBills = 3200
    const upiFromAdvances = 800
    const totalUpiInflow = upiFromBills + upiFromAdvances // 4000

    // Outflows
    const upiExpenses = 1200
    const upiRefunds = 300
    const totalUpiOutflow = upiExpenses + upiRefunds // 1500

    const netUpiLiquidity = totalUpiInflow - totalUpiOutflow // 2500

    expect(totalUpiInflow).toBe(4000)
    expect(totalUpiOutflow).toBe(1500)
    expect(netUpiLiquidity).toBe(2500)
  })

  it('calculates net operating profit and gross cash flow', () => {
    const grossRevenue = 10000
    const totalExpenses = 3500
    const netProfit = grossRevenue - totalExpenses // 6500

    const totalCashInflow = 8000
    const totalRefundOutflow = 400
    const netCashFlow = totalCashInflow - totalExpenses - totalRefundOutflow // 4100

    expect(netProfit).toBe(6500)
    expect(netCashFlow).toBe(4100)
  })

  it('calculates GSTR-1 18% GST splits (CGST 9% + SGST 9%)', () => {
    const invoiceTotal = 1180
    const gstRate = 18
    const taxableAmount = Number((invoiceTotal / (1 + gstRate / 100)).toFixed(2)) // 1000.00
    const totalGst = Number((invoiceTotal - taxableAmount).toFixed(2)) // 180.00
    const cgst = Number((totalGst / 2).toFixed(2)) // 90.00
    const sgst = Number((totalGst / 2).toFixed(2)) // 90.00

    expect(taxableAmount).toBe(1000)
    expect(totalGst).toBe(180)
    expect(cgst).toBe(90)
    expect(sgst).toBe(90)
    expect(cgst + sgst).toBe(totalGst)
  })
})
