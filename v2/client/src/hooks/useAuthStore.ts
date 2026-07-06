import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  role: string;
  businessId: string;
}

export interface Business {
  id: string;
  shopName: string;
  ownerName: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  business: Business | null;
  setAuth: (token: string, user: User, business: Business | null) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  business: null,
  setAuth: (token, user, business) => {
    localStorage.setItem('printpro-auth-token', token);
    localStorage.setItem('printpro-auth-user', JSON.stringify(user));
    if (business) {
      localStorage.setItem('printpro-auth-business', JSON.stringify(business));
    } else {
      localStorage.removeItem('printpro-auth-business');
    }
    set({ token, user, business });
  },
  logout: async () => {
    try {
      // Lazy import supabase to avoid circular dependencies if any, or just import at top
      const { supabase } = await import('../lib/supabase');
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error signing out of Supabase:', e);
    }
    localStorage.removeItem('printpro-auth-token');
    localStorage.removeItem('printpro-auth-user');
    localStorage.removeItem('printpro-auth-business');
    set({ token: null, user: null, business: null });
  },
  initialize: () => {
    const token = localStorage.getItem('printpro-auth-token');
    const userStr = localStorage.getItem('printpro-auth-user');
    const busStr = localStorage.getItem('printpro-auth-business');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const business = busStr ? JSON.parse(busStr) : null;
        set({ token, user, business });
      } catch {
        // Clear corrupt state
        localStorage.removeItem('printpro-auth-token');
        localStorage.removeItem('printpro-auth-user');
        localStorage.removeItem('printpro-auth-business');
      }
    }
  },
}));
