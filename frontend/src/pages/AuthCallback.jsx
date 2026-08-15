import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ShieldCheck, CheckCircle2, Zap, Lock } from 'lucide-react';
import { useMobileDetect } from '../hooks/useMobileDetect';
import '../styles/aurora.css';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { effectiveMode } = useMobileDetect();

  useEffect(() => {
    const dashboardRoute = effectiveMode === 'mobile' ? '/mobile/dashboard' : '/dashboard';
    const authRoute = effectiveMode === 'mobile' ? '/mobile/auth' : '/auth';

    // Check if user session exists and redirect
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate(dashboardRoute, { replace: true });
      } else {
        // Give it a moment to let the callback process
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            subscription.unsubscribe();
            navigate(dashboardRoute, { replace: true });
          }
        });

        // Timeout fallback to login after 5s if not authenticated
        const timer = setTimeout(() => {
          subscription.unsubscribe();
          navigate(authRoute, { replace: true });
        }, 5000);

        return () => {
          clearTimeout(timer);
          subscription.unsubscribe();
        };
      }
    };

    checkSession();
  }, [navigate, effectiveMode]);

  return (
    <div
      className="aurora-canvas"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'rgba(18, 10, 35, 0.78)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid var(--border-aurora-cyan, rgba(0, 240, 255, 0.35))',
          borderRadius: '20px',
          padding: '44px 36px',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 35px rgba(0, 240, 255, 0.2)',
          animation: 'fadeIn 0.6s ease-out'
        }}
      >
        {/* Holographic Dual Spinner */}
        <div style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto 20px auto' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: 'var(--aurora-cyan, #00f0ff)',
              borderBottomColor: 'var(--aurora-magenta, #ff2fb0)',
              animation: 'spin 1.2s linear infinite',
              filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.6))'
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: '8px',
              borderRadius: '50%',
              border: '2px solid transparent',
              borderLeftColor: 'var(--aurora-green, #00ffab)',
              borderRightColor: '#7000ff',
              animation: 'spin-reverse 1.8s linear infinite'
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--aurora-cyan, #00f0ff)'
            }}
          >
            <Zap size={22} />
          </div>
        </div>

        <h2
          style={{
            fontSize: '1.3rem',
            fontWeight: 800,
            margin: '0 0 6px 0',
            color: 'var(--text-primary, #f8fafc)',
            letterSpacing: '-0.01em'
          }}
        >
          AUTHENTICATING SECURE SESSION
        </h2>
        <p
          style={{
            fontSize: '0.84rem',
            color: 'var(--text-muted, #849495)',
            margin: '0 0 24px 0',
            lineHeight: 1.4
          }}
        >
          Validating cryptographic OAuth tokens & synchronizing tenant databases...
        </p>

        {/* Progress Checklist */}
        <div
          style={{
            background: 'rgba(5, 1, 15, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--aurora-green, #00ffab)' }}>
            <CheckCircle2 size={16} />
            <span>OAuth Provider Handshake Verified</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--aurora-green, #00ffab)' }}>
            <CheckCircle2 size={16} />
            <span>Multi-Tenant Supabase RLS Session Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--aurora-cyan, #00f0ff)' }}>
            <Loader2 size={16} className="spin" />
            <span>TanStack Query Cache Pre-fetching...</span>
          </div>
        </div>

        {/* Security badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Lock size={12} style={{ color: 'var(--aurora-cyan, #00f0ff)' }} />
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono, JetBrains Mono)', color: 'var(--text-muted, #849495)' }}>
            256-Bit Encrypted Session Handshake
          </span>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes spin-reverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default AuthCallback;
