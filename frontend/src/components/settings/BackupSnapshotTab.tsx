import React, { useState, useEffect } from 'react'
import {
  Database,
  Download,
  Upload,
  HardDrive,
  CloudCheck,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Layers,
  Sparkles,
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { useInventory, usePayments, useAdvancePayments } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'
import { useGroupBills } from '../../hooks/useGroupBillsQuery'
import { createFullBackup, exportToJSON } from '../../utils/dataExport'
import { importFromJSON, validateBackupFile, restoreFromBackup } from '../../utils/dataImport'
import { useQueryClient } from '@tanstack/react-query'

export const BackupSnapshotTab: React.FC = () => {
  const queryClient = useQueryClient()
  const {
    currentUser,
    business,
    customers: ctxCustomers = [],
    customerGroups: ctxGroups = [],
    inventory: ctxInventory = [],
    bills: ctxBills = [],
    payments: ctxPayments = [],
    expenses: ctxExpenses = [],
    advancePayments: ctxAdvances = [],
    counters = {},
    sequences = {},
    settings = {},
    showToast,
  } = useAppContext()

  const { data: serverBills } = useBills()
  const { data: serverCustomers } = useCustomers()
  const { data: serverInventory } = useInventory()
  const { data: serverPayments } = usePayments()
  const { data: serverExpenses } = useExpenses()
  const { data: serverAdvances } = useAdvancePayments()
  const { groupBills: serverGroups } = useGroupBills()

  const bills = serverBills || ctxBills
  const customers = serverCustomers || ctxCustomers
  const inventory = serverInventory || ctxInventory
  const payments = serverPayments || ctxPayments
  const expenses = serverExpenses || ctxExpenses
  const advances = serverAdvances || ctxAdvances
  const groups = serverGroups || ctxGroups

  // Storage estimation state
  const [storageStats, setStorageStats] = useState<{
    usedBytes: number
    quotaBytes: number
    usagePct: number
    itemCount: number
  }>({
    usedBytes: 0,
    quotaBytes: 10 * 1024 * 1024, // 10 MB default estimate
    usagePct: 0,
    itemCount: 0,
  })

  const [isExporting, setIsExporting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreModalData, setRestoreModalData] = useState<any>(null)
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return localStorage.getItem('printpro-last-backup-at') || null
  })

  // Calculate local storage footprint
  useEffect(() => {
    let totalBytes = 0
    let totalItems = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('printpro') || key.startsWith('offline_queue'))) {
        const val = localStorage.getItem(key) || ''
        totalBytes += (key.length + val.length) * 2 // UTF-16 approx 2 bytes
        totalItems++
      }
    }

    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        const used = est.usage || totalBytes
        const quota = est.quota || 10 * 1024 * 1024
        const pct = Math.min(100, Math.round((used / quota) * 100))
        setStorageStats({
          usedBytes: used,
          quotaBytes: quota,
          usagePct: pct,
          itemCount: totalItems,
        })
      }).catch(() => {
        const fallbackQuota = 10 * 1024 * 1024
        setStorageStats({
          usedBytes: totalBytes,
          quotaBytes: fallbackQuota,
          usagePct: Math.min(100, Math.round((totalBytes / fallbackQuota) * 100)),
          itemCount: totalItems,
        })
      })
    } else {
      const fallbackQuota = 10 * 1024 * 1024
      setStorageStats({
        usedBytes: totalBytes,
        quotaBytes: fallbackQuota,
        usagePct: Math.min(100, Math.round((totalBytes / fallbackQuota) * 100)),
        itemCount: totalItems,
      })
    }
  }, [bills, customers, inventory, payments])

  const handleInstantSnapshot = async () => {
    try {
      setIsExporting(true)
      const stateToExport = {
        currentUser,
        business,
        customers,
        customerGroups: groups,
        inventory,
        bills,
        payments,
        expenses,
        advancePayments: advances,
        counters,
        sequences,
        settings,
      }

      const backup = createFullBackup(stateToExport)
      const dateStr = new Date().toISOString().split('T')[0]
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-')
      const filename = `PrintPro_Snapshot_${dateStr}_${timeStr}.json`

      exportToJSON(backup, filename)
      const nowFormatted = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
      localStorage.setItem('printpro-last-backup-at', nowFormatted)
      setLastBackupTime(nowFormatted)
      showToast?.('JSON Cloud Snapshot generated and downloaded successfully!', 'success')
    } catch (err: any) {
      console.error(err)
      showToast?.(`Snapshot failed: ${err.message || err}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileSelectForRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const parsedData = await importFromJSON(file)
      const validation = validateBackupFile(parsedData)
      if (!validation.isValid) {
        showToast?.(`Invalid backup file: ${validation.errors.join(', ')}`, 'error')
        return
      }

      setRestoreModalData({
        file,
        data: parsedData,
        validation,
      })
    } catch (err: any) {
      console.error(err)
      showToast?.(`Could not read file: ${err.message || err}`, 'error')
    } finally {
      e.target.value = ''
    }
  }

  const handleConfirmRestore = async () => {
    if (!restoreModalData?.data) return
    try {
      setIsRestoring(true)
      showToast?.('Restoring entities into system state...', 'info')
      await restoreFromBackup(restoreModalData.data)
      queryClient.invalidateQueries()
      showToast?.('System restored successfully! Reloading in 1s...', 'success')
      setRestoreModalData(null)
      setTimeout(() => window.location.reload(), 1200)
    } catch (err: any) {
      console.error(err)
      showToast?.(`Restore failed: ${err.message || err}`, 'error')
    } finally {
      setIsRestoring(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero Header & Diagnostics */}
      <div
        className="aurora-glass-card"
        style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(112, 0, 255, 0.08) 100%)',
          border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(0, 240, 255, 0.15)',
                  border: '1px solid var(--aurora-cyan, #00f0ff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--aurora-cyan, #00f0ff)',
                }}
              >
                <Database size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
                  Cloud & Local Backup Center
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
                  Enterprise snapshots, storage diagnostics & complete database recovery
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label
              className="aurora-btn-glass"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem',
              }}
            >
              <Upload size={16} />
              <span>Restore Backup</span>
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileSelectForRestore}
              />
            </label>

            <button
              onClick={handleInstantSnapshot}
              disabled={isExporting}
              className="aurora-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: isExporting ? 'not-allowed' : 'pointer',
              }}
            >
              {isExporting ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
              <span>{isExporting ? 'Creating Snapshot...' : '1-Click Full Snapshot'}</span>
            </button>
          </div>
        </div>

        {/* Live Storage Diagnostic Gauge */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            background: 'rgba(10, 5, 20, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={18} style={{ color: 'var(--aurora-cyan, #00f0ff)' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
                Local Storage Footprint:
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', fontFamily: 'var(--font-mono)' }}>
                {formatBytes(storageStats.usedBytes)} used of ~{formatBytes(storageStats.quotaBytes)} capacity
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {lastBackupTime ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--aurora-green, #00ffab)' }}>
                  <ShieldCheck size={14} />
                  <span>Last Snapshot: {lastBackupTime}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--warning, #f59e0b)' }}>
                  <AlertTriangle size={14} />
                  <span>No backup recorded yet</span>
                </div>
              )}
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: storageStats.usagePct > 80 ? 'var(--error, #ef4444)' : 'var(--aurora-cyan, #00f0ff)',
                }}
              >
                {storageStats.usagePct}%
              </span>
            </div>
          </div>

          {/* Progress Bar Gauge */}
          <div
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(2, storageStats.usagePct)}%`,
                height: '100%',
                borderRadius: '999px',
                background:
                  storageStats.usagePct > 80
                    ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                    : 'linear-gradient(90deg, #00f0ff, #7000ff)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Snapshot Inventory Card Matrix */}
      <div>
        <h4 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)' }}>
          Included Data Entities in Snapshot
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          {[
            { label: 'Invoices & Bills', count: bills.length, icon: FileJson, color: '#00f0ff' },
            { label: 'Customers Registry', count: customers.length, icon: Layers, color: '#3b82f6' },
            { label: 'Inventory Items', count: inventory.length, icon: Layers, color: '#a855f7' },
            { label: 'Payments & Receipts', count: payments.length, icon: FileJson, color: '#00ffab' },
            { label: 'Expenses Records', count: expenses.length, icon: Layers, color: '#f59e0b' },
            { label: 'Advance Deposits', count: advances.length, icon: FileJson, color: '#ec4899' },
          ].map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className="aurora-glass-card"
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: `${item.color}1a`,
                    border: `1px solid ${item.color}4d`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.color,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)', fontFamily: 'var(--font-mono)' }}>
                    {item.count}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreModalData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 1, 15, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="aurora-glass-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '28px',
              borderRadius: '20px',
              background: 'linear-gradient(180deg, #140d28 0%, #0a0515 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(0, 240, 255, 0.15)',
                  border: '1px solid var(--aurora-cyan, #00f0ff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--aurora-cyan, #00f0ff)',
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                  Confirm Database Restore
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Target file: {restoreModalData.file?.name}
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: 'var(--warning, #f59e0b)',
                fontSize: '0.85rem',
                lineHeight: 1.4,
              }}
            >
              <strong>Notice:</strong> Restoring this snapshot will merge or replace corresponding state entities. Ensure current transactions are saved.
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setRestoreModalData(null)}
                disabled={isRestoring}
                className="aurora-btn-glass"
                style={{ padding: '9px 18px', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="aurora-btn-primary"
                style={{
                  padding: '9px 22px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #00f0ff 0%, #7000ff 100%)',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isRestoring ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
                <span>{isRestoring ? 'Restoring System...' : 'Confirm Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
