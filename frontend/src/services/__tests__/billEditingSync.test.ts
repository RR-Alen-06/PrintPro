import { describe, it, expect } from 'vitest'
import { mapBillFromApi } from '../../api/bills'

describe('Bill Editing Synchronization & Field Normalization', () => {
  it('correctly normalizes edited bill data with items and financial amounts', () => {
    const rawEditedBill = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      invoice_number: 'INV-000042',
      customer_id: 'cust-123',
      customer_name: 'Alen Dev',
      date: '2026-09-13T00:00:00.000Z',
      due_date: '2026-09-20T00:00:00.000Z',
      subtotal: '250.00',
      discount_type: 'percent',
      discount_value: '10',
      gst_percent: '18',
      gst_amount: '40.50',
      total: '265.50',
      amount_paid: '200.00',
      balance: '65.50',
      status: 'partial',
      items: [
        {
          id: 'item-1',
          item_id: 'prod-1',
          item_name: 'Color Banner Print',
          print_type: 'color',
          sides: 'single',
          qty: '2',
          unit_price: '125.00',
          amount: '250.00',
        },
      ],
    }

    const mapped = mapBillFromApi(rawEditedBill)

    expect(mapped.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(mapped.invoiceNumber).toBe('INV-000042')
    expect(mapped.customerId).toBe('cust-123')
    expect(mapped.customerName).toBe('Alen Dev')
    expect(mapped.date).toBe('2026-09-13')
    expect(mapped.dueDate).toBe('2026-09-20')
    expect(mapped.subtotal).toBe(250)
    expect(mapped.discountType).toBe('percent')
    expect(mapped.discountValue).toBe(10)
    expect(mapped.gstPercent).toBe(18)
    expect(mapped.gstAmount).toBe(40.5)
    expect(mapped.total).toBe(265.5)
    expect(mapped.amountPaid).toBe(200)
    expect(mapped.balance).toBe(65.5)
    expect(mapped.status).toBe('partial')

    expect(mapped.items.length).toBe(1)
    expect(mapped.items[0].name).toBe('Color Banner Print')
    expect(mapped.items[0].qty).toBe(2)
    expect(mapped.items[0].unitPrice).toBe(125)
    expect(mapped.items[0].amount).toBe(250)
  })

  it('correctly handles full payment transition on edited bills', () => {
    const fullyPaidEditedBill = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      invoice_number: 'INV-000043',
      subtotal: 100,
      total: 100,
      amount_paid: 100,
      balance: 0,
      status: 'paid',
      items: [],
    }

    const mapped = mapBillFromApi(fullyPaidEditedBill)
    expect(mapped.balance).toBe(0)
    expect(mapped.amountPaid).toBe(100)
    expect(mapped.status).toBe('paid')
  })
})
