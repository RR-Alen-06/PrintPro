import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { useNotifications, useNotificationMutations } from '../hooks/useNotificationsQuery'
import {
  Bell, Check, CheckCheck, Trash2, AlertTriangle,
  CreditCard, Clock, Info, ExternalLink, XCircle, ArrowUpRight
} from 'lucide-react'
import EmptyState from '../components/common/EmptyState'

const NotificationsPage = () => {
  const navigate = useNavigate()
  const { notifications: contextNotifications = [], showToast } = useAppContext()
  const { notifications: serverNotifications = [], isLoading } = useNotifications()
  const { markRead, markAllRead, deleteNotification, clearAllNotifications } = useNotificationMutations()

  const [activeTab, setActiveTab] = useState('all') // 'all' | 'unread' | 'payments' | 'alerts' | 'system'

  const notifications = serverNotifications.length > 0 ? serverNotifications : contextNotifications

  const counts = {
    all: notifications.length,
    unread: notifications.filter((n) => !n.read).length,
    payments: notifications.filter((n) => {
      const t = (n.type || '').toLowerCase()
      const title = (n.title || '').toLowerCase()
      return t === 'payment' || t === 'success' || title.includes('payment') || title.includes('deposit') || title.includes('paid')
    }).length,
    alerts: notifications.filter((n) => {
      const t = (n.type || '').toLowerCase()
      const title = (n.title || '').toLowerCase()
      return t === 'warning' || t === 'alert' || title.includes('due') || title.includes('overdue') || title.includes('pending')
    }).length,
    system: notifications.filter((n) => {
      const t = (n.type || '').toLowerCase()
      return t === 'info' || t === 'system'
    }).length,
  }

  const filteredNotifications = useMemo(() => {
    return notifications.filter((note) => {
      if (activeTab === 'unread') return !note.read
      if (activeTab === 'payments') {
        const t = (note.type || '').toLowerCase()
        const title = (note.title || '').toLowerCase()
        return t === 'payment' || t === 'success' || title.includes('payment') || title.includes('deposit') || title.includes('paid')
      }
      if (activeTab === 'alerts') {
        const t = (note.type || '').toLowerCase()
        const title = (note.title || '').toLowerCase()
        return t === 'warning' || t === 'alert' || title.includes('due') || title.includes('overdue') || title.includes('pending')
      }
      if (activeTab === 'system') {
        const t = (note.type || '').toLowerCase()
        return t === 'info' || t === 'system'
      }
      return true
    })
  }, [notifications, activeTab])

  const getVisuals = (note) => {
    const t = (note.type || '').toLowerCase()
    const title = (note.title || '').toLowerCase()

    if (t === 'payment' || t === 'success' || title.includes('payment') || title.includes('deposit')) {
      return {
        icon: CreditCard,
        color: 'var(--aurora-green, #10b981)',
        bg: 'rgba(16, 185, 129, 0.12)',
        badge: 'PAYMENT',
      }
    }
    if (t === 'warning' || t === 'alert' || title.includes('due') || title.includes('overdue') || title.includes('pending')) {
      return {
        icon: AlertTriangle,
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)',
        badge: 'ALERT',
      }
    }
    return {
      icon: Info,
      color: 'var(--aurora-cyan, #00f0ff)',
      bg: 'rgba(0, 240, 255, 0.12)',
      badge: 'SYSTEM',
    }
  }

  const handleOpenLink = (note) => {
    if (!note.read) {
      markRead(note.id)
    }

    if (note.link || note.path) {
      navigate(note.link || note.path)
      return
    }

    if (note.entityType === 'bill' && note.entityId) {
      navigate(`/receipt?id=${note.entityId}`)
      return
    }

    if (note.entityType === 'customer' && note.entityId) {
      navigate(`/customer-ledger?customerId=${note.entityId}`)
      return
    }

    if (note.entityType === 'expense') {
      navigate('/accounting')
      return
    }

    if (note.entityType === 'advance') {
      navigate('/advance-payments')
    }
  }

  const handleMarkAll = async () => {
    await markAllRead()
    if (showToast) showToast('All notifications marked as read', 'success')
  }

  const handleClear = async () => {
    if (window.confirm('Clear all notifications from your notification center?')) {
      await clearAllNotifications()
      if (showToast) showToast('Notification center cleared', 'info')
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Notification Center</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
            Real-time business events, payment confirmations, ledger reminders, and system alerts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {counts.unread > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleMarkAll} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCheck size={15} /> Mark All as Read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={handleClear} style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash2 size={15} /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="card" style={{ marginBottom: '20px', padding: '8px 16px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {[
            { id: 'all', label: 'All Events', count: counts.all },
            { id: 'unread', label: 'Unread', count: counts.unread },
            { id: 'payments', label: 'Payments', count: counts.payments },
            { id: 'alerts', label: 'Alerts & Due', count: counts.alerts },
            { id: 'system', label: 'System', count: counts.system },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                className={`btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '10px',
                  padding: '7px 14px',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                    fontFamily: 'monospace',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Notifications List */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {filteredNotifications.length === 0 ? (
          <div style={{ padding: '48px 24px' }}>
            <EmptyState
              Icon={Bell}
              title={activeTab === 'unread' ? 'No Unread Notifications' : 'No Notifications in this Category'}
              description={activeTab === 'unread' ? 'You are all caught up!' : 'No business events match your active filter.'}
              actionText="View All Notifications"
              onAction={() => setActiveTab('all')}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredNotifications.map((note) => {
              const visual = getVisuals(note)
              const Icon = visual.icon
              const hasLink = Boolean(note.link || note.path || note.entityType)

              return (
                <div
                  key={note.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: note.read ? 'transparent' : 'rgba(255, 47, 176, 0.04)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = note.read ? 'transparent' : 'rgba(255, 47, 176, 0.04)')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: visual.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: visual.color,
                      }}
                    >
                      <Icon size={18} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: visual.bg, color: visual.color, letterSpacing: '0.04em' }}>
                          {visual.badge}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: note.read ? 600 : 800, color: note.read ? 'var(--text-secondary)' : '#ffffff' }}>
                          {note.title}
                        </h4>
                        {!note.read && (
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary, #ff2fb0)' }} />
                        )}
                      </div>

                      <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {note.message}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {note.date || 'Today'} {note.time ? `• ${note.time}` : ''}
                        </span>
                        {hasLink && (
                          <button
                            onClick={() => handleOpenLink(note)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-secondary, #00f0ff)',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            Open linked record <ArrowUpRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {!note.read && (
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Mark as Read"
                        onClick={() => markRead(note.id)}
                        style={{ padding: '6px' }}
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Dismiss"
                      onClick={() => deleteNotification(note.id)}
                      style={{ padding: '6px', color: '#ef4444' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationsPage
