import React from 'react'
import { Gift, CheckCircle, Save } from 'lucide-react'

export interface LoyaltyTier {
  from: number | string
  to: number | string
  points: number | string
}

export interface LoyaltyRedeemOption {
  points: number | string
  rupees: number | string
}

export interface LoyaltyData {
  loyaltyEnabled: boolean
  loyaltyForRandomCustomers: boolean
  loyaltyRedeemEnabled: boolean
  loyaltyRedeemRatioPoints: number | string
  loyaltyRedeemRatioRupees: number | string
  loyaltyTiers: LoyaltyTier[]
  loyaltyRedeemOptions: LoyaltyRedeemOption[]
}

interface LoyaltyTabProps {
  loyalty: LoyaltyData
  setLoyalty: React.Dispatch<React.SetStateAction<LoyaltyData>>
  handleLoyaltySave: (e: React.FormEvent) => Promise<void>
  loyaltySaved: boolean
}

export const LoyaltyTab: React.FC<LoyaltyTabProps> = ({
  loyalty,
  setLoyalty,
  handleLoyaltySave,
  loyaltySaved,
}) => {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            background: 'var(--accent-light)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}
        >
          <Gift size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Customer Loyalty Program</h2>
          <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            Manage reward points earning and redemption ratios.
          </p>
        </div>
      </div>

      <form onSubmit={handleLoyaltySave} autoComplete="off">
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={loyalty.loyaltyEnabled}
              onChange={(e) => setLoyalty((prev) => ({ ...prev, loyaltyEnabled: e.target.checked }))}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontWeight: 600 }}>Enable Customer Loyalty Program</span>
          </label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '26px' }}>
            Enable to reward points to regular customers and allow point redemptions.
          </p>
        </div>

        {loyalty.loyaltyEnabled && (
          <div className="form-group" style={{ marginBottom: '16px', marginLeft: '26px' }}>
            <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={loyalty.loyaltyForRandomCustomers}
                onChange={(e) => setLoyalty((prev) => ({ ...prev, loyaltyForRandomCustomers: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 600 }}>Earn Points for Random / Walk-in Customers</span>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '26px' }}>
              Allow non-registered (walk-in) guests to earn loyalty points on their invoices.
            </p>
          </div>
        )}

        {loyalty.loyaltyEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255,255,255,0.02)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={loyalty.loyaltyRedeemEnabled}
                  onChange={(e) => setLoyalty((prev) => ({ ...prev, loyaltyRedeemEnabled: e.target.checked }))}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 600 }}>Enable Points Redemption</span>
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '26px' }}>
                Toggle whether customers can redeem accumulated points at checkout.
              </p>
            </div>

            {/* Tiered Points Earning Table */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                Points Earning Tiers
              </label>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Define how many points a customer earns for spending within each range. Points are credited only after full bill payment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <span>From ₹ (≥)</span>
                  <span>To ₹ (≤)</span>
                  <span>Points Earned</span>
                  <span></span>
                </div>
                {loyalty.loyaltyTiers.map((tier, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: '8px', alignItems: 'center' }}>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="1"
                      value={tier.from}
                      onChange={(e) =>
                        setLoyalty((prev) => {
                          const tiers = [...prev.loyaltyTiers]
                          tiers[i] = { ...tiers[i], from: e.target.value }
                          return { ...prev, loyaltyTiers: tiers }
                        })
                      }
                    />
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="1"
                      value={tier.to}
                      onChange={(e) =>
                        setLoyalty((prev) => {
                          const tiers = [...prev.loyaltyTiers]
                          tiers[i] = { ...tiers[i], to: e.target.value }
                          return { ...prev, loyaltyTiers: tiers }
                        })
                      }
                    />
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      step="1"
                      value={tier.points}
                      onChange={(e) =>
                        setLoyalty((prev) => {
                          const tiers = [...prev.loyaltyTiers]
                          tiers[i] = { ...tiers[i], points: e.target.value }
                          return { ...prev, loyaltyTiers: tiers }
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLoyalty((prev) => ({
                          ...prev,
                          loyaltyTiers: prev.loyaltyTiers.filter((_, j) => j !== i),
                        }))
                      }
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#ef4444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        height: '36px',
                        width: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '16px',
                      }}
                      title="Remove tier"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setLoyalty((prev) => ({
                      ...prev,
                      loyaltyTiers: [
                        ...prev.loyaltyTiers,
                        {
                          from: prev.loyaltyTiers.length ? Number(prev.loyaltyTiers[prev.loyaltyTiers.length - 1].to) + 1 : 1,
                          to: prev.loyaltyTiers.length ? Number(prev.loyaltyTiers[prev.loyaltyTiers.length - 1].to) + 50 : 50,
                          points: prev.loyaltyTiers.length ? Number(prev.loyaltyTiers[prev.loyaltyTiers.length - 1].points) + 1 : 1,
                        },
                      ],
                    }))
                  }
                  style={{
                    alignSelf: 'flex-start',
                    padding: '5px 14px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px dashed var(--border)',
                    background: 'transparent',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  + Add Tier
                </button>
                {loyalty.loyaltyTiers.length > 0 && (
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      marginTop: '4px',
                    }}
                  >
                    Preview: {loyalty.loyaltyTiers.map((t) => `₹${t.from}–₹${t.to} = ${t.points} pt${Number(t.points) !== 1 ? 's' : ''}`).join(' · ')}
                  </div>
                )}
              </div>
            </div>

            {/* Redemption Options */}
            {loyalty.loyaltyRedeemEnabled && (
              <div className="form-group">
                <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>
                  Redemption Points Ratio Options
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {loyalty.loyaltyRedeemOptions.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        placeholder="Points"
                        value={opt.points}
                        onChange={(e) =>
                          setLoyalty((prev) => {
                            const options = [...prev.loyaltyRedeemOptions]
                            options[i] = { ...options[i], points: e.target.value }
                            return { ...prev, loyaltyRedeemOptions: options }
                          })
                        }
                        required
                        style={{ flex: 1 }}
                      />
                      <span>Points =</span>
                      <input
                        className="form-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Discount (₹)"
                        value={opt.rupees}
                        onChange={(e) =>
                          setLoyalty((prev) => {
                            const options = [...prev.loyaltyRedeemOptions]
                            options[i] = { ...options[i], rupees: e.target.value }
                            return { ...prev, loyaltyRedeemOptions: options }
                          })
                        }
                        required
                        style={{ flex: 1 }}
                      />
                      <span>Rs.</span>
                      <button
                        type="button"
                        onClick={() =>
                          setLoyalty((prev) => ({
                            ...prev,
                            loyaltyRedeemOptions: prev.loyaltyRedeemOptions.filter((_, j) => j !== i),
                          }))
                        }
                        style={{
                          background: 'rgba(239,68,68,0.12)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          color: '#ef4444',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          height: '36px',
                          width: '36px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '16px',
                        }}
                        title="Remove option"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setLoyalty((prev) => ({
                        ...prev,
                        loyaltyRedeemOptions: [
                          ...prev.loyaltyRedeemOptions,
                          { points: '', rupees: '' },
                        ],
                      }))
                    }
                    style={{
                      alignSelf: 'flex-start',
                      padding: '5px 14px',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: '1px dashed var(--border)',
                      background: 'transparent',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    + Add Option
                  </button>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Define redemption options such as: 100 points = ₹2.5 discount, 120 points = ₹3 discount, etc.
                </p>
              </div>
            )}
          </div>
        )}

        {loyaltySaved && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              marginBottom: '12px',
              background: 'var(--success-bg)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--success)',
              fontSize: '0.875rem',
            }}
          >
            <CheckCircle size={16} /> Loyalty program settings saved!
          </div>
        )}

        <button type="submit" className="btn btn-primary">
          <Save size={16} /> Save Loyalty Settings
        </button>
      </form>
    </div>
  )
}
export default LoyaltyTab
