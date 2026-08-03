import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer, ShieldCheck, ArrowRight, Github, Lock, Mail, Eye, EyeOff, Building2, Phone, AlertCircle, Loader2 } from 'lucide-react'
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
      }, 800)
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
      }, 1000)
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
      <div className="mobile-shell" style={{ justifyContent: 'center', padding: '20px' }}>
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
    <div className="mobile-shell" style={{ justifyContent: 'center', padding: '24px 16px' }}>
      <div className="mobile-card mobile-card-glow" style={{ padding: '28px 20px', maxWidth: '440px', margin: '0 auto', width: '100%' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', padding: '14px', background: 'rgba(255, 47, 176, 0.15)', borderRadius: 'var(--radius-lg)', color: 'var(--accent-primary)', marginBottom: '12px', boxShadow: '0 0 16px rgba(255, 47, 176, 0.4)' }}>
            <Printer size={36} />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 900, margin: 0, letterSpacing: '0.04em', background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            PRINTPRO ERP
          </h1>
          <p style={{ color: 'var(--accent-secondary)', fontSize: '0.78rem', fontWeight: 700, marginTop: '4px', letterSpacing: '0.1em' }}>
            SYSTEM ACCESS OVERLAY v1.0
          </p>
        </div>

        {/* Tabbed Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg-input)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg('') }}
            style={{
              padding: '10px',
              fontSize: '0.85rem',
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
              padding: '10px',
              fontSize: '0.85rem',
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
          <div className="mobile-badge mobile-badge-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '16px', padding: '12px', fontSize: '0.82rem', textAlign: 'left', borderRadius: 'var(--radius-md)' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mobile-badge mobile-badge-success" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '16px', padding: '12px', fontSize: '0.82rem', textAlign: 'left', borderRadius: 'var(--radius-md)' }}>
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: LOGIN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.05em' }}>
                MERCHANT EMAIL
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
                <input
                  type="email"
                  className="mobile-input"
                  style={{ paddingLeft: '42px' }}
                  placeholder="access@sector.7"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                  PASSWORD
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  className="mobile-input"
                  style={{ paddingLeft: '42px', paddingRight: '42px' }}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={20} className="spin" /> : 'INITIALIZE UPLINK'}
            </button>
          </form>
        )}

        {/* Tab 2: SIGNUP FORM */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                STORE / BUSINESS NAME *
              </label>
              <div style={{ position: 'relative' }}>
                <Building2 size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-primary)' }} />
                <input
                  type="text"
                  className="mobile-input"
                  style={{ paddingLeft: '42px' }}
                  placeholder="Neo-Osaka Print Station"
                  value={signupShopName}
                  onChange={(e) => setSignupShopName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                EMAIL ADDRESS *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-primary)' }} />
                <input
                  type="email"
                  className="mobile-input"
                  style={{ paddingLeft: '42px' }}
                  placeholder="owner@printpro.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                PHONE NUMBER
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-primary)' }} />
                <input
                  type="tel"
                  className="mobile-input"
                  style={{ paddingLeft: '42px' }}
                  placeholder="+91 9876543210"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                PASSWORD *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-primary)' }} />
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  className="mobile-input"
                  style={{ paddingLeft: '42px', paddingRight: '42px' }}
                  placeholder="At least 6 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
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

            <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isSubmitting} style={{ marginTop: '8px' }}>
              {isSubmitting ? <Loader2 size={20} className="spin" /> : 'CREATE MERCHANT ACCOUNT'}
            </button>
          </form>
        )}

        {/* OAuth Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 16px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>OR OAUTH UPLINK</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            className="mobile-btn mobile-btn-secondary"
            disabled={loadingProvider !== null}
            onClick={() => handleOAuthLogin('Google', signInWithGoogle)}
            style={{ fontSize: '0.85rem' }}
          >
            Google
          </button>
          <button
            className="mobile-btn mobile-btn-secondary"
            disabled={loadingProvider !== null}
            onClick={() => handleOAuthLogin('GitHub', signInWithGitHub)}
            style={{ fontSize: '0.85rem' }}
          >
            <Github size={16} /> GitHub
          </button>
        </div>

        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div className="bottom-sheet-overlay" onClick={() => setShowForgotModal(false)}>
            <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
              <div className="bottom-sheet-drag-handle" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
                Reset Merchant Password
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Enter your registered merchant email address to receive password reset instructions.
              </p>
              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input
                  type="email"
                  className="mobile-input"
                  placeholder="merchant@printpro.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
                <button type="submit" className="mobile-btn mobile-btn-primary">
                  Send Recovery Link
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
