import React, { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import {
  useInventory,
  useInventoryMutations,
  usePayments,
  usePaymentMutations,
  useAdvancePayments,
  useAdvancePaymentMutations
} from '../../hooks/useEntitiesQuery'
import { useExpenses, useExpenseMutations } from '../../hooks/useExpensesQuery'
import { useGroupBills, useGroupBillMutations } from '../../hooks/useGroupBillsQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { jsPDF } from 'jspdf'
import {
  Database, Download, Upload, RefreshCw, Trash2, FileSpreadsheet,
  FileText, Calendar, CheckCircle, AlertTriangle, Layers, Loader2, HardDrive, X
} from 'lucide-react'
import {
  createFullBackup, exportBillsToCSV, exportCustomersToCSV,
  exportInventoryToCSV, exportPaymentsToCSV, exportExpensesToCSV,
  exportAdvancesToCSV, exportGroupsToCSV
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
    currentUser, business, settings, counters = {}, sequences = {}, syncFromCloud, showToast
  } = useAppContext()

  // TanStack Queries & Mutations
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

  const bills = isBillsLoaded || serverBills !== undefined ? (serverBills || []) : []
  const customers = isCustomersLoaded || serverCustomers !== undefined ? (serverCustomers || []) : []
  const inventory = isInventoryLoaded || serverInventory !== undefined ? (serverInventory || []) : []
  const payments = isPaymentsLoaded || serverPayments !== undefined ? (serverPayments || []) : []
  const expenses = isExpensesLoaded || serverExpenses !== undefined ? (serverExpenses || []) : []
  const advances = isAdvancesLoaded || serverAdvances !== undefined ? (serverAdvances || []) : []
  const groups = isGroupsLoaded || serverGroups !== undefined ? (serverGroups || []) : []

  const [isSyncing, setIsSyncing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState(null)
  const [restoreSummaryModal, setRestoreSummaryModal] = useState(null)
  const [importType, setImportType] = useState('backup') // 'backup' | 'customers' | 'inventory'
  const [showImportSheet, setShowImportSheet] = useState(false)
  const [showReportSheet, setShowReportSheet] = useState(false)
  const [reportPeriod, setReportPeriod] = useState('all') // 'all'|'daily'|'weekly'|'monthly'|'quarterly'|'yearly'|'custom'
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedReportEntity, setSelectedReportEntity] = useState('bills') // 'bills'|'customers'|'payments'|'expenses'|'advances'

  const fileInputRef = useRef(null)

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

  // 1. Export JSON Full Backup
  const handleFullBackup = () => {
    try {
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
      showToast('Full 8-Entity JSON Backup downloaded', 'success')
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
      } else if (entity === 'advances') {
        exportAdvancesToCSV(advances || [])
        showToast(`${(advances || []).length} advance deposits exported to CSV`, 'success')
      } else if (entity === 'groups') {
        exportGroupsToCSV(groups || [])
        showToast(`${(groups || []).length} customer groups exported to CSV`, 'success')
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

        // 1. Customers
        const customersList = restored.customers || []
        for (let i = 0; i < customersList.length; i++) {
          const c = customersList[i]
          updateProg(`Restoring customers (${i + 1}/${customersList.length})...`, 'Customers')
          try {
            if (!c.name || !String(c.name).trim()) throw new Error('Customer name missing')
            if (createCustomerMutation) {
              const res = await createCustomerMutation(c)
              const createdId = res?.id || res?.data?.id
              if (c.id && createdId) idMap.customers[c.id] = createdId
            }
            stats.customers.success++
          } catch (err) {
            stats.customers.failed++
            failures.push(`Customer "${c.name || c.id || i + 1}": ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 2. Inventory
        const inventoryList = restored.inventory || []
        for (let i = 0; i < inventoryList.length; i++) {
          const item = inventoryList[i]
          updateProg(`Restoring inventory (${i + 1}/${inventoryList.length})...`, 'Inventory')
          try {
            if (!item.name || !String(item.name).trim()) throw new Error('Item name missing')
            if (createInventoryMutation) {
              const res = await createInventoryMutation(item)
              const createdId = res?.id || res?.data?.id
              if (item.id && createdId) idMap.inventory[item.id] = createdId
            }
            stats.inventory.success++
          } catch (err) {
            stats.inventory.failed++
            failures.push(`Inventory "${item.name || item.id || i + 1}": ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 3. Bills
        const billsList = restored.bills || []
        for (let i = 0; i < billsList.length; i++) {
          const b = billsList[i]
          updateProg(`Restoring bills (${i + 1}/${billsList.length})...`, 'Bills')
          try {
            const rawCustId = b.customerId || b.customer_id
            const mappedCustId = idMap.customers[rawCustId] || rawCustId
            const mappedItems = (b.items || []).map((it) => {
              const rawItemId = it.itemId || it.item_id
              const mappedItemId = idMap.inventory[rawItemId] || rawItemId
              return { ...it, itemId: mappedItemId, item_id: mappedItemId }
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
              if (b.id && createdId) idMap.bills[b.id] = createdId
              if (b.invoiceNumber && createdId) idMap.bills[b.invoiceNumber] = createdId
              if (b.invoice_number && createdId) idMap.bills[b.invoice_number] = createdId
            }
            stats.bills.success++
          } catch (err) {
            stats.bills.failed++
            failures.push(`Bill #${b.invoiceNumber || b.invoice_number || b.id || i + 1}: ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 4. Payments
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
            failures.push(`Payment (₹${p.totalPaid || p.amount || 0}): ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 5. Expenses
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

        // 6. Advances
        const advancesList = restored.advancePayments || []
        for (let i = 0; i < advancesList.length; i++) {
          const adv = advancesList[i]
          updateProg(`Restoring advances (${i + 1}/${advancesList.length})...`, 'Advance Payments')
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
            failures.push(`Advance (₹${adv.amount || 0}): ${err?.response?.data?.message || err?.message || 'Failed to save'}`)
          }
          processed++
        }

        // 7. Groups
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
          showToast(`All ${totalSuccess} records restored and synced to database! Reloading in 3s...`, 'success')
          setTimeout(() => window.location.reload(), 3000)
        } else {
          showToast(`Restored with warnings: ${totalSuccess} of ${totalRecords} saved, ${failures.length} failed. See details.`, 'warning')
        }
      } else if (importType === 'customers') {
        const data = await importFromCSV(file)
        const imported = importCustomersFromCSV(data)
        let successCount = 0
        const failures = []

        for (let i = 0; i < imported.length; i++) {
          const c = imported[i]
          try {
            if (!c.name || !String(c.name).trim()) throw new Error('Customer name is required')
            if (createCustomerMutation) {
              await createCustomerMutation(c)
            }
            successCount++
          } catch (mErr) {
            const label = c.name ? `"${c.name}"` : `Row ${i + 1}`
            const reason = mErr?.response?.data?.message || mErr?.message || 'Failed to save'
            failures.push(`${label}: ${reason}`)
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['customers'] })

        if (failures.length === 0) {
          showToast(`All ${successCount} customers imported & persisted to database`, 'success')
        } else if (successCount > 0) {
          showToast(`${successCount} of ${imported.length} customers imported. ${failures.length} failed: ${failures.slice(0, 2).join('; ')}`, 'warning')
        } else {
          showToast(`Customer import failed (0 of ${imported.length} saved): ${failures.slice(0, 2).join('; ')}`, 'error')
        }
      } else if (importType === 'inventory') {
        const data = await importFromCSV(file)
        const items = importInventoryFromCSV(data)
        let successCount = 0
        const failures = []

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          try {
            if (!item.name || !String(item.name).trim()) throw new Error('Item name is required')
            if (createInventoryMutation) {
              await createInventoryMutation(item)
            }
            successCount++
          } catch (mErr) {
            const label = item.name ? `"${item.name}"` : `Row ${i + 1}`
            const reason = mErr?.response?.data?.message || mErr?.message || 'Failed to save'
            failures.push(`${label}: ${reason}`)
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['inventory'] })

        if (failures.length === 0) {
          showToast(`All ${successCount} inventory items imported & persisted to database`, 'success')
        } else if (successCount > 0) {
          showToast(`${successCount} of ${items.length} inventory items imported. ${failures.length} failed: ${failures.slice(0, 2).join('; ')}`, 'warning')
        } else {
          showToast(`Inventory import failed (0 of ${items.length} saved): ${failures.slice(0, 2).join('; ')}`, 'error')
        }
      }
      setShowImportSheet(false)
    } catch (error) {
      showToast(`Import Error: ${error.message}`, 'error')
    } finally {
      setIsRestoring(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
    <MobileLayout title="Data Management">
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

        {isRestoring && restoreProgress && (
          <div style={{ marginBottom: '14px', padding: '10px', background: 'var(--bg-card-hover)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Loader2 size={13} className="spin" />
                {restoreProgress.stage}
              </span>
              <span>{restoreProgress.progress}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${restoreProgress.progress}%`,
                  height: '100%',
                  background: 'var(--accent-primary)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
              {restoreProgress.processedCount} / {restoreProgress.totalCount} records
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="mobile-btn mobile-btn-primary" onClick={handleFullBackup} disabled={isRestoring}>
            <Download size={16} /> Export Full JSON Backup
          </button>
          <button className="mobile-btn mobile-btn-secondary" onClick={() => triggerImport('backup')} disabled={isRestoring}>
            {isRestoring ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
            {isRestoring ? 'Restoring to Database...' : 'Restore from JSON Backup'}
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

      {/* Restore Summary BottomSheet */}
      <BottomSheet isOpen={!!restoreSummaryModal} onClose={() => setRestoreSummaryModal(null)} title="Restore Summary">
        {restoreSummaryModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: restoreSummaryModal.failures.length === 0 ? 'var(--success)' : 'var(--warning)', fontWeight: 800 }}>
              {restoreSummaryModal.failures.length === 0 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
              <span>
                {restoreSummaryModal.totalSuccess} of {restoreSummaryModal.totalRecords} records persisted to database
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.75rem' }}>
              {Object.entries(restoreSummaryModal.stats || {}).map(([key, st]) => (
                <div key={key} style={{ padding: '8px', background: 'var(--bg-card-hover)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ textTransform: 'capitalize', fontWeight: 700, color: 'var(--text-secondary)' }}>{key}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: st.failed > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                    {st.success} ok {st.failed > 0 ? `(${st.failed} failed)` : ''}
                  </div>
                </div>
              ))}
            </div>

            {restoreSummaryModal.failures.length > 0 && (
              <div style={{ maxHeight: '140px', overflowY: 'auto', background: 'rgba(239, 68, 68, 0.08)', padding: '8px', borderRadius: '6px', border: '1px solid var(--danger)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '4px' }}>
                  Errors / Warnings ({restoreSummaryModal.failures.length}):
                </div>
                {restoreSummaryModal.failures.map((err, i) => (
                  <div key={i} style={{ fontSize: '0.7rem', color: 'var(--text-primary)', marginBottom: '2px' }}>• {err}</div>
                ))}
              </div>
            )}

            <button className="mobile-btn mobile-btn-primary" onClick={() => setRestoreSummaryModal(null)} style={{ marginTop: '8px' }}>
              Close Summary
            </button>
          </div>
        )}
      </BottomSheet>
    </MobileLayout>
  )
}
