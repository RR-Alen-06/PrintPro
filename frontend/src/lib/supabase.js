import { createClient } from '@supabase/supabase-js';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL, Publishable Key or Anon Key is missing from environment variables.');
}

// Hardware KeyStore storage adapter for Android/iOS (falls back gracefully to localStorage on Web)
const secureStorageAdapter = {
  getItem: async (key) => {
    try {
      const { value } = await SecureStoragePlugin.get({ key });
      return value;
    } catch (err) {
      return window.localStorage.getItem(key);
    }
  },
  setItem: async (key, value) => {
    try {
      await SecureStoragePlugin.set({ key, value });
    } catch (err) {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: async (key) => {
    try {
      await SecureStoragePlugin.remove({ key });
    } catch (err) {
      window.localStorage.removeItem(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
