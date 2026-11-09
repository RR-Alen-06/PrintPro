'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console (and forward to external monitoring service when connected)
    console.error('Unhandled Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-rose-100 text-rose-600 p-4 rounded-2xl mb-4 shadow-sm">
        <AlertTriangle size={36} />
      </div>
      <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Something went wrong</h1>
      <p className="text-xs text-slate-500 max-w-md mt-1 mb-6 leading-relaxed">
        An unexpected error occurred while processing your request. Please try refreshing or return to the dashboard.
      </p>

      {error?.message && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 font-mono text-xs max-w-lg mb-6 break-all">
          {error.message}
        </div>
      )}

      <div className="flex items-center space-x-3">
        <button
          onClick={() => reset()}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center space-x-2 shadow transition active:scale-95"
        >
          <RefreshCw size={14} />
          <span>Try Again</span>
        </button>
        <Link
          href="/"
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center space-x-2 border border-slate-200 transition"
        >
          <Home size={14} />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
