import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Info, Clock, CheckCircle2 } from 'lucide-react'
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

  const unreadCount = useMemo(
    () => (notifications || []).filter((n) => !n.read).length,
    [notifications]
  )

  const filteredNotifications = useMemo(() => {
    return (notifications || []).filter((n) => {
      if (filter === 'unread') return !n.read
      if (filter === 'read') return n.read
      return true
    })
  }, [notifications, filter])

  const handleMarkAllRead = () => {
    if (markAllNotificationsRead) {
      markAllNotificationsRead()
      showToast('All notifications marked as read', 'success')
    }
  }

  const handleClearAll = () => {
    if (clearAllNotifications) {
      clearAllNotifications()
      showToast('Notification inbox cleared', 'info')
    }
  }

  const handleMarkRead = (id) => {
    if (markNotificationRead) {
      markNotificationRead(id)
    }
  }

  const handleDelete = (id) => {
    if (deleteNotification) {
      deleteNotification(id)
      showToast('Notification deleted', 'info')
    }
  }

  return (
    <MobileLayout title="Notifications" onSwitchToDesktop={() => navigate('/notifications')}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
            ACTIVITY ALERTS
          </span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
            NOTIFICATIONS {unreadCount > 0 && <span style={{ color: 'var(--accent-primary)' }}>({unreadCount})</span>}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {unreadCount > 0 && (
            <button
              className="mobile-btn mobile-btn-secondary"
              onClick={handleMarkAllRead}
              style={{ width: 'auto', padding: '0 10px', minHeight: '34px', fontSize: '0.75rem' }}
            >
              <CheckCheck size={14} /> Mark All Read
            </button>
          )}
          {(notifications || []).length > 0 && (
            <button
              className="mobile-btn mobile-btn-secondary"
              onClick={handleClearAll}
              style={{ width: 'auto', padding: '0 8px', minHeight: '34px', color: 'var(--error)' }}
              title="Clear All"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'all', label: `All (${(notifications || []).length})` },
          { id: 'unread', label: `Unread (${unreadCount})` },
          { id: 'read', label: 'Read' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: filter === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: filter === t.id ? 'rgba(0, 240, 255, 0.12)' : 'var(--bg-input)',
              color: filter === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
          <Bell size={40} style={{ color: 'var(--accent-secondary)', opacity: 0.5, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Notifications</h4>
          <p style={{ margin: 0, fontSize: '0.8rem' }}>
            {filter === 'unread' ? 'You have caught up with all active alerts.' : 'No notification history available.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredNotifications.map((note) => {
            const isUnread = !note.read
            const isAlert = note.type === 'overdue' || note.type === 'stock' || note.type === 'warning'
            return (
              <div
                key={note.id}
                className="mobile-card"
                style={{
                  borderLeft: isUnread ? '3px solid var(--accent-primary)' : '1px solid var(--border)',
                  background: isUnread ? 'rgba(0, 240, 255, 0.03)' : 'var(--bg-card)',
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isAlert ? (
                      <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                    ) : (
                      <Info size={16} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {note.title || 'System Notification'}
                    </span>
                  </div>
                  <span
                    className={`mobile-badge ${isUnread ? 'mobile-badge-info' : 'mobile-badge-success'}`}
                    style={{ fontSize: '0.65rem' }}
                  >
                    {isUnread ? 'NEW' : 'READ'}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '10px' }}>
                  {note.message}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> {note.date || 'Recent'}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isUnread && (
                      <button
                        onClick={() => handleMarkRead(note.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Check size={14} /> Mark Read
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(note.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </MobileLayout>
  )
}
