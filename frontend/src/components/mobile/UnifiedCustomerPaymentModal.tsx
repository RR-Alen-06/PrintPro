import React, { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomerMutations } from '../../hooks/useCustomersQuery'
import { usePaymentMutations, useAdvancePaymentMutations } from '../../hooks/useEntitiesQuery'
import BottomSheet from './BottomSheet'
import {
  Wallet, DollarSign, QrCode, ArrowRight, CheckCircle2,
  AlertCircle, Copy, ExternalLink, Zap, ShieldCheck
} from 'lucide-react'

interface UnifiedCustomerPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  customer: any
  customerBills?: any[]
  targetBill?: any
  initialAmount?: number
  defaultMode?: 'settle' | 'advance'
  onSuccess?: () => void
}

export default function UnifiedCustomerPaymentModal({
  isOpen,
  onClose,
  customer,
  customerBills = [],
  targetBill,
  initialAmount,
  defaultMode,
  onSuccess,
}: UnifiedCustomerPaymentModalProps) {
  const queryClient = useQueryClient()
  const { business, settings, showToast } = useAppContext()
  const { updateBill } = useBillMutations()
  const { updateCustomer } = useCustomerMutations()
  const { createPayment } = usePaymentMutations()
  const { addAdvancePayment } = useAdvancePaymentMutations()

  // Calculate Customer Metrics
  const customerAdvance = useMemo(() => {
    if (!customer) return 0
    return Number(
      customer.advanceBalance ??
      customer.advance_balance ??
      customer.creditBalance ??
      customer.credit_balance ??
      0
    )
  }, [customer])

  const pendingBills = useMemo(() => {
    if (!customer) return []
    if (targetBill) {
      return Number(targetBill.balance || 0) > 0 ? [targetBill] : []
    }
    return customerBills
      .filter((b) => !b.deleted && !b.deleted_at && Number(b.balance || 0) > 0)
      .sort((a, b) => new Date(a.date || a.created_at || 0).getTime() - new Date(b.date || b.created_at || 0).getTime())
  }, [customer, customerBills, targetBill])

  const totalOutstanding = useMemo(() => {
    if (targetBill) return Number(targetBill.balance || 0)
    return pendingBills.reduce((sum, b) => sum + Number(b.balance || 0), 0)
  }, [targetBill, pendingBills])

  // Active Mode: 'settle' | 'advance'
  const [mode, setMode] = useState<'settle' | 'advance'>('settle')

  useEffect(() => {
    if (defaultMode) {
      setMode(defaultMode)
    } else if (targetBill || totalOutstanding > 0) {
      setMode('settle')
    } else {
      setMode('advance')
    }
  }, [defaultMode, targetBill, totalOutstanding, isOpen])

  // Payment Channel: 'cash' | 'upi' | 'card' | 'bank' | 'split' | 'advance'
  const [payChannel, setPayChannel] = useState<'cash' | 'upi' | 'card' | 'bank' | 'split' | 'advance'>('cash')

  const currency = (settings?.currency || business?.currency || '₹') as string
  const isUpiEnabled = settings?.enableUpi !== false && settings?.showUpiQrCode !== false && business?.enableUpi !== false

  // Form inputs
  const [cashAmount, setCashAmount] = useState('')
  const [upiAmount, setUpiAmount] = useState('')
  const [advanceUsedAmount, setAdvanceUsedAmount] = useState('')
  const [singleAmount, setSingleAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [showQrPreview, setShowQrPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize amount on open
  useEffect(() => {
    if (isOpen) {
      setShowQrPreview(false)
      setNotes('')
      if (initialAmount !== undefined && initialAmount > 0) {
        setSingleAmount(String(initialAmount))
      } else if (totalOutstanding > 0) {
        setSingleAmount(String(totalOutstanding))
      } else {
        setSingleAmount('')
      }
      setCashAmount('')
      setUpiAmount('')
      setAdvanceUsedAmount('')
      setPayChannel('cash')
    }
  }, [isOpen, initialAmount, totalOutstanding])

  // Synchronize payment amounts based on channel
  const computedCash = useMemo(() => {
    if (payChannel === 'split') return Number(cashAmount || 0)
    if (payChannel === 'cash') return Number(singleAmount || 0)
    return 0
  }, [payChannel, cashAmount, singleAmount])

  const computedUpi = useMemo(() => {
    if (payChannel === 'split') return Number(upiAmount || 0)
    if (payChannel === 'upi') return Number(singleAmount || 0)
    return 0
  }, [payChannel, upiAmount, singleAmount])

  const computedCard = useMemo(() => {
    if (payChannel === 'card') return Number(singleAmount || 0)
    return 0
  }, [payChannel, singleAmount])

  const computedBank = useMemo(() => {
    if (payChannel === 'bank') return Number(singleAmount || 0)
    return 0
  }, [payChannel, singleAmount])

  const computedAdvanceUsed = useMemo(() => {
    if (mode === 'advance') return 0
    if (payChannel === 'advance') return Number(singleAmount || 0)
    return Number(advanceUsedAmount || 0)
  }, [mode, payChannel, singleAmount, advanceUsedAmount])

  const totalInflow = computedCash + computedUpi + computedCard + computedBank
  const totalApplied = totalInflow + computedAdvanceUsed

  // Real-time breakdown calculations
  const breakdown = useMemo(() => {
    if (mode === 'advance') {
      return {
        clearedDues: 0,
        advanceUsed: 0,
        advanceAdded: totalInflow,
        surplus: 0,
        remainingDues: totalOutstanding,
      }
    }

    const clearedDues = Math.min(totalApplied, totalOutstanding)
    const surplus = Math.max(0, Number((totalInflow - clearedDues).toFixed(2)))
    const remainingDues = Math.max(0, Number((totalOutstanding - clearedDues).toFixed(2)))

    return {
      clearedDues,
      advanceUsed: computedAdvanceUsed,
      advanceAdded: surplus,
      surplus,
      remainingDues,
    }
  }, [mode, totalApplied, totalOutstanding, totalInflow, computedAdvanceUsed])

  // UPI configuration
  const upiId = business?.upiId || settings?.upiId || 'merchant@upi'
  const upiPayeeName = business?.name || settings?.storeName || 'PrintShop'
  const upiPayable = payChannel === 'split' ? computedUpi : (payChannel === 'upi' ? Number(singleAmount || 0) : 0)
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiPayeeName)}&am=${upiPayable.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Payment by ${customer?.name || 'Customer'}`)}`

  // 1-Click Quick Advance Auto-fill
  const handleApplyFullAdvance = () => {
    const toApply = Math.min(customerAdvance, totalOutstanding)
    setPayChannel('advance')
    setSingleAmount(String(toApply))
  }

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer) return

    if (mode === 'advance') {
      if (totalInflow <= 0) {
        showToast('Please enter an advance deposit amount', 'error')
        return
      }

      setIsSubmitting(true)
      const primaryMode = payChannel === 'bank' ? 'bank_transfer' : payChannel
      try {
        await addAdvancePayment({
          customerId: customer.id,
          customerName: customer.name,
          amount: totalInflow,
          cashAmount: computedCash,
          upiAmount: computedUpi,
          paymentMethod: primaryMode,
          date: new Date().toISOString().slice(0, 10),
          notes: notes || `Direct Customer Advance Deposit (${primaryMode.toUpperCase()} - ${currency}${totalInflow.toFixed(2)})`,
        })

        const newBal = Number((customerAdvance + totalInflow).toFixed(2))
        await updateCustomer({
          id: customer.id,
          data: {
            advanceBalance: newBal,
            advance_balance: newBal,
            creditBalance: newBal,
            credit_balance: newBal,
          },
        })

        queryClient.invalidateQueries({ queryKey: ['customers'] })
        queryClient.invalidateQueries({ queryKey: ['bills'] })
        queryClient.invalidateQueries({ queryKey: ['payments'] })
        queryClient.invalidateQueries({ queryKey: ['advance_payments'] })

        showToast(`Added ${currency}${totalInflow.toFixed(2)} to ${customer.name}'s advance wallet!`, 'success')
        if (onSuccess) onSuccess()
        onClose()
      } catch (err: any) {
        showToast(err?.message || 'Failed to deposit advance', 'error')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // MODE: SETTLE DUES
    if (totalApplied <= 0) {
      showToast('Please enter a payment or advance deduction amount', 'error')
      return
    }

    if (computedAdvanceUsed > customerAdvance + 0.001) {
      showToast(`Cannot use more advance than available (₹${customerAdvance.toFixed(2)})`, 'error')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Waterfall settlement across target bill or pending bills
      let remainingToApply = totalApplied
      const billsToSettle = targetBill ? [targetBill] : pendingBills

      for (const b of billsToSettle) {
        if (remainingToApply <= 0) break
        const billBalance = Number(b.balance || 0)
        if (billBalance <= 0) continue

        const toPay = Math.min(remainingToApply, billBalance)
        const newBal = Number(Math.max(0, billBalance - toPay).toFixed(2))
        const currentPaid = Number(b.amountPaid ?? b.amount_paid ?? b.paid_total ?? 0)
        const newPaid = Number((currentPaid + toPay).toFixed(2))
        const newStatus = newBal <= 0.001 ? 'paid' : 'partial'

        await updateBill({
          id: b.id,
          data: {
            balance: newBal,
            status: newStatus,
            amountPaid: newPaid,
            amount_paid: newPaid,
          },
        })

        remainingToApply = Number((remainingToApply - toPay).toFixed(2))
      }

      // 2. Adjust Customer Advance: Decrease if advance used; Increase if cash/upi surplus paid
      let netAdvanceChange = 0
      if (computedAdvanceUsed > 0) {
        netAdvanceChange -= computedAdvanceUsed
      }
      if (breakdown.surplus > 0) {
        netAdvanceChange += breakdown.surplus
      }

      if (Math.abs(netAdvanceChange) > 0.001) {
        const newCustomerAdv = Math.max(0, Number((customerAdvance + netAdvanceChange).toFixed(2)))
        await updateCustomer({
          id: customer.id,
          data: {
            advanceBalance: newCustomerAdv,
            advance_balance: newCustomerAdv,
            creditBalance: newCustomerAdv,
            credit_balance: newCustomerAdv,
          },
        })
      }

      const primaryMode = payChannel === 'bank' ? 'bank_transfer' : payChannel
      // 3. Record Payment transaction
      await createPayment({
        customer_id: customer.id,
        bill_id: targetBill ? targetBill.id : undefined,
        date: new Date().toISOString().slice(0, 10),
        cash_amount: computedCash,
        upi_amount: computedUpi,
        card_amount: computedCard,
        bank_transfer_amount: computedBank,
        payment_mode: primaryMode,
        total_paid: totalApplied,
        payment_type: breakdown.remainingDues === 0 ? 'full' : 'partial',
        notes: notes || (targetBill
          ? `Bill #${targetBill.billNumber || targetBill.invoiceNumber || targetBill.id} Payment (${primaryMode.toUpperCase()} - ${currency}${totalApplied.toFixed(2)})`
          : `Customer Dues Settlement (${primaryMode.toUpperCase()} - ${currency}${totalApplied.toFixed(2)})`
        ),
      })

      // 4. Invalidate TanStack queries for global reactivity
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['advance_payments'] })

      showToast(`Settled ${currency}${breakdown.clearedDues.toFixed(2)} successfully!${breakdown.surplus > 0 ? ` (${currency}${breakdown.surplus.toFixed(2)} deposited to Advance)` : ''}`, 'success')
      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      showToast(err?.message || 'Failed to record settlement', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!customer) return null

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'settle' ? 'Collect Payment & Settle Dues' : 'Deposit Customer Advance'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Mode Selector Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-input, #12101e)', padding: '4px', borderRadius: 'var(--radius-md, 10px)' }}>
          <button
            type="button"
            className={`mobile-btn ${mode === 'settle' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
            style={{ minHeight: '36px', fontSize: '0.82rem', padding: '6px 10px' }}
            onClick={() => setMode('settle')}
          >
            Settle Dues
          </button>
          <button
            type="button"
            className={`mobile-btn ${mode === 'advance' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
            style={{ minHeight: '36px', fontSize: '0.82rem', padding: '6px 10px' }}
            onClick={() => setMode('advance')}
          >
            Add Advance Deposit
          </button>
        </div>

        {/* Customer Balance Header Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '10px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--error, #ef4444)', textTransform: 'uppercase' }}>
              {targetBill ? 'Bill Balance Due' : 'Total Outstanding'}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }} className="currency-num">
              ₹{totalOutstanding.toFixed(2)}
            </div>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '10px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
              Advance Wallet
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }} className="currency-num">
              ₹{customerAdvance.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 1-Click Quick Advance Knockoff Banner */}
        {mode === 'settle' && customerAdvance > 0 && totalOutstanding > 0 && payChannel !== 'advance' && (
          <div
            onClick={handleApplyFullAdvance}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
              border: '1px dashed var(--aurora-amber, #f59e0b)',
              padding: '10px 12px',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="var(--aurora-amber, #f59e0b)" />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                Apply Advance Balance (₹{Math.min(customerAdvance, totalOutstanding).toFixed(2)})
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--aurora-amber, #f59e0b)' }}>Use 1-Click</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Payment Method Channels */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {mode === 'settle' ? 'PAYMENT CHANNEL' : 'DEPOSIT METHOD'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(65px, 1fr))', gap: '6px' }}>
              <button
                type="button"
                className={`mobile-btn ${payChannel === 'cash' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                style={{ minHeight: '36px', fontSize: '0.75rem', padding: '4px' }}
                onClick={() => setPayChannel('cash')}
              >
                Cash
              </button>
              {isUpiEnabled && (
                <button
                  type="button"
                  className={`mobile-btn ${payChannel === 'upi' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                  style={{ minHeight: '36px', fontSize: '0.75rem', padding: '4px' }}
                  onClick={() => setPayChannel('upi')}
                >
                  UPI
                </button>
              )}
              <button
                type="button"
                className={`mobile-btn ${payChannel === 'card' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                style={{ minHeight: '36px', fontSize: '0.75rem', padding: '4px' }}
                onClick={() => setPayChannel('card')}
              >
                Card
              </button>
              <button
                type="button"
                className={`mobile-btn ${payChannel === 'bank' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                style={{ minHeight: '36px', fontSize: '0.75rem', padding: '4px' }}
                onClick={() => setPayChannel('bank')}
              >
                Bank
              </button>
              <button
                type="button"
                className={`mobile-btn ${payChannel === 'split' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                style={{ minHeight: '36px', fontSize: '0.75rem', padding: '4px' }}
                onClick={() => setPayChannel('split')}
              >
                Split
              </button>
              {mode === 'settle' && (
                <button
                  type="button"
                  disabled={customerAdvance <= 0}
                  className={`mobile-btn ${payChannel === 'advance' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                  style={{ minHeight: '36px', fontSize: '0.75rem', padding: '4px', opacity: customerAdvance <= 0 ? 0.4 : 1 }}
                  onClick={() => setPayChannel('advance')}
                >
                  Advance
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Inputs Based on Selected Channel */}
          {payChannel === 'split' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  CASH AMOUNT (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mobile-input currency-num"
                  placeholder="0.00"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  UPI AMOUNT (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mobile-input currency-num"
                  placeholder="0.00"
                  value={upiAmount}
                  onChange={(e) => setUpiAmount(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                {payChannel === 'advance' ? 'DEDUCT FROM ADVANCE (₹)' : (mode === 'settle' ? 'TOTAL PAYMENT AMOUNT (₹)' : 'DEPOSIT AMOUNT (₹)')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={payChannel === 'advance' ? customerAdvance : undefined}
                className="mobile-input currency-num"
                placeholder="0.00"
                value={singleAmount}
                onChange={(e) => setSingleAmount(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {/* Interactive UPI QR preview toggle when UPI is involved */}
          {(payChannel === 'upi' || (payChannel === 'split' && computedUpi > 0)) && (
            <div style={{ background: 'var(--bg-input, #12101e)', borderRadius: '10px', padding: '10px', border: '1px solid var(--border-color, #2a273f)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--accent-secondary)' }}>
                  <QrCode size={16} />
                  <span>Instant UPI QR for ₹{upiPayable.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  className="mobile-btn mobile-btn-secondary"
                  style={{ minHeight: '28px', fontSize: '0.72rem', padding: '2px 8px' }}
                  onClick={() => setShowQrPreview(!showQrPreview)}
                >
                  {showQrPreview ? 'Hide QR' : 'Show QR'}
                </button>
              </div>

              {showQrPreview && (
                <div style={{ textAlign: 'center', marginTop: '12px', padding: '10px 0' }}>
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '12px', display: 'inline-block', marginBottom: '8px' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiUri)}`}
                      alt="UPI Payment QR Code"
                      style={{ width: '150px', height: '150px', display: 'block' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    UPI ID: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{upiId}</span>
                  </div>
                  <button
                    type="button"
                    className="mobile-btn mobile-btn-secondary"
                    style={{ minHeight: '32px', fontSize: '0.76rem', margin: '8px auto 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      window.open(upiUri, '_self')
                    }}
                  >
                    <ExternalLink size={14} /> Open UPI App
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Real-time Allocation Summary Badge */}
          {totalApplied > 0 && (
            <div style={{ background: 'var(--bg-secondary, #1a1728)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border-color, #2a273f)', fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Settlement Allocation
              </div>
              {mode === 'settle' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Dues Cleared:</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }} className="currency-num">₹{breakdown.clearedDues.toFixed(2)}</span>
                  </div>
                  {breakdown.surplus > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--aurora-amber, #f59e0b)' }}>
                      <span>Surplus to Advance Wallet:</span>
                      <span style={{ fontWeight: 700 }} className="currency-num">+₹{breakdown.surplus.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px solid var(--border-color, #2a273f)' }}>
                    <span>Remaining Balance Due:</span>
                    <span style={{ fontWeight: 700, color: breakdown.remainingDues > 0 ? 'var(--error)' : '#10b981' }} className="currency-num">
                      ₹{breakdown.remainingDues.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                  <span>Advance Wallet Increase:</span>
                  <span style={{ fontWeight: 700 }} className="currency-num">+₹{totalInflow.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Notes Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              NOTES (OPTIONAL)
            </label>
            <input
              type="text"
              className="mobile-input"
              placeholder="e.g. Received by counter staff"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="mobile-btn mobile-btn-primary"
            style={{ minHeight: '44px', fontWeight: 800 }}
            disabled={isSubmitting || totalApplied <= 0}
          >
            {isSubmitting
              ? 'Recording Transaction...'
              : (mode === 'settle'
                ? `Confirm & Record Settlement (₹${totalApplied.toFixed(2)})`
                : `Confirm Advance Deposit (₹${totalInflow.toFixed(2)})`
              )}
          </button>
        </form>
      </div>
    </BottomSheet>
  )
}
