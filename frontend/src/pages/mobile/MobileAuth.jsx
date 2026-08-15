import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer, ShieldCheck, ArrowRight, Github, AlertCircle, Loader2, Terminal } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import '../../styles/mobile.css'

export default function MobileAuth() {
  const navigate = useNavigate()
  const { currentUser, logout, signInWithGoogle, signInWithGitHub } = useAppContext()

  const [loadingProvider, setLoadingProvider] = useState(null)
  const [error, setError] = useState('')

  // OAuth Login Handler
  const handleOAuthLogin = async (provider, loginFn) => {
    try {
      setLoadingProvider(provider)
      setError('')
      await loginFn()
    } catch (err) {
      setError(err.message || `OAuth Uplink Failed for ${provider}`)
      setLoadingProvider(null)
    }
  }

  // Authenticated State View
  if (currentUser) {
    return (
      <div className="mobile-shell" style={{ justifyContent: 'center', padding: '20px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="mobile-card mobile-card-glow" style={{ textAlign: 'center', padding: '32px 20px', borderColor: 'var(--accent-secondary)' }}>
          <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(0, 240, 255, 0.12)', borderRadius: 'var(--radius-lg)', color: 'var(--accent-secondary)', marginBottom: '16px', boxShadow: '0 0 16px rgba(0, 240, 255, 0.3)' }}>
            <Printer size={40} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <ShieldCheck size={48} style={{ color: 'var(--success)', filter: 'drop-shadow(0 0 8px #00ffab)' }} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>UPLINK ACTIVE</h2>
          <p className="currency-num" style={{ color: 'var(--accent-secondary)', fontSize: '0.95rem', marginBottom: '12px' }}>{currentUser.email}</p>

          <div style={{ background: 'var(--bg-input)', padding: '8px 12px', borderRadius: 'var(--radius-md)', marginBottom: '20px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              ACCOUNT ROLE: <strong style={{ color: 'var(--accent-primary)' }}>MERCHANT / OWNER</strong>
            </span>
          </div>

          <button
            className="mobile-btn mobile-btn-primary"
            onClick={() => navigate('/mobile/dashboard')}
            style={{ marginBottom: '12px' }}
          >
            ENTER MOBILE ERP <ArrowRight size={18} />
          </button>

          <button
            className="mobile-btn mobile-btn-secondary"
            onClick={logout}
            style={{ color: 'var(--error)', borderColor: 'var(--error-bg)' }}
          >
            TERMINATE SESSION
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="mobile-shell"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 16px 16px 16px',
        backgroundColor: '#05040a',
        position: 'relative',
        boxSizing: 'border-box'
      }}
    >
      {/* Background Decorative Grid Line Gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(0, 238, 252, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 238, 252, 0.04) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Main Container */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '440px', margin: 'auto 0', width: '100%' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', background: 'rgba(255, 47, 176, 0.15)', borderRadius: 'var(--radius-lg)', color: 'var(--accent-primary)', marginBottom: '14px', boxShadow: '0 0 20px rgba(255, 47, 176, 0.45)', border: '1px solid rgba(255, 47, 176, 0.3)' }}>
            <Terminal size={30} />
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: '#ffffff', textShadow: '0 0 20px rgba(255, 47, 176, 0.4)' }}>
            PRINTPRO <span style={{ color: 'var(--accent-primary)' }}>ERP</span>
          </h1>
          <p style={{ color: 'var(--accent-secondary)', fontSize: '0.74rem', fontWeight: 800, marginTop: '6px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            System Access Overlay • OAuth 2.0
          </p>
        </div>

        {/* Glass Card Container */}
        <div
          className="mobile-card"
          style={{
            background: 'rgba(20, 10, 35, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 47, 176, 0.25)',
            boxShadow: '0 0 25px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 47, 176, 0.15)',
            padding: '24px 20px',
            marginBottom: '16px'
          }}
        >
          {/* Header Description */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              Merchant Sign In
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Secure OAuth 2.0 gateway for PrintPro store management.
            </p>
          </div>

          {/* Status Alert */}
          {error && (
            <div className="mobile-badge mobile-badge-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '16px', padding: '10px 12px', fontSize: '0.8rem', textAlign: 'left', borderRadius: 'var(--radius-md)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* OAuth Buttons Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={() => handleOAuthLogin('Google', signInWithGoogle)}
              disabled={loadingProvider !== null}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                width: '100%',
                minHeight: '48px',
                borderRadius: 'var(--radius-md)',
                background: '#ffffff',
                color: '#1a1a1a',
                border: 'none',
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 0 14px rgba(255, 255, 255, 0.25)',
                transition: 'var(--transition)'
              }}
            >
              {loadingProvider === 'Google' ? (
                <Loader2 size={20} className="spin" style={{ color: '#1a1a1a' }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              )}
              <span>Sign in with Google</span>
            </button>

            {/* GitHub Sign In Button */}
            <button
              type="button"
              onClick={() => handleOAuthLogin('GitHub', signInWithGitHub)}
              disabled={loadingProvider !== null}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                width: '100%',
                minHeight: '48px',
                borderRadius: 'var(--radius-md)',
                background: '#24292e',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 0 12px rgba(0, 0, 0, 0.5)',
                transition: 'var(--transition)'
              }}
            >
              {loadingProvider === 'GitHub' ? (
                <Loader2 size={20} className="spin" style={{ color: '#ffffff' }} />
              ) : (
                <Github size={20} />
              )}
              <span>Sign in with GitHub</span>
            </button>
          </div>

          {/* Security Notice */}
          <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              By signing in, you agree to secure cryptographic validation.
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: 'var(--accent-secondary)', fontWeight: 800 }}>
              Authorized Merchant Access Only.
            </p>
          </div>
        </div>
      </div>

      {/* Atmospheric Terminal Footer */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          fontFamily: 'Space Mono, monospace'
        }}
      >
        <span>STATION_ID: NRT-0992</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span>UPTIME: 99.998%</span>
          <span>•</span>
          <span style={{ color: 'var(--accent-secondary)' }}>AES_256</span>
        </div>
      </div>
    </div>
  )
}
