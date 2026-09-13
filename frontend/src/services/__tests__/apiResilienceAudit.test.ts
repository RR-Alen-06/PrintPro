import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDeletedPayments } from '../../api/payments'
import { supabase } from '../../lib/supabase'

describe('API Resilience & Deleted Payments Audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('queries Supabase payments with payment_type.eq.refund,total_paid.lt.0 and returns mapped data', async () => {
    const mockPayments = [
      { id: 1, total_paid: -200, payment_type: 'refund', notes: 'Refund for bill 1' },
      { id: 2, total_paid: -50, payment_type: 'refund', notes: 'Partial reversal' }
    ]

    const selectMock = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockPayments, error: null })
      })
    })

    vi.spyOn(supabase, 'from').mockReturnValue({
      select: selectMock
    } as any)

    const res = await getDeletedPayments()
    expect(res.data.data.length).toBe(2)
    expect(res.data.data[0].totalPaid).toBe(-200)
  })

  it('falls back to in-memory filter if Supabase .or filter query errors out', async () => {
    const allMockPayments = [
      { id: 1, total_paid: 1000, payment_type: 'full' },
      { id: 2, total_paid: -300, payment_type: 'refund', notes: 'Refund' }
    ]

    let callCount = 0
    const selectMock = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'column does not exist' } })
          })
        }
      }
      return {
        order: vi.fn().mockResolvedValue({ data: allMockPayments, error: null })
      }
    })

    vi.spyOn(supabase, 'from').mockReturnValue({
      select: selectMock
    } as any)

    const res = await getDeletedPayments()
    expect(res.data.data.length).toBe(1)
    expect(res.data.data[0].totalPaid).toBe(-300)
  })

  it('gracefully returns empty array on network failure without crashing UI', async () => {
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          order: vi.fn().mockRejectedValue(new Error('Network offline'))
        })
      })
    } as any)

    const res = await getDeletedPayments()
    expect(res).toEqual({ data: { data: [] } })
  })
})
