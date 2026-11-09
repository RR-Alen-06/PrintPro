import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Bypass authentication check during testing
  if (process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') {
    return supabaseResponse;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const pathname = request.nextUrl.pathname;
  const isPublicAuthRoute =
    pathname === '/login' ||
    pathname.startsWith('/auth/') ||
    pathname === '/reset-password' ||
    pathname === '/verify-email';

  // If Supabase credentials are missing or placeholder, permit access
  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl.includes('placeholder') ||
    supabaseUrl === 'https://your-supabase-project.supabase.co'
  ) {
    return supabaseResponse;
  }

  // If on a public auth route with auth code/token params (e.g. /login?code=...), let client exchange it
  const hasCodeOrToken = request.nextUrl.searchParams.has('code') || request.nextUrl.searchParams.has('token_hash');
  if (isPublicAuthRoute && hasCodeOrToken) {
    return supabaseResponse;
  }

  // Check if any auth cookies exist in request
  const allCookies = request.cookies.getAll();
  const hasAuthToken = allCookies.some(
    (c) => c.name.includes('-auth-token') || c.name.includes('supabase') || c.name.startsWith('sb-')
  );

  // If on a public auth route and no auth token present, serve immediately
  if (isPublicAuthRoute && !hasAuthToken) {
    return supabaseResponse;
  }

  // Fast path for prefetch requests: skip remote getUser() roundtrip if auth cookie is present
  const isPrefetch = request.headers.get('next-router-prefetch') === '1' || request.headers.get('purpose') === 'prefetch';
  if (isPrefetch && hasAuthToken) {
    return supabaseResponse;
  }

  // If on protected page and no auth token present, redirect to login immediately
  if (!isPublicAuthRoute && !hasAuthToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + (request.nextUrl.search || ''));
    return NextResponse.redirect(url);
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Unauthenticated user attempting to access protected route
    if (!user && !isPublicAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname + (request.nextUrl.search || ''));
      return NextResponse.redirect(url);
    }

    // Determine verification status
    // Existing accounts with email_confirmed_at / confirmed_at remain fully verified and usable
    const isVerified = Boolean(
      user && (user.email_confirmed_at || user.confirmed_at || user.app_metadata?.provider !== 'email')
    );

    // Unverified user attempting to access protected route -> redirect to /verify-email
    if (user && !isVerified && !isPublicAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/verify-email';
      if (user.email) {
        url.searchParams.set('email', user.email);
      }
      return NextResponse.redirect(url);
    }

    // Unverified user on /login -> redirect to /verify-email
    if (user && !isVerified && pathname === '/login' && !hasCodeOrToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/verify-email';
      if (user.email) {
        url.searchParams.set('email', user.email);
      }
      return NextResponse.redirect(url);
    }

    // Authenticated AND verified user accessing /login or /verify-email -> redirect to destination
    if (user && isVerified && (pathname === '/login' || pathname === '/verify-email') && !hasCodeOrToken) {
      const nextParam = request.nextUrl.searchParams.get('next') || '/';
      const url = request.nextUrl.clone();
      url.pathname = nextParam.startsWith('/') ? nextParam : '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
  } catch {
    if (!isPublicAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ico|css|js)$).*)',
  ],
};
