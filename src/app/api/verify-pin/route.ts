import { createServerClient } from '@supabase/ssr';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, clearRateLimit } from '@/lib/services/rateLimit';

const DEFAULT_ADMIN_PIN = '1234';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SECONDS = 15 * 60;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyScryptPin(pin: string, encoded: string): boolean {
  const parts = encoded.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;
  const expectedBuf = Buffer.from(hashHex, 'hex');
  const derivedBuf = crypto.scryptSync(pin, saltHex, expectedBuf.length);
  if (derivedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, expectedBuf);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

    if (!pin) {
      return NextResponse.json({ valid: false, error: 'PIN is required.' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const isSupabaseConfigured =
      Boolean(supabaseUrl && supabaseKey) &&
      !supabaseUrl!.includes('placeholder') &&
      supabaseUrl !== 'https://your-supabase-project.supabase.co';

    if (!isSupabaseConfigured) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { valid: false, error: 'Authentication service is not configured.' },
          { status: 503 }
        );
      }
      const rateKey = `verify-pin:ip:${getClientIp(request)}`;
      const { blocked, retryAfterSeconds } = await checkRateLimit(
        null,
        rateKey,
        MAX_FAILED_ATTEMPTS,
        LOCKOUT_WINDOW_SECONDS,
        false
      );
      if (blocked) {
        return NextResponse.json(
          { valid: false, error: 'Too many failed PIN attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
        );
      }
      const valid = safeEqual(pin, DEFAULT_ADMIN_PIN);
      if (valid) {
        await clearRateLimit(null, rateKey);
      } else {
        await checkRateLimit(null, rateKey, MAX_FAILED_ATTEMPTS, LOCKOUT_WINDOW_SECONDS, true);
      }
      return NextResponse.json({ valid }, { status: valid ? 200 : 403 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Readonly in some contexts
          }
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { valid: false, error: 'Unauthorized: You must be signed in.' },
        { status: 401 }
      );
    }

    const rateKey = `verify-pin:user:${user.id}`;
    const { blocked, retryAfterSeconds } = await checkRateLimit(
      supabase,
      rateKey,
      MAX_FAILED_ATTEMPTS,
      LOCKOUT_WINDOW_SECONDS,
      false
    );
    if (blocked) {
      return NextResponse.json(
        { valid: false, error: 'Too many failed PIN attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    let query = supabase.from('settings').select('value').eq('key', 'security');
    if (user?.id) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }
    const { data: rows } = await query.limit(1);
    const storedValue = rows?.[0]?.value as { super_admin_pin?: string } | undefined;
    const storedPin = (storedValue?.super_admin_pin || DEFAULT_ADMIN_PIN).trim();

    let valid = false;
    if (storedPin.startsWith('scrypt$')) {
      valid = verifyScryptPin(pin, storedPin);
    } else if (storedPin.startsWith('$2')) {
      const { data: rpcValid, error: rpcErr } = await supabase.rpc('verify_admin_pin', { p_pin: pin });
      valid = !rpcErr && rpcValid === true;
    } else {
      valid = safeEqual(pin, storedPin);
    }

    if (valid) {
      await clearRateLimit(supabase, rateKey);
    } else {
      await checkRateLimit(supabase, rateKey, MAX_FAILED_ATTEMPTS, LOCKOUT_WINDOW_SECONDS, true);
    }
    return NextResponse.json({ valid }, { status: valid ? 200 : 403 });
  } catch (err: unknown) {
    console.error('verify-pin error:', err);
    return NextResponse.json({ valid: false, error: 'Failed to verify PIN.' }, { status: 500 });
  }
}

