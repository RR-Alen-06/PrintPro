import React from 'react'
import { Tag, Trash2 } from 'lucide-react'

export interface PromoCodeItem {
  id?: string
  code: string
  type: 'percent' | 'flat'
  value: number
  minAmount?: number
  startDate?: string | null
  endDate?: string | null
  enabled?: boolean
}

export interface NewPromoState {
  code: string
  type: 'percent' | 'flat'
  value: string
  minAmount: string
  startDate: string
  endDate: string
  enabled: boolean
}

interface PromoCodesTabProps {
  promoCodes: PromoCodeItem[]
  newPromo: NewPromoState
  setNewPromo: React.Dispatch<React.SetStateAction<NewPromoState>>
  handleAddPromo: (e: React.FormEvent) => Promise<void>
  handleDeletePromo: (code: string) => Promise<void>
  handleTogglePromoEnabled: (code: string) => Promise<void>
}

export const PromoCodesTab: React.FC<PromoCodesTabProps> = ({
  promoCodes,
  newPromo,
  setNewPromo,
  handleAddPromo,
  handleDeletePromo,
  handleTogglePromoEnabled,
}) => {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            background: 'rgba(59,130,246,0.15)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6',
          }}
        >
          <Tag size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Coupon &amp; Promo Codes</h2>
          <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            Configure discount coupons for your shop checkout.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* List of Coupon Codes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 600 }}>Active Coupons</h3>
          {!promoCodes || promoCodes.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No coupon codes configured.</p>
          ) : (
            <div
              style={{
                overflowX: 'auto',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Code</th>
                    <th style={{ padding: '8px 10px' }}>Discount</th>
                    <th style={{ padding: '8px 10px' }}>Min Bill</th>
                    <th style={{ padding: '8px 10px' }}>Validity</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Enabled</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((p) => {
                    const isValidToday =
                      (!p.startDate || new Date().toISOString().slice(0, 10) >= p.startDate) &&
                      (!p.endDate || new Date().toISOString().slice(0, 10) <= p.endDate)
                    return (
                      <tr key={p.code} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#3b82f6' }}>{p.code}</td>
                        <td style={{ padding: '8px 10px' }}>{p.type === 'percent' ? `${p.value}% Off` : `₹${p.value} Flat`}</td>
                        <td style={{ padding: '8px 10px' }}>₹{p.minAmount || 0}</td>
                        <td
                          style={{
                            padding: '8px 10px',
                            fontSize: '0.75rem',
                            color: isValidToday ? 'var(--text-secondary)' : '#ef4444',
                          }}
                        >
                          {p.startDate || p.endDate ? (
                            <>
                              <div>From: {p.startDate || '—'}</div>
                              <div>To: {p.endDate || '—'}</div>
                            </>
                          ) : (
                            'Always valid'
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={p.enabled !== false}
                            onChange={() => handleTogglePromoEnabled(p.code)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeletePromo(p.code)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          >
                            <Trash2 size={14} />
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

        {/* Add New Coupon Form */}
        <div
          style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>Create New Coupon</h3>
          <form onSubmit={handleAddPromo} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.78rem' }}>
                Coupon Code (e.g. STU10)
              </label>
              <input
                className="form-input"
                style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                type="text"
                placeholder="e.g. STU10"
                value={newPromo.code}
                onChange={(e) => setNewPromo((prev) => ({ ...prev, code: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  Discount Type
                </label>
                <select
                  className="form-select"
                  style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                  value={newPromo.type}
                  onChange={(e) => setNewPromo((prev) => ({ ...prev, type: e.target.value as 'percent' | 'flat' }))}
                >
                  <option value="percent">% Percent</option>
                  <option value="flat">₹ Flat Amount</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  Discount Value
                </label>
                <input
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 10"
                  value={newPromo.value}
                  onChange={(e) => setNewPromo((prev) => ({ ...prev, value: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.78rem' }}>
                Min Bill Amount (₹)
              </label>
              <input
                className="form-input"
                style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                type="number"
                min="0"
                placeholder="e.g. 150"
                value={newPromo.minAmount}
                onChange={(e) => setNewPromo((prev) => ({ ...prev, minAmount: e.target.value }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  Valid From
                </label>
                <input
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                  type="date"
                  value={newPromo.startDate}
                  onChange={(e) => setNewPromo((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  Valid To
                </label>
                <input
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                  type="date"
                  value={newPromo.endDate}
                  onChange={(e) => setNewPromo((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <label
              className="checkbox-container"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', marginTop: '4px' }}
            >
              <input
                type="checkbox"
                checked={newPromo.enabled}
                onChange={(e) => setNewPromo((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              <span>Enable Coupon Code</span>
            </label>

            <button
              type="submit"
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '8px 16px', marginTop: '4px', background: '#3b82f6', color: '#fff', border: 'none' }}
            >
              Add Coupon Code
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
export default PromoCodesTab
