import { createServerClient } from '@supabase/ssr';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

const DEFAULT_ADMIN_PIN = '1234';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
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
      const valid = safeEqual(pin, DEFAULT_ADMIN_PIN);
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

    let query = supabase.from('settings').select('value').eq('key', 'security');
    if (user?.id) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }
    const { data: rows } = await query.limit(1);
    const storedValue = rows?.[0]?.value as { super_admin_pin?: string } | undefined;
    const expectedPin = (storedValue?.super_admin_pin || DEFAULT_ADMIN_PIN).trim();

    const valid = safeEqual(pin, expectedPin);
    return NextResponse.json({ valid }, { status: valid ? 200 : 403 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to verify PIN';
    return NextResponse.json({ valid: false, error: errorMsg }, { status: 500 });
  }
}

