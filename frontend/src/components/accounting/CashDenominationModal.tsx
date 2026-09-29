import React, { useState, useMemo } from 'react'
import { X, CheckCircle, AlertTriangle, Calculator, ArrowRight } from 'lucide-react'

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1]

interface CashDenominationModalProps {
  isOpen: boolean
  onClose: () => void
  expectedCash: number
  onSaveDenomination?: (countedCash: number, breakdown: Record<number, number>, variance: number) => void
  showToast: (msg: string, type?: string) => void
}

export const CashDenominationModal: React.FC<CashDenominationModalProps> = ({
  isOpen,
  onClose,
  expectedCash,
  onSaveDenomination,
  showToast,
}) => {
  const [counts, setCounts] = useState<Record<number, number>>({
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

  const totalCounted = useMemo(() => {
    return DENOMINATIONS.reduce((sum, denom) => {
      const count = Number(counts[denom] || 0)
      return sum + denom * count
    }, 0)
  }, [counts])

  const variance = Number((totalCounted - expectedCash).toFixed(2))

  if (!isOpen) return null

  const handleCountChange = (denom: number, val: string) => {
    const num = Math.max(0, parseInt(val || '0', 10) || 0)
    setCounts((prev) => ({ ...prev, [denom]: num }))
  }

  const handleSave = () => {
    if (onSaveDenomination) {
      onSaveDenomination(totalCounted, counts, variance)
    }
    showToast(
      variance === 0
        ? 'Drawer count verified perfectly with ₹0 variance!'
        : variance > 0
        ? `Drawer verified with surplus of +₹${variance.toFixed(2)}`
        : `Drawer verified with shortage of ₹${Math.abs(variance).toFixed(2)}`,
      variance === 0 ? 'success' : variance > 0 ? 'info' : 'warning'
    )
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={18} color="var(--aurora-cyan, #00f0ff)" />
            <h3 style={{ margin: 0 }}>Cash Drawer Denomination Counter</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Count physical notes and coins in the cash register drawer to reconcile against expected system balance.
          </p>

          {/* Expected vs Counted Comparison Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              padding: '12px 14px',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                System Expected Cash
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ₹{expectedCash.toFixed(2)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Physical Counted Cash
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--aurora-cyan, #00f0ff)' }}>
                ₹{totalCounted.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Variance Status Pill */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
              backgroundColor:
                variance === 0
                  ? 'rgba(16, 185, 129, 0.15)'
                  : variance > 0
                  ? 'rgba(0, 240, 255, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              border:
                variance === 0
                  ? '1px solid rgba(16, 185, 129, 0.4)'
                  : variance > 0
                  ? '1px solid rgba(0, 240, 255, 0.4)'
                  : '1px solid rgba(239, 68, 68, 0.4)',
              color:
                variance === 0
                  ? '#34d399'
                  : variance > 0
                  ? 'var(--aurora-cyan, #00f0ff)'
                  : '#f87171',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {variance === 0 ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span>
                {variance === 0
                  ? 'Cash Drawer Perfectly Balanced'
                  : variance > 0
                  ? 'Surplus Cash in Drawer'
                  : 'Cash Shortage Detected'}
              </span>
            </div>
            <strong>
              {variance === 0 ? '₹0.00' : `${variance > 0 ? '+' : ''}₹${variance.toFixed(2)}`}
            </strong>
          </div>

          {/* Denomination Input Table */}
          <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Denomination</th>
                  <th style={{ textAlign: 'center', padding: '6px' }}>Count (Qty)</th>
                  <th style={{ textAlign: 'right', padding: '6px' }}>Subtotal (₹)</th>
                </tr>
              </thead>
              <tbody>
                {DENOMINATIONS.map((denom) => {
                  const count = counts[denom] || 0
                  const subtotal = denom * count
                  return (
                    <tr key={denom} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '6px', fontWeight: 600 }}>₹{denom}</td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="form-input"
                          style={{
                            width: '85px',
                            textAlign: 'center',
                            height: '32px',
                            padding: '4px',
                            display: 'inline-block',
                          }}
                          value={count === 0 ? '' : count}
                          placeholder="0"
                          onChange={(e) => handleCountChange(denom, e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: subtotal > 0 ? '#ffffff' : 'var(--text-muted)' }}>
                        ₹{subtotal.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save Drawer Audit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
