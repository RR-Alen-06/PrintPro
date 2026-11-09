import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as
    | 'signup'
    | 'recovery'
    | 'invite'
    | 'email'
    | 'email_change'
    | 'magiclink'
    | null;
  const next = searchParams.get('next') ?? (type === 'recovery' ? '/reset-password' : '/');
  const errorParam = searchParams.get('error_description') || searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorParam)}`);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Supabase environment variables are missing.')}`
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
          // Handled via proxy / middleware
        }
      },
    },
  });

  // Flow 1: Token hash verification (OTP / Email Confirmation / Invite / Signup)
  if (token_hash) {
    const targetType = type || 'signup';
    let { error } = await supabase.auth.verifyOtp({
      type: targetType,
      token_hash,
    });

    if (error && targetType !== 'email') {
      const fallback = await supabase.auth.verifyOtp({
        type: 'email',
        token_hash,
      });
      if (!fallback.error) {
        error = null;
      }
    }

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(
      `${origin}/auth/confirm?error=${encodeURIComponent(
        error.message || 'Verification link is invalid, expired (links expire in 24 hours), or has already been used.'
      )}&type=${encodeURIComponent(type || 'signup')}`
    );
  }

  // Flow 2: PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/auth/confirm?error=${encodeURIComponent(error.message || 'Authorization code is invalid or has expired.')}`
    );
  }

  // Fallback: If no query params are present (e.g. Supabase redirected with hash fragments #access_token=...
  // which are client-side only), hand off to /auth/confirm client component.
  const confirmUrl = new URL('/auth/confirm', origin);
  if (type) confirmUrl.searchParams.set('type', type);
  if (next) confirmUrl.searchParams.set('next', next);
  return NextResponse.redirect(confirmUrl.toString());
}
