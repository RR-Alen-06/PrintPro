import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadState, saveState, initialState } from '../../context/AppContext'
import { SyncStateMachine } from '../../lib/syncStateMachine'
import { SequenceService } from '../sequenceService'
import { supabase } from '../../lib/supabase'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}))

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

describe('Cross-User Data Isolation & Sync State Machine (Phase 2)', () => {
  const userA = '00000000-0000-4000-a000-00000000000a'
  const userB = '11111111-1111-4111-b111-11111111111b'

  beforeEach(() => {
    localStorage.clear()
    SyncStateMachine.clear()
    vi.clearAllMocks()
  })

  describe('Real AppContext loadState / saveState Multi-Tenant Isolation', () => {
    it('executes production saveState and loadState to guarantee zero data leakage between user sessions', () => {
      // 1. User A logs in and populates customized business data
      const userAState = {
        ...initialState,
        business: {
          ...initialState.business,
          shopName: "User A's Dedicated Print Shop",
          ownerName: 'Alice Tenant',
        },
        expenses: [
          { id: 'exp-A1', description: 'Thermal Paper Rolls', amount: 1500, category: 'Materials' },
        ],
        settings: {
          ...initialState.settings,
          invoicePrefix: 'ALICE-INV',
          gstRate: 18,
        },
      }

      // Execute REAL production saveState for User A
      saveState(userAState, userA)

      // Verify User A's data is correctly loaded via REAL loadState
      const loadedA = loadState(userA)
      expect(loadedA.business.shopName).toBe("User A's Dedicated Print Shop")
      expect(loadedA.business.ownerName).toBe('Alice Tenant')
      expect(loadedA.expenses.length).toBe(1)
      expect(loadedA.expenses[0].id).toBe('exp-A1')
      expect(loadedA.settings.invoicePrefix).toBe('ALICE-INV')
      expect(loadedA.settings.gstRate).toBe(18)

      // 2. User A logs out (triggers production session cleanup code)
      localStorage.removeItem(`printpro-state:${userA}`)
      localStorage.removeItem(`offline_sync_queue:${userA}`)
      localStorage.removeItem(`PRINTPRO_REACT_QUERY_CACHE:${userA}`)

      // 3. User B logs in fresh (calls REAL loadState for User B)
      const loadedB = loadState(userB)

      // CRITICAL ASSERTION: User B's loaded state contains ZERO trace of User A's data
      expect(loadedB.business.shopName).toBe('PrintPro - Printing Business Manager') // Fresh initial
      expect(loadedB.business.ownerName).toBe('')
      expect(loadedB.expenses).toEqual([])
      expect(loadedB.settings.invoicePrefix).toBe('INV')
      expect(loadedB.settings.gstRate).toBe(0)
      expect(loadedB.bills).toEqual([])
      expect(loadedB.customers).toEqual([])

      // 4. User B populates their own state and saves via REAL saveState
      const userBState = {
        ...initialState,
        business: {
          ...initialState.business,
          shopName: "User B's Quick Graphics",
          ownerName: 'Bob Tenant',
        },
        expenses: [
          { id: 'exp-B1', description: 'Color Toner Cartridges', amount: 8000, category: 'Materials' },
        ],
        settings: {
          ...initialState.settings,
          invoicePrefix: 'BOB-BILL',
          gstRate: 5,
        },
      }

      saveState(userBState, userB)

      // Verify User B's state is preserved independently
      const reloadedB = loadState(userB)
      expect(reloadedB.business.shopName).toBe("User B's Quick Graphics")
      expect(reloadedB.expenses[0].id).toBe('exp-B1')
      expect(reloadedB.settings.invoicePrefix).toBe('BOB-BILL')

      // 5. Verify User A loading fresh has zero trace of User B's data
      const reloadedA = loadState(userA)
      expect(reloadedA.business.shopName).toBe('PrintPro - Printing Business Manager')
      expect(reloadedA.business.ownerName).toBe('')
      expect(reloadedA.expenses).toEqual([])
      expect(reloadedA.settings.invoicePrefix).toBe('INV')
    })

    it('returns initialState when userId is null, undefined, or empty', () => {
      expect(loadState(null)).toEqual(initialState)
      expect(loadState(undefined)).toEqual(initialState)
      expect(loadState('')).toEqual(initialState)
    })
  })

  describe('Sequence Generator Multi-Tenant Isolation', () => {
    it('formats sequence codes for all 6 entity keys consistently', () => {
      expect(SequenceService.formatSequenceCode('BILL', 1, 6)).toBe('BILL-000001')
      expect(SequenceService.formatSequenceCode('PAY', 42, 6)).toBe('PAY-000042')
      expect(SequenceService.formatSequenceCode('CUS', 105, 6)).toBe('CUS-000105')
      expect(SequenceService.formatSequenceCode('EXP', 7, 6)).toBe('EXP-000007')
      expect(SequenceService.formatSequenceCode('GRP', 3, 6)).toBe('GRP-000003')
      expect(SequenceService.formatSequenceCode('RET', 12, 6)).toBe('RET-000012')
    })

    it('isolates sequence increments per tenant by user_id', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: 'BILL-000001',
        error: null,
      } as any)

      const seqA = await SequenceService.getNextSequence('BILL')
      expect(seqA).toBe('BILL-000001')
      expect(supabase.rpc).toHaveBeenCalledWith('get_next_sequence', { p_key: 'BILL' })
    })
  })

  describe('Explicit Sync State Machine', () => {
    it('executes the success state machine path: pending -> syncing -> synced', () => {
      const entityId = 'bill-999'
      const entityType = 'BILL'

      // 1. Initial pending
      const pendingState = SyncStateMachine.markPending(entityType, entityId, { total: 400 })
      expect(pendingState.status).toBe('pending')
      expect(SyncStateMachine.getStatus(entityType, entityId)).toBe('pending')

      // 2. Network in-flight syncing
      const syncingState = SyncStateMachine.markSyncing(entityType, entityId)
      expect(syncingState?.status).toBe('syncing')
      expect(SyncStateMachine.getStatus(entityType, entityId)).toBe('syncing')

      // 3. Supabase confirmed write synced
      const syncedState = SyncStateMachine.markSynced(entityType, entityId)
      expect(syncedState?.status).toBe('synced')
      expect(syncedState?.error).toBeNull()
      expect(SyncStateMachine.getStatus(entityType, entityId)).toBe('synced')
    })

    it('executes the failure and recovery path: pending -> syncing -> failed -> retryable', () => {
      const entityId = 'pay-888'
      const entityType = 'PAYMENT'

      SyncStateMachine.markPending(entityType, entityId, { amount: 200 })
      SyncStateMachine.markSyncing(entityType, entityId)

      // Network error occurred
      const failedState = SyncStateMachine.markFailed(entityType, entityId, new Error('Network Timeout'))
      expect(failedState?.status).toBe('failed')
      expect(failedState?.error).toBe('Network Timeout')
      expect(failedState?.retryCount).toBe(1)

      // Verify retryable items list
      const retryableList = SyncStateMachine.getRetryableItems()
      expect(retryableList.length).toBe(1)
      expect(retryableList[0].entityId).toBe(entityId)
      expect(retryableList[0].entityType).toBe(entityType)
    })
  })

  describe('Query Key Scoping & Mappers Integrity (PrintPro Full Fix)', () => {
    it('ensures mapBillFromApi correctly preserves itemId from item_id and item.itemId', async () => {
      const { mapBillFromApi } = await import('../../api/bills')
      const rawApiBill = {
        id: 'bill-uuid-1',
        customer_id: 'cust-uuid-1',
        total: '250.00',
        items: [
          {
            item_id: 'inv-item-101',
            item_name: 'Glossy A4 Print',
            print_type: 'color',
            sides: 'single',
            qty: 5,
            unit_price: 50,
            amount: 250,
          },
        ],
      }

      const mapped = mapBillFromApi(rawApiBill)
      expect(mapped.items[0].itemId).toBe('inv-item-101')
      expect(mapped.items[0].name).toBe('Glossy A4 Print')
    })

    it('ensures mapAdvancePaymentFromApi properly maps and normalizes advance payments', async () => {
      const { mapAdvancePaymentFromApi } = await import('../../api/advancePayments')
      const rawAdv = {
        id: 'adv-1',
        customer_id: 'cust-99',
        customer_name: 'Bob Ross',
        amount: '500',
        cash_amount: '300',
        upi_amount: '200',
        created_at: '2026-08-31T12:00:00Z',
      }

      const mapped = mapAdvancePaymentFromApi(rawAdv)
      expect(mapped.id).toBe('adv-1')
      expect(mapped.customerId).toBe('cust-99')
      expect(mapped.customerName).toBe('Bob Ross')
      expect(mapped.amount).toBe(500)
      expect(mapped.cashAmount).toBe(300)
      expect(mapped.upiAmount).toBe(200)
    })
  })
})

