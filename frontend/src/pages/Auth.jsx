import React, { useState } from 'react'
import { Printer, ShieldCheck, ArrowRight, Github } from 'lucide-react'
import { useAppContext } from '../context/AppContext'

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

  // If already logged in, show authenticated state card
  if (currentUser) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logoContainer}>
            <div style={styles.logoIcon}>
              <Printer size={32} />
            </div>
            <h1 style={styles.logoText}>PrintPro</h1>
          </div>

          <div style={styles.authSuccessIcon}>
            <ShieldCheck size={48} style={{ color: '#10b981' }} />
          </div>

          <h2 style={styles.welcomeText}>You are signed in</h2>
          <p style={styles.userEmail}>{currentUser.email}</p>

          <div style={styles.infoBox}>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
              Account Role: <strong>Merchant / Owner</strong>
            </p>
          </div>

          <button 
            style={styles.primaryButton}
            onClick={() => window.location.href = '/dashboard'}
          >
            Go to Dashboard <ArrowRight size={16} />
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
      <div style={styles.backgroundGlow} />
      
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>
            <Printer size={32} />
          </div>
          <h1 style={styles.logoText}>PrintPro</h1>
        </div>

        <h2 style={styles.cardTitle}>Merchant Sign In</h2>
        <p style={styles.cardSubtitle}>
          Secure OAuth 2.0 gateway for PrintPro store management.
        </p>

        {error && (
          <div style={styles.errorAlert}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={styles.buttonGroup}>
          <button
            disabled={loadingProvider !== null}
            onClick={() => handleOAuthLogin('google', signInWithGoogle)}
            style={styles.googleButton}
          >
            {loadingProvider === 'google' ? (
              <span className="loader" style={styles.buttonLoader} />
            ) : (
              // Inline SVG for Google Logo for premium brand look
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
            Sign in with Google
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
            Sign in with GitHub
          </button>
        </div>

        <div style={styles.footer}>
          <p style={{ margin: 0 }}>
            By signing in, you agree to secure cryptographic validation.
          </p>
          <p style={{ marginTop: '8px', fontSize: '0.75rem', opacity: 0.5 }}>
            Authorized Merchant Access Only.
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
    backgroundColor: '#0c0c0e',
    color: '#f3f4f6',
    fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
  },
  backgroundGlow: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)',
    top: '20%',
    left: '30%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'rgba(20, 20, 25, 0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    zIndex: 10,
    animation: 'fadeIn 0.6s ease-out',
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
  },
  logoIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  logoText: {
    fontSize: '1.75rem',
    fontWeight: 800,
    margin: 0,
    background: 'linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.025em',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: '0 0 8px 0',
    color: '#f3f4f6',
  },
  cardSubtitle: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    margin: '0 0 28px 0',
    lineHeight: '1.5',
  },
  authSuccessIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  welcomeText: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: '0 0 4px 0',
  },
  userEmail: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    margin: '0 0 24px 0',
  },
  infoBox: {
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    marginBottom: '24px',
  },
  errorAlert: {
    padding: '12px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: '8px',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#fca5a5',
    fontSize: '0.85rem',
    marginBottom: '20px',
    textAlign: 'left',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '28px',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    fontSize: '0.925rem',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  githubButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: '#24292f',
    color: '#ffffff',
    fontSize: '0.925rem',
    fontWeight: 600,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: '0.925rem',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '12px',
  },
  logoutButton: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    backgroundColor: 'transparent',
    color: '#ef4444',
    fontSize: '0.925rem',
    fontWeight: 600,
    border: '1px solid rgba(239, 68, 68, 0.2)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  footer: {
    fontSize: '0.8rem',
    color: '#71717a',
    lineHeight: '1.4',
  },
  buttonLoader: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(0, 0, 0, 0.1)',
    borderTop: '2px solid currentColor',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
    marginRight: '10px',
    flexShrink: 0,
  },
}

export default Auth
