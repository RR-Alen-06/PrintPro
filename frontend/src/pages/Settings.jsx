import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { Save, CheckCircle, Building2, BarChart3, Sliders, AlertTriangle, ShieldCheck, Gift, Palette, Tag, Trash2 } from 'lucide-react'

const Settings = () => {
  const { settings, updateSettings, business, updateBusiness, promoCodes, setPromoCodes, showConfirm } = useAppContext()

  // Business profile local state
  const [biz, setBiz] = useState({
    shopName: business.shopName || '',
    ownerName: business.ownerName || '',
    phone: business.phone || '',
    address: business.address || '',
    gstin: business.gstin || '',
    upiId: business.upiId || '',
  })
  const [bizSaved, setBizSaved] = useState(false)

  // Accounting settings local state
  const [acct, setAcct] = useState({
    gstRate: settings.gstRate ?? 0,
    viewMode: settings.viewMode || 'monthly',
    refundsEnabled: settings.refundsEnabled !== false,
  })
  const [acctSaved, setAcctSaved] = useState(false)

  // Loyalty Program local state
  const [loyalty, setLoyalty] = useState({
    loyaltyEnabled: settings.loyaltyEnabled !== false,
    loyaltyRedeemEnabled: settings.loyaltyRedeemEnabled !== false,
    loyaltyRedeemRatioPoints: settings.loyaltyRedeemRatioPoints ?? 150,
    loyaltyRedeemRatioRupees: settings.loyaltyRedeemRatioRupees ?? 5,
    loyaltyTiers: settings.loyaltyTiers?.length
      ? settings.loyaltyTiers.map(t => ({ ...t }))
      : [{ from: 1, to: 40, points: 1 }, { from: 41, to: 100, points: 2 }],
    loyaltyRedeemOptions: settings.loyaltyRedeemOptions?.length
      ? settings.loyaltyRedeemOptions.map(o => ({ ...o }))
      : [
          { points: 100, rupees: 2.5 },
          { points: 120, rupees: 3 },
          { points: 150, rupees: 5 },
        ],
  })
  const [loyaltySaved, setLoyaltySaved] = useState(false)

  // Promo / Coupon Codes local state
  const [newPromo, setNewPromo] = useState({
    code: '',
    type: 'percent',
    value: '',
    minAmount: '',
    startDate: '',
    endDate: '',
    enabled: true,
  })

  const handleAddPromo = (e) => {
    e.preventDefault()
    const codeUpper = newPromo.code.trim().toUpperCase()
    if (!codeUpper) {
      alert("Please enter a coupon code.")
      return
    }
    const val = Number(newPromo.value)
    if (isNaN(val) || val <= 0) {
      alert("Please enter a valid discount value.")
      return
    }
    if (newPromo.type === 'percent' && val > 100) {
      alert("Percentage discount cannot exceed 100%.")
      return
    }
    const minAmt = Number(newPromo.minAmount || 0)
    
    // Check if code already exists
    if (promoCodes?.some(p => p.code === codeUpper)) {
      alert("A coupon with this code already exists.")
      return
    }

    const updated = [
      ...(promoCodes || []),
      {
        code: codeUpper,
        type: newPromo.type,
        value: val,
        minAmount: minAmt,
        startDate: newPromo.startDate || null,
        endDate: newPromo.endDate || null,
        enabled: newPromo.enabled,
      }
    ]
    setPromoCodes(updated)
    setNewPromo({
      code: '',
      type: 'percent',
      value: '',
      minAmount: '',
      startDate: '',
      endDate: '',
      enabled: true,
    })
  }

  const handleDeletePromo = (codeToDelete) => {
    const updated = (promoCodes || []).filter(p => p.code !== codeToDelete)
    setPromoCodes(updated)
  }

  const handleTogglePromoEnabled = (codeToToggle) => {
    const updated = (promoCodes || []).map(p => 
      p.code === codeToToggle ? { ...p, enabled: p.enabled !== false ? false : true } : p
    )
    setPromoCodes(updated)
  }

  // Invoice Branding local state
  const [branding, setBranding] = useState({
    primaryColor: settings.primaryColor || '#0f172a',
    logoUrl: settings.logoUrl || '',
    headerNotes: settings.headerNotes || '',
    footerNotes: settings.footerNotes || '',
    showGstBreakdown: settings.showGstBreakdown !== false,
    showUpiQrCode: settings.showUpiQrCode !== false,
  })
  const [brandingSaved, setBrandingSaved] = useState(false)

  const handleLoyaltySave = (e) => {
    e.preventDefault()
    updateSettings({
      loyaltyEnabled: loyalty.loyaltyEnabled,
      loyaltyRedeemEnabled: loyalty.loyaltyRedeemEnabled,
      loyaltyRedeemRatioPoints: Number(loyalty.loyaltyRedeemRatioPoints),
      loyaltyRedeemRatioRupees: Number(loyalty.loyaltyRedeemRatioRupees),
      loyaltyTiers: loyalty.loyaltyTiers.map(t => ({
        from: Number(t.from),
        to: Number(t.to),
        points: Number(t.points),
      })).filter(t => t.from >= 0 && t.to >= t.from && t.points > 0),
      loyaltyRedeemOptions: loyalty.loyaltyRedeemOptions.map(o => ({
        points: Number(o.points),
        rupees: Number(o.rupees),
      })).filter(o => o.points > 0 && o.rupees > 0).sort((a, b) => a.points - b.points),
    })
    setLoyaltySaved(true)
    setTimeout(() => setLoyaltySaved(false), 3000)
  }

  const handleBrandingSave = (e) => {
    e.preventDefault()
    updateSettings(branding)
    setBrandingSaved(true)
    setTimeout(() => setBrandingSaved(false), 3000)
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200000) {
      alert("Logo size should be under 200KB to fit browser storage.")
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setBranding(prev => ({ ...prev, logoUrl: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleClearLogo = () => {
    setBranding(prev => ({ ...prev, logoUrl: '' }))
  }

  const [clearConfirm, setClearConfirm] = useState(false)

  const handleBizSave = (e) => {
    e.preventDefault()
    updateBusiness(biz)
    setBizSaved(true)
    setTimeout(() => setBizSaved(false), 3000)
  }

  const handleAcctSave = (e) => {
    e.preventDefault()
    updateSettings({ gstRate: Number(acct.gstRate), viewMode: acct.viewMode, refundsEnabled: acct.refundsEnabled })
    setAcctSaved(true)
    setTimeout(() => setAcctSaved(false), 3000)
  }

  const handleClearData = () => {
    showConfirm(
      'Clear All Data',
      'This permanently erases ALL data: bills, customers, payments, expenses, and settings. This cannot be undone. Are you absolutely sure?',
      () => {
        localStorage.removeItem('printpro-state')
        window.location.reload()
      }
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure your business profile, accounting preferences, and app settings.</p>
      </div>

      {/* Section 1: Business Profile */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <Building2 size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Business Profile</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>Shown on receipts and invoices.</p>
          </div>
        </div>

        <form onSubmit={handleBizSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Shop Name</label>
              <input
                className="form-input"
                type="text"
                value={biz.shopName}
                onChange={(e) => setBiz((b) => ({ ...b, shopName: e.target.value }))}
                placeholder="e.g. PrintPro"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Owner Name</label>
              <input
                className="form-input"
                type="text"
                value={biz.ownerName}
                onChange={(e) => setBiz((b) => ({ ...b, ownerName: e.target.value }))}
                placeholder="Full name"
              />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '4px' }}>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                type="tel"
                value={biz.phone}
                onChange={(e) => setBiz((b) => ({ ...b, phone: e.target.value }))}
                placeholder="Contact number"
              />
            </div>
            <div className="form-group">
              <label className="form-label">UPI ID</label>
              <input
                className="form-input"
                type="text"
                value={biz.upiId}
                onChange={(e) => setBiz((b) => ({ ...b, upiId: e.target.value }))}
                placeholder="e.g. yourshop@upi"
              />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '4px' }}>
            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input
                className="form-input"
                type="text"
                value={biz.gstin}
                onChange={(e) => setBiz((b) => ({ ...b, gstin: e.target.value }))}
                placeholder="GST Number"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-textarea"
                value={biz.address}
                onChange={(e) => setBiz((b) => ({ ...b, address: e.target.value }))}
                placeholder="Shop address"
                style={{ minHeight: '60px' }}
              />
            </div>
          </div>

          {bizSaved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', marginBottom: '12px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
            }}>
              <CheckCircle size={16} /> Business profile saved!
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
            <Save size={16} /> Save Profile
          </button>
        </form>
      </div>

      {/* Section 2: Accounting Settings */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}>
            <BarChart3 size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Accounting Settings</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>GST rate and reporting preferences.</p>
          </div>
        </div>

        <form onSubmit={handleAcctSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">GST Rate (%)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={acct.gstRate}
                onChange={(e) => setAcct((a) => ({ ...a, gstRate: e.target.value }))}
                placeholder="0"
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Set to 0 to disable GST calculation.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">View Mode</label>
              <select
                className="form-select"
                value={acct.viewMode}
                onChange={(e) => setAcct((a) => ({ ...a, viewMode: e.target.value }))}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Default date range for reports.
              </p>
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '12px' }}>
            <div className="form-group" style={{ marginBottom: '0' }}>
              <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={acct.refundsEnabled}
                  onChange={(e) => setAcct((a) => ({ ...a, refundsEnabled: e.target.checked }))}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 600 }}>Enable Refunds Module</span>
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '26px' }}>
                Show the Refunds module for managing cash/UPI reversals.
              </p>
            </div>
          </div>

          {acctSaved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', marginBottom: '12px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
            }}>
              <CheckCircle size={16} /> Accounting settings saved!
            </div>
          )}

          <button type="submit" className="btn btn-primary">
            <Save size={16} /> Save Settings
          </button>
        </form>
      </div>

      {/* Section 3: Loyalty Program Settings */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <Gift size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Customer Loyalty Program</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>Manage reward points earning and redemption ratios.</p>
          </div>
        </div>

        <form onSubmit={handleLoyaltySave}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Points Earning Tiers</label>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Define how many points a customer earns for spending within each range. Points are credited only after full bill payment.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Header */}
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
                        type="number" min="0" step="1"
                        value={tier.from}
                        onChange={(e) => setLoyalty(prev => {
                          const tiers = [...prev.loyaltyTiers]
                          tiers[i] = { ...tiers[i], from: e.target.value }
                          return { ...prev, loyaltyTiers: tiers }
                        })}
                      />
                      <input
                        className="form-input"
                        type="number" min="0" step="1"
                        value={tier.to}
                        onChange={(e) => setLoyalty(prev => {
                          const tiers = [...prev.loyaltyTiers]
                          tiers[i] = { ...tiers[i], to: e.target.value }
                          return { ...prev, loyaltyTiers: tiers }
                        })}
                      />
                      <input
                        className="form-input"
                        type="number" min="1" step="1"
                        value={tier.points}
                        onChange={(e) => setLoyalty(prev => {
                          const tiers = [...prev.loyaltyTiers]
                          tiers[i] = { ...tiers[i], points: e.target.value }
                          return { ...prev, loyaltyTiers: tiers }
                        })}
                      />
                      <button
                        type="button"
                        onClick={() => setLoyalty(prev => ({ ...prev, loyaltyTiers: prev.loyaltyTiers.filter((_, j) => j !== i) }))}
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', height: '36px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px' }}
                        title="Remove tier"
                      >×</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setLoyalty(prev => ({
                      ...prev,
                      loyaltyTiers: [
                        ...prev.loyaltyTiers,
                        {
                          from: prev.loyaltyTiers.length ? Number(prev.loyaltyTiers[prev.loyaltyTiers.length - 1].to) + 1 : 1,
                          to: prev.loyaltyTiers.length ? Number(prev.loyaltyTiers[prev.loyaltyTiers.length - 1].to) + 50 : 50,
                          points: prev.loyaltyTiers.length ? Number(prev.loyaltyTiers[prev.loyaltyTiers.length - 1].points) + 1 : 1,
                        }
                      ]
                    }))}
                    style={{ alignSelf: 'flex-start', padding: '5px 14px', fontSize: '0.8rem', borderRadius: '6px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                  >+ Add Tier</button>
                  {loyalty.loyaltyTiers.length > 0 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 12px', marginTop: '4px' }}>
                      Preview: {loyalty.loyaltyTiers.map((t, i) => `₹${t.from}–₹${t.to} = ${t.points} pt${Number(t.points) !== 1 ? 's' : ''}`).join(' · ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Redemption Options */}
              {loyalty.loyaltyRedeemEnabled && (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Redemption Points Ratio Options</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {loyalty.loyaltyRedeemOptions.map((opt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          placeholder="Points"
                          value={opt.points}
                          onChange={(e) => setLoyalty(prev => {
                            const options = [...prev.loyaltyRedeemOptions]
                            options[i] = { ...options[i], points: e.target.value }
                            return { ...prev, loyaltyRedeemOptions: options }
                          })}
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
                          onChange={(e) => setLoyalty(prev => {
                            const options = [...prev.loyaltyRedeemOptions]
                            options[i] = { ...options[i], rupees: e.target.value }
                            return { ...prev, loyaltyRedeemOptions: options }
                          })}
                          required
                          style={{ flex: 1 }}
                        />
                        <span>Rs.</span>
                        <button
                          type="button"
                          onClick={() => setLoyalty(prev => ({
                            ...prev,
                            loyaltyRedeemOptions: prev.loyaltyRedeemOptions.filter((_, j) => j !== i)
                          }))}
                          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', height: '36px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px' }}
                          title="Remove option"
                        >×</button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setLoyalty(prev => ({
                        ...prev,
                        loyaltyRedeemOptions: [
                          ...prev.loyaltyRedeemOptions,
                          { points: '', rupees: '' }
                        ]
                      }))}
                      style={{ alignSelf: 'flex-start', padding: '5px 14px', fontSize: '0.8rem', borderRadius: '6px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                    >+ Add Option</button>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Define redemption options such as: 100 points = ₹2.5 discount, 120 points = ₹3 discount, etc.
                  </p>
                </div>
              )}
            </div>
          )}

          {loyaltySaved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', marginBottom: '12px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
            }}>
              <CheckCircle size={16} /> Loyalty program settings saved!
            </div>
          )}

          <button type="submit" className="btn btn-primary">
            <Save size={16} /> Save Loyalty Settings
          </button>
        </form>
      </div>

      {/* Section 3.5: Coupon & Promo Codes */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: 'rgba(59,130,246,0.15)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <Tag size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Coupon & Promo Codes</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>Configure discount coupons for your shop checkout.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          {/* List of Coupon Codes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 600 }}>Active Coupons</h3>
            {!promoCodes || promoCodes.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No coupon codes configured.</p>
            ) : (
              <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
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
                      const isValidToday = (!p.startDate || new Date().toISOString().slice(0,10) >= p.startDate) && (!p.endDate || new Date().toISOString().slice(0,10) <= p.endDate)
                      return (
                        <tr key={p.code} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#3b82f6' }}>{p.code}</td>
                          <td style={{ padding: '8px 10px' }}>{p.type === 'percent' ? `${p.value}% Off` : `₹${p.value} Flat`}</td>
                          <td style={{ padding: '8px 10px' }}>₹{p.minAmount || 0}</td>
                          <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: isValidToday ? 'var(--text-secondary)' : '#ef4444' }}>
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
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>Create New Coupon</h3>
            <form onSubmit={handleAddPromo} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Coupon Code (e.g. STU10)</label>
                <input
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                  type="text"
                  placeholder="e.g. STU10"
                  value={newPromo.code}
                  onChange={(e) => setNewPromo(prev => ({ ...prev, code: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Discount Type</label>
                  <select
                    className="form-select"
                    style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                    value={newPromo.type}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="percent">% Percent</option>
                    <option value="flat">₹ Flat Amount</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Discount Value</label>
                  <input
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 10"
                    value={newPromo.value}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, value: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Min Bill Amount (₹)</label>
                <input
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                  type="number"
                  min="0"
                  placeholder="e.g. 150"
                  value={newPromo.minAmount}
                  onChange={(e) => setNewPromo(prev => ({ ...prev, minAmount: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Valid From</label>
                  <input
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                    type="date"
                    value={newPromo.startDate}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Valid To</label>
                  <input
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                    type="date"
                    value={newPromo.endDate}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={newPromo.enabled}
                  onChange={(e) => setNewPromo(prev => ({ ...prev, enabled: e.target.checked }))}
                />
                <span>Enable Coupon Code</span>
              </label>

              <button type="submit" className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '8px 16px', marginTop: '4px', background: '#3b82f6', color: '#fff', border: 'none' }}>
                Add Coupon Code
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Section 4: Invoice Branding & Theme Settings */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <Palette size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Invoice & Receipt Customizer</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>Choose colors, upload a logo, and define custom receipt texts.</p>
          </div>
        </div>

        <form onSubmit={handleBrandingSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Primary Color Theme</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))}
                  style={{ width: '48px', height: '38px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '2px', background: 'none' }}
                />
                <input
                  className="form-input"
                  type="text"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))}
                  placeholder="#0f172a"
                  style={{ flex: 1 }}
                />
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Used for borders, headers, and accents in the receipt and PDF formats.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Shop Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {branding.logoUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={branding.logoUrl} alt="Logo" style={{ maxHeight: '42px', maxWidth: '100px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px' }} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleClearLogo} style={{ color: 'var(--error)' }}>
                      Clear
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    style={{ fontSize: '0.82rem' }}
                  />
                )}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Max size: 200KB. Displayed at the top of A4 Invoice and Receipt PDFs.
              </p>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: '8px' }}>
            <div className="form-group">
              <label className="form-label">Custom Header Notes</label>
              <textarea
                className="form-textarea"
                value={branding.headerNotes}
                onChange={(e) => setBranding((prev) => ({ ...prev, headerNotes: e.target.value }))}
                placeholder="e.g. GST registration details, welcome message..."
                style={{ minHeight: '60px' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Custom Footer Notes</label>
              <textarea
                className="form-textarea"
                value={branding.footerNotes}
                onChange={(e) => setBranding((prev) => ({ ...prev, footerNotes: e.target.value }))}
                placeholder="e.g. Terms & conditions, thank you notes, return policy..."
                style={{ minHeight: '60px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', margin: '8px 0 16px' }}>
            <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={branding.showGstBreakdown}
                onChange={(e) => setBranding((prev) => ({ ...prev, showGstBreakdown: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 600 }}>Show GST Breakdown on Invoice</span>
            </label>
            <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={branding.showUpiQrCode}
                onChange={(e) => setBranding((prev) => ({ ...prev, showUpiQrCode: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 600 }}>Generate UPI QR Code for Due Amounts</span>
            </label>
          </div>

          {brandingSaved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', marginBottom: '12px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
            }}>
              <CheckCircle size={16} /> Theme branding settings saved!
            </div>
          )}

          <button type="submit" className="btn btn-primary">
            <Save size={16} /> Save Theme Settings
          </button>
        </form>
      </div>

      {/* Section 5: App Preferences */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}>
            <Sliders size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>App Preferences</h2>
            <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>Theme, storage, and data management.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Theme</div>
            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              PrintPro uses a fixed premium dark theme optimized for long work sessions.
            </p>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Data Storage</div>
            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              All data is automatically synchronized and securely stored in your Supabase cloud backend.
            </p>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--error)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--error)', marginBottom: '4px' }}>Clear All Data</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                  This permanently erases ALL data: bills, customers, payments, expenses, and settings. This cannot be undone.
                </p>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleClearData}
                >
                  Clear All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
