import React, { useState, useEffect, useRef } from 'react'
import { Search, Bell, Plus, LogOut, User, Menu, CloudOff, Sun, Moon, Check, Trash2 } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate } from 'react-router-dom'

const Header = ({ onMenuClick }) => {
  const {
    currentUser,
    logout,
    notifications = [],
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    offlineQueue = []
  } = useAppContext()
  
  const { resolvedTheme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)

  const unreadNotifications = notifications.filter(n => !n.read)

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      navigate('/search')
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        <button className="header-menu-btn" type="button" aria-label="Toggle menu" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <div className="header-title">
          PrintPro <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '6px' }}>POS</span>
        </div>
      </div>

      <div className="header-right">
        {/* Pending Offline Sync Badge */}
        {offlineQueue.length > 0 && (
          <div
            className="offline-sync-badge"
            title="Changes queued locally. They will sync automatically when online."
          >
            <CloudOff size={14} />
            <span>{offlineQueue.length} {offlineQueue.length === 1 ? 'change' : 'changes'} pending</span>
          </div>
        )}

        {/* Google Stitch Search Bar */}
        <form className="header-search" onSubmit={handleSearch}>
          <Search />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search bills, customers, items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="header-search-shortcut" title="Press ⌘K or Ctrl+K to search">⌘K</span>
        </form>

        {/* Quick New Bill Button */}
        <button
          className="btn btn-tonal btn-sm"
          type="button"
          onClick={() => navigate('/billing')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
        >
          <Plus size={15} />
          <span>New Bill</span>
        </button>

        {/* Theme Toggle Button (Light/Dark) */}
        <button
          className="header-icon-btn"
          type="button"
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
        >
          {resolvedTheme === 'dark' ? (
            <Sun size={18} style={{ color: '#fbbf24' }} />
          ) : (
            <Moon size={18} style={{ color: 'var(--accent)' }} />
          )}
        </button>

        {/* Notifications Popover */}
        <div style={{ position: 'relative' }}>
          <button
            className="header-icon-btn"
            type="button"
            aria-label="Notifications"
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowUserMenu(false)
            }}
          >
            <Bell size={18} />
            {unreadNotifications.length > 0 && (
              <span className="notification-badge-count">
                {unreadNotifications.length > 99 ? '99+' : unreadNotifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              className="stitch-popover"
              style={{
                width: '360px',
                maxWidth: 'calc(100vw - 32px)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-elevated)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Notifications</span>
                  {unreadNotifications.length > 0 && (
                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                      {unreadNotifications.length} new
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {unreadNotifications.length > 0 && (
                    <button
                      onClick={() => markAllNotificationsRead()}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', fontSize: '0.75rem', color: 'var(--accent)' }}
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={() => clearAllNotifications()}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', fontSize: '0.75rem', color: 'var(--error)' }}
                      title="Clear all notifications"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '6px 0' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No notifications right now.
                  </div>
                ) : (
                  notifications.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: note.read ? 'transparent' : 'var(--accent-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <span
                          style={{
                            fontWeight: note.read ? 600 : 700,
                            fontSize: '0.86rem',
                            color: 'var(--text-primary)',
                            wordBreak: 'break-word',
                          }}
                        >
                          {note.title}
                        </span>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                          {!note.read && (
                            <button
                              onClick={() => markNotificationRead(note.id)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--accent)' }}
                            >
                              <Check size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(note.id)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}
                            title="Dismiss"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {note.message}
                      </p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {note.date}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', padding: '6px' }}>
                <button
                  onClick={() => {
                    navigate('/notifications')
                    setShowNotifications(false)
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'center', fontWeight: 600 }}
                >
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Account Chip */}
        <div style={{ position: 'relative' }}>
          <button
            className="header-user-chip"
            type="button"
            aria-label="User account"
            onClick={() => {
              setShowUserMenu(!showUserMenu)
              setShowNotifications(false)
            }}
          >
            <div className="header-user-avatar">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.username || 'User'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <User size={15} />
              )}
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.username || 'Owner'}
            </span>
          </button>

          {showUserMenu && (
            <div
              className="stitch-popover"
              style={{
                minWidth: '230px',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--accent-surface)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    overflow: 'hidden',
                  }}
                >
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="User avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={18} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUser?.username}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {currentUser?.role === 'owner' || !currentUser?.role ? 'Administrator' : currentUser.role}
                  </div>
                </div>
              </div>

              <div style={{ padding: '6px' }}>
                <button
                  onClick={() => {
                    navigate('/settings')
                    setShowUserMenu(false)
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px' }}
                >
                  Account Settings
                </button>
                <button
                  onClick={() => {
                    logout()
                    setShowUserMenu(false)
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', color: 'var(--error)' }}
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
