import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Package,
  Users,
  DollarSign,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

interface NotificationDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const {
    notifications = [],
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
  } = useAppContext()

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all')

  const unreadCount = useMemo(() => {
    return notifications.filter((n: any) => !n.read).length
  }, [notifications])

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((n: any) => !n.read)
    }
    return notifications
  }, [notifications, activeFilter])

  const getNotificationIcon = (item: any) => {
    const type = item.type || 'info'
    const title = (item.title || item.message || '').toLowerCase()

    if (title.includes('stock') || title.includes('inventory')) {
      return <Package size={16} style={{ color: '#a855f7' }} />
    }
    if (title.includes('bill') || title.includes('invoice')) {
      return <Receipt size={16} style={{ color: '#00f0ff' }} />
    }
    if (title.includes('customer') || title.includes('client')) {
      return <Users size={16} style={{ color: '#3b82f6' }} />
    }
    if (title.includes('payment') || title.includes('expense') || title.includes('cash')) {
      return <DollarSign size={16} style={{ color: '#00ffab' }} />
    }

    switch (type) {
      case 'warning':
        return <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
      case 'error':
        return <AlertCircle size={16} style={{ color: '#ef4444' }} />
      case 'success':
        return <CheckCircle2 size={16} style={{ color: '#00ffab' }} />
      default:
        return <Info size={16} style={{ color: '#00f0ff' }} />
    }
  }

  const handleNotificationClick = (item: any) => {
    if (!item.read && markNotificationRead) {
      markNotificationRead(item.id)
    }

    const text = `${item.title || ''} ${item.message || ''}`.toLowerCase()
    if (text.includes('stock') || text.includes('inventory')) {
      navigate('/inventory')
    } else if (text.includes('bill') || text.includes('invoice')) {
      navigate('/billing')
    } else if (text.includes('customer') || text.includes('advance')) {
      navigate('/customers')
    } else if (text.includes('expense') || text.includes('cashbook') || text.includes('z-report')) {
      navigate('/accounting')
    } else if (text.includes('backup')) {
      navigate('/settings?tab=backup')
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 1, 15, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        className="aurora-glass-card"
        style={{
          width: '420px',
          maxWidth: '100vw',
          height: '100%',
          background: 'linear-gradient(180deg, rgba(18, 9, 34, 0.96) 0%, rgba(8, 3, 18, 0.98) 100%)',
          borderLeft: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(0, 240, 255, 0.15)',
                border: '1px solid var(--aurora-cyan, #00f0ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--aurora-cyan, #00f0ff)',
              }}
            >
              <Bell size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(255, 47, 176, 0.2)',
                      border: '1px solid var(--aurora-pink, #ff2fb0)',
                      color: 'var(--aurora-pink, #ff2fb0)',
                      padding: '1px 6px',
                      borderRadius: '999px',
                      fontWeight: 700,
                    }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                System events, inventory alerts & updates
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Controls & Filters */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveFilter('all')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: activeFilter === 'all' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                color: activeFilter === 'all' ? '#00f0ff' : '#94a3b8',
                fontSize: '0.75rem',
                fontWeight: activeFilter === 'all' ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveFilter('unread')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: activeFilter === 'unread' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                color: activeFilter === 'unread' ? '#00f0ff' : '#94a3b8',
                fontSize: '0.75rem',
                fontWeight: activeFilter === 'unread' ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead?.()}
                title="Mark all as read"
                className="aurora-btn-glass"
                style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <CheckCheck size={13} />
                <span>Mark Read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={() => clearAllNotifications?.()}
                title="Clear all notifications"
                className="aurora-btn-glass"
                style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications Scroll List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredNotifications.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8' }}>
              <Bell size={32} style={{ opacity: 0.3, margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>All Caught Up!</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                {activeFilter === 'unread' ? 'No unread notifications.' : 'No notification history found.'}
              </div>
            </div>
          ) : (
            filteredNotifications.map((n: any) => {
              const isUnread = !n.read
              const timeStr = n.timestamp || n.created_at || 'Recently'

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: isUnread ? 'rgba(0, 240, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                    border: isUnread ? '1px solid rgba(0, 240, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getNotificationIcon(n)}
                      <span style={{ fontSize: '0.88rem', fontWeight: isUnread ? 700 : 600, color: '#f8fafc' }}>
                        {n.title || 'System Notification'}
                      </span>
                      {isUnread && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--aurora-cyan, #00f0ff)',
                            boxShadow: '0 0 6px var(--aurora-cyan, #00f0ff)',
                          }}
                        />
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification?.(n.id)
                      }}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {n.message}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {timeStr}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--aurora-cyan, #00f0ff)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>View</span>
                      <ArrowRight size={11} />
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
