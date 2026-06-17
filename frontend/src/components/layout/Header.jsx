import React, { useState } from 'react'
import { Search, Bell, PlusSquare, LogOut, User } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'

const Header = () => {
  const { currentUser, logout, notifications = [], markNotificationRead, markAllNotificationsRead } = useAppContext()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const unreadNotifications = notifications.filter(n => !n.read)

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
        <button className="header-menu-btn" type="button" aria-label="Toggle menu">
          <PlusSquare size={18} />
        </button>
        <div className="header-title">PrintPro Business Manager</div>
      </div>
      <div className="header-right">
        <form className="header-search" onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center' }}>
          <Search size={16} style={{ flexShrink: 0 }} />
          <input
            type="search"
            placeholder="Search bills, customers, inventory…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', flex: 1, color: 'inherit', fontSize: '0.875rem' }}
          />
        </form>
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
            <Bell />
            {unreadNotifications.length > 0 && <span className="notification-badge-count">{unreadNotifications.length}</span>}
          </button>
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-xl)',
                width: '340px',
                zIndex: 1000,
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.15), 0 8px 32px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Notifications</span>
                {unreadNotifications.length > 0 && (
                  <button
                    onClick={() => markAllNotificationsRead()}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px 0' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: note.read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontWeight: note.read ? 500 : 600, fontSize: '13px', color: note.read ? 'var(--text-secondary)' : 'var(--text-primary)', wordBreak: 'break-word' }}>
                          {note.title}
                        </span>
                        {!note.read && (
                          <button
                            onClick={() => markNotificationRead(note.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              fontSize: '10px',
                              cursor: 'pointer',
                              padding: '2px 6px',
                              borderRadius: '2px',
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              flexShrink: 0,
                            }}
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {note.message}
                      </p>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.8 }}>
                        {note.date}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', textAlign: 'center', background: 'var(--bg-card)' }}>
                <button
                  onClick={() => {
                    navigate('/notifications')
                    setShowNotifications(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            className="header-icon-btn"
            type="button"
            aria-label="User menu"
            onClick={() => {
              setShowUserMenu(!showUserMenu)
              setShowNotifications(false)
            }}
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
            <span style={{ fontSize: '12px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.username}</span>
          </button>
          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-xl)',
                minWidth: '220px',
                zIndex: 1000,
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.15), 0 8px 32px rgba(0,0,0,0.6)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)' }}>
                {currentUser?.avatarUrl && (
                  <img
                    src={currentUser.avatarUrl}
                    alt="User avatar"
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                  />
                )}
                <div>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>Logged in as</div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', wordBreak: 'break-all' }}>{currentUser?.username}</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>Role: {currentUser?.role}</div>
                </div>
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
