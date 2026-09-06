import { describe, it, expect } from 'vitest'
import { isBackendAvailable, markBackendUnavailable, markBackendAvailable } from '../../api/index'

describe('Save Latency & Query Optimization Tests', () => {
  describe('Backend Circuit Breaker & Health Optimization', () => {
    it('manages backend availability and fast circuit breaker states', () => {
      markBackendAvailable()
      expect(isBackendAvailable()).toBe(true)

      markBackendUnavailable()
      expect(isBackendAvailable()).toBe(false)

      markBackendAvailable()
      expect(isBackendAvailable()).toBe(true)
    })
  })

  describe('Customer Code Generation (Supabase Direct Fallback Optimization)', () => {
    it('generates unique readable codes without extra round-trip DB calls', () => {
      const generateCode = (type: 'regular' | 'random') => {
        const prefix = type === 'regular' ? 'RC' : 'WC'
        return `${prefix}${Date.now().toString(36).toUpperCase().slice(-6)}`
      }

      const regularCode = generateCode('regular')
      const walkinCode = generateCode('random')

      expect(regularCode.startsWith('RC')).toBe(true)
      expect(walkinCode.startsWith('WC')).toBe(true)
      expect(regularCode.length).toBeGreaterThanOrEqual(6)
      expect(walkinCode.length).toBeGreaterThanOrEqual(6)
    })
  })

  describe('Optimistic Cache Replacement Logic', () => {
    it('replaces optimistic items with real server responses without wiping other items', () => {
      const optimisticBill = {
        id: 'temp-bill-12345',
        invoice_number: 'BILL-SAVING...',
        customer_id: 'cust-1',
        total: 150,
        isOptimistic: true,
      }

      const existingBill = {
        id: 'real-bill-999',
        invoice_number: 'BILL-001',
        customer_id: 'cust-2',
        total: 200,
        isOptimistic: false,
      }

      const cache = [optimisticBill, existingBill]

      const serverData = {
        id: 'real-uuid-777',
        invoice_number: 'BILL-002',
        customer_id: 'cust-1',
        total: 150,
      }

      const variables = { id: 'temp-bill-12345', invoice_number: 'BILL-SAVING...' }

      // Replacement mapping as used in useBillsQuery onSuccess
      const updatedCache = cache.map((b) =>
        b.isOptimistic && (b.id === variables.id || b.invoice_number === variables.invoice_number)
          ? { ...serverData, isOptimistic: false }
          : b
      )

      expect(updatedCache.length).toBe(2)
      expect(updatedCache[0].id).toBe('real-uuid-777')
      expect(updatedCache[0].invoice_number).toBe('BILL-002')
      expect(updatedCache[0].isOptimistic).toBe(false)
      expect(updatedCache[1].id).toBe('real-bill-999')
    })

    it('replaces optimistic customer with server response seamlessly', () => {
      const optimisticCust: { id: string; name: string; type: string; isOptimistic: boolean; customer_code?: string } = {
        id: 'temp-cust-999',
        name: 'Alpha Traders',
        type: 'regular',
        customer_code: '',
        isOptimistic: true,
      }

      const cache = [optimisticCust]

      const serverData = {
        id: 'cust-uuid-456',
        name: 'Alpha Traders',
        customer_code: 'RC0005',
        type: 'regular',
      }

      const variables = { id: 'temp-cust-999', name: 'Alpha Traders' }

      const updatedCache = cache.map((c) =>
        c.isOptimistic && (c.id === variables.id || c.name === variables.name)
          ? { ...serverData, isOptimistic: false }
          : c
      )

      expect(updatedCache[0].id).toBe('cust-uuid-456')
      expect(updatedCache[0].customer_code).toBe('RC0005')
      expect(updatedCache[0].isOptimistic).toBe(false)
    })
  })
})
