import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import {
  RotateCcw, Trash2, Search, FileText, User,
  Calendar, AlertCircle, ShieldAlert, CheckCircle, Tag, Loader2
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileDeletedBills() {
  const navigate = useNavigate()
  const { restoreBill: contextRestoreBill, showToast } = useAppContext()

  // TanStack Queries & Mutations
  const { data: serverBills = [], isLoading: isLoadingBills } = useBills()
  const { updateBill: updateBillMutation, isUpdatingBill } = useBillMutations()

  const [searchTerm, setSearchTerm] = useState('')
  const [restoringId, setRestoringId] = useState(null)

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
      await updateBillMutation({
        id,
        data: {
          deleted: false,
          deleted_at: null
        }
      })

      if (contextRestoreBill) {
        await contextRestoreBill(id)
      }

      showToast(`Invoice #${invoiceNumber || id} restored successfully!`, 'success')
    } catch (e) {
      showToast(e.message || 'Failed to restore bill', 'error')
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <MobileLayout title="Deleted Invoices" onSwitchToDesktop={() => navigate('/deleted-bills')}>
      {/* Top Banner Toolbar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--error)', letterSpacing: '0.08em' }}>
          RECYCLE BIN & RECOVERY TERMINAL
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
            DELETED INVOICES
          </h2>
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
              const invNumber = bill.invoiceNumber || bill.invoice_number || bill.id
              const reasonTag = bill.notes ? bill.notes.slice(0, 30) : 'Soft Deleted'

              return (
                <div
                  key={bill.id}
                  className="mobile-card"
                  style={{
                    borderLeft: '4px solid var(--error)',
                    background: 'rgba(20, 10, 30, 0.75)',
                    padding: '14px',
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'Space Mono, monospace' }}>
                        #{invNumber}
                      </div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--accent-secondary)', marginTop: '2px' }}>
                        {bill.customerName || bill.customer_name || 'Walk-in Customer'}
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
                    <span>•</span>
                    <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Tag size={12} /> {reasonTag}
                    </span>
                  </div>

                  {/* Amount & Action Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>ORIGINAL TOTAL</div>
                      <div className="currency-num" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ffffff' }}>
                        ₹{Number(bill.total || 0).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <button
                      className="mobile-btn"
                      onClick={() => handleRestore(bill.id, invNumber)}
                      disabled={isRestoring || isUpdatingBill}
                      style={{
                        width: 'auto',
                        padding: '0 14px',
                        minHeight: '36px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: 'rgba(0, 255, 171, 0.16)',
                        border: '1px solid var(--success)',
                        color: 'var(--success)',
                        boxShadow: '0 0 10px rgba(0, 255, 171, 0.25)'
                      }}
                    >
                      <RotateCcw size={14} className={isRestoring ? 'spin' : ''} />
                      {isRestoring ? 'Restoring...' : 'Restore Invoice'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </MobileLayout>
  )
}
