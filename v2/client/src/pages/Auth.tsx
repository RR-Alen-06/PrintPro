import React, { useState, useEffect } from 'react';
import { Printer, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuthStore';
import type { User, Business } from '../hooks/useAuthStore';
import { apiRequest } from '../api/apiClient';
import { supabase } from '../lib/supabase';
interface AuthResponse {
  accessToken: string;
  user: User;
  business: Business | null;
}

export default function Auth() {
  const { user, setAuth, logout, initialize } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let sessionToken = '';

      if (isLogin) {
        const { data, error: supaError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (supaError) throw supaError;
        if (!data.session) throw new Error('No session returned');
        sessionToken = data.session.access_token;
      } else {
        const { data, error: supaError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (supaError) throw supaError;
        if (!data.session) throw new Error('No session returned. Check your email to verify.');
        sessionToken = data.session.access_token;
      }

      // Sync with our backend to get role and business data
      const response = await apiRequest<AuthResponse>('/auth/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shopName, ownerName }), // Optional, for initial registration
      });
      
      setAuth(sessionToken, response.user, response.business);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="min-h-screen bg-[#07060a] text-gray-100 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] -top-40 -left-40 pointer-events-none" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px] -bottom-40 -right-40 pointer-events-none" />

        <div className="w-full max-w-md bg-[#0d0c12]/80 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-10 text-center shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/10 border border-purple-500/20">
              <Printer size={32} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              PrintPro V2
            </h1>
          </div>

          <div className="flex justify-center mb-6">
            <ShieldCheck size={56} className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.2)]" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Authenticated Successfully</h2>
          <p className="text-sm text-gray-400 mb-8">{user.email}</p>

          <button
            onClick={() => (window.location.href = '/')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 mb-4 cursor-pointer"
          >
            Enter Workspace <ArrowRight size={18} />
          </button>

          <button
            onClick={logout}
            className="w-full bg-transparent hover:bg-red-500/10 text-red-400 border border-red-500/20 hover:border-red-500/30 font-semibold py-3.5 rounded-xl transition-all cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07060a] text-gray-100 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] -top-40 -left-40 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px] -bottom-40 -right-40 pointer-events-none" />

      <div className="w-full max-w-md bg-[#0d0c12]/80 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-10 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-4 border border-purple-500/20 shadow-lg shadow-purple-500/10">
            <Printer size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            PrintPro V2
          </h1>
          <p className="text-sm text-gray-400 mt-2 text-center">
            {isLogin ? 'Sign in to access your print shop.' : 'Register your print shop profile.'}
          </p>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Shop Name
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Pixel Print Studio"
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Owner Name
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Alen Cooper"
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. merchant@printpro.com"
              className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 cursor-pointer mt-6"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : isLogin ? (
              <>
                Sign In <ArrowRight size={18} />
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800/80 text-center text-sm text-gray-500">
          {isLogin ? "Don't have a shop account?" : 'Already have a shop account?'}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-purple-400 hover:text-purple-300 font-semibold ml-1.5 cursor-pointer"
          >
            {isLogin ? 'Register shop' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
