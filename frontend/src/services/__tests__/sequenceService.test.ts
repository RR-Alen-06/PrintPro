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

  it('peeks upcoming sequence code correctly from existing items', () => {
    const existingBills = [
      { invoiceNumber: 'INV-000001' },
      { invoiceNumber: 'INV-000005' },
      { invoiceNumber: 'INV-000002' },
    ]

    const peeked = SequenceService.peekNextSequence('BILL', existingBills, 'INV', 6)
    expect(peeked).toBe('INV-000006')

    const customPeeked = SequenceService.peekNextSequence('CUSTOMER', [{ customerCode: 'CUS-0010' }], 'CUS', 4)
    expect(customPeeked).toBe('CUS-0011')

    const emptyPeeked = SequenceService.peekNextSequence('EXPENSE', [], 'EXP', 6)
    expect(emptyPeeked).toBe('EXP-000001')
  })

  it('resolves collision-safe sequence numbers with getNextSequenceSafe', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: 'INV-000003',
      error: null,
    } as any)

    // Existing local items already have INV-000007 (e.g. created offline)
    const existing = [{ invoiceNumber: 'INV-000007' }]
    const safeCode = await SequenceService.getNextSequenceSafe('BILL', existing, 'INV', 6)
    // Should choose the higher number to prevent duplicate key collisions
    expect(safeCode).toBe('INV-000008')
  })

  it('formats display codes consistently across entity types', () => {
    expect(SequenceService.formatDisplayCode('bill', { invoiceNumber: 'INV-000042' })).toBe('INV-000042')
    expect(SequenceService.formatDisplayCode('customer', { customerCode: 'CUS-000123' })).toBe('CUS-000123')
    expect(SequenceService.formatDisplayCode('inventory', { id: 5 }, 'ITM', 6)).toBe('ITM-000005')
  })
})
