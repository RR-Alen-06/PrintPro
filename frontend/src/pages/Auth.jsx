import React, { useState } from 'react'
import { Printer, ShieldCheck, ArrowRight, Github, Sun, Moon, Sparkles } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { useTheme } from '../context/ThemeContext'

const Auth = () => {
  const { currentUser, logout, signInWithGoogle, signInWithGitHub } = useAppContext()
  const { resolvedTheme, toggleTheme } = useTheme()
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

  // If already logged in, show authenticated state card
  if (currentUser) {
    return (
      <div style={styles.container}>
        {/* Top Right Theme Toggle */}
        <div style={styles.topBar}>
          <button
            onClick={toggleTheme}
            style={styles.themeToggleBtn}
            title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {resolvedTheme === 'dark' ? <Sun size={18} style={{ color: '#fbbf24' }} /> : <Moon size={18} style={{ color: 'var(--accent)' }} />}
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.logoContainer}>
            <div style={styles.googleStitchBadge}>
              <Printer size={28} />
            </div>
            <h1 style={styles.logoText}>PrintPro</h1>
            <span style={styles.stitchPill}>Business Workspace</span>
          </div>

          <div style={styles.authSuccessIcon}>
            <ShieldCheck size={44} style={{ color: 'var(--success)' }} />
          </div>

          <h2 style={styles.welcomeText}>You are signed in</h2>
          <p style={styles.userEmail}>{currentUser.email || currentUser.username}</p>

          <div style={styles.infoBox}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Account Session</div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: '2px' }}>
              Merchant / Store Administrator
            </div>
          </div>

          <button 
            style={styles.primaryButton}
            onClick={() => window.location.href = '/dashboard'}
          >
            Go to POS Dashboard <ArrowRight size={16} />
          </button>

          <button style={styles.logoutButton} onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Top Right Theme Switcher */}
      <div style={styles.topBar}>
        <button
          onClick={toggleTheme}
          style={styles.themeToggleBtn}
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {resolvedTheme === 'dark' ? <Sun size={18} style={{ color: '#fbbf24' }} /> : <Moon size={18} style={{ color: 'var(--accent)' }} />}
        </button>
      </div>

      <div style={styles.card}>
        {/* Google 4-Color Accent Bar */}
        <div style={styles.stitchColorBar}>
          <span style={{ backgroundColor: '#4285F4', flex: 1, height: '3px' }} />
          <span style={{ backgroundColor: '#EA4335', flex: 1, height: '3px' }} />
          <span style={{ backgroundColor: '#FBBC05', flex: 1, height: '3px' }} />
          <span style={{ backgroundColor: '#34A853', flex: 1, height: '3px' }} />
        </div>

        <div style={styles.logoContainer}>
          <div style={styles.googleStitchBadge}>
            <Printer size={28} />
          </div>
          <h1 style={styles.logoText}>PrintPro</h1>
          <span style={styles.stitchPill}>Google Stitch Secure Gateway</span>
        </div>

        <h2 style={styles.cardTitle}>Sign in to your store</h2>
        <p style={styles.cardSubtitle}>
          Manage print billing, POS orders, customer ledgers, and cash register.
        </p>

        {error && (
          <div style={styles.errorAlert}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={styles.buttonGroup}>
          {/* Google Sign-in Button */}
          <button
            disabled={loadingProvider !== null}
            onClick={() => handleOAuthLogin('google', signInWithGoogle)}
            style={styles.googleButton}
          >
            {loadingProvider === 'google' ? (
              <span className="spinner" style={{ width: '18px', height: '18px', marginRight: '10px' }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '12px', flexShrink: 0 }}>
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
            Continue with Google
          </button>

          {/* GitHub Sign-in Button */}
          <button
            disabled={loadingProvider !== null}
            onClick={() => handleOAuthLogin('github', signInWithGitHub)}
            style={styles.githubButton}
          >
            {loadingProvider === 'github' ? (
              <span className="spinner" style={{ width: '18px', height: '18px', marginRight: '10px' }} />
            ) : (
              <Github size={18} style={{ marginRight: '12px', flexShrink: 0 }} />
            )}
            Continue with GitHub
          </button>
        </div>

        <div style={styles.footer}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <Sparkles size={13} color="var(--accent)" />
            <span>End-to-end encrypted Supabase cloud auth</span>
          </div>
          <p style={{ marginTop: '8px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Authorized store merchant access only.
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
    backgroundColor: 'var(--bg-main)',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    position: 'relative',
    padding: '24px 16px',
    transition: 'background-color 0.25s ease',
  },
  topBar: {
    position: 'absolute',
    top: '20px',
    right: '24px',
    zIndex: 20,
  },
  themeToggleBtn: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-full)',
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-xs)',
    transition: 'all 0.15s ease',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '36px 32px',
    textAlign: 'center',
    boxShadow: 'var(--shadow-md)',
    zIndex: 10,
    animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    overflow: 'hidden',
  },
  stitchColorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    height: '3px',
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '20px',
    marginTop: '6px',
  },
  googleStitchBadge: {
    width: '52px',
    height: '52px',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--accent-surface)',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10px',
    boxShadow: '0 2px 8px rgba(26, 115, 232, 0.2)',
  },
  logoText: {
    fontSize: '1.65rem',
    fontWeight: 800,
    margin: 0,
    color: 'var(--text-primary)',
    letterSpacing: '-0.025em',
  },
  stitchPill: {
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-light)',
    padding: '2px 10px',
    borderRadius: 'var(--radius-full)',
    marginTop: '6px',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: '0 0 6px 0',
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
  },
  cardSubtitle: {
    fontSize: '0.86rem',
    color: 'var(--text-secondary)',
    margin: '0 0 24px 0',
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
    color: 'var(--text-primary)',
  },
  userEmail: {
    fontSize: '0.88rem',
    color: 'var(--text-secondary)',
    margin: '0 0 20px 0',
    fontWeight: 500,
  },
  infoBox: {
    padding: '12px 16px',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    marginBottom: '22px',
    textAlign: 'left',
  },
  errorAlert: {
    padding: '12px 16px',
    backgroundColor: 'var(--error-bg)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(220, 38, 38, 0.25)',
    color: 'var(--error-text)',
    fontSize: '0.84rem',
    marginBottom: '18px',
    textAlign: 'left',
    fontWeight: 600,
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '26px',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 18px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--bg-canvas)',
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    fontWeight: 600,
    border: '1px solid var(--border-light)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
    boxShadow: 'var(--shadow-xs)',
  },
  githubButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 18px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    fontWeight: 600,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px 18px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
    fontSize: '0.92rem',
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    marginBottom: '10px',
    boxShadow: '0 2px 8px rgba(26, 115, 232, 0.28)',
  },
  logoutButton: {
    width: '100%',
    padding: '10px 18px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'transparent',
    color: 'var(--error-text)',
    fontSize: '0.88rem',
    fontWeight: 600,
    border: '1px solid rgba(220, 38, 38, 0.2)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  footer: {
    borderTop: '1px solid var(--border)',
    paddingTop: '16px',
    textAlign: 'center',
  },
}

export default Auth
