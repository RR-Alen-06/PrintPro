import React, { useState, useEffect, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  Gift,
  Sparkles,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Check,
  Calendar,
  Users,
  Award,
  History,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Sliders,
  Tag
} from 'lucide-react'
import EmptyState from '../components/common/EmptyState'
import {
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  bulkGeneratePromoCodes
} from '../api/promoCodes'
import {
  updateLoyaltySettings,
  getCustomerLoyalty,
  adjustCustomerLoyalty
} from '../api/loyalty'
import { getDisplayCustomerId } from '../utils/idFormatter'

const DEFAULT_PROMO_FORM = {
  code: '',
  type: 'percent',
  value: '',
  minAmount: '',
  maxDiscount: '',
  usageLimit: '',
  maxUsesPerCustomer: '1',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  enabled: true
}

const PromosAndLoyalty = () => {
  const {
    promoCodes = [],
    setPromoCodes,
    customers = [],
    settings = {},
    updateSettings,
    updateCustomer,
    showToast,
    showAlert,
    showConfirm
  } = useAppContext()

  const [activeTab, setActiveTab] = useState('promos') // 'promos' | 'loyalty'

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 1: PROMO CODES MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════
  const [promoSearch, setPromoSearch] = useState('')
  const [promoFilter, setPromoFilter] = useState('all') // 'all' | 'active' | 'expired' | 'disabled'
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState(null)
  const [promoForm, setPromoForm] = useState(DEFAULT_PROMO_FORM)
  const [promoLoading, setPromoLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState('')

  // Bulk Generator Modal State
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkPrefix, setBulkPrefix] = useState('PROMO')
  const [bulkCount, setBulkCount] = useState('5')
  const [bulkType, setBulkType] = useState('percent')
  const [bulkValue, setBulkValue] = useState('10')
  const [bulkMinAmount, setBulkMinAmount] = useState('100')
  const [bulkEndDate, setBulkEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  )

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const evaluatedPromos = useMemo(() => {
    return (promoCodes || []).map(p => {
      const isExpired = p.endDate ? todayStr > p.endDate : false
      const isDisabled = p.enabled === false
      const isActive = !isExpired && !isDisabled
      return {
        ...p,
        isExpired,
        isDisabled,
        isActive
      }
    })
  }, [promoCodes, todayStr])

  const filteredPromos = useMemo(() => {
    return evaluatedPromos.filter(p => {
      const q = promoSearch.trim().toLowerCase()
      const matchesSearch = !q || p.code.toLowerCase().includes(q)
      if (!matchesSearch) return false

      if (promoFilter === 'active') return p.isActive
      if (promoFilter === 'expired') return p.isExpired
      if (promoFilter === 'disabled') return p.isDisabled
      return true
    })
  }, [evaluatedPromos, promoSearch, promoFilter])

  const promoStats = useMemo(() => {
    const total = evaluatedPromos.length
    const active = evaluatedPromos.filter(p => p.isActive).length
    const expired = evaluatedPromos.filter(p => p.isExpired).length
    const totalUsed = evaluatedPromos.reduce((s, p) => s + Number(p.timesUsed || 0), 0)
    return { total, active, expired, totalUsed }
  }, [evaluatedPromos])

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    showToast?.(`Copied coupon "${code}" to clipboard!`, 'info')
    setTimeout(() => setCopiedCode(''), 2500)
  }

  const openCreatePromoModal = () => {
    setEditingPromo(null)
    setPromoForm({
      ...DEFAULT_PROMO_FORM,
      startDate: todayStr,
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    })
    setShowPromoModal(true)
  }

  const openEditPromoModal = (promo) => {
    setEditingPromo(promo)
    setPromoForm({
      code: promo.code,
      type: promo.type || 'percent',
      value: String(promo.value || ''),
      minAmount: String(promo.minAmount || ''),
      maxDiscount: promo.maxDiscount !== null ? String(promo.maxDiscount) : '',
      usageLimit: promo.usageLimit !== null ? String(promo.usageLimit) : '',
      maxUsesPerCustomer: String(promo.maxUsesPerCustomer || '1'),
      startDate: promo.startDate || todayStr,
      endDate: promo.endDate || '',
      enabled: promo.enabled !== false
    })
    setShowPromoModal(true)
  }

  const handleSavePromo = async (e) => {
    e.preventDefault()
    const codeUpper = promoForm.code.trim().toUpperCase()
    if (!codeUpper) {
      showAlert('Please enter a coupon code.', 'error')
      return
    }
    const val = Number(promoForm.value)
    if (isNaN(val) || val <= 0) {
      showAlert('Please enter a valid positive discount value.', 'error')
      return
    }
    if (promoForm.type === 'percent' && val > 100) {
      showAlert('Percentage discount cannot exceed 100%.', 'error')
      return
    }
    if (!promoForm.endDate) {
      showAlert('Expiry Date is required for all coupon codes.', 'error')
      return
    }

    // Check duplicate code if creating or changing code
    const isDup = promoCodes.some(
      p => p.code === codeUpper && (!editingPromo || editingPromo.id !== p.id)
    )
    if (isDup) {
      showAlert(`A coupon with code "${codeUpper}" already exists.`, 'error')
      return
    }

    setPromoLoading(true)
    try {
      const payload = {
        code: codeUpper,
        discount_type: promoForm.type,
        discount_value: val,
        min_bill_amount: Number(promoForm.minAmount || 0),
        max_discount: promoForm.type === 'percent' && promoForm.maxDiscount ? Number(promoForm.maxDiscount) : null,
        usage_limit: promoForm.usageLimit ? Number(promoForm.usageLimit) : null,
        max_uses_per_customer: promoForm.maxUsesPerCustomer ? Number(promoForm.maxUsesPerCustomer) : 1,
        valid_from: promoForm.startDate || null,
        valid_until: promoForm.endDate || null,
        is_active: promoForm.enabled !== false
      }

      if (editingPromo) {
        await updatePromoCode(editingPromo.id, payload)
        const updatedObj = {
          ...editingPromo,
          code: codeUpper,
          type: promoForm.type,
          value: val,
          minAmount: Number(promoForm.minAmount || 0),
          maxDiscount: payload.max_discount,
          usageLimit: payload.usage_limit,
          maxUsesPerCustomer: payload.max_uses_per_customer,
          startDate: promoForm.startDate,
          endDate: promoForm.endDate,
          enabled: promoForm.enabled !== false,
          isActive: promoForm.enabled !== false
        }
        setPromoCodes(promoCodes.map(p => (p.id === editingPromo.id ? updatedObj : p)))
        showToast?.(`Coupon "${codeUpper}" updated successfully!`, 'success')
      } else {
        const res = await createPromoCode(payload)
        const created = res.data.data
        const newObj = {
          id: created.id,
          code: created.code,
          type: created.discount_type,
          value: Number(created.discount_value),
          minAmount: Number(created.min_bill_amount || 0),
          maxDiscount: created.max_discount !== null ? Number(created.max_discount) : null,
          usageLimit: created.usage_limit !== null ? Number(created.usage_limit) : null,
          maxUsesPerCustomer: created.max_uses_per_customer !== null ? Number(created.max_uses_per_customer) : 1,
          timesUsed: 0,
          startDate: promoForm.startDate,
          endDate: promoForm.endDate,
          enabled: created.is_active !== false,
          isActive: created.is_active !== false
        }
        setPromoCodes([newObj, ...(promoCodes || [])])
        showToast?.(`Coupon "${codeUpper}" created successfully!`, 'success')
      }
      setShowPromoModal(false)
    } catch (err) {
      console.error('Failed to save promo code:', err)
      showAlert(err.response?.data?.error || 'Failed to save promo code', 'error')
    } finally {
      setPromoLoading(false)
    }
  }

  const handleTogglePromo = async (promo) => {
    const nextState = !(promo.enabled !== false)
    try {
      await updatePromoCode(promo.id, { is_active: nextState })
      setPromoCodes(promoCodes.map(p => (p.id === promo.id ? { ...p, enabled: nextState, isActive: nextState } : p)))
      showToast?.(`Coupon ${promo.code} ${nextState ? 'enabled' : 'disabled'}`, 'info')
    } catch (err) {
      console.error('Failed to toggle promo:', err)
      showAlert('Failed to update promo status', 'error')
    }
  }

  const handleDeletePromo = (promo) => {
    showConfirm({
      title: 'Delete Coupon Code',
      message: `Are you sure you want to delete coupon code "${promo.code}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deletePromoCode(promo.id)
          setPromoCodes(promoCodes.filter(p => p.id !== promo.id))
          showToast?.(`Coupon "${promo.code}" deleted`, 'info')
        } catch (err) {
          console.error('Failed to delete promo:', err)
          showAlert('Failed to delete coupon code', 'error')
        }
      }
    })
  }

  const handleBulkGenerate = async (e) => {
    e.preventDefault()
    const count = parseInt(bulkCount, 10)
    const val = parseFloat(bulkValue)
    if (isNaN(count) || count < 1 || count > 50) {
      showAlert('Please enter a count between 1 and 50 coupons.', 'error')
      return
    }
    if (isNaN(val) || val <= 0) {
      showAlert('Please enter a valid positive discount value.', 'error')
      return
    }
    if (!bulkEndDate) {
      showAlert('Expiry Date is required for bulk coupon generation.', 'error')
      return
    }

    setPromoLoading(true)
    try {
      const res = await bulkGeneratePromoCodes({
        prefix: bulkPrefix.trim().toUpperCase() || 'PROMO',
        count,
        discount_type: bulkType,
        discount_value: val,
        min_bill_amount: parseFloat(bulkMinAmount) || 0,
        valid_until: bulkEndDate,
        usage_limit: 1,
        max_uses_per_customer: 1
      })
      const created = res.data.data || []
      const mapped = created.map(c => ({
        id: c.id,
        code: c.code,
        type: c.discount_type,
        value: Number(c.discount_value),
        minAmount: Number(c.min_bill_amount || 0),
        maxDiscount: null,
        usageLimit: 1,
        maxUsesPerCustomer: 1,
        timesUsed: 0,
        startDate: todayStr,
        endDate: bulkEndDate,
        enabled: true,
        isActive: true
      }))
      setPromoCodes([...mapped, ...(promoCodes || [])])
      setShowBulkModal(false)
      showToast?.(`Generated ${created.length} promotional coupons!`, 'success')
    } catch (err) {
      console.error('Failed bulk generate:', err)
      showAlert(err.response?.data?.error || 'Failed to bulk generate coupons', 'error')
    } finally {
      setPromoLoading(false)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 2: LOYALTY PROGRAM & CUSTOMER DIRECTORY
  // ══════════════════════════════════════════════════════════════════════════
  const [loyaltySubTab, setLoyaltySubTab] = useState('customers') // 'customers' | 'settings'
  const [loyaltySearch, setLoyaltySearch] = useState('')
  const [loyaltyFilter, setLoyaltyFilter] = useState('all') // 'all' | 'with_points' | 'zero'

  // Adjustment Modal State
  const [selectedCustomerForAdjust, setSelectedCustomerForAdjust] = useState(null)
  const [adjustOp, setAdjustOp] = useState('add') // 'add' | 'deduct'
  const [adjustPointsVal, setAdjustPointsVal] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)

  // Audit Trail Drawer State
  const [auditCustomer, setAuditCustomer] = useState(null)
  const [auditEvents, setAuditEvents] = useState([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Program Settings Form State
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(settings.loyaltyEnabled !== false)
  const [pointsPerHundred, setPointsPerHundred] = useState(settings.loyaltyPointsPerHundred || 1)
  const [minSpendToEarn, setMinSpendToEarn] = useState(settings.loyaltyMinSpend || 50)
  const [redeemPoints, setRedeemPoints] = useState(settings.loyaltyRedeemRatioPoints || 150)
  const [redeemRupees, setRedeemRupees] = useState(settings.loyaltyRedeemRatioRupees || 5)
  const [savingLoyaltySettings, setSavingLoyaltySettings] = useState(false)

  useEffect(() => {
    if (settings.loyaltyEnabled !== undefined) setLoyaltyEnabled(settings.loyaltyEnabled !== false)
    if (settings.loyaltyPointsPerHundred !== undefined) setPointsPerHundred(settings.loyaltyPointsPerHundred)
    if (settings.loyaltyMinSpend !== undefined) setMinSpendToEarn(settings.loyaltyMinSpend)
    if (settings.loyaltyRedeemRatioPoints !== undefined) setRedeemPoints(settings.loyaltyRedeemRatioPoints)
    if (settings.loyaltyRedeemRatioRupees !== undefined) setRedeemRupees(settings.loyaltyRedeemRatioRupees)
  }, [settings])

  const activeRegularCustomers = useMemo(() => {
    return customers.filter(c => !c.deleted && c.type === 'regular')
  }, [customers])

  const filteredLoyaltyCustomers = useMemo(() => {
    return activeRegularCustomers.filter(c => {
      const q = loyaltySearch.trim().toLowerCase()
      const displayId = getDisplayCustomerId(c).toLowerCase()
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        displayId.includes(q)
      if (!matchesSearch) return false

      const pts = Number(c.loyaltyPoints || 0)
      if (loyaltyFilter === 'with_points') return pts > 0
      if (loyaltyFilter === 'zero') return pts === 0
      return true
    })
  }, [activeRegularCustomers, loyaltySearch, loyaltyFilter])

  const loyaltyStats = useMemo(() => {
    const totalCustomers = activeRegularCustomers.length
    const withPoints = activeRegularCustomers.filter(c => Number(c.loyaltyPoints || 0) > 0).length
    const totalPointsCirculating = activeRegularCustomers.reduce((s, c) => s + Number(c.loyaltyPoints || 0), 0)
    const totalValue = (totalPointsCirculating * Number(redeemRupees || 5)) / Number(redeemPoints || 150)
    return { totalCustomers, withPoints, totalPointsCirculating, totalValue }
  }, [activeRegularCustomers, redeemPoints, redeemRupees])

  const handleSaveLoyaltySettings = async (e) => {
    e.preventDefault()
    setSavingLoyaltySettings(true)
    try {
      const payload = {
        loyaltyEnabled,
        loyaltyPointsPerHundred: Number(pointsPerHundred),
        loyaltyMinSpend: Number(minSpendToEarn),
        loyaltyRedeemRatioPoints: Number(redeemPoints),
        loyaltyRedeemRatioRupees: Number(redeemRupees)
      }
      await updateLoyaltySettings(payload)
      updateSettings(payload)
      showToast?.('Loyalty program settings updated successfully!', 'success')
    } catch (err) {
      console.error('Failed to save loyalty settings:', err)
      showAlert('Failed to save loyalty program settings', 'error')
    } finally {
      setSavingLoyaltySettings(false)
    }
  }

  const openAdjustPointsModal = (customer) => {
    setSelectedCustomerForAdjust(customer)
    setAdjustOp('add')
    setAdjustPointsVal('')
    setAdjustNotes('')
  }

  const handleConfirmPointsAdjustment = async (e) => {
    e.preventDefault()
    if (!selectedCustomerForAdjust) return
    const pts = parseInt(adjustPointsVal, 10)
    if (isNaN(pts) || pts <= 0) {
      showAlert('Please enter a valid positive number of points.', 'error')
      return
    }
    if (!adjustNotes.trim()) {
      showAlert('A reason / note is required for points adjustments.', 'error')
      return
    }

    setIsAdjusting(true)
    try {
      const delta = adjustOp === 'add' ? pts : -pts
      const currentPts = Number(selectedCustomerForAdjust.loyaltyPoints || 0)
      if (adjustOp === 'deduct' && pts > currentPts) {
        showAlert(`Cannot deduct ${pts} points. Customer only has ${currentPts} points available.`, 'error')
        setIsAdjusting(false)
        return
      }

      await adjustCustomerLoyalty(selectedCustomerForAdjust.id, {
        points: delta,
        eventType: adjustOp === 'add' ? 'manual_credit' : 'manual_debit',
        notes: adjustNotes.trim()
      })

      // Update customer in state
      const newBalance = Math.max(0, currentPts + delta)
      if (updateCustomer) {
        updateCustomer(selectedCustomerForAdjust.id, { loyaltyPoints: newBalance })
      }

      showToast?.(
        `${adjustOp === 'add' ? 'Added' : 'Deducted'} ${pts} points for ${selectedCustomerForAdjust.name}!`,
        'success'
      )
      setSelectedCustomerForAdjust(null)
    } catch (err) {
      console.error('Failed points adjustment:', err)
      showAlert(err.response?.data?.error || 'Failed to adjust loyalty points', 'error')
    } finally {
      setIsAdjusting(false)
    }
  }

  const openAuditHistory = async (customer) => {
    setAuditCustomer(customer)
    setLoadingAudit(true)
    try {
      const res = await getCustomerLoyalty(customer.id)
      setAuditEvents(res.data?.data?.events || [])
    } catch (err) {
      console.error('Failed to load loyalty audit history:', err)
      setAuditEvents([])
    } finally {
      setLoadingAudit(false)
    }
  }

  return (
    <div className="promos-loyalty-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Gift size={28} color="var(--accent)" />
            <span>Promos & Loyalty Hub</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Drive repeat orders with expiration-tracked discount coupons and reward tiers.
          </p>
        </div>

        {/* Top-Level Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('promos')}
            style={{
              padding: '8px 18px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'promos' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'promos' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Tag size={15} />
            <span>Promo Codes ({promoStats.total})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('loyalty')}
            style={{
              padding: '8px 18px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'loyalty' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'loyalty' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Award size={15} />
            <span>Loyalty Program</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PROMO CODES */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'promos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Coupons</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{promoStats.active}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Valid & ready for checkout</div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Expired Coupons</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{promoStats.expired}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Past validity end-date</div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Redemptions</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent)', marginTop: '4px' }}>{promoStats.totalUsed}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Times applied on invoices</div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>All Created</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{promoStats.total}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Coupons in registry</div>
            </div>
          </div>

          {/* Action Bar & Filters */}
          <div className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <div className="search-input-wrapper" style={{ width: '260px' }}>
                <Search size={15} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search coupon code..."
                  value={promoSearch}
                  onChange={(e) => setPromoSearch(e.target.value)}
                  style={{ paddingLeft: '36px', fontSize: '0.84rem' }}
                />
                {promoSearch && (
                  <button type="button" onClick={() => setPromoSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { key: 'all', label: `All (${promoStats.total})` },
                  { key: 'active', label: `Active (${promoStats.active})` },
                  { key: 'expired', label: `Expired (${promoStats.expired})` },
                  { key: 'disabled', label: 'Disabled' }
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setPromoFilter(f.key)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: promoFilter === f.key ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: promoFilter === f.key ? 'var(--accent-light)' : 'transparent',
                      color: promoFilter === f.key ? 'var(--accent)' : 'var(--text-muted)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowBulkModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={14} /> Bulk Generate
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openCreatePromoModal}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} /> Create Coupon
              </button>
            </div>
          </div>

          {/* Promo Codes Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {filteredPromos.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <EmptyState
                  Icon={Gift}
                  title="No coupon codes found"
                  description={promoSearch ? "No promo codes match your search." : "Create your first discount coupon to start running promotions."}
                />
              </div>
            ) : (
              <div className="table-container">
                <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Coupon Code</th>
                      <th>Discount</th>
                      <th>Min Order</th>
                      <th>Usage (Used / Limit)</th>
                      <th>Expiry Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Active</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPromos.map(p => (
                      <tr key={p.id || p.code}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '3px 8px', borderRadius: '6px' }}>
                              {p.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(p.code)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px' }}
                              title="Copy code"
                            >
                              {copiedCode === p.code ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                            {p.type === 'percent' ? `${p.value}% OFF` : `₹${Number(p.value).toFixed(2)} FLAT`}
                          </span>
                          {p.type === 'percent' && p.maxDiscount && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                              Cap: ₹{p.maxDiscount}
                            </span>
                          )}
                        </td>
                        <td>{p.minAmount > 0 ? `₹${p.minAmount}` : 'No Min'}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{p.timesUsed || 0}</span>
                          <span style={{ color: 'var(--text-muted)' }}> / {p.usageLimit ? p.usageLimit : '∞'}</span>
                        </td>
                        <td>
                          {p.endDate ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}>
                              <Calendar size={13} color="var(--text-muted)" />
                              <span>{p.endDate}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No Expiry</span>
                          )}
                        </td>
                        <td>
                          {p.isExpired ? (
                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                              Expired
                            </span>
                          ) : p.isDisabled ? (
                            <span className="badge" style={{ background: 'rgba(156, 163, 175, 0.15)', color: 'var(--text-muted)' }}>
                              Disabled
                            </span>
                          ) : (
                            <span className="badge badge-success">
                              Active
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={p.enabled !== false}
                            onChange={() => handleTogglePromo(p)}
                            style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: '16px', height: '16px' }}
                            title={p.enabled !== false ? 'Click to disable' : 'Click to enable'}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEditPromoModal(p)}
                              style={{ padding: '4px 8px' }}
                              title="Edit coupon"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDeletePromo(p)}
                              style={{ padding: '4px 8px', color: '#ef4444' }}
                              title="Delete coupon"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: LOYALTY PROGRAM */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'loyalty' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Sub-Tab Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setLoyaltySubTab('customers')}
                className={`btn btn-sm ${loyaltySubTab === 'customers' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Users size={14} /> Customer Loyalty Directory ({activeRegularCustomers.length})
              </button>
              <button
                type="button"
                onClick={() => setLoyaltySubTab('settings')}
                className={`btn btn-sm ${loyaltySubTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Sliders size={14} /> Reward Rules & Tiers
              </button>
            </div>
          </div>

          {/* Sub-View 1: Customer Directory */}
          {loyaltySubTab === 'customers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Loyalty KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Eligible Customers</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{loyaltyStats.totalCustomers}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Regular account holders</div>
                </div>
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>With Points Balance</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{loyaltyStats.withPoints}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Ready to redeem rewards</div>
                </div>
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Points in Circulation</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent)', marginTop: '4px' }}>{loyaltyStats.totalPointsCirculating} pts</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Outstanding customer points</div>
                </div>
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Redemption Value</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>₹{loyaltyStats.totalValue.toFixed(2)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Calculated liability value</div>
                </div>
              </div>

              {/* Customer Directory Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div className="search-input-wrapper" style={{ width: '280px' }}>
                    <Search size={15} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search customer name, phone, code..."
                      value={loyaltySearch}
                      onChange={(e) => setLoyaltySearch(e.target.value)}
                      style={{ paddingLeft: '36px', fontSize: '0.84rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { key: 'all', label: `All (${activeRegularCustomers.length})` },
                      { key: 'with_points', label: `With Points (${loyaltyStats.withPoints})` },
                      { key: 'zero', label: 'Zero Points' }
                    ].map(f => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setLoyaltyFilter(f.key)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: loyaltyFilter === f.key ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: loyaltyFilter === f.key ? 'var(--accent-light)' : 'transparent',
                          color: loyaltyFilter === f.key ? 'var(--accent)' : 'var(--text-muted)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredLoyaltyCustomers.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <EmptyState
                      Icon={Users}
                      title="No customers found"
                      description="No regular customers match the selected filter."
                    />
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Account Code</th>
                          <th>Phone Number</th>
                          <th>Points Balance</th>
                          <th>Discount Value</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLoyaltyCustomers.map(c => {
                          const pts = Number(c.loyaltyPoints || 0)
                          const rupeesVal = (pts * Number(redeemRupees || 5)) / Number(redeemPoints || 150)
                          return (
                            <tr key={c.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                              </td>
                              <td>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{getDisplayCustomerId(c)}</span>
                              </td>
                              <td>{c.phone || '—'}</td>
                              <td>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: pts > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                                  {pts} pts
                                </span>
                              </td>
                              <td>
                                <span style={{ fontWeight: 600, color: rupeesVal > 0 ? '#10b981' : 'var(--text-muted)' }}>
                                  ₹{rupeesVal.toFixed(2)}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openAdjustPointsModal(c)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                                  >
                                    <Sliders size={13} /> Adjust Points
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => openAuditHistory(c)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                                    title="View Audit Trail"
                                  >
                                    <History size={14} /> Audit Trail
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
            </div>
          )}

          {/* Sub-View 2: Program Rules & Settings */}
          {loyaltySubTab === 'settings' && (
            <div className="card" style={{ padding: '24px', maxWidth: '720px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Award size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Loyalty Program Rules & Ratios</h2>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.82rem' }}>Configure point accumulation and redemption conversion rates.</p>
                </div>
              </div>

              <form onSubmit={handleSaveLoyaltySettings} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '8px', background: 'var(--bg-card-subtle, rgba(255,255,255,0.03))', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Enable Customer Loyalty Program</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Allow regular customers to earn points on purchases and redeem them at billing checkout.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={loyaltyEnabled}
                    onChange={(e) => setLoyaltyEnabled(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Points Earned per ₹100 Spent</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0.1"
                      step="0.1"
                      value={pointsPerHundred}
                      onChange={(e) => setPointsPerHundred(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>e.g. 1 point for every ₹100 billed</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Minimum Spend to Earn Points (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={minSpendToEarn}
                      onChange={(e) => setMinSpendToEarn(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Invoices below this amount do not grant points</span>
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(59, 130, 246, 0.04)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '10px', fontSize: '0.9rem' }}>Redemption Conversion Ratio</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Points Required</label>
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        value={redeemPoints}
                        onChange={(e) => setRedeemPoints(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Equals Rupee Discount (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        value={redeemRupees}
                        onChange={(e) => setRedeemRupees(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Example: {redeemPoints} points = ₹{redeemRupees} discount (1 pt = ₹{(Number(redeemRupees || 5) / Number(redeemPoints || 150)).toFixed(3)}).
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="submit" className="btn btn-primary" disabled={savingLoyaltySettings}>
                    {savingLoyaltySettings ? 'Saving Settings...' : 'Save Loyalty Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREATE / EDIT COUPON */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showPromoModal && (
        <div className="modal-overlay" onClick={() => setShowPromoModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPromo ? 'Edit Coupon Code' : 'Create New Coupon'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPromoModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSavePromo}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Coupon Code *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. SUMMER20"
                    value={promoForm.code}
                    onChange={(e) => setPromoForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Discount Type</label>
                    <select
                      className="form-select"
                      value={promoForm.type}
                      onChange={(e) => setPromoForm(f => ({ ...f, type: e.target.value }))}
                    >
                      <option value="percent">% Percentage</option>
                      <option value="flat">₹ Flat Amount</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount Value *</label>
                    <input
                      type="number"
                      className="form-input"
                      step="any"
                      min="0.01"
                      placeholder={promoForm.type === 'percent' ? '15%' : '50'}
                      value={promoForm.value}
                      onChange={(e) => setPromoForm(f => ({ ...f, value: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Min Bill Amount (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      placeholder="0"
                      value={promoForm.minAmount}
                      onChange={(e) => setPromoForm(f => ({ ...f, minAmount: e.target.value }))}
                    />
                  </div>
                  {promoForm.type === 'percent' && (
                    <div className="form-group">
                      <label className="form-label">Max Discount Cap (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        placeholder="Unlimited"
                        value={promoForm.maxDiscount}
                        onChange={(e) => setPromoForm(f => ({ ...f, maxDiscount: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                {/* Expiry Date (Mandatory) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Valid From</label>
                    <input
                      type="date"
                      className="form-input"
                      value={promoForm.startDate}
                      onChange={(e) => setPromoForm(f => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                      Expiry Date * (Valid until 11:59 PM)
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={promoForm.endDate}
                      onChange={(e) => setPromoForm(f => ({ ...f, endDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Total Usage Limit</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      placeholder="Unlimited"
                      value={promoForm.usageLimit}
                      onChange={(e) => setPromoForm(f => ({ ...f, usageLimit: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Per-Customer Limit</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      placeholder="1"
                      value={promoForm.maxUsesPerCustomer}
                      onChange={(e) => setPromoForm(f => ({ ...f, maxUsesPerCustomer: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPromoModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={promoLoading}>
                  {promoLoading ? 'Saving...' : (editingPromo ? 'Update Coupon' : 'Create Coupon')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: BULK GENERATE COUPONS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bulk Generate Coupons</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowBulkModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleBulkGenerate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Code Prefix</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. FESTIVE"
                    value={bulkPrefix}
                    onChange={(e) => setBulkPrefix(e.target.value.toUpperCase())}
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Codes will look like: {bulkPrefix || 'PROMO'}-A8K2, {bulkPrefix || 'PROMO'}-9M3X</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Quantity to Generate</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      max="50"
                      value={bulkCount}
                      onChange={(e) => setBulkCount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount Type</label>
                    <select
                      className="form-select"
                      value={bulkType}
                      onChange={(e) => setBulkType(e.target.value)}
                    >
                      <option value="percent">% Percent</option>
                      <option value="flat">₹ Flat</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Discount Value *</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Bill Amount (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={bulkMinAmount}
                      onChange={(e) => setBulkMinAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    Expiry Date * (Valid until 11:59 PM)
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={bulkEndDate}
                    onChange={(e) => setBulkEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={promoLoading}>
                  {promoLoading ? 'Generating...' : `Generate ${bulkCount} Coupons`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: MANUAL ADJUST LOYALTY POINTS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {selectedCustomerForAdjust && (
        <div className="modal-overlay" onClick={() => setSelectedCustomerForAdjust(null)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Adjust Loyalty Points</h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedCustomerForAdjust.name} (Current: {selectedCustomerForAdjust.loyaltyPoints || 0} pts)
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomerForAdjust(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleConfirmPointsAdjustment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Operation</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${adjustOp === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setAdjustOp('add')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <ArrowUpRight size={14} /> Add Points (+)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${adjustOp === 'deduct' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setAdjustOp('deduct')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <ArrowDownRight size={14} /> Deduct Points (-)
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Number of Points *</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    placeholder="e.g. 50"
                    value={adjustPointsVal}
                    onChange={(e) => setAdjustPointsVal(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Reason / Notes * (Audit Trail)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="e.g. Promotional bonus, customer courtesy adjustment"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedCustomerForAdjust(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isAdjusting}>
                  {isAdjusting ? 'Processing...' : (adjustOp === 'add' ? 'Credit Points' : 'Deduct Points')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: LOYALTY AUDIT TRAIL */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {auditCustomer && (
        <div className="modal-overlay" onClick={() => setAuditCustomer(null)}>
          <div className="modal" style={{ maxWidth: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={20} color="var(--accent)" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Loyalty Audit Trail</h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{auditCustomer.name} ({getDisplayCustomerId(auditCustomer)})</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setAuditCustomer(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
              {loadingAudit ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading audit history...</div>
              ) : auditEvents.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No loyalty events recorded for this customer yet.</div>
              ) : (
                <div className="table-container">
                  <table className="table" style={{ margin: 0, fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Event Type</th>
                        <th>Points</th>
                        <th>Notes / Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditEvents.map((ev, idx) => (
                        <tr key={idx}>
                          <td>{ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}</td>
                          <td>
                            <span className={`badge ${ev.event_type.includes('credit') || ev.event_type === 'earned' ? 'badge-success' : 'badge-warning'}`}>
                              {ev.event_type}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: ev.points >= 0 ? '#10b981' : '#ef4444' }}>
                            {ev.points >= 0 ? `+${ev.points}` : ev.points}
                          </td>
                          <td>{ev.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setAuditCustomer(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PromosAndLoyalty
