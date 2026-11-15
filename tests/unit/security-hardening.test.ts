import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

const mockGetUser = vi.fn();
const mockSettingsLimit = vi.fn();
const mockRpc = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
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

import { proxy } from '@/proxy';
import { POST as verifyPinPost } from '@/app/api/verify-pin/route';
import { POST as sendEmailPost } from '@/app/api/send-email/route';
import nextConfig from '../../next.config';

describe('Security hardening regression tests', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('SEC-01: proxy does not bypass auth on prefetch requests with spoofed sb- cookies', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const req = new NextRequest('http://localhost/bills', {
      headers: {
        'next-router-prefetch': '1',
        cookie: 'sb-fake-auth-token=spoofed',
      },
    });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it('SEC-01: proxy fails closed in production when Supabase env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const pageReq = new NextRequest('http://localhost/bills');
    const pageRes = await proxy(pageReq);
    expect(pageRes.status).toBe(307);
    expect(pageRes.headers.get('location')).toContain('/login');

    const apiReq = new NextRequest('http://localhost/api/verify-pin');
    const apiRes = await proxy(apiReq);
    expect(apiRes.status).toBe(503);
  });

  it('SEC-02: /api/verify-pin fails closed in production when Supabase is unconfigured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const req = new NextRequest('http://localhost/api/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin: '1234' }),
    });
    const res = await verifyPinPost(req);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      valid: false,
      error: 'Authentication service is not configured.',
    });
  });

  it('SEC-03: /api/send-email rejects malformed emails and oversized payloads', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-sec-03' } }, error: null });

    const badEmailReq = new NextRequest('http://localhost/api/send-email', {
      method: 'POST',
      body: JSON.stringify({ to_email: 'not-an-email' }),
    });
    const badEmailRes = await sendEmailPost(badEmailReq);
    expect(badEmailRes.status).toBe(400);

    const bigBodyReq = new NextRequest('http://localhost/api/send-email', {
      method: 'POST',
      body: JSON.stringify({
        to_email: 'valid@example.com',
        message_html: 'x'.repeat(100_001),
      }),
    });
    const bigBodyRes = await sendEmailPost(bigBodyReq);
    expect(bigBodyRes.status).toBe(400);
  });

  it('SEC-03: /api/send-email enforces per-user rate limiting', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    delete process.env.EMAILJS_SERVICE_ID;
    delete process.env.EMAILJS_TEMPLATE_ID;
    delete process.env.EMAILJS_PUBLIC_KEY;
    mockGetUser.mockResolvedValue({ data: { user: { id: 'rate-limit-user' } }, error: null });

    for (let i = 0; i < 20; i++) {
      const req = new NextRequest('http://localhost/api/send-email', {
        method: 'POST',
        body: JSON.stringify({ to_email: 'valid@example.com' }),
      });
      const res = await sendEmailPost(req);
      expect(res.status).toBe(400); // passes rate limit, fails missing EmailJS creds
    }

    const blockedReq = new NextRequest('http://localhost/api/send-email', {
      method: 'POST',
      body: JSON.stringify({ to_email: 'valid@example.com' }),
    });
    const blockedRes = await sendEmailPost(blockedReq);
    expect(blockedRes.status).toBe(429);
  });

  it('SEC-04: next.config.ts defines required security headers', async () => {
    const headerRules = await nextConfig.headers?.();
    expect(headerRules).toBeDefined();
    const rootHeaders = headerRules?.[0]?.headers ?? [];
    const headerMap = new Map(rootHeaders.map((h) => [h.key, h.value]));

    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headerMap.get('X-Frame-Options')).toBe('DENY');
    expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headerMap.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(headerMap.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('SEC-08: /api/verify-pin verifies scrypt$ and $2b$ hashed PINs', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    const salt = '0123456789abcdef0123456789abcdef';
    const hash = crypto.scryptSync('5678', salt, 64).toString('hex');
    const encoded = `scrypt$${salt}$${hash}`;

    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'pin-scrypt-user' } }, error: null });
    mockSettingsLimit.mockResolvedValueOnce({ data: [{ value: { super_admin_pin: encoded } }] });

    const scryptRes = await verifyPinPost(
      new NextRequest('http://localhost/api/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin: '5678' }),
      })
    );
    expect(scryptRes.status).toBe(200);
    expect(await scryptRes.json()).toEqual({ valid: true });

    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'pin-bcrypt-user' } }, error: null });
    mockSettingsLimit.mockResolvedValueOnce({
      data: [{ value: { super_admin_pin: '$2b$10$mockedbcrypthashvalue1234567890' } }],
    });
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === 'verify_admin_pin') return { data: true, error: null };
      return { data: null, error: null };
    });

    const bcryptRes = await verifyPinPost(
      new NextRequest('http://localhost/api/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin: '4321' }),
      })
    );
    expect(bcryptRes.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('verify_admin_pin', { p_pin: '4321' });
  });

  it('SEC-09: /api/verify-pin honors distributed Supabase rate limit RPC', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'dist-limit-user' } }, error: null });
    mockRpc.mockResolvedValueOnce({
      data: { blocked: true, retry_after_seconds: 120 },
      error: null,
    });

    const res = await verifyPinPost(
      new NextRequest('http://localhost/api/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin: '1234' }),
      })
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('120');
  });
});
