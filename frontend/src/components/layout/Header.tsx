import React, { useState, useEffect, useMemo } from 'react'
import { Search, Bell, LogOut, User, Menu } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'
import SyncStatusPill from '../common/SyncStatusPill'
import { CommandPalette } from '../common/CommandPalette'
import { NotificationDrawer } from '../common/NotificationDrawer'

export interface HeaderProps {
  onMenuClick?: () => void
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { currentUser, logout, notifications = [] } = useAppContext()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false)

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      }
    }

    const handleCustomOpenSearch = () => setIsCommandPaletteOpen(true)
    const handleCustomOpenNotifications = () => setIsNotificationDrawerOpen(true)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('open-command-palette', handleCustomOpenSearch)
    window.addEventListener('open-notification-drawer', handleCustomOpenNotifications)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('open-command-palette', handleCustomOpenSearch)
      window.removeEventListener('open-notification-drawer', handleCustomOpenNotifications)
    }
  }, [])

  const unreadNotifications = useMemo(() => {
    return notifications.filter((n: any) => !n.read)
  }, [notifications])

  return (
    <>
      <header
        className="header"
        style={{
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          background: 'rgba(9, 4, 23, 0.82)',
          borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
        }}
      >
        <div className="header-left">
          <button className="header-menu-btn" type="button" aria-label="Toggle menu" onClick={onMenuClick}>
            <Menu size={18} />
          </button>
          <div
            className="header-title"
            style={{
              fontWeight: 800,
              letterSpacing: '-0.01em',
              background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            PrintPro Business Manager
          </div>
        </div>

        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <SyncStatusPill />

          {/* Spotlight Search Launcher */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '7px 14px',
              background: 'rgba(18, 10, 35, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.15s ease',
              width: '240px',
              justifyContent: 'space-between',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.4)'
              e.currentTarget.style.background = 'rgba(25, 14, 45, 0.9)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.background = 'rgba(18, 10, 35, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={15} style={{ color: 'var(--aurora-cyan, #00f0ff)' }} />
              <span>Search or command...</span>
            </div>
            <kbd
              style={{
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                padding: '2px 5px',
                borderRadius: '5px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              ⌘K
            </kbd>
          </button>

          {/* Slide-over Notification Center Trigger */}
          <div style={{ position: 'relative' }}>
            <button
              className="header-icon-btn"
              type="button"
              aria-label="Notifications"
              onClick={() => {
                setIsNotificationDrawerOpen(true)
                setShowUserMenu(false)
              }}
            >
              <Bell size={18} />
              {unreadNotifications.length > 0 && (
                <span className="notification-badge-count">{unreadNotifications.length}</span>
              )}
            </button>
          </div>

          {/* User Account Menu */}
          <div style={{ position: 'relative' }}>
            <button
              className="header-icon-btn"
              type="button"
              aria-label="User menu"
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt="User avatar"
                  style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <User size={18} />
              )}
              <span style={{ fontSize: '12px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser?.username || currentUser?.email?.split('@')[0]}
              </span>
            </button>

            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  backgroundColor: '#15152a',
                  border: '1px solid var(--border-accent, rgba(255, 47, 176, 0.3))',
                  borderRadius: 'var(--radius-xl, 14px)',
                  minWidth: '220px',
                  zIndex: 1000,
                  boxShadow: '0 0 20px rgba(99, 102, 241, 0.15), 0 8px 32px rgba(0,0,0,0.6)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#0e0e1c',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Signed in as</div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#f8fafc', wordBreak: 'break-all' }}>
                      {currentUser?.email || currentUser?.username}
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    setShowUserMenu(false)
                    await logout()
                    navigate('/auth', { replace: true })
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
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Slide-Over Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
      />
    </>
  )
}

export default Header
