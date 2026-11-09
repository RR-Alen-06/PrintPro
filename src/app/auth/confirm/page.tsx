'use client';

import React, { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  LogIn
} from 'lucide-react';
import Link from 'next/link';

type VerifyType = 'signup' | 'recovery' | 'invite' | 'email' | 'email_change' | 'magiclink' | null;

function ConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusTitle, setStatusTitle] = useState('Verifying Authentication...');
  const [statusSubtitle, setStatusSubtitle] = useState('Please wait while we establish your secure session.');
  
  const verificationStarted = useRef(false);

  const getTargetDestination = useCallback((typeParam: VerifyType | string | null, customNext?: string | null) => {
    if (typeParam === 'recovery') {
      return '/reset-password';
    }
    return customNext || '/';
  }, []);

  const handleSuccess = useCallback((dest: string) => {
    setStatus('success');
    setStatusTitle('Verified Successfully!');
    setStatusSubtitle('Your session is authenticated. Redirecting you now...');
    setTimeout(() => {
      router.push(dest);
      router.refresh();
    }, 1200);
  }, [router]);

  const processVerification = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setStatus('error');
      setErrorMessage('Supabase credentials are not configured in this environment.');
      return;
    }

    // 1. Check URL query parameters
    const code = searchParams.get('code');
    const token_hash = searchParams.get('token_hash');
    const urlType = searchParams.get('type') as VerifyType;
    const nextParam = searchParams.get('next');
    const urlError = searchParams.get('error_description') || searchParams.get('error');

    if (urlError) {
      setStatus('error');
      setErrorMessage(decodeURIComponent(urlError));
      return;
    }

    // 2. Check URL hash fragment (implicit token flow: #access_token=...&refresh_token=...&type=...)
    let hashAccessToken: string | null = null;
    let hashRefreshToken: string | null = null;
    let hashType: string | null = null;
    let hashError: string | null = null;

    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);

      hashAccessToken = hashParams.get('access_token');
      hashRefreshToken = hashParams.get('refresh_token');
      hashType = hashParams.get('type');
      hashError = hashParams.get('error_description') || hashParams.get('error');
    }

    if (hashError) {
      setStatus('error');
      setErrorMessage(decodeURIComponent(hashError));
      return;
    }

    const effectiveType = (urlType || hashType || null) as VerifyType;
    const destination = getTargetDestination(effectiveType, nextParam);

    // Flow A: Hash Fragment Access & Refresh Tokens
    if (hashAccessToken) {
      try {
        const { error } = await supabase.auth.setSession({
          access_token: hashAccessToken,
          refresh_token: hashRefreshToken || '',
        });

        if (error) throw error;
        handleSuccess(destination);
        return;
      } catch (err: unknown) {
        setStatus('error');
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Authentication token is invalid or expired. Please request a new link.'
        );
        return;
      }
    }

    // Flow B: Server-compatible Token Hash OTP verification
    if (token_hash) {
      try {
        const verifyType = effectiveType || 'signup';
        let { error } = await supabase.auth.verifyOtp({
          type: verifyType,
          token_hash,
        });

        if (error && verifyType !== 'email') {
          const fallback = await supabase.auth.verifyOtp({
            type: 'email',
            token_hash,
          });
          if (!fallback.error) {
            error = null;
          }
        }

        if (error) throw error;
        handleSuccess(destination);
        return;
      } catch (err: unknown) {
        setStatus('error');
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Confirmation link is invalid, expired (links expire in 24 hours), or has already been used. Please request a new link.'
        );
        return;
      }
    }

    // Flow C: PKCE Code exchange
    if (code) {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        handleSuccess(destination);
        return;
      } catch (err: unknown) {
        setStatus('error');
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Authorization code is invalid or has expired.'
        );
        return;
      }
    }

    // Flow D: Check if a valid session already exists in client
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        handleSuccess(destination);
        return;
      }
    } catch {
      // Ignore session check errors
    }

    // No valid token, hash, or session found
    setStatus('error');
    setErrorMessage(
      'No active verification code or authentication token was found in this link. It may have expired or already been verified.'
    );
  }, [searchParams, getTargetDestination, handleSuccess]);

  useEffect(() => {
    if (verificationStarted.current) return;
    verificationStarted.current = true;

    // Listen for auth state changes (e.g. Supabase JS automatically processing hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        handleSuccess('/reset-password');
      } else if (event === 'SIGNED_IN' && session) {
        const nextParam = searchParams.get('next');
        const urlType = searchParams.get('type');
        handleSuccess(getTargetDestination(urlType, nextParam));
      }
    });

    processVerification();

    return () => {
      subscription.unsubscribe();
    };
  }, [processVerification, handleSuccess, getTargetDestination, searchParams]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden p-8 space-y-6">
        
        {/* Header Badge */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 mb-2 shadow-sm">
            {status === 'verifying' ? (
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            ) : status === 'success' ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-7 h-7 text-rose-600" />
            )}
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {status === 'success'
              ? 'Verification Successful'
              : status === 'error'
              ? 'Verification Failed'
              : statusTitle}
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {status === 'success'
              ? 'Your identity has been authenticated. Redirecting to your dashboard...'
              : status === 'error'
              ? 'We were unable to complete authentication with the provided link.'
              : statusSubtitle}
          </p>
        </div>

        {/* Verifying Spinner Indicator */}
        {status === 'verifying' && (
          <div className="w-full bg-slate-50 border border-slate-200 text-slate-600 font-semibold text-xs py-4 px-4 rounded-xl flex items-center justify-center gap-2.5">
            <Loader2 size={16} className="animate-spin text-blue-600" />
            <span>Establishing secure authentication session...</span>
          </div>
        )}

        {/* Success Alert */}
        {status === 'success' && (
          <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs py-4 px-4 rounded-xl flex items-center justify-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Session verified! Redirecting...</span>
          </div>
        )}

        {/* Error Alert & Solutions */}
        {status === 'error' && (
          <div className="space-y-4">
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-rose-600" />
                  Link Expired or Already Used
                </div>
                <p className="text-[11px] leading-relaxed text-rose-700">{errorMessage}</p>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs text-slate-600">
              <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                Recommended Actions:
              </span>
              <ul className="space-y-1.5 text-[11px] list-disc list-inside text-slate-600">
                <li>If you received a 6-digit OTP code in your email, enter it directly on the login screen.</li>
                <li>Request a fresh password recovery or sign-in link.</li>
                <li>Make sure you are opening the link in the same browser where you initiated the request.</li>
              </ul>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => {
                  verificationStarted.current = false;
                  setStatus('verifying');
                  setErrorMessage('');
                  processVerification();
                }}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw size={14} />
                <span>Retry Verification</span>
              </button>

              <Link
                href="/login"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                <LogIn size={14} />
                <span>Go to Login &amp; Enter OTP</span>
              </Link>
            </div>
          </div>
        )}

        <div className="pt-2 text-center border-t border-slate-100 text-[10px] text-slate-400 font-mono">
          PRINTPRO ERP • SECURE AUTH BRIDGE
        </div>
      </div>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
