import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '../../api/index'
import * as inventoryApi from '../../api/inventory'

describe('Inventory Stock Deduction & Adjustment Audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. adjustStock API function', () => {
    it('sends PATCH request to /inventory/:id/stock with quantity and delta payload', async () => {
      const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({
        data: {
          data: { id: 'inv-101', name: 'Glossy Photo Paper', type: 'product', stock: 45 },
        },
      } as any)

      const result = await inventoryApi.adjustStock('inv-101', -5)

      expect(patchSpy).toHaveBeenCalledWith(
        '/inventory/inv-101/stock',
        { quantity: -5, delta: -5 }
      )
      expect(result.data.data.stock).toBe(45)
    })
  })

  describe('2. Line item product filtering rule', () => {
    const inventory = [
      { id: 'inv-1', name: 'A4 Paper', type: 'product', stock: 100 },
      { id: 'inv-2', name: 'Color Print Service', type: 'service', stock: 0 },
      { id: 'inv-3', name: 'Custom Binding', type: 'service', stock: 0 },
      { id: 'inv-4', name: 'Glossy Sheets', type: 'product', stock: 50 },
    ]

    const filterAndAggregateStockDeductions = (itemsList: any[]) => {
      const deductions = new Map<string, number>()
      for (const item of itemsList) {
        const invItem = inventory.find(
          (i) => String(i.id) === String(item.itemId || item.id) || i.name === (item.itemName || item.name)
        )
        if (invItem && invItem.type === 'product') {
          const qty = Number(item.qty || item.quantity || 0)
          if (qty > 0) {
            deductions.set(invItem.id, (deductions.get(invItem.id) || 0) + qty)
          }
        }
      }
      return Array.from(deductions.entries()).map(([id, qty]) => ({ id, delta: -qty }))
    }

    it('only deducts stock for product-type items and ignores services/custom rows', () => {
      const billItems = [
        { itemId: 'inv-1', itemName: 'A4 Paper', qty: 10 },
        { itemId: 'inv-2', itemName: 'Color Print Service', qty: 25 },
        { itemId: 'custom-row', itemName: 'Special Cut', isCustom: true, qty: 5 },
        { itemId: 'inv-4', itemName: 'Glossy Sheets', qty: 4 },
      ]

      const deductions = filterAndAggregateStockDeductions(billItems)
      expect(deductions).toEqual([
        { id: 'inv-1', delta: -10 },
        { id: 'inv-4', delta: -4 },
      ])
    })

    it('aggregates quantities when multiple bill rows reference the same product', () => {
      const billItems = [
        { itemId: 'inv-1', itemName: 'A4 Paper', qty: 10 },
        { itemId: 'inv-1', itemName: 'A4 Paper', qty: 15 },
        { itemId: 'inv-4', itemName: 'Glossy Sheets', qty: 2 },
      ]

      const deductions = filterAndAggregateStockDeductions(billItems)
      expect(deductions).toEqual([
        { id: 'inv-1', delta: -25 },
        { id: 'inv-4', delta: -2 },
      ])
    })
  })

  describe('3. Stock restoration on bill deletion & re-deduction on restore', () => {
    const inventory = [
      { id: 'inv-1', name: 'A4 Paper', type: 'product', stock: 100 },
      { id: 'inv-2', name: 'Color Print Service', type: 'service', stock: 0 },
    ]

    it('calculates positive stock delta to restore inventory when a bill is deleted', () => {
      const billToDelete = {
        id: 'bill-123',
        items: [
          { itemId: 'inv-1', itemName: 'A4 Paper', qty: 7 },
          { itemId: 'inv-2', itemName: 'Color Print Service', qty: 12 },
        ],
      }

      const stockMap = new Map<string, number>()
      for (const item of billToDelete.items) {
        const qty = Number(item.qty || 0)
        if (qty <= 0) continue
        const invItem = inventory.find((i) => i.id === item.itemId || i.name === item.itemName)
        if (invItem && invItem.type === 'product') {
          stockMap.set(invItem.id, (stockMap.get(invItem.id) || 0) + qty)
        }
      }

      const restoreAdjustments = Array.from(stockMap.entries()).map(([id, qty]) => ({ id, delta: qty }))
      expect(restoreAdjustments).toEqual([{ id: 'inv-1', delta: 7 }])
    })

    it('calculates negative stock delta to re-deduct inventory when a bill is restored', () => {
      const billToRestore = {
        id: 'bill-123',
        items: [{ itemId: 'inv-1', itemName: 'A4 Paper', qty: 7 }],
      }

      const stockMap = new Map<string, number>()
      for (const item of billToRestore.items) {
        const qty = Number(item.qty || 0)
        if (qty <= 0) continue
        const invItem = inventory.find((i) => i.id === item.itemId || i.name === item.itemName)
        if (invItem && invItem.type === 'product') {
          stockMap.set(invItem.id, (stockMap.get(invItem.id) || 0) + qty)
        }
      }

      const redeductAdjustments = Array.from(stockMap.entries()).map(([id, qty]) => ({ id, delta: -qty }))
      expect(redeductAdjustments).toEqual([{ id: 'inv-1', delta: -7 }])
    })
  })

  describe('4. Stock diff calculation on bill edit', () => {
    const inventory = [
      { id: 'inv-1', name: 'A4 Paper', type: 'product', stock: 100 },
      { id: 'inv-2', name: 'Photo Frame', type: 'product', stock: 20 },
    ]

    const computeEditDiffs = (oldItems: any[], newItems: any[]) => {
      const productInvItems = inventory.filter((i) => i.type === 'product')
      const adjustments: { id: string; diff: number }[] = []

      productInvItems.forEach((invItem) => {
        const oldQty = oldItems
          .filter((item) => String(item.itemId || item.id) === String(invItem.id) || item.itemName === invItem.name)
          .reduce((s, it) => s + Number(it.qty || it.quantity || 0), 0)
        const newQty = newItems
          .filter((item) => String(item.itemId || item.id) === String(invItem.id) || item.itemName === invItem.name)
          .reduce((s, it) => s + Number(it.qty || it.quantity || 0), 0)
        const diff = oldQty - newQty
        if (diff !== 0) {
          adjustments.push({ id: invItem.id, diff })
        }
      })
      return adjustments
    }

    it('restores stock when product item quantity is reduced in edit', () => {
      const oldItems = [{ itemId: 'inv-1', itemName: 'A4 Paper', qty: 10 }]
      const newItems = [{ itemId: 'inv-1', itemName: 'A4 Paper', qty: 6 }]

      const diffs = computeEditDiffs(oldItems, newItems)
      // old 10 - new 6 = +4 (restore 4 units to stock)
      expect(diffs).toEqual([{ id: 'inv-1', diff: 4 }])
    })

    it('deducts stock when product item quantity is increased in edit', () => {
      const oldItems = [{ itemId: 'inv-1', itemName: 'A4 Paper', qty: 6 }]
      const newItems = [{ itemId: 'inv-1', itemName: 'A4 Paper', qty: 11 }]

      const diffs = computeEditDiffs(oldItems, newItems)
      // old 6 - new 11 = -5 (deduct 5 units from stock)
      expect(diffs).toEqual([{ id: 'inv-1', diff: -5 }])
    })

    it('restores full stock when product item is completely removed in edit', () => {
      const oldItems = [
        { itemId: 'inv-1', itemName: 'A4 Paper', qty: 8 },
        { itemId: 'inv-2', itemName: 'Photo Frame', qty: 2 },
      ]
      const newItems = [{ itemId: 'inv-1', itemName: 'A4 Paper', qty: 8 }]

      const diffs = computeEditDiffs(oldItems, newItems)
      // inv-1 is unchanged (diff 0), inv-2 had old 2 - new 0 = +2
      expect(diffs).toEqual([{ id: 'inv-2', diff: 2 }])
    })
  })
})
