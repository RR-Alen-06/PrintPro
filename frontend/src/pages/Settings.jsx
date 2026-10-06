import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { Save, CheckCircle, Building2, BarChart3, Sliders, AlertTriangle, ShieldCheck, Gift, Palette, Tag, Trash2, Edit2, Plus, Sparkles, X, Search, Check, Copy } from 'lucide-react'
import { updateLoyaltySettings } from '../api/loyalty'
import { createPromoCode, updatePromoCode, deletePromoCode, bulkGeneratePromoCodes } from '../api/promoCodes'

const Settings = () => {
  const { settings, updateSettings, business, updateBusiness, promoCodes, setPromoCodes, showConfirm, showToast, showAlert } = useAppContext()

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
    loyaltyTiers: Array.isArray(settings.loyaltyTiers)
      ? settings.loyaltyTiers.map(t => ({ ...t }))
      : [],
    loyaltyRedeemOptions: Array.isArray(settings.loyaltyRedeemOptions)
      ? settings.loyaltyRedeemOptions.map(o => ({ ...o }))
      : [],
  })
  const [loyaltySaved, setLoyaltySaved] = useState(false)

  useEffect(() => {
    setLoyalty({
      loyaltyEnabled: settings.loyaltyEnabled !== false,
      loyaltyRedeemEnabled: settings.loyaltyRedeemEnabled !== false,
      loyaltyRedeemRatioPoints: settings.loyaltyRedeemRatioPoints ?? 150,
      loyaltyRedeemRatioRupees: settings.loyaltyRedeemRatioRupees ?? 5,
      loyaltyTiers: Array.isArray(settings.loyaltyTiers)
        ? settings.loyaltyTiers.map(t => ({ ...t }))
        : [],
      loyaltyRedeemOptions: Array.isArray(settings.loyaltyRedeemOptions)
        ? settings.loyaltyRedeemOptions.map(o => ({ ...o }))
        : [],
    })
  }, [
    settings.loyaltyEnabled,
    settings.loyaltyRedeemEnabled,
    settings.loyaltyRedeemRatioPoints,
    settings.loyaltyRedeemRatioRupees,
    settings.loyaltyTiers,
    settings.loyaltyRedeemOptions
  ])

  // Promo / Coupon Codes local state
  const [newPromo, setNewPromo] = useState({
    code: '',
    type: 'percent',
    value: '',
    minAmount: '',
    maxDiscount: '',
    usageLimit: '',
    maxUsesPerCustomer: '1',
    startDate: '',
    endDate: '',
    enabled: true,
  })
  const [editingPromo, setEditingPromo] = useState(null)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkConfig, setBulkConfig] = useState({
    prefix: 'PROMO',
    count: 10,
    type: 'percent',
    value: 10,
    minAmount: '',
    maxDiscount: '',
    usageLimit: 1,
    maxUsesPerCustomer: 1,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  })
  const [bulkResult, setBulkResult] = useState(null)
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [promoSearch, setPromoSearch] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState(null)

  const handleAddPromo = async (e) => {
    e.preventDefault()
    const codeUpper = newPromo.code.trim().toUpperCase()
    if (!codeUpper) {
      if (showAlert) showAlert("Please enter a coupon code.", "error")
      else alert("Please enter a coupon code.")
      return
    }
    const val = Number(newPromo.value)
    if (isNaN(val) || val <= 0) {
      if (showAlert) showAlert("Please enter a valid discount value.", "error")
      else alert("Please enter a valid discount value.")
      return
    }
    if (newPromo.type === 'percent' && val > 100) {
      if (showAlert) showAlert("Percentage discount cannot exceed 100%.", "error")
      else alert("Percentage discount cannot exceed 100%.")
      return
    }
    
    // Check if code already exists
    if (promoCodes?.some(p => p.code === codeUpper)) {
      if (showAlert) showAlert("A coupon with this code already exists.", "error")
      else alert("A coupon with this code already exists.")
      return
    }

    try {
      setPromoLoading(true)
      const payload = {
        code: codeUpper,
        discount_type: newPromo.type,
        discount_value: val,
        min_bill_amount: Number(newPromo.minAmount || 0),
        max_discount: newPromo.type === 'percent' && newPromo.maxDiscount ? Number(newPromo.maxDiscount) : null,
        usage_limit: newPromo.usageLimit ? Number(newPromo.usageLimit) : null,
        max_uses_per_customer: newPromo.maxUsesPerCustomer ? Number(newPromo.maxUsesPerCustomer) : 1,
        valid_from: newPromo.startDate || null,
        valid_until: newPromo.endDate || null,
        is_active: newPromo.enabled !== false,
      }
      const res = await createPromoCode(payload)
      const created = res.data.data
      const newPromoObj = {
        id: created.id,
        code: created.code,
        type: created.discount_type,
        value: Number(created.discount_value),
        minAmount: Number(created.min_bill_amount || 0),
        maxDiscount: created.max_discount !== null ? Number(created.max_discount) : null,
        usageLimit: created.usage_limit !== null ? Number(created.usage_limit) : null,
        maxUsesPerCustomer: created.max_uses_per_customer !== null ? Number(created.max_uses_per_customer) : 1,
        timesUsed: 0,
        startDate: created.valid_from ? (typeof created.valid_from === 'string' ? created.valid_from.slice(0, 10) : new Date(created.valid_from).toISOString().slice(0, 10)) : null,
        endDate: created.valid_until ? (typeof created.valid_until === 'string' ? created.valid_until.slice(0, 10) : new Date(created.valid_until).toISOString().slice(0, 10)) : null,
        enabled: created.is_active !== false,
        isActive: created.is_active !== false,
      }
      setPromoCodes([newPromoObj, ...(promoCodes || [])])
      setNewPromo({
        code: '',
        type: 'percent',
        value: '',
        minAmount: '',
        maxDiscount: '',
        usageLimit: '',
        maxUsesPerCustomer: '1',
        startDate: '',
        endDate: '',
        enabled: true,
      })
      if (showToast) showToast(`Coupon "${codeUpper}" created successfully!`, 'success')
    } catch (err) {
      if (showAlert) showAlert(err.response?.data?.error || 'Failed to create promo code', 'error')
      else alert(err.response?.data?.error || 'Failed to create promo code')
    } finally {
      setPromoLoading(false)
    }
  }

  const handleEditPromoSave = async (e) => {
    e.preventDefault()
    if (!editingPromo) return
    const codeUpper = editingPromo.code.trim().toUpperCase()
    if (!codeUpper) {
      if (showAlert) showAlert("Coupon code cannot be empty.", "error")
      return
    }
    const val = Number(editingPromo.value)
    if (isNaN(val) || val <= 0) {
      if (showAlert) showAlert("Please enter a valid discount value.", "error")
      return
    }
    if (editingPromo.type === 'percent' && val > 100) {
      if (showAlert) showAlert("Percentage discount cannot exceed 100%.", "error")
      return
    }

    try {
      setPromoLoading(true)
      const payload = {
        code: codeUpper,
        discount_type: editingPromo.type,
        discount_value: val,
        min_bill_amount: Number(editingPromo.minAmount || 0),
        max_discount: editingPromo.type === 'percent' && editingPromo.maxDiscount ? Number(editingPromo.maxDiscount) : null,
        usage_limit: editingPromo.usageLimit ? Number(editingPromo.usageLimit) : null,
        max_uses_per_customer: editingPromo.maxUsesPerCustomer ? Number(editingPromo.maxUsesPerCustomer) : 1,
        valid_from: editingPromo.startDate || null,
        valid_until: editingPromo.endDate || null,
        is_active: editingPromo.enabled !== false,
      }
      const res = await updatePromoCode(editingPromo.id, payload)
      const updated = res.data.data
      const updatedObj = {
        id: updated.id,
        code: updated.code,
        type: updated.discount_type,
        value: Number(updated.discount_value),
        minAmount: Number(updated.min_bill_amount || 0),
        maxDiscount: updated.max_discount !== null ? Number(updated.max_discount) : null,
        usageLimit: updated.usage_limit !== null ? Number(updated.usage_limit) : null,
        maxUsesPerCustomer: updated.max_uses_per_customer !== null ? Number(updated.max_uses_per_customer) : 1,
        timesUsed: Number(updated.used_count || editingPromo.timesUsed || 0),
        startDate: updated.valid_from ? (typeof updated.valid_from === 'string' ? updated.valid_from.slice(0, 10) : new Date(updated.valid_from).toISOString().slice(0, 10)) : null,
        endDate: updated.valid_until ? (typeof updated.valid_until === 'string' ? updated.valid_until.slice(0, 10) : new Date(updated.valid_until).toISOString().slice(0, 10)) : null,
        enabled: updated.is_active !== false,
        isActive: updated.is_active !== false,
      }
      setPromoCodes((promoCodes || []).map(p => (p.id === editingPromo.id || p.code === editingPromo.code) ? updatedObj : p))
      setEditingPromo(null)
      if (showToast) showToast(`Coupon "${codeUpper}" updated successfully!`, 'success')
    } catch (err) {
      if (showAlert) showAlert(err.response?.data?.error || 'Failed to update promo code', 'error')
    } finally {
      setPromoLoading(false)
    }
  }

  const handleDeletePromo = (promo) => {
    const doDelete = async () => {
      try {
        if (promo.id) {
          await deletePromoCode(promo.id)
        }
        setPromoCodes((promoCodes || []).filter(p => p.id !== promo.id && p.code !== promo.code))
        if (showToast) showToast(`Coupon "${promo.code}" deleted successfully`, 'success')
      } catch (err) {
        if (showAlert) showAlert(err.response?.data?.error || 'Failed to delete promo code', 'error')
      }
    }

    if (showConfirm) {
      showConfirm({
        title: 'Delete Promo Code',
        message: `Are you sure you want to delete coupon code "${promo.code}"? This cannot be undone.`,
        confirmText: 'Delete',
        type: 'error',
        onConfirm: doDelete
      })
    } else if (window.confirm(`Are you sure you want to delete coupon "${promo.code}"?`)) {
      doDelete()
    }
  }

  const handleTogglePromoEnabled = async (promo) => {
    const newStatus = promo.enabled !== false ? false : true
    setPromoCodes((promoCodes || []).map(p => 
      (p.id === promo.id || p.code === promo.code) ? { ...p, enabled: newStatus, isActive: newStatus } : p
    ))
    try {
      if (promo.id) {
        await updatePromoCode(promo.id, { is_active: newStatus })
      }
      if (showToast) showToast(`Coupon "${promo.code}" ${newStatus ? 'enabled' : 'disabled'}`, 'info')
    } catch (err) {
      console.error('Failed to toggle promo status', err)
      setPromoCodes((promoCodes || []).map(p => 
        (p.id === promo.id || p.code === promo.code) ? { ...p, enabled: !newStatus, isActive: !newStatus } : p
      ))
      if (showAlert) showAlert('Failed to update promo status.', 'error')
    }
  }

  const handleBulkGenerate = async (e) => {
    e.preventDefault()
    const count = Number(bulkConfig.count || 5)
    if (count <= 0 || count > 100) {
      if (showAlert) showAlert("Please enter a count between 1 and 100.", "error")
      return
    }
    const val = Number(bulkConfig.value)
    if (isNaN(val) || val <= 0) {
      if (showAlert) showAlert("Please enter a valid discount value.", "error")
      return
    }
    if (bulkConfig.type === 'percent' && val > 100) {
      if (showAlert) showAlert("Percentage discount cannot exceed 100%.", "error")
      return
    }

    try {
      setIsBulkLoading(true)
      const payload = {
        count,
        prefix: (bulkConfig.prefix || 'PROMO').trim().toUpperCase(),
        discount_type: bulkConfig.type,
        discount_value: val,
        min_bill_amount: Number(bulkConfig.minAmount || 0),
        max_discount: bulkConfig.type === 'percent' && bulkConfig.maxDiscount ? Number(bulkConfig.maxDiscount) : null,
        usage_limit: bulkConfig.usageLimit ? Number(bulkConfig.usageLimit) : 1,
        max_uses_per_customer: bulkConfig.maxUsesPerCustomer ? Number(bulkConfig.maxUsesPerCustomer) : 1,
        valid_from: bulkConfig.startDate || null,
        valid_until: bulkConfig.endDate || null,
        is_active: true,
      }
      const res = await bulkGeneratePromoCodes(payload)
      const createdList = res.data.data || []
      const mappedCreated = createdList.map(c => ({
        id: c.id,
        code: c.code,
        type: c.discount_type,
        value: Number(c.discount_value),
        minAmount: Number(c.min_bill_amount || 0),
        maxDiscount: c.max_discount !== null ? Number(c.max_discount) : null,
        usageLimit: c.usage_limit !== null ? Number(c.usage_limit) : null,
        maxUsesPerCustomer: c.max_uses_per_customer !== null ? Number(c.max_uses_per_customer) : 1,
        timesUsed: 0,
        startDate: c.valid_from ? (typeof c.valid_from === 'string' ? c.valid_from.slice(0, 10) : new Date(c.valid_from).toISOString().slice(0, 10)) : null,
        endDate: c.valid_until ? (typeof c.valid_until === 'string' ? c.valid_until.slice(0, 10) : new Date(c.valid_until).toISOString().slice(0, 10)) : null,
        enabled: c.is_active !== false,
        isActive: c.is_active !== false,
      }))
      setPromoCodes([...mappedCreated, ...(promoCodes || [])])
      setBulkResult(mappedCreated)
      if (showToast) showToast(`Successfully generated ${mappedCreated.length} promo codes!`, 'success')
    } catch (err) {
      if (showAlert) showAlert(err.response?.data?.error || 'Failed to bulk generate promo codes', 'error')
    } finally {
      setIsBulkLoading(false)
    }
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

  const handleLoyaltySave = async (e) => {
    e.preventDefault()
    const cleanTiers = loyalty.loyaltyTiers.map(t => ({
      from: Number(t.from),
      to: Number(t.to),
      points: Number(t.points),
    })).filter(t => t.from >= 0 && t.to >= t.from && t.points > 0)

    const cleanRedeem = loyalty.loyaltyRedeemOptions.map(o => ({
      points: Number(o.points),
      rupees: Number(o.rupees),
    })).filter(o => o.points > 0 && o.rupees > 0).sort((a, b) => a.points - b.points)

    const payload = {
      points_per_rupee: Number(loyalty.loyaltyRedeemRatioPoints ? (1 / (loyalty.loyaltyRedeemRatioPoints / loyalty.loyaltyRedeemRatioRupees)) : 1),
      rupee_per_point: Number(loyalty.loyaltyRedeemRatioRupees / loyalty.loyaltyRedeemRatioPoints),
      min_points_redeem: Number(loyalty.loyaltyRedeemRatioPoints),
      tier_config: cleanTiers,
      redeem_options: cleanRedeem,
      is_enabled: loyalty.loyaltyEnabled,
    }

    try {
      await updateLoyaltySettings(payload)
    } catch (err) {
      console.warn('Backend loyalty update queued or offline:', err)
    }

    updateSettings({
      loyaltyEnabled: loyalty.loyaltyEnabled,
      loyaltyRedeemEnabled: loyalty.loyaltyRedeemEnabled,
      loyaltyRedeemRatioPoints: Number(loyalty.loyaltyRedeemRatioPoints),
      loyaltyRedeemRatioRupees: Number(loyalty.loyaltyRedeemRatioRupees),
      loyaltyTiers: cleanTiers,
      loyaltyRedeemOptions: cleanRedeem,
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
                  {loyalty.loyaltyTiers.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 8px 0', fontStyle: 'italic' }}>
                      No points earning tiers configured. Click "+ Add Tier" to define custom spending ranges.
                    </p>
                  ) : (
                    loyalty.loyaltyTiers.map((tier, i) => (
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
                    ))
                  )}
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
                    {loyalty.loyaltyRedeemOptions.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 8px 0', fontStyle: 'italic' }}>
                        No redemption options configured. Click "+ Add Option" to define custom points redemption rates.
                      </p>
                    ) : (
                      loyalty.loyaltyRedeemOptions.map((opt, i) => (
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
                      ))
                    )}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: 'rgba(59,130,246,0.15)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <Tag size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Coupon & Promo Codes</h2>
              <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>Configure cloud-synced discount coupons with usage limits and per-customer rules.</p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setBulkResult(null)
              setShowBulkModal(true)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 14px', background: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)', color: '#60a5fa' }}
          >
            <Sparkles size={15} /> Bulk Generate Codes
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', alignItems: 'start' }}>
          {/* List of Coupon Codes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
                Coupons {promoCodes?.length ? `(${promoCodes.length})` : ''}
              </h3>
              <div style={{ position: 'relative', width: '180px' }}>
                <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search code..."
                  value={promoSearch}
                  onChange={(e) => setPromoSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 8px 4px 26px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)',
                    color: '#fff',
                  }}
                />
              </div>
            </div>

            {(!promoCodes || promoCodes.length === 0) ? (
              <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Tag size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No coupon codes configured yet.</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Create your first coupon or use Bulk Generate.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 10px' }}>Code</th>
                      <th style={{ padding: '8px 10px' }}>Discount</th>
                      <th style={{ padding: '8px 10px' }}>Limits & Min</th>
                      <th style={{ padding: '8px 10px' }}>Validity</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Active</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promoCodes
                      .filter(p => !promoSearch || p.code.toLowerCase().includes(promoSearch.toLowerCase()))
                      .map((p) => {
                        const todayStr = new Date().toISOString().slice(0, 10)
                        const isExpired = p.endDate && todayStr > p.endDate
                        const isUpcoming = p.startDate && todayStr < p.startDate
                        const isCopied = copiedCode === p.code

                        return (
                          <tr key={p.id || p.code} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: p.enabled !== false ? 1 : 0.6 }}>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  onClick={() => {
                                    navigator.clipboard?.writeText(p.code)
                                    setCopiedCode(p.code)
                                    setTimeout(() => setCopiedCode(null), 2000)
                                  }}
                                  style={{
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontFamily: 'monospace',
                                    color: '#60a5fa',
                                    background: 'rgba(59,130,246,0.1)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(59,130,246,0.2)',
                                  }}
                                  title="Click to copy code"
                                >
                                  {p.code}
                                </span>
                                {isCopied ? <Check size={12} color="#10b981" /> : <Copy size={11} style={{ opacity: 0.4, cursor: 'pointer' }} onClick={() => { navigator.clipboard?.writeText(p.code); setCopiedCode(p.code); setTimeout(() => setCopiedCode(null), 2000) }} />}
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: 600, color: '#fff' }}>
                                {p.type === 'percent' ? `${p.value}% Off` : `₹${p.value} Flat`}
                              </div>
                              {p.type === 'percent' && p.maxDiscount && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cap: ₹{p.maxDiscount}</div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              <div>Min: ₹{p.minAmount || 0}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                Used: {p.timesUsed || 0} {p.usageLimit ? `/ ${p.usageLimit}` : '(no limit)'}
                              </div>
                              {p.maxUsesPerCustomer && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                  Max/Cust: {p.maxUsesPerCustomer}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', fontSize: '0.75rem' }}>
                              {isExpired ? (
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>Expired ({p.endDate})</span>
                              ) : isUpcoming ? (
                                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Starts {p.startDate}</span>
                              ) : p.startDate || p.endDate ? (
                                <span style={{ color: '#10b981' }}>Valid to {p.endDate || '∞'}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Always valid</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={p.enabled !== false}
                                onChange={() => handleTogglePromoEnabled(p)}
                                style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
                                title={p.enabled !== false ? 'Click to disable' : 'Click to enable'}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => setEditingPromo({ ...p })}
                                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '3px' }}
                                  title="Edit Coupon"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePromo(p)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '3px' }}
                                  title="Delete Coupon"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
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
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={15} color="#3b82f6" /> Create Single Coupon
            </h3>
            <form onSubmit={handleAddPromo} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Coupon Code</label>
                <input
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 8px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                  type="text"
                  placeholder="e.g. SUMMER20"
                  value={newPromo.code}
                  onChange={(e) => setNewPromo(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
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
                    step="any"
                    placeholder={newPromo.type === 'percent' ? "10%" : "50"}
                    value={newPromo.value}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, value: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Min Bill Amount (₹)</label>
                  <input
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newPromo.minAmount}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, minAmount: e.target.value }))}
                  />
                </div>
                {newPromo.type === 'percent' ? (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Max Discount Cap (₹)</label>
                    <input
                      className="form-input"
                      style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                      type="number"
                      min="1"
                      placeholder="Optional"
                      value={newPromo.maxDiscount}
                      onChange={(e) => setNewPromo(prev => ({ ...prev, maxDiscount: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Total Usage Limit</label>
                    <input
                      className="form-input"
                      style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={newPromo.usageLimit}
                      onChange={(e) => setNewPromo(prev => ({ ...prev, usageLimit: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Per-Customer Limit</label>
                  <input
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                    type="number"
                    min="1"
                    placeholder="1"
                    value={newPromo.maxUsesPerCustomer}
                    onChange={(e) => setNewPromo(prev => ({ ...prev, maxUsesPerCustomer: e.target.value }))}
                  />
                </div>
                {newPromo.type === 'percent' && (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Total Usage Limit</label>
                    <input
                      className="form-input"
                      style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={newPromo.usageLimit}
                      onChange={(e) => setNewPromo(prev => ({ ...prev, usageLimit: e.target.value }))}
                    />
                  </div>
                )}
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
                <span>Enable this coupon immediately</span>
              </label>

              <button
                type="submit"
                disabled={promoLoading}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 16px', marginTop: '4px', background: '#3b82f6', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Plus size={14} /> {promoLoading ? 'Creating...' : 'Create Coupon Code'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Edit Promo Modal */}
      {editingPromo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: '#18181b',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={16} color="#3b82f6" /> Edit Coupon "{editingPromo.code}"
              </h3>
              <button
                type="button"
                onClick={() => setEditingPromo(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditPromoSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Coupon Code</label>
                <input
                  className="form-input"
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                  type="text"
                  value={editingPromo.code}
                  onChange={(e) => setEditingPromo(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Discount Type</label>
                  <select
                    className="form-select"
                    value={editingPromo.type}
                    onChange={(e) => setEditingPromo(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="percent">% Percent</option>
                    <option value="flat">₹ Flat Amount</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Discount Value</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0.01"
                    step="any"
                    value={editingPromo.value}
                    onChange={(e) => setEditingPromo(prev => ({ ...prev, value: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Min Bill Amount (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={editingPromo.minAmount || ''}
                    onChange={(e) => setEditingPromo(prev => ({ ...prev, minAmount: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Max Discount Cap (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    placeholder="None"
                    value={editingPromo.maxDiscount || ''}
                    onChange={(e) => setEditingPromo(prev => ({ ...prev, maxDiscount: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Total Usage Limit</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={editingPromo.usageLimit || ''}
                    onChange={(e) => setEditingPromo(prev => ({ ...prev, usageLimit: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Per-Customer Limit</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={editingPromo.maxUsesPerCustomer || 1}
                    onChange={(e) => setEditingPromo(prev => ({ ...prev, maxUsesPerCustomer: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Valid From</label>
                  <input
                    className="form-input"
                    type="date"
                    value={editingPromo.startDate || ''}
                    onChange={(e) => setEditingPromo(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Valid To</label>
                  <input
                    className="form-input"
                    type="date"
                    value={editingPromo.endDate || ''}
                    onChange={(e) => setEditingPromo(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={editingPromo.enabled !== false}
                  onChange={(e) => setEditingPromo(prev => ({ ...prev, enabled: e.target.checked }))}
                />
                <span>Active & enabled</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingPromo(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={promoLoading}
                  className="btn btn-primary"
                  style={{ background: '#3b82f6', border: 'none' }}
                >
                  {promoLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Generate Modal */}
      {showBulkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: '#18181b',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#60a5fa" /> Bulk Generate Promo Codes
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(false)
                  setBulkResult(null)
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {bulkResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(16,185,129,0.15)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: '8px',
                  color: '#10b981',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle size={16} /> Successfully generated {bulkResult.length} unique promo codes!
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Generated Codes:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allCodes = bulkResult.map(c => c.code).join('\n')
                        navigator.clipboard?.writeText(allCodes)
                        if (showToast) showToast('All codes copied to clipboard!', 'success')
                      }}
                      style={{ fontSize: '0.75rem', color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Copy size={12} /> Copy All
                    </button>
                  </div>
                  <div style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px'
                  }}>
                    {bulkResult.map(c => (
                      <div key={c.id || c.code} style={{ color: '#60a5fa' }}>{c.code}</div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setBulkResult(null)}
                  >
                    Generate More
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setShowBulkModal(false)
                      setBulkResult(null)
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBulkGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Code Prefix</label>
                    <input
                      className="form-input"
                      style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                      type="text"
                      placeholder="e.g. FESTIVE"
                      value={bulkConfig.prefix}
                      onChange={(e) => setBulkConfig(prev => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Quantity (N Codes)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      max="100"
                      value={bulkConfig.count}
                      onChange={(e) => setBulkConfig(prev => ({ ...prev, count: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Discount Type</label>
                    <select
                      className="form-select"
                      value={bulkConfig.type}
                      onChange={(e) => setBulkConfig(prev => ({ ...prev, type: e.target.value }))}
                    >
                      <option value="percent">% Percent</option>
                      <option value="flat">₹ Flat Amount</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Discount Value</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder={bulkConfig.type === 'percent' ? "10%" : "50"}
                      value={bulkConfig.value}
                      onChange={(e) => setBulkConfig(prev => ({ ...prev, value: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Min Bill Amount (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={bulkConfig.minAmount}
                      onChange={(e) => setBulkConfig(prev => ({ ...prev, minAmount: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Max Discount Cap (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      placeholder="Optional"
                      value={bulkConfig.maxDiscount}
                      onChange={(e) => setBulkConfig(prev => ({ ...prev, maxDiscount: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Usage Limit Per Code</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      placeholder="1 (Single Use)"
                      value={bulkConfig.usageLimit}
                      onChange={(e) => setBulkConfig(prev => ({ ...prev, usageLimit: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Max Uses Per Customer</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      value={bulkConfig.maxUsesPerCustomer}
                      onChange={(e) => setBulkConfig(prev => ({ ...prev, maxUsesPerCustomer: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Valid From</label>
                    <input
                      className="form-input"
                      type="date"
                      value={bulkConfig.startDate}
                      onChange={(e) => setBulkConfig(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Valid To</label>
                    <input
                      className="form-input"
                      type="date"
                      value={bulkConfig.endDate}
                      onChange={(e) => setBulkConfig(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
                  Sample code format: <code>{bulkConfig.prefix || 'PROMO'}-A1B2-01</code>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowBulkModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBulkLoading}
                    className="btn btn-primary"
                    style={{ background: '#3b82f6', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Sparkles size={14} /> {isBulkLoading ? 'Generating...' : `Generate ${bulkConfig.count || 5} Codes`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
