'use client';

import React from 'react';
import { Database } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export function SupabaseBanner() {
  if (isSupabaseConfigured) return null;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg shadow-sm print:hidden">
      <div className="flex items-start space-x-3">
        <Database className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-amber-800">Supabase Connection Required</h3>
          <p className="text-xs text-amber-700 mt-1">
            Please add your Supabase credentials to <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">.env.local</code> and run the <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">schema.sql</code> script in your Supabase SQL Editor.
          </p>
          <div className="mt-2 text-xs font-medium text-amber-900">
            Copy values for: <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
          </div>
        </div>
      </div>
    </div>
  );
}
