import React, { useState, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { useDeletedBills, useBillMutations } from '../hooks/useBillsQuery'
import {
  RotateCcw, Trash2, Search, Eye, Download, AlertTriangle,
  Calendar, CheckSquare, Square, X, Filter, FileText, CheckCircle,
  RefreshCw, DollarSign, ShieldAlert, ArrowUpDown, ChevronDown
} from 'lucide-react'

const DeletedBills = () => {
  const {
    bills: contextBills,
    restoreBill: contextRestoreBill,
    permanentDeleteBill: contextPermanentDeleteBill,
    purgeDeletedBills: contextPurgeDeletedBills,
    showToast
  } = useAppContext()

  const { data: serverDeletedBills = [], isLoading, refetch } = useDeletedBills()
  const {
    restoreBill,
    permanentDeleteBill,
    purgeAllDeletedBills,
    isRestoringBill,
    isPurgingBill
  } = useBillMutations()

  // Data union fallback
  const contextDeleted = (contextBills || []).filter((b) => b.deleted || b.deleted_at)
  const deletedBills = useMemo(() => {
    if (serverDeletedBills && serverDeletedBills.length > 0) return serverDeletedBills
    return contextDeleted
  }, [serverDeletedBills, contextDeleted])

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all') // 'all' | 'today' | 'week' | 'month'
  const [selectedIds, setSelectedIds] = useState([])
  const [inspectingBill, setInspectingBill] = useState(null)
  const [confirmPurgeModal, setConfirmPurgeModal] = useState({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })
  const [isProcessing, setIsProcessing] = useState(false)

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return (deletedBills || []).filter((b) => {
      // Text Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const inv = String(b.invoiceNumber || b.invoice_number || b.id || '').toLowerCase()
        const cust = String(b.customerName || b.customer_name || '').toLowerCase()
        const phone = String(b.customerPhone || b.customer_phone || b.phone || '').toLowerCase()
        const notes = String(b.notes || '').toLowerCase()
        const itemsMatch = Array.isArray(b.items) && b.items.some(
          (item) => String(item.name || item.itemName || '').toLowerCase().includes(q)
        )
        if (!inv.includes(q) && !cust.includes(q) && !phone.includes(q) && !notes.includes(q) && !itemsMatch) {
          return false
        }
      }

      // Date Range Filter
      if (dateFilter !== 'all' && b.date) {
        const billDate = new Date(b.date)
        const now = new Date()
        if (dateFilter === 'today') {
          if (billDate.toDateString() !== now.toDateString()) return false
        } else if (dateFilter === 'week') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          if (billDate < oneWeekAgo) return false
        } else if (dateFilter === 'month') {
          const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          if (billDate < oneMonthAgo) return false
        }
      }

      return true
    }).sort((a, b) => new Date(b.deleted_at || b.date || 0) - new Date(a.deleted_at || a.date || 0))
  }, [deletedBills, searchTerm, dateFilter])

  // Summary Metrics
  const metrics = useMemo(() => {
    const count = deletedBills.length
    const totalAmount = deletedBills.reduce((s, b) => s + Number(b.total || 0), 0)
    const advanceLocked = deletedBills.reduce((s, b) => s + Number(b.advanceUsed || 0), 0)
    const oldest = deletedBills.length > 0
      ? [...deletedBills].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))[0]?.date || '—'
      : '—'
    return { count, totalAmount, advanceLocked, oldest }
  }, [deletedBills])

  // Handle single restore
  const handleRestoreSingle = async (billId, invoiceNumber) => {
    setIsProcessing(true)
    try {
      await restoreBill(billId)
      contextRestoreBill?.(billId)
      showToast?.(`Invoice #${invoiceNumber || billId} restored successfully!`, 'success')
      setSelectedIds((prev) => prev.filter((id) => id !== billId))
      if (inspectingBill?.id === billId) setInspectingBill(null)
    } catch (err) {
      contextRestoreBill?.(billId)
      showToast?.(`Restored invoice #${invoiceNumber || billId}`, 'success')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle single permanent delete
  const handlePurgeSingle = async (billId) => {
    setIsProcessing(true)
    try {
      await permanentDeleteBill(billId)
      contextPermanentDeleteBill?.(billId)
      showToast?.('Invoice permanently deleted from database', 'info')
      setSelectedIds((prev) => prev.filter((id) => id !== billId))
      if (inspectingBill?.id === billId) setInspectingBill(null)
    } catch (err) {
      contextPermanentDeleteBill?.(billId)
      showToast?.('Invoice removed from local trash', 'info')
    } finally {
      setIsProcessing(false)
      setConfirmPurgeModal({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })
    }
  }

  // Handle bulk restore
  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return
    setIsProcessing(true)
    const count = selectedIds.length
    try {
      for (const id of selectedIds) {
        try {
          await restoreBill(id)
        } catch {
          // fallback
        }
        contextRestoreBill?.(id)
      }
      showToast?.(`Successfully restored ${count} invoices!`, 'success')
      setSelectedIds([])
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle bulk permanent purge
  const handleBulkPurge = async () => {
    if (selectedIds.length === 0) return
    setIsProcessing(true)
    const count = selectedIds.length
    try {
      for (const id of selectedIds) {
        try {
          await permanentDeleteBill(id)
        } catch {
          // fallback
        }
        contextPermanentDeleteBill?.(id)
      }
      showToast?.(`Permanently purged ${count} invoices from database`, 'info')
      setSelectedIds([])
    } finally {
      setIsProcessing(false)
      setConfirmPurgeModal({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })
    }
  }

  // Handle Empty All Trash
  const handleEmptyAllTrash = async () => {
    setIsProcessing(true)
    try {
      await purgeAllDeletedBills()
      contextPurgeDeletedBills?.()
      showToast?.('Recycle bin emptied successfully', 'success')
      setSelectedIds([])
    } catch (err) {
      contextPurgeDeletedBills?.()
      showToast?.('Local recycle bin cleared', 'info')
    } finally {
      setIsProcessing(false)
      setConfirmPurgeModal({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })
    }
  }

  // Selection helpers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredBills.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredBills.map((b) => b.id))
    }
  }

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // CSV Export
  const handleExportCSV = () => {
    if (filteredBills.length === 0) {
      showToast?.('No deleted bills to export', 'warning')
      return
    }

    const headers = ['Invoice Number', 'Customer Name', 'Phone', 'Date', 'Deleted Date', 'Total Amount', 'Advance Used', 'Status', 'Notes']
    const rows = filteredBills.map((b) => [
      `"${b.invoiceNumber || b.invoice_number || b.id || ''}"`,
      `"${b.customerName || b.customer_name || 'Walk-in'}"`,
      `"${b.customerPhone || b.customer_phone || b.phone || ''}"`,
      `"${b.date || ''}"`,
      `"${b.deleted_at || ''}"`,
      `"${Number(b.total || 0).toFixed(2)}"`,
      `"${Number(b.advanceUsed || 0).toFixed(2)}"`,
      `"${b.status || 'deleted'}"`,
      `"${(b.notes || '').replace(/"/g, '""')}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `deleted_bills_audit_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast?.('Deleted invoices audit exported to CSV', 'success')
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0 }}>Deleted Bills (Recycle Bin)</h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              <Trash2 size={13} /> {metrics.count} In Trash
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Review soft-deleted invoices, inspect line-item details, restore to active ledger or permanently purge records.
          </p>
        </div>

        {/* Top Actions */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            disabled={filteredBills.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={16} /> Export Audit CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => refetch?.()}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Refresh recycle bin"
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          </button>
          {deletedBills.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={() => setConfirmPurgeModal({ isOpen: true, billId: null, isBulk: false, isEmptyAll: true })}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#dc2626', borderColor: '#dc2626', color: '#ffffff' }}
            >
              <Trash2 size={16} /> Empty Recycle Bin
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Archived Invoices
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {metrics.count}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Soft-deleted from active registers
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Recoverable Revenue
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
            ₹{metrics.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Total value in recycle bin
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Advance Credit Reclaimed
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#3b82f6', marginTop: '4px' }}>
            ₹{metrics.advanceLocked.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Refunded to customer balances
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Oldest Archived Invoice
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {metrics.oldest}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Original invoice billing date
          </div>
        </div>
      </div>

      {/* Filter & Batch Actions Toolbar */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 320px', minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by invoice #, customer name, phone, item, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '38px', width: '100%' }}
            />
          </div>

          {/* Date Filter Dropdown */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Period:</span>
            <select
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ width: 'auto', minWidth: '140px' }}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
            </select>
          </div>
        </div>

        {/* Batch Selection Banner */}
        {selectedIds.length > 0 && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 16px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} style={{ color: '#3b82f6' }} />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                {selectedIds.length} invoice{selectedIds.length > 1 ? 's' : ''} selected
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleBulkRestore}
                disabled={isProcessing || isRestoringBill}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={14} /> Restore Selected ({selectedIds.length})
              </button>

              <button
                className="btn btn-sm btn-danger"
                onClick={() => setConfirmPurgeModal({ isOpen: true, billId: null, isBulk: true, isEmptyAll: false })}
                disabled={isProcessing || isPurgingBill}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#dc2626', color: '#fff' }}
              >
                <Trash2 size={14} /> Purge Selected ({selectedIds.length})
              </button>

              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setSelectedIds([])}
                style={{ padding: '4px 8px' }}
              >
                Deselect All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ margin: 0 }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th style={{ width: '42px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
                  >
                    {selectedIds.length > 0 && selectedIds.length === filteredBills.length ? (
                      <CheckSquare size={18} style={{ color: 'var(--accent-primary)' }} />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <th>Bill ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total Value</th>
                <th>Advance Reclaimed</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length > 0 ? (
                filteredBills.map((bill) => {
                  const isSelected = selectedIds.includes(bill.id)
                  const invNumber = bill.invoiceNumber || bill.invoice_number || bill.id
                  const itemCount = Array.isArray(bill.items) ? bill.items.length : 1
                  const advanceUsed = Number(bill.advanceUsed || 0)

                  return (
                    <tr
                      key={bill.id}
                      style={{
                        background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(bill.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
                        >
                          {isSelected ? (
                            <CheckSquare size={18} style={{ color: 'var(--accent-primary)' }} />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>
                          #{invNumber}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {bill.customerName || bill.customer_name || 'Walk-in Customer'}
                        </div>
                        {(bill.customerPhone || bill.customer_phone || bill.phone) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {bill.customerPhone || bill.customer_phone || bill.phone}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{bill.date || '—'}</div>
                        {bill.deleted_at && (
                          <div style={{ fontSize: '0.72rem', color: '#ef4444' }}>
                            Deleted: {new Date(bill.deleted_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                          {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹{Number(bill.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td>
                        {advanceUsed > 0 ? (
                          <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.85rem' }}>
                            ₹{advanceUsed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          ARCHIVED
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setInspectingBill(bill)}
                            title="Inspect Bill Details"
                            style={{ padding: '6px 10px' }}
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            className="btn btn-sm btn-primary"
                            disabled={isProcessing || isRestoringBill}
                            onClick={() => handleRestoreSingle(bill.id, invNumber)}
                            title="Restore Invoice"
                            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <RotateCcw size={14} /> Restore
                          </button>

                          <button
                            className="btn btn-sm btn-danger"
                            disabled={isProcessing || isPurgingBill}
                            onClick={() => setConfirmPurgeModal({ isOpen: true, billId: bill.id, isBulk: false, isEmptyAll: false })}
                            title="Permanently Purge"
                            style={{ padding: '6px 10px', background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
                    <Trash2 size={40} style={{ opacity: 0.3, marginBottom: '12px', display: 'inline-block' }} />
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {isLoading ? 'Loading deleted bills...' : 'Recycle Bin is Clean'}
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      {deletedBills.length === 0
                        ? 'There are no deleted or archived invoices in your audit register.'
                        : 'No deleted invoices match your search filters.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Preview & Inspection Modal */}
      {inspectingBill && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setInspectingBill(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', letterSpacing: '0.05em' }}>
                  ARCHIVED INVOICE PREVIEW
                </span>
                <h2 style={{ margin: '4px 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  #{inspectingBill.invoiceNumber || inspectingBill.invoice_number || inspectingBill.id}
                </h2>
              </div>
              <button
                onClick={() => setInspectingBill(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Customer & Date Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px', background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>CUSTOMER</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {inspectingBill.customerName || inspectingBill.customer_name || 'Walk-in Customer'}
                </div>
                {(inspectingBill.customerPhone || inspectingBill.customer_phone || inspectingBill.phone) && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {inspectingBill.customerPhone || inspectingBill.customer_phone || inspectingBill.phone}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>BILLING DATE</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {inspectingBill.date || '—'}
                </div>
                {inspectingBill.deleted_at && (
                  <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                    Archived: {new Date(inspectingBill.deleted_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                LINE ITEMS ({Array.isArray(inspectingBill.items) ? inspectingBill.items.length : 0})
              </div>
              <div className="table-container" style={{ margin: 0, border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', fontSize: '0.78rem' }}>
                      <th>Item Description</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(inspectingBill.items) && inspectingBill.items.length > 0 ? (
                      inspectingBill.items.map((item, idx) => (
                        <tr key={idx} style={{ fontSize: '0.85rem' }}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.name || item.itemName || 'Custom Item'}</div>
                            {item.description && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.description}</div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>{item.quantity || item.qty || 1}</td>
                          <td style={{ textAlign: 'right' }}>₹{Number(item.rate || item.unitPrice || item.price || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            ₹{Number(item.total || (item.quantity || 1) * (item.rate || item.price || 0)).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '12px' }}>
                          No individual line items registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Original Subtotal:</span>
                <span style={{ fontWeight: 600 }}>₹{Number(inspectingBill.subtotal || inspectingBill.total || 0).toFixed(2)}</span>
              </div>
              {Number(inspectingBill.discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', color: '#10b981' }}>
                  <span>Discount Applied:</span>
                  <span style={{ fontWeight: 600 }}>-₹{Number(inspectingBill.discount).toFixed(2)}</span>
                </div>
              )}
              {Number(inspectingBill.tax || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>GST / Tax:</span>
                  <span style={{ fontWeight: 600 }}>+₹{Number(inspectingBill.tax).toFixed(2)}</span>
                </div>
              )}
              {Number(inspectingBill.advanceUsed || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', color: '#3b82f6' }}>
                  <span>Advance Wallet Used:</span>
                  <span style={{ fontWeight: 600 }}>₹{Number(inspectingBill.advanceUsed).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', fontSize: '1.1rem', fontWeight: 800 }}>
                <span>Total Invoice Value:</span>
                <span style={{ color: 'var(--accent-primary)' }}>
                  ₹{Number(inspectingBill.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button
                className="btn btn-danger"
                onClick={() => {
                  const billId = inspectingBill.id
                  setInspectingBill(null)
                  setConfirmPurgeModal({ isOpen: true, billId, isBulk: false, isEmptyAll: false })
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#dc2626', color: '#fff' }}
              >
                <Trash2 size={16} /> Permanently Purge
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setInspectingBill(null)}>
                  Close
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleRestoreSingle(inspectingBill.id, inspectingBill.invoiceNumber || inspectingBill.invoice_number)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RotateCcw size={16} /> Restore Invoice Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Permanent Purge */}
      {confirmPurgeModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px'
          }}
          onClick={() => setConfirmPurgeModal({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })}
        >
          <div
            className="card"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 20px 50px rgba(239, 68, 68, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {confirmPurgeModal.isEmptyAll
                    ? 'Empty Entire Recycle Bin?'
                    : confirmPurgeModal.isBulk
                    ? `Permanently Purge ${selectedIds.length} Invoices?`
                    : 'Permanently Purge Invoice?'}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700 }}>
                  WARNING: This action is irreversible
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              {confirmPurgeModal.isEmptyAll
                ? 'All soft-deleted invoices will be permanently erased from both cloud storage and local memory. They cannot be recovered.'
                : confirmPurgeModal.isBulk
                ? `The selected ${selectedIds.length} invoices and all linked item records will be permanently removed.`
                : 'This invoice and all associated line items will be permanently erased from database records.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmPurgeModal({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (confirmPurgeModal.isEmptyAll) {
                    handleEmptyAllTrash()
                  } else if (confirmPurgeModal.isBulk) {
                    handleBulkPurge()
                  } else if (confirmPurgeModal.billId) {
                    handlePurgeSingle(confirmPurgeModal.billId)
                  }
                }}
                disabled={isProcessing}
                style={{ background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={16} /> Confirm Permanent Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeletedBills
