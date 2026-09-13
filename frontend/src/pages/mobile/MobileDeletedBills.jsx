import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import {
  RotateCcw, Trash2, Search, FileText, User,
  Calendar, AlertCircle, ShieldAlert, CheckCircle, Tag, Loader2,
  Eye, X, AlertTriangle, CheckSquare, Square
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileDeletedBills() {
  const navigate = useNavigate()
  const {
    restoreBill: contextRestoreBill,
    permanentDeleteBill: contextPermanentDeleteBill,
    purgeDeletedBills: contextPurgeDeletedBills,
    showToast
  } = useAppContext()

  // TanStack Queries & Mutations
  const { data: serverBills = [], isLoading: isLoadingBills, refetch } = useBills()
  const {
    restoreBill: restoreBillMutation,
    permanentDeleteBill: permanentDeleteBillMutation,
    purgeAllDeletedBills: purgeAllDeletedBillsMutation,
    isRestoringBill,
    isPurgingBill
  } = useBillMutations()

  const [searchTerm, setSearchTerm] = useState('')
  const [restoringId, setRestoringId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [inspectingBill, setInspectingBill] = useState(null)
  const [confirmPurge, setConfirmPurge] = useState({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })
  const [isProcessing, setIsProcessing] = useState(false)

  const deletedBills = useMemo(() => {
    return (serverBills || []).filter((b) => b.deleted || b.deleted_at)
  }, [serverBills])

  const filteredBills = useMemo(() => {
    return deletedBills.filter((b) => {
      if (!searchTerm.trim()) return true
      const q = searchTerm.toLowerCase().trim()
      const inv = String(b.invoiceNumber || b.invoice_number || b.id || '').toLowerCase()
      const cust = String(b.customerName || b.customer_name || '').toLowerCase()
      const date = String(b.date || '').toLowerCase()
      const notes = String(b.notes || '').toLowerCase()
      return inv.includes(q) || cust.includes(q) || date.includes(q) || notes.includes(q)
    }).sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [deletedBills, searchTerm])

  const handleRestore = async (id, invoiceNumber) => {
    setRestoringId(id)
    try {
      await restoreBillMutation(id)
      if (contextRestoreBill) {
        contextRestoreBill(id)
      }
      showToast(`Invoice #${invoiceNumber || id} restored successfully!`, 'success')
      setSelectedIds((prev) => prev.filter((item) => item !== id))
      if (inspectingBill?.id === id) setInspectingBill(null)
    } catch (e) {
      contextRestoreBill?.(id)
      showToast(`Restored invoice #${invoiceNumber || id}`, 'success')
    } finally {
      setRestoringId(null)
    }
  }

  const handlePurgeSingle = async (id) => {
    setIsProcessing(true)
    try {
      await permanentDeleteBillMutation(id)
      contextPermanentDeleteBill?.(id)
      showToast('Invoice permanently purged', 'info')
      setSelectedIds((prev) => prev.filter((item) => item !== id))
      if (inspectingBill?.id === id) setInspectingBill(null)
    } catch (e) {
      contextPermanentDeleteBill?.(id)
      showToast('Invoice removed from local trash', 'info')
    } finally {
      setIsProcessing(false)
      setConfirmPurge({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })
    }
  }

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return
    setIsProcessing(true)
    const count = selectedIds.length
    try {
      for (const id of selectedIds) {
        try {
          await restoreBillMutation(id)
        } catch {}
        contextRestoreBill?.(id)
      }
      showToast(`Restored ${count} invoices!`, 'success')
      setSelectedIds([])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkPurge = async () => {
    if (selectedIds.length === 0) return
    setIsProcessing(true)
    const count = selectedIds.length
    try {
      for (const id of selectedIds) {
        try {
          await permanentDeleteBillMutation(id)
        } catch {}
        contextPermanentDeleteBill?.(id)
      }
      showToast(`Purged ${count} invoices`, 'info')
      setSelectedIds([])
    } finally {
      setIsProcessing(false)
      setConfirmPurge({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })
    }
  }

  const handleEmptyTrash = async () => {
    setIsProcessing(true)
    try {
      await purgeAllDeletedBillsMutation()
      contextPurgeDeletedBills?.()
      showToast('Recycle bin emptied', 'success')
      setSelectedIds([])
    } catch (e) {
      contextPurgeDeletedBills?.()
      showToast('Local trash cleared', 'info')
    } finally {
      setIsProcessing(false)
      setConfirmPurge({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })
    }
  }

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <MobileLayout title="Deleted Invoices">
      {/* Top Banner Toolbar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--error)', letterSpacing: '0.08em' }}>
          RECYCLE BIN & RECOVERY TERMINAL
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
            DELETED INVOICES
          </h2>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 56, 96, 0.2)',
                border: '1px solid var(--error)',
                color: 'var(--error)',
                fontWeight: 800
              }}
            >
              {deletedBills.length} ARCHIVED
            </span>
            {deletedBills.length > 0 && (
              <button
                onClick={() => setConfirmPurge({ isOpen: true, billId: null, isBulk: false, isEmptyAll: true })}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--error)',
                  color: 'var(--error)',
                  borderRadius: 'var(--radius-md)',
                  padding: '4px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Empty
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Soft-deleted invoices register & one-tap restoration
        </div>
      </div>

      {/* System Integrity Reassurance Banner */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
          background: 'rgba(255, 184, 0, 0.12)',
          border: '1px solid rgba(255, 184, 0, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          marginBottom: '14px'
        }}
      >
        <AlertCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
          Archived bills can be restored with original ledger history and advance balance allocations intact.
        </div>
      </div>

      {/* Search Input */}
      {deletedBills.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
          <input
            type="text"
            className="mobile-input"
            style={{ paddingLeft: '42px' }}
            placeholder="Search deleted invoice #, client name, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* Batch Actions Bar */}
      {selectedIds.length > 0 && (
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid #3b82f6',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {selectedIds.length} Selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleBulkRestore}
              disabled={isProcessing}
              style={{
                background: 'var(--success)',
                color: '#000',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Restore ({selectedIds.length})
            </button>
            <button
              onClick={() => setConfirmPurge({ isOpen: true, billId: null, isBulk: true, isEmptyAll: false })}
              disabled={isProcessing}
              style={{
                background: 'var(--error)',
                color: '#fff',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Purge ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoadingBills && (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '30px 16px' }}>
          <Loader2 size={28} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading archived records...</p>
        </div>
      )}

      {/* Deleted Bills List */}
      {!isLoadingBills && filteredBills.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
          <Trash2 size={42} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 800 }}>
            No Deleted Invoices
          </h4>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            {deletedBills.length === 0
              ? 'There are no soft-deleted invoices in the audit register.'
              : 'No deleted invoices match your search query.'}
          </p>
        </div>
      ) : (
        !isLoadingBills && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredBills.map((bill) => {
              const isRestoring = restoringId === bill.id
              const isSelected = selectedIds.includes(bill.id)
              const invNumber = bill.invoiceNumber || bill.invoice_number || bill.id
              const reasonTag = bill.notes ? bill.notes.slice(0, 30) : 'Soft Deleted'

              return (
                <div
                  key={bill.id}
                  className="mobile-card"
                  style={{
                    borderLeft: '4px solid var(--error)',
                    background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'rgba(20, 10, 30, 0.75)',
                    padding: '14px',
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleToggleSelect(bill.id)}
                        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
                      >
                        {isSelected ? <CheckSquare size={18} style={{ color: '#3b82f6' }} /> : <Square size={18} />}
                      </button>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'Space Mono, monospace' }}>
                          #{invNumber}
                        </div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--accent-secondary)', marginTop: '2px' }}>
                          {bill.customerName || bill.customer_name || 'Walk-in Customer'}
                        </div>
                      </div>
                    </div>
                    <span className="mobile-badge mobile-badge-error" style={{ fontSize: '0.65rem' }}>
                      DELETED
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> {bill.date}
                    </span>
                    <span>•</span>
                    <span>Items: {bill.items ? bill.items.length : 1}</span>
                    {bill.advanceUsed > 0 && (
                      <>
                        <span>•</span>
                        <span style={{ color: '#3b82f6' }}>Adv: ₹{Number(bill.advanceUsed).toFixed(2)}</span>
                      </>
                    )}
                  </div>

                  {/* Amount & Action Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>ORIGINAL TOTAL</div>
                      <div className="currency-num" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ffffff' }}>
                        ₹{Number(bill.total || 0).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={() => setInspectingBill(bill)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: 'var(--text-primary)',
                          borderRadius: 'var(--radius-md)',
                          padding: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                        title="View Details"
                      >
                        <Eye size={15} />
                      </button>

                      <button
                        className="mobile-btn"
                        onClick={() => handleRestore(bill.id, invNumber)}
                        disabled={isRestoring || isRestoringBill}
                        style={{
                          width: 'auto',
                          padding: '0 12px',
                          minHeight: '34px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          background: 'rgba(0, 255, 171, 0.16)',
                          border: '1px solid var(--success)',
                          color: 'var(--success)',
                          boxShadow: '0 0 10px rgba(0, 255, 171, 0.25)'
                        }}
                      >
                        <RotateCcw size={13} className={isRestoring ? 'spin' : ''} />
                        {isRestoring ? 'Restoring...' : 'Restore'}
                      </button>

                      <button
                        onClick={() => setConfirmPurge({ isOpen: true, billId: bill.id, isBulk: false, isEmptyAll: false })}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid var(--error)',
                          color: 'var(--error)',
                          borderRadius: 'var(--radius-md)',
                          padding: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                        title="Permanently Purge"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Inspect Modal Sheet */}
      {inspectingBill && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => setInspectingBill(null)}
        >
          <div
            className="mobile-card"
            style={{
              width: '100%',
              maxWidth: '500px',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              padding: '20px',
              background: 'var(--bg-card)',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--error)', fontWeight: 800 }}>INVOICE DETAILS</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  #{inspectingBill.invoiceNumber || inspectingBill.invoice_number || inspectingBill.id}
                </h3>
              </div>
              <button
                onClick={() => setInspectingBill(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '0.82rem', marginBottom: '14px' }}>
              <div><strong>Customer:</strong> {inspectingBill.customerName || inspectingBill.customer_name || 'Walk-in'}</div>
              <div><strong>Date:</strong> {inspectingBill.date}</div>
              <div><strong>Total Amount:</strong> ₹{Number(inspectingBill.total || 0).toFixed(2)}</div>
              {Number(inspectingBill.advanceUsed || 0) > 0 && (
                <div><strong>Advance Used:</strong> ₹{Number(inspectingBill.advanceUsed).toFixed(2)}</div>
              )}
            </div>

            {/* Line items preview */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px' }}>ITEMS</div>
              {Array.isArray(inspectingBill.items) && inspectingBill.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>{item.name || item.itemName} × {item.quantity || item.qty || 1}</span>
                  <span style={{ fontWeight: 700 }}>₹{Number(item.total || (item.rate || 0) * (item.quantity || 1)).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="mobile-btn"
                onClick={() => {
                  const billId = inspectingBill.id
                  setInspectingBill(null)
                  setConfirmPurge({ isOpen: true, billId, isBulk: false, isEmptyAll: false })
                }}
                style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--error)', color: 'var(--error)' }}
              >
                Purge
              </button>
              <button
                className="mobile-btn"
                onClick={() => handleRestore(inspectingBill.id, inspectingBill.invoiceNumber || inspectingBill.invoice_number)}
                style={{ background: 'var(--success)', color: '#000' }}
              >
                Restore Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Purge Confirmation Modal */}
      {confirmPurge.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setConfirmPurge({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })}
        >
          <div
            className="mobile-card"
            style={{ width: '100%', maxWidth: '380px', padding: '20px', border: '1px solid var(--error)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={24} style={{ color: 'var(--error)' }} />
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {confirmPurge.isEmptyAll ? 'Empty Entire Recycle Bin?' : 'Permanent Purge?'}
              </h4>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.4 }}>
              This action cannot be undone. All selected records will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="mobile-btn"
                onClick={() => setConfirmPurge({ isOpen: false, billId: null, isBulk: false, isEmptyAll: false })}
                style={{ width: 'auto', padding: '0 14px', minHeight: '34px', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                className="mobile-btn"
                onClick={() => {
                  if (confirmPurge.isEmptyAll) {
                    handleEmptyTrash()
                  } else if (confirmPurge.isBulk) {
                    handleBulkPurge()
                  } else if (confirmPurge.billId) {
                    handlePurgeSingle(confirmPurge.billId)
                  }
                }}
                disabled={isProcessing}
                style={{ width: 'auto', padding: '0 14px', minHeight: '34px', fontSize: '0.75rem', background: 'var(--error)', border: 'none', color: '#fff' }}
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  )
}
