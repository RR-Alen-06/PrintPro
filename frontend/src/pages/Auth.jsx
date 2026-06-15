import React, { useState } from 'react'
import { LogOut, LogIn, Lock } from 'lucide-react'
import { useAppContext } from '../context/AppContext'

const Auth = () => {
  const { currentUser, users, login, logout } = useAppContext()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const handleLogin = (e) => {
    e.preventDefault()
    setLoginError('')

    const user = users.find((u) => u.username === username && u.password === password)

    if (user) {
      login({ ...user, password: undefined })
      setUsername('')
      setPassword('')
    } else {
      setLoginError('Invalid username or password')
    }
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <div>
      <div className="page-header">
        <h1>User Authentication</h1>
        <p>Manage user login and access control.</p>
      </div>

      {currentUser ? (
        // Logged In View
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', paddingTop: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
            <h2>Welcome, {currentUser.username}!</h2>
            <p className="text-muted">Role: <strong>{currentUser.role}</strong></p>

            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', marginBottom: '24px' }}>
              <h4>User Details</h4>
              <div style={{ textAlign: 'left', display: 'grid', gap: '8px', marginTop: '12px' }}>
                <div>
                  <strong>Username:</strong> {currentUser.username}
                </div>
                <div>
                  <strong>Role:</strong> {currentUser.role === 'admin' ? 'Administrator' : 'Staff'}
                </div>
                <div>
                  <strong>Logged In:</strong> {new Date(currentUser.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            {currentUser.role === 'admin' && (
              <div style={{ padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px', marginBottom: '24px', textAlign: 'left' }}>
                <h4>Admin Controls</h4>
                <p className="text-muted">You have full access to all features including:</p>
                <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                  <li>Billing Management</li>
                  <li>Customer Management</li>
                  <li>Inventory Control</li>
                  <li>Financial Reports</li>
                  <li>Data Backup & Restore</li>
                  <li>User Management</li>
                </ul>
              </div>
            )}

            <button className="btn btn-danger" onClick={handleLogout} style={{ marginTop: '24px', width: '100%' }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      ) : (
        // Login Form View
        <div className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Lock size={32} style={{ margin: '0 auto 12px' }} />
            <h2>Login</h2>
            <p className="text-muted">Enter your credentials to access the system</p>
          </div>

          <form onSubmit={handleLogin} style={{ marginTop: '24px' }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            {loginError && (
              <div style={{ padding: '12px', backgroundColor: '#ef4444', borderRadius: '4px', color: '#fff', marginBottom: '16px' }}>
                {loginError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              <LogIn size={16} /> Login
            </button>
          </form>

          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px' }}>
            <h4>Demo Credentials</h4>
            <p className="text-muted">Username: <code>admin</code></p>
            <p className="text-muted">Password: <code>admin123</code></p>
          </div>

          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'rgba(168, 85, 247, 0.1)', borderRadius: '4px' }}>
            <h4>About Authentication</h4>
            <p className="text-muted" style={{ fontSize: '12px' }}>
              This is a basic authentication system. In production, implement proper backend authentication with secure password hashing and
              session management. Never store passwords in plaintext.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Auth
