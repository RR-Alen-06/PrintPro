import React, { useState, useEffect, useCallback } from 'react'
import {
  QrCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Printer,
  X,
  Edit2,
  Check,
  FileText,
  Plus
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import {
  getUpiTransactions,
  getUpiSummary,
  getDailyUpiSettlement,
  updateUpiTransaction,
  bulkConfirmUpi,
  createUpiTransaction
} from '../api/upiTransactions'

const UpiReconciliation = () => {
  const { business, showAlert, showToast, showConfirm } = useAppContext()

  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'pending', 'confirmed', 'failed'
  const [searchQuery, setSearchQuery] = useState('')
  const [datePreset, setDatePreset] = useState('all') // 'today', 'yesterday', 'this_month', 'all'

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState([])

  // Inline editing state for UTR
  const [editingUtrId, setEditingUtrId] = useState(null)
  const [editingUtrValue, setEditingUtrValue] = useState('')

  // Settlement Modal
  const [showSettlementModal, setShowSettlementModal] = useState(false)
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().slice(0, 10))
  const [settlementData, setSettlementData] = useState(null)
  const [settlementLoading, setSettlementLoading] = useState(false)

  // Manual Add Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [manualForm, setManualForm] = useState({
    bill_id: '',
    customer_id: '',
    amount: '',
    upi_ref: '',
    upi_id: '',
    status: 'pending'
  })
  const [savingManual, setSavingManual] = useState(false)

  // Fetch transactions and summary
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (searchQuery) params.search = searchQuery

      if (datePreset === 'today') {
        const today = new Date().toISOString().slice(0, 10)
        params.startDate = today
        params.endDate = today
      } else if (datePreset === 'yesterday') {
        const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        params.startDate = yest
        params.endDate = yest
      } else if (datePreset === 'this_month') {
        const d = new Date()
        params.startDate = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
        params.endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
      }

      const [txRes, sumRes] = await Promise.all([
        getUpiTransactions(params),
        getUpiSummary(params)
      ])

      setTransactions(txRes.data.data || [])
      setSummary(sumRes.data.data || null)
      setSelectedIds([])
    } catch (err) {
      console.error('Error fetching UPI reconciliation data:', err)
      if (showAlert) showAlert('Failed to load UPI transactions.', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery, datePreset, showAlert])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchData()
  }

  // Handle single status update
  const handleUpdateStatus = async (txId, newStatus) => {
    try {
      await updateUpiTransaction(txId, { status: newStatus })
      setTransactions(prev => prev.map(t => t.id === txId ? { ...t, status: newStatus } : t))
      if (showToast) showToast(`Transaction #${txId} marked as ${newStatus}`, 'success')
      // Refresh summary
      const sumRes = await getUpiSummary()
      setSummary(sumRes.data.data || null)
    } catch (err) {
      console.error('Failed to update UPI status:', err)
      if (showAlert) showAlert('Failed to update transaction status.', 'error')
    }
  }

  // Handle inline UTR save
  const handleSaveUtr = async (txId) => {
    try {
      await updateUpiTransaction(txId, { upi_ref: editingUtrValue.trim() })
      setTransactions(prev => prev.map(t => t.id === txId ? { ...t, upi_ref: editingUtrValue.trim() } : t))
      setEditingUtrId(null)
      if (showToast) showToast('UTR reference updated', 'success')
    } catch (err) {
      console.error('Failed to save UTR:', err)
      if (showAlert) showAlert('Failed to update UTR reference.', 'error')
    }
  }

  // Handle bulk confirmation
  const handleBulkConfirm = async () => {
    if (selectedIds.length === 0) return
    const doBulk = async () => {
      try {
        await bulkConfirmUpi(selectedIds, 'confirmed')
        if (showToast) showToast(`Confirmed ${selectedIds.length} UPI transactions`, 'success')
        await fetchData()
      } catch (err) {
        console.error('Bulk confirm failed:', err)
        if (showAlert) showAlert('Failed to bulk confirm transactions.', 'error')
      }
    }

    if (showConfirm) {
      showConfirm(
        'Confirm Selected Payments',
        `Mark all ${selectedIds.length} selected UPI payments as confirmed?`,
        doBulk
      )
    } else if (window.confirm(`Mark all ${selectedIds.length} selected UPI payments as confirmed?`)) {
      doBulk()
    }
  }

  // Select all toggle
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(transactions.map(t => t.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectRow = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Settlement Report fetch
  const handleOpenSettlement = async (dateVal = settlementDate) => {
    try {
      setSettlementLoading(true)
      setShowSettlementModal(true)
      const res = await getDailyUpiSettlement(dateVal)
      setSettlementData(res.data.data)
    } catch (err) {
      console.error('Failed to load settlement report:', err)
      if (showAlert) showAlert('Failed to load daily settlement report.', 'error')
      setShowSettlementModal(false)
    } finally {
      setSettlementLoading(false)
    }
  }

  // Manual UPI Entry Submit
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(manualForm.amount)
    if (isNaN(amt) || amt <= 0) {
      if (showAlert) showAlert('Please enter a valid amount.', 'error')
      return
    }

    try {
      setSavingManual(true)
      await createUpiTransaction({
        ...manualForm,
        amount: amt
      })
      if (showToast) showToast('UPI transaction logged successfully', 'success')
      setShowAddModal(false)
      setManualForm({
        bill_id: '',
        customer_id: '',
        amount: '',
        upi_ref: '',
        upi_id: '',
        status: 'pending'
      })
      await fetchData()
    } catch (err) {
      console.error('Failed to create manual UPI transaction:', err)
      if (showAlert) showAlert('Failed to save transaction.', 'error')
    } finally {
      setSavingManual(false)
    }
  }

  return (
    <div className="upi-reconciliation-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <QrCode className="text-accent" size={28} />
            UPI Reconciliation & UTR Tracking
          </h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Verify per-transaction Bank Reference (UTR) numbers, mark payments confirmed, and export daily settlement summaries.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleOpenSettlement(new Date().toISOString().slice(0, 10))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <FileText size={16} /> Daily Settlement Report
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} /> Log UPI Transaction
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Total UPI Volume */}
        <div className="card" style={{ padding: '18px' }}>
          <div className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '6px' }}>Total UPI Received</div>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            ₹{(summary?.total_volume || 0).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '4px' }}>
            <span className="font-mono">{summary?.total_count || 0}</span> transactions
          </div>
        </div>

        {/* Confirmed Volume */}
        <div className="card" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
          <div className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={14} /> Confirmed / Settled
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
            ₹{(summary?.confirmed_volume || 0).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '4px' }}>
            <span className="font-mono">{summary?.confirmed_count || 0}</span> verified
          </div>
        </div>

        {/* Pending Review */}
        <div className="card" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
          <div className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '6px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={14} /> Pending Reconciliation
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>
            ₹{(summary?.pending_volume || 0).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '4px' }}>
            <span className="font-mono">{summary?.pending_count || 0}</span> awaiting UTR / match
          </div>
        </div>

        {/* Failed / Disputed */}
        <div className="card" style={{ padding: '18px', borderLeft: '4px solid #f43f5e' }}>
          <div className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '6px', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={14} /> Failed / Unmatched
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f43f5e' }}>
            ₹{(summary?.failed_volume || 0).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '4px' }}>
            <span className="font-mono">{summary?.failed_count || 0}</span> failed
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: `Pending (${summary?.pending_count || 0})` },
              { id: 'confirmed', label: `Confirmed (${summary?.confirmed_count || 0})` },
              { id: 'failed', label: 'Failed' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date Filter & Search */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-control"
              style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_month">This Month</option>
            </select>

            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search UTR, Bill #, Customer..."
                  style={{ padding: '6px 10px 6px 32px', fontSize: '0.85rem', width: '220px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>
              <button type="submit" className="btn btn-secondary btn-sm">Search</button>
            </form>
          </div>
        </div>

        {/* Bulk Action Bar if items selected */}
        {selectedIds.length > 0 && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#a5b4fc' }}>
              {selectedIds.length} payments selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-success btn-sm"
                onClick={handleBulkConfirm}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={14} /> Mark Confirmed
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedIds([])}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
            Loading UPI transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
            No UPI transactions found matching the selected filter criteria.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === transactions.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Date & Time</th>
                  <th>Bill / Reference</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>UTR / Bank Ref Number</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isEditingThisUtr = editingUtrId === tx.id
                  const isConfirmed = tx.status === 'confirmed'
                  const isPending = tx.status === 'pending'

                  return (
                    <tr key={tx.id} style={{ background: selectedIds.includes(tx.id) ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(tx.id)}
                          onChange={() => handleSelectRow(tx.id)}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {new Date(tx.date).toLocaleDateString()}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>
                        {tx.bill_id ? (
                          <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                            {tx.bill_id}
                          </span>
                        ) : (
                          <span className="text-muted">Direct / Unlinked</span>
                        )}
                      </td>
                      <td>
                        <div>{tx.customer_name || 'Walk-in Customer'}</div>
                        {tx.customer_phone && (
                          <div className="font-mono text-muted" style={{ fontSize: '0.75rem' }}>{tx.customer_phone}</div>
                        )}
                      </td>
                      <td className="font-mono tabular-nums" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        ₹{(parseFloat(tx.amount) || 0).toFixed(2)}
                      </td>
                      <td>
                        {isEditingThisUtr ? (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="form-control font-mono"
                              style={{ padding: '2px 6px', fontSize: '0.8rem', width: '150px' }}
                              value={editingUtrValue}
                              onChange={(e) => setEditingUtrValue(e.target.value)}
                              placeholder="Enter UTR / Ref..."
                              autoFocus
                            />
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 8px' }}
                              onClick={() => handleSaveUtr(tx.id)}
                            >
                              <Check size={12} />
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px' }}
                              onClick={() => setEditingUtrId(null)}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {tx.upi_ref ? (
                              <code className="font-mono" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.82rem' }}>
                                {tx.upi_ref}
                              </code>
                            ) : (
                              <span className="text-muted" style={{ fontStyle: 'italic', fontSize: '0.82rem' }}>
                                Not entered
                              </span>
                            )}
                            <button
                              className="btn-icon"
                              style={{ padding: '2px', opacity: 0.7 }}
                              onClick={() => {
                                setEditingUtrId(tx.id)
                                setEditingUtrValue(tx.upi_ref || '')
                              }}
                              title="Edit UTR Number"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background: isConfirmed ? 'rgba(16, 185, 129, 0.15)' : isPending ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: isConfirmed ? '#10b981' : isPending ? '#f59e0b' : '#f43f5e',
                            border: `1px solid ${isConfirmed ? 'rgba(16, 185, 129, 0.3)' : isPending ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
                          }}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isPending ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-success btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                              onClick={() => handleUpdateStatus(tx.id, 'confirmed')}
                            >
                              Confirm
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.78rem', color: '#f43f5e' }}
                              onClick={() => handleUpdateStatus(tx.id, 'failed')}
                            >
                              Fail
                            </button>
                          </div>
                        ) : isConfirmed ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                            onClick={() => handleUpdateStatus(tx.id, 'pending')}
                          >
                            Mark Pending
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                            onClick={() => handleUpdateStatus(tx.id, 'confirmed')}
                          >
                            Re-Confirm
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Daily Settlement Report (Printable) ────────────────────────── */}
      {showSettlementModal && (
        <div className="modal-overlay" onClick={() => setShowSettlementModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header print-hide">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText className="text-accent" size={20} /> Daily UPI Settlement Statement
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="date"
                  className="form-control"
                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                  value={settlementDate}
                  onChange={(e) => {
                    setSettlementDate(e.target.value)
                    handleOpenSettlement(e.target.value)
                  }}
                />
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                  <Printer size={14} /> Print PDF
                </button>
                <button className="btn-icon" onClick={() => setShowSettlementModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {settlementLoading || !settlementData ? (
              <div style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
                Generating settlement report...
              </div>
            ) : (
              <div className="settlement-document" style={{ padding: '16px 8px', color: '#0f172a', background: '#ffffff', borderRadius: '4px' }}>
                {/* Shop Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px dashed #cbd5e1', paddingBottom: '16px', marginBottom: '16px' }}>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '1.4rem', color: '#0f172a' }}>
                    {business?.shopName || 'PRINT SERVICE'}
                  </h2>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    {business?.address && <div>{business.address}</div>}
                    {business?.phone && <div>Phone: {business.phone}</div>}
                    {business?.gstin && <div>GSTIN: {business.gstin}</div>}
                  </div>
                  <div style={{ marginTop: '10px', display: 'inline-block', border: '1px solid #0f172a', padding: '2px 12px', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '1px' }}>
                    DAILY UPI SETTLEMENT SUMMARY — {settlementData.date}
                  </div>
                </div>

                {/* Summary Metrics Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '20px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 0', fontWeight: 600 }}>Total Transactions Recorded</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{settlementData.summary.total_transactions}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 0', color: '#15803d', fontWeight: 600 }}>Confirmed / Settled UPI Volume</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', color: '#15803d', fontWeight: 700, fontSize: '1.05rem' }}>
                        ₹{settlementData.summary.confirmed_total.toFixed(2)} ({settlementData.summary.confirmed_count} txns)
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 0', color: '#b45309' }}>Pending Reconciliation</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', color: '#b45309' }}>
                        ₹{settlementData.summary.pending_total.toFixed(2)} ({settlementData.summary.pending_count} txns)
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '2px solid #0f172a', background: '#f1f5f9' }}>
                      <td style={{ padding: '8px 4px', fontWeight: 700 }}>Total Gross UPI Expected</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 800, fontSize: '1.1rem' }}>
                        ₹{settlementData.summary.grand_total.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Itemized Transactions List */}
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                  Settlement Transaction Audit Log
                </h4>
                {settlementData.transactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontStyle: 'italic' }}>
                    No UPI transactions on this date.
                  </div>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '4px 0' }}>Time</th>
                        <th>Bill / Ref</th>
                        <th>Customer</th>
                        <th>UTR / Bank Ref</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementData.transactions.map((t, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px dotted #e2e8f0' }}>
                          <td style={{ padding: '5px 0' }}>{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td style={{ fontWeight: 600 }}>{t.bill_id || 'Direct'}</td>
                          <td>{t.customer_name || 'Walk-in'}</td>
                          <td><code>{t.upi_ref || '—'}</code></td>
                          <td style={{ textTransform: 'uppercase', fontWeight: 600, color: t.status === 'confirmed' ? '#15803d' : '#b45309' }}>
                            {t.status}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{(parseFloat(t.amount) || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Signature Block */}
                <div style={{ marginTop: '36px', paddingTop: '16px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                  <div>Prepared By: __________________</div>
                  <div>Accountant Signature: __________________</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Manual Log UPI Transaction ─────────────────────────────────── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !savingManual && setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus className="text-accent" size={20} /> Log UPI Transaction
              </h3>
              <button className="btn-icon" onClick={() => setShowAddModal(false)} disabled={savingManual}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleManualSubmit}>
              <div className="modal-body" style={{ padding: '16px 0' }}>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Amount (₹) <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control"
                    placeholder="500.00"
                    value={manualForm.amount}
                    onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">UTR / Bank Reference Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 423987123456"
                    value={manualForm.upi_ref}
                    onChange={(e) => setManualForm({ ...manualForm, upi_ref: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Bill ID / Invoice # (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. INV-001"
                    value={manualForm.bill_id}
                    onChange={(e) => setManualForm({ ...manualForm, bill_id: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Status</label>
                  <select
                    className="form-control"
                    value={manualForm.status}
                    onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={savingManual}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingManual}>
                  {savingManual ? 'Saving...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UpiReconciliation
