import { describe, it, expect, vi } from 'vitest'
import { SequenceService } from '../sequenceService'
import { supabase } from '../../lib/supabase'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
  },
}))

describe('SequenceService', () => {
  it('calls get_next_sequence RPC and returns generated sequence code', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: 'BILL-000042',
      error: null,
    } as any)

    const code = await SequenceService.getNextSequence('BILL')
    expect(code).toBe('BILL-000042')
    expect(supabase.rpc).toHaveBeenCalledWith('get_next_sequence', { p_key: 'BILL' })
  })

  it('falls back gracefully to offline formatted code when RPC fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'RPC not found' },
    } as any)

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    } as any)

    const code = await SequenceService.getNextSequence('PAY')
    expect(code).toMatch(/^PAY-\d+$/)
  })
})
