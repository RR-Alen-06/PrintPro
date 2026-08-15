import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import {
  Bell, Check, CheckCheck, Trash2, AlertTriangle, Info,
  Clock, CheckCircle2, Package, CreditCard, Sparkles, Inbox
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileNotifications() {
  const navigate = useNavigate()
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    showToast
  } = useAppContext()

  const [filter, setFilter] = useState('all') // 'all' | 'unread' | 'read'

  const allNotifications = useMemo(() => notifications || [], [notifications])
  const unreadCount = useMemo(
    () => allNotifications.filter((n) => !n.read).length,
    [allNotifications]
  )
  const readCount = useMemo(
    () => allNotifications.filter((n) => n.read).length,
    [allNotifications]
  )

  const filteredNotifications = useMemo(() => {
    return allNotifications.filter((n) => {
      if (filter === 'unread') return !n.read
      if (filter === 'read') return n.read
      return true
    })
  }, [allNotifications, filter])

  const handleMarkAllRead = () => {
    if (markAllNotificationsRead) {
      markAllNotificationsRead()
      showToast('All notifications marked as read', 'success')
    }
  }

  const handleClearAll = () => {
    if (window.confirm('Clear all notifications from inbox?')) {
      if (clearAllNotifications) {
        clearAllNotifications()
        showToast('Notification inbox cleared', 'info')
      }
    }
  }

  const handleMarkRead = (id) => {
    if (markNotificationRead) {
      markNotificationRead(id)
    }
  }

  const handleDelete = (id, e) => {
    e.stopPropagation()
    if (deleteNotification) {
      deleteNotification(id)
      showToast('Notification removed', 'info')
    }
  }

  const getNotificationVisuals = (notif) => {
    const type = notif.type || 'info'
    const title = (notif.title || '').toLowerCase()

    if (type === 'warning' || title.includes('stock') || title.includes('alert')) {
      return {
        icon: AlertTriangle,
        color: 'var(--warning)',
        bg: 'rgba(255, 184, 0, 0.15)',
        border: 'var(--warning)',
        badge: 'ALERT',
        badgeClass: 'mobile-badge-warning'
      }
    }
    if (type === 'success' || title.includes('payment') || title.includes('received')) {
      return {
        icon: CreditCard,
        color: 'var(--success)',
        bg: 'rgba(0, 255, 171, 0.15)',
        border: 'var(--success)',
        badge: 'PAYMENT',
        badgeClass: 'mobile-badge-success'
      }
    }
    if (title.includes('reminder') || title.includes('balance') || title.includes('due')) {
      return {
        icon: Clock,
        color: 'var(--accent-tertiary)',
        bg: 'rgba(168, 85, 247, 0.15)',
        border: 'var(--accent-tertiary)',
        badge: 'REMINDER',
        badgeClass: 'mobile-badge-info'
      }
    }
    return {
      icon: Info,
      color: 'var(--accent-secondary)',
      bg: 'rgba(0, 240, 255, 0.15)',
      border: 'var(--accent-secondary)',
      badge: 'SYSTEM',
      badgeClass: 'mobile-badge-info'
    }
  }

  return (
    <MobileLayout title="System Notifications" onSwitchToDesktop={() => navigate('/notifications')}>
      {/* Top Banner Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)', letterSpacing: '0.08em' }}>
            ACTIVITY & DISPATCH TERMINAL
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '2px 0 0 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            NOTIFICATIONS
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-primary)',
                  color: '#05040a',
                  fontWeight: 900,
                  boxShadow: '0 0 10px rgba(255, 47, 176, 0.5)'
                }}
              >
                {unreadCount} UNREAD
              </span>
            )}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {unreadCount > 0 && (
            <button
              className="mobile-btn mobile-btn-secondary"
              onClick={handleMarkAllRead}
              style={{ width: 'auto', padding: '0 10px', minHeight: '34px', fontSize: '0.75rem' }}
              title="Mark all as read"
            >
              <CheckCheck size={14} /> Mark Read
            </button>
          )}
          {allNotifications.length > 0 && (
            <button
              className="mobile-btn mobile-btn-secondary"
              onClick={handleClearAll}
              style={{ width: 'auto', padding: '0 8px', minHeight: '34px', color: 'var(--error)' }}
              title="Clear inbox"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Selector Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {[
          { id: 'all', label: `All (${allNotifications.length})` },
          { id: 'unread', label: `Unread (${unreadCount})` },
          { id: 'read', label: `Read (${readCount})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: filter === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: filter === t.id ? 'rgba(255, 47, 176, 0.18)' : 'var(--bg-card)',
              color: filter === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              boxShadow: filter === t.id ? '0 0 8px rgba(255, 47, 176, 0.3)' : 'none',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
          <Inbox size={42} style={{ color: 'var(--accent-secondary)', opacity: 0.5, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 800 }}>
            Inbox All Caught Up
          </h4>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            {filter === 'unread'
              ? 'No unread notifications right now.'
              : 'No system notifications match this filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredNotifications.map((notif) => {
            const isUnread = !notif.read
            const visuals = getNotificationVisuals(notif)
            const IconComponent = visuals.icon

            return (
              <div
                key={notif.id}
                className="mobile-card"
                style={{
                  position: 'relative',
                  borderLeft: isUnread ? `4px solid ${visuals.border}` : '1px solid var(--border)',
                  background: isUnread ? 'rgba(20, 10, 38, 0.9)' : 'rgba(15, 10, 25, 0.45)',
                  boxShadow: isUnread ? `0 0 12px ${visuals.bg}` : 'none',
                  opacity: isUnread ? 1 : 0.72,
                  padding: '12px 14px',
                  transition: 'var(--transition)'
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* Icon Box */}
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      background: visuals.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: visuals.color,
                      flexShrink: 0
                    }}
                  >
                    <IconComponent size={18} />
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <span className={`mobile-badge ${visuals.badgeClass}`} style={{ fontSize: '0.65rem' }}>
                        {visuals.badge}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace' }}>
                        {notif.time || notif.date || 'Just now'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.92rem', fontWeight: isUnread ? 800 : 600, color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.35 }}>
                      {notif.title || notif.message}
                    </div>

                    {notif.body && notif.body !== notif.title && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3 }}>
                        {notif.body}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
                  {isUnread ? (
                    <button
                      className="mobile-btn mobile-btn-secondary"
                      onClick={() => handleMarkRead(notif.id)}
                      style={{
                        width: 'auto',
                        padding: '0 10px',
                        minHeight: '30px',
                        fontSize: '0.72rem',
                        color: 'var(--accent-secondary)',
                        borderColor: 'var(--accent-secondary)'
                      }}
                    >
                      <Check size={13} /> Mark Read
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                      READ
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDelete(notif.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title="Delete Notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </MobileLayout>
  )
}
