import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUser = vi.fn();
const mockSettingsLimit = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ limit: mockSettingsLimit })),
          is: vi.fn(() => ({ limit: mockSettingsLimit })),
        })),
      })),
    })),
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

import { POST as verifyPinPost } from '@/app/api/verify-pin/route';
import { POST as sendEmailPost } from '@/app/api/send-email/route';

describe('API route handlers', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('POST /api/verify-pin rejects empty PIN with 400', async () => {
    const req = new NextRequest('http://localhost/api/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '' }),
    });
    const res = await verifyPinPost(req);
    expect(res.status).toBe(400);
  });

  it('POST /api/verify-pin validates default PIN when Supabase is unconfigured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const okReq = new NextRequest('http://localhost/api/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '1234' }),
    });
    const okRes = await verifyPinPost(okReq);
    expect(okRes.status).toBe(200);
    expect(await okRes.json()).toEqual({ valid: true });

    const badReq = new NextRequest('http://localhost/api/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '9999' }),
    });
    const badRes = await verifyPinPost(badReq);
    expect(badRes.status).toBe(403);
    expect(await badRes.json()).toEqual({ valid: false });
  });

  it('POST /api/send-email rejects unauthenticated requests when Supabase is unconfigured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const req = new NextRequest('http://localhost/api/send-email', {
      method: 'POST',
      body: JSON.stringify({ to_email: 'user@example.com' }),
    });
    const res = await sendEmailPost(req);
    expect(res.status).toBe(401);
  });

  it('POST /api/send-email rejects missing recipient email when authenticated', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });

    const req = new NextRequest('http://localhost/api/send-email', {
      method: 'POST',
      body: JSON.stringify({ to_email: '' }),
    });
    const res = await sendEmailPost(req);
    expect(res.status).toBe(400);
  });
});

