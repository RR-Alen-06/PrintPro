import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

declare global {
  interface ImportMetaEnv {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_PUBLISHABLE_KEY: string;
    VITE_SUPABASE_ANON_KEY: string;
  }
}

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || ''
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('Supabase URL, Publishable Key or Anon Key is missing from environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const logSupabaseError = (table: string, action: string, payload: any, error: any) => {
  logger.error('=== SUPABASE TRANSACTION FAILED ===');
  logger.error(`Table:       ${table}`);
  logger.error(`Operation:   ${action}`);
  logger.error(`Payload:     `, payload);
  if (error) {
    logger.error(`Error Code:  ${error.code}`);
    logger.error(`Message:     ${error.message}`);
    logger.error(`Details:     ${error.details}`);
  }
  logger.error('===================================');
};
