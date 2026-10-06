import React, { useState, useEffect, useMemo } from 'react'
import {
  Wallet,
  PlayCircle,
  StopCircle,
  FileText,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Printer,
  X,
  Plus,
  Minus,
  DollarSign,
  ArrowRight,
  Clock,
  Calendar,
  Layers,
  Coins
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import {
  getCashSessions,
  getActiveSession,
  openCashSession,
  closeCashSession,
  getSessionReport
} from '../api/cashSessions'

const CashRegister = () => {
  const { business, showAlert, showToast, showConfirm, payments, purchases, dispatch } = useAppContext()

  const [sessions, setSessions] = useState(() => {
    try {
      const cached = localStorage.getItem('printpro-cash-sessions')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  const [activeSession, setActiveSession] = useState(() => {
    try {
      const cached = localStorage.getItem('printpro-active-cash-session')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Form states
  const [openFloat, setOpenFloat] = useState('500')
  const [openNotes, setOpenNotes] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Denominations for counting modal
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
  const [manualCount, setManualCount] = useState('')
  const [useDenomMode, setUseDenomMode] = useState(false)

  const denomTotal = useMemo(() => {
    return Object.entries(denominations).reduce((sum, [val, count]) => {
      return sum + Number(val) * (Number(count) || 0)
    }, 0)
  }, [denominations])

  const calculatedPhysicalCount = useMemo(() => {
    if (useDenomMode) return denomTotal
    return manualCount === '' ? 0 : Number(manualCount)
  }, [useDenomMode, denomTotal, manualCount])

  const loadSessions = async () => {
    try {
      setLoading(true)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cachedSessions = JSON.parse(localStorage.getItem('printpro-cash-sessions') || '[]')
        const cachedActive = JSON.parse(localStorage.getItem('printpro-active-cash-session') || 'null')
        setSessions(cachedSessions)
        if (cachedActive) {
          const openedAt = new Date(cachedActive.opened_at || Date.now()).getTime()
          const sessionPayments = (payments || []).filter(p => {
            const pTime = new Date(p.date || p.createdAt || 0).getTime()
            return p.sessionId === cachedActive.id || (!p.sessionId && pTime >= openedAt)
          })
          const sessionPurchases = (purchases || []).filter(pur => {
            const purTime = new Date(pur.date || pur.createdAt || 0).getTime()
            return pur.sessionId === cachedActive.id || (!pur.sessionId && purTime >= openedAt)
          })
          const cashIn = sessionPayments.reduce((sum, p) => (!p.isRefund && p.paymentType !== 'refund' ? sum + Number(p.cashAmount || (p.paymentType === 'cash' ? p.totalPaid || p.amount : 0) || 0) : sum), 0)
          const cashRefunds = sessionPayments.reduce((sum, p) => (p.isRefund || p.paymentType === 'refund' ? sum + Math.abs(Number(p.cashAmount || p.totalPaid || p.amount || 0)) : sum), 0)
          const upiIn = sessionPayments.reduce((sum, p) => (!p.isRefund && p.paymentType !== 'refund' ? sum + Number(p.upiAmount || (p.paymentType === 'upi' ? p.totalPaid || p.amount : 0) || 0) : sum), 0)
          const cashExpenses = sessionPurchases.reduce((sum, pur) => (pur.paymentMethod === 'cash' ? sum + Number(pur.total || 0) : sum), 0)
          const openingCash = parseFloat(cachedActive.opening_cash) || 0
          const currentExpected = parseFloat((openingCash + cashIn - cashRefunds - cashExpenses).toFixed(2))

          setActiveSession({
            ...cachedActive,
            cash_in: cashIn,
            cash_refunds: cashRefunds,
            upi_in: upiIn,
            cash_expenses: cashExpenses,
            current_expected_cash: currentExpected
          })
        } else {
          setActiveSession(null)
        }
        return
      }

      const [allRes, activeRes] = await Promise.all([
        getCashSessions(),
        getActiveSession()
      ])
      const fetchedSessions = allRes.data.data || []
      const fetchedActive = activeRes.data.data || null
      setSessions(fetchedSessions)
      setActiveSession(fetchedActive)
      try {
        localStorage.setItem('printpro-cash-sessions', JSON.stringify(fetchedSessions))
        localStorage.setItem('printpro-active-cash-session', JSON.stringify(fetchedActive))
      } catch (e) {
        console.warn('Failed to cache cash sessions', e)
      }
    } catch (err) {
      console.warn('Failed to load cash sessions from server, using local cache:', err)
      try {
        const cachedSessions = JSON.parse(localStorage.getItem('printpro-cash-sessions') || '[]')
        const cachedActive = JSON.parse(localStorage.getItem('printpro-active-cash-session') || 'null')
        setSessions(cachedSessions)
        setActiveSession(cachedActive)
      } catch (e) {
        if (showAlert) showAlert('Failed to load cash sessions from server.', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const handleOpenSession = async (e) => {
    e.preventDefault()
    const floatNum = parseFloat(openFloat)
    if (isNaN(floatNum) || floatNum < 0) {
      if (showAlert) showAlert('Please enter a valid non-negative opening float.', 'error')
      return
    }

    try {
      setSubmitting(true)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const localSession = {
          id: `local-${Date.now()}`,
          user_id: business?.id,
          opened_at: new Date().toISOString(),
          opening_cash: floatNum,
          status: 'open',
          notes: openNotes,
          cash_in: 0,
          cash_refunds: 0,
          upi_in: 0,
          cash_expenses: 0,
          current_expected_cash: floatNum
        }
        setActiveSession(localSession)
        setSessions(prev => [localSession, ...prev])
        try {
          localStorage.setItem('printpro-active-cash-session', JSON.stringify(localSession))
          localStorage.setItem('printpro-cash-sessions', JSON.stringify([localSession, ...sessions]))
        } catch (e) {}
        if (dispatch) {
          dispatch({ type: 'OPEN_CASH_SESSION', payload: { opening_cash: floatNum, notes: openNotes } })
        }
        if (showToast) showToast('Cash Register opened (Offline Mode)', 'info')
        setShowOpenModal(false)
        setOpenNotes('')
        return
      }

      const res = await openCashSession({
        opening_cash: floatNum,
        notes: openNotes
      })
      if (showToast) showToast('Cash Register opened successfully!', 'success')
      setShowOpenModal(false)
      setOpenNotes('')
      await loadSessions()
    } catch (err) {
      console.error('Error opening register session:', err)
      if (showAlert) showAlert(err.response?.data?.error || 'Failed to open cash register.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenCloseModal = () => {
    if (!activeSession) return
    const expected = activeSession.current_expected_cash ?? activeSession.opening_cash ?? 0
    setManualCount(String(expected))
    setDenominations({
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
    setClosingNotes('')
    setShowCloseModal(true)
  }

  const handleCloseSession = async (e) => {
    e.preventDefault()
    if (!activeSession) return

    const physicalCount = calculatedPhysicalCount
    const expected = activeSession.current_expected_cash ?? activeSession.opening_cash ?? 0
    const variance = physicalCount - expected

    const confirmMsg = `Are you sure you want to close Register #${activeSession.id}?\n\nExpected: ₹${expected.toFixed(2)}\nActual Count: ₹${physicalCount.toFixed(2)}\nVariance: ₹${variance.toFixed(2)}`

    const doClose = async () => {
      try {
        setSubmitting(true)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const closedSession = {
            ...activeSession,
            status: 'closed',
            closed_at: new Date().toISOString(),
            closing_cash: physicalCount,
            expected_cash: expected,
            discrepancy: variance,
            notes: closingNotes || activeSession.notes
          }
          setActiveSession(null)
          setSessions(prev => prev.map(s => s.id === activeSession.id ? closedSession : s))
          try {
            localStorage.removeItem('printpro-active-cash-session')
            localStorage.setItem('printpro-cash-sessions', JSON.stringify(sessions.map(s => s.id === activeSession.id ? closedSession : s)))
          } catch (e) {}
          if (dispatch) {
            dispatch({
              type: 'CLOSE_CASH_SESSION',
              payload: { id: activeSession.id, closing_cash: physicalCount, notes: closingNotes }
            })
          }
          if (showToast) showToast('Cash Register closed (Offline Mode)', 'info')
          setShowCloseModal(false)
          return
        }

        const res = await closeCashSession(activeSession.id, {
          closing_cash: physicalCount,
          notes: closingNotes
        })
        if (showToast) showToast('Cash Register closed successfully!', 'success')
        setShowCloseModal(false)
        await loadSessions()
        handleViewReport(activeSession.id)
      } catch (err) {
        console.error('Error closing register session:', err)
        if (showAlert) showAlert(err.response?.data?.error || 'Failed to close register.', 'error')
      } finally {
        setSubmitting(false)
      }
    }

    if (showConfirm) {
      showConfirm(
        'Confirm Register Close',
        confirmMsg,
        doClose
      )
    } else if (window.confirm(confirmMsg)) {
      doClose()
    }
  }

  const handleViewReport = async (sessionId) => {
    try {
      setReportLoading(true)
      setShowReportModal(true)
      const res = await getSessionReport(sessionId)
      setSelectedReport(res.data.data)
    } catch (err) {
      console.error('Error loading Z-report:', err)
      if (showAlert) showAlert(err.response?.data?.error || 'Failed to fetch Z-report.', 'error')
      setShowReportModal(false)
    } finally {
      setReportLoading(false)
    }
  }

  const handlePrintReport = () => {
    window.print()
  }

  return (
    <div className="cash-register-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Wallet className="text-accent" size={28} />
            Cash Register Sessions
          </h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Track cash drawer float, record cash sales & expenses, reconcile physical count, and generate Z-reports.
          </p>
        </div>
        <div>
          {activeSession ? (
            <button
              className="btn btn-danger"
              onClick={handleOpenCloseModal}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <StopCircle size={18} />
              Close Register
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setShowOpenModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <PlayCircle size={18} />
              Open Cash Register
            </button>
          )}
        </div>
      </div>

      {/* Active Session Hero Card */}
      {activeSession ? (
        <div
          className="card active-session-card"
          style={{
            marginBottom: '28px',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(20, 20, 28, 0.95) 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                REGISTER ACTIVE — SESSION #{activeSession.id}
              </span>
              <span className="text-muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={14} /> Opened {new Date(activeSession.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(activeSession.opened_at).toLocaleDateString()}
              </span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleViewReport(activeSession.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={14} /> View Live Report
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {/* Opening Float */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Opening Float</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
                ₹{(parseFloat(activeSession.opening_cash) || 0).toFixed(2)}
              </div>
            </div>

            {/* Cash In (Sales) */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                <TrendingUp size={14} /> Cash Sales (In)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>
                +₹{(parseFloat(activeSession.cash_in) || 0).toFixed(2)}
              </div>
            </div>

            {/* Cash Out (Refunds + Expenses) */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: '#f43f5e' }}>
                <TrendingDown size={14} /> Cash Out (Expenses/Refunds)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f43f5e' }}>
                -₹{((parseFloat(activeSession.cash_refunds) || 0) + (parseFloat(activeSession.cash_expenses) || 0)).toFixed(2)}
              </div>
            </div>

            {/* Current Expected Drawer */}
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div style={{ fontSize: '0.8rem', marginBottom: '4px', color: '#818cf8', fontWeight: 600 }}>Expected Drawer Cash</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a5b4fc' }}>
                ₹{(parseFloat(activeSession.current_expected_cash) || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="card register-closed-banner"
          style={{
            marginBottom: '28px',
            padding: '24px',
            textAlign: 'center',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
            <StopCircle size={24} />
          </div>
          <h3 style={{ margin: '0 0 6px 0' }}>Register Drawer is Currently Closed</h3>
          <p className="text-muted" style={{ margin: '0 0 16px 0', fontSize: '0.9rem' }}>
            Open a register session at the start of your shift with the opening cash float to begin tracking cash movements.
          </p>
          <button className="btn btn-primary" onClick={() => setShowOpenModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <PlayCircle size={18} /> Open Cash Register
          </button>
        </div>
      )}

      {/* Session History */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Session History</h2>
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>{sessions.length} total sessions</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px' }} className="text-muted">
            Loading session records...
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px' }} className="text-muted">
            No register sessions recorded yet.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Opened</th>
                  <th>Closed</th>
                  <th>Opening Float</th>
                  <th>Expected</th>
                  <th>Actual Count</th>
                  <th>Discrepancy</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const disc = s.discrepancy !== null ? parseFloat(s.discrepancy) : 0
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>#{s.id}</td>
                      <td>
                        {new Date(s.opened_at).toLocaleDateString()} {new Date(s.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        {s.closed_at ? (
                          `${new Date(s.closed_at).toLocaleDateString()} ${new Date(s.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>₹{(parseFloat(s.opening_cash) || 0).toFixed(2)}</td>
                      <td>{s.expected_cash !== null ? `₹${parseFloat(s.expected_cash).toFixed(2)}` : '—'}</td>
                      <td>{s.closing_cash !== null ? `₹${parseFloat(s.closing_cash).toFixed(2)}` : '—'}</td>
                      <td>
                        {s.status === 'closed' ? (
                          disc === 0 ? (
                            <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={14} /> ₹0.00
                            </span>
                          ) : disc > 0 ? (
                            <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                              +₹{disc.toFixed(2)}
                            </span>
                          ) : (
                            <span style={{ color: '#f43f5e', fontWeight: 600 }}>
                              -₹{Math.abs(disc).toFixed(2)}
                            </span>
                          )
                        ) : (
                          <span className="text-muted">—</span>
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
                            background: s.status === 'open' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                            color: s.status === 'open' ? '#10b981' : '#94a3b8'
                          }}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewReport(s.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <FileText size={14} /> Z-Report
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

      {/* ── Modal: Open Cash Register ─────────────────────────────────────────── */}
      {showOpenModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowOpenModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlayCircle className="text-accent" size={20} /> Open Cash Register
              </h3>
              <button className="btn-icon" onClick={() => setShowOpenModal(false)} disabled={submitting}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleOpenSession}>
              <div className="modal-body" style={{ padding: '16px 0' }}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Opening Float Amount (₹) <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    placeholder="500.00"
                    value={openFloat}
                    onChange={(e) => setOpenFloat(e.target.value)}
                    required
                    autoFocus
                  />
                  <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
                    Physical cash in the drawer at shift start (e.g. ₹500 change float).
                  </small>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="e.g. Morning shift drawer float"
                    value={openNotes}
                    onChange={(e) => setOpenNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOpenModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Opening...' : 'Start Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Close Cash Register & Reconcile Count ─────────────────────── */}
      {showCloseModal && activeSession && (
        <div className="modal-overlay" onClick={() => !submitting && setShowCloseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StopCircle className="text-danger" size={20} /> Close Cash Register #{activeSession.id}
              </h3>
              <button className="btn-icon" onClick={() => setShowCloseModal(false)} disabled={submitting}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCloseSession}>
              <div className="modal-body" style={{ padding: '16px 0' }}>
                {/* Drawer Summary Box */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                    <span className="text-muted">Opening Float:</span>
                    <span>₹{(parseFloat(activeSession.opening_cash) || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                    <span className="text-muted">Cash Sales:</span>
                    <span style={{ color: '#10b981' }}>+₹{(parseFloat(activeSession.cash_in) || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                    <span className="text-muted">Cash Expenses & Refunds:</span>
                    <span style={{ color: '#f43f5e' }}>-₹{((parseFloat(activeSession.cash_refunds) || 0) + (parseFloat(activeSession.cash_expenses) || 0)).toFixed(2)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>System Expected Drawer:</span>
                    <span style={{ color: '#a5b4fc', fontSize: '1.05rem' }}>
                      ₹{(parseFloat(activeSession.current_expected_cash) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Count Mode Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>Physical Cash Count (₹)</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setUseDenomMode(!useDenomMode)}
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                  >
                    {useDenomMode ? 'Switch to Simple Total' : 'Use Denomination Breakdown'}
                  </button>
                </div>

                {useDenomMode ? (
                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                      {[500, 200, 100, 50, 20, 10, 5, 2, 1].map((val) => (
                        <div key={val} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '40px', fontSize: '0.8rem', color: '#94a3b8' }}>₹{val}:</span>
                          <input
                            type="number"
                            min="0"
                            className="form-control"
                            style={{ padding: '4px 6px', fontSize: '0.85rem' }}
                            value={denominations[val] || ''}
                            onChange={(e) => setDenominations({ ...denominations, [val]: parseInt(e.target.value, 10) || 0 })}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem' }}>
                      Denomination Total: ₹{denomTotal.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={manualCount}
                      onChange={(e) => setManualCount(e.target.value)}
                      placeholder="0.00"
                      required
                      autoFocus
                    />
                  </div>
                )}

                {/* Variance Live Calculation */}
                {(() => {
                  const expected = parseFloat(activeSession.current_expected_cash) || 0
                  const actual = calculatedPhysicalCount
                  const diff = actual - expected
                  const isMatch = Math.abs(diff) < 0.01

                  return (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        background: isMatch ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                        border: `1px solid ${isMatch ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: isMatch ? '#10b981' : '#f43f5e' }}>
                        {isMatch ? '✓ Drawer Reconciled (No Variance)' : diff > 0 ? '⚠️ Drawer Overage (Excess Cash)' : '⚠️ Drawer Shortage (Missing Cash)'}
                      </span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isMatch ? '#10b981' : '#f43f5e' }}>
                        {diff >= 0 ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`}
                      </span>
                    </div>
                  )
                })()}

                <div className="form-group">
                  <label className="form-label">Closing Notes / Explanation</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="e.g. End of evening shift, cash transferred to safe"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCloseModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>
                  {submitting ? 'Closing...' : 'Close & Finalize Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Z-Report (Printable) ───────────────────────────────────────── */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header print-hide">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText className="text-accent" size={20} /> Z-Report / Daily Register Closing
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" onClick={handlePrintReport}>
                  <Printer size={14} /> Print Report
                </button>
                <button className="btn-icon" onClick={() => setShowReportModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {reportLoading || !selectedReport ? (
              <div style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
                Generating Z-Report...
              </div>
            ) : (
              <div className="z-report-document" style={{ padding: '16px 8px', color: '#0f172a', background: '#ffffff', borderRadius: '4px' }}>
                {/* Header */}
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
                    Z-REPORT — REGISTER #{selectedReport.session.id}
                  </div>
                </div>

                {/* Session Meta */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem', marginBottom: '16px', background: '#f8fafc', padding: '10px 12px', borderRadius: '4px' }}>
                  <div>
                    <strong>Opened:</strong> {new Date(selectedReport.session.opened_at).toLocaleString()}
                  </div>
                  <div>
                    <strong>Closed:</strong> {selectedReport.session.closed_at ? new Date(selectedReport.session.closed_at).toLocaleString() : 'STILL OPEN'}
                  </div>
                  <div>
                    <strong>Status:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{selectedReport.session.status}</span>
                  </div>
                  <div>
                    <strong>Transactions:</strong> {selectedReport.summary.transaction_count}
                  </div>
                </div>

                {/* Financial Summary Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', marginBottom: '20px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 0', fontWeight: 600 }}>Opening Cash Float</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>₹{selectedReport.summary.opening_float.toFixed(2)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 0', color: '#15803d' }}>+ Cash Sales Collected</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', color: '#15803d' }}>+₹{selectedReport.summary.cash_sales.toFixed(2)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 0', color: '#b91c1c' }}>- Cash Refunds Issued</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', color: '#b91c1c' }}>-₹{selectedReport.summary.cash_refunds.toFixed(2)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 0', color: '#b91c1c' }}>- Cash Purchases & Expenses</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', color: '#b91c1c' }}>-₹{selectedReport.summary.cash_expenses.toFixed(2)}</td>
                    </tr>
                    <tr style={{ borderBottom: '2px solid #0f172a', background: '#f1f5f9' }}>
                      <td style={{ padding: '8px 4px', fontWeight: 700 }}>Expected Drawer Cash</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}>
                        ₹{selectedReport.summary.expected_drawer.toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 0', fontWeight: 600 }}>Actual Counted Cash</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                        {selectedReport.summary.actual_drawer !== null ? `₹${selectedReport.summary.actual_drawer.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '2px solid #0f172a', fontWeight: 700 }}>
                      <td style={{ padding: '8px 0', color: selectedReport.summary.discrepancy === 0 ? '#15803d' : '#b91c1c' }}>
                        Variance (Over / Short)
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: selectedReport.summary.discrepancy === 0 ? '#15803d' : '#b91c1c' }}>
                        {selectedReport.summary.discrepancy >= 0 ? `+₹${selectedReport.summary.discrepancy.toFixed(2)}` : `-₹${Math.abs(selectedReport.summary.discrepancy).toFixed(2)}`}
                      </td>
                    </tr>
                    {/* UPI Sales separate row for reference */}
                    <tr style={{ color: '#475569', fontSize: '0.8rem' }}>
                      <td style={{ padding: '6px 0' }}>UPI / Digital Sales (Non-Drawer)</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{selectedReport.summary.upi_sales.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Itemized Transactions */}
                {selectedReport.payments.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                      Cash Sales Transactions ({selectedReport.payments.length})
                    </h4>
                    <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: '3px 0' }}>Time</th>
                          <th>Bill / Customer</th>
                          <th style={{ textAlign: 'right' }}>Cash Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReport.payments.map((p, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px dotted #e2e8f0' }}>
                            <td style={{ padding: '4px 0' }}>{new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>{p.bill_code || p.bill_id || 'Direct'} — {p.customer_name || 'Walk-in'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{(parseFloat(p.cash_amount) || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedReport.expenses.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                      Expenses / Payouts ({selectedReport.expenses.length})
                    </h4>
                    <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: '3px 0' }}>Item / Category</th>
                          <th>Notes</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReport.expenses.map((e, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px dotted #e2e8f0' }}>
                            <td style={{ padding: '4px 0' }}>{e.item_name} ({e.category})</td>
                            <td>{e.notes || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#b91c1c' }}>-₹{(parseFloat(e.total) || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Sign-off footer */}
                <div style={{ marginTop: '30px', paddingTop: '16px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                  <div>
                    Cashier Signature: __________________
                  </div>
                  <div>
                    Manager Verified: __________________
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CashRegister
