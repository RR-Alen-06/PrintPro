import React, { useRef, useState } from 'react'
import { Download, Upload, CheckCircle } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { createFullBackup, exportBillsToCSV, exportCustomersToCSV, exportInventoryToCSV, exportPaymentsToCSV, exportExpensesToCSV } from '../utils/dataExport'
import { importFromJSON, importCustomersFromCSV, importInventoryFromCSV, importFromCSV, validateBackupFile, restoreFromBackup } from '../utils/dataImport'

const DataManagement = () => {
  const { business, customers, inventory, bills, payments, expenses, settings, addCustomer, addInventoryItem } = useAppContext()
  const [exportMessage, setExportMessage] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importType, setImportType] = useState('backup')
  const fileInputRef = useRef(null)

  const showExport = (msg) => { setExportMessage(msg); setTimeout(() => setExportMessage(''), 4000) }
  const showImport = (msg) => { setImportMessage(msg); setTimeout(() => setImportMessage(''), 4000) }

  const handleFullBackup = () => {
    const appState = { business, customers, inventory, bills, payments, expenses, settings }
    createFullBackup(appState)
    showExport('✓ Full backup downloaded successfully')
  }

  const handleExportBills = () => {
    const active = bills.filter((b) => !b.deleted)
    exportBillsToCSV(active)
    showExport(`✓ ${active.length} bills exported to CSV`)
  }

  const handleExportCustomers = () => {
    exportCustomersToCSV(customers)
    showExport(`✓ ${customers.length} customers exported to CSV`)
  }

  const handleExportInventory = () => {
    exportInventoryToCSV(inventory)
    showExport(`✓ ${inventory.length} inventory items exported to CSV`)
  }

  const handleExportPayments = () => {
    exportPaymentsToCSV(payments)
    showExport(`✓ ${payments.length} payments exported to CSV`)
  }

  const handleExportExpenses = () => {
    exportExpensesToCSV(expenses || [])
    showExport(`✓ ${(expenses || []).length} expenses exported to CSV`)
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (importType === 'backup') {
        const data = await importFromJSON(file)
        if (!validateBackupFile(data)) throw new Error('Invalid backup file format')
        const restored = restoreFromBackup(data)
        showImport('✓ Backup restored — reloading in 2s…')
        localStorage.setItem('printpro-state', JSON.stringify(restored))
        setTimeout(() => window.location.reload(), 2000)
      } else if (importType === 'customers') {
        const data = await importFromCSV(file)
        const imported = importCustomersFromCSV(data)
        imported.forEach((c) => addCustomer(c))
        showImport(`✓ ${imported.length} customers imported successfully`)
      } else if (importType === 'inventory') {
        const data = await importFromCSV(file)
        const items = importInventoryFromCSV(data)
        items.forEach((item) => addInventoryItem(item))
        showImport(`✓ ${items.length} inventory items imported successfully`)
      }
    } catch (error) {
      showImport(`✗ Error: ${error.message}`)
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const exportItems = [
    { label: 'Bills (CSV)', count: bills.filter((b) => !b.deleted).length, action: handleExportBills, desc: 'All active bills with full details' },
    { label: 'Customers (CSV)', count: customers.length, action: handleExportCustomers, desc: 'All customers with contact & balance info' },
    { label: 'Payments (CSV)', count: payments.length, action: handleExportPayments, desc: 'All payment records with cash/UPI split' },
    { label: 'Expenses (CSV)', count: (expenses || []).length, action: handleExportExpenses, desc: 'All expenses with cash/UPI breakdown' },
    { label: 'Inventory (CSV)', count: inventory.length, action: handleExportInventory, desc: 'Item pricing list' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>Data Management</h1>
        <p>Backup, export, and import your data safely.</p>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* Export */}
        <div className="card">
          <div style={{ marginBottom: '16px' }}>
            <h2>Export Data</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>Download data in JSON or CSV format for backup or analysis.</p>
          </div>

          <button className="btn btn-primary" onClick={handleFullBackup} style={{ width: '100%', marginBottom: '8px' }}>
            <Download size={16} /> Full Backup (JSON)
          </button>
          <p className="text-muted" style={{ fontSize: '0.78rem', marginBottom: '16px' }}>
            Complete backup of all data including settings, expenses, and users.
          </p>

          <hr style={{ margin: '8px 0 16px', opacity: 0.15 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {exportItems.map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.desc} · <strong>{item.count}</strong> rows</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={item.action}>
                  <Download size={14} /> Export
                </button>
              </div>
            ))}
          </div>

          {exportMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginTop: '16px', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem' }}>
              <CheckCircle size={16} /> {exportMessage}
            </div>
          )}
        </div>

        {/* Import */}
        <div className="card">
          <div style={{ marginBottom: '16px' }}>
            <h2>Import Data</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>Upload JSON/CSV to restore or bulk-add data.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Import Type</label>
            <select className="form-select" value={importType} onChange={(e) => setImportType(e.target.value)}>
              <option value="backup">Full Backup (JSON) — restores everything</option>
              <option value="customers">Customers (CSV)</option>
              <option value="inventory">Inventory (CSV)</option>
            </select>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {importType === 'backup' && (
              <><strong>Format:</strong> JSON backup from this app. <span style={{ color: 'var(--error)' }}>⚠ Replaces all current data.</span></>
            )}
            {importType === 'customers' && (
              <><strong>Columns:</strong> Type, Name, Phone, Email, Credit Balance</>
            )}
            {importType === 'inventory' && (
              <><strong>Columns:</strong> Name, Color Single, Color Double, B/W Single, B/W Double</>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={importType === 'backup' ? '.json' : '.csv'}
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />

          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} style={{ width: '100%' }}>
            <Upload size={16} /> Choose File & Import
          </button>

          {importMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginTop: '16px', background: importMessage.includes('✓') ? 'var(--success-bg)' : 'var(--error-bg)', border: `1px solid ${importMessage.includes('✓') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 'var(--radius-md)', color: importMessage.includes('✓') ? 'var(--success)' : 'var(--error)', fontSize: '0.875rem' }}>
              {importMessage}
            </div>
          )}
        </div>
      </div>

      {/* Guide */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Backup Guide</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { title: 'Regular Backups', desc: 'Create a JSON backup weekly. It includes all bills, customers, payments, expenses, and settings.' },
            { title: 'CSV Exports', desc: 'Export individual modules for Excel analysis. Each file includes all relevant columns.' },
            { title: 'Bulk Import', desc: 'Use CSV import to add multiple customers or inventory items at once from Excel.' },
            { title: 'Recovery', desc: 'Upload a JSON backup to restore everything. Current data will be replaced — always verify first.' },
          ].map((item) => (
            <div key={item.title} style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>{item.title}</div>
              <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DataManagement
