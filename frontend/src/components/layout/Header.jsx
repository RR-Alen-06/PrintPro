import React, { useState } from 'react'
import { Search, Bell, PlusSquare, LogOut, User } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

const Header = ({ notificationsCount }) => {
  const { currentUser, logout } = useAppContext()
  const [showUserMenu, setShowUserMenu] = useState(false)

  return (
    <header className="header">
      <div className="header-left">
        <button className="header-menu-btn" type="button" aria-label="Toggle menu">
          <PlusSquare size={18} />
        </button>
        <div className="header-title">PrintPro Business Manager</div>
      </div>
      <div className="header-right">
        <div className="header-search">
          <Search />
          <input type="search" placeholder="Search bills, customers, inventory" />
        </div>
        <button className="header-icon-btn" type="button" aria-label="Notifications">
          <Bell />
          {notificationsCount > 0 && <span className="notification-badge-count">{notificationsCount}</span>}
        </button>
        <div style={{ position: 'relative' }}>
          <button
            className="header-icon-btn"
            type="button"
            aria-label="User menu"
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <User size={18} />
            <span style={{ fontSize: '12px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.username}</span>
          </button>
          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                backgroundColor: 'rgba(30, 30, 30, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                minWidth: '180px',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Logged in as</div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{currentUser?.username}</div>
                <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>Role: {currentUser?.role}</div>
              </div>
              <button
                onClick={() => {
                  logout()
                  setShowUserMenu(false)
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  fontSize: '14px',
                }}
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
