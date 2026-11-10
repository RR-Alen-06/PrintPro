import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * OAuth callback (Google / GitHub) using the PKCE code exchange flow.
 * Email / OTP / magic-link flows are intentionally not supported here.
 */

/**
 * Resolves a post-auth redirect target, restricted to same-origin relative paths.
 * Prevents open redirects such as `?next=//evil.com` or `?next=@evil.com`.
 */
function safeRedirect(next: string | null, origin: string): URL {
  const fallbackUrl = new URL('/', origin);
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallbackUrl;
  }
  try {
    const target = new URL(next, origin);
    return target.origin === origin ? target : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

function loginError(origin: string, message: string) {
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = safeRedirect(searchParams.get('next'), origin);
  const errorParam = searchParams.get('error_description') || searchParams.get('error');

  // Provider denied / cancelled the sign-in.
  if (errorParam) {
    return loginError(origin, errorParam);
  }

  if (!code) {
    return loginError(origin, 'Missing authorization code. Please sign in again.');
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return loginError(origin, 'Supabase environment variables are missing.');
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

  // The session is established only if Supabase validates the code against the
  // PKCE verifier cookie set when the OAuth flow started.
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginError(origin, error.message || 'Authorization code is invalid or has expired.');
  }

  return NextResponse.redirect(redirectTo);
}
