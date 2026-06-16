import React, { useState } from 'react'
import { LogOut, LogIn, Lock, UserPlus, Trash2, Key, CheckCircle, AlertCircle, Shield } from 'lucide-react'
import { useAppContext } from '../context/AppContext'

const Auth = () => {
  const { currentUser, users, login, logout, addUser, deleteUser, changePassword } = useAppContext()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // Add user form
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('staff')
  const [addUserError, setAddUserError] = useState('')
  const [addUserSuccess, setAddUserSuccess] = useState('')

  // Change password form
  const [cpUserId, setCpUserId] = useState('')
  const [cpNewPass, setCpNewPass] = useState('')
  const [cpConfirmPass, setCpConfirmPass] = useState('')
  const [cpError, setCpError] = useState('')
  const [cpSuccess, setCpSuccess] = useState('')

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

  const handleAddUser = (e) => {
    e.preventDefault()
    setAddUserError('')
    setAddUserSuccess('')
    if (!newUsername.trim()) { setAddUserError('Username is required.'); return }
    if (users.find((u) => u.username === newUsername.trim())) { setAddUserError('Username already exists.'); return }
    if (newPassword.length < 6) { setAddUserError('Password must be at least 6 characters.'); return }

    addUser({ username: newUsername.trim(), password: newPassword, role: newRole })
    setAddUserSuccess(`User "${newUsername.trim()}" added successfully!`)
    setNewUsername('')
    setNewPassword('')
    setNewRole('staff')
    setTimeout(() => setAddUserSuccess(''), 3000)
  }

  const handleDeleteUser = (user) => {
    if (user.id === currentUser?.id) return // cannot delete own account
    if (window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) {
      deleteUser(user.id)
    }
  }

  const handleChangePassword = (e) => {
    e.preventDefault()
    setCpError('')
    setCpSuccess('')
    if (!cpUserId) { setCpError('Select a user.'); return }
    if (cpNewPass.length < 6) { setCpError('Password must be at least 6 characters.'); return }
    if (cpNewPass !== cpConfirmPass) { setCpError('Passwords do not match.'); return }

    changePassword(cpUserId, cpNewPass)
    setCpSuccess('Password changed successfully!')
    setCpUserId('')
    setCpNewPass('')
    setCpConfirmPass('')
    setTimeout(() => setCpSuccess(''), 3000)
  }

  if (!currentUser) {
    return (
      <div>
        <div className="page-header">
          <h1>User Authentication</h1>
          <p>Manage user login and access control.</p>
        </div>

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
              <div style={{ padding: '12px', backgroundColor: '#ef4444', borderRadius: '4px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> {loginError}
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
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>User Authentication</h1>
        <p>Manage users, passwords, and access control.</p>
      </div>

      {/* Current User Info */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--accent-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: '1.25rem', fontWeight: 700 }}>
              {currentUser.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{currentUser.username}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span className={`badge ${currentUser.role === 'admin' ? 'badge-success' : 'badge-info'}`}>
                  {currentUser.role === 'admin' ? '⚙️ Admin' : '👤 Staff'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Logged in since {new Date(currentUser.createdAt || Date.now()).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <button className="btn btn-danger" onClick={() => logout()}>
            <LogOut size={16} /> Logout
          </button>
        </div>

        <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Browser: {navigator.userAgent.split(' ').slice(-2).join(' ')}
        </div>
      </div>

      {/* Admin-only section */}
      {currentUser.role === 'admin' && (
        <>
          {/* User List */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Shield size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ margin: 0 }}>All Users</h2>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {user.username}
                        {user.id === currentUser.id && (
                          <span className="badge badge-info" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>You</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${user.role === 'admin' ? 'badge-success' : 'badge-warning'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: user.id === currentUser.id ? 'var(--text-muted)' : 'var(--error)' }}
                          disabled={user.id === currentUser.id}
                          onClick={() => handleDeleteUser(user)}
                          title={user.id === currentUser.id ? 'Cannot delete your own account' : `Delete ${user.username}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add User */}
          <div className="grid-2" style={{ gap: '24px', marginBottom: '24px' }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <UserPlus size={18} style={{ color: 'var(--accent)' }} />
                <h2 style={{ margin: 0 }}>Add User</h2>
              </div>

              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label className="form-label">Username <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Unique username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>

                {addUserError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.85rem', marginBottom: '12px' }}>
                    <AlertCircle size={14} /> {addUserError}
                  </div>
                )}
                {addUserSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.85rem', marginBottom: '12px' }}>
                    <CheckCircle size={14} /> {addUserSuccess}
                  </div>
                )}

                <button type="submit" className="btn btn-primary">
                  <UserPlus size={16} /> Add User
                </button>
              </form>
            </div>

            {/* Change Password */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Key size={18} style={{ color: 'var(--warning)' }} />
                <h2 style={{ margin: 0 }}>Change Password</h2>
              </div>

              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label className="form-label">Select User</label>
                  <select
                    className="form-select"
                    value={cpUserId}
                    onChange={(e) => setCpUserId(e.target.value)}
                  >
                    <option value="">-- Choose user --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Min 6 characters"
                    value={cpNewPass}
                    onChange={(e) => setCpNewPass(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Re-enter new password"
                    value={cpConfirmPass}
                    onChange={(e) => setCpConfirmPass(e.target.value)}
                  />
                </div>

                {cpError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.85rem', marginBottom: '12px' }}>
                    <AlertCircle size={14} /> {cpError}
                  </div>
                )}
                {cpSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.85rem', marginBottom: '12px' }}>
                    <CheckCircle size={14} /> {cpSuccess}
                  </div>
                )}

                <button type="submit" className="btn btn-primary">
                  <Key size={16} /> Change Password
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {currentUser.role !== 'admin' && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <p className="text-muted">User management is available to admin accounts only.</p>
        </div>
      )}
    </div>
  )
}

export default Auth
