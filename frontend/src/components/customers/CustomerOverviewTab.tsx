import React, { useState } from 'react'
import { Wallet, AlertCircle, CheckCircle, Smartphone, ArrowRight, MessageSquare, Pencil, CreditCard, Sparkles } from 'lucide-react'
import { ReminderService } from '../../services/reminderService'

interface CustomerOverviewTabProps {
  customer: any
  outstandingDue: number
  advanceBalance: number
  bills: any[]
  payments: any[]
  business: any
  settings: any
  onSettleBills: (amounts: { cash: number; upi: number; advance: number }) => Promise<void>
  onSwitchTab: (tab: 'bills' | 'ledger' | 'advances') => void
  onEditCustomer: () => void
  showToast: (msg: string, type?: string) => void
}

export const CustomerOverviewTab: React.FC<CustomerOverviewTabProps> = ({
  customer,
  outstandingDue,
  advanceBalance,
  bills,
  payments,
  business,
  settings,
  onSettleBills,
  onSwitchTab,
  onEditCustomer,
  showToast,
}) => {
  const [payCash, setPayCash] = useState<string>('')
  const [payUpi, setPayUpi] = useState<string>('')
  const [payAdvance, setPayAdvance] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paySuccess, setPaySuccess] = useState(false)
  const [upiCheckoutAmount, setUpiCheckoutAmount] = useState(0)

  const numCash = Number(payCash || 0)
  const numUpi = Number(payUpi || 0)
  const numAdvance = Number(payAdvance || 0)
  const totalPaying = numCash + numUpi + numAdvance

  const maxAdvanceUsable = Math.min(advanceBalance, Math.max(0, outstandingDue - (numCash + numUpi)))
  const remainingDueAfterPay = Math.max(0, Number((outstandingDue - totalPaying).toFixed(2)))

  const getUpiLink = (amount: number, notesText = 'Outstanding Settlement') => {
    if (!business?.upiId || amount <= 0) return ''
    const params = new URLSearchParams({
      pa: business.upiId,
      pn: business.shopName || 'PrintPro',
      am: amount.toFixed(2),
      cu: 'INR',
      tn: notesText,
    })
    return `upi://pay?${params.toString()}`
  }

  // 1-Click quick advance settlement
  const handleQuickAdvanceKnockoff = async () => {
    const toKnockoff = Math.min(advanceBalance, outstandingDue)
    if (toKnockoff <= 0) return
    setIsSubmitting(true)
    try {
      await onSettleBills({ cash: 0, upi: 0, advance: toKnockoff })
      setPaySuccess(true)
      setTimeout(() => setPaySuccess(false), 3500)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApplyPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (totalPaying <= 0) {
      showToast('Please enter an amount to settle.', 'warning')
      return
    }
    if (numAdvance > advanceBalance) {
      showToast(`Cannot use ₹${numAdvance.toFixed(2)} from advance. Available balance is ₹${advanceBalance.toFixed(2)}.`, 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await onSettleBills({ cash: numCash, upi: numUpi, advance: numAdvance })
      setPayCash('')
      setPayUpi('')
      setPayAdvance('')
      setUpiCheckoutAmount(0)
      setPaySuccess(true)
      setTimeout(() => setPaySuccess(false), 3500)
    } finally {
      setIsSubmitting(false)
    }
  }

  const creditLimit = Number(customer?.creditLimit || 0)
  const isOverCreditLimit = creditLimit > 0 && outstandingDue > creditLimit

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Quick Financial KPI Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Net Outstanding */}
        <div
          className="stat-card"
          style={{
            borderLeft: outstandingDue > 0 ? '4px solid var(--aurora-pink, #ff2fb0)' : '4px solid var(--aurora-cyan, #00f0ff)',
            background: 'linear-gradient(135deg, rgba(255, 47, 176, 0.06) 0%, rgba(15, 23, 42, 0.6) 100%)',
          }}
        >
          <div className="stat-card-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Net Outstanding Due
          </div>
          <div
            className="currency-num"
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: outstandingDue > 0 ? 'var(--aurora-pink, #ff2fb0)' : 'var(--aurora-cyan, #00f0ff)',
              margin: '6px 0 2px',
            }}
          >
            ₹{outstandingDue.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {outstandingDue > 0 ? 'Pending unpaid bills' : 'All invoices settled'}
          </div>
        </div>

        {/* Advance Balance Wallet */}
        <div
          className="stat-card"
          style={{
            borderLeft: advanceBalance > 0 ? '4px solid #10b981' : '4px solid rgba(255,255,255,0.1)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Advance Wallet
            </div>
            <Wallet size={16} color={advanceBalance > 0 ? '#10b981' : 'var(--text-muted)'} />
          </div>
          <div
            className="currency-num"
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: advanceBalance > 0 ? '#10b981' : 'var(--text-secondary)',
              margin: '6px 0 2px',
            }}
          >
            ₹{advanceBalance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {advanceBalance > 0 ? 'Available for bill adjustment' : 'No advance deposited'}
          </div>
        </div>

        {/* Credit Limit */}
        <div
          className="stat-card"
          style={{
            borderLeft: isOverCreditLimit ? '4px solid #ef4444' : '4px solid rgba(255,255,255,0.1)',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div className="stat-card-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Credit Limit
          </div>
          <div
            className="currency-num"
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: isOverCreditLimit ? '#ef4444' : 'var(--text-primary)',
              margin: '6px 0 2px',
            }}
          >
            {creditLimit > 0 ? `₹${creditLimit.toFixed(2)}` : 'Unlimited'}
          </div>
          <div style={{ fontSize: '0.75rem', color: isOverCreditLimit ? '#ef4444' : 'var(--text-muted)' }}>
            {creditLimit > 0
              ? isOverCreditLimit
                ? `Exceeded by ₹${(outstandingDue - creditLimit).toFixed(2)}`
                : `₹${Math.max(0, creditLimit - outstandingDue).toFixed(2)} remaining`
              : 'No credit limit set'}
          </div>
        </div>

        {/* Loyalty Points */}
        <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Loyalty Points
            </div>
            <Sparkles size={16} color="var(--aurora-amber, #f59e0b)" />
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--aurora-amber, #f59e0b)',
              margin: '6px 0 2px',
            }}
          >
            {customer?.loyaltyPoints || 0} pts
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Earned on paid invoices</div>
        </div>
      </div>

      {/* 2. ADVANCE-TO-DUE 1-CLICK KNOCKOFF HIGHLIGHT BANNER */}
      {advanceBalance > 0 && outstandingDue > 0 && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(0, 240, 255, 0.1) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.15)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                flexShrink: 0,
              }}
            >
              <Wallet size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                Advance Wallet Balance Available: <span style={{ color: '#10b981' }}>₹{advanceBalance.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Customer has ₹{outstandingDue.toFixed(2)} in pending bills. You can apply available advance directly to clear dues!
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleQuickAdvanceKnockoff}
            disabled={isSubmitting}
            style={{
              backgroundColor: '#10b981',
              borderColor: '#10b981',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)',
              fontWeight: 700,
            }}
          >
            {isSubmitting ? 'Applying...' : `Apply ₹${Math.min(advanceBalance, outstandingDue).toFixed(2)} from Advance (FIFO)`}
          </button>
        </div>
      )}

      {/* 3. MULTI-METHOD BALANCE SETTLEMENT CARD */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Settle Outstanding Balance</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Knocks off customer&apos;s oldest unpaid bills via automatic FIFO allocation.
            </p>
          </div>
          {outstandingDue > 0 && customer?.phone && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const text = ReminderService.buildLedgerReminderMessage(customer, outstandingDue, business, settings)
                const url = ReminderService.getWhatsAppUrl(customer.phone, text)
                window.open(url, '_blank')
              }}
              style={{ color: '#25D366', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <MessageSquare size={14} /> Send WhatsApp Reminder
            </button>
          )}
        </div>

        {paySuccess && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.88rem',
            }}
          >
            <CheckCircle size={16} /> Payment successfully applied and bills reconciled!
          </div>
        )}

        {outstandingDue <= 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '28px 16px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '10px',
              border: '1px dashed var(--border)',
            }}
          >
            <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Account fully settled!</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              No outstanding dues for this customer.
            </div>
          </div>
        ) : (
          <form onSubmit={handleApplyPayment}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              {/* Cash Input */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Cash Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="0.00"
                  value={payCash}
                  onChange={(e) => setPayCash(e.target.value)}
                />
              </div>

              {/* UPI Input */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    UPI Amount (₹)
                  </label>
                  {business?.upiId && numUpi > 0 && (
                    <button
                      type="button"
                      onClick={() => setUpiCheckoutAmount(numUpi)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--aurora-cyan, #00f0ff)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Show QR
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="0.00"
                  value={payUpi}
                  onChange={(e) => setPayUpi(e.target.value)}
                />
              </div>

              {/* Advance Wallet Input */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: advanceBalance > 0 ? '#10b981' : 'inherit' }}>
                    From Advance (₹)
                  </label>
                  {advanceBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayAdvance(String(maxAdvanceUsable))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#10b981',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Max (₹{maxAdvanceUsable.toFixed(2)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={advanceBalance}
                  className="form-input"
                  placeholder={advanceBalance > 0 ? `Max ₹${advanceBalance.toFixed(2)}` : 'No advance'}
                  disabled={advanceBalance <= 0}
                  value={payAdvance}
                  onChange={(e) => setPayAdvance(e.target.value)}
                  style={advanceBalance > 0 ? { borderColor: 'rgba(16, 185, 129, 0.4)' } : undefined}
                />
              </div>
            </div>

            {/* Quick Settle Full Amount Buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Quick Fill:</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setPayCash(outstandingDue.toFixed(2))
                  setPayUpi('')
                  setPayAdvance('')
                }}
              >
                All Cash (₹{outstandingDue.toFixed(2)})
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setPayUpi(outstandingDue.toFixed(2))
                  setPayCash('')
                  setPayAdvance('')
                  if (business?.upiId) setUpiCheckoutAmount(outstandingDue)
                }}
              >
                All UPI (₹{outstandingDue.toFixed(2)})
              </button>
              {advanceBalance > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                  onClick={() => {
                    const advAmt = Math.min(advanceBalance, outstandingDue)
                    setPayAdvance(advAmt.toFixed(2))
                    const rem = outstandingDue - advAmt
                    setPayCash(rem > 0 ? rem.toFixed(2) : '')
                    setPayUpi('')
                  }}
                >
                  Use Advance + Remainder Cash
                </button>
              )}
            </div>

            {/* Total Summary Row & Settle Button */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '14px',
                borderTop: '1px solid var(--border)',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem' }}>
                  Total Paying:{' '}
                  <strong className="currency-num" style={{ color: totalPaying > 0 ? 'var(--aurora-cyan, #00f0ff)' : 'inherit' }}>
                    ₹{totalPaying.toFixed(2)}
                  </strong>
                  {totalPaying > 0 && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '0.8rem' }}>
                      (Remaining: ₹{remainingDueAfterPay.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || totalPaying <= 0}
                style={{ fontWeight: 700 }}
              >
                {isSubmitting ? 'Recording Settlement...' : `Confirm Settlement (₹${totalPaying.toFixed(2)})`}
              </button>
            </div>
          </form>
        )}

        {/* UPI QR Code Preview if selected */}
        {upiCheckoutAmount > 0 && business?.upiId && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              background: 'rgba(0, 240, 255, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Smartphone size={24} color="var(--aurora-cyan, #00f0ff)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Instant UPI Payment Request</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Collect ₹{upiCheckoutAmount.toFixed(2)} to {business.upiId}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const link = getUpiLink(upiCheckoutAmount)
                  navigator.clipboard.writeText(link)
                  showToast('UPI link copied to clipboard!', 'success')
                }}
              >
                Copy UPI Link
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setUpiCheckoutAmount(0)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Quick Nav Links to Other Sub-Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          className="card"
          onClick={() => onSwitchTab('bills')}
          style={{
            cursor: 'pointer',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Invoices & Bills</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {bills.length} total bills • Edit, refund, pay
            </div>
          </div>
          <ArrowRight size={16} color="var(--aurora-cyan, #00f0ff)" />
        </div>

        <div
          className="card"
          onClick={() => onSwitchTab('ledger')}
          style={{
            cursor: 'pointer',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Ledger Statement</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Running balance, PDF export & WhatsApp share
            </div>
          </div>
          <ArrowRight size={16} color="var(--aurora-cyan, #00f0ff)" />
        </div>

        <div
          className="card"
          onClick={() => onSwitchTab('advances')}
          style={{
            cursor: 'pointer',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Advance Wallet</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Deposit new advance, return balance, history
            </div>
          </div>
          <ArrowRight size={16} color="var(--aurora-cyan, #00f0ff)" />
        </div>
      </div>
    </div>
  )
}
