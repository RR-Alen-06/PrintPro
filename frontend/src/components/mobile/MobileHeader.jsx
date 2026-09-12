import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { useMutationState } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'

import SyncStatusPill from '../common/SyncStatusPill'

export default function MobileHeader({ title }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAppContext()

  const isMutating = useMutationState({
    filters: { status: 'pending' },
    select: (m) => m.state.status === 'pending'
  }).length > 0

  const isHome = location.pathname === '/mobile/dashboard'

  return (
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

