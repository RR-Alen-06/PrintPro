import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL, Publishable Key or Anon Key is missing from environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const logSupabaseError = (table, action, payload, error) => {
  console.error('=== SUPABASE TRANSACTION FAILED ===');
  console.error(`Table:       ${table}`);
  console.error(`Operation:   ${action}`);
  console.error(`Payload:     `, payload);
  if (error) {
    console.error(`Error Code:  ${error.code}`);
    console.error(`Message:     ${error.message}`);
    console.error(`Details:     ${error.details}`);
  }
  console.error('===================================');
};
