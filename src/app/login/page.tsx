'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import {
  Printer,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Sparkles
} from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error') || searchParams.get('error_description');
  const nextParam = searchParams.get('next') || '/';
  const targetDestination = nextParam.startsWith('/') ? nextParam : '/';

  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null);
  const [errorMsg, setErrorMsg] = useState(errorParam || '');
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkCurrentSession() {
      if (!isSupabaseConfigured) {
        setCheckingAuth(false);
        return;
      }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkCurrentSession();
  }, []);

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase is not configured. Please check your environment configuration.');
      return;
    }

    try {
      setLoadingProvider(provider);
      setErrorMsg('');

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(targetDestination)}`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoadingProvider(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to sign in with ${provider}`;
      setErrorMsg(message);
      setLoadingProvider(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium text-slate-500">Checking session...</p>
      </div>
    );
  }

  // If already logged in, show session state card with link to destination
  if (user) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex p-3 rounded-2xl bg-emerald-50 text-emerald-600 mb-4 ring-1 ring-emerald-500/20">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">You are signed in</h2>
        <p className="text-sm font-medium text-slate-500 mb-6">{user.email || user.user_metadata?.full_name || 'Authenticated User'}</p>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl mb-6 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Workspace</div>
          <div className="text-sm font-bold text-slate-800 mt-0.5">PrintPro POS & Billing Console</div>
        </div>

        <button
          onClick={() => {
            router.push(targetDestination);
          }}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-sm shadow-blue-500/20 transition-all mb-3 cursor-pointer"
        >
          Continue to Application <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={handleSignOut}
          className="w-full py-2.5 px-4 rounded-xl text-rose-600 hover:bg-rose-50 font-medium text-sm transition-colors border border-rose-200/60 cursor-pointer"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sign in to your store</h2>
        <p className="text-xs text-slate-500 mt-1">
          Access billing POS, customer ledgers, inventory, and cash registers.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-medium animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMsg}</div>
        </div>
      )}

      {/* OAuth Action Buttons */}
      <div className="space-y-3">
        {/* Google Sign In */}
        <button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => handleOAuthLogin('google')}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer group"
        >
          {loadingProvider === 'google' ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.6c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.88c2.27-2.09 3.66-5.18 3.66-8.48z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.02c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.12C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.59H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.41l4.04-3.12z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.59l4.04 3.12c.95-2.83 3.6-4.96 6.72-4.96z"
              />
            </svg>
          )}
          <span>{loadingProvider === 'google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>

        {/* GitHub Sign In */}
        <button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => handleOAuthLogin('github')}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-900 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-sm shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer group"
        >
          {loadingProvider === 'github' ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          )}
          <span>{loadingProvider === 'github' ? 'Connecting to GitHub...' : 'Continue with GitHub'}</span>
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" /> PrintPro Enterprise
        </span>
        <span>OAuth 2.0 Only</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/50 p-7 sm:p-8 relative overflow-hidden">
        {/* Color bar */}
        <div className="absolute top-0 left-0 right-0 flex h-1">
          <span className="bg-blue-500 flex-1" />
          <span className="bg-red-500 flex-1" />
          <span className="bg-amber-400 flex-1" />
          <span className="bg-emerald-500 flex-1" />
        </div>

        {/* Logo and Brand */}
        <div className="flex flex-col items-center mb-6 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3 shadow-xs">
            <Printer className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">PrintPro</h1>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-full mt-1.5">
            Store Workspace
          </span>
        </div>

        <Suspense fallback={
          <div className="flex flex-col items-center justify-center p-8 text-center min-h-[220px]">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600 mb-2" />
            <p className="text-xs text-slate-400 font-medium">Loading authentication...</p>
          </div>
        }>
          <LoginContent />
        </Suspense>
      </div>
    </div>
  );
}
