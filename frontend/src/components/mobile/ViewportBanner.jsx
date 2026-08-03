import React from 'react'
import { Monitor, Smartphone, X } from 'lucide-react'

export default function ViewportBanner({ onSwitchToMobile, onDismiss }) {
  return (
    <div className="viewport-banner">
      <div className="viewport-banner-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Smartphone size={18} style={{ color: 'var(--accent)' }} />
        <span>You are on a tablet/mobile screen width. Switch to Mobile View?</span>
      </div>
      <div className="viewport-banner-actions">
        <button
          className="viewport-banner-btn viewport-banner-btn-primary"
          onClick={onSwitchToMobile}
        >
          Switch
        </button>
        <button
          className="viewport-banner-btn viewport-banner-btn-secondary"
          onClick={onDismiss}
          title="Dismiss"
          aria-label="Dismiss banner"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
