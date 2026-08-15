import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import { RotateCcw, Trash2, Search, FileText, User, Calendar } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileDeletedBills() {
  const navigate = useNavigate()
  const { bills, restoreBill, showToast } = useAppContext()

  const [searchTerm, setSearchTerm] = useState('')

  const deletedBills = useMemo(() => {
    return (bills || []).filter((b) => b.deleted)
  }, [bills])

  const filteredBills = useMemo(() => {
    return deletedBills.filter((b) => {
      if (!searchTerm.trim()) return true
      const q = searchTerm.toLowerCase().trim()
      const inv = String(b.invoiceNumber || b.id || '').toLowerCase()
      const cust = String(b.customerName || '').toLowerCase()
      const date = String(b.date || '').toLowerCase()
      return inv.includes(q) || cust.includes(q) || date.includes(q)
    }).sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [deletedBills, searchTerm])

  const handleRestore = async (id, invoiceNumber) => {
    try {
      if (restoreBill) {
        await restoreBill(id)
        showToast(`Invoice #${invoiceNumber || id} restored successfully!`, 'success')
      }
    } catch (e) {
      showToast('Failed to restore bill', 'error')
    }
  }

  return (
    <MobileLayout title="Deleted Invoices" onSwitchToDesktop={() => navigate('/deleted-bills')}>
      {/* Header section */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--error)' }}>
          RECYCLE BIN & AUDIT
        </span>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
          DELETED BILLS ({deletedBills.length})
        </h2>
      </div>

      {/* Search Input */}
      {deletedBills.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
          <input
            type="text"
            className="mobile-input"
            style={{ paddingLeft: '42px' }}
            placeholder="Search deleted invoice #, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* Deleted Bills List */}
      {filteredBills.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
          <Trash2 size={40} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Deleted Invoices</h4>
          <p style={{ margin: 0, fontSize: '0.8rem' }}>
            {deletedBills.length === 0
              ? 'There are no soft-deleted invoices in the audit register.'
              : 'No deleted invoices match your search query.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredBills.map((bill) => (
            <div
              key={bill.id}
              className="mobile-card"
              style={{
                borderLeft: '3px solid var(--error)',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    #{bill.invoiceNumber || bill.id}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', fontWeight: 600, marginTop: '2px' }}>
                    {bill.customerName || 'Walk-in Customer'}
                  </div>
                </div>
                <span className="mobile-badge mobile-badge-error" style={{ fontSize: '0.68rem' }}>
                  DELETED
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> {bill.date || 'N/A'}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }} className="currency-num">
                  ₹{Number(bill.total || 0).toFixed(2)}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  marginTop: '8px',
                }}
              >
                <button
                  className="mobile-btn mobile-btn-primary"
                  onClick={() => handleRestore(bill.id, bill.invoiceNumber)}
                  style={{
                    width: 'auto',
                    minHeight: '34px',
                    padding: '0 14px',
                    fontSize: '0.78rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#10b981',
                  }}
                >
                  <RotateCcw size={14} /> Restore Invoice
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </MobileLayout>
  )
}
