import React, { useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { AlertCircle, Banknote, Smartphone, RefreshCw, Trash2, User, Share2, Printer, Copy, Check, Calendar, ArrowUpRight } from 'lucide-react'
import EmptyState from '../components/common/EmptyState'
import { getDeletedPayments, getRefundPayments } from '../api/payments'

const Refunds = () => {
  const { advancePayments = [], customers = [], showToast, business } = useAppContext()
  
  const [refundPayments, setRefundPayments] = useState([])
  const [deletedPayments, setDeletedPayments] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [period, setPeriod] = useState('all') // 'all' | 'daily' | 'weekly' | 'monthly' | 'custom'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [copied, setCopied] = useState(false)

  // Fetch API data for deleted payments and refunds
  const fetchRefundData = async () => {
    setIsLoading(true)
    try {
      let params = {}
      const today = new Date().toISOString().slice(0, 10)

      if (period === 'daily') {
        params.startDate = today
        params.endDate = today
      } else if (period === 'weekly') {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        params.startDate = d.toISOString().slice(0, 10)
        params.endDate = today
      } else if (period === 'monthly') {
        const d = new Date()
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
        params.startDate = firstDay
        params.endDate = today
      } else if (period === 'custom' && startDate) {
        params.startDate = startDate
        if (endDate) params.endDate = endDate
      }

      const [refRes, delRes] = await Promise.all([
        getRefundPayments(params).catch(() => ({ data: { data: [] } })),
        getDeletedPayments().catch(() => ({ data: { data: [] } })),
      ])

      setRefundPayments(refRes.data?.data || [])
      setDeletedPayments(delRes.data?.data || [])
    } catch (err) {
      console.error('Failed to load refund data:', err)
      showToast?.('Failed to load live refund records', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRefundData()
  }, [period, startDate, endDate])

  // Helper to resolve customer name
  const getCustomerName = (cId) => {
    const c = (customers || []).find((cust) => cust.id === cId)
    return c ? c.name : 'Unknown Customer'
  }

  // 1. Calculate Refund Stats
  const refundStats = useMemo(() => {
    // Bill Refunds (negative payments / is_refund from API)
    const billRefundsList = refundPayments || []
    const billRefundsTotal = billRefundsList.reduce((s, p) => s + Math.abs(Number(p.total_paid || 0)), 0)
    const billRefundsCash = billRefundsList.reduce((s, p) => s + Math.abs(Number(p.cash_amount || 0)), 0)
    const billRefundsUpi = billRefundsList.reduce((s, p) => s + Math.abs(Number(p.upi_amount || 0)), 0)

    // Payment Deletions (from API)
    const delPaymentsList = deletedPayments || []
    const delPaymentsTotal = delPaymentsList.reduce((s, p) => s + Math.abs(Number(p.total_paid || 0)), 0)
    const delPaymentsCash = delPaymentsList.reduce((s, p) => s + Math.abs(Number(p.cash_amount || 0)), 0)
    const delPaymentsUpi = delPaymentsList.reduce((s, p) => s + Math.abs(Number(p.upi_amount || 0)), 0)

    // Advance Returns (negative advance payments)
    const advReturnsList = (advancePayments || []).filter((ap) => Number(ap.amount || 0) < 0 || ap.isReturn || ap.type === 'refund')
    const advReturnsTotal = advReturnsList.reduce((s, ap) => s + Math.abs(Number(ap.amount || 0)), 0)
    const advReturnsCash = advReturnsList.reduce((s, ap) => s + Math.abs(Number(ap.cashAmount || 0)), 0)
    const advReturnsUpi = advReturnsList.reduce((s, ap) => s + Math.abs(Number(ap.upiAmount || 0)), 0)

    const grandTotal = billRefundsTotal + delPaymentsTotal + advReturnsTotal
    const grandCash = billRefundsCash + delPaymentsCash + advReturnsCash
    const grandUpi = billRefundsUpi + delPaymentsUpi + advReturnsUpi

    return {
      billRefundsTotal,
      billRefundsCash,
      billRefundsUpi,
      billRefundsList,

      delPaymentsTotal,
      delPaymentsCash,
      delPaymentsUpi,
      delPaymentsList,

      advReturnsTotal,
      advReturnsCash,
      advReturnsUpi,
      advReturnsList,

      grandTotal,
      grandCash,
      grandUpi,
    }
  }, [refundPayments, deletedPayments, advancePayments])

  // 2. Build Unified Refund Logs
  const refundLogs = useMemo(() => {
    const logs = []

    // Add bill refunds
    refundStats.billRefundsList.forEach((r) => {
      logs.push({
        id: String(r.id),
        billId: r.bill_id || 'N/A',
        date: r.date || r.created_at,
        type: 'Bill Refund',
        customerId: r.customer_id,
        customerName: r.customer_name || getCustomerName(r.customer_id),
        description: r.bill_id ? `Refund for Bill #${r.bill_id}` : 'Direct Customer Refund',
        cash: Math.abs(Number(r.cash_amount || 0)),
        upi: Math.abs(Number(r.upi_amount || 0)),
        total: Math.abs(Number(r.total_paid || 0)),
        notes: r.notes || '',
        method: Number(r.cash_amount || 0) !== 0 ? 'cash' : (Number(r.upi_amount || 0) !== 0 ? 'upi' : 'mixed'),
      })
    })

    // Add deleted payments
    refundStats.delPaymentsList.forEach((r) => {
      logs.push({
        id: String(r.id),
        billId: r.bill_id || 'N/A',
        date: r.deleted_at || r.date,
        type: 'Payment Deletion',
        customerId: r.customer_id,
        customerName: r.customer_name || getCustomerName(r.customer_id),
        description: r.bill_id ? `Deleted Payment for Bill #${r.bill_id}` : 'Deleted Payment',
        cash: Math.abs(Number(r.cash_amount || 0)),
        upi: Math.abs(Number(r.upi_amount || 0)),
        total: Math.abs(Number(r.total_paid || 0)),
        notes: `Deleted on ${r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : 'N/A'}`,
        method: Number(r.cash_amount || 0) > 0 ? 'cash' : (Number(r.upi_amount || 0) > 0 ? 'upi' : 'mixed'),
      })
    })

    // Add advance returns
    refundStats.advReturnsList.forEach((r) => {
      logs.push({
        id: String(r.id),
        billId: r.billId || 'N/A',
        date: r.date,
        type: 'Advance Return',
        customerId: r.customerId,
        customerName: r.customerName || getCustomerName(r.customerId),
        description: 'Returned Advance to Customer',
        cash: Math.abs(Number(r.cashAmount || 0)),
        upi: Math.abs(Number(r.upiAmount || 0)),
        total: Math.abs(Number(r.amount || 0)),
        notes: r.notes || '',
        method: Number(r.cashAmount || 0) !== 0 ? 'cash' : (Number(r.upiAmount || 0) !== 0 ? 'upi' : 'mixed'),
      })
    })

    // Sort by date descending
    return logs.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [refundStats, customers])

  // Filter and search refund logs
  const filteredLogs = useMemo(() => {
    return refundLogs.filter((log) => {
      const matchesType = filterType === 'all' || log.type.toLowerCase().replace(' ', '_') === filterType
      const matchesMethod = filterMethod === 'all' || log.method === filterMethod
      const matchesSearch =
        searchQuery.trim() === '' ||
        log.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(log.customerId).toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.id.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesType && matchesMethod && matchesSearch
    })
  }, [refundLogs, filterType, filterMethod, searchQuery])

  // Format Receipt text for WhatsApp or clipboard
  const generateReceiptText = (receipt) => {
    const shop = business?.shopName || 'PrintPro'
    const dateStr = new Date(receipt.date).toLocaleDateString()
    return `*REFUND RECEIPT*\n${shop}\n----------------------------\nRefund ID: #${receipt.id}\nDate: ${dateStr}\nCustomer: ${receipt.customerName}\nReference: ${receipt.description}\nAmount Refunded: ₹${receipt.total.toFixed(2)} (${receipt.method.toUpperCase()})\nNotes: ${receipt.notes || 'N/A'}\n----------------------------\nThank you!`
  }

  const handleShareWhatsApp = (receipt) => {
    const text = generateReceiptText(receipt)
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const handleCopyReceipt = (receipt) => {
    const text = generateReceiptText(receipt)
    navigator.clipboard.writeText(text)
    setCopied(true)
    showToast?.('Refund receipt text copied to clipboard', 'success')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Refunds & Reversals</h1>
          <p>Live cloud audit of cash & UPI refund transactions, payment deletions, and advance returns.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchRefundData} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Period Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '12px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Calendar size={16} color="var(--accent)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Period Filter:</span>
            {['all', 'daily', 'weekly', 'monthly', 'custom'].map((p) => (
              <button
                key={p}
                className={`btn ${period === p ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '0.8rem', textTransform: 'capitalize' }}
                onClick={() => setPeriod(p)}
              >
                {p === 'all' ? 'All Time' : p === 'daily' ? 'Today' : p === 'weekly' ? 'This Week' : p === 'monthly' ? 'This Month' : 'Custom'}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards (Now backed by live API data) */}
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
                  <th>Customer</th>
                  <th>Description</th>
                  <th>Cash (₹)</th>
                  <th>UPI (₹)</th>
                  <th>Total (₹)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={`${log.type}-${log.id}`}>
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
                    <td>
                      <div>{log.description}</div>
                      {log.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{log.notes}</div>}
                    </td>
                    <td>₹{log.cash.toFixed(2)}</td>
                    <td>₹{log.upi.toFixed(2)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--warning)' }}>₹{log.total.toFixed(2)}</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setSelectedReceipt(log)}
                        title="View & Share Refund Receipt"
                      >
                        <Share2 size={12} />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refund Receipt Modal */}
      {selectedReceipt && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
          }}
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '440px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Refund Receipt
              </h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px dashed var(--border)',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                fontFamily: 'monospace',
                color: '#e4e4e7',
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', marginBottom: '8px', color: '#ffffff' }}>
                {business?.shopName || 'PrintPro'}
              </div>
              <div style={{ borderBottom: '1px dashed rgba(255,255,255,0.2)', marginBottom: '8px', paddingBottom: '4px' }}>
                <div><strong>Type:</strong> {selectedReceipt.type}</div>
                <div><strong>Refund ID:</strong> #{selectedReceipt.id}</div>
                <div><strong>Date:</strong> {new Date(selectedReceipt.date).toLocaleString()}</div>
                <div><strong>Customer:</strong> {selectedReceipt.customerName} ({selectedReceipt.customerId})</div>
                <div><strong>Reference:</strong> {selectedReceipt.description}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b', margin: '8px 0' }}>
                <span>Amount Refunded:</span>
                <span>₹{selectedReceipt.total.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
                <div>Mode: {selectedReceipt.method.toUpperCase()} (Cash: ₹{selectedReceipt.cash.toFixed(2)}, UPI: ₹{selectedReceipt.upi.toFixed(2)})</div>
                {selectedReceipt.notes && <div>Notes: {selectedReceipt.notes}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleCopyReceipt(selectedReceipt)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={() => handleShareWhatsApp(selectedReceipt)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', backgroundColor: '#25D366' }}
              >
                <Share2 size={14} />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Refunds
