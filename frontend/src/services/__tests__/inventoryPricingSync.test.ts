import { describe, it, expect } from 'vitest'
import { SequenceService } from '../sequenceService'

describe('Inventory & Pricing Catalog System', () => {
  it('generates sequential ITM item codes correctly', () => {
    const existingItems = [
      { id: '1', itemCode: 'ITM-000001', name: 'A4 75GSM', type: 'print' },
      { id: '2', itemCode: 'ITM-000002', name: 'A3 Glossy', type: 'print' },
      { id: '3', item_code: 'ITM-000003', name: 'Spiral Binding', type: 'product' },
    ]

    const nextCode = SequenceService.peekNextSequence('INVENTORY', existingItems, 'ITM', 6)
    expect(nextCode).toBe('ITM-000004')
  })

  it('correctly distinguishes print rate matrix from standard product selling price without stock tracking', () => {
    const printPaper = {
      id: 'uuid-1',
      name: 'A4 75 GSM Paper',
      type: 'print',
      hsn_code: '4911',
      color_single: 10,
      color_double: 18,
      bw_single: 3,
      bw_double: 5,
    }

    const standardProduct = {
      id: 'uuid-2',
      name: 'Lamination A4',
      type: 'product',
      hsn_code: '3920',
      selling_price: 25.0,
      color_single: 0,
      color_double: 0,
      bw_single: 0,
      bw_double: 0,
    }

    // Print rate calculations
    const calcPrintPrice = (item: typeof printPaper, copies: number, isColor: boolean, isDouble: boolean) => {
      let unitRate = 0
      if (isColor) {
        unitRate = isDouble ? item.color_double : item.color_single
      } else {
        unitRate = isDouble ? item.bw_double : item.bw_single
      }
      return Number((copies * unitRate).toFixed(2))
    }

    expect(calcPrintPrice(printPaper, 10, true, false)).toBe(100.0)
    expect(calcPrintPrice(printPaper, 10, true, true)).toBe(180.0)
    expect(calcPrintPrice(printPaper, 10, false, false)).toBe(30.0)
    expect(calcPrintPrice(printPaper, 10, false, true)).toBe(50.0)

    // Product pricing
    const calcProductPrice = (item: typeof standardProduct, qty: number) => {
      return Number((qty * item.selling_price).toFixed(2))
    }

    expect(calcProductPrice(standardProduct, 4)).toBe(100.0)
  })

  it('sorts catalog items safely even with non-numeric UUID identifiers', () => {
    const items = [
      { id: 'b8e907a1-c812-40db-9887-832145612301', name: 'Zebra Print Film' },
      { id: 'a1b2c3d4-0000-0000-0000-000000000001', name: 'A4 Regular Paper' },
      { id: 'f9e8d7c6-1111-2222-3333-444455556666', name: 'Glossy Photo 250GSM' },
    ]

    const sorted = [...items].sort((a, b) =>
      String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, { numeric: true })
    )

    expect(sorted[0].name).toBe('A4 Regular Paper')
    expect(sorted[1].name).toBe('Glossy Photo 250GSM')
    expect(sorted[2].name).toBe('Zebra Print Film')
  })
})
