import React from 'react'
import { WifiOff } from 'lucide-react'

export const OfflineBanner = () => {
  return (
    <div style={{
      backgroundColor: '#f59e0b',
      color: '#1c1917',
      padding: '8px 16px',
      fontSize: '13px',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      position: 'sticky',
      top: 0,
      zIndex: 99990,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      letterSpacing: '0.01em',
    }}>
      <WifiOff size={16} />
      <span>Offline — changes will sync when reconnected</span>
    </div>
  )
}

export default OfflineBanner
