import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Monitor, LogOut } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

export default function MobileHeader({ title, onSwitchToDesktop }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAppContext()

  const isHome = location.pathname === '/mobile/dashboard'

  return (
    <header className="mobile-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {!isHome && (
          <button
            className="mobile-icon-btn"
            onClick={() => navigate(-1)}
            aria-label="Go Back"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="mobile-header-title">
          {title || 'PrintPro'}
        </h1>
      </div>

      <div className="mobile-header-actions">
        <button
          className="mobile-icon-btn"
          onClick={onSwitchToDesktop}
          title="Switch to Desktop View"
          aria-label="Switch to Desktop View"
        >
          <Monitor size={18} />
        </button>
        <button
          className="mobile-icon-btn"
          onClick={() => {
            if (logout) logout()
          }}
          title="Logout"
          aria-label="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
