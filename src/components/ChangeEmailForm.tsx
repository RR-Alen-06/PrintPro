'use client';

import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Mail, CheckCircle2, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';

interface ChangeEmailFormProps {
  onEmailChanged?: (newEmail: string) => void;
}

export function ChangeEmailForm({ onEmailChanged }: ChangeEmailFormProps) {
  const [currentEmail, setCurrentEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    async function fetchUser() {
      if (!isSupabaseConfigured) {
        if (isMounted) setInitialLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          setCurrentEmail(user.email || 'N/A');
          setUserId(user.id);
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }

    fetchUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = newEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (cleanEmail === currentEmail.toLowerCase()) {
      setErrorMsg('New email must be different from your current email.');
      return;
    }

    if (!userId) {
      setErrorMsg('You must be logged in to update your email address.');
      return;
    }

    setLoading(true);

    try {
      // Invoke the change-user-email Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('change-user-email', {
        body: {
          userId,
          newEmail: cleanEmail,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to update email address.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const updatedEmail = data?.user?.email || cleanEmail;
      setCurrentEmail(updatedEmail);
      setNewEmail('');
      setSuccessMsg(`Email successfully changed to ${updatedEmail} without sending confirmation emails.`);

      if (onEmailChanged) {
        onEmailChanged(updatedEmail);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while updating email.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="p-5 flex items-center justify-center text-slate-500 text-xs">
        <Loader2 className="animate-spin mr-2" size={16} />
        <span>Loading account details...</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
          <Mail size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Change Account Email</h3>
          <p className="text-[11px] text-slate-500">
            Instantly update and confirm your login email without hitting email delivery rate limits.
          </p>
        </div>
      </div>

      {/* Current Email Display */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between text-xs">
        <div>
          <span className="text-slate-500 text-[11px] block">Current Email Address:</span>
          <span className="font-mono font-bold text-slate-800">{currentEmail || 'Not signed in'}</span>
        </div>
        <div className="flex items-center text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-emerald-200">
          <ShieldCheck size={12} className="mr-1" />
          <span>Active &amp; Confirmed</span>
        </div>
      </div>

      {/* Status Messages */}
      {errorMsg && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-lg flex items-center space-x-2.5 text-rose-800 text-xs">
          <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r-lg flex items-center space-x-2.5 text-emerald-800 text-xs font-semibold">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="new_email_input" className="block text-xs font-semibold text-slate-700 mb-1">
            New Email Address
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="new_email_input"
              type="email"
              required
              disabled={loading || !userId}
              placeholder="new.email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-60"
            />
          </div>
        </div>

        <div className="pt-1 flex justify-end">
          <button
            type="submit"
            disabled={loading || !newEmail.trim() || !userId}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow transition flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                <span>Updating Email...</span>
              </>
            ) : (
              <>
                <Mail size={14} />
                <span>Save New Email</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
