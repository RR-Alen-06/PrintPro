import React, { useRef, useState } from 'react'
import { Download, Upload, Trash2, CheckCircle } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { createFullBackup, exportBillsToCSV, exportCustomersToCSV, exportInventoryToCSV, exportPaymentsToCSV, exportToJSON } from '../utils/dataExport'
import { importFromJSON, importCustomersFromCSV, importInventoryFromCSV, importFromCSV, validateBackupFile, restoreFromBackup } from '../utils/dataImport'

const DataManagement = () => {
  const { business, customers, inventory, bills, payments, settings, addCustomer, updateInventoryItem, addInventoryItem } = useAppContext()
  const [exportMessage, setExportMessage] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importType, setImportType] = useState('backup')
  const fileInputRef = useRef(null)

  const handleFullBackup = () => {
    const appState = { business, customers, inventory, bills, payments, settings }
    createFullBackup(appState)
    setExportMessage('✓ Full backup downloaded successfully')
    setTimeout(() => setExportMessage(''), 3000)
  }

  const handleExportBills = () => {
    exportBillsToCSV(bills)
    setExportMessage('✓ Bills exported to CSV')
    setTimeout(() => setExportMessage(''), 3000)
  }

  const handleExportCustomers = () => {
    exportCustomersToCSV(customers)
    setExportMessage('✓ Customers exported to CSV')
    setTimeout(() => setExportMessage(''), 3000)
  }

  const handleExportInventory = () => {
    exportInventoryToCSV(inventory)
    setExportMessage('✓ Inventory exported to CSV')
    setTimeout(() => setExportMessage(''), 3000)
  }

  const handleExportPayments = () => {
    exportPaymentsToCSV(payments)
    setExportMessage('✓ Payments exported to CSV')
    setTimeout(() => setExportMessage(''), 3000)
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (importType === 'backup') {
        const data = await importFromJSON(file)
        if (!validateBackupFile(data)) {
          throw new Error('Invalid backup file format')
        }
        const restored = restoreFromBackup(data)
        setImportMessage('✓ Backup restored successfully (requires page reload)')
        localStorage.setItem('printpro-state', JSON.stringify(restored))
        setTimeout(() => window.location.reload(), 2000)
      } else if (importType === 'customers') {
        const data = await importFromCSV(file)
        const customers = importCustomersFromCSV(data)
        customers.forEach((customer) => addCustomer(customer))
        setImportMessage(`✓ ${customers.length} customers imported successfully`)
        setTimeout(() => setImportMessage(''), 3000)
      } else if (importType === 'inventory') {
        const data = await importFromCSV(file)
        const items = importInventoryFromCSV(data)
        items.forEach((item) => addInventoryItem(item))
        setImportMessage(`✓ ${items.length} inventory items imported successfully`)
        setTimeout(() => setImportMessage(''), 3000)
      }
    } catch (error) {
      setImportMessage(`✗ Error: ${error.message}`)
      setTimeout(() => setImportMessage(''), 3000)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Data Management</h1>
        <p>Backup, export, and import data for safety and migration.</p>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* Export Section */}
        <div className="card">
          <div className="bill-view-header">
            <div>
              <h2>Export Data</h2>
              <p className="text-muted">Download your data in JSON or CSV format</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn btn-primary" onClick={handleFullBackup}>
              <Download size={16} /> Full Backup (JSON)
            </button>
            <p className="text-muted" style={{ fontSize: '12px' }}>Complete backup of all data including settings</p>

            <hr style={{ margin: '16px 0', opacity: 0.2 }} />

            <button className="btn btn-secondary" onClick={handleExportBills}>
              <Download size={16} /> Bills (CSV)
            </button>

            <button className="btn btn-secondary" onClick={handleExportCustomers}>
              <Download size={16} /> Customers (CSV)
            </button>

            <button className="btn btn-secondary" onClick={handleExportInventory}>
              <Download size={16} /> Inventory (CSV)
            </button>

            <button className="btn btn-secondary" onClick={handleExportPayments}>
              <Download size={16} /> Payments (CSV)
            </button>

            {exportMessage && (
              <div style={{ padding: '12px', backgroundColor: '#10b981', borderRadius: '4px', color: '#fff', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <CheckCircle size={16} /> {exportMessage}
              </div>
            )}
          </div>
        </div>

        {/* Import Section */}
        <div className="card">
          <div className="bill-view-header">
            <div>
              <h2>Import Data</h2>
              <p className="text-muted">Upload JSON/CSV files to restore or bulk add data</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Import Type</label>
              <select className="form-select" value={importType} onChange={(e) => setImportType(e.target.value)}>
                <option value="backup">Full Backup (JSON)</option>
                <option value="customers">Customers (CSV)</option>
                <option value="inventory">Inventory (CSV)</option>
              </select>
              <p className="text-muted" style={{ fontSize: '12px', marginTop: '8px' }}>
                {importType === 'backup'
                  ? 'Upload a JSON backup file to restore all data'
                  : importType === 'customers'
                    ? 'Upload CSV with columns: Type, Name, Phone, Email, Credit Balance, Status'
                    : 'Upload CSV with columns: Name, Color Single, Color Double, B/W Single, B/W Double, Stock'}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={importType === 'backup' ? '.json' : '.csv'}
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />

            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} /> Choose File
            </button>

            {importMessage && (
              <div style={{ padding: '12px', backgroundColor: importMessage.includes('✓') ? '#10b981' : '#ef4444', borderRadius: '4px', color: '#fff' }}>
                {importMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Data Backup Guide</h2>
        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
          <div>
            <h4>Regular Backups</h4>
            <p className="text-muted">Create a full JSON backup weekly and store it safely. This includes all bills, customers, payments, and settings.</p>
          </div>
          <div>
            <h4>CSV Exports</h4>
            <p className="text-muted">Export individual modules (bills, customers, inventory, payments) for analysis in Excel or other tools.</p>
          </div>
          <div>
            <h4>Bulk Import</h4>
            <p className="text-muted">Use CSV import to quickly add multiple customers or inventory items at once. Prepare your data in Excel and export as CSV.</p>
          </div>
          <div>
            <h4>Recovery</h4>
            <p className="text-muted">To restore from a backup, upload the JSON file. Your current data will be replaced completely. Always verify backups before restoring.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DataManagement
