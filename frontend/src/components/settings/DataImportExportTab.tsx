import React, { useState } from 'react'
import {
  FileSpreadsheet,
  Download,
  Upload,
  Layers,
  Users,
  Package,
  Receipt,
  TrendingDown,
  Wallet,
  GitMerge,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import { useInventory, useInventoryMutations, usePayments, useAdvancePayments } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'
import { useGroupBills } from '../../hooks/useGroupBillsQuery'
import {
  exportBillsToCSV,
  exportCustomersToCSV,
  exportInventoryToCSV,
  exportPaymentsToCSV,
  exportExpensesToCSV,
  exportAdvancesToCSV,
  exportGroupsToCSV,
} from '../../utils/dataExport'
import {
  importFromCSV,
  importCustomersFromCSV,
  importInventoryFromCSV,
} from '../../utils/dataImport'
import { useQueryClient } from '@tanstack/react-query'

export const DataImportExportTab: React.FC = () => {
  const queryClient = useQueryClient()
  const {
    customers: ctxCustomers = [],
    customerGroups: ctxGroups = [],
    inventory: ctxInventory = [],
    bills: ctxBills = [],
    payments: ctxPayments = [],
    expenses: ctxExpenses = [],
    advancePayments: ctxAdvances = [],
    showToast,
  } = useAppContext()

  const { data: serverBills } = useBills()
  const { data: serverCustomers } = useCustomers()
  const { data: serverInventory } = useInventory()
  const { data: serverPayments } = usePayments()
  const { data: serverExpenses } = useExpenses()
  const { data: serverAdvances } = useAdvancePayments()
  const { groupBills: serverGroups } = useGroupBills()

  const { createCustomer } = useCustomerMutations()
  const { createInventory } = useInventoryMutations()

  const bills = (serverBills || ctxBills).filter((b: any) => !b.deleted && !b.deleted_at)
  const customers = (serverCustomers || ctxCustomers).filter((c: any) => !c.deleted && !c.deleted_at)
  const inventory = serverInventory || ctxInventory
  const payments = serverPayments || ctxPayments
  const expenses = serverExpenses || ctxExpenses
  const advances = serverAdvances || ctxAdvances
  const groups = serverGroups || ctxGroups

  // Import states
  const [isImporting, setIsImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<{
    entity: string
    success: number
    failed: number
    errors: string[]
  } | null>(null)

  const handleExport = (type: string) => {
    try {
      switch (type) {
        case 'bills':
          exportBillsToCSV(bills)
          showToast?.(`Exported ${bills.length} active invoices to CSV`, 'success')
          break
        case 'customers':
          exportCustomersToCSV(customers)
          showToast?.(`Exported ${customers.length} customer records to CSV`, 'success')
          break
        case 'inventory':
          exportInventoryToCSV(inventory)
          showToast?.(`Exported ${inventory.length} inventory items to CSV`, 'success')
          break
        case 'payments':
          exportPaymentsToCSV(payments)
          showToast?.(`Exported ${payments.length} payment records to CSV`, 'success')
          break
        case 'expenses':
          exportExpensesToCSV(expenses)
          showToast?.(`Exported ${expenses.length} operating expenses to CSV`, 'success')
          break
        case 'advances':
          exportAdvancesToCSV(advances)
          showToast?.(`Exported ${advances.length} advance deposits to CSV`, 'success')
          break
        case 'groups':
          exportGroupsToCSV(groups)
          showToast?.(`Exported ${groups.length} customer groups to CSV`, 'success')
          break
        default:
          break
      }
    } catch (err: any) {
      console.error(err)
      showToast?.(`Export failed: ${err.message || err}`, 'error')
    }
  }

  const handleImportCustomersCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsImporting(true)
      setImportSummary(null)
      const rawRows = await importFromCSV(file)
      const parsedCustomers = importCustomersFromCSV(rawRows)

      let success = 0
      let failed = 0
      const errors: string[] = []

      for (const cust of parsedCustomers) {
        try {
          if (!cust.name || cust.name === 'Unnamed') {
            throw new Error('Name cannot be empty')
          }
          await createCustomer(cust)
          success++
        } catch (err: any) {
          failed++
          errors.push(`Customer "${cust.name}": ${err.message || 'Validation error'}`)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['customers'] })
      setImportSummary({
        entity: 'Customers',
        success,
        failed,
        errors: errors.slice(0, 5),
      })
      showToast?.(`Import finished: ${success} customers imported (${failed} skipped)`, success > 0 ? 'success' : 'warning')
    } catch (err: any) {
      console.error(err)
      showToast?.(`Import error: ${err.message || err}`, 'error')
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  const handleImportInventoryCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsImporting(true)
      setImportSummary(null)
      const rawRows = await importFromCSV(file)
      const parsedItems = importInventoryFromCSV(rawRows)

      let success = 0
      let failed = 0
      const errors: string[] = []

      for (const it of parsedItems) {
        try {
          if (!it.name || it.name === 'Unnamed Item') {
            throw new Error('Item name cannot be empty')
          }
          await createInventory(it)
          success++
        } catch (err: any) {
          failed++
          errors.push(`Item "${it.name}": ${err.message || 'Validation error'}`)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setImportSummary({
        entity: 'Inventory Catalog',
        success,
        failed,
        errors: errors.slice(0, 5),
      })
      showToast?.(`Import finished: ${success} items imported (${failed} skipped)`, success > 0 ? 'success' : 'warning')
    } catch (err: any) {
      console.error(err)
      showToast?.(`Import error: ${err.message || err}`, 'error')
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  const exportEntities = [
    {
      id: 'bills',
      title: 'Invoices & Bills',
      count: bills.length,
      icon: Receipt,
      desc: 'All non-deleted customer invoices with item breakdowns and tax',
      color: '#00f0ff',
    },
    {
      id: 'customers',
      title: 'Customers Directory',
      count: customers.length,
      icon: Users,
      desc: 'Complete client roster with contact info, GSTIN & balances',
      color: '#3b82f6',
    },
    {
      id: 'inventory',
      title: 'Inventory & Rates',
      count: inventory.length,
      icon: Package,
      desc: 'Print substrates, sheets, and standardized selling rates',
      color: '#a855f7',
    },
    {
      id: 'payments',
      title: 'Cash & UPI Payments',
      count: payments.length,
      icon: Wallet,
      desc: 'Historical financial inflow transactions with split modes',
      color: '#00ffab',
    },
    {
      id: 'expenses',
      title: 'Operating Expenses',
      count: expenses.length,
      icon: TrendingDown,
      desc: 'Shop overhead, raw materials, electricity & staff advances',
      color: '#f59e0b',
    },
    {
      id: 'advances',
      title: 'Advance Deposits',
      count: advances.length,
      icon: FileSpreadsheet,
      desc: 'Customer prepaid credits, deposits & refund return records',
      color: '#ec4899',
    },
    {
      id: 'groups',
      title: 'Group Billing Masters',
      count: groups.length,
      icon: GitMerge,
      desc: 'Multi-customer parent group billing containers and vouchers',
      color: '#10b981',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Banner */}
      <div
        className="aurora-glass-card"
        style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                Multi-Entity CSV Data Hub
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                Export structured tables for Excel or ingest batch data via CSV
              </p>
            </div>
          </div>
        </div>

        {/* Quick CSV Import Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <label
            className="aurora-btn-glass"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            {isImporting ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}
            <span>Import Customers CSV</span>
            <input
              type="file"
              accept=".csv"
              disabled={isImporting}
              style={{ display: 'none' }}
              onChange={handleImportCustomersCSV}
            />
          </label>

          <label
            className="aurora-btn-glass"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            {isImporting ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}
            <span>Import Inventory CSV</span>
            <input
              type="file"
              accept=".csv"
              disabled={isImporting}
              style={{ display: 'none' }}
              onChange={handleImportInventoryCSV}
            />
          </label>
        </div>
      </div>

      {/* Import Feedback Banner */}
      {importSummary && (
        <div
          className="aurora-glass-card"
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: importSummary.failed > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0, 255, 171, 0.1)',
            border: `1px solid ${importSummary.failed > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(0, 255, 171, 0.3)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {importSummary.failed > 0 ? (
              <AlertCircle size={18} style={{ color: '#f59e0b' }} />
            ) : (
              <CheckCircle2 size={18} style={{ color: '#00ffab' }} />
            )}
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
              Import Result for {importSummary.entity}:
            </span>
            <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              {importSummary.success} created successfully, {importSummary.failed} failed.
            </span>
          </div>
          {importSummary.errors.length > 0 && (
            <div style={{ fontSize: '0.78rem', color: '#fca5a5', paddingLeft: '26px' }}>
              Sample errors: {importSummary.errors.join(' | ')}
            </div>
          )}
        </div>
      )}

      {/* CSV Export Grid */}
      <div>
        <h4 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 700, color: '#cbd5e1' }}>
          Export Active Registers (UTF-8 Excel Compatible)
        </h4>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: '16px',
          }}
        >
          {exportEntities.map((ent) => {
            const Icon = ent.icon
            return (
              <div
                key={ent.id}
                className="aurora-glass-card"
                style={{
                  padding: '20px',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: `${ent.color}1a`,
                      border: `1px solid ${ent.color}4d`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: ent.color,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                        {ent.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#cbd5e1',
                          fontWeight: 700,
                        }}
                      >
                        {ent.count} rows
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
                      {ent.desc}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleExport(ent.id)}
                  className="aurora-btn-glass"
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: '#f8fafc',
                  }}
                >
                  <Download size={14} style={{ color: ent.color }} />
                  <span>Download .CSV</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
