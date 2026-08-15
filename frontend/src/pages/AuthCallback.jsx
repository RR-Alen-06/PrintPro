import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useMobileDetect } from '../hooks/useMobileDetect';

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
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#121212',
        color: '#ffffff',
        fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif'
      }}
    >
      <Loader2
        size={48}
        className="animate-spin"
        style={{
          color: '#3b82f6',
          animation: 'spin 1.5s linear infinite',
          marginBottom: '16px'
        }}
      />
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
        Completing secure sign-in...
      </h2>
      <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '8px' }}>
        Please wait while we set up your session.
      </p>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AuthCallback;
