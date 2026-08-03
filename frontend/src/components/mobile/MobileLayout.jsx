import React from 'react'
import MobileHeader from './MobileHeader'
import MobileBottomNav from './MobileBottomNav'
import '../../styles/mobile.css'

export default function MobileLayout({ title, onSwitchToDesktop, children }) {
  return (
    <div className="mobile-shell">
      <MobileHeader title={title} onSwitchToDesktop={onSwitchToDesktop} />
      <main className="mobile-content" style={{ padding: '16px' }}>
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}
