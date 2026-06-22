import React, { useState, useEffect } from 'react'
import { Check, Download, Share2, Printer, PlusCircle, ArrowRight, Wallet, AlertTriangle, Sparkles } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

/**
 * Premium POS Bill Success Screen shown after successful creation
 * @param {object} props
 * @param {object} props.bill - The generated bill object
 * @param {function} props.onDownload - PDF download handler
 * @param {function} props.onWhatsApp - WhatsApp share handler
 * @param {function} props.onPrint - Print receipt handler
 * @param {function} props.onCreateNew - Callback to clear success screen and create new bill
 */
export const BillSuccessScreen = ({ bill, onDownload, onWhatsApp, onPrint, onCreateNew }) => {
  const { recordSpecificBillPayment, business, settings } = useAppContext()
  
  // Local state initialized with the bill prop
  const [localBill, setLocalBill] = useState(bill)

  // Keep local state in sync when bill prop changes
  useEffect(() => {
    setLocalBill(bill)
  }, [bill])

  // Local payment recording state for outstanding balances
  const [payCash, setPayCash] = useState('')
  const [payUpi, setPayUpi] = useState('')
  const [payMsg, setPayMsg] = useState('')
  const [payError, setPayError] = useState('')

  if (!localBill) return null

  const outstanding = Math.max(localBill.total - localBill.amountPaid, 0)
  const isPaid = localBill.status === 'paid' || outstanding <= 0

  const handleRecordSuccessPayment = (e) => {
    e.preventDefault()
    const cash = Number(payCash || 0)
    const upi = Number(payUpi || 0)
    const totalPay = cash + upi

    if (totalPay <= 0) {
      setPayError('Please enter a payment amount.')
      return
    }

    if (totalPay > outstanding) {
      setPayError(`Payment (₹${totalPay.toFixed(2)}) exceeds balance due (₹${outstanding.toFixed(2)})`)
      return
    }

    try {
      recordSpecificBillPayment({
        billId: localBill.id,
        customerId: localBill.customerId,
        cashAmount: cash,
        upiAmount: upi,
        notes: 'Settle balance via bill success screen',
      })
      
      setPayMsg('Payment recorded successfully!')
      setPayCash('')
      setPayUpi('')
      setPayError('')
      
      // Update local state to reflect payment immediately without mutating props
      const nextAmountPaid = Number((localBill.amountPaid + totalPay).toFixed(2))
      setLocalBill(prev => ({
        ...prev,
        amountPaid: nextAmountPaid,
        balance: Math.max(prev.total - nextAmountPaid, 0),
        status: nextAmountPaid >= prev.total ? 'paid' : 'partial',
        paymentMethod: {
          ...prev.paymentMethod,
          cash: Number(((prev.paymentMethod?.cash || 0) + cash).toFixed(2)),
          upi: Number(((prev.paymentMethod?.upi || 0) + upi).toFixed(2)),
        }
      }))
    } catch (err) {
      setPayError('Failed to record payment.')
    }
  }

  return (
    <div style={{
      animation: 'scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      background: 'var(--gradient-card)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-xl)',
      padding: '32px',
      boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
      color: 'var(--text-primary)',
      maxWidth: '650px',
      margin: '0 auto 24px auto',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative glows */}
      <div style={{
        position: 'absolute',
        top: '-150px',
        right: '-150px',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-150px',
        left: '-150px',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Success animation header */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        marginBottom: '28px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          position: 'relative',
          width: '72px',
          height: '72px',
          marginBottom: '16px',
        }}>
          {/* Animated pulsing outer rings */}
          <div className="success-pulse-ring-1" />
          <div className="success-pulse-ring-2" />
          
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'var(--success-bg)',
            border: '2px solid var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
            position: 'relative',
            zIndex: 3,
          }}>
            <Check size={36} style={{ color: 'var(--success)', strokeWidth: '3px' }} className="success-checkmark-svg" />
          </div>
        </div>

        <h2 style={{
          fontSize: '1.6rem',
          fontWeight: 700,
          background: 'linear-gradient(to right, #f8fafc, #cbd5e1)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '4px',
          letterSpacing: '-0.02em',
        }}>
          Bill Generated Successfully!
        </h2>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          fontFamily: 'monospace',
          fontWeight: 600,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border)',
          padding: '4px 12px',
          borderRadius: 'var(--radius-sm)',
          marginTop: '6px'
        }}>
          Invoice: {localBill.id}
        </p>
      </div>

      {/* Summary grid */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginBottom: '24px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px 24px',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Customer</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{localBill.customerName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
              {localBill.customerType === 'regular' ? 'Regular Account' : 'Walk-in Customer'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Date &amp; Time</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{localBill.date}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div style={{ gridColumn: 'span 2', height: '1px', background: 'var(--border)', margin: '4px 0' }} />
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Grand Total</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent)' }}>₹{localBill.total.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Status</div>
            <span className={`badge badge-${localBill.status}`} style={{
              display: 'inline-flex',
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm)',
              marginTop: '4px'
            }}>
              {localBill.status}
            </span>
          </div>
        </div>

        {/* Detailed Payment Breakdown */}
        <div style={{
          marginTop: '18px',
          paddingTop: '16px',
          borderTop: '1px dashed var(--border)',
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Payment Breakdown
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 16px',
            fontSize: '0.85rem'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Cash Paid:</span>{' '}
              <strong style={{ color: 'var(--text-primary)' }}>₹{(localBill.paymentMethod?.cash || 0).toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>UPI Paid:</span>{' '}
              <strong style={{ color: 'var(--text-primary)' }}>₹{(localBill.paymentMethod?.upi || 0).toFixed(2)}</strong>
            </div>
            {localBill.advanceUsed > 0 && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Advance Used:</span>{' '}
                <strong style={{ color: 'var(--info)' }}>₹{localBill.advanceUsed.toFixed(2)}</strong>
              </div>
            )}
            {localBill.discountAmount > 0 && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Discount:</span>{' '}
                <strong style={{ color: 'var(--success)' }}>-₹{localBill.discountAmount.toFixed(2)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline Settle Balance form if bill is unpaid/partial */}
      {!isPaid && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.04)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: '24px',
          position: 'relative',
          zIndex: 1,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--warning)',
            fontWeight: 600,
            fontSize: '0.9rem',
            marginBottom: '12px'
          }}>
            <Wallet size={16} />
            <span>Settle Outstanding Balance (₹{outstanding.toFixed(2)})</span>
          </div>

          {payMsg && (
            <div style={{ color: 'var(--success)', fontSize: '0.825rem', marginBottom: '8px', fontWeight: 500 }}>
              ✓ {payMsg}
            </div>
          )}
          {payError && (
            <div style={{ color: 'var(--error)', fontSize: '0.825rem', marginBottom: '8px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={12} /> {payError}
            </div>
          )}

          <form onSubmit={handleRecordSuccessPayment} style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Cash Amount (₹)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={payCash}
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                onChange={(e) => setPayCash(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>UPI Amount (₹)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={payUpi}
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                onChange={(e) => setPayUpi(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              style={{
                background: 'var(--warning)',
                borderColor: 'var(--warning)',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#06060c'
              }}
            >
              Record Payment
            </button>
          </form>
        </div>
      )}

      {/* POS Quick Actions */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px'
        }}>
          <button
            className="btn btn-secondary"
            onClick={onDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <Download size={15} />
            <span>PDF Invoice</span>
          </button>
          
          <button
            className="btn btn-secondary"
            onClick={onWhatsApp}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(37, 211, 102, 0.08)',
              borderColor: 'rgba(37, 211, 102, 0.25)',
              color: '#25d366'
            }}
          >
            <Share2 size={15} />
            <span>Share WA</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={onPrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <Printer size={15} />
            <span>Print Invoice</span>
          </button>
        </div>

        <button
          className="btn btn-primary"
          onClick={onCreateNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px',
            fontSize: '0.9rem',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-accent)',
            border: 'none',
            boxShadow: 'var(--shadow-md)',
            cursor: 'pointer',
            marginTop: '8px'
          }}
        >
          <PlusCircle size={18} />
          <span>Create New Bill</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

export default BillSuccessScreen
