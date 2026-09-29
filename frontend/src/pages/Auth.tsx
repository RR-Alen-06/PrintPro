import React, { useState } from 'react'
import { Printer, ShieldCheck, ArrowRight, Github, Lock, CheckCircle2 } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import '../styles/aurora.css'

const Auth = () => {
  const { currentUser, logout, signInWithGoogle, signInWithGitHub } = useAppContext()
  const [loadingProvider, setLoadingProvider] = useState(null)
  const [error, setError] = useState('')

  const handleOAuthLogin = async (provider, loginFn) => {
    try {
      setLoadingProvider(provider)
      setError('')
      await loginFn()
    } catch (err) {
      setError(err.message || `Failed to initialize login with ${provider}`)
      setLoadingProvider(null)
    }
  }

  // If already logged in, show authenticated state card in Aurora UI
  if (currentUser) {
    return (
      <div className="aurora-canvas" style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logoContainer}>
            <div style={styles.logoIcon}>
              <Printer size={28} />
            </div>
            <h1 style={styles.logoText}>PrintPro ERP</h1>
            <span style={styles.gatewayBadge}>AUTHENTICATED SESSION</span>
          </div>

          <div style={styles.authSuccessIcon}>
            <ShieldCheck size={48} style={{ color: 'var(--aurora-green, #00ffab)', filter: 'drop-shadow(0 0 12px rgba(0,255,171,0.4))' }} />
          </div>

          <h2 style={styles.welcomeText}>Merchant Access Active</h2>
          <p style={styles.userEmail}>{currentUser.email}</p>

          <div style={styles.infoBox}>
            <p style={{ margin: 0, fontSize: '0.82rem', fontFamily: 'var(--font-mono, JetBrains Mono)', color: 'var(--text-secondary)' }}>
              Tenant Role: <strong style={{ color: 'var(--aurora-cyan)' }}>Merchant / Store Owner</strong>
            </p>
          </div>

          <button 
            className="aurora-btn-primary"
            style={{ width: '100%', marginBottom: '12px', fontSize: '0.95rem' }}
            onClick={() => window.location.href = '/dashboard'}
          >
            Launch Command Center <ArrowRight size={18} />
          </button>

          <button
            className="aurora-btn-glass"
            style={{ width: '100%', color: 'var(--aurora-red, #ff3860)', borderColor: 'rgba(255, 56, 96, 0.3)' }}
            onClick={logout}
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="aurora-canvas" style={styles.container}>
      <div style={styles.card}>
        {/* Branding & Header */}
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>
            <Printer size={28} />
          </div>
          <h1 style={styles.logoText}>PrintPro ERP</h1>
          <div style={{ marginTop: '8px' }}>
            <span style={styles.gatewayBadge}>ENTERPRISE ACCESS GATEWAY</span>
          </div>
        </div>

        <h2 style={styles.cardTitle}>Merchant Sign In</h2>
        <p style={styles.cardSubtitle}>
          Next-Gen Intelligent Print & Commercial Stationery ERP
        </p>

        {error && (
          <div style={styles.errorAlert}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {/* OAuth Action Buttons */}
        <div style={styles.buttonGroup}>
          <button
            disabled={loadingProvider !== null}
            onClick={() => handleOAuthLogin('google', signInWithGoogle)}
            style={styles.googleButton}
          >
            {loadingProvider === 'google' ? (
              <span className="loader" style={styles.buttonLoader} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '10px', flexShrink: 0 }}>
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.5 3.77v3.13h4.05c2.37-2.18 3.73-5.39 3.73-8.75z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-4.05-3.13c-1.12.75-2.56 1.2-3.88 1.2-2.99 0-5.52-2.02-6.42-4.74H1.37v3.23A11.98 11.98 0 0 0 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.58 14.42a7.16 7.16 0 0 1 0-4.55V6.64H1.37a11.98 11.98 0 0 0 0 10.72l4.21-2.94z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.92 11.92 0 0 0 12 0 11.98 11.98 0 0 0 1.37 6.64l4.21 2.94c.9-2.72 3.43-4.83 6.42-4.83z"
                />
              </svg>
            )}
            Sign in with Google Workspace
          </button>

          <button
            disabled={loadingProvider !== null}
            onClick={() => handleOAuthLogin('github', signInWithGitHub)}
            style={styles.githubButton}
          >
            {loadingProvider === 'github' ? (
              <span className="loader" style={styles.buttonLoader} />
            ) : (
              <Github size={18} style={{ marginRight: '10px' }} />
            )}
            Sign in with GitHub Organization
          </button>
        </div>

        {/* Security Credentials Footer */}
        <div style={styles.securityBox}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
            <Lock size={13} style={{ color: 'var(--aurora-cyan, #00f0ff)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--aurora-cyan, #00f0ff)' }}>
              CRYPTOGRAPHIC SESSION SECURITY
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted, #849495)', lineHeight: 1.4 }}>
            Zero-Knowledge Isolated Database Engine • Multi-Tenant Supabase RLS Protected • 256-Bit Cryptographic Session
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: 'rgba(18, 10, 35, 0.76)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '44px 36px',
    textAlign: 'center',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(112, 0, 255, 0.15)',
    zIndex: 10,
    animation: 'fadeIn 0.6s ease-out',
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '20px',
  },
  logoIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.25) 0%, rgba(112, 0, 255, 0.35) 100%)',
    border: '1px solid var(--aurora-cyan, #00f0ff)',
    boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)',
    color: 'var(--aurora-cyan, #00f0ff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  logoText: {
    fontSize: '1.85rem',
    fontWeight: 800,
    margin: 0,
    background: 'linear-gradient(135deg, #00f0ff 0%, #ff2fb0 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.025em',
  },
  gatewayBadge: {
    display: 'inline-block',
    fontSize: '0.68rem',
    fontFamily: 'var(--font-mono, JetBrains Mono)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    padding: '2px 8px',
    borderRadius: '9999px',
    background: 'rgba(0, 240, 255, 0.12)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    color: 'var(--aurora-cyan, #00f0ff)',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: '0 0 6px 0',
    color: 'var(--text-primary, #f8fafc)',
  },
  cardSubtitle: {
    fontSize: '0.84rem',
    color: 'var(--text-muted, #849495)',
    margin: '0 0 28px 0',
    lineHeight: '1.45',
  },
  authSuccessIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  welcomeText: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: '0 0 4px 0',
    color: 'var(--text-primary, #f8fafc)',
  },
  userEmail: {
    fontSize: '0.88rem',
    fontFamily: 'var(--font-mono, JetBrains Mono)',
    color: 'var(--aurora-cyan, #00f0ff)',
    margin: '0 0 20px 0',
  },
  infoBox: {
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    marginBottom: '24px',
  },
  errorAlert: {
    padding: '12px 16px',
    backgroundColor: 'rgba(255, 56, 96, 0.15)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 56, 96, 0.35)',
    color: '#ffafd3',
    fontSize: '0.85rem',
    marginBottom: '20px',
    textAlign: 'left',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    color: '#05010f',
    fontSize: '0.92rem',
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
  },
  githubButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: 'rgba(10, 5, 20, 0.8)',
    color: '#ffffff',
    fontSize: '0.92rem',
    fontWeight: 600,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  securityBox: {
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'rgba(5, 1, 15, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  buttonLoader: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(0, 0, 0, 0.15)',
    borderTop: '2px solid currentColor',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
    marginRight: '10px',
    flexShrink: 0,
  },
}

export default Auth
