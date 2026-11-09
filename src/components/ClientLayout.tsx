'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/verify-email' ||
    pathname.startsWith('/auth/') ||
    pathname === '/reset-password';

  const [isVerifying, setIsVerifying] = useState(!isAuthPage && isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || isAuthPage) {
      setIsVerifying(false);
      return;
    }

    let isMounted = true;

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && isMounted) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
      } catch (err) {
        console.error('Session verification error:', err);
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    }

    checkAuth();

    // Listen to real-time auth state changes across tabs / devices
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || (!session && !isAuthPage)) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, isAuthPage, router]);

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100">
        {children}
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium">Verifying store session...</p>
      </div>
    );
  }

  return (
    <>
      <Navigation />
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </>
  );
}
