import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: false,
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { ApiService } from '@/lib/services/api';

describe('ApiService pure & validation helpers', () => {
  it('calculates rounding accurately for all methods', () => {
    expect(ApiService.calculateRounding(100.4, 'Standard')).toEqual({
      roundedTotal: 100,
      roundingAdjustment: -0.4,
    });
    expect(ApiService.calculateRounding(100.4, 'Round Up')).toEqual({
      roundedTotal: 101,
      roundingAdjustment: 0.6,
    });
    expect(ApiService.calculateRounding(100.9, 'Round Down')).toEqual({
      roundedTotal: 100,
      roundingAdjustment: -0.9,
    });
    expect(ApiService.calculateRounding(100.456, 'None')).toEqual({
      roundedTotal: 100.46,
      roundingAdjustment: 0,
    });
  });

  it('calculates loyalty discount from active rules and fallback settings', () => {
    const discount = ApiService.calculateLoyaltyDiscount(
      25,
      { enabled: true, points_required: 10, discount_value: 5 },
      [
        { id: 'r1', rule_name: 'Tier 1', points_required: 20, discount_amount: 15, enabled: true } as never,
      ]
    );
    expect(discount).toBe(15);

    const fallbackDiscount = ApiService.calculateLoyaltyDiscount(
      20,
      { enabled: true, points_required: 10, discount_value: 5 },
      []
    );
    expect(fallbackDiscount).toBe(10);
  });

  it('sets endDate to end-of-day (23:59:59.999) for date-only custom ranges', () => {
    const { startDate, endDate } = ApiService.getDateRangeBounds('custom', {
      from: '2026-11-01',
      to: '2026-11-13',
    });
    expect(startDate).toBeInstanceOf(Date);
    expect(endDate).toBeInstanceOf(Date);
    expect(endDate!.getHours()).toBe(23);
    expect(endDate!.getMinutes()).toBe(59);
    expect(endDate!.getSeconds()).toBe(59);
    expect(endDate!.getMilliseconds()).toBe(999);
  });

  it('verifies default admin PIN when Supabase is not configured', async () => {
    expect(await ApiService.verifyAdminPin('1234')).toBe(true);
    expect(await ApiService.verifyAdminPin('0000')).toBe(false);
    expect(await ApiService.verifyAdminPin('')).toBe(false);
  });
});

