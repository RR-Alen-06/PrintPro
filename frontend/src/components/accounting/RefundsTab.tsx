import React, { useState, useMemo } from 'react'
import { RotateCcw, Plus, Search, CheckCircle, AlertCircle, X, Smartphone, DollarSign, Wallet } from 'lucide-react'
import { SequenceService } from '../../services/sequenceService'
import EmptyState from '../common/EmptyState'

interface RefundsTabProps {
  refunds: any[]
  customers: any[]
  bills: any[]
  onProcessRefund: (refundData: any) => Promise<any>
  showToast: (msg: string, type?: string) => void
}

export const RefundsTab: React.FC<RefundsTabProps> = ({
  refunds = [],
  customers = [],
  bills = [],
  onProcessRefund,
  showToast,
}) => {
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMethod, setSelectedMethod] = useState<string>('all')

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedBillId, setSelectedBillId] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState<'cash' | 'upi' | 'credit'>('cash')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const totalRefunded = useMemo(() => {
    return refunds.reduce((sum, r) => sum + Math.abs(Number(r.amount || r.totalPaid || 0)), 0)
  }, [refunds])

  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      if (!r) return false
      const matchMethod = selectedMethod === 'all' || r.paymentMethod === selectedMethod || r.method === selectedMethod
      const q = searchQuery.toLowerCase()
      const matchSearch =
        !searchQuery ||
        (r.customerName || '').toLowerCase().includes(q) ||
        String(r.id || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q)
      return matchMethod && matchSearch
    }).sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
  }, [refunds, selectedMethod, searchQuery])

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(refundAmount || 0)
    if (amt <= 0) {
      showToast('Please enter a valid refund amount.', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      await onProcessRefund({
        customerId: selectedCustomerId || undefined,
        billId: selectedBillId || undefined,
        amount: amt,
        method: refundMethod,
        reason: reason.trim() || 'Customer return / job cancellation',
      })
      showToast(`Refund of ₹${amt.toFixed(2)} processed successfully!`, 'success')
      setRefundAmount('')
      setReason('')
      setShowProcessModal(false)
    } catch (err: any) {
      showToast(err?.message || 'Failed to process refund', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        <div
          className="stat-card"
          style={{
            borderLeft: '4px solid var(--aurora-pink, #ff2fb0)',
            background: 'linear-gradient(135deg, rgba(255, 47, 176, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
          }}
        >
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Total Refunds Issued
          </div>
          <div className="currency-num" style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--aurora-pink, #ff2fb0)', margin: '4px 0 2px' }}>
            ₹{totalRefunded.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Across {refunds.length} reversal transactions
          </div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Refund Transactions
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 2px' }}>
            {refunds.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Processed customer reversals</div>
        </div>
      </div>

      {/* 2. Controls & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ minWidth: '200px', maxWidth: '280px' }}>
            <Search size={14} />
            <input
              type="text"
              className="form-input"
              placeholder="Search refunds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { key: 'all', label: 'All Modes' },
              { key: 'cash', label: 'Cash' },
              { key: 'upi', label: 'UPI' },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                className={`btn btn-sm ${selectedMethod === m.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedMethod(m.key)}
                style={{ fontSize: '0.75rem' }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setShowProcessModal(true)}>
          <Plus size={14} /> Process New Refund
        </button>
      </div>

      {/* 3. Refunds Table */}
      {filteredRefunds.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No Refunds Recorded"
          description="There are no customer refunds matching the selected criteria."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '45px' }}>#</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Customer / Bill</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Method</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Reason / Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRefunds.map((ref, idx) => {
                  const amt = Math.abs(Number(ref.amount || ref.totalPaid || 0))
                  return (
                    <tr
                      key={ref.id || idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {ref.date ? ref.date.slice(0, 10) : ''}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div>{ref.customerName || ref.customerId || 'Direct Refund'}</div>
                        {ref.billId && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Invoice #{ref.billId}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                          {ref.paymentMethod || ref.method || 'Cash'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--aurora-pink, #ff2fb0)' }}>
                        -₹{amt.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                        {ref.reason || ref.notes || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Process Refund Modal */}
      {showProcessModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3>Process Customer Refund</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowProcessModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitRefund} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Customer (Optional)</label>
                <select
                  className="form-input"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">Walk-in / No customer linked</option>
                  {customers
                    .filter((c) => !c.deleted)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customerCode || SequenceService.formatDisplayCode('customer', c, 'CUS')})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Refund Amount (₹)*</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payout Mode</label>
                  <select
                    className="form-input"
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as any)}
                  >
                    <option value="cash">Cash from Register</option>
                    <option value="upi">Digital UPI Payout</option>
                    <option value="credit">Advance Wallet Credit</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Refund *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. printing misalignment / canceled order"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProcessModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
