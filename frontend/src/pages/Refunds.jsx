import React, { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { AlertCircle, ArrowLeftRight, Banknote, HelpCircle, Smartphone, RefreshCw, Trash2, User } from 'lucide-react'
import EmptyState from '../components/common/EmptyState'

const Refunds = () => {
  const { payments, deletedPayments, advancePayments, customers } = useAppContext()
  
  const [filterType, setFilterType] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Calculate Refund Stats
  const refundStats = useMemo(() => {
    // Bill Refunds (negative payments)
    const billRefundsList = (payments || []).filter((p) => p.totalPaid < 0 || p.isRefund)
    const billRefundsTotal = billRefundsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    const billRefundsCash = billRefundsList.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const billRefundsUpi = billRefundsList.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    // Payment Deletions (deleted payments)
    const delPaymentsList = deletedPayments || []
    const delPaymentsTotal = delPaymentsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    const delPaymentsCash = delPaymentsList.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const delPaymentsUpi = delPaymentsList.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    // Advance Returns (negative advance payments)
    const advReturnsList = (advancePayments || []).filter((ap) => ap.amount < 0 || ap.isReturn)
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
  }, [payments, deletedPayments, advancePayments])

  // 2. Build Unified Refund Logs
  const refundLogs = useMemo(() => {
    const logs = []
    
    // Helper to resolve customer name
    const getCustomerName = (cId) => {
      const c = (customers || []).find(cust => cust.id === cId)
      return c ? c.name : 'Unknown Customer'
    }

    // Add bill refunds
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

    // Add deleted payments
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
        notes: `Deleted on ${new Date(r.deletedAt).toLocaleDateString()}`,
        method: r.cashAmount > 0 ? 'cash' : (r.upiAmount > 0 ? 'upi' : 'split')
      })
    })

    // Add advance returns
    refundStats.advReturnsList.forEach(r => {
      logs.push({
        id: r.id,
        date: r.date,
        type: 'Advance Return',
        customerId: r.customerId,
        customerName: getCustomerName(r.customerId),
        description: `Returned Advance to Customer`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.amount || 0),
        notes: r.notes || '',
        method: r.cashAmount < 0 ? 'cash' : (r.upiAmount < 0 ? 'upi' : 'split')
      })
    })

    // Sort by date descending
    return logs.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [refundStats, customers])

  // Filter and search refund logs
  const filteredLogs = useMemo(() => {
    return refundLogs.filter(log => {
      const matchesType = filterType === 'all' || log.type.toLowerCase().replace(' ', '_') === filterType
      const matchesMethod = filterMethod === 'all' || log.method === filterMethod
      const matchesSearch = searchQuery.trim() === '' || 
        log.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.customerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.id.toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesType && matchesMethod && matchesSearch
    })
  }, [refundLogs, filterType, filterMethod, searchQuery])

  return (
    <div>
      <div className="page-header">
        <h1>Refunds & Reversals</h1>
        <p>Manage and audit cash & UPI refund transactions, payment deletions, and advance returns.</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon error" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}><RefreshCw /></div>
            <div>
              <div className="stat-card-label">Total Outflows</div>
              <div className="stat-card-value" style={{ color: 'var(--error)' }}>₹{refundStats.grandTotal.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Combined reversals & refunds</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}><Banknote /></div>
            <div>
              <div className="stat-card-label">Cash Refunds</div>
              <div className="stat-card-value" style={{ color: '#10b981' }}>₹{refundStats.grandCash.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Total cash refunded out</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon info" style={{ background: 'rgba(59,130,246,0.08)', color: '#3b82f6' }}><Smartphone /></div>
            <div>
              <div className="stat-card-label">UPI Refunds</div>
              <div className="stat-card-value" style={{ color: '#3b82f6' }}>₹{refundStats.grandUpi.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Total UPI refunded out</div>
        </div>
      </div>

      {/* Refunds by Category Grid */}
      <div className="grid-3" style={{ gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Bill Edit Refunds</h4>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--warning)' }}>₹{refundStats.billRefundsTotal.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Cash: ₹{refundStats.billRefundsCash.toFixed(2)}</span>
            <span>UPI: ₹{refundStats.billRefundsUpi.toFixed(2)}</span>
          </div>
        </div>

        <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Payment Deletions</h4>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--error)' }}>₹{refundStats.delPaymentsTotal.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Cash: ₹{refundStats.delPaymentsCash.toFixed(2)}</span>
            <span>UPI: ₹{refundStats.delPaymentsUpi.toFixed(2)}</span>
          </div>
        </div>

        <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Advance Returns</h4>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--info)' }}>₹{refundStats.advReturnsTotal.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Cash: ₹{refundStats.advReturnsCash.toFixed(2)}</span>
            <span>UPI: ₹{refundStats.advReturnsUpi.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Filters and List */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h2>Refund Logs ({filteredLogs.length})</h2>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by customer, bill ID..."
              className="form-input"
              style={{ width: '220px', padding: '6px 12px', fontSize: '0.85rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="form-select"
              style={{ width: '150px', padding: '6px 12px', fontSize: '0.85rem' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="bill_refund">Bill Refund</option>
              <option value="payment_deletion">Payment Deletion</option>
              <option value="advance_return">Advance Return</option>
            </select>

            <select
              className="form-select"
              style={{ width: '130px', padding: '6px 12px', fontSize: '0.85rem' }}
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash Mode</option>
              <option value="upi">UPI Mode</option>
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <EmptyState
            Icon={AlertCircle}
            title="No refund records found"
            description="No refund, deletion, or return logs match your search query and selected filter options."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Customer (Ref ID)</th>
                  <th>Description</th>
                  <th>Cash (₹)</th>
                  <th>UPI (₹)</th>
                  <th>Total (₹)</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.date).toLocaleDateString()}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.id}</td>
                    <td>
                      <span className={`badge badge-${log.type === 'Bill Refund' ? 'partial' : log.type === 'Payment Deletion' ? 'unpaid' : 'info'}`} style={{ fontSize: '0.7rem' }}>
                        {log.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} className="text-muted" />
                        <div>
                          <span style={{ fontWeight: 500 }}>{log.customerName}</span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.customerId}</div>
                        </div>
                      </div>
                    </td>
                    <td>{log.description}</td>
                    <td>₹{log.cash.toFixed(2)}</td>
                    <td>₹{log.upi.toFixed(2)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--warning)' }}>₹{log.total.toFixed(2)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Refunds
