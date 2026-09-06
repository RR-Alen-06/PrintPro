import { describe, it, expect } from 'vitest'
import { isValidUUID } from '../../lib/uuid'
import { mapPaymentFromApi } from '../../api/payments'
import { mapBillFromApi } from '../../api/bills'
import { mapCustomerFromApi } from '../../api/customers'

describe('UUID Validation & Entity Resilience Tests', () => {
  describe('isValidUUID helper', () => {
    it('accepts standard RFC 4122 UUIDs', () => {
      expect(isValidUUID('c658fba2-d591-4e78-958a-f34ee6d11f8e')).toBe(true)
      expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true)
      expect(isValidUUID('A1B2C3D4-E5F6-4A7B-8C9D-E0F1A2B3C4D5')).toBe(true)
    })

    it('rejects human-readable codes, invoice numbers, timestamps, and invalid formats', () => {
      expect(isValidUUID('RC0002')).toBe(false)
      expect(isValidUUID('WC0001')).toBe(false)
      expect(isValidUUID('BILL-1725619283746')).toBe(false)
      expect(isValidUUID('INV/2026/001')).toBe(false)
      expect(isValidUUID('temp-pay-12345')).toBe(false)
      expect(isValidUUID('')).toBe(false)
      expect(isValidUUID(null)).toBe(false)
      expect(isValidUUID(undefined)).toBe(false)
      expect(isValidUUID(12345 as any)).toBe(false)
      expect(isValidUUID({ id: '123' } as any)).toBe(false)
    })
  })

  describe('API Mappers & Legacy ID Support', () => {
    it('mapCustomerFromApi handles both UUIDs and legacy customer codes', () => {
      const legacyCustomer = {
        id: 'RC0002',
        name: 'John Doe',
        phone: '9876543210'
      }
      const mapped = mapCustomerFromApi(legacyCustomer)
      expect(mapped.id).toBe('RC0002')
      expect(mapped.customerCode).toBe('RC0002')

      const uuidCustomer = {
        id: 'c658fba2-d591-4e78-958a-f34ee6d11f8e',
        customer_code: 'RC0005',
        name: 'Jane Smith'
      }
      const mappedUuid = mapCustomerFromApi(uuidCustomer)
      expect(mappedUuid.id).toBe('c658fba2-d591-4e78-958a-f34ee6d11f8e')
      expect(mappedUuid.customerCode).toBe('RC0005')
    })

    it('mapPaymentFromApi maps billId and customerId gracefully', () => {
      const payment = {
        id: 'e287ff55-cfd4-4a27-be08-592f254f3b61',
        bill_id: 'c658fba2-d591-4e78-958a-f34ee6d11f8e',
        customer_id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
        cash_amount: 500,
        upi_amount: 250,
        total_paid: 750,
        payment_type: 'partial'
      }
      const mapped = mapPaymentFromApi(payment)
      expect(mapped.id).toBe(payment.id)
      expect(mapped.billId).toBe(payment.bill_id)
      expect(mapped.customerId).toBe(payment.customer_id)
      expect(mapped.cashAmount).toBe(500)
      expect(mapped.upiAmount).toBe(250)
      expect(mapped.totalPaid).toBe(750)
    })

    it('mapBillFromApi handles bill items with numeric totals and status', () => {
      const bill = {
        id: 'c658fba2-d591-4e78-958a-f34ee6d11f8e',
        invoice_number: 'BILL-1001',
        customer_id: 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
        customer_name: 'Walk-in Customer',
        subtotal: 100,
        total: 100,
        amount_paid: 100,
        balance: 0,
        status: 'paid',
        items: [
          {
            id: 'item-1',
            item_name: 'Glossy A4',
            qty: 10,
            unit_price: 10,
            amount: 100
          }
        ]
      }
      const mapped = mapBillFromApi(bill)
      expect(mapped.id).toBe(bill.id)
      expect(mapped.invoiceNumber).toBe('BILL-1001')
      expect(mapped.items.length).toBe(1)
      expect(mapped.items[0].name).toBe('Glossy A4')
      expect(mapped.items[0].unitPrice).toBe(10)
      expect(mapped.items[0].amount).toBe(100)
    })
  })
})
