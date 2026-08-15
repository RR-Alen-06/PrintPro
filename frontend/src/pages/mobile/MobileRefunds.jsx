import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { usePayments } from '../../hooks/useEntitiesQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { ArrowLeftRight, Banknote, Smartphone, RefreshCw, Trash2, User, Search, SlidersHorizontal, AlertCircle, Loader2 } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileRefunds() {
  const navigate = useNavigate()
  const { deletedPayments, advancePayments } = useAppContext()
  const { data: serverPayments = [], isLoading: isLoadingPayments } = usePayments()
  const { data: serverCustomers = [], isLoading: isLoadingCustomers } = useCustomers()

  const [filterType, setFilterType] = useState('all') // 'all' | 'Bill Refund' | 'Payment Deletion' | 'Advance Return'
  const [filterMethod, setFilterMethod] = useState('all') // 'all' | 'cash' | 'upi'
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterModal, setShowFilterModal] = useState(false)

  // 1. Calculate Refund Stats matching desktop Refunds.jsx exact math
  const refundStats = useMemo(() => {
    const billRefundsList = (serverPayments || []).filter((p) => Number(p.totalPaid || 0) < 0 || p.isRefund)
    const billRefundsTotal = billRefundsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    const billRefundsCash = billRefundsList.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const billRefundsUpi = billRefundsList.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    const delPaymentsList = deletedPayments || []
    const delPaymentsTotal = delPaymentsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    const delPaymentsCash = delPaymentsList.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const delPaymentsUpi = delPaymentsList.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    const advReturnsList = (advancePayments || []).filter((ap) => Number(ap.amount || 0) < 0 || ap.isReturn)
    const advReturnsTotal = advReturnsList.reduce((s, ap) => s + Number(ap.amount || 0), 0)
    const advReturnsCash = advReturnsList.reduce((s, ap) => s + Number(ap.cashAmount || 0), 0)
    const advReturnsUpi = advReturnsList.reduce((s, ap) => s + Number(ap.upiAmount || 0), 0)

    const grandTotal = Math.abs(billRefundsTotal) + Math.abs(delPaymentsTotal) + Math.abs(advReturnsTotal)
    const grandCash = Math.abs(billRefundsCash) + Math.abs(delPaymentsCash) + Math.abs(advReturnsCash)
    const grandUpi = Math.abs(billRefundsUpi) + Math.abs(delPaymentsUpi) + Math.abs(advReturnsUpi)

    return {
      billRefundsTotal: Math.abs(billRefundsTotal),
      billRefundsCash: Math.abs(billRefundsCash),
      billRefundsUpi: Math.abs(billRefundsUpi),
      billRefundsList,

      delPaymentsTotal: Math.abs(delPaymentsTotal),
      delPaymentsCash: Math.abs(delPaymentsCash),
      delPaymentsUpi: Math.abs(delPaymentsUpi),
      delPaymentsList,

      advReturnsTotal: Math.abs(advReturnsTotal),
      advReturnsCash: Math.abs(advReturnsCash),
      advReturnsUpi: Math.abs(advReturnsUpi),
      advReturnsList,

      grandTotal,
      grandCash,
      grandUpi
    }
  }, [serverPayments, deletedPayments, advancePayments])

  // 2. Build Unified Refund Logs matching desktop Refunds.jsx
  const refundLogs = useMemo(() => {
    const logs = []
    const getCustomerName = (cId) => {
      const c = (serverCustomers || []).find(cust => cust.id === cId)
      return c ? c.name : 'Unknown Customer'
    }

    refundStats.billRefundsList.forEach(r => {
      logs.push({
        id: r.id,
        date: r.date,
        type: 'Bill Refund',
        customerId: r.customerId,
        customerName: getCustomerName(r.customerId),
        description: `Refund for Bill #${r.billId}`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.totalPaid || 0),
        notes: r.notes || '',
        method: r.cashAmount < 0 ? 'cash' : (r.upiAmount < 0 ? 'upi' : 'split')
      })
    })

    refundStats.delPaymentsList.forEach(r => {
      logs.push({
        id: r.id,
        date: r.deletedAt || r.date,
        type: 'Payment Deletion',
        customerId: r.customerId,
        customerName: getCustomerName(r.customerId),
        description: `Deleted Payment for Bill #${r.billId}`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.totalPaid || 0),
        notes: `Deleted on ${new Date(r.deletedAt || r.date).toLocaleDateString()}`,
        method: r.cashAmount > 0 ? 'cash' : (r.upiAmount > 0 ? 'upi' : 'split')
      })
    })

    refundStats.advReturnsList.forEach(r => {
      logs.push({
        id: r.id,
        date: r.date,
        type: 'Advance Return',
        customerId: r.customerId,
        customerName: getCustomerName(r.customerId),
        description: `Advance Refund Deposit #${r.id}`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.amount || 0),
        notes: r.notes || '',
        method: r.cashAmount < 0 ? 'cash' : (r.upiAmount < 0 ? 'upi' : 'split')
      })
    })

    // Filter & Sort
    return logs
      .filter(l => {
        if (filterType !== 'all' && l.type !== filterType) return false
        if (filterMethod !== 'all' && l.method !== filterMethod) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          return l.customerName.toLowerCase().includes(q) ||
                 l.description.toLowerCase().includes(q) ||
                 l.notes.toLowerCase().includes(q)
        }
        return true
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [refundStats, serverCustomers, filterType, filterMethod, searchQuery])

  const isLoading = isLoadingPayments || isLoadingCustomers

  return (
    <MobileLayout title="Refunds & Returns" onSwitchToDesktop={() => navigate('/refunds')}>
      {/* Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div className="mobile-stat-card">
          <div className="mobile-stat-label">TOTAL REVERSED</div>
          <div className="mobile-stat-value currency-num" style={{ color: 'var(--error)' }}>
            ₹{refundStats.grandTotal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {refundLogs.length} Reversal Records
          </div>
        </div>

        <div className="mobile-stat-card">
          <div className="mobile-stat-label">CASH / UPI SPLIT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Cash: <strong className="currency-num" style={{ color: 'var(--text-primary)' }}>₹{refundStats.grandCash.toLocaleString('en-IN')}</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              UPI: <strong className="currency-num" style={{ color: 'var(--accent-secondary)' }}>₹{refundStats.grandUpi.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
          <input
            type="text"
            className="mobile-input"
            style={{ paddingLeft: '42px' }}
            placeholder="Search refunds by client, note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className={`mobile-btn ${filterType !== 'all' || filterMethod !== 'all' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
          onClick={() => setShowFilterModal(true)}
          style={{ width: 'auto', padding: '0 14px', minHeight: '48px' }}
          title="Filter Refunds"
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'Bill Refund', label: `Invoices (${refundStats.billRefundsList.length})` },
          { id: 'Payment Deletion', label: `Deleted (${refundStats.delPaymentsList.length})` },
          { id: 'Advance Return', label: `Advances (${refundStats.advReturnsList.length})` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setFilterType(t.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              border: filterType === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: filterType === t.id ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
              color: filterType === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Reversals List */}
      {isLoading ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="spin" style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
          <div style={{ fontSize: '0.85rem' }}>Loading refunds...</div>
        </div>
      ) : refundLogs.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <ArrowLeftRight size={36} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '10px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Refund Records Found</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>No payment reversals match criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {refundLogs.map(item => (
            <div key={item.id} className="mobile-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.customerName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {item.date} • {item.description}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="currency-num" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--error)' }}>
                    -₹{item.total.toLocaleString('en-IN')}
                  </div>
                  <span className="mobile-badge mobile-badge-danger" style={{ fontSize: '0.65rem', marginTop: '2px' }}>
                    {item.type.toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Method: <strong>{item.method.toUpperCase()}</strong></span>
                <span>{item.notes ? `Note: ${item.notes}` : 'System Logged'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bottom Sheet */}
      <BottomSheet isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} title="Filter Reversals">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>REVERSAL CATEGORY</label>
            <select className="mobile-input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="Bill Refund">Bill Refunds</option>
              <option value="Payment Deletion">Payment Deletions</option>
              <option value="Advance Return">Advance Returns</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>PAYMENT METHOD</label>
            <select className="mobile-input" value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}>
              <option value="all">All Methods</option>
              <option value="cash">Cash Only</option>
              <option value="upi">UPI Only</option>
            </select>
          </div>

          <button className="mobile-btn mobile-btn-primary" onClick={() => setShowFilterModal(false)} style={{ marginTop: '8px' }}>
            Apply Filters
          </button>
        </div>
      </BottomSheet>
    </MobileLayout>
  )
}
