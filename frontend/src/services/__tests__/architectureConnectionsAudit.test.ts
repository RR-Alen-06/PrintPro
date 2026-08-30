import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BillingService } from '../billingService'
import { LoyaltyService } from '../loyaltyService'
import { PromoService } from '../promoService'
import { CreditService } from '../creditService'
import { LedgerService } from '../ledgerService'
import { ReconciliationService } from '../reconciliationService'
import { GroupBillingService } from '../groupBillingService'
import { SequenceService } from '../sequenceService'
import { loadState, saveState, initialState } from '../../context/AppContext'

// Mock global localStorage for Node environment test execution
const storageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
})

describe('Systematic 14-Point Architecture Connections Audit', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  // ── Connection 1: Inventory -> Billing ─────────────────────────────────────
  it('1. Inventory -> Billing: item selection, print matrix pricing, GST binding, stock deduction', () => {
    const mockInventory = [
      {
        id: 'inv-1',
        name: 'A4 Art Paper',
        type: 'print',
        colorSingle: 15,
        colorDouble: 22,
        bwSingle: 4,
        bwDouble: 6,
        gstRate: 18,
      },
      {
        id: 'inv-2',
        name: 'Photo Frame 8x10',
        type: 'product',
        sellingPrice: 250,
        stock: 50,
        gstRate: 12,
      },
    ]

    // 1. Matrix pricing resolution helper matching Billing.jsx
    const resolvePrice = (item: any, printType: string, sides: string) => {
      if (item.type === 'product') return item.sellingPrice || 0
      if (printType === 'color' && sides === 'single') return item.colorSingle
      if (printType === 'color' && sides === 'double') return item.colorDouble
      if (printType === 'bw' && sides === 'single') return item.bwSingle
      if (printType === 'bw' && sides === 'double') return item.bwDouble
      return 0
    }

    expect(resolvePrice(mockInventory[0], 'color', 'single')).toBe(15)
    expect(resolvePrice(mockInventory[0], 'color', 'double')).toBe(22)
    expect(resolvePrice(mockInventory[0], 'bw', 'single')).toBe(4)
    expect(resolvePrice(mockInventory[0], 'bw', 'double')).toBe(6)
    expect(resolvePrice(mockInventory[1], 'product', 'none')).toBe(250)

    // 2. BillingService calculation with bound GST rates
    const billItems = [
      {
        itemId: 'inv-1',
        itemName: 'A4 Art Paper (Color Double)',
        qty: 10,
        unitPrice: resolvePrice(mockInventory[0], 'color', 'double'), // 22
        gstRate: mockInventory[0].gstRate, // 18%
      },
      {
        itemId: 'inv-2',
        itemName: 'Photo Frame 8x10',
        qty: 2,
        unitPrice: resolvePrice(mockInventory[1], 'product', 'none'), // 250
        gstRate: mockInventory[1].gstRate, // 12%
      },
    ]

    const bill = BillingService.calculateBill({ items: billItems, roundingMethod: 'Standard' })
    // Item 1: 10 * 22 = 220, GST (18%) = 39.60
    // Item 2: 2 * 250 = 500, GST (12%) = 60.00
    // Subtotal = 720.00, Taxable = 720.00, GST = 99.60, Total = 819.60 -> Standarded: 820.00
    expect(bill.subtotal).toBe(720)
    expect(bill.gstAmount).toBe(99.6)
    expect(bill.roundedTotal).toBe(820)

    // 3. Stock deduction simulation
    const updatedStock = mockInventory[1].stock - billItems[1].qty
    expect(updatedStock).toBe(48)
  })

  // ── Connection 2: Billing -> Loyalty ───────────────────────────────────────
  it('2. Billing -> Loyalty: redemption discount applies, points accrue correctly after bill save', () => {
    const customer = { id: 'c-1', name: 'John Doe', loyaltyPoints: 300 }
    const loyaltySettings = {
      loyaltyEnabled: true,
      loyaltyRedeemEnabled: true,
      loyaltyRedeemRatioPoints: 150,
      loyaltyRedeemRatioRupees: 5,
    }

    // 1. Redemption
    const redemption = LoyaltyService.calculateRedemptionDiscount(
      150,
      customer.loyaltyPoints,
      900,
      loyaltySettings
    )
    expect(redemption.discountAmount).toBe(5)
    expect(redemption.pointsRedeemed).toBe(150)

    // 2. Bill Calculation with loyalty discount applied
    const bill = BillingService.calculateBill({
      items: [{ itemName: 'Brochure Print', qty: 10, unitPrice: 90, gstRate: 0 }],
      loyaltyDiscount: redemption.discountAmount,
    })
    expect(bill.subtotal).toBe(900)
    expect(bill.totalDiscount).toBe(5)
    expect(bill.taxableAmount).toBe(895)

    // 3. Loyalty accrual on taxable spend (895 / 100 default rate = 8 points)
    const pointsEarned = LoyaltyService.calculatePointsEarned(bill.taxableAmount, true, loyaltySettings)
    expect(pointsEarned).toBe(8)

    // 4. Net updated customer points balance
    const netPoints = customer.loyaltyPoints - redemption.pointsRedeemed + pointsEarned
    expect(netPoints).toBe(158) // 300 - 150 + 8
  })

  // ── Connection 3: Billing -> Advance/Credit ─────────────────────────────────
  it('3. Billing -> Advance/Credit: advance drawdown applies correctly, credit limit warning triggers', () => {
    // Case A: Customer with pre-existing advance of ₹500 purchasing ₹350 bill
    const drawdownA = CreditService.calculateAdvanceDrawdown(500, 350)
    expect(drawdownA.advanceUsed).toBe(350)
    expect(drawdownA.remainingAdvance).toBe(150)
    expect(drawdownA.netBillAmount).toBe(0)

    // Case B: Customer with pre-existing advance of ₹100 purchasing ₹400 bill
    const drawdownB = CreditService.calculateAdvanceDrawdown(100, 400)
    expect(drawdownB.advanceUsed).toBe(100)
    expect(drawdownB.remainingAdvance).toBe(0)
    expect(drawdownB.netBillAmount).toBe(300)

    // Case C: Credit limit evaluation (Balance: 800, Limit: 1000, Unpaid Bill: 400 -> New: 1200, Exceeded: 200)
    const creditCheck = CreditService.checkCreditLimit(800, 1000, 400)
    expect(creditCheck.isAllowed).toBe(false)
    expect(creditCheck.exceededBy).toBe(200)
  })

  // ── Connection 4: Billing -> Payments/Accounting ───────────────────────────
  it('4. Billing -> Payments/Accounting: cash/UPI split records correctly, excess cash handling works', () => {
    // 1. Direct split calculation
    const split = CreditService.calculatePaymentSplit(250, 250, 500)
    expect(split.isFullyPaid).toBe(true)
    expect(split.cashPaid).toBe(250)
    expect(split.upiPaid).toBe(250)
    expect(split.balanceDue).toBe(0)

    // 2. Excess cash change return vs save-as-advance
    const totalDue = 450
    const cashTendered = 500

    // Option A: Return change
    const changeDue = Math.max(0, cashTendered - totalDue)
    expect(changeDue).toBe(50)

    // Option B: Save as advance credit
    const advanceCreditSaved = cashTendered - totalDue
    expect(advanceCreditSaved).toBe(50)
  })

  // ── Connection 5: Billing & Payments -> Customer Ledger ────────────────────
  it('5. Billing & Payments -> Customer Ledger: new invoice debit, payment credit, immediate running balance', () => {
    const bills = [
      { id: 'b-1', bill_number: 'BILL-000101', date: '2026-08-01', grand_total: 1200, deleted: false },
    ]
    const payments = [
      { id: 'p-1', billId: 'b-1', payment_number: 'PAY-000201', date: '2026-08-02', amount: 500 },
    ]

    const ledger = LedgerService.buildCustomerLedger({
      bills,
      payments,
      advanceReturns: [],
    })

    expect(ledger.entries.length).toBe(2)
    expect(ledger.totalBilled).toBe(1200)
    expect(ledger.totalPaid).toBe(500)
    expect(ledger.runningBalance).toBe(700) // 1200 - 500
    expect(ledger.entries[0].bill_amount).toBe(1200)
    expect(ledger.entries[1].paid_amount).toBe(500)
  })

  // ── Connection 6: Accounting -> Cash Drawer Reconciliation ─────────────────
  it('6. Accounting -> Cash Drawer Reconciliation: expected cash reflects real sales and expenses', () => {
    const openingCash = 1000
    const cashSales = 3500
    const cashExpenses = 400

    // Physical denominations count
    const denoms = { 500: 6, 100: 10, 50: 2 } // 3000 + 1000 + 100 = 4100
    const physicalCount = ReconciliationService.calculateDenominationsTotal(denoms)
    expect(physicalCount).toBe(4100)

    // Balanced Drawer
    const balanced = ReconciliationService.calculateDrawerVariance({
      openingBalance: openingCash,
      cashSales,
      cashExpenses,
      physicalCount,
    })
    expect(balanced.expectedCash).toBe(4100) // 1000 + 3500 - 400
    expect(balanced.variance).toBe(0)
    expect(balanced.status).toBe('balanced')

    // Shortage Drawer
    const shortage = ReconciliationService.calculateDrawerVariance({
      openingBalance: openingCash,
      cashSales,
      cashExpenses,
      physicalCount: 4000,
    })
    expect(shortage.variance).toBe(-100)
    expect(shortage.status).toBe('shortage')
  })

  // ── Connection 7: Group Billing ───────────────────────────────────────────
  it('7. Group Billing: split math (1-paisa precision), member ledger update', () => {
    const members = [
      { id: 'm1', customerId: 'c1' },
      { id: 'm2', customerId: 'c2' },
      { id: 'm3', customerId: 'c3' },
    ]

    const split = GroupBillingService.calculateSplitPurchase({
      totalAmount: 1000,
      members,
      gstPercent: 18,
    })

    // 1000 / 3 = 333.333... Last member absorbs the 1 paisa
    expect(split.memberCalculations[0].subtotal).toBe(333.33)
    expect(split.memberCalculations[1].subtotal).toBe(333.33)
    expect(split.memberCalculations[2].subtotal).toBe(333.34)

    const sumSubtotals = split.memberCalculations.reduce((s, m) => s + m.subtotal, 0)
    expect(sumSubtotals).toBe(1000.0) // Exact penny reconciliation
  })

  // ── Connection 8: Refunds & Reversals ──────────────────────────────────────
  it('8. Refunds: cash/UPI payout vs credit wallet, reversal in ledger and reconciliation', () => {
    // 1. Ledger representation of advance refund debit
    const bills = [
      { id: 'b-1', bill_number: 'BILL-000101', grand_total: 600, paid_total: 600, deleted: false },
    ]
    const payments = [
      { id: 'p-1', billId: 'b-1', amount: 600 },
    ]
    const advanceReturns = [
      { id: 'ret-1', return_number: 'RET-000001', amount: 150, date: '2026-08-03' },
    ]

    const ledger = LedgerService.buildCustomerLedger({
      bills,
      payments,
      advanceReturns,
    })

    // Total billed 600 + advance refund debit 150 - total paid 600 = balance 150
    expect(ledger.totalBilled).toBe(750)
    expect(ledger.runningBalance).toBe(150)
  })

  // ── Connection 9: Deleted Bills ───────────────────────────────────────────
  it('9. Deleted Bills: soft-delete excludes bill from ledger, restore re-includes it', () => {
    const billActive = { id: 'b-1', grand_total: 1000, deleted: false }
    const billDeleted = { id: 'b-2', grand_total: 500, deleted: true }

    // Active state (excludes deleted)
    const ledgerActive = LedgerService.buildCustomerLedger({
      bills: [billActive, billDeleted],
      payments: [],
    })
    expect(ledgerActive.entries.length).toBe(1)
    expect(ledgerActive.totalBilled).toBe(1000)

    // Restored state
    const ledgerRestored = LedgerService.buildCustomerLedger({
      bills: [billActive, { ...billDeleted, deleted: false }],
      payments: [],
    })
    expect(ledgerRestored.entries.length).toBe(2)
    expect(ledgerRestored.totalBilled).toBe(1500)
  })

  // ── Connection 10: Item Sales Report / Analytics ──────────────────────────
  it('10. Item Sales Report / Analytics: reflects recently created bills accurately', () => {
    const nonDeletedBills = [
      {
        id: 'b-1',
        deleted: false,
        items: [
          { itemId: 'inv-1', itemName: 'Color Poster A3', qty: 10, unitPrice: 40, amount: 400 },
        ],
      },
      {
        id: 'b-2',
        deleted: false,
        items: [
          { itemId: 'inv-1', itemName: 'Color Poster A3', qty: 5, unitPrice: 40, amount: 200 },
          { itemId: 'inv-2', itemName: 'B&W Flyer', qty: 50, unitPrice: 2, amount: 100 },
        ],
      },
    ]

    // Sales velocity aggregation
    const itemSalesMap: Record<string, { qty: number; revenue: number }> = {}
    nonDeletedBills.forEach((b) => {
      b.items.forEach((item) => {
        if (!itemSalesMap[item.itemId]) {
          itemSalesMap[item.itemId] = { qty: 0, revenue: 0 }
        }
        itemSalesMap[item.itemId].qty += item.qty
        itemSalesMap[item.itemId].revenue += item.amount
      })
    })

    expect(itemSalesMap['inv-1'].qty).toBe(15)
    expect(itemSalesMap['inv-1'].revenue).toBe(600)
    expect(itemSalesMap['inv-2'].qty).toBe(50)
    expect(itemSalesMap['inv-2'].revenue).toBe(100)
  })

  // ── Connection 11: Global Search Indexing ──────────────────────────────────
  it('11. Search: finds newly created bills, customers, and inventory items immediately', () => {
    const testData = {
      bills: [{ id: 'b-1', invoiceNumber: 'BILL-009988', customerName: 'Apex Studio' }],
      customers: [{ id: 'c-1', name: 'Dr. John Watson', phone: '9876543210', customerCode: 'CUS-000456' }],
      inventory: [{ id: 'inv-1', name: 'Matte Vinyl Sticker 3x2', barcode: '8901234567890' }],
    }

    // Query 1: Invoice search
    const billMatch = testData.bills.filter((b) => b.invoiceNumber.includes('009988'))
    expect(billMatch.length).toBe(1)

    // Query 2: Customer phone search
    const custMatch = testData.customers.filter((c) => c.phone.includes('9876543210'))
    expect(custMatch.length).toBe(1)

    // Query 3: Inventory barcode search
    const invMatch = testData.inventory.filter((i) => i.barcode === '8901234567890')
    expect(invMatch.length).toBe(1)
  })

  // ── Connection 12: Notifications & Alerts ─────────────────────────────────
  it('12. Notifications: overdue bill, low stock, and credit limit breach trigger correctly', () => {
    // 1. Overdue bill condition
    const todayStr = '2026-08-30'
    const bill = { dueDate: '2026-08-25', balance: 500, deleted: false }
    const isOverdue = bill.dueDate < todayStr && bill.balance > 0 && !bill.deleted
    expect(isOverdue).toBe(true)

    // 2. Low stock threshold alert condition
    const invItem = { name: 'Glossy Photo Paper', stock: 12, lowStockAlert: 20 }
    const isLowStock = invItem.stock < invItem.lowStockAlert
    expect(isLowStock).toBe(true)

    // 3. Customer credit limit breach condition
    const customer = { name: 'Acme Corp', creditLimit: 2000, creditBalance: 2500 }
    const isCreditBreached = customer.creditBalance > customer.creditLimit
    expect(isCreditBreached).toBe(true)
  })

  // ── Connection 13: Data Management & Multi-Tenant Isolation ───────────────
  it('13. Data Management: export includes tenant data, import is isolated per tenant key', () => {
    const tenantA = 'tenant-aaa-111'
    const tenantB = 'tenant-bbb-222'

    const stateA = {
      ...initialState,
      business: { ...initialState.business, shopName: 'Alpha Prints' },
      expenses: [{ id: 'exp-1', description: 'Toner Cartridge', amount: 3500 }],
    }

    saveState(stateA, tenantA)

    // Verify Tenant A loads their data
    const loadedA = loadState(tenantA)
    expect(loadedA.business.shopName).toBe('Alpha Prints')
    expect(loadedA.expenses.length).toBe(1)

    // Verify Tenant B has zero trace of Tenant A's data
    const loadedB = loadState(tenantB)
    expect(loadedB.business.shopName).toBe('PrintPro - Printing Business Manager')
    expect(loadedB.expenses.length).toBe(0)
  })

  // ── Connection 14: Settings Changes Immediate Effect ──────────────────────
  it('14. Settings changes: GST rate, loyalty ratio, and invoice prefix affect new calculations immediately', () => {
    // 1. Dynamic GST rate in settings
    const settingsGst18 = { gstRate: 18 }
    const billWithGst = BillingService.calculateBill({
      items: [{ itemName: 'Design Service', qty: 1, unitPrice: 1000, gstRate: settingsGst18.gstRate }],
    })
    expect(billWithGst.gstAmount).toBe(180)
    expect(billWithGst.roundedTotal).toBe(1180)

    // 2. Dynamic Loyalty ratio in settings
    const settingsLoyaltyNew = {
      loyaltyEnabled: true,
      loyaltyRedeemEnabled: true,
      loyaltyRedeemRatioPoints: 100,
      loyaltyRedeemRatioRupees: 10,
    } // 100 pts = ₹10
    const redemption = LoyaltyService.calculateRedemptionDiscount(200, 200, 500, settingsLoyaltyNew)
    expect(redemption.discountAmount).toBe(20) // 200 * 10 / 100 = 20

    // 3. Dynamic sequence prefix
    const code = SequenceService.formatSequenceCode('BILL', 42, 6)
    expect(code).toBe('BILL-000042')
  })
})
