import React, { useRef, useState, useMemo } from 'react'
import {
  Download, Upload, CheckCircle, X, AlertTriangle, RefreshCw,
  Database, HardDrive, Trash2, ShieldAlert, FileSpreadsheet, Check
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useAppContext } from '../context/AppContext'
import { useBills, useBillMutations } from '../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../hooks/useCustomersQuery'
import {
  usePayments,
  useInventory,
  useInventoryMutations,
  usePaymentMutations,
  useAdvancePayments,
  useAdvancePaymentMutations
} from '../hooks/useEntitiesQuery'
import { useExpenses, useExpenseMutations } from '../hooks/useExpensesQuery'
import { useGroupBills, useGroupBillMutations } from '../hooks/useGroupBillsQuery'
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
    showToast,
  } = useAppContext()

  const { data: serverBills, isSuccess: isBillsLoaded } = useBills()
  const { data: serverCustomers, isSuccess: isCustomersLoaded } = useCustomers()
  const { data: serverInventory, isSuccess: isInventoryLoaded } = useInventory()
  const { data: serverPayments, isSuccess: isPaymentsLoaded } = usePayments()
  const { data: serverExpenses, isSuccess: isExpensesLoaded } = useExpenses()
  const { data: serverAdvances, isSuccess: isAdvancesLoaded } = useAdvancePayments()
  const { groupBills: serverGroups, isSuccess: isGroupsLoaded } = useGroupBills()

  const { createCustomer: createCustomerMutation } = useCustomerMutations()
  const { createItem: createInventoryMutation } = useInventoryMutations()
  const { createBill: createBillMutation } = useBillMutations()
  const { createPayment: createPaymentMutation } = usePaymentMutations()
  const { createExpense: createExpenseMutation } = useExpenseMutations()
  const { addAdvancePayment: createAdvanceMutation } = useAdvancePaymentMutations()
  const { createGroupBill: createGroupBillMutation } = useGroupBillMutations()

  // Issue 3: Stale-fallback read pattern removed.
  // Once each query resolves, its server data is the single source of truth (including a correct empty array).
  const bills = isBillsLoaded ? (serverBills || []) : (contextBills || [])
  const customers = isCustomersLoaded ? (serverCustomers || []) : (contextCustomers || [])
  const inventory = isInventoryLoaded ? (serverInventory || []) : (contextInventory || [])
  const payments = isPaymentsLoaded ? (serverPayments || []) : (contextPayments || [])
  const expenses = isExpensesLoaded ? (serverExpenses || []) : (contextExpenses || [])
  const advances = isAdvancesLoaded ? (serverAdvances || []) : (contextAdvances || [])
  const groups = isGroupsLoaded ? (serverGroups || []) : (contextGroups || [])

  const [exportMessage, setExportMessage] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importType, setImportType] = useState('backup')
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState(null)
  const [restoreSummaryModal, setRestoreSummaryModal] = useState(null)
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

  const showImport = (msg, toastType = 'success') => {
    setImportMessage(msg)
    if (showToast) {
      const type = toastType === 'warning' ? 'warning' : (msg.startsWith('Error') || msg.startsWith('Failed') ? 'error' : toastType)
      showToast(msg, type)
    }
    setTimeout(() => setImportMessage(''), 8000)
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

        setIsRestoring(true)
        setRestoreProgress({
          stage: 'Initializing restoration...',
          progress: 5,
          currentEntity: 'Preparing registers',
          processedCount: 0,
          totalCount: 0,
        })

        // Restore strategy: Option (a) - Safe Non-destructive Merge
        // Persists restored records alongside existing backend data using real mutation hooks.
        // ID mapping maintains relational integrity between customers, bills, payments, and groups.
        const idMap = {
          customers: {},
          inventory: {},
          bills: {},
        }

        const stats = {
          customers: { total: (restored.customers || []).length, success: 0, failed: 0 },
          inventory: { total: (restored.inventory || []).length, success: 0, failed: 0 },
          bills: { total: (restored.bills || []).length, success: 0, failed: 0 },
          payments: { total: (restored.payments || []).length, success: 0, failed: 0 },
          expenses: { total: (restored.expenses || []).length, success: 0, failed: 0 },
          advances: { total: (restored.advancePayments || []).length, success: 0, failed: 0 },
          groups: { total: (restored.customerGroups || []).length, success: 0, failed: 0 },
        }

        const totalRecords = Object.values(stats).reduce((acc, s) => acc + s.total, 0)
        let processed = 0
        const failures = []

        const updateProg = (stage, entityName) => {
          const pct = totalRecords > 0 ? Math.min(95, Math.round((processed / totalRecords) * 90) + 5) : 50
          setRestoreProgress({
            stage,
            progress: pct,
            currentEntity: entityName,
            processedCount: processed,
            totalCount: totalRecords,
          })
        }

        // 1. Restore Customers
        const customersList = restored.customers || []
        for (let i = 0; i < customersList.length; i++) {
          const c = customersList[i]
          updateProg(`Restoring customers (${i + 1}/${customersList.length})...`, 'Customers')
          try {
            if (!c.name || !String(c.name).trim()) {
              throw new Error('Customer name missing')
            }
            if (createCustomerMutation) {
              const res = await createCustomerMutation(c)
              const createdId = res?.id || res?.data?.id
              if (c.id && createdId) {
                idMap.customers[c.id] = createdId
              }
            }
            stats.customers.success++
          } catch (err) {
            stats.customers.failed++
            failures.push(`Customer "${c.name || c.id || i + 1}": ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 2. Restore Inventory Items
        const inventoryList = restored.inventory || []
        for (let i = 0; i < inventoryList.length; i++) {
          const item = inventoryList[i]
          updateProg(`Restoring inventory catalog (${i + 1}/${inventoryList.length})...`, 'Inventory')
          try {
            if (!item.name || !String(item.name).trim()) {
              throw new Error('Item name missing')
            }
            if (createInventoryMutation) {
              const res = await createInventoryMutation(item)
              const createdId = res?.id || res?.data?.id
              if (item.id && createdId) {
                idMap.inventory[item.id] = createdId
              }
            }
            stats.inventory.success++
          } catch (err) {
            stats.inventory.failed++
            failures.push(`Inventory "${item.name || item.id || i + 1}": ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 3. Restore Bills
        const billsList = restored.bills || []
        for (let i = 0; i < billsList.length; i++) {
          const b = billsList[i]
          updateProg(`Restoring bills & invoices (${i + 1}/${billsList.length})...`, 'Bills')
          try {
            const rawCustId = b.customerId || b.customer_id
            const mappedCustId = idMap.customers[rawCustId] || rawCustId
            const mappedItems = (b.items || []).map((it) => {
              const rawItemId = it.itemId || it.item_id
              const mappedItemId = idMap.inventory[rawItemId] || rawItemId
              return {
                ...it,
                itemId: mappedItemId,
                item_id: mappedItemId,
              }
            })

            const billPayload = {
              ...b,
              customerId: mappedCustId,
              customer_id: mappedCustId,
              items: mappedItems,
            }

            if (createBillMutation) {
              const res = await createBillMutation(billPayload)
              const createdId = res?.id || res?.data?.id
              if (b.id && createdId) {
                idMap.bills[b.id] = createdId
              }
              if (b.invoiceNumber && createdId) {
                idMap.bills[b.invoiceNumber] = createdId
              }
              if (b.invoice_number && createdId) {
                idMap.bills[b.invoice_number] = createdId
              }
            }
            stats.bills.success++
          } catch (err) {
            stats.bills.failed++
            failures.push(`Bill #${b.invoiceNumber || b.invoice_number || b.id || i + 1}: ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 4. Restore Payments
        const paymentsList = restored.payments || []
        for (let i = 0; i < paymentsList.length; i++) {
          const p = paymentsList[i]
          updateProg(`Restoring payments (${i + 1}/${paymentsList.length})...`, 'Payments')
          try {
            const rawBillId = p.billId || p.bill_id
            const mappedBillId = idMap.bills[rawBillId] || rawBillId
            const rawCustId = p.customerId || p.customer_id
            const mappedCustId = idMap.customers[rawCustId] || rawCustId

            const paymentPayload = {
              ...p,
              billId: mappedBillId,
              bill_id: mappedBillId,
              customerId: mappedCustId,
              customer_id: mappedCustId,
            }

            if (createPaymentMutation) {
              await createPaymentMutation(paymentPayload)
            }
            stats.payments.success++
          } catch (err) {
            stats.payments.failed++
            failures.push(`Payment (₹${p.totalPaid || p.amount || 0} for Bill ${p.invoiceNumber || p.billId || i + 1}): ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 5. Restore Expenses
        const expensesList = restored.expenses || []
        for (let i = 0; i < expensesList.length; i++) {
          const exp = expensesList[i]
          updateProg(`Restoring expenses (${i + 1}/${expensesList.length})...`, 'Expenses')
          try {
            if (createExpenseMutation) {
              await createExpenseMutation(exp)
            }
            stats.expenses.success++
          } catch (err) {
            stats.expenses.failed++
            failures.push(`Expense "${exp.description || exp.item_name || i + 1}": ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 6. Restore Advance Payments
        const advancesList = restored.advancePayments || []
        for (let i = 0; i < advancesList.length; i++) {
          const adv = advancesList[i]
          updateProg(`Restoring advance deposits (${i + 1}/${advancesList.length})...`, 'Advance Payments')
          try {
            const rawCustId = adv.customerId || adv.customer_id
            const mappedCustId = idMap.customers[rawCustId] || rawCustId

            const advPayload = {
              ...adv,
              customerId: mappedCustId,
              customer_id: mappedCustId,
            }

            if (createAdvanceMutation) {
              await createAdvanceMutation(advPayload)
            }
            stats.advances.success++
          } catch (err) {
            stats.advances.failed++
            failures.push(`Advance Deposit (₹${adv.amount || 0} for Customer ${adv.customerName || adv.customerId || i + 1}): ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 7. Restore Group Bills
        const groupsList = restored.customerGroups || []
        for (let i = 0; i < groupsList.length; i++) {
          const grp = groupsList[i]
          updateProg(`Restoring customer groups (${i + 1}/${groupsList.length})...`, 'Customer Groups')
          try {
            const mappedMemberBillIds = (grp.memberBillIds || grp.member_bill_ids || []).map(
              (bid) => idMap.bills[bid] || bid
            )
            const groupPayload = {
              ...grp,
              memberBillIds: mappedMemberBillIds,
              member_bill_ids: mappedMemberBillIds,
            }

            if (createGroupBillMutation) {
              await createGroupBillMutation(groupPayload)
            }
            stats.groups.success++
          } catch (err) {
            stats.groups.failed++
            failures.push(`Group "${grp.name || grp.id || i + 1}": ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // Synchronize local sequence & settings state in localStorage
        const userKey = currentUser?.id ? `printpro-state:${currentUser.id}` : 'printpro-state'
        const existingLocal = JSON.parse(localStorage.getItem(userKey) || '{}')
        const updatedLocal = {
          ...existingLocal,
          business: restored.business && Object.keys(restored.business).length > 0 ? restored.business : existingLocal.business,
          settings: restored.settings && Object.keys(restored.settings).length > 0 ? restored.settings : existingLocal.settings,
          counters: restored.counters && Object.keys(restored.counters).length > 0 ? restored.counters : existingLocal.counters,
          sequences: restored.sequences && Object.keys(restored.sequences).length > 0 ? restored.sequences : existingLocal.sequences,
        }
        localStorage.setItem(userKey, JSON.stringify(updatedLocal))

        // Invalidate all query caches to ensure fresh data from Supabase/Backend
        await queryClient.invalidateQueries()

        setRestoreProgress({
          stage: 'Restoration completed!',
          progress: 100,
          currentEntity: 'Completed',
          processedCount: processed,
          totalCount: totalRecords,
        })

        const totalSuccess = Object.values(stats).reduce((acc, s) => acc + s.success, 0)
        const summaryData = {
          stats,
          totalRecords,
          totalSuccess,
          failures,
        }

        setRestoreSummaryModal(summaryData)

        if (failures.length === 0) {
          showImport(`Backup restored successfully: all ${totalSuccess} records persisted to database. Reloading in 3s…`)
          setTimeout(() => window.location.reload(), 3000)
        } else {
          showImport(`Backup restored with warnings: ${totalSuccess} of ${totalRecords} records persisted, ${failures.length} failed. See details.`, 'warning')
        }
      } else if (importType === 'customers') {
        const data = await importFromCSV(file)
        const imported = importCustomersFromCSV(data)
        let successCount = 0
        const failures = []

        for (let i = 0; i < imported.length; i++) {
          const c = imported[i]
          try {
            if (!c.name || !String(c.name).trim()) {
              throw new Error('Customer name is required')
            }
            if (createCustomerMutation) {
              await createCustomerMutation(c)
            }
            successCount++
          } catch (err) {
            const label = c.name ? `"${c.name}"` : `Row ${i + 1}`
            const reason = err?.response?.data?.message || err?.message || 'Failed to save'
            failures.push(`${label}: ${reason}`)
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['customers'] })

        if (failures.length === 0) {
          showImport(`Successfully imported and persisted all ${successCount} customers to database.`)
        } else if (successCount > 0) {
          showImport(`${successCount} of ${imported.length} customers imported. ${failures.length} failed: ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? ` (+${failures.length - 3} more)` : ''}`, 'warning')
        } else {
          showImport(`Failed to import customers (0 of ${imported.length} succeeded): ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? ` (+${failures.length - 3} more)` : ''}`, 'error')
        }
      } else if (importType === 'inventory') {
        const data = await importFromCSV(file)
        const items = importInventoryFromCSV(data)
        let successCount = 0
        const failures = []

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          try {
            if (!item.name || !String(item.name).trim()) {
              throw new Error('Item name is required')
            }
            if (createInventoryMutation) {
              await createInventoryMutation(item)
            }
            successCount++
          } catch (err) {
            const label = item.name ? `"${item.name}"` : `Row ${i + 1}`
            const reason = err?.response?.data?.message || err?.message || 'Failed to save'
            failures.push(`${label}: ${reason}`)
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['inventory'] })

        if (failures.length === 0) {
          showImport(`Successfully imported and persisted all ${successCount} inventory items to database.`)
        } else if (successCount > 0) {
          showImport(`${successCount} of ${items.length} inventory items imported. ${failures.length} failed: ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? ` (+${failures.length - 3} more)` : ''}`, 'warning')
        } else {
          showImport(`Failed to import inventory items (0 of ${items.length} succeeded): ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? ` (+${failures.length - 3} more)` : ''}`, 'error')
        }
      }
    } catch (error) {
      showImport(`Error: ${error.message}`, 'error')
    } finally {
      setIsRestoring(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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
    { label: 'Invoices & Bills', type: 'bills', count: (bills || []).filter((b) => b && !b.deleted && !b.deleted_at).length, action: handleExportBills, desc: 'All active bills with line items & paid status' },
    { label: 'Customers & Ledgers', type: 'customers', count: (customers || []).filter((c) => c && !c.deleted && !c.deleted_at).length, action: handleExportCustomers, desc: 'All customer contact, type & credit balance info' },
    { label: 'Payments Register', type: 'payments', count: (payments || []).filter(Boolean).length, action: handleExportPayments, desc: 'All payment allocations with Cash/UPI split' },
    { label: 'Expenses & Cashbook', type: 'expenses', count: (expenses || []).filter(Boolean).length, action: handleExportExpenses, desc: 'All expense vouchers with category breakdown' },
    { label: 'Advance Deposits', type: 'advances', count: (advances || []).filter(Boolean).length, action: handleExportAdvances, desc: 'All customer advance receipts and balances' },
    { label: 'Customer Groups', type: 'groups', count: (groups || []).filter(Boolean).length, action: handleExportGroups, desc: 'All corporate group billing accounts and members' },
    { label: 'Inventory & Rates', type: 'inventory', count: (inventory || []).filter(Boolean).length, action: handleExportInventory, desc: 'Paper pricing catalog (Color & B/W rates)' },
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
                <span><strong>Full Cloud Restoration (Merge Mode):</strong> Sequentially restores Bills, Customers, Inventory, Payments, Expenses, Advances, and Groups directly to the database via API hooks. Existing records are preserved (safer non-destructive merge).</span>
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
            disabled={isRestoring}
          />

          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring}
            style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginBottom: '16px' }}
          >
            {isRestoring ? (
              <>
                <RefreshCw size={18} className="animate-spin" /> Restoring Records to Database...
              </>
            ) : (
              <>
                <Upload size={18} /> Select File to Import ({importType === 'backup' ? '.JSON' : '.CSV'})
              </>
            )}
          </button>

          {isRestoring && restoreProgress && (
            <div style={{ padding: '14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#60a5fa' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={14} className="animate-spin" /> {restoreProgress.stage}
                </span>
                <span>{restoreProgress.progress}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ width: `${restoreProgress.progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Phase: {restoreProgress.currentEntity}</span>
                <span>{restoreProgress.processedCount} / {restoreProgress.totalCount} records</span>
              </div>
            </div>
          )}

          {importMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '16px', background: importMessage.startsWith('Error') || importMessage.startsWith('Failed') ? 'rgba(239, 68, 68, 0.1)' : importMessage.includes('warning') || importMessage.includes('issues') ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: `1px solid ${importMessage.startsWith('Error') || importMessage.startsWith('Failed') ? 'rgba(239, 68, 68, 0.3)' : importMessage.includes('warning') || importMessage.includes('issues') ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`, borderRadius: 'var(--radius-md)', color: importMessage.startsWith('Error') || importMessage.startsWith('Failed') ? '#ef4444' : importMessage.includes('warning') || importMessage.includes('issues') ? '#f59e0b' : '#10b981', fontSize: '0.875rem' }}>
              {importMessage.startsWith('Error') || importMessage.startsWith('Failed') ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
              <span>{importMessage}</span>
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

      {/* Restore Results Summary Modal */}
      {restoreSummaryModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', border: restoreSummaryModal.failures.length > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {restoreSummaryModal.failures.length > 0 ? (
                  <AlertTriangle size={24} style={{ color: '#f59e0b', flexShrink: 0 }} />
                ) : (
                  <CheckCircle size={24} style={{ color: '#10b981', flexShrink: 0 }} />
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                    {restoreSummaryModal.failures.length > 0 ? 'Restoration Completed with Warnings' : 'Restoration Succeeded'}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {restoreSummaryModal.totalSuccess} of {restoreSummaryModal.totalRecords} records persisted to database
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setRestoreSummaryModal(null)}
                style={{ padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '16px' }}>
              {Object.entries(restoreSummaryModal.stats).map(([entity, stat]) => (
                <div key={entity} style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.78rem' }}>
                  <div style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{entity}</div>
                  <div style={{ fontWeight: 700, marginTop: '2px', color: stat.failed > 0 ? '#f59e0b' : '#ffffff' }}>
                    {stat.success} / {stat.total}
                    {stat.failed > 0 && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginLeft: '4px' }}>({stat.failed} failed)</span>}
                  </div>
                </div>
              ))}
            </div>

            {restoreSummaryModal.failures.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>
                  Failure Details ({restoreSummaryModal.failures.length}):
                </div>
                <div style={{ maxHeight: '160px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.75rem', color: '#f87171' }}>
                  <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {restoreSummaryModal.failures.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setRestoreSummaryModal(null)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                <RefreshCw size={14} /> Reload Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataManagement
