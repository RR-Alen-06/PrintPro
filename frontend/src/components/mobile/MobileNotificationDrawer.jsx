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
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import BottomSheet from './BottomSheet'

export default function MobileNotificationDrawer({ isOpen, onClose }) {
  const navigate = useNavigate()
  const {
    notifications = [],
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
  } = useAppContext()

  const [activeFilter, setActiveFilter] = useState('all')

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length
  }, [notifications])

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((n) => !n.read)
    }
    return notifications
  }, [notifications, activeFilter])

  const handleNotificationClick = (item) => {
    if (!item.read && markNotificationRead) {
      markNotificationRead(item.id)
    }

    const text = `${item.title || ''} ${item.message || ''}`.toLowerCase()
    if (text.includes('stock') || text.includes('inventory')) {
      navigate('/mobile/inventory')
    } else if (text.includes('bill') || text.includes('invoice')) {
      navigate('/mobile/billing')
    } else if (text.includes('customer') || text.includes('advance')) {
      navigate('/mobile/customers')
    } else if (text.includes('expense') || text.includes('cashbook') || text.includes('z-report')) {
      navigate('/mobile/accounting')
    } else if (text.includes('backup')) {
      navigate('/mobile/settings?tab=backup')
    }
    onClose()
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Notification Center">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Filter & Batch Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveFilter('all')}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: 'none',
                background: activeFilter === 'all' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                color: activeFilter === 'all' ? '#00f0ff' : '#94a3b8',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveFilter('unread')}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: 'none',
                background: activeFilter === 'unread' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                color: activeFilter === 'unread' ? '#00f0ff' : '#94a3b8',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead?.()}
                style={{
                  background: 'none',
                  border: '1px solid rgba(0, 255, 171, 0.3)',
                  color: '#00ffab',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCheck size={12} />
                <span>Mark Read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={() => clearAllNotifications?.()}
                style={{
                  background: 'none',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Scroll list */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredNotifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '0.82rem' }}>
              No notifications to display.
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isUnread = !n.read
              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: isUnread ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                    border: isUnread ? '1px solid rgba(0, 240, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                      {n.title || 'System Notification'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification?.(n.id)
                      }}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.3 }}>
                    {n.message}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
