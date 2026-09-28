import React, { useState, useMemo } from 'react'
import {
  RotateCcw,
  Trash2,
  Search,
  Eye,
  AlertTriangle,
  Calendar,
  CheckSquare,
  Square,
  X,
  FileText,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useDeletedBills, useBillMutations } from '../../hooks/useBillsQuery'
import { SequenceService } from '../../services/sequenceService'

export const RecycleBinTab: React.FC = () => {
  const { bills: ctxBills = [], showToast } = useAppContext()
  const { data: serverDeletedBills = [], isLoading, refetch } = useDeletedBills()
  const {
    restoreBill,
    permanentDeleteBill,
    purgeAllDeletedBills,
    isRestoringBill,
    isPurgingBill,
  } = useBillMutations()

  // Data union fallback
  const contextDeleted = (Array.isArray(ctxBills) ? ctxBills : []).filter(
    (b: any) => b && (b.deleted || b.deleted_at)
  )
  const deletedBills = (serverDeletedBills.length > 0 ? serverDeletedBills : contextDeleted) as any[]

  // States
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [inspectingBill, setInspectingBill] = useState<any | null>(null)
  const [purgeConfirmModal, setPurgeConfirmModal] = useState<{
    isOpen: boolean
    billId?: string | null
    isAll?: boolean
  }>({ isOpen: false })
  const [isProcessing, setIsProcessing] = useState(false)

  // Filtered bills
  const filteredBills = useMemo(() => {
    return deletedBills.filter((b) => {
      if (!b) return false
      // Text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const inv = String(b.invoiceNumber || b.invoice_number || b.id || '').toLowerCase()
        const cust = String(b.customerName || b.customer_name || '').toLowerCase()
        const phone = String(b.customerPhone || b.customer_phone || b.phone || '').toLowerCase()
        const itemsMatch = Array.isArray(b.items) && b.items.some(
          (it: any) => String(it.name || it.itemName || '').toLowerCase().includes(q)
        )
        if (!inv.includes(q) && !cust.includes(q) && !phone.includes(q) && !itemsMatch) {
          return false
        }
      }

      // Date filter
      if (dateFilter !== 'all') {
        const dStr = b.deleted_at || b.deletedAt || b.date
        if (!dStr) return true
        const delDate = new Date(dStr)
        const now = new Date()
        const diffMs = now.getTime() - delDate.getTime()
        const diffDays = diffMs / (1000 * 60 * 60 * 24)

        if (dateFilter === 'today' && diffDays > 1) return false
        if (dateFilter === 'week' && diffDays > 7) return false
        if (dateFilter === 'month' && diffDays > 30) return false
      }

      return true
    })
  }, [deletedBills, searchTerm, dateFilter])

  // Aggregate stats
  const totalDeletedRevenue = useMemo(() => {
    return filteredBills.reduce((sum, b) => sum + (Number(b.total) || 0), 0)
  }, [filteredBills])

  // Select all toggle
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredBills.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredBills.map((b) => b.id))
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Restore single
  const handleRestoreOne = async (id: string) => {
    try {
      setIsProcessing(true)
      await restoreBill(id)
      setSelectedIds((prev) => prev.filter((item) => item !== id))
      showToast?.('Invoice successfully restored to active bills', 'success')
      refetch()
    } catch (err: any) {
      console.error(err)
      showToast?.(`Restore failed: ${err.message || err}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Restore bulk
  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return
    try {
      setIsProcessing(true)
      for (const id of selectedIds) {
        await restoreBill(id)
      }
      showToast?.(`Restored ${selectedIds.length} invoices to active bills`, 'success')
      setSelectedIds([])
      refetch()
    } catch (err: any) {
      console.error(err)
      showToast?.(`Bulk restore error: ${err.message || err}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Confirm Purge
  const handleExecutePurge = async () => {
    try {
      setIsProcessing(true)
      if (purgeConfirmModal.isAll) {
        await purgeAllDeletedBills()
        showToast?.('Recycle bin completely emptied', 'success')
        setSelectedIds([])
      } else if (purgeConfirmModal.billId) {
        await permanentDeleteBill(purgeConfirmModal.billId)
        setSelectedIds((prev) => prev.filter((id) => id !== purgeConfirmModal.billId))
        showToast?.('Invoice permanently deleted from database', 'success')
      }
      setPurgeConfirmModal({ isOpen: false })
      refetch()
    } catch (err: any) {
      console.error(err)
      showToast?.(`Purge failed: ${err.message || err}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Metrics */}
      <div
        className="aurora-glass-card"
        style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
          border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}
          >
            <Trash2 size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
              Deleted Bills Recycle Bin
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
              Safely recover deleted invoices or permanently purge expired records
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              padding: '6px 14px',
              borderRadius: '10px',
              background: 'rgba(10, 5, 20, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Deleted Revenue Value
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>
              ₹{totalDeletedRevenue.toFixed(2)}
            </span>
          </div>

          {deletedBills.length > 0 && (
            <button
              onClick={() => setPurgeConfirmModal({ isOpen: true, isAll: true })}
              className="aurora-btn-glass"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '8px',
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              <ShieldAlert size={15} />
              <span>Empty Recycle Bin</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Action Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search by invoice #, customer name, phone, item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="aurora-input"
              style={{ width: '100%', paddingLeft: '36px', height: '40px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '8px' }}>
            {(['all', 'today', 'week', 'month'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: dateFilter === filter ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                  color: dateFilter === filter ? '#00f0ff' : '#94a3b8',
                  fontSize: '0.78rem',
                  fontWeight: dateFilter === filter ? 700 : 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {filter === 'all' ? 'All Time' : filter}
              </button>
            ))}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
              {selectedIds.length} selected
            </span>
            <button
              onClick={handleBulkRestore}
              disabled={isProcessing}
              className="aurora-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              <RotateCcw size={14} />
              <span>Restore Selected</span>
            </button>
          </div>
        )}
      </div>

      {/* Invoices Table */}
      <div
        className="aurora-glass-card"
        style={{
          borderRadius: '14px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px', width: '40px' }}>
                  <button
                    onClick={handleToggleSelectAll}
                    style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0 }}
                  >
                    {selectedIds.length > 0 && selectedIds.length === filteredBills.length ? (
                      <CheckSquare size={16} style={{ color: '#00f0ff' }} />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Invoice #</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Deleted Date</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Items</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle2 size={36} style={{ color: '#00ffab', opacity: 0.8 }} />
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>Recycle Bin is Empty</div>
                      <div style={{ fontSize: '0.82rem' }}>No deleted invoices matching criteria.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => {
                  const isSelected = selectedIds.includes(b.id)
                  const delDateFormatted = b.deleted_at || b.deletedAt || b.date || 'N/A'
                  const displayCode = b.invoiceNumber || SequenceService.formatDisplayCode('bill', b.id, 'INV')

                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: isSelected ? 'rgba(0, 240, 255, 0.05)' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => handleToggleSelectOne(b.id)}
                          style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0 }}
                        >
                          {isSelected ? (
                            <CheckSquare size={16} style={{ color: '#00f0ff' }} />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#00f0ff' }}>
                        {displayCode}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{b.customerName || b.customer_name || 'Walk-in'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{b.customerPhone || b.phone || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>
                        {delDateFormatted.substring(0, 10)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                        {(b.items || []).length} items
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                        ₹{Number(b.total || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => setInspectingBill(b)}
                            title="Inspect Invoice"
                            className="aurora-btn-glass"
                            style={{ padding: '5px 8px', borderRadius: '6px' }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleRestoreOne(b.id)}
                            disabled={isProcessing}
                            title="Restore Invoice"
                            className="aurora-btn-glass"
                            style={{ padding: '5px 8px', borderRadius: '6px', color: '#00ffab', borderColor: 'rgba(0, 255, 171, 0.3)' }}
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => setPurgeConfirmModal({ isOpen: true, billId: b.id })}
                            disabled={isProcessing}
                            title="Delete Permanently"
                            className="aurora-btn-glass"
                            style={{ padding: '5px 8px', borderRadius: '6px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Bill Modal */}
      {inspectingBill && (
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
              maxWidth: '540px',
              padding: '24px',
              borderRadius: '16px',
              background: 'linear-gradient(180deg, #140d28 0%, #0a0515 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: '#00f0ff' }} />
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                  Invoice {inspectingBill.invoiceNumber || inspectingBill.id}
                </span>
              </div>
              <button
                onClick={() => setInspectingBill(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>Customer:</strong> {inspectingBill.customerName || 'Walk-in'}
              </div>
              <div>
                <strong>Total:</strong> ₹{Number(inspectingBill.total || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead style={{ background: 'rgba(255, 255, 255, 0.04)' }}>
                  <tr>
                    <th style={{ padding: '8px 12px' }}>Item</th>
                    <th style={{ padding: '8px 12px' }}>Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(inspectingBill.items || []).map((it: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '8px 12px' }}>{it.name || it.itemName || 'Custom Item'}</td>
                      <td style={{ padding: '8px 12px' }}>{it.quantity || 1}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        ₹{Number(it.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setInspectingBill(null)}
                className="aurora-btn-glass"
                style={{ padding: '8px 16px', borderRadius: '8px' }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleRestoreOne(inspectingBill.id)
                  setInspectingBill(null)
                }}
                className="aurora-btn-primary"
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RotateCcw size={14} />
                <span>Restore This Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Confirm Modal */}
      {purgeConfirmModal.isOpen && (
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
              maxWidth: '460px',
              padding: '24px',
              borderRadius: '16px',
              background: 'linear-gradient(180deg, #1f0d14 0%, #0a0515 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <ShieldAlert size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                  {purgeConfirmModal.isAll ? 'Empty Entire Recycle Bin?' : 'Permanent Deletion Warning'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                  This action cannot be undone. Records will be erased from Supabase.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                onClick={() => setPurgeConfirmModal({ isOpen: false })}
                disabled={isProcessing}
                className="aurora-btn-glass"
                style={{ padding: '8px 16px', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePurge}
                disabled={isProcessing}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isProcessing ? <RefreshCw size={14} className="spin" /> : <Trash2 size={14} />}
                <span>{purgeConfirmModal.isAll ? 'Empty All' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
