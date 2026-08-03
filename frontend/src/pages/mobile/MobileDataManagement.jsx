import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { clearAllCloudData } from '../../lib/syncService'
import MobileLayout from '../../components/mobile/MobileLayout'
import { Database, Download, Upload, RefreshCw, Trash2, ShieldAlert } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileDataManagement() {
  const navigate = useNavigate()
  const { bills, customers, payments, expenses, syncFromCloud, showToast } = useAppContext()

  const [isSyncing, setIsSyncing] = useState(false)

  // Export JSON Backup
  const handleExportBackup = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      bills: bills || [],
      customers: customers || [],
      payments: payments || [],
      expenses: expenses || []
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `printpro_backup_${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    showToast('JSON Backup downloaded successfully!', 'success')
  }

  // Force Cloud Sync
  const handleForceSync = async () => {
    setIsSyncing(true)
    try {
      if (syncFromCloud) await syncFromCloud()
      showToast('Cloud database synchronized', 'success')
    } catch (e) {
      showToast('Sync failed', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <MobileLayout title="Data Backup & Cloud" onSwitchToDesktop={() => navigate('/data-management')}>
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>DATABASE TERMINAL</span>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>DATA MANAGEMENT</h2>
      </div>

      <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <Database size={24} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>LOCAL BACKUP EXPORT</h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Export full database state as JSON snapshot</div>
          </div>
        </div>

        <button className="mobile-btn mobile-btn-primary" onClick={handleExportBackup}>
          <Download size={18} /> Export Offline Backup (.json)
        </button>
      </div>

      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <RefreshCw size={24} style={{ color: 'var(--accent-secondary)' }} />
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>CLOUD RE-SYNC</h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pull latest changes from Supabase cloud</div>
          </div>
        </div>

        <button className="mobile-btn mobile-btn-secondary" onClick={handleForceSync} disabled={isSyncing}>
          <RefreshCw size={18} className={isSyncing ? 'spin' : ''} /> Force Cloud Sync
        </button>
      </div>
    </MobileLayout>
  )
}
