import React, { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { usePayments, usePaymentMutations } from '../../hooks/useEntitiesQuery'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { LedgerService } from '../../services/ledgerService'
import { ReminderService } from '../../services/reminderService'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  Wallet, Plus, CheckCircle, AlertCircle, ArrowLeftRight,
  User, RefreshCw, Phone, Loader2, DollarSign, QrCode, FileText, MessageCircle
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileCustomerLedger() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paramCustId = searchParams.get('customerId')

  const { business, settings, advancePayments, contextCustomers, contextBills, contextPayments, showToast } = useAppContext()

  // TanStack Queries & Mutations
  const { data: serverCustomers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: serverPayments = [], isLoading: isLoadingPayments } = usePayments()
  const { data: serverBills = [], isLoading: isLoadingBills } = useBills()
  const { createPayment, isCreatingPayment } = usePaymentMutations()
  const { updateBill: updateBillMutation, isUpdatingBill } = useBillMutations()

  const customers = serverCustomers.length > 0 ? serverCustomers : (contextCustomers || [])
  const bills = serverBills.length > 0 ? serverBills : (contextBills || [])
  const payments = serverPayments.length > 0 ? serverPayments : (contextPayments || [])

  const activeCustomers = useMemo(() => (customers || []).filter(c => !c.deleted), [customers])
  const [selectedCustomerId, setSelectedCustomerId] = useState(paramCustId || activeCustomers[0]?.id || '')
  const [ledgerPeriod, setLedgerPeriod] = useState('all') // 'all' | 'monthly' | 'yearly'

  // Payment Recording State
  const [showPayModal, setShowPayModal] = useState(false)
  const [payCash, setPayCash] = useState('')
  const [payUpi, setPayUpi] = useState('')
  const [payNotes, setPayNotes] = useState('')

  // Sync selectedCustomerId when activeCustomers loads or paramCustId changes
  React.useEffect(() => {
    if (paramCustId) {
      setSelectedCustomerId(paramCustId)
    } else if (!selectedCustomerId && activeCustomers.length > 0) {
      setSelectedCustomerId(activeCustomers[0].id)
    }
  }, [paramCustId, activeCustomers, selectedCustomerId])

  const selectedCustomer = useMemo(() => {
    return activeCustomers.find(c => String(c.id) === String(selectedCustomerId))
  }, [activeCustomers, selectedCustomerId])

  // Compute Mathematically Precise Ledger Timeline using LedgerService
  const { ledgerEntries, closingBalance, totalInvoiced, totalPaid } = useMemo(() => {
    if (!selectedCustomerId) return { ledgerEntries: [], closingBalance: 0, totalInvoiced: 0, totalPaid: 0 }

    const res = LedgerService.calculateLedger({
      customerId: selectedCustomerId,
      bills,
      payments,
      advancePayments: advancePayments || [],
      period: ledgerPeriod,
      settings: settings || {}
    })

    const custBills = (bills || []).filter(b => String(b.customerId || b.customer_id) === String(selectedCustomerId) && !b.deleted && !b.deleted_at)
    const custPayments = (payments || []).filter(p => String(p.customerId || p.customer_id) === String(selectedCustomerId))

    const invoiced = custBills.reduce((s, b) => s + Number(b.total !== undefined ? b.total : (b.grand_total || 0)), 0)
    const paid = custPayments.reduce((s, p) => s + Number(p.totalPaid !== undefined ? p.totalPaid : (p.amount !== undefined ? p.amount : (p.total_paid || 0))), 0)

    return {
      ledgerEntries: (res.entries || []).slice().reverse(), // Show newest first on mobile
      closingBalance: res.closingBalance || 0,
      totalInvoiced: invoiced,
      totalPaid: paid
    }
  }, [selectedCustomerId, bills, payments, advancePayments, ledgerPeriod, settings])

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault()
    const cash = Number(payCash || 0)
    const upi = Number(payUpi || 0)
    const total = cash + upi

    if (total <= 0 || !selectedCustomer) {
      showToast('Please enter cash or UPI amount', 'error')
      return
    }

    try {
      const unpaidBills = (serverBills || [])
        .filter((b) => String(b.customerId) === String(selectedCustomer.id) && !b.deleted && (Number(b.balance || 0) > 0))
        .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

      let remaining = total
      for (const b of unpaidBills) {
        if (remaining <= 0) break
        const toPay = Math.min(remaining, Number(b.balance || 0))
        const newBal = Number(Math.max(0, Number(b.balance || 0) - toPay).toFixed(2))
        const newPaid = Number((Number(b.paidTotal || b.totalPaid || 0) + toPay).toFixed(2))
        const newStatus = newBal === 0 ? 'paid' : 'partial'

        await updateBillMutation({
          id: b.id,
          data: {
            balance: newBal,
            status: newStatus,
            paidTotal: newPaid,
            totalPaid: newPaid,
          }
        })
        remaining -= toPay
      }

      await createPayment({
        customer_id: selectedCustomer.id,
        cash_amount: cash,
        upi_amount: upi,
        total_paid: total,
        payment_type: 'partial',
        notes: payNotes.trim() || 'Payment from mobile ledger'
      })

      showToast(`Recorded payment of ₹${total.toLocaleString('en-IN')} via FIFO!`, 'success')
      setPayCash('')
      setPayUpi('')
      setPayNotes('')
      setShowPayModal(false)
    } catch (err) {
      showToast(err.message || 'Failed to record payment', 'error')
    }
  }

  const handleWriteOffBill = async (billId, balanceAmt) => {
    if (window.confirm(`Write off outstanding balance of ₹${Number(balanceAmt).toFixed(2)} for Invoice #${billId}?`)) {
      try {
        await updateBillMutation({
          id: billId,
          data: { status: 'paid', balance: 0, notes: `Written off ₹${Number(balanceAmt).toFixed(2)}` }
        })
        showToast(`Invoice #${billId} written off successfully!`, 'success')
      } catch (err) {
        showToast(err.message || 'Failed to write off invoice', 'error')
      }
    }
  }

  const isLoading = isLoadingCustomers || isLoadingPayments || isLoadingBills

  return (
    <MobileLayout title="Customer Ledger">
      {/* Client Dropdown Selector */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-secondary)', marginBottom: '6px' }}>
          SELECT CLIENT / CUSTOMER
        </label>
        <select
          className="mobile-input"
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
          disabled={isLoadingCustomers}
        >
          {activeCustomers.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type}) • Bal: ₹{Number(c.creditBalance || 0).toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="spin" style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
          <div style={{ fontSize: '0.85rem' }}>Loading ledger from cloud...</div>
        </div>
      ) : selectedCustomer ? (
        <>
          {/* Customer Summary & Statement Card */}
          <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>ACCOUNT STATEMENT</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                  {selectedCustomer.name}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Phone: {selectedCustomer.phone || 'N/A'} • Code: {selectedCustomer.customerCode || selectedCustomer.code || 'N/A'}
                </div>
              </div>
              <span className={`mobile-badge ${selectedCustomer.type === 'regular' ? 'mobile-badge-info' : 'mobile-badge-warning'}`}>
                {(selectedCustomer.type || 'WALK-IN').toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>INVOICED</div>
                <div className="currency-num" style={{ fontSize: '0.95rem', color: '#ffffff' }}>₹{totalInvoiced.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>PAID</div>
                <div className="currency-num" style={{ fontSize: '0.95rem', color: 'var(--success)' }}>₹{totalPaid.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {closingBalance < 0 ? 'CREDIT' : 'DUE'}
                </div>
                <div className="currency-num" style={{ fontSize: '0.95rem', color: closingBalance > 0 ? 'var(--error)' : 'var(--success)' }}>
                  ₹{Math.abs(closingBalance).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <button
              className="mobile-btn mobile-btn-primary"
              onClick={() => setShowPayModal(true)}
              style={{ width: '100%', minHeight: '40px', fontSize: '0.85rem', marginBottom: '8px' }}
            >
              <Plus size={16} /> Record Payment (FIFO)
            </button>

            {selectedCustomer?.phone && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className="mobile-btn"
                  onClick={() => {
                    const text = ReminderService.buildCustomerStatementMessage(
                      selectedCustomer,
                      {
                        totalDebits: totalInvoiced,
                        totalCredits: totalPaid,
                        finalBalance: closingBalance,
                        period: ledgerPeriod
                      },
                      business,
                      settings
                    )
                    const url = ReminderService.getWhatsAppUrl(selectedCustomer.phone, text)
                    window.open(url, '_blank')
                  }}
                  style={{
                    width: '100%',
                    minHeight: '38px',
                    fontSize: '0.78rem',
                    background: 'rgba(37, 211, 102, 0.12)',
                    color: '#25D366',
                    border: '1px solid rgba(37, 211, 102, 0.35)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <MessageCircle size={15} /> Statement
                </button>
                <button
                  type="button"
                  className="mobile-btn"
                  onClick={() => {
                    const text = ReminderService.buildLedgerReminderMessage(selectedCustomer, closingBalance, business, settings)
                    const url = ReminderService.getWhatsAppUrl(selectedCustomer.phone, text)
                    window.open(url, '_blank')
                  }}
                  style={{
                    width: '100%',
                    minHeight: '38px',
                    fontSize: '0.78rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <DollarSign size={15} /> Reminder
                </button>
              </div>
            )}
          </div>

          {/* Timeline Period Filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'monthly', label: 'This Month' },
              { id: 'yearly', label: 'This Year' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setLedgerPeriod(t.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: ledgerPeriod === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                  background: ledgerPeriod === t.id ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
                  color: ledgerPeriod === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Ledger Transactions Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.04em' }}>
              TRANSACTION TIMELINE ({ledgerEntries.length})
            </h4>

            {ledgerEntries.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)' }}>
                No recorded ledger transactions for this period.
              </div>
            ) : (
              ledgerEntries.map(entry => {
                const isDebit = entry.debit > 0
                const targetBillId = entry.billId || (entry.type === 'bill' || entry.type === 'invoice' ? entry.id : null)
                return (
                  <div key={entry.id || `${entry.type}-${entry.date}`} className="mobile-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, paddingRight: '8px' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {entry.description}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {entry.date} • {entry.subtext}
                        </div>
                        {targetBillId && isDebit && (
                          <button
                            type="button"
                            onClick={() => handleWriteOffBill(targetBillId, entry.debit)}
                            style={{
                              marginTop: '6px',
                              padding: '2px 8px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: 'rgba(255, 56, 96, 0.1)',
                              border: '1px solid rgba(255, 56, 96, 0.3)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--error)',
                              cursor: 'pointer'
                            }}
                          >
                            Write Off Balance
                          </button>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="currency-num" style={{ fontSize: '1rem', fontWeight: 800, color: isDebit ? 'var(--text-primary)' : 'var(--success)' }}>
                          {isDebit ? `-₹${entry.debit.toFixed(2)}` : `+₹${entry.credit.toFixed(2)}`}
                        </div>
                        <span className={`mobile-badge ${isDebit ? 'mobile-badge-info' : 'mobile-badge-success'}`} style={{ fontSize: '0.65rem', marginTop: '2px' }}>
                          {entry.type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      ) : (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)' }}>
          No active customers found. Please add a customer first.
        </div>
      )}

      {/* Record Payment Bottom Sheet */}
      <BottomSheet isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Record Customer Payment">
        <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>CLIENT</label>
            <input type="text" className="mobile-input" value={selectedCustomer?.name || ''} readOnly style={{ opacity: 0.8 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>CASH AMOUNT (₹)</label>
              <input
                type="number"
                step="0.1"
                className="mobile-input currency-num"
                placeholder="0.00"
                value={payCash}
                onChange={(e) => setPayCash(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>UPI AMOUNT (₹)</label>
              <input
                type="number"
                step="0.1"
                className="mobile-input currency-num"
                placeholder="0.00"
                value={payUpi}
                onChange={(e) => setPayUpi(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>NOTES / REFERENCE</label>
            <input
              type="text"
              className="mobile-input"
              placeholder="e.g. Ledger settlement / Partial payment"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="mobile-btn mobile-btn-primary"
            disabled={isCreatingPayment}
            style={{ marginTop: '8px' }}
          >
            {isCreatingPayment ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <Loader2 size={16} className="spin" /> Saving Payment...
              </span>
            ) : (
              `Confirm Payment of ₹${(Number(payCash || 0) + Number(payUpi || 0)).toLocaleString('en-IN')}`
            )}
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
