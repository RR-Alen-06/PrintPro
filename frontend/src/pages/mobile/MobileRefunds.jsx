import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { ArrowLeftRight, Banknote, Smartphone, RefreshCw, Trash2, User, Search, SlidersHorizontal } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileRefunds() {
  const navigate = useNavigate()
  const { payments, deletedPayments, advancePayments, customers } = useAppContext()

  const [filterType, setFilterType] = useState('all') // 'all' | 'Bill Refund' | 'Payment Deletion' | 'Advance Return'
  const [filterMethod, setFilterMethod] = useState('all') // 'all' | 'cash' | 'upi' | 'split'
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterModal, setShowFilterModal] = useState(false)

  // 1. Calculate Refund Stats matching desktop Refunds.jsx exact logic
  const refundStats = useMemo(() => {
    const billRefundsList = (payments || []).filter((p) => p.totalPaid < 0 || p.isRefund)
    const billRefundsTotal = billRefundsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    const billRefundsCash = billRefundsList.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const billRefundsUpi = billRefundsList.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    const delPaymentsList = deletedPayments || []
    const delPaymentsTotal = delPaymentsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    const delPaymentsCash = delPaymentsList.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const delPaymentsUpi = delPaymentsList.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    const advReturnsList = (advancePayments || []).filter((ap) => ap.amount < 0 || ap.isReturn)
    const advReturnsTotal = advReturnsList.reduce((s, ap) => s + Number(ap.amount || 0), 0)
    const advReturnsCash = advReturnsList.reduce((s, ap) => s + Number(ap.cashAmount || 0), 0)
    const advReturnsUpi = advReturnsList.reduce((s, ap) => s + Number(ap.upiAmount || 0), 0)

    const grandTotal = Math.abs(billRefundsTotal) + Math.abs(delPaymentsTotal) + Math.abs(advReturnsTotal)
    const grandCash = Math.abs(billRefundsCash) + Math.abs(delPaymentsCash) + Math.abs(advReturnsCash)
    const grandUpi = Math.abs(billRefundsUpi) + Math.abs(delPaymentsUpi) + Math.abs(advReturnsUpi)

    return {
      billRefundsList,
      delPaymentsList,
      advReturnsList,
      grandTotal,
      grandCash,
      grandUpi
    }
  }, [payments, deletedPayments, advancePayments])

  // 2. Build Unified Refund Logs matching desktop Refunds.jsx
  const refundLogs = useMemo(() => {
    const logs = []
    const getCustomerName = (cId) => {
      const c = (customers || []).find(cust => cust.id === cId)
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
        description: `Return of Advance Deposit`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.amount || 0),
        notes: r.notes || '',
        method: r.cashAmount < 0 ? 'cash' : (r.upiAmount < 0 ? 'upi' : 'split')
      })
    })

    logs.sort((a, b) => new Date(b.date) - new Date(a.date))
    return logs
  }, [refundStats, customers])

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return refundLogs.filter(log => {
      if (filterType !== 'all' && log.type !== filterType) return false
      if (filterMethod !== 'all' && log.method !== filterMethod) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        return log.customerName.toLowerCase().includes(q) ||
          log.description.toLowerCase().includes(q) ||
          log.notes.toLowerCase().includes(q)
      }
      return true
    })
  }, [refundLogs, filterType, filterMethod, searchQuery])

  return (
    <MobileLayout title="Refund Audit Logs" onSwitchToDesktop={() => navigate('/refunds')}>
      {/* Horizontally Scrollable Stat Cards */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
        <div className="mobile-card mobile-card-glow" style={{ minWidth: '200px', flex: '0 0 auto', borderColor: 'var(--error)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL REFUND OUTFLOW</div>
          <div className="currency-num" style={{ fontSize: '1.4rem', color: 'var(--error)', marginTop: '4px' }}>
            ₹{refundStats.grandTotal.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="mobile-card" style={{ minWidth: '180px', flex: '0 0 auto', borderColor: 'var(--accent-primary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>CASH REFUNDS</div>
          <div className="currency-num" style={{ fontSize: '1.4rem', color: 'var(--accent-primary)', marginTop: '4px' }}>
            ₹{refundStats.grandCash.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="mobile-card" style={{ minWidth: '180px', flex: '0 0 auto', borderColor: 'var(--accent-secondary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>UPI REFUNDS</div>
          <div className="currency-num" style={{ fontSize: '1.4rem', color: 'var(--accent-secondary)', marginTop: '4px' }}>
            ₹{refundStats.grandUpi.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Header Search & Filter Trigger */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
          <input
            type="text"
            className="mobile-input"
            style={{ paddingLeft: '42px' }}
            placeholder="Search refund logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="mobile-icon-btn" onClick={() => setShowFilterModal(true)} style={{ borderColor: filterType !== 'all' || filterMethod !== 'all' ? 'var(--accent-primary)' : 'var(--border)' }}>
          <SlidersHorizontal size={20} />
        </button>
      </div>

      {/* Logs Stack */}
      {filteredLogs.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <ArrowLeftRight size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Refund Records Found</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>No refund or credit return logs match filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredLogs.map(log => (
            <div key={log.id} className="mobile-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{log.customerName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.description} • {log.date}</div>
                </div>
                <div className="currency-num" style={{ fontSize: '1.1rem', color: 'var(--error)' }}>
                  -₹{log.total.toFixed(2)}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <span className="mobile-badge mobile-badge-error" style={{ fontSize: '0.68rem' }}>
                  {log.type.toUpperCase()}
                </span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Cash: ₹{log.cash.toFixed(2)} | UPI: ₹{log.upi.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bottom Sheet */}
      <BottomSheet isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} title="Filter Refund Logs">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>REFUND CATEGORY</label>
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
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="split">Split</option>
            </select>
          </div>

          <button className="mobile-btn mobile-btn-primary" onClick={() => setShowFilterModal(false)}>
            Apply Filters
          </button>
        </div>
      </BottomSheet>
    </MobileLayout>
  )
}
