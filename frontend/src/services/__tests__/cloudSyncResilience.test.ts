import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProfile, updateProfile } from '../../api/profile'
import { getAdvancePayments } from '../../api/advancePayments'

vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-123' } },
        }),
      },
      from: vi.fn(),
    },
    logSupabaseError: vi.fn(),
  }
})

vi.mock('../../api/index', () => {
  return {
    default: {
      get: vi.fn().mockRejectedValue(new Error('Backend endpoint not reached')),
      post: vi.fn(),
      delete: vi.fn(),
    },
  }
})

import { supabase } from '../../lib/supabase'

describe('Cloud Sync & Business Profile Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProfile()', () => {
    it('gracefully provisions a default profile when .maybeSingle() returns null (0 rows)', async () => {
      // Mock initial select returning null
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })

      // Mock insert returning provisioned row
      const insertMaybeSingleMock = vi.fn().mockResolvedValue({
        data: {
          id: 1,
          user_id: 'test-user-123',
          shop_name: '',
          owner_name: '',
          phone: '',
          address: '',
          gstin: '',
          upi_id: '',
        },
        error: null,
      })
      const insertSelectMock = vi.fn().mockReturnValue({ maybeSingle: insertMaybeSingleMock })
      const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'business_profile') {
          return {
            select: selectMock,
            insert: insertMock,
          } as any
        }
        return {} as any
      })

      const res = await getProfile()
      expect(res.data.data).toBeDefined()
      expect(res.data.data.user_id).toBe('test-user-123')
      expect(insertMock).toHaveBeenCalled()
    })

    it('handles PGRST116 error gracefully and returns safe default without throwing', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
      })
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      const insertMaybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Insert failed' },
      })
      const insertSelectMock = vi.fn().mockReturnValue({ maybeSingle: insertMaybeSingleMock })
      const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'business_profile') {
          return {
            select: selectMock,
            insert: insertMock,
          } as any
        }
        return {} as any
      })

      const res = await getProfile()
      expect(res.data.data).toBeDefined()
      expect(res.data.data.shop_name).toBe('')
    })
  })

  describe('updateProfile()', () => {
    it('upserts when update returns no rows', async () => {
      const updateMaybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
      const updateSelectMock = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingleMock })
      const updateMock = vi.fn().mockReturnValue({ select: updateSelectMock })

      const upsertMaybeSingleMock = vi.fn().mockResolvedValue({
        data: { shop_name: 'Super Print Shop' },
        error: null,
      })
      const upsertSelectMock = vi.fn().mockReturnValue({ maybeSingle: upsertMaybeSingleMock })
      const upsertMock = vi.fn().mockReturnValue({ select: upsertSelectMock })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'business_profile') {
          return {
            update: updateMock,
            upsert: upsertMock,
          } as any
        }
        return {} as any
      })

      const res = await updateProfile({ shop_name: 'Super Print Shop' })
      expect(res.data.data.shop_name).toBe('Super Print Shop')
    })
  })

  describe('getAdvancePayments() fallback', () => {
    it('returns empty array if business_profile row is missing', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
      const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'business_profile') {
          return {
            select: selectMock,
          } as any
        }
        return {} as any
      })

      const res = await getAdvancePayments()
      expect(res.data.data).toEqual([])
    })
  })
})
