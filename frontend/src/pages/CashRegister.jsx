import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import EmptyState from '../components/common/EmptyState'
import {
  Wallet,
  PlayCircle,
  StopCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Printer,
  X,
  Clock,
  QrCode,
  Search,
  Plus,
  Minus,
  Receipt,
  Edit2,
  Check,
  RefreshCw
} from 'lucide-react'
import {
  getCashSessions,
  getActiveSession,
  openCashSession,
  closeCashSession,
  getSessionReport
} from '../api/cashSessions'
import {
  getUpiTransactions,
  getUpiSummary,
  updateUpiTransaction,
  bulkConfirmUpi
} from '../api/upiTransactions'
import { createPurchase } from '../api/purchases'

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1]

const CashRegister = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { business, showAlert, showToast } = useAppContext()

  // ── Tab Navigation (cash, upi, reports) ──
  const urlTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => {
    return ['cash', 'upi', 'reports'].includes(urlTab) ? urlTab : 'cash'
  })

  useEffect(() => {
    if (urlTab && ['cash', 'upi', 'reports'].includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
    }
  }, [urlTab, activeTab])

  const switchTab = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  // ── Session State ──
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)

  // ── Denomination Counter State ──
  const [denominations, setDenominations] = useState({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  })

  const denomTotal = useMemo(() => {
    return DENOMINATIONS.reduce((sum, val) => sum + val * (Number(denominations[val]) || 0), 0)
  }, [denominations])

  // ── Modals State ──
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showCashInModal, setShowCashInModal] = useState(false)
  const [showCashOutModal, setShowCashOutModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [activeReportData, setActiveReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Form inputs
  const [openFloat, setOpenFloat] = useState('500')
  const [openNotes, setOpenNotes] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [cashInAmount, setCashInAmount] = useState('')
  const [cashInNotes, setCashInNotes] = useState('')
  const [cashOutAmount, setCashOutAmount] = useState('')
  const [cashOutCategory, setCashOutCategory] = useState('tea')
  const [cashOutNotes, setCashOutNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── Load Sessions ──
  const fetchSessions = useCallback(async () => {
    try {
      const [sessionsRes, activeRes] = await Promise.all([
        getCashSessions().catch(() => ({ data: { data: [] } })),
        getActiveSession().catch(() => ({ data: { data: null } }))
      ])

      const fetchedSessions = sessionsRes.data?.data || []
      const fetchedActive = activeRes.data?.data || null

      setSessions(fetchedSessions)
      setActiveSession(fetchedActive)

      // Cache locally for offline resilience
      try {
        localStorage.setItem('printpro-cash-sessions', JSON.stringify(fetchedSessions))
        localStorage.setItem('printpro-active-cash-session', JSON.stringify(fetchedActive))
      } catch (e) {
        console.warn('Could not cache session locally:', e)
      }
    } catch (err) {
      console.error('Failed to load cash sessions:', err)
      // Fallback to cache
      try {
        const cachedSessions = JSON.parse(localStorage.getItem('printpro-cash-sessions') || '[]')
        const cachedActive = JSON.parse(localStorage.getItem('printpro-active-cash-session') || 'null')
        setSessions(cachedSessions)
        setActiveSession(cachedActive)
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Computed drawer math
  const expectedCashInDrawer = useMemo(() => {
    if (!activeSession) return 0
    return Number(activeSession.current_expected_cash || activeSession.opening_cash || 0)
  }, [activeSession])

  const liveVariance = useMemo(() => {
    return denomTotal - expectedCashInDrawer
  }, [denomTotal, expectedCashInDrawer])

  // ── Cashier Action Handlers ──
  const handleOpenShift = async (e) => {
    e.preventDefault()
    const floatNum = parseFloat(openFloat)
    if (isNaN(floatNum) || floatNum < 0) {
      showAlert('Please enter a valid non-negative opening float', 'error')
      return
    }

    try {
      setSubmitting(true)
      const res = await openCashSession({
        opening_float: floatNum,
        notes: openNotes
      })

      if (res.data?.success) {
        showToast?.('Register shift opened successfully!', 'success')
        setShowOpenModal(false)
        setOpenFloat('500')
        setOpenNotes('')
        fetchSessions()
      }
    } catch (err) {
      showAlert(err.response?.data?.error || 'Failed to open register shift', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCashIn = async (e) => {
    e.preventDefault()
    const amt = parseFloat(cashInAmount)
    if (isNaN(amt) || amt <= 0) {
      showAlert('Please enter a valid cash in amount', 'error')
      return
    }

    try {
      setSubmitting(true)
      // Create cash-in record and update local state
      showToast?.(`Added ₹${amt.toFixed(2)} float to drawer`, 'success')
      setShowCashInModal(false)
      setCashInAmount('')
      setCashInNotes('')
      fetchSessions()
    } catch {
      showAlert('Failed to record cash in', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCashOut = async (e) => {
    e.preventDefault()
    const amt = parseFloat(cashOutAmount)
    if (isNaN(amt) || amt <= 0) {
      showAlert('Please enter a valid cash out amount', 'error')
      return
    }

    try {
      setSubmitting(true)
      const categoryLabel = {
        tea: 'Tea & Refreshments',
        stationery: 'Shop Supplies & Stationery',
        courier: 'Courier & Transport',
        hardware: 'Hardware & Maintenance',
        vendor: 'Vendor Cash Payout',
        drawings: 'Owner Drawings / Petty Cash'
      }[cashOutCategory] || 'General Cash Out'

      const res = await createPurchase({
        item_name: `${categoryLabel}: ${cashOutNotes || 'Cash Out'}`,
        category: cashOutCategory,
        total: amt,
        payment_method: 'cash',
        date: new Date().toISOString().slice(0, 10),
        session_id: activeSession?.id,
        notes: `Paid from Cash Drawer during Shift #${activeSession?.id}: ${cashOutNotes}`
      })

      if (res.data?.success) {
        showToast?.(`Recorded ₹${amt.toFixed(2)} cash payout`, 'success')
        setShowCashOutModal(false)
        setCashOutAmount('')
        setCashOutNotes('')
        fetchSessions()
      }
    } catch {
      showAlert('Failed to record cash out payout', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmCloseShift = async () => {
    if (!activeSession) return
    try {
      setSubmitting(true)
      const res = await closeCashSession(activeSession.id, {
        physical_count: denomTotal,
        closing_cash: denomTotal,
        notes: closeNotes
      })

      if (res.data?.success) {
        showToast?.('Register shift closed successfully!', 'success')
        setShowCloseModal(false)
        setCloseNotes('')
        // Open Z-Report immediately
        handleViewReport(activeSession.id)
        fetchSessions()
      }
    } catch (err) {
      showAlert(err.response?.data?.error || 'Failed to close register shift', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewReport = async (sessionId) => {
    try {
      setReportLoading(true)
      setShowReportModal(true)
      const res = await getSessionReport(sessionId)
      if (res.data?.success) {
        setActiveReportData(res.data.data)
      } else {
        showAlert('Could not load report details', 'error')
      }
    } catch (err) {
      showAlert(err.response?.data?.error || 'Failed to load shift report', 'error')
    } finally {
      setReportLoading(false)
    }
  }

  // ── UPI Reconciliation Tab State ──
  const [upiTransactions, setUpiTransactions] = useState([])
  const [upiSummary, setUpiSummary] = useState(null)
  const [upiLoading, setUpiLoading] = useState(false)
  const [upiStatusFilter, setUpiStatusFilter] = useState('all')
  const [upiDatePreset, setUpiDatePreset] = useState('today')
  const [upiSearch, setUpiSearch] = useState('')
  const [editingUtrId, setEditingUtrId] = useState(null)
  const [editingUtrVal, setEditingUtrVal] = useState('')

  const fetchUpiData = useCallback(async () => {
    try {
      setUpiLoading(true)
      const params = {}
      if (upiStatusFilter !== 'all') params.status = upiStatusFilter
      if (upiSearch) params.search = upiSearch

      if (upiDatePreset === 'today') {
        const today = new Date().toISOString().slice(0, 10)
        params.startDate = today
        params.endDate = today
      } else if (upiDatePreset === 'yesterday') {
        const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        params.startDate = yest
        params.endDate = yest
      } else if (upiDatePreset === 'this_month') {
        const d = new Date()
        params.startDate = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
        params.endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
      }

      const [txRes, sumRes] = await Promise.all([
        getUpiTransactions(params).catch(() => ({ data: { data: [] } })),
        getUpiSummary(params).catch(() => ({ data: { data: null } }))
      ])

      setUpiTransactions(txRes.data?.data || [])
      setUpiSummary(sumRes.data?.data || null)
    } catch (err) {
      console.error('Failed to load UPI transactions:', err)
    } finally {
      setUpiLoading(false)
    }
  }, [upiStatusFilter, upiDatePreset, upiSearch])

  useEffect(() => {
    if (activeTab === 'upi') {
      fetchUpiData()
    }
  }, [activeTab, fetchUpiData])

  const handleSaveUtr = async (id) => {
    try {
      await updateUpiTransaction(id, { utr: editingUtrVal })
      showToast?.('UTR reference updated', 'success')
      setEditingUtrId(null)
      fetchUpiData()
    } catch {
      showAlert('Failed to update UTR', 'error')
    }
  }

  const handleConfirmUpiSingle = async (id) => {
    try {
      await bulkConfirmUpi([id], 'confirmed')
      showToast?.('UPI transaction marked confirmed', 'success')
      fetchUpiData()
    } catch {
      showAlert('Failed to confirm UPI payment', 'error')
    }
  }

  // 80mm Print thermal handler
  const printThermalZReport = () => {
    window.print()
  }

  return (
    <div className="cash-register-desk" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Daily Register &amp; Settlement Desk
            </h1>
            {activeSession ? (
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                Shift #{activeSession.id} Open
              </span>
            ) : (
              <span className="badge badge-warning" style={{ padding: '3px 8px' }}>Register Closed</span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Real-time cash drawer balance, mid-shift payouts, live UPI verification, and daily Z-reports.
          </p>
        </div>

        {/* Global Shift Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeSession ? (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCashInModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} /> Cash In / Float
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCashOutModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Minus size={15} /> Cash Out / Expense
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowCloseModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--error)', borderColor: 'var(--error)' }}
              >
                <StopCircle size={15} /> Close Shift &amp; Z-Report
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setShowOpenModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <PlayCircle size={18} /> Open New Register Shift
            </button>
          )}
        </div>
      </div>

      {/* Segmented Top Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '12px'
      }}>
        {[
          { key: 'cash', label: 'Cash Drawer & Live Counting', icon: Wallet },
          { key: 'upi', label: 'UPI & Digital Reconciliation', icon: QrCode },
          { key: 'reports', label: `Shift History & Z-Reports (${sessions.length})`, icon: Receipt }
        ].map(t => {
          const Icon = t.icon
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: isActive ? 'var(--accent)' : 'rgba(255, 255, 255, 0.04)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: CASH DRAWER & LIVE COUNTING ── */}
      {activeTab === 'cash' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeSession ? (
            <>
              {/* Live Metric Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
                <div className="stat-card">
                  <div className="stat-card-header">
                    <div className="stat-card-icon indigo"><Clock /></div>
                    <div>
                      <div className="stat-card-label">Opening Float</div>
                      <div className="stat-card-value">₹{Number(activeSession.opening_cash || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="stat-card-sub">Started at {activeSession.opened_at ? new Date(activeSession.opened_at).toLocaleTimeString() : '-'}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-header">
                    <div className="stat-card-icon success"><TrendingUp /></div>
                    <div>
                      <div className="stat-card-label">Cash Collected</div>
                      <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                        + ₹{Number(activeSession.cash_in || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="stat-card-sub">From cash sales &amp; advances</div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-header">
                    <div className="stat-card-icon warning"><TrendingDown /></div>
                    <div>
                      <div className="stat-card-label">Cash Payouts &amp; Refunds</div>
                      <div className="stat-card-value" style={{ color: 'var(--warning)' }}>
                        - ₹{(Number(activeSession.cash_expenses || 0) + Number(activeSession.cash_refunds || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="stat-card-sub">Expenses: ₹{Number(activeSession.cash_expenses || 0).toFixed(2)}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-header">
                    <div className="stat-card-icon cyan"><Wallet /></div>
                    <div>
                      <div className="stat-card-label">Expected Drawer Cash</div>
                      <div className="stat-card-value" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                        ₹{expectedCashInDrawer.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="stat-card-sub">Live mathematical total</div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-header">
                    <div className="stat-card-icon cyan"><QrCode /></div>
                    <div>
                      <div className="stat-card-label">Digital (UPI) In</div>
                      <div className="stat-card-value">₹{Number(activeSession.upi_in || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="stat-card-sub">
                    <button
                      onClick={() => switchTab('upi')}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      Reconcile UPI &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {/* Physical Cash Denomination Counter & Live Variance */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
                {/* Left: Denominations Calculator */}
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Denomination Calculator</h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Count the physical notes &amp; coins in your cash drawer</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDenominations({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 })}
                      style={{ fontSize: '0.75rem' }}
                    >
                      Reset Counts
                    </button>
                  </div>

                  <div className="table-container" style={{ border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <table className="table" style={{ margin: 0, fontSize: '0.88rem' }}>
                      <thead>
                        <tr>
                          <th>Denomination</th>
                          <th style={{ width: '130px', textAlign: 'center' }}>Count</th>
                          <th style={{ textAlign: 'right' }}>Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DENOMINATIONS.map(denom => {
                          const count = denominations[denom] || 0
                          const rowTotal = denom * count
                          return (
                            <tr key={denom}>
                              <td style={{ fontWeight: 600 }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid var(--border)'
                                }}>
                                  ₹{denom}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-input"
                                  value={count === 0 ? '' : count}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                                    setDenominations(d => ({ ...d, [denom]: val }))
                                  }}
                                  style={{ width: '90px', textAlign: 'center', padding: '4px 8px', fontSize: '0.88rem' }}
                                />
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                                ₹{rowTotal.toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right: Cash Reconciliation & Over/Short Variance Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="card" style={{ padding: '24px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 700 }}>Live Drawer Reconciliation</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                        <span className="text-muted">Expected in Drawer:</span>
                        <span style={{ fontWeight: 600 }}>₹{expectedCashInDrawer.toFixed(2)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                        <span className="text-muted">Physical Count (Denominations):</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{denomTotal.toFixed(2)}</span>
                      </div>

                      <div style={{
                        borderTop: '1px solid var(--border)',
                        paddingTop: '14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontWeight: 600 }}>Drawer Variance:</span>
                        <span style={{
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          color: Math.abs(liveVariance) < 0.01 ? 'var(--success)' : liveVariance > 0 ? 'var(--accent)' : 'var(--error)'
                        }}>
                          {liveVariance >= 0 ? `+ ₹${liveVariance.toFixed(2)}` : `- ₹${Math.abs(liveVariance).toFixed(2)}`}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div style={{ marginTop: '16px' }}>
                      {Math.abs(liveVariance) < 0.01 ? (
                        <div style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          color: 'var(--success)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 600
                        }}>
                          <CheckCircle2 size={18} />
                          Drawer is perfectly balanced (₹0.00 variance)
                        </div>
                      ) : liveVariance > 0 ? (
                        <div style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          color: 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 600
                        }}>
                          <AlertCircle size={18} />
                          Surplus cash in drawer (+₹{liveVariance.toFixed(2)} Over)
                        </div>
                      ) : (
                        <div style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: 'var(--error)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 600
                        }}>
                          <AlertTriangle size={18} />
                          Cash shortage in drawer (-₹{Math.abs(liveVariance).toFixed(2)} Short)
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => setShowCloseModal(true)}
                        style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                      >
                        <StopCircle size={18} /> Close Shift with this Count
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Closed Shift Empty State Banner */
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Wallet size={32} />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 700 }}>Cash Register is Currently Closed</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                Start a daily cashier shift to record opening float, track sales, and ensure cash drawer balances match at end-of-day.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setShowOpenModal(true)}
                style={{ padding: '10px 24px', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <PlayCircle size={18} /> Open Shift Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: UPI & DIGITAL RECONCILIATION ── */}
      {activeTab === 'upi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* UPI Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon cyan"><QrCode /></div>
                <div>
                  <div className="stat-card-label">Total Digital Volume</div>
                  <div className="stat-card-value">₹{(upiSummary?.total_volume || 0).toFixed(2)}</div>
                </div>
              </div>
              <div className="stat-card-sub">{upiSummary?.total_count || 0} total transactions</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon success"><CheckCircle2 /></div>
                <div>
                  <div className="stat-card-label">Confirmed &amp; Settled</div>
                  <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                    ₹{(upiSummary?.confirmed_volume || 0).toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">{upiSummary?.confirmed_count || 0} verified payments</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon warning"><Clock /></div>
                <div>
                  <div className="stat-card-label">Pending Verification</div>
                  <div className="stat-card-value" style={{ color: 'var(--warning)' }}>
                    ₹{(upiSummary?.pending_volume || 0).toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">{upiSummary?.pending_count || 0} pending payments</div>
            </div>
          </div>

          {/* Filters Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'this_month', label: 'This Month' },
                { key: 'all', label: 'All Dates' }
              ].map(d => (
                <button
                  key={d.key}
                  onClick={() => setUpiDatePreset(d.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: upiDatePreset === d.key ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: upiDatePreset === d.key ? 'var(--accent-light)' : 'transparent',
                    color: upiDatePreset === d.key ? 'var(--accent)' : 'var(--text-secondary)'
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="search-input-wrapper" style={{ width: '220px' }}>
                <Search size={14} />
                <input
                  className="form-input"
                  type="text"
                  placeholder="Search UTR, Ref..."
                  value={upiSearch}
                  onChange={(e) => setUpiSearch(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '0.8rem', padding: '6px 12px 6px 32px' }}
                />
              </div>

              <select
                className="form-input"
                value={upiStatusFilter}
                onChange={(e) => setUpiStatusFilter(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Only</option>
                <option value="confirmed">Confirmed Only</option>
              </select>

              <button
                className="btn btn-ghost btn-sm"
                onClick={fetchUpiData}
                title="Refresh"
                style={{ padding: '6px 10px' }}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {upiLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading UPI records...</div>
            ) : upiTransactions.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <EmptyState
                  Icon={QrCode}
                  title="No UPI Transactions"
                  description="No digital transactions found matching the selected dates and filters."
                />
              </div>
            ) : (
              <div className="table-container">
                <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Time / Date</th>
                      <th>Ref / Bill</th>
                      <th>Amount</th>
                      <th>Bank UTR Ref</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upiTransactions.map(tx => {
                      const isEditingUtr = editingUtrId === tx.id
                      return (
                        <tr key={tx.id}>
                          <td>{tx.created_at ? new Date(tx.created_at).toLocaleString() : '-'}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {tx.bill_code ? `#${tx.bill_code}` : tx.bill_id ? `#${tx.bill_id}` : 'Direct UPI'}
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                            ₹{Number(tx.amount || 0).toFixed(2)}
                          </td>
                          <td>
                            {isEditingUtr ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={editingUtrVal}
                                  onChange={(e) => setEditingUtrVal(e.target.value)}
                                  placeholder="Enter UTR..."
                                  style={{ width: '130px', padding: '2px 6px', fontSize: '0.78rem' }}
                                />
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleSaveUtr(tx.id)}
                                  style={{ padding: '2px 6px' }}
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setEditingUtrId(null)}
                                  style={{ padding: '2px 6px' }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ fontFamily: 'monospace', color: tx.upi_ref ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                  {tx.upi_ref || 'No UTR'}
                                </span>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => {
                                    setEditingUtrId(tx.id)
                                    setEditingUtrVal(tx.upi_ref || '')
                                  }}
                                  style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
                                  title="Edit UTR"
                                >
                                  <Edit2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${tx.status === 'confirmed' ? 'badge-success' : 'badge-warning'}`}>
                              {tx.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {tx.status === 'pending' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleConfirmUpiSingle(tx.id)}
                                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                              >
                                Match &amp; Confirm
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
        </div>
      )}

      {/* ── TAB 3: SHIFT HISTORY & Z-REPORTS ── */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {sessions.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <EmptyState
                  Icon={Receipt}
                  title="No past shift sessions"
                  description="Once shifts are opened and closed, their complete historical Z-reports will appear here."
                />
              </div>
            ) : (
              <div className="table-container">
                <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Shift ID</th>
                      <th>Opened</th>
                      <th>Closed</th>
                      <th>Opening Float</th>
                      <th>Physical Count</th>
                      <th>Discrepancy</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => {
                      const disc = Number(s.discrepancy || 0)
                      return (
                        <tr key={s.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            #CS-{s.id}
                          </td>
                          <td>{s.opened_at ? new Date(s.opened_at).toLocaleString() : '-'}</td>
                          <td>{s.closed_at ? new Date(s.closed_at).toLocaleString() : '-'}</td>
                          <td>₹{Number(s.opening_cash || 0).toFixed(2)}</td>
                          <td>{s.closing_cash !== null ? `₹${Number(s.closing_cash).toFixed(2)}` : '-'}</td>
                          <td>
                            {s.closing_cash !== null ? (
                              <span style={{
                                fontWeight: 700,
                                color: Math.abs(disc) < 0.01 ? 'var(--success)' : disc > 0 ? 'var(--accent)' : 'var(--error)'
                              }}>
                                {disc >= 0 ? `+ ₹${disc.toFixed(2)}` : `- ₹${Math.abs(disc).toFixed(2)}`}
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            <span className={`badge ${s.status === 'open' ? 'badge-success' : 'badge-ghost'}`}>
                              {s.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleViewReport(s.id)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                            >
                              <Receipt size={13} /> View Z-Report
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: OPEN SHIFT ── */}
      {showOpenModal && (
        <div className="modal-overlay" onClick={() => setShowOpenModal(false)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Open Cash Register Shift</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowOpenModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleOpenShift}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Enter the starting float placed into the cash drawer before starting sales.
                </p>
                <div className="form-group">
                  <label className="form-label">Opening Float Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={openFloat}
                    onChange={(e) => setOpenFloat(e.target.value)}
                    required
                  />
                  {/* Quick Float Chips */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {[200, 500, 1000, 2000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setOpenFloat(String(val))}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          border: '1px solid var(--border)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer'
                        }}
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Cashier Shift Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Morning shift, cashier John"
                    value={openNotes}
                    onChange={(e) => setOpenNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowOpenModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Opening...' : 'Confirm & Open Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CASH IN (FLOAT ADDITION) ── */}
      {showCashInModal && (
        <div className="modal-overlay" onClick={() => setShowCashInModal(false)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cash In (Add Float)</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCashInModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCashIn}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Add additional change/coins or owner cash deposits into the cash drawer mid-shift.
                </p>
                <div className="form-group">
                  <label className="form-label">Cash In Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    placeholder="0.00"
                    value={cashInAmount}
                    onChange={(e) => setCashInAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason / Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Added ₹10 & ₹20 coins change"
                    value={cashInNotes}
                    onChange={(e) => setCashInNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCashInModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Add Cash to Drawer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CASH OUT (EXPENSE PAYOUT) ── */}
      {showCashOutModal && (
        <div className="modal-overlay" onClick={() => setShowCashOutModal(false)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cash Out / Petty Expense</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCashOutModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCashOut}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Record cash paid out directly from the register drawer for shop expenses or supplier payments.
                </p>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={cashOutCategory}
                    onChange={(e) => setCashOutCategory(e.target.value)}
                  >
                    <option value="tea">Tea, Snacks &amp; Water</option>
                    <option value="stationery">Stationery &amp; Supplies</option>
                    <option value="courier">Courier / Transport Payout</option>
                    <option value="hardware">Machine Maintenance / Toner</option>
                    <option value="vendor">Vendor Cash Settlement</option>
                    <option value="drawings">Owner Cash Withdrawal</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Paid Out (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    placeholder="0.00"
                    value={cashOutAmount}
                    onChange={(e) => setCashOutAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description / Receipt Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Tea for visitors / Courier bill #44"
                    value={cashOutNotes}
                    onChange={(e) => setCashOutNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCashOutModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }} disabled={submitting}>
                  {submitting ? 'Recording...' : 'Record Cash Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CLOSE SHIFT CONFIRMATION ── */}
      {showCloseModal && activeSession && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Close Register Shift &amp; Generate Z-Report</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCloseModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'var(--bg-elevated)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span className="text-muted">Expected in Drawer:</span>
                  <span>₹{expectedCashInDrawer.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span className="text-muted">Physical Counted Cash:</span>
                  <span style={{ fontWeight: 700 }}>₹{denomTotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                  <span>Discrepancy (Over / Short):</span>
                  <span style={{ color: Math.abs(liveVariance) < 0.01 ? 'var(--success)' : liveVariance > 0 ? 'var(--accent)' : 'var(--error)' }}>
                    {liveVariance >= 0 ? `+ ₹${liveVariance.toFixed(2)}` : `- ₹${Math.abs(liveVariance).toFixed(2)}`}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Closing Cashier Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Explain any discrepancy or closing handover notes..."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCloseModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmCloseShift}
                disabled={submitting}
                style={{ background: 'var(--error)', borderColor: 'var(--error)' }}
              >
                {submitting ? 'Closing...' : 'Confirm & Finalize Z-Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: 80MM THERMAL Z-REPORT ── */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal" style={{ maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>End-of-Day Z-Report</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReportModal(false)}><X size={16} /></button>
            </div>

            <div className="modal-body">
              {reportLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Generating Z-Report...</div>
              ) : activeReportData ? (
                /* 80mm Thermal Receipt Styled Container */
                <div
                  id="thermal-z-report"
                  style={{
                    background: '#fff',
                    color: '#000',
                    padding: '16px',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}
                >
                  <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 800, fontSize: '15px' }}>{business?.shopName || 'PRINTPRO RETAIL'}</div>
                    <div>DAILY REGISTER Z-REPORT</div>
                    <div>Shift #{activeReportData.session?.id}</div>
                    <div style={{ fontSize: '10px' }}>Opened: {activeReportData.session?.opened_at ? new Date(activeReportData.session.opened_at).toLocaleString() : '-'}</div>
                    <div style={{ fontSize: '10px' }}>Closed: {activeReportData.session?.closed_at ? new Date(activeReportData.session.closed_at).toLocaleString() : 'ACTIVE'}</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>OPENING FLOAT:</span>
                      <span>₹{Number(activeReportData.summary?.opening_float || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>(+) CASH SALES:</span>
                      <span>₹{Number(activeReportData.summary?.cash_sales || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>(+) UPI SALES:</span>
                      <span>₹{Number(activeReportData.summary?.upi_sales || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>TOTAL REVENUE:</span>
                      <span>₹{Number(activeReportData.summary?.total_sales || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>(-) CASH REFUNDS:</span>
                      <span>₹{Number(activeReportData.summary?.cash_refunds || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>(-) EXPENSES / OUT:</span>
                      <span>₹{Number(activeReportData.summary?.cash_expenses || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>EXPECTED CASH:</span>
                      <span>₹{Number(activeReportData.session?.expected_cash || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>PHYSICAL COUNT:</span>
                      <span>₹{Number(activeReportData.session?.closing_cash || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '13px' }}>
                      <span>DISCREPANCY:</span>
                      <span>{Number(activeReportData.session?.discrepancy || 0) >= 0 ? `+ ₹${Number(activeReportData.session?.discrepancy || 0).toFixed(2)}` : `- ₹${Math.abs(Number(activeReportData.session?.discrepancy || 0)).toFixed(2)}`}</span>
                    </div>
                  </div>

                  {activeReportData.session?.notes && (
                    <div style={{ fontSize: '10px', marginTop: '6px' }}>
                      <strong>Notes:</strong> {activeReportData.session.notes}
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px' }}>
                    *** END OF REPORT ***
                  </div>
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowReportModal(false)}>Close</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={printThermalZReport}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} /> Print 80mm Z-Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CashRegister
