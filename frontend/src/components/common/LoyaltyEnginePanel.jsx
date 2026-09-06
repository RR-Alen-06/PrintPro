import React from 'react'
import { Gift, Sparkles, Clock, Percent, Award, ArrowRight } from 'lucide-react'
import { LoyaltyService } from '../../services/loyaltyService'

export default function LoyaltyEnginePanel({
  customer,
  subtotal = 0,
  settings = {},
  shouldRedeem = false,
  onToggleRedeem = () => {},
  pointsToRedeem = '',
  onPointsChange = () => {},
  loyaltyDiscount = 0
}) {
  if (settings?.loyaltyEnabled === false) return null
  if (!customer) return null

  const isRegular = (customer?.type || 'regular') === 'regular'
  if (!isRegular && !settings?.loyaltyForRandomCustomers) return null

  const currentPoints = Math.max(0, Number(customer?.loyaltyPoints || customer?.loyalty_points || 0))
  const pointsEarned = LoyaltyService.calculatePointsEarned(subtotal, isRegular, settings)
  const redeemedNum = Math.min(Number(pointsToRedeem || 0), currentPoints)
  const estimatedBalance = Math.max(0, currentPoints - redeemedNum) + pointsEarned

  return (
    <div
      style={{
        background: 'rgba(255, 47, 176, 0.04)',
        border: '1px solid rgba(255, 47, 176, 0.25)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '16px',
        margin: '14px 0',
        boxShadow: '0 0 15px rgba(255, 47, 176, 0.08)',
        color: 'var(--text-primary)'
      }}
    >
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255, 47, 176, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}
          >
            <Gift size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.04em' }}>
              LOYALTY ENGINE
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {customer?.name || 'Customer'} • Account Rewards
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 255, 171, 0.15)',
            border: '1px solid var(--success)',
            color: 'var(--success)',
            fontSize: '0.75rem',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 'var(--radius-full, 9999px)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 0 10px rgba(0, 255, 171, 0.2)'
          }}
        >
          <Sparkles size={13} /> +{pointsEarned} pts Earned
        </div>
      </div>

      {/* Stats Breakdown Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          background: 'var(--bg-input, rgba(0, 0, 0, 0.2))',
          padding: '12px',
          borderRadius: 'var(--radius-md, 8px)',
          fontSize: '0.78rem',
          border: '1px solid var(--border)'
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Current Loyalty Points:</span>
          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
            {currentPoints} Points
          </div>
        </div>

        <div>
          <span style={{ color: 'var(--text-muted)' }}>Discount Applied:</span>
          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: loyaltyDiscount > 0 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
            -₹{loyaltyDiscount.toFixed(2)}
          </div>
        </div>

        <div>
          <span style={{ color: 'var(--text-muted)' }}>Points Redeemed:</span>
          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: redeemedNum > 0 ? 'var(--accent-secondary)' : 'var(--text-primary)' }}>
            {redeemedNum} Points
          </div>
        </div>

        <div>
          <span style={{ color: 'var(--text-muted)' }}>Estimated Balance:</span>
          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
            {estimatedBalance} Points
          </div>
        </div>

        <div style={{ gridColumn: 'span 2', paddingTop: '6px', borderTop: '1px dashed var(--border-light, rgba(255,255,255,0.1))', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning, #f59e0b)' }}>
          <Clock size={13} />
          <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
            Pending Uncredited: ⏳ {pointsEarned} Points (credited after full payment)
          </span>
        </div>
      </div>

      {/* Redeem Points Section */}
      {settings?.loyaltyRedeemEnabled !== false && currentPoints > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-light, rgba(255,255,255,0.1))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={shouldRedeem}
                onChange={(e) => onToggleRedeem(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <span>Redeem Points for Discount</span>
            </label>

            {shouldRedeem && (
              <button
                type="button"
                onClick={() => onPointsChange(String(currentPoints))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-secondary)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Use Max ({currentPoints})
              </button>
            )}
          </div>

          {shouldRedeem && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="number"
                  min="0"
                  max={currentPoints}
                  value={pointsToRedeem}
                  onChange={(e) => onPointsChange(e.target.value)}
                  placeholder={`Max: ${currentPoints}`}
                  className="mobile-input currency-num form-input"
                  style={{ width: '100%', minHeight: '38px', fontSize: '0.88rem' }}
                />
              </div>
              <div
                style={{
                  background: 'rgba(255, 47, 176, 0.15)',
                  border: '1px solid var(--accent-primary)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: 'var(--accent-primary)',
                  whiteSpace: 'nowrap'
                }}
              >
                = -₹{loyaltyDiscount.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
