import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer, ShieldCheck, ArrowRight, Github, Lock, Mail, Eye, EyeOff, Building2, Phone, AlertCircle, Loader2, Terminal, KeyRound } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import '../../styles/mobile.css'

export default function MobileAuth() {
  const navigate = useNavigate()
  const { currentUser, logout, signInWithGoogle, signInWithGitHub, updateBusiness } = useAppContext()

  const [activeTab, setActiveTab] = useState('login') // 'login' | 'signup'

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  // Signup form state
  const [signupShopName, setSignupShopName] = useState('')
  const [signupOwnerName, setSignupOwnerName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')

  // 1. Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!loginEmail || !loginPassword) {
      setError('System Access Denied: Email and Password are required.')
      return
    }

    setIsSubmitting(true)
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })

      if (authErr) throw authErr

      setSuccessMsg('Uplink Established. Redirecting to Dashboard...')
      setTimeout(() => {
        navigate('/mobile/dashboard')
      }, 600)
    } catch (err) {
      setError(err.message || 'Authentication Failed: Invalid email or password credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2. Handle Signup Submit
  const handleSignupSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!signupShopName || !signupEmail || !signupPassword) {
      setError('Registration Error: Store Name, Email, and Password are required.')
      return
    }

    if (signupPassword !== signupConfirmPassword) {
      setError('Password Mismatch: Passwords do not match.')
      return
    }

    if (signupPassword.length < 6) {
      setError('Security Constraint: Password must be at least 6 characters.')
      return
    }

    setIsSubmitting(true)
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            shop_name: signupShopName,
            owner_name: signupOwnerName,
            phone: signupPhone,
          },
        },
      })

      if (signUpErr) throw signUpErr

      if (updateBusiness) {
        updateBusiness({
          shopName: signupShopName,
          ownerName: signupOwnerName,
          phone: signupPhone,
        })
      }

      setSuccessMsg('Account Initialized Successfully! Signing in...')
      setTimeout(() => {
        navigate('/mobile/dashboard')
      }, 800)
    } catch (err) {
      setError(err.message || 'Registration Failed: Unable to create account.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. OAuth Login
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

  // 4. Password Reset
  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!forgotEmail) {
      setError('Please provide your email address.')
      return
    }

    try {
      setIsSubmitting(true)
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail)
      if (resetErr) throw resetErr
      setSuccessMsg('Password reset link sent to your email.')
      setShowForgotModal(false)
    } catch (err) {
      setError(err.message || 'Failed to send reset link.')
    } finally {
      setIsSubmitting(false)
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
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '440px', margin: '0 auto', width: '100%' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px', marginTop: '12px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: 'rgba(255, 47, 176, 0.15)', borderRadius: 'var(--radius-lg)', color: 'var(--accent-primary)', marginBottom: '12px', boxShadow: '0 0 20px rgba(255, 47, 176, 0.45)', border: '1px solid rgba(255, 47, 176, 0.3)' }}>
            <Terminal size={28} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: '#ffffff', textShadow: '0 0 20px rgba(255, 47, 176, 0.4)' }}>
            PRINTPRO <span style={{ color: 'var(--accent-primary)' }}>ERP</span>
          </h1>
          <p style={{ color: 'var(--accent-secondary)', fontSize: '0.72rem', fontWeight: 800, marginTop: '4px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
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
            padding: '22px 18px',
            marginBottom: '16px'
          }}
        >
          {/* Quick OAuth Gateway (Google & GitHub) */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '10px', textAlign: 'center', letterSpacing: '0.06em' }}>
              SECURE OAUTH GATEWAY
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                  minHeight: '44px',
                  borderRadius: 'var(--radius-md)',
                  background: '#ffffff',
                  color: '#1a1a1a',
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(255, 255, 255, 0.2)',
                  transition: 'var(--transition)'
                }}
              >
                {loadingProvider === 'Google' ? (
                  <Loader2 size={18} className="spin" style={{ color: '#1a1a1a' }} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24">
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
                  minHeight: '44px',
                  borderRadius: 'var(--radius-md)',
                  background: '#24292e',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(0, 0, 0, 0.4)',
                  transition: 'var(--transition)'
                }}
              >
                {loadingProvider === 'GitHub' ? (
                  <Loader2 size={18} className="spin" style={{ color: '#ffffff' }} />
                ) : (
                  <Github size={18} />
                )}
                <span>Sign in with GitHub</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0 14px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>OR CREDENTIAL AUTH</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
          </div>

          {/* Tabbed Toggle (Login / Register) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg('') }}
              style={{
                padding: '8px',
                fontSize: '0.8rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: activeTab === 'login' ? 'var(--gradient-accent)' : 'transparent',
                color: activeTab === 'login' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: activeTab === 'login' ? '0 0 10px rgba(255, 47, 176, 0.4)' : 'none',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              LOGIN
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('signup'); setError(''); setSuccessMsg('') }}
              style={{
                padding: '8px',
                fontSize: '0.8rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: activeTab === 'signup' ? 'var(--gradient-accent)' : 'transparent',
                color: activeTab === 'signup' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: activeTab === 'signup' ? '0 0 10px rgba(255, 47, 176, 0.4)' : 'none',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              REGISTER
            </button>
          </div>

          {/* Status Alerts */}
          {error && (
            <div className="mobile-badge mobile-badge-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '14px', padding: '10px 12px', fontSize: '0.8rem', textAlign: 'left', borderRadius: 'var(--radius-md)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mobile-badge mobile-badge-success" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '14px', padding: '10px 12px', fontSize: '0.8rem', textAlign: 'left', borderRadius: 'var(--radius-md)' }}>
              <ShieldCheck size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tab 1: LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.05em' }}>
                  MERCHANT EMAIL
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--accent-secondary)' }} />
                  <input
                    type="email"
                    className="mobile-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="merchant@printpro.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--accent-secondary)' }} />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    className="mobile-input"
                    style={{ paddingLeft: '38px', paddingRight: '38px' }}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{ position: 'absolute', right: '10px', top: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="mobile-btn mobile-btn-primary"
                disabled={isSubmitting}
                style={{ marginTop: '6px', minHeight: '44px', fontWeight: 900, letterSpacing: '0.06em' }}
              >
                {isSubmitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    <Loader2 size={18} className="spin" /> AUTHORIZING...
                  </span>
                ) : (
                  'AUTHORIZE ACCESS'
                )}
              </button>
            </form>
          )}

          {/* Tab 2: SIGNUP FORM */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  STORE / BUSINESS NAME *
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--accent-primary)' }} />
                  <input
                    type="text"
                    className="mobile-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="PrintPro Station"
                    value={signupShopName}
                    onChange={(e) => setSignupShopName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  OWNER / CONTACT NAME
                </label>
                <input
                  type="text"
                  className="mobile-input"
                  placeholder="Alex Mercer"
                  value={signupOwnerName}
                  onChange={(e) => setSignupOwnerName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  EMAIL ADDRESS *
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--accent-primary)' }} />
                  <input
                    type="email"
                    className="mobile-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="owner@printpro.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  PHONE NUMBER
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--accent-primary)' }} />
                  <input
                    type="tel"
                    className="mobile-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="+91 9876543210"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  PASSWORD *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--accent-primary)' }} />
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    className="mobile-input"
                    style={{ paddingLeft: '38px', paddingRight: '38px' }}
                    placeholder="At least 6 characters"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    style={{ position: 'absolute', right: '10px', top: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  CONFIRM PASSWORD *
                </label>
                <input
                  type="password"
                  className="mobile-input"
                  placeholder="Re-enter password"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="mobile-btn mobile-btn-primary"
                disabled={isSubmitting}
                style={{ marginTop: '6px', minHeight: '44px', fontWeight: 900 }}
              >
                {isSubmitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    <Loader2 size={18} className="spin" /> CREATING ACCOUNT...
                  </span>
                ) : (
                  'REGISTER MERCHANT ACCOUNT'
                )}
              </button>
            </form>
          )}

          {/* Security Notice */}
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              By signing in, you agree to secure cryptographic validation.
            </p>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.68rem', color: 'var(--accent-secondary)', fontWeight: 700 }}>
              Authorized Merchant Access Only.
            </p>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div className="bottom-sheet-overlay" onClick={() => setShowForgotModal(false)}>
            <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
              <div className="bottom-sheet-drag-handle" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '10px', color: 'var(--text-primary)' }}>
                Reset Merchant Password
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Enter your registered email address to receive password reset instructions.
              </p>
              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="email"
                  className="mobile-input"
                  placeholder="merchant@printpro.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
                <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending Link...' : 'Send Recovery Link'}
                </button>
              </form>
            </div>
          </div>
        )}
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
