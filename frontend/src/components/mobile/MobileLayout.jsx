import React from 'react'
import MobileHeader from './MobileHeader'
import MobileBottomNav from './MobileBottomNav'
import '../../styles/mobile.css'

export default function MobileLayout({ title, children }) {
  return (
    <div className="mobile-shell">
      <MobileHeader title={title} />
      <main className="mobile-content">
        <div className="mobile-content-inner">
          {children}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  )
}

