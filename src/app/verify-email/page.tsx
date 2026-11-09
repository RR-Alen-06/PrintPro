'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRight,
  LogOut,
  Clock,
  KeyRound,
} from 'lucide-react';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlEmail = searchParams.get('email') || '';
  const urlToken = searchParams.get('token') || '';

  const [email, setEmail] = useState<string>(urlEmail);
  const [loadingUser, setLoadingUser] = useState<boolean>(!urlEmail);
  const [resending, setResending] = useState<boolean>(false);
  const [verifyingOtp, setVerifyingOtp] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [pin, setPin] = useState<string[]>(() => {
    if (urlToken.length === 6) {
      return urlToken.split('');
    }
    return ['', '', '', '', '', ''];
  });
  const [showOtpInput, setShowOtpInput] = useState<boolean>(Boolean(urlToken));

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check current session / user verification state
  useEffect(() => {
    let isMounted = true;

    async function checkVerificationState() {
      if (!isSupabaseConfigured) {
        if (isMounted) setLoadingUser(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (user) {
          if (user.email) {
            setEmail(user.email);
          }
          // If already verified, direct to dashboard immediately
          if (user.email_confirmed_at || user.confirmed_at) {
            router.push('/');
            router.refresh();
            return;
          }
        }
      } catch (err) {
        console.error('Error fetching user status:', err);
      } finally {
        if (isMounted) setLoadingUser(false);
      }
    }

    checkVerificationState();

    // Listen to auth changes (e.g. if verified in another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email_confirmed_at || session?.user?.confirmed_at) {
        router.push('/');
        router.refresh();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Resend verification email
  const handleResendVerification = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setErrorMsg('No email address found. Please return to login.');
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase is not configured.');
      return;
    }

    setResending(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      const emailRedirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?type=signup`
        : undefined;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: emailRedirectUrl,
        },
      });

      if (error) {
        throw error;
      }

      setCooldown(60);
      setStatusMsg(`A new verification link has been sent to ${targetEmail}. Please check your inbox!`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to resend verification email. Please try again in a few moments.'
      );
    } finally {
      setResending(false);
    }
  };

  // Verify via 6-digit OTP code directly
  const handleVerifyOtp = async (codeToVerify?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetEmail = email.trim();
    const token = (codeToVerify || pin.join('')).trim();

    if (!targetEmail) {
      setErrorMsg('Please specify your email address.');
      return;
    }

    if (!token || token.length < 6) {
      setErrorMsg('Please enter all 6 digits of your verification code.');
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase is not configured.');
      return;
    }

    setVerifyingOtp(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: token,
        type: 'signup',
      });

      if (error) {
        const fallback = await supabase.auth.verifyOtp({
          email: targetEmail,
          token: token,
          type: 'email',
        });
        if (!fallback.error) {
          data = fallback.data;
          error = null;
        }
      }

      if (error) {
        throw error;
      }

      if (data?.session || data?.user) {
        setStatusMsg('Email verified successfully! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1200);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Verification code is invalid or has expired. Please request a new link.'
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Handle PIN input change
  const handlePinChange = (index: number, val: string) => {
    const sanitized = val.replace(/\D/g, '');
    if (!sanitized) {
      const newPin = [...pin];
      newPin[index] = '';
      setPin(newPin);
      return;
    }

    const digit = sanitized.slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const completeToken = newPin.join('');
    if (completeToken.length === 6 && newPin.every((d) => d !== '')) {
      handleVerifyOtp(completeToken);
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!pin[index] && index > 0) {
        const newPin = [...pin];
        newPin[index - 1] = '';
        setPin(newPin);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newPin = ['', '', '', '', '', ''];
    for (let i = 0; i < pastedData.length; i++) {
      newPin[i] = pastedData[i];
    }
    setPin(newPin);

    const targetIndex = Math.min(pastedData.length, 5);
    inputRefs.current[targetIndex]?.focus();

    if (pastedData.length === 6) {
      handleVerifyOtp(pastedData);
    }
  };

  const handleSignOut = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch {
      // Ignore error
    } finally {
      router.push('/login');
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-8 space-y-6">
        
        {/* Animated Email Icon Header */}
        <div className="text-center space-y-2">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/30 mb-2">
            <Mail className="w-8 h-8" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white"></span>
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Check your email
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            We&apos;ve sent a secure verification link to:
          </p>
          <div className="inline-block bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-xs font-mono font-bold text-slate-800">
            {email || 'your registered email'}
          </div>
        </div>

        {/* Clear Notice / App Access Lock Explanation */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
            <span>Email Verification Required</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800/90">
            To protect your business data and keep your billing terminal secure, please click the link in your email to verify your account before accessing PrintPro ERP.
          </p>
        </div>

        {/* Status & Error Alerts */}
        {statusMsg && (
          <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r-lg flex items-center space-x-2 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-lg flex items-start space-x-2 text-rose-800 text-xs">
            <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Notice</span>
              <span className="text-[11px] leading-tight">{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Security / Token Expiration Policy details */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <Clock size={13} className="text-slate-500" />
            <span>Link Expiration &amp; Security:</span>
          </div>
          <ul className="space-y-1 pl-5 list-disc text-slate-500 leading-normal">
            <li>The link is cryptographically random, single-use, and stored hashed.</li>
            <li>Verification links expire strictly in <strong>24 hours</strong>.</li>
            <li>Be sure to check your spam or junk folder if you don&apos;t see it right away.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending || cooldown > 0 || !email}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
          >
            {resending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Sending fresh link...</span>
              </>
            ) : cooldown > 0 ? (
              <>
                <Clock size={15} />
                <span>Resend available in {cooldown}s</span>
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                <span>Resend Verification Link</span>
              </>
            )}
          </button>

          {/* Optional: Enter 6-digit PIN code */}
          <div>
            {!showOtpInput ? (
              <button
                type="button"
                onClick={() => {
                  setShowOtpInput(true);
                  setTimeout(() => inputRefs.current[0]?.focus(), 100);
                }}
                className="w-full py-2 text-center text-xs font-semibold text-slate-600 hover:text-blue-600 transition flex items-center justify-center gap-1.5"
              >
                <KeyRound size={13} />
                <span>Have a 6-digit code? Enter code instead</span>
              </button>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Enter 6-Digit PIN
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOtpInput(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    Hide
                  </button>
                </div>

                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                  {pin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(idx, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(idx, e)}
                      onPaste={handlePinPaste}
                      disabled={verifyingOtp}
                      className={`w-10 h-11 sm:w-11 sm:h-12 text-center font-mono text-lg font-extrabold rounded-lg border transition-all duration-150 focus:outline-none ${
                        digit
                          ? 'bg-blue-50/50 border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-500/20'
                          : 'bg-white border-slate-200 text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/30'
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleVerifyOtp()}
                  disabled={verifyingOtp || pin.some((d) => d === '')}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {verifyingOtp ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify &amp; Enter Dashboard</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <Link
            href="/login"
            className="hover:text-slate-800 font-semibold transition"
          >
            ← Back to Sign In
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 transition"
          >
            <LogOut size={12} />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="pt-1 text-center text-[10px] text-slate-400 font-mono">
          PRINTPRO ERP • SECURE VERIFICATION GUARD
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
