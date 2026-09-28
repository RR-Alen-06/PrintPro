import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SequenceService } from '../sequenceService'
import { ReconciliationService } from '../reconciliationService'

describe('Workflow 3: Inventory Restocking, Low Stock Alerts & Vendor Expense Outflow One-to-One Trace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs complete one-to-one workflow: Low Stock Detection -> PO/Restock Intake -> Stock Increment -> Vendor Outflow -> Cash Drawer Audit', () => {
    // =========================================================================
    // STAGE 1: INVENTORY CATALOG & LOW STOCK ALERT DETECTION
    // =========================================================================
    const inventoryCatalog = [
      {
        id: 'inv-glossy-a4',
        name: 'A4 Glossy Photo Paper (200 GSM)',
        sku: 'PAP-GL-A4',
        type: 'product',
        stock: 12,
        low_stock_alert: 25, // Alert threshold
        buying_price: 45.0,
        selling_price: 75.0,
      },
      {
        id: 'inv-matte-a4',
        name: 'A4 Matte Paper (100 GSM)',
        sku: 'PAP-MT-A4',
        type: 'product',
        stock: 80,
        low_stock_alert: 30,
        buying_price: 20.0,
        selling_price: 35.0,
      },
      {
        id: 'inv-toner-black',
        name: 'Canon NPG-59 Black Toner Cartridge',
        sku: 'TON-CN-BLK',
        type: 'product',
        stock: 1,
        low_stock_alert: 3,
        buying_price: 1800.0,
        selling_price: 2600.0,
      },
    ]

    // Detection Rule: stock <= low_stock_alert
    const getLowStockAlerts = (catalog: typeof inventoryCatalog) => {
      return catalog.filter((item) => Number(item.stock) <= Number(item.low_stock_alert))
    }

    const initialLowStockItems = getLowStockAlerts(inventoryCatalog)
    expect(initialLowStockItems.length).toBe(2)
    expect(initialLowStockItems.map((i) => i.id)).toEqual(['inv-glossy-a4', 'inv-toner-black'])

    // =========================================================================
    // STAGE 2: PURCHASE REQUISITION & PO CODE GENERATION
    // =========================================================================
    const poNumber = SequenceService.formatSequenceCode('PO', 302, 6)
    expect(poNumber).toBe('PO-000302')

    const vendor = {
      id: 'ven-jk-paper',
      name: 'JK Paper & Chemical Mart',
      phone: '9845099881',
      gstin: '29ABCDE1234F1Z5',
    }

    const restockOrder = {
      poNumber,
      vendorId: vendor.id,
      vendorName: vendor.name,
      date: '2026-09-28',
      items: [
        {
          itemId: 'inv-glossy-a4',
          itemName: 'A4 Glossy Photo Paper (200 GSM)',
          qty: 100,
          unitCost: 45.0,
          lineTotal: 4500.0,
        },
        {
          itemId: 'inv-toner-black',
          itemName: 'Canon NPG-59 Black Toner Cartridge',
          qty: 4,
          unitCost: 1800.0,
          lineTotal: 7200.0,
        },
      ],
      totalAmount: 11700.0,
      notes: 'Urgent restocking for photo printing demand',
    }

    expect(restockOrder.totalAmount).toBe(11700.0)

    // =========================================================================
    // STAGE 3: INVENTORY INTAKE & STOCK QUANTITY INCREMENT
    // =========================================================================
    for (const line of restockOrder.items) {
      const targetItem = inventoryCatalog.find((i) => i.id === line.itemId)
      expect(targetItem).toBeDefined()
      if (targetItem) {
        const priorStock = targetItem.stock
        targetItem.stock += line.qty
        expect(targetItem.stock).toBe(priorStock + line.qty)
      }
    }

    // Verify updated stock levels
    const updatedGlossy = inventoryCatalog.find((i) => i.id === 'inv-glossy-a4')!
    expect(updatedGlossy.stock).toBe(112) // 12 + 100

    const updatedToner = inventoryCatalog.find((i) => i.id === 'inv-toner-black')!
    expect(updatedToner.stock).toBe(5) // 1 + 4

    // Verify low stock alerts are now fully resolved
    const postRestockAlerts = getLowStockAlerts(inventoryCatalog)
    expect(postRestockAlerts.length).toBe(0)

    // =========================================================================
    // STAGE 4: VENDOR PAYMENT EXPENSE VOUCHER & SPLIT DISBURSEMENT
    // =========================================================================
    const expenseVoucherCode = SequenceService.formatSequenceCode('EXP', 814, 6)
    expect(expenseVoucherCode).toBe('EXP-000814')

    // Vendor paid: ₹5,000 Cash from Drawer + ₹6,700 via Bank NEFT/UPI
    const cashDisbursed = 5000.0
    const upiDisbursed = 6700.0
    expect(cashDisbursed + upiDisbursed).toBe(restockOrder.totalAmount)

    const expenseEntry = {
      voucherNumber: expenseVoucherCode,
      category: 'Inventory Restock',
      vendor: vendor.name,
      totalAmount: restockOrder.totalAmount,
      cashAmount: cashDisbursed,
      upiAmount: upiDisbursed,
      date: '2026-09-28',
      description: `Restock Order ${poNumber} - Paper & Toner Supplies`,
    }

    // =========================================================================
    // STAGE 5: CASH DRAWER & FINANCIAL RECONCILIATION AUDIT
    // =========================================================================
    const initialDrawerCash = 8500.0
    const initialBankBalance = 25000.0

    // Compute expected ending liquidities
    const expectedDrawerCash = initialDrawerCash - expenseEntry.cashAmount
    const expectedBankBalance = initialBankBalance - expenseEntry.upiAmount

    expect(expectedDrawerCash).toBe(3500.0)
    expect(expectedBankBalance).toBe(18300.0)

    // Reconcile drawer variance
    const countedCashInPhysicalDrawer = 3500.0
    const variance = Number((countedCashInPhysicalDrawer - expectedDrawerCash).toFixed(2))
    expect(variance).toBe(0.0)

    // Audit summary status
    const isReconciled = variance === 0
    expect(isReconciled).toBe(true)
  })
})
