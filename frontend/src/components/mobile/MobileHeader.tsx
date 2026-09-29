import React, { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, LogOut, Search, Bell } from 'lucide-react'
import { useMutationState } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'

import SyncStatusPill from '../common/SyncStatusPill'
import { CommandPalette } from '../common/CommandPalette'
import MobileNotificationDrawer from './MobileNotificationDrawer'

export interface MobileHeaderProps {
  title?: string
}

export default function MobileHeader({ title }: MobileHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, notifications = [] } = useAppContext()

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const isMutating = useMutationState({
    filters: { status: 'pending' },
    select: (m) => m.state.status === 'pending'
  }).length > 0

  const isHome = location.pathname === '/mobile/dashboard'

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length
  }, [notifications])

  return (
    <>
      <header className="mobile-header">
        {isMutating && <div className="mobile-mutation-progress-bar" />}
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
          <h1 className="mobile-header-title mobile-gradient-text">
            {title || 'PrintPro'}
          </h1>
        </div>

        <div className="mobile-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SyncStatusPill style={{ padding: '3px 8px', fontSize: '0.68rem' }} />

          {/* Mobile Spotlight Search Trigger */}
          <button
            className="mobile-icon-btn"
            onClick={() => setIsSearchOpen(true)}
            title="Search"
            aria-label="Search"
          >
            <Search size={18} />
          </button>

          {/* Mobile Notifications Bell Trigger */}
          <button
            className="mobile-icon-btn"
            onClick={() => setIsNotificationsOpen(true)}
            title="Notifications"
            aria-label="Notifications"
            style={{ position: 'relative' }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ff2fb0',
                  boxShadow: '0 0 6px #ff2fb0',
                }}
              />
            )}
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

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Mobile Notification BottomSheet */}
      <MobileNotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </>
  )
}
