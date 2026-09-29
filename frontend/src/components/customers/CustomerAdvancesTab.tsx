import React, { useState, useMemo } from 'react'
import {
  Wallet, Plus, MinusCircle, CheckCircle, AlertCircle, ArrowDownLeft,
  ArrowUpRight, Smartphone, Copy, Link2, Trash2
} from 'lucide-react'
import EmptyState from '../common/EmptyState'

interface CustomerAdvancesTabProps {
  customer: any
  advanceBalance: number
  outstandingDue: number
  advancePayments: any[]
  business: any
  onAddAdvancePayment: (data: any, autoApplyToBills: boolean) => Promise<any>
  onReturnAdvancePayment: (data: any) => Promise<any>
  onDeleteAdvancePayment?: (id: string) => Promise<any>
  showToast: (msg: string, type?: string) => void
  showConfirm: (msg: string, onConfirm: () => void) => void
}

export const CustomerAdvancesTab: React.FC<CustomerAdvancesTabProps> = ({
  customer,
  advanceBalance,
  outstandingDue,
  advancePayments = [],
  business,
  onAddAdvancePayment,
  onReturnAdvancePayment,
  onDeleteAdvancePayment,
  showToast,
  showConfirm,
}) => {
  const today = new Date().toISOString().slice(0, 10)
  const [actionTab, setActionTab] = useState<'deposit' | 'return'>('deposit')

  // Form states
  const [amount, setAmount] = useState('')
  const [cashAmt, setCashAmt] = useState('')
  const [upiAmt, setUpiAmt] = useState('')
  const [payDate, setPayDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [autoApplyToDues, setAutoApplyToDues] = useState(outstandingDue > 0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [upiCheckoutAmount, setUpiCheckoutAmount] = useState(0)

  // Filter history for this customer
  const customerAdvances = useMemo(() => {
    if (!customer?.id) return []
    const custIdStr = String(customer.id)
    return advancePayments
      .filter((ap) => String(ap.customerId || ap.customer_id) === custIdStr)
      .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
  }, [customer?.id, advancePayments])

  const numTotalAmount = Number(amount || 0)
  const numCash = Number(cashAmt || 0)
  const numUpi = Number(upiAmt || 0)

  const getUpiLink = (amountVal: number, notesText = 'Advance Payment') => {
    if (!business?.upiId || amountVal <= 0) return ''
    const params = new URLSearchParams({
      pa: business.upiId,
      pn: business.shopName || 'PrintPro',
      am: amountVal.toFixed(2),
      cu: 'INR',
      tn: notesText,
    })
    return `upi://pay?${params.toString()}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (numTotalAmount <= 0) {
      setFormError('Please enter a valid amount.')
      return
    }

    if (numCash + numUpi !== numTotalAmount) {
      // Default to full cash or upi if not split explicitly
      if (numCash === 0 && numUpi === 0) {
        setCashAmt(String(numTotalAmount))
      } else {
        setFormError(`Split sum (₹${(numCash + numUpi).toFixed(2)}) must equal total amount (₹${numTotalAmount.toFixed(2)}).`)
        return
      }
    }

    if (actionTab === 'return' && numTotalAmount > advanceBalance) {
      setFormError(`Cannot return ₹${numTotalAmount.toFixed(2)}. Customer only has ₹${advanceBalance.toFixed(2)} advance balance.`)
      return
    }

    const finalCash = numCash === 0 && numUpi === 0 ? numTotalAmount : numCash
    const finalUpi = numCash === 0 && numUpi === 0 ? 0 : numUpi

    setIsSubmitting(true)
    try {
      if (actionTab === 'deposit') {
        await onAddAdvancePayment(
          {
            customerId: customer.id,
            customerName: customer.name,
            amount: numTotalAmount,
            cashAmount: finalCash,
            upiAmount: finalUpi,
            date: payDate,
            notes: notes.trim(),
            paymentMethod: finalCash > 0 && finalUpi > 0 ? 'split' : (finalUpi > 0 ? 'upi' : 'cash'),
          },
          autoApplyToDues
        )
        showToast(
          autoApplyToDues && outstandingDue > 0
            ? `Advance payment of ₹${numTotalAmount.toFixed(2)} recorded and applied to pending dues!`
            : `Advance deposit of ₹${numTotalAmount.toFixed(2)} added to wallet!`,
          'success'
        )
      } else {
        await onReturnAdvancePayment({
          customerId: customer.id,
          customerName: customer.name,
          amount: numTotalAmount,
          cashAmount: finalCash,
          upiAmount: finalUpi,
          date: payDate,
          notes: notes.trim(),
          paymentMethod: finalCash > 0 && finalUpi > 0 ? 'split' : (finalUpi > 0 ? 'upi' : 'cash'),
        })
        showToast(`Advance return of ₹${numTotalAmount.toFixed(2)} processed successfully!`, 'success')
      }

      setAmount('')
      setCashAmt('')
      setUpiAmt('')
      setNotes('')
      setUpiCheckoutAmount(0)
    } catch (err: any) {
      setFormError(err?.message || 'Failed to process advance transaction.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Advance Wallet Balance Highlight Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <Wallet size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Available Advance Wallet
            </div>
            <div className="currency-num" style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
              ₹{advanceBalance.toFixed(2)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn btn-sm ${actionTab === 'deposit' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActionTab('deposit')
              setFormError('')
            }}
          >
            <Plus size={14} /> Deposit Advance
          </button>
          <button
            type="button"
            className={`btn btn-sm ${actionTab === 'return' ? 'btn-primary' : 'btn-secondary'}`}
            disabled={advanceBalance <= 0}
            onClick={() => {
              setActionTab('return')
              setFormError('')
            }}
          >
            <MinusCircle size={14} /> Return Advance
          </button>
        </div>
      </div>

      {/* 2. Action Form Card (Deposit or Return) */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 700 }}>
          {actionTab === 'deposit' ? 'Receive New Advance Payment' : 'Return Advance Balance to Customer'}
        </h3>

        {formError && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.82rem',
            }}
          >
            <AlertCircle size={15} /> {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Total Amount (₹)*</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setCashAmt(e.target.value)
                  setUpiAmt('')
                }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-input"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
          </div>

          {/* Payment Split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Cash Component (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder="0.00"
                value={cashAmt}
                onChange={(e) => setCashAmt(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="form-label">UPI Component (₹)</label>
                {business?.upiId && numUpi > 0 && actionTab === 'deposit' && (
                  <button
                    type="button"
                    onClick={() => setUpiCheckoutAmount(numUpi)}
                    style={{ background: 'none', border: 'none', color: 'var(--aurora-cyan, #00f0ff)', fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}
                  >
                    UPI QR
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder="0.00"
                value={upiAmt}
                onChange={(e) => setUpiAmt(e.target.value)}
              />
            </div>
          </div>

          {/* AUTO-APPLY TOWARDS DUE BILLS TOGGLE (CRITICAL FEATURE) */}
          {actionTab === 'deposit' && outstandingDue > 0 && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 240, 255, 0.07)',
                border: '1px solid rgba(0, 240, 255, 0.25)',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <input
                type="checkbox"
                id="autoApplyDuesCheck"
                checked={autoApplyToDues}
                onChange={(e) => setAutoApplyToDues(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="autoApplyDuesCheck" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                <strong>Auto-apply towards pending dues (₹{outstandingDue.toFixed(2)}) first</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  If checked, unpaid invoices are cleared chronologically (FIFO), and any remaining surplus is added to the advance wallet.
                </div>
              </label>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Notes / Remarks</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. advance for upcoming wedding card order"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || numTotalAmount <= 0}
            >
              {isSubmitting
                ? 'Processing...'
                : actionTab === 'deposit'
                ? `Record Advance Deposit (₹${numTotalAmount.toFixed(2)})`
                : `Process Advance Return (₹${numTotalAmount.toFixed(2)})`}
            </button>
          </div>
        </form>

        {/* UPI QR Display */}
        {upiCheckoutAmount > 0 && business?.upiId && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px',
              background: 'rgba(0, 240, 255, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Smartphone size={20} color="var(--aurora-cyan, #00f0ff)" />
              <div style={{ fontSize: '0.82rem' }}>
                UPI Link for ₹{upiCheckoutAmount.toFixed(2)} to {business.upiId}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(getUpiLink(upiCheckoutAmount))
                  showToast('UPI payment link copied!', 'success')
                }}
              >
                <Copy size={13} /> Copy Link
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setUpiCheckoutAmount(0)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Advance History Log for this customer */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600 }}>Advance Transaction History</h4>
        </div>
        {customerAdvances.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No advance deposits or returns recorded for this customer.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.5)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Action</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Method</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Notes</th>
                  {onDeleteAdvancePayment && <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {customerAdvances.map((adv) => {
                  const isReturn = adv.isReturn || adv.amount < 0 || adv.type === 'return'
                  const displayAmt = Math.abs(Number(adv.amount || 0))

                  return (
                    <tr key={adv.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                        {adv.date ? adv.date.slice(0, 10) : ''}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`badge ${isReturn ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                          {isReturn ? 'Return' : 'Deposit'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                        {adv.paymentMethod || 'Cash'}
                      </td>
                      <td
                        style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: isReturn ? 'var(--aurora-amber, #f59e0b)' : '#10b981',
                        }}
                      >
                        {isReturn ? `-₹${displayAmt.toFixed(2)}` : `+₹${displayAmt.toFixed(2)}`}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                        {adv.notes || '—'}
                      </td>
                      {onDeleteAdvancePayment && (
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              showConfirm('Are you sure you want to delete this advance entry?', () => {
                                onDeleteAdvancePayment(adv.id)
                              })
                            }}
                            style={{ color: 'var(--error)' }}
                            title="Delete advance entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
