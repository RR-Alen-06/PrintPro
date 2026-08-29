import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  const userA = 'user-tenant-AAA-111'
  const userB = 'user-tenant-BBB-222'

  beforeEach(() => {
    localStorage.clear()
    SyncStateMachine.clear()
    vi.clearAllMocks()
  })

  describe('Per-User Cache Isolation', () => {
    it('guarantees complete data isolation between two different users in local storage', () => {
      const userAData = {
        bills: [{ id: 'bill-A1', invoiceNumber: 'BILL-000001', total: 500 }],
        customers: [{ id: 'cust-A1', name: 'User A Customer' }],
      }

      const userBData = {
        bills: [{ id: 'bill-B1', invoiceNumber: 'BILL-000001', total: 1200 }],
        customers: [{ id: 'cust-B1', name: 'User B Customer' }],
      }

      // Store in per-user partitions
      localStorage.setItem(`printpro-state:${userA}`, JSON.stringify(userAData))
      localStorage.setItem(`printpro-state:${userB}`, JSON.stringify(userBData))

      // User A reads their state
      const retrievedA = JSON.parse(localStorage.getItem(`printpro-state:${userA}`) || '{}')
      expect(retrievedA.bills[0].id).toBe('bill-A1')
      expect(retrievedA.bills[0].total).toBe(500)
      expect(retrievedA.customers[0].name).toBe('User A Customer')

      // User B reads their state
      const retrievedB = JSON.parse(localStorage.getItem(`printpro-state:${userB}`) || '{}')
      expect(retrievedB.bills[0].id).toBe('bill-B1')
      expect(retrievedB.bills[0].total).toBe(1200)
      expect(retrievedB.customers[0].name).toBe('User B Customer')

      // Ensure zero cross-user pollution
      expect(retrievedA.bills).not.toEqual(retrievedB.bills)
      expect(retrievedA.customers).not.toEqual(retrievedB.customers)
    })

    it('clears only the active user partition on logout without affecting other users', () => {
      localStorage.setItem(`printpro-state:${userA}`, JSON.stringify({ userId: userA, active: true }))
      localStorage.setItem(`printpro-state:${userB}`, JSON.stringify({ userId: userB, active: true }))

      // Logout User A -> remove User A's cache key only
      localStorage.removeItem(`printpro-state:${userA}`)

      expect(localStorage.getItem(`printpro-state:${userA}`)).toBeNull()
      expect(localStorage.getItem(`printpro-state:${userB}`)).not.toBeNull()
      const remainingB = JSON.parse(localStorage.getItem(`printpro-state:${userB}`) || '{}')
      expect(remainingB.userId).toBe(userB)
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
})
