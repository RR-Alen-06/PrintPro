import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const pathname = request.nextUrl.pathname;
  // Only OAuth (Google / GitHub) is supported: /login and the /auth/callback handler.
  const isPublicAuthRoute = pathname === '/login' || pathname.startsWith('/auth/');

  const isProd = process.env.NODE_ENV === 'production';

  // If Supabase credentials are missing or placeholder:
  // fail closed in production; permit local dev/test fallback outside production.
  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl.includes('placeholder') ||
    supabaseUrl === 'https://your-supabase-project.supabase.co'
  ) {
    if (isProd && !isPublicAuthRoute) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication service is not configured.' },
          { status: 503 }
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // If on a public auth route with an OAuth code param (e.g. /auth/callback?code=...), let it be exchanged
  const hasCode = request.nextUrl.searchParams.has('code');
  if (isPublicAuthRoute && hasCode) {
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

    // Authenticated user accessing /login -> redirect to destination (same-origin paths only)
    if (user && pathname === '/login' && !hasCode) {
      const nextParam = request.nextUrl.searchParams.get('next') || '/';
      const isSafePath =
        nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.startsWith('/\\');
      const target = new URL(isSafePath ? nextParam : '/', request.nextUrl.origin);
      return NextResponse.redirect(
        target.origin === request.nextUrl.origin ? target : new URL('/', request.nextUrl.origin)
      );
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
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ico|css|js|webmanifest)$).*)',
  ],
};
