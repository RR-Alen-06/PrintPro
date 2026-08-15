import React from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { CheckCircle2, Loader2, AlertCircle, WifiOff } from 'lucide-react'
import '../../styles/aurora.css'

export default function SyncStatusPill({ style = {} }) {
  const isFetching = useIsFetching()
  const isMutating = useIsMutating()
  const [isOnline, setIsOnline] = React.useState(navigator.onLine)

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOnline) {
    return (
      <div className="aurora-sync-pill aurora-sync-pill-pending" style={style} title="Operating offline - local changes will sync when reconnected">
        <WifiOff size={13} />
        <span>OFFLINE</span>
      </div>
    )
  }

  if (isFetching > 0 || isMutating > 0) {
    return (
      <div className="aurora-sync-pill aurora-sync-pill-syncing" style={style} title="Synchronizing live multi-tenant state with Supabase">
        <Loader2 size={13} className="spin" />
        <span>SYNCING...</span>
      </div>
    )
  }

  return (
    <div className="aurora-sync-pill aurora-sync-pill-synced" style={style} title="All multi-tenant queries synced and up to date">
      <CheckCircle2 size={13} />
      <span>CLOUD SYNCED</span>
    </div>
  )
}
