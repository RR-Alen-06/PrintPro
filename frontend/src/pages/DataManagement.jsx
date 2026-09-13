import React, { useRef, useState, useMemo } from 'react'
import {
  Download, Upload, CheckCircle, X, AlertTriangle, RefreshCw,
  Database, HardDrive, Trash2, ShieldAlert, FileSpreadsheet, Check
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useAppContext } from '../context/AppContext'
import { useBills } from '../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../hooks/useCustomersQuery'
import { usePayments, useInventory, useInventoryMutations, useAdvancePayments } from '../hooks/useEntitiesQuery'
import { useExpenses } from '../hooks/useExpensesQuery'
import { useGroupBills } from '../hooks/useGroupBillsQuery'
import { useQueryClient } from '@tanstack/react-query'

import {
  createFullBackup, exportBillsToCSV, exportCustomersToCSV,
  exportInventoryToCSV, exportPaymentsToCSV, exportExpensesToCSV,
  exportAdvancesToCSV, exportGroupsToCSV
} from '../utils/dataExport'
import {
  importFromJSON, importCustomersFromCSV, importInventoryFromCSV,
  importFromCSV, validateBackupFile, restoreFromBackup
} from '../utils/dataImport'
import { SequenceService } from '../services/sequenceService'
import { clearTransactionRecords } from '../lib/syncService'

const DataManagement = () => {
  const queryClient = useQueryClient()
  const {
    currentUser,
    business,
    customers: contextCustomers = [],
    customerGroups: contextGroups = [],
    inventory: contextInventory = [],
    bills: contextBills = [],
    payments: contextPayments = [],
    expenses: contextExpenses = [],
    advancePayments: contextAdvances = [],
    counters = {},
    sequences = {},
    settings,
    addCustomer,
    addInventoryItem,
    showToast,
  } = useAppContext()

  const { data: serverBills = [] } = useBills()
  const { data: serverCustomers = [] } = useCustomers()
  const { data: serverInventory = [] } = useInventory()
  const { data: serverPayments = [] } = usePayments()
  const { data: serverExpenses = [] } = useExpenses()
  const { data: serverAdvances = [] } = useAdvancePayments()
  const { groupBills: serverGroups = [] } = useGroupBills()

  const { createCustomer: createCustomerMutation } = useCustomerMutations()

  const { createItem: createInventoryMutation } = useInventoryMutations()

  const bills = serverBills.length > 0 ? serverBills : contextBills
  const customers = serverCustomers.length > 0 ? serverCustomers : contextCustomers
  const inventory = serverInventory.length > 0 ? serverInventory : contextInventory
  const payments = serverPayments.length > 0 ? serverPayments : contextPayments
  const expenses = serverExpenses.length > 0 ? serverExpenses : contextExpenses
  const advances = serverAdvances.length > 0 ? serverAdvances : contextAdvances
  const groups = serverGroups.length > 0 ? serverGroups : contextGroups

  const [exportMessage, setExportMessage] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importType, setImportType] = useState('backup')
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportPeriod, setReportPeriod] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [isResyncing, setIsResyncing] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmationText, setResetConfirmationText] = useState('')
  const fileInputRef = useRef(null)

  const showExport = (msg) => {
    setExportMessage(msg)
    if (showToast) showToast(msg, 'success')
    setTimeout(() => setExportMessage(''), 4000)
  }

  const showImport = (msg) => {
    setImportMessage(msg)
    if (showToast) showToast(msg, msg.startsWith('Error') ? 'error' : 'success')
    setTimeout(() => setImportMessage(''), 4000)
  }

  // Calculate approximate storage usage
  const storageStats = useMemo(() => {
    let bytes = 0
    try {
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key) && key.startsWith('printpro')) {
          bytes += (localStorage[key].length + key.length) * 2
        }
      }
    } catch (_) {}
    const kb = (bytes / 1024).toFixed(1)
    const mb = (bytes / (1024 * 1024)).toFixed(2)
    return {
      bytes,
      formatted: bytes > 1024 * 1024 ? `${mb} MB` : `${kb} KB`,
      totalRecords:
        bills.length +
        customers.length +
        inventory.length +
        payments.length +
        expenses.length +
        advances.length +
        groups.length,
    }
  }, [bills, customers, inventory, payments, expenses, advances, groups])

  const handleFullBackup = () => {
    const appState = {
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
    createFullBackup(appState)
    showExport('Complete 8-Entity JSON Backup downloaded successfully')
  }

  const handleExportBills = () => {
    const active = bills.filter((b) => !b.deleted && !b.deleted_at)
    exportBillsToCSV(active)
    showExport(`${active.length} bills exported to CSV`)
  }

  const handleExportCustomers = () => {
    const active = customers.filter((c) => !c.deleted && !c.deleted_at)
    exportCustomersToCSV(active)
    showExport(`${active.length} customers exported to CSV`)
  }

  const handleExportInventory = () => {
    exportInventoryToCSV(inventory)
    showExport(`${inventory.length} inventory items exported to CSV`)
  }

  const handleExportPayments = () => {
    exportPaymentsToCSV(payments)
    showExport(`${payments.length} payments exported to CSV`)
  }

  const handleExportExpenses = () => {
    exportExpensesToCSV(expenses || [])
    showExport(`${(expenses || []).length} expenses exported to CSV`)
  }

  const handleExportAdvances = () => {
    exportAdvancesToCSV(advances || [])
    showExport(`${(advances || []).length} advance deposits exported to CSV`)
  }

  const handleExportGroups = () => {
    exportGroupsToCSV(groups || [])
    showExport(`${(groups || []).length} customer groups exported to CSV`)
  }

  const handleForceResync = async () => {
    setIsResyncing(true)
    try {
      await queryClient.invalidateQueries()
      await queryClient.refetchQueries()
      if (showToast) showToast('All cloud registers synchronized with Supabase', 'success')
    } catch (err) {
      if (showToast) showToast('Resync failed, check network connection', 'error')
    } finally {
      setIsResyncing(false)
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (importType === 'backup') {
        const data = await importFromJSON(file)
        if (!validateBackupFile(data)) throw new Error('Invalid backup file format: missing required ERP registers')
        const restored = restoreFromBackup(data)
        showImport('Backup restored successfully — reloading in 2s…')
        const userKey = currentUser?.id ? `printpro-state:${currentUser.id}` : 'printpro-state'
        localStorage.setItem(userKey, JSON.stringify(restored))
        setTimeout(() => window.location.reload(), 2000)
      } else if (importType === 'customers') {
        const data = await importFromCSV(file)
        const imported = importCustomersFromCSV(data)
        for (const c of imported) {
          try {
            if (createCustomerMutation) await createCustomerMutation(c)
          } catch (_) {}
          if (addCustomer) addCustomer(c)
        }
        showImport(`${imported.length} customers imported and synced`)
      } else if (importType === 'inventory') {
        const data = await importFromCSV(file)
        const items = importInventoryFromCSV(data)
        for (const item of items) {
          try {
            if (createInventoryMutation) await createInventoryMutation(item)
          } catch (_) {}
          if (addInventoryItem) addInventoryItem(item)
        }
        showImport(`${items.length} inventory items imported and synced`)
      }
    } catch (error) {
      showImport(`Error: ${error.message}`)
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleResetTransactions = async () => {
    if (resetConfirmationText.trim().toUpperCase() !== 'RESET') {
      if (showToast) showToast('Type RESET in capital letters to confirm', 'error')
      return
    }

    try {
      if (showToast) showToast('Clearing transaction records from database...', 'info')
      await clearTransactionRecords()

      const userKey = currentUser?.id ? `printpro-state:${currentUser.id}` : 'printpro-state'
      const currentState = JSON.parse(localStorage.getItem(userKey) || '{}')

      const cleanState = {
        ...currentState,
        bills: [],
        payments: [],
        expenses: [],
        advancePayments: [],
        advances: [],
      }

      localStorage.setItem(userKey, JSON.stringify(cleanState))
      queryClient.clear()
      setShowResetModal(false)
      setResetConfirmationText('')
      if (showToast) showToast('Transaction records cleared successfully. Reloading...', 'success')
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      if (showToast) showToast(`Failed to clear transactions: ${err.message}`, 'error')
    }
  }

  const exportItems = [
    { label: 'Invoices & Bills', type: 'bills', count: bills.filter((b) => !b.deleted && !b.deleted_at).length, action: handleExportBills, desc: 'All active bills with line items & paid status' },
    { label: 'Customers & Ledgers', type: 'customers', count: customers.filter((c) => !c.deleted && !c.deleted_at).length, action: handleExportCustomers, desc: 'All customer contact, type & credit balance info' },
    { label: 'Payments Register', type: 'payments', count: payments.length, action: handleExportPayments, desc: 'All payment allocations with Cash/UPI split' },
    { label: 'Expenses & Cashbook', type: 'expenses', count: (expenses || []).length, action: handleExportExpenses, desc: 'All expense vouchers with category breakdown' },
    { label: 'Advance Deposits', type: 'advances', count: (advances || []).length, action: handleExportAdvances, desc: 'All customer advance receipts and balances' },
    { label: 'Customer Groups', type: 'groups', count: (groups || []).length, action: handleExportGroups, desc: 'All corporate group billing accounts and members' },
    { label: 'Inventory & Rates', type: 'inventory', count: inventory.length, action: handleExportInventory, desc: 'Paper pricing catalog (Color & B/W rates)' },
  ]

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Data Management & Backup</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
            Enterprise data security, complete 8-entity backups, CSV exports, and cloud resynchronization.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleForceResync}
            disabled={isResyncing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isResyncing ? 'spin' : ''} />
            {isResyncing ? 'Resyncing...' : 'Force Cloud Resync'}
          </button>
        </div>
      </div>

      {/* Storage Inspector Metrics */}
      <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(20, 10, 38, 0.9) 0%, rgba(30, 15, 55, 0.9) 100%)', border: '1px solid var(--border-accent, rgba(255, 47, 176, 0.3))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(0, 240, 255, 0.15)', color: 'var(--aurora-cyan, #00f0ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HardDrive size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-secondary, #00f0ff)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Local Database & Cache Inspector
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                {storageStats.formatted} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>({storageStats.totalRecords} total records indexed)</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', padding: '6px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>{bills.length}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bills</div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>{customers.length}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Customers</div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>{inventory.length}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Items</div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>{advances.length}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Advances</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* Export Panel */}
        <div className="card">
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Export & Full Backup</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Download complete 8-entity JSON backup or itemized CSV register sheets.
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleFullBackup} style={{ width: '100%', marginBottom: '8px', padding: '12px', fontSize: '0.95rem' }}>
            <Download size={18} /> Full System Backup (8-Entity JSON)
          </button>
          <p className="text-muted" style={{ fontSize: '0.76rem', marginBottom: '16px' }}>
            Preserves Bills, Customers, Groups, Inventory, Payments, Expenses, Advances, and Sequence Counters.
          </p>

          <hr style={{ margin: '8px 0 16px', opacity: 0.15 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {exportItems.map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.label} (CSV)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.desc} · <strong>{item.count}</strong> rows</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={item.action}>
                  <Download size={14} /> Export CSV
                </button>
              </div>
            ))}
          </div>

          {exportMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginTop: '16px', background: 'var(--success-bg, rgba(16,185,129,0.1))', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--aurora-green, #10b981)', fontSize: '0.875rem' }}>
              <CheckCircle size={16} /> {exportMessage}
            </div>
          )}
        </div>

        {/* Import & Recovery Panel */}
        <div className="card">
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Import & Restore</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Restore from full JSON backup or bulk-upload Customer / Inventory CSV records.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Import Type</label>
            <select className="form-select" value={importType} onChange={(e) => setImportType(e.target.value)}>
              <option value="backup">Full Backup (JSON) — Complete System Restoration</option>
              <option value="customers">Customers (CSV) — Bulk Client Import</option>
              <option value="inventory">Inventory Catalog (CSV) — Bulk Pricing Import</option>
            </select>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {importType === 'backup' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span><strong>Full Restoration:</strong> Safely replaces all local registers with backup content and auto-reloads.</span>
              </span>
            )}
            {importType === 'customers' && (
              <><strong>Expected CSV Columns:</strong> Type, Name, Phone, Email, Credit Balance, Status</>
            )}
            {importType === 'inventory' && (
              <><strong>Expected CSV Columns:</strong> Name, Color Single, Color Double, B/W Single, B/W Double</>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={importType === 'backup' ? '.json' : '.csv'}
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />

          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginBottom: '24px' }}
          >
            <Upload size={18} /> Select File to Import ({importType === 'backup' ? '.JSON' : '.CSV'})
          </button>

          {importMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '16px', background: importMessage.startsWith('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: `1px solid ${importMessage.startsWith('Error') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`, borderRadius: 'var(--radius-md)', color: importMessage.startsWith('Error') ? '#ef4444' : '#10b981', fontSize: '0.875rem' }}>
              {importMessage.startsWith('Error') ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
              {importMessage}
            </div>
          )}

          {/* Danger Zone / Safe Clean */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={15} /> Clear Demo Transactions
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Purges demo bills, payments & expenses while keeping shop settings.
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowResetModal(true)}
                style={{ color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}
              >
                Clear Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showResetModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '12px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Confirm Transaction Purge</h3>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '16px' }}>
              This will permanently clear all Bills, Payments, Expenses, and Advance records from the database and local storage. Your customer list, inventory catalog, sequence generator, and shop settings will be preserved.
            </p>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              Type <strong>RESET</strong> to confirm:
            </p>
            <input
              type="text"
              className="form-input"
              value={resetConfirmationText}
              onChange={(e) => setResetConfirmationText(e.target.value)}
              placeholder="RESET"
              style={{ marginBottom: '16px' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowResetModal(false); setResetConfirmationText('') }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleResetTransactions}
                disabled={resetConfirmationText.trim().toUpperCase() !== 'RESET'}
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}
              >
                Purge Transactions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataManagement
