import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import { useInventory, useInventoryMutations, usePayments } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { jsPDF } from 'jspdf'
import {
  Database, Download, Upload, RefreshCw, Trash2, FileSpreadsheet,
  FileText, Calendar, CheckCircle, AlertTriangle, Layers, Loader2
} from 'lucide-react'
import {
  createFullBackup, exportBillsToCSV, exportCustomersToCSV,
  exportInventoryToCSV, exportPaymentsToCSV, exportExpensesToCSV
} from '../../utils/dataExport'
import {
  importFromJSON, importCustomersFromCSV, importInventoryFromCSV,
  importFromCSV, validateBackupFile, restoreFromBackup
} from '../../utils/dataImport'
import '../../styles/mobile.css'

export default function MobileDataManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    business, settings, syncFromCloud, showToast, addCustomer: contextAddCustomer, addInventoryItem: contextAddInventoryItem
  } = useAppContext()

  // TanStack Queries & Mutations
  const { data: bills = [] } = useBills()
  const { data: customers = [] } = useCustomers()
  const { data: inventory = [] } = useInventory()
  const { data: payments = [] } = usePayments()
  const { data: expenses = [] } = useExpenses()
  const { createCustomer: createCustomerMutation } = useCustomerMutations()
  const { createItem: createInventoryMutation } = useInventoryMutations()

  const [isSyncing, setIsSyncing] = useState(false)
  const [importType, setImportType] = useState('backup') // 'backup' | 'customers' | 'inventory'
  const [showImportSheet, setShowImportSheet] = useState(false)
  const [showReportSheet, setShowReportSheet] = useState(false)
  const [reportPeriod, setReportPeriod] = useState('all') // 'all'|'daily'|'weekly'|'monthly'|'quarterly'|'yearly'|'custom'
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedReportEntity, setSelectedReportEntity] = useState('bills') // 'bills'|'customers'|'payments'|'expenses'

  const fileInputRef = useRef(null)

  // 1. Export JSON Full Backup
  const handleFullBackup = () => {
    try {
      const appState = { business, customers, inventory, bills, payments, expenses, settings }
      createFullBackup(appState)
      showToast('Full JSON Backup downloaded successfully', 'success')
    } catch (e) {
      showToast('Failed to create backup', 'error')
    }
  }

  // 2. CSV Exports
  const handleExportCSV = (entity) => {
    try {
      if (entity === 'bills') {
        const active = (bills || []).filter((b) => !b.deleted && !b.deleted_at)
        exportBillsToCSV(active)
        showToast(`${active.length} bills exported to CSV`, 'success')
      } else if (entity === 'customers') {
        exportCustomersToCSV(customers || [])
        showToast(`${(customers || []).length} customers exported to CSV`, 'success')
      } else if (entity === 'inventory') {
        exportInventoryToCSV(inventory || [])
        showToast(`${(inventory || []).length} inventory items exported to CSV`, 'success')
      } else if (entity === 'payments') {
        exportPaymentsToCSV(payments || [])
        showToast(`${(payments || []).length} payments exported to CSV`, 'success')
      } else if (entity === 'expenses') {
        exportExpensesToCSV(expenses || [])
        showToast(`${(expenses || []).length} expenses exported to CSV`, 'success')
      }
    } catch (e) {
      showToast('CSV export failed', 'error')
    }
  }

  // 3. File Import (JSON backup or CSV)
  const triggerImport = (type) => {
    setImportType(type)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (importType === 'backup') {
        const data = await importFromJSON(file)
        if (!validateBackupFile(data)) throw new Error('Invalid backup format')
        const restored = restoreFromBackup(data)
        const userId = localStorage.getItem('printpro_current_user_id')
        if (userId) {
          localStorage.setItem(`printpro-state:${userId}`, JSON.stringify(restored))
        } else {
          localStorage.setItem('printpro-state', JSON.stringify(restored))
        }
        showToast('Backup restored! Reloading app in 2s...', 'success')
        setTimeout(() => window.location.reload(), 2000)
      } else if (importType === 'customers') {
        const data = await importFromCSV(file)
        const imported = importCustomersFromCSV(data)
        for (const c of imported) {
          try {
            await createCustomerMutation(c)
          } catch (mErr) {
            console.error('Customer import mutation notice:', mErr)
          }
          if (contextAddCustomer) await contextAddCustomer(c)
        }
        showToast(`${imported.length} customers imported successfully`, 'success')
      } else if (importType === 'inventory') {
        const data = await importFromCSV(file)
        const items = importInventoryFromCSV(data)
        for (const item of items) {
          try {
            await createInventoryMutation(item)
          } catch (mErr) {
            console.error('Inventory import mutation notice:', mErr)
          }
          if (contextAddInventoryItem) await contextAddInventoryItem(item)
        }
        showToast(`${items.length} inventory items imported successfully`, 'success')
      }
      setShowImportSheet(false)
    } catch (error) {
      showToast(`Import Error: ${error.message}`, 'error')
    }
  }

  // 4. Period Filtering for Reports
  const getPeriodRange = (period) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (period === 'daily') {
      return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
    }
    if (period === 'weekly') {
      const day = today.getDay()
      const mon = new Date(today)
      mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      return { start: mon, end: sun }
    }
    if (period === 'monthly') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start, end }
    }
    if (period === 'quarterly') {
      const q = Math.floor(now.getMonth() / 3)
      const start = new Date(now.getFullYear(), q * 3, 1)
      const end = new Date(now.getFullYear(), q * 3 + 3, 0)
      return { start, end }
    }
    if (period === 'yearly') {
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now.getFullYear(), 11, 31)
      return { start, end }
    }
    if (period === 'custom') {
      let start = null
      if (customStartDate) {
        const [y, m, d] = customStartDate.split('-').map(Number)
        start = new Date(y, m - 1, d, 0, 0, 0, 0)
      }
      let end = null
      if (customEndDate) {
        const [y, m, d] = customEndDate.split('-').map(Number)
        end = new Date(y, m - 1, d, 23, 59, 59, 999)
      }
      return { start, end }
    }
    return null
  }

  const filterByPeriod = (items, dateKey) => {
    if (reportPeriod === 'all') return items
    const range = getPeriodRange(reportPeriod)
    if (!range) return items
    return items.filter((item) => {
      const d = item[dateKey] ? new Date(item[dateKey]) : null
      if (!d) return false
      const afterStart = range.start ? d >= range.start : true
      const beforeEnd = range.end ? d <= range.end : true
      return afterStart && beforeEnd
    })
  }

  const generateReportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const MARGIN = 12
      let y = 16

      const fNum = (val) => {
        const num = Number(val)
        return isNaN(num) ? '0.00' : num.toFixed(2)
      }

      let data = []
      let title = ''

      if (selectedReportEntity === 'bills') {
        title = `Bills Report (${reportPeriod.toUpperCase()})`
        data = filterByPeriod((bills || []).filter(b => !b.deleted && !b.deleted_at), 'date')
      } else if (selectedReportEntity === 'customers') {
        title = `Customers Report (${reportPeriod.toUpperCase()})`
        data = filterByPeriod(customers || [], 'createdAt')
      } else if (selectedReportEntity === 'payments') {
        title = `Payments Report (${reportPeriod.toUpperCase()})`
        data = filterByPeriod(payments || [], 'date')
      } else if (selectedReportEntity === 'expenses') {
        title = `Expenses Report (${reportPeriod.toUpperCase()})`
        data = filterByPeriod(expenses || [], 'date')
      }

      // Title
      doc.setFontSize(16)
      doc.setTextColor(30, 41, 59)
      doc.text(title, MARGIN, y)
      y += 8

      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text(`Generated on ${new Date().toLocaleDateString()} | Total Records: ${data.length}`, MARGIN, y)
      y += 10

      // Rows
      doc.setFontSize(9)
      doc.setTextColor(15, 23, 42)

      data.slice(0, 50).forEach((item, idx) => {
        if (y > 180) {
          doc.addPage()
          y = 16
        }
        let line = ''
        if (selectedReportEntity === 'bills') {
          line = `#${item.invoiceNumber || item.invoice_number || item.id} | ${item.customerName || item.customer_name || 'Walk-in'} | Date: ${item.date} | Total: ₹${fNum(item.total)} | Status: ${(item.status || '').toUpperCase()}`
        } else if (selectedReportEntity === 'customers') {
          line = `${item.name} | Phone: ${item.phone || 'N/A'} | Type: ${item.type} | Credit: ₹${fNum(item.creditBalance || item.credit_balance || 0)}`
        } else if (selectedReportEntity === 'payments') {
          line = `Payment #${item.id} | Date: ${item.date?.slice(0,10)} | Paid: ₹${fNum(item.totalPaid || item.total_paid || 0)} | Cash: ₹${fNum(item.cashAmount || item.cash_amount || 0)} | UPI: ₹${fNum(item.upiAmount || item.upi_amount || 0)}`
        } else if (selectedReportEntity === 'expenses') {
          line = `Expense #${item.id} | ${item.category || item.description} | Date: ${item.date} | Amount: ₹${fNum(item.amount)}`
        }
        doc.text(`${idx + 1}. ${line}`, MARGIN, y)
        y += 6
      })

      doc.save(`printpro_${selectedReportEntity}_report_${new Date().toISOString().slice(0,10)}.pdf`)
      showToast('PDF Report downloaded!', 'success')
      setShowReportSheet(false)
    } catch (e) {
      showToast('Failed to generate PDF report', 'error')
    }
  }

  // 5. Force Cloud Sync
  const handleForceSync = async () => {
    setIsSyncing(true)
    try {
      if (syncFromCloud) await syncFromCloud()
      await queryClient.invalidateQueries()
      showToast('Cloud database synchronized', 'success')
    } catch (e) {
      showToast('Sync failed', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <MobileLayout title="Data Management" onSwitchToDesktop={() => navigate('/data-management')}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept={importType === 'backup' ? '.json' : '.csv'}
        onChange={handleImportFile}
      />

      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
          DATABASE CONTROL
        </span>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
          DATA MANAGEMENT
        </h2>
      </div>

      {/* Backup & Restore Master Card */}
      <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <Database size={24} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              FULL SYSTEM BACKUP
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Export / restore entire database as JSON snapshot
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="mobile-btn mobile-btn-primary" onClick={handleFullBackup}>
            <Download size={16} /> Export Full JSON Backup
          </button>
          <button className="mobile-btn mobile-btn-secondary" onClick={() => triggerImport('backup')}>
            <Upload size={16} /> Restore from JSON Backup
          </button>
        </div>
      </div>

      {/* CSV Export & Import Center */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <FileSpreadsheet size={24} style={{ color: 'var(--success)' }} />
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              CSV SPREADSHEETS
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Export entities or import customers & inventory
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <button className="mobile-btn mobile-btn-secondary" onClick={() => handleExportCSV('bills')} style={{ minHeight: '38px', fontSize: '0.78rem' }}>
            <Download size={14} /> Bills CSV
          </button>
          <button className="mobile-btn mobile-btn-secondary" onClick={() => handleExportCSV('customers')} style={{ minHeight: '38px', fontSize: '0.78rem' }}>
            <Download size={14} /> Clients CSV
          </button>
          <button className="mobile-btn mobile-btn-secondary" onClick={() => handleExportCSV('inventory')} style={{ minHeight: '38px', fontSize: '0.78rem' }}>
            <Download size={14} /> Inventory CSV
          </button>
          <button className="mobile-btn mobile-btn-secondary" onClick={() => handleExportCSV('payments')} style={{ minHeight: '38px', fontSize: '0.78rem' }}>
            <Download size={14} /> Payments CSV
          </button>
          <button className="mobile-btn mobile-btn-secondary" onClick={() => handleExportCSV('expenses')} style={{ minHeight: '38px', fontSize: '0.78rem', gridColumn: '1 / -1' }}>
            <Download size={14} /> Expenses CSV
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', gap: '8px' }}>
          <button className="mobile-btn mobile-btn-secondary" onClick={() => triggerImport('customers')} style={{ flex: 1, fontSize: '0.78rem' }}>
            <Upload size={14} /> Import Clients
          </button>
          <button className="mobile-btn mobile-btn-secondary" onClick={() => triggerImport('inventory')} style={{ flex: 1, fontSize: '0.78rem' }}>
            <Upload size={14} /> Import Inventory
          </button>
        </div>
      </div>

      {/* Printable Period Reports Card */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <FileText size={24} style={{ color: 'var(--accent-secondary)' }} />
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              PDF AUDIT REPORTS
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Generate printable executive period reports
            </div>
          </div>
        </div>

        <button className="mobile-btn mobile-btn-secondary" onClick={() => setShowReportSheet(true)}>
          <FileText size={16} /> Configure & Download PDF Report
        </button>
      </div>

      {/* Cloud Re-Sync Card */}
      <div className="mobile-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <RefreshCw size={24} style={{ color: 'var(--info)' }} />
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              CLOUD RE-SYNC
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Force pull latest data from Supabase backend
            </div>
          </div>
        </div>

        <button className="mobile-btn mobile-btn-secondary" onClick={handleForceSync} disabled={isSyncing}>
          <RefreshCw size={16} className={isSyncing ? 'spin' : ''} /> {isSyncing ? 'Syncing...' : 'Force Cloud Sync'}
        </button>
      </div>

      {/* Report Configuration BottomSheet */}
      <BottomSheet isOpen={showReportSheet} onClose={() => setShowReportSheet(false)} title="PDF Report Generator">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              SELECT DATASET
            </label>
            <select
              className="mobile-input"
              value={selectedReportEntity}
              onChange={(e) => setSelectedReportEntity(e.target.value)}
            >
              <option value="bills">Invoices / Bills</option>
              <option value="customers">Customers Directory</option>
              <option value="payments">Payments Received</option>
              <option value="expenses">Operating Expenses</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              TIME PERIOD
            </label>
            <select
              className="mobile-input"
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="daily">Today (Daily)</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="quarterly">This Quarter</option>
              <option value="yearly">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {reportPeriod === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>From</label>
                <input
                  type="date"
                  className="mobile-input"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>To</label>
                <input
                  type="date"
                  className="mobile-input"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <button className="mobile-btn mobile-btn-primary" onClick={generateReportPDF} style={{ marginTop: '8px' }}>
            <Download size={16} /> Generate & Download PDF
          </button>
        </div>
      </BottomSheet>
    </MobileLayout>
  )
}
