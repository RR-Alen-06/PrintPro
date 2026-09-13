import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useProfile, useProfileMutations } from '../../hooks/useProfileQuery'
import { clearAllCloudData } from '../../lib/syncService'
import { SequenceService } from '../../services/sequenceService'
import { ReminderService } from '../../services/reminderService'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  Building2, Shield, Gift, Monitor, LogOut, Check, Save, Upload,
  Cpu, Sliders, Smartphone, AlertCircle, RefreshCw, Tag, Trash2,
  FileText, Percent, Palette, Database, HelpCircle, Hash, MessageSquare, Printer
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileSettings() {
  const navigate = useNavigate()
  const {
    business, updateBusiness, settings, updateSettings, promoCodes, setPromoCodes,
    currentUser, logout, showToast, syncFromCloud
  } = useAppContext()
  const { data: serverProfile = {} } = useProfile()
  const { updateProfile } = useProfileMutations()

  // Sequence configuration local state
  const [seqConfigs, setSeqConfigs] = useState({
    invPrefix: settings.invPrefix || 'INV',
    cusPrefix: settings.cusPrefix || 'CUS',
    itmPrefix: settings.itmPrefix || 'ITM',
    payPrefix: settings.payPrefix || 'PAY',
    expPrefix: settings.expPrefix || 'EXP',
    grpPrefix: settings.grpPrefix || 'GRP',
    cnPrefix: settings.cnPrefix || 'CN',
    seqPadding: settings.seqPadding || 6,
  })

  // WhatsApp templates state
  const [waTemplates, setWaTemplates] = useState({
    whatsappGreeting: settings.whatsappGreeting || 'Dear *{customer_name}*,',
    whatsappFooter: settings.whatsappFooter || 'Thank you for choosing *{shop_name}*! For any queries, contact us at {phone}.',
    includeUpiInWhatsApp: settings.includeUpiInWhatsApp !== false,
  })
  const [waPreviewTab, setWaPreviewTab] = useState('invoice')

  // Business state
  const [biz, setBiz] = useState({
    shopName: business.shopName || '',
    ownerName: business.ownerName || '',
    phone: business.phone || '',
    address: business.address || '',
    gstin: business.gstin || '',
    upiId: business.upiId || '',
  })

  // Sync serverProfile with local business form state when loaded
  useEffect(() => {
    if (serverProfile && Object.keys(serverProfile).length > 0) {
      setBiz((prev) => ({
        shopName: prev.shopName || serverProfile.shop_name || '',
        ownerName: prev.ownerName || serverProfile.owner_name || '',
        phone: prev.phone || serverProfile.phone || '',
        address: prev.address || serverProfile.address || '',
        gstin: prev.gstin || serverProfile.gstin || '',
        upiId: prev.upiId || serverProfile.upi_id || '',
      }))
    }
  }, [serverProfile])

  // Accounting defaults state
  const [gstRate, setGstRate] = useState(settings.gstRate ?? 0)
  const [fyPrefixing, setFyPrefixing] = useState(settings.fyInvoicePrefixing === true)

  // Invoice Branding & PDF settings
  const [branding, setBranding] = useState({
    logoUrl: settings.logoUrl || '',
    shopSealUrl: settings.shopSealUrl || '',
    signatorySignatureUrl: settings.signatorySignatureUrl || '',
    headerNotes: settings.headerNotes || '',
    footerNotes: settings.footerNotes || '',
    showGstBreakdown: settings.showGstBreakdown !== false,
    showUpiQrCode: settings.showUpiQrCode !== false,
    pdfColorTheme: settings.pdfColorTheme || 'dark',
  })

  // Staff Permissions local state
  const [staffPerms, setStaffPerms] = useState({
    billing: settings.staffPermissions?.billing !== false,
    customers: settings.staffPermissions?.customers !== false,
    advancePayments: settings.staffPermissions?.advancePayments !== false,
    accounting: settings.staffPermissions?.accounting === true,
    analytics: settings.staffPermissions?.analytics === true,
    inventory: settings.staffPermissions?.inventory === true,
    settings: settings.staffPermissions?.settings === true,
  })

  // Loyalty local state
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(settings.loyaltyEnabled !== false)
  const [loyaltyEarningRate, setLoyaltyEarningRate] = useState(settings.loyaltyEarningRate ?? 30)
  const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState(settings.loyaltyRedeemRatioPoints ?? 150)
  const [loyaltyRedeemRupees, setLoyaltyRedeemRupees] = useState(settings.loyaltyRedeemRatioRupees ?? 5)

  // Promo / Coupon Modal state
  const [showAddPromoModal, setShowAddPromoModal] = useState(false)
  const [newPromoCode, setNewPromoCode] = useState('')
  const [newPromoType, setNewPromoType] = useState('percent')
  const [newPromoValue, setNewPromoValue] = useState('')
  const [newPromoMinAmount, setNewPromoMinAmount] = useState('')

  // Preferences local state
  const [printPaperSize, setPrintPaperSize] = useState(settings.printPaperSize || '80mm')
  const [autoPrintOnSave, setAutoPrintOnSave] = useState(settings.autoPrintOnSave === true)
  const [silentThermalPrint, setSilentThermalPrint] = useState(settings.silentThermalPrint === true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showClearDataModal, setShowClearDataModal] = useState(false)

  // Save Business Profile
  const handleSaveBusiness = async (e) => {
    e.preventDefault()
    if (updateBusiness) {
      updateBusiness(biz)
    }
    try {
      if (updateProfile) {
        await updateProfile({
          shop_name: biz.shopName,
          owner_name: biz.ownerName,
          phone: biz.phone,
          address: biz.address,
          gstin: biz.gstin,
          upi_id: biz.upiId,
        })
      }
      showToast('Business Profile Updated & Synced to Cloud!', 'success')
    } catch (err) {
      showToast('Business Profile Updated locally!', 'info')
    }
  }

  // Image File Upload Helper
  const handleImageUpload = (e, targetKey) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200000) {
      showToast('Image size should be under 200KB for mobile storage', 'error')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setBranding(prev => ({ ...prev, [targetKey]: reader.result }))
      if (updateSettings) {
        updateSettings({ [targetKey]: reader.result })
      }
      showToast('Branding Image Uploaded!', 'success')
    }
    reader.readAsDataURL(file)
  }

  // Save Sequence & ID Settings
  const handleSaveSequence = async () => {
    const cleanPadding = Math.min(10, Math.max(3, Number(seqConfigs.seqPadding) || 6))
    const updated = {
      invPrefix: seqConfigs.invPrefix.trim().toUpperCase() || 'INV',
      cusPrefix: seqConfigs.cusPrefix.trim().toUpperCase() || 'CUS',
      itmPrefix: seqConfigs.itmPrefix.trim().toUpperCase() || 'ITM',
      payPrefix: seqConfigs.payPrefix.trim().toUpperCase() || 'PAY',
      expPrefix: seqConfigs.expPrefix.trim().toUpperCase() || 'EXP',
      grpPrefix: seqConfigs.grpPrefix.trim().toUpperCase() || 'GRP',
      cnPrefix: seqConfigs.cnPrefix.trim().toUpperCase() || 'CN',
      seqPadding: cleanPadding,
    }
    if (updateSettings) {
      updateSettings(updated)
    }

    try {
      await SequenceService.updateSequenceConfig('BILL', updated.invPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('CUSTOMER', updated.cusPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('INVENTORY', updated.itmPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('PAYMENT', updated.payPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('EXPENSE', updated.expPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('GROUP', updated.grpPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('CREDITNOTE', updated.cnPrefix, cleanPadding)
    } catch (err) {
      console.warn('Sync sequence config to server failed:', err)
    }

    showToast('Sequence & ID Format Settings Saved!', 'success')
  }

  // Save WhatsApp Templates
  const handleSaveWhatsApp = () => {
    if (updateSettings) {
      updateSettings({
        whatsappGreeting: waTemplates.whatsappGreeting.trim(),
        whatsappFooter: waTemplates.whatsappFooter.trim(),
        includeUpiInWhatsApp: waTemplates.includeUpiInWhatsApp,
      })
    }
    showToast('WhatsApp Reminder Templates Saved!', 'success')
  }

  // Save Accounting & Branding Defaults
  const handleSaveAccountingAndBranding = () => {
    if (updateSettings) {
      updateSettings({
        gstRate: Number(gstRate),
        fyInvoicePrefixing: fyPrefixing,
        ...branding
      })
    }
    showToast('Accounting & Branding Settings Saved!', 'success')
  }

  // Save Permissions
  const handleSavePermissions = () => {
    if (updateSettings) {
      updateSettings({ staffPermissions: staffPerms })
    }
    showToast('Staff Permissions Saved!', 'success')
  }

  // Save Loyalty Config
  const handleSaveLoyalty = () => {
    if (updateSettings) {
      updateSettings({
        loyaltyEnabled,
        loyaltyEarningRate: Number(loyaltyEarningRate),
        loyaltyRedeemRatioPoints: Number(loyaltyRedeemPoints),
        loyaltyRedeemRatioRupees: Number(loyaltyRedeemRupees)
      })
    }
    showToast('Loyalty Program Config Saved!', 'success')
  }

  // Promo Code Operations
  const handleAddPromoSubmit = (e) => {
    e.preventDefault()
    const codeUpper = newPromoCode.trim().toUpperCase()
    if (!codeUpper) {
      showToast('Please enter a coupon code', 'error')
      return
    }
    const val = Number(newPromoValue)
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid value', 'error')
      return
    }

    const updated = [
      ...(promoCodes || []),
      {
        code: codeUpper,
        type: newPromoType,
        value: val,
        minAmount: Number(newPromoMinAmount || 0),
        enabled: true
      }
    ]
    if (setPromoCodes) setPromoCodes(updated)
    setNewPromoCode('')
    setNewPromoValue('')
    setNewPromoMinAmount('')
    setShowAddPromoModal(false)
    showToast(`Promo Code '${codeUpper}' Added!`, 'success')
  }

  const handleTogglePromoEnabled = (code) => {
    const updated = (promoCodes || []).map(p =>
      p.code === code ? { ...p, enabled: p.enabled === false ? true : false } : p
    )
    if (setPromoCodes) setPromoCodes(updated)
  }

  const handleDeletePromo = (code) => {
    const updated = (promoCodes || []).filter(p => p.code !== code)
    if (setPromoCodes) setPromoCodes(updated)
    showToast(`Promo code '${code}' deleted`, 'info')
  }

  // Save Preferences
  const handleToggleThermalPrint = () => {
    const nextVal = !silentThermalPrint
    setSilentThermalPrint(nextVal)
    if (updateSettings) {
      updateSettings({ silentThermalPrint: nextVal })
    }
    showToast(`Silent Thermal Print ${nextVal ? 'Enabled' : 'Disabled'}`, 'info')
  }

  // Trigger Cloud Sync
  const handleSyncCloud = async () => {
    setIsSyncing(true)
    try {
      if (syncFromCloud) await syncFromCloud()
      showToast('Cloud database synchronized', 'success')
    } catch (e) {
      showToast('Sync failed', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  // Purge / Clear Cloud Database
  const handleConfirmClearData = async () => {
    try {
      await clearAllCloudData()
      showToast('All local and cloud database records purged', 'info')
      setShowClearDataModal(false)
      window.location.reload()
    } catch (e) {
      showToast('Failed to purge database', 'error')
    }
  }

  return (
    <MobileLayout
      title="System Settings Terminal"
    >
      {/* SECTION 1: BUSINESS PROFILE */}
      <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Building2 size={20} style={{ color: 'var(--accent-primary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            BUSINESS PROFILE CONFIG
          </h3>
        </div>

        <form onSubmit={handleSaveBusiness} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              SHOP / STORE NAME
            </label>
            <input
              type="text"
              className="mobile-input"
              value={biz.shopName}
              onChange={(e) => setBiz({ ...biz, shopName: e.target.value })}
              placeholder="PrintPro Neo Station"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              OWNER NAME
            </label>
            <input
              type="text"
              className="mobile-input"
              value={biz.ownerName}
              onChange={(e) => setBiz({ ...biz, ownerName: e.target.value })}
              placeholder="Alex Mercer"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                CONTACT PHONE
              </label>
              <input
                type="tel"
                className="mobile-input"
                value={biz.phone}
                onChange={(e) => setBiz({ ...biz, phone: e.target.value })}
                placeholder="+91 9876543210"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                GSTIN NUMBER
              </label>
              <input
                type="text"
                className="mobile-input"
                value={biz.gstin}
                onChange={(e) => setBiz({ ...biz, gstin: e.target.value })}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              BUSINESS ADDRESS / LOCATION
            </label>
            <input
              type="text"
              className="mobile-input"
              value={biz.address}
              onChange={(e) => setBiz({ ...biz, address: e.target.value })}
              placeholder="Shop #4, Commercial Complex, MG Road"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              MERCHANT UPI ID (QR PAYMENTS)
            </label>
            <input
              type="text"
              className="mobile-input currency-num"
              value={biz.upiId}
              onChange={(e) => setBiz({ ...biz, upiId: e.target.value })}
              placeholder="printpro@okaxis"
            />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '4px' }}>
            <Save size={18} /> Save Business Profile
          </button>
        </form>
      </div>

      {/* SECTION 2: PROMO / COUPON CODES MANAGER */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={20} style={{ color: 'var(--accent-secondary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              PROMO / COUPON CODES
            </h3>
          </div>
          <button
            className="mobile-btn mobile-btn-primary"
            onClick={() => setShowAddPromoModal(true)}
            style={{ width: 'auto', padding: '0 12px', fontSize: '0.78rem', minHeight: '34px' }}
          >
            + New Promo
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(promoCodes || []).length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
              No promo codes created yet.
            </div>
          ) : (
            (promoCodes || []).map(p => (
              <div key={p.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono' }}>
                    {p.code}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {p.type === 'percent' ? `${p.value}% OFF` : `₹${p.value} OFF`} • Min Order: ₹{p.minAmount || 0}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="mobile-badge"
                    onClick={() => handleTogglePromoEnabled(p.code)}
                    style={{ cursor: 'pointer', background: p.enabled !== false ? 'rgba(0, 255, 171, 0.2)' : 'rgba(255, 56, 96, 0.2)', color: p.enabled !== false ? 'var(--success)' : 'var(--error)' }}
                  >
                    {p.enabled !== false ? 'ACTIVE' : 'DISABLED'}
                  </button>
                  <button
                    onClick={() => handleDeletePromo(p.code)}
                    style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 3: INVOICE BRANDING & PDF CUSTOMIZATION */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Palette size={20} style={{ color: 'var(--accent-primary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            INVOICE BRANDING & PDF
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              UPLOAD STORE LOGO
            </label>
            <input
              type="file"
              accept="image/*"
              className="mobile-input"
              onChange={(e) => handleImageUpload(e, 'logoUrl')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              UPLOAD OFFICIAL SHOP SEAL
            </label>
            <input
              type="file"
              accept="image/*"
              className="mobile-input"
              onChange={(e) => handleImageUpload(e, 'shopSealUrl')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              UPLOAD SIGNATORY SIGNATURE
            </label>
            <input
              type="file"
              accept="image/*"
              className="mobile-input"
              onChange={(e) => handleImageUpload(e, 'signatorySignatureUrl')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              HEADER NOTES
            </label>
            <input
              type="text"
              className="mobile-input"
              value={branding.headerNotes}
              onChange={(e) => setBranding({ ...branding, headerNotes: e.target.value })}
              placeholder="Official Tax Invoice / Cash Memo"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              PDF FOOTER NOTES
            </label>
            <input
              type="text"
              className="mobile-input"
              value={branding.footerNotes}
              onChange={(e) => setBranding({ ...branding, footerNotes: e.target.value })}
              placeholder="Thank you for printing with us!"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                PDF COLOR THEME
              </label>
              <select
                className="mobile-input"
                value={branding.pdfColorTheme}
                onChange={(e) => setBranding({ ...branding, pdfColorTheme: e.target.value })}
              >
                <option value="dark">Dark Theme</option>
                <option value="light">Light Minimal</option>
                <option value="cyberpunk">Cyberpunk Neon</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                INVOICE ACCENT COLOR
              </label>
              <input
                type="color"
                className="mobile-input"
                style={{ height: '40px', padding: '4px', cursor: 'pointer' }}
                value={branding.primaryColor || '#0f172a'}
                onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
              />
            </div>
          </div>
        </div>

        <button className="mobile-btn mobile-btn-secondary" onClick={handleSaveAccountingAndBranding}>
          Save Branding & PDF Settings
        </button>
      </div>

      {/* SECTION 4: TAX SETTINGS */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Percent size={20} style={{ color: 'var(--warning)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            TAX & GST SETTINGS
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              DEFAULT GST RATE (%)
            </label>
            <select
              className="mobile-input currency-num"
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value))}
            >
              <option value="0">0% (GST Exempted / Nil Rated)</option>
              <option value="5">5% (5% GST)</option>
              <option value="12">12% (12% Standard GST)</option>
              <option value="18">18% (18% Printing Services)</option>
            </select>
          </div>
        </div>

        <button className="mobile-btn mobile-btn-secondary" onClick={handleSaveAccountingAndBranding} style={{ color: 'var(--warning)' }}>
          Save Tax Settings
        </button>
      </div>

      {/* SECTION 4B: SEQUENCE & ID FORMAT */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Hash size={20} style={{ color: '#3b82f6' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            ID &amp; SEQUENCE CODES
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                INVOICE PREFIX
              </label>
              <input
                type="text"
                className="mobile-input"
                value={seqConfigs.invPrefix}
                onChange={(e) => setSeqConfigs({ ...seqConfigs, invPrefix: e.target.value.toUpperCase() })}
                placeholder="INV"
                maxLength={8}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                CLIENT PREFIX
              </label>
              <input
                type="text"
                className="mobile-input"
                value={seqConfigs.cusPrefix}
                onChange={(e) => setSeqConfigs({ ...seqConfigs, cusPrefix: e.target.value.toUpperCase() })}
                placeholder="CUS"
                maxLength={8}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                ITEM PREFIX
              </label>
              <input
                type="text"
                className="mobile-input"
                value={seqConfigs.itmPrefix}
                onChange={(e) => setSeqConfigs({ ...seqConfigs, itmPrefix: e.target.value.toUpperCase() })}
                placeholder="ITM"
                maxLength={8}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                PAYMENT PREFIX
              </label>
              <input
                type="text"
                className="mobile-input"
                value={seqConfigs.payPrefix}
                onChange={(e) => setSeqConfigs({ ...seqConfigs, payPrefix: e.target.value.toUpperCase() })}
                placeholder="PAY"
                maxLength={8}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                EXPENSE PREFIX
              </label>
              <input
                type="text"
                className="mobile-input"
                value={seqConfigs.expPrefix}
                onChange={(e) => setSeqConfigs({ ...seqConfigs, expPrefix: e.target.value.toUpperCase() })}
                placeholder="EXP"
                maxLength={8}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                GROUP PREFIX
              </label>
              <input
                type="text"
                className="mobile-input"
                value={seqConfigs.grpPrefix}
                onChange={(e) => setSeqConfigs({ ...seqConfigs, grpPrefix: e.target.value.toUpperCase() })}
                placeholder="GRP"
                maxLength={8}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              ZERO-PADDING DIGITS
            </label>
            <select
              className="mobile-input"
              value={seqConfigs.seqPadding}
              onChange={(e) => setSeqConfigs({ ...seqConfigs, seqPadding: Number(e.target.value) })}
            >
              <option value={4}>4 digits (e.g. 0001)</option>
              <option value={5}>5 digits (e.g. 00001)</option>
              <option value={6}>6 digits (e.g. 000001)</option>
              <option value={8}>8 digits (e.g. 00000001)</option>
            </select>
          </div>
        </div>

        <button className="mobile-btn mobile-btn-secondary" onClick={handleSaveSequence} style={{ color: '#3b82f6' }}>
          Save Sequence Settings
        </button>
      </div>

      {/* SECTION 4C: WHATSAPP & REMINDER TEMPLATES */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <MessageSquare size={20} style={{ color: '#25D366' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            WHATSAPP NOTIFICATIONS
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              GREETING TEMPLATE
            </label>
            <input
              type="text"
              className="mobile-input"
              value={waTemplates.whatsappGreeting}
              onChange={(e) => setWaTemplates({ ...waTemplates, whatsappGreeting: e.target.value })}
              placeholder="Dear *{customer_name}*,"
            />
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              <code>{'{customer_name}'}</code> auto-fills client name.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              CLOSING FOOTER TEMPLATE
            </label>
            <textarea
              className="mobile-input"
              rows={2}
              value={waTemplates.whatsappFooter}
              onChange={(e) => setWaTemplates({ ...waTemplates, whatsappFooter: e.target.value })}
              placeholder="Thank you for choosing *{shop_name}*!"
              style={{ resize: 'vertical' }}
            />
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              <code>{'{shop_name}'}</code> auto-fills business name.
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={waTemplates.includeUpiInWhatsApp}
              onChange={(e) => setWaTemplates({ ...waTemplates, includeUpiInWhatsApp: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: '#25D366' }}
            />
            <span>Include 1-Click UPI Pay Link</span>
          </label>

          {/* Live Preview */}
          <div style={{ background: '#0b141a', border: '1px solid #1f2c34', borderRadius: '8px', padding: '10px', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#25D366' }}>WHATSAPP PREVIEW</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setWaPreviewTab('invoice')}
                  style={{
                    background: waPreviewTab === 'invoice' ? '#25D366' : 'transparent',
                    color: waPreviewTab === 'invoice' ? '#000' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  Bill
                </button>
                <button
                  type="button"
                  onClick={() => setWaPreviewTab('reminder')}
                  style={{
                    background: waPreviewTab === 'reminder' ? '#25D366' : 'transparent',
                    color: waPreviewTab === 'reminder' ? '#000' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  Reminder
                </button>
              </div>
            </div>

            <div style={{
              fontFamily: 'monospace',
              fontSize: '0.72rem',
              color: '#e9edef',
              whiteSpace: 'pre-wrap',
              maxHeight: '180px',
              overflowY: 'auto'
            }}>
              {waPreviewTab === 'invoice' ? (
                ReminderService.buildInvoiceMessage(
                  {
                    invoiceNumber: `${seqConfigs.invPrefix || 'INV'}-000042`,
                    date: new Date().toISOString(),
                    customerName: 'Rahul Sharma',
                    items: [{ name: 'A4 Color Print', qty: 10, rate: 10, amount: 100 }],
                    total: 100,
                    paidTotal: 0,
                    balance: 100,
                  },
                  business,
                  waTemplates
                )
              ) : (
                ReminderService.buildLedgerReminderMessage(
                  { name: 'Rahul Sharma', phone: '9876543210' },
                  -350,
                  business,
                  waTemplates
                )
              )}
            </div>
          </div>
        </div>

        <button className="mobile-btn mobile-btn-secondary" onClick={handleSaveWhatsApp} style={{ color: '#25D366' }}>
          Save WhatsApp Templates
        </button>
      </div>

      {/* SECTION 5: STAFF PERMISSIONS */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Shield size={20} style={{ color: 'var(--accent-secondary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            STAFF ACCESS PERMISSIONS
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          {[
            { key: 'billing', label: 'Create & Manage Bills' },
            { key: 'customers', label: 'Manage Customer Directory' },
            { key: 'advancePayments', label: 'Record Advance Deposits' },
            { key: 'inventory', label: 'Inventory & Rates Management' },
            { key: 'accounting', label: 'Financial Accounting Access' },
            { key: 'analytics', label: 'Period Analytics Reports' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{item.label}</span>
              <button
                type="button"
                onClick={() => setStaffPerms({ ...staffPerms, [item.key]: !staffPerms[item.key] })}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '999px',
                  background: staffPerms[item.key] ? 'var(--accent-secondary)' : 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  position: 'relative',
                  cursor: 'pointer',
                  boxShadow: staffPerms[item.key] ? '0 0 8px rgba(0, 240, 255, 0.4)' : 'none',
                  transition: 'var(--transition)'
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: '2px',
                  left: staffPerms[item.key] ? '22px' : '2px',
                  transition: 'var(--transition)'
                }} />
              </button>
            </div>
          ))}
        </div>

        <button className="mobile-btn mobile-btn-secondary" onClick={handleSavePermissions} style={{ color: 'var(--accent-secondary)' }}>
          Save Staff Permissions
        </button>
      </div>

      {/* SECTION 5: LOYALTY PROGRAM CONFIG */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Gift size={20} style={{ color: 'var(--success)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            LOYALTY PROGRAM CONFIG
          </h3>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Enable Customer Loyalty Points</span>
          <button
            type="button"
            onClick={() => setLoyaltyEnabled(!loyaltyEnabled)}
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '999px',
              background: loyaltyEnabled ? 'var(--success)' : 'var(--bg-input)',
              border: '1px solid var(--border)',
              position: 'relative',
              cursor: 'pointer',
              boxShadow: loyaltyEnabled ? '0 0 8px rgba(0, 255, 171, 0.4)' : 'none',
              transition: 'var(--transition)'
            }}
          >
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#ffffff',
              position: 'absolute',
              top: '2px',
              left: loyaltyEnabled ? '22px' : '2px',
              transition: 'var(--transition)'
            }} />
          </button>
        </div>

        {loyaltyEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                EARNING RATE (1 Point per ₹N spent)
              </label>
              <input
                type="number"
                className="mobile-input currency-num"
                value={loyaltyEarningRate}
                onChange={(e) => setLoyaltyEarningRate(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>REDEEM POINTS</label>
                <input
                  type="number"
                  className="mobile-input currency-num"
                  value={loyaltyRedeemPoints}
                  onChange={(e) => setLoyaltyRedeemPoints(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>REDEEM RUPEES (₹)</label>
                <input
                  type="number"
                  className="mobile-input currency-num"
                  value={loyaltyRedeemRupees}
                  onChange={(e) => setLoyaltyRedeemRupees(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <button className="mobile-btn mobile-btn-secondary" onClick={handleSaveLoyalty}>
          Save Loyalty Config
        </button>
      </div>

      {/* SECTION 6: APP PREFERENCES */}
      <div className="mobile-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Sliders size={20} style={{ color: 'var(--accent-primary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            APP PREFERENCES
          </h3>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Desktop Layout Mode</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Switch to multi-column desktop view</div>
          </div>
          <button
            className="mobile-btn mobile-btn-secondary"
            onClick={() => {
              localStorage.setItem('printpro_viewport_pref', 'desktop')
              navigate('/dashboard')
            }}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.78rem' }}
          >
            <Monitor size={16} /> Switch
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Receipt Output Format</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Default width for 1-tap printing</div>
          </div>
          <select
            className="mobile-input"
            value={printPaperSize}
            onChange={(e) => {
              setPrintPaperSize(e.target.value)
              if (updateSettings) updateSettings({ printPaperSize: e.target.value })
              showToast(`Print format set to ${e.target.value}`, 'success')
            }}
            style={{ width: 'auto', minWidth: '100px', fontSize: '0.8rem', padding: '6px 8px' }}
          >
            <option value="58mm">58mm Thermal</option>
            <option value="80mm">80mm Thermal</option>
            <option value="A4">A4 Standard</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Silent Thermal Print</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-print receipt without print dialog</div>
          </div>
          <button
            type="button"
            onClick={handleToggleThermalPrint}
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '999px',
              background: silentThermalPrint ? 'var(--accent-primary)' : 'var(--bg-input)',
              border: '1px solid var(--border)',
              position: 'relative',
              cursor: 'pointer',
              boxShadow: silentThermalPrint ? '0 0 8px rgba(255, 47, 176, 0.4)' : 'none',
              transition: 'var(--transition)'
            }}
          >
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#ffffff',
              position: 'absolute',
              top: '2px',
              left: silentThermalPrint ? '22px' : '2px',
              transition: 'var(--transition)'
            }} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Auto-Print on Bill Save</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Automatically trigger printer on POS save</div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !autoPrintOnSave
              setAutoPrintOnSave(next)
              if (updateSettings) updateSettings({ autoPrintOnSave: next })
              showToast(next ? 'Auto-print enabled' : 'Auto-print disabled', 'info')
            }}
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '999px',
              background: autoPrintOnSave ? 'var(--accent-primary)' : 'var(--bg-input)',
              border: '1px solid var(--border)',
              position: 'relative',
              cursor: 'pointer',
              boxShadow: autoPrintOnSave ? '0 0 8px rgba(255, 47, 176, 0.4)' : 'none',
              transition: 'var(--transition)'
            }}
          >
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#ffffff',
              position: 'absolute',
              top: '2px',
              left: autoPrintOnSave ? '22px' : '2px',
              transition: 'var(--transition)'
            }} />
          </button>
        </div>
      </div>

      {/* SECTION 7: SYSTEM INFO & CLOUD DATA MANAGEMENT */}
      <div className="mobile-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Cpu size={20} style={{ color: 'var(--accent-secondary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            SYSTEM & CLOUD STATUS
          </h3>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          <div>Theme: <strong style={{ color: 'var(--accent-primary)' }}>NEON TOKYO CYBERPUNK v1.0</strong></div>
          <div>User Account: <strong className="currency-num">{currentUser?.email || 'Authenticated Merchant'}</strong></div>
          <div>Database Sync: <strong style={{ color: 'var(--success)' }}>Supabase PostgreSQL Connected</strong></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button className="mobile-btn mobile-btn-secondary" onClick={handleSyncCloud} disabled={isSyncing} style={{ fontSize: '0.78rem' }}>
            <RefreshCw size={14} className={isSyncing ? 'spin' : ''} /> Force Sync
          </button>
          <button className="mobile-btn" onClick={() => setShowClearDataModal(true)} style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)', fontSize: '0.78rem' }}>
            <Database size={14} /> Purge Cloud Data
          </button>
        </div>
      </div>

      {/* SECTION 8: LOGOUT BUTTON */}
      <button
        className="mobile-btn"
        onClick={() => { if (logout) logout() }}
        style={{
          background: 'var(--error-bg)',
          color: 'var(--error)',
          border: '1px solid var(--error)',
          boxShadow: '0 0 12px rgba(255, 56, 96, 0.35)',
          marginBottom: '20px'
        }}
      >
        <LogOut size={20} /> TERMINATE SESSION / LOGOUT
      </button>

      {/* Add Promo Code Bottom Sheet Drawer */}
      <BottomSheet
        isOpen={showAddPromoModal}
        onClose={() => setShowAddPromoModal(false)}
        title="Add New Promo Coupon Code"
      >
        <form onSubmit={handleAddPromoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              PROMO CODE (UPPERCASE)
            </label>
            <input
              type="text"
              className="mobile-input currency-num"
              placeholder="e.g. SUMMER50"
              value={newPromoCode}
              onChange={(e) => setNewPromoCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              DISCOUNT TYPE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`mobile-btn ${newPromoType === 'percent' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setNewPromoType('percent')}
                style={{ minHeight: '38px', fontSize: '0.82rem' }}
              >
                Percentage (%)
              </button>
              <button
                type="button"
                className={`mobile-btn ${newPromoType === 'flat' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setNewPromoType('flat')}
                style={{ minHeight: '38px', fontSize: '0.82rem' }}
              >
                Flat Amount (₹)
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                DISCOUNT VALUE
              </label>
              <input
                type="number"
                step="0.01"
                className="mobile-input currency-num"
                placeholder={newPromoType === 'percent' ? '15' : '100'}
                value={newPromoValue}
                onChange={(e) => setNewPromoValue(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                MIN ORDER (INR)
              </label>
              <input
                type="number"
                className="mobile-input currency-num"
                placeholder="500"
                value={newPromoMinAmount}
                onChange={(e) => setNewPromoMinAmount(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary">
            Save Promo Code
          </button>
        </form>
      </BottomSheet>

      {/* Clear Database Modal */}
      {showClearDataModal && (
        <div className="bottom-sheet-overlay" onClick={() => setShowClearDataModal(false)}>
          <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-drag-handle" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--error)', marginBottom: '8px' }}>
              Purge Cloud & Local Database?
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              This will permanently delete all stored invoices, customers, and payment logs from local and cloud storage.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button className="mobile-btn mobile-btn-secondary" onClick={() => setShowClearDataModal(false)}>
                Cancel
              </button>
              <button className="mobile-btn" style={{ background: 'var(--error)', color: '#fff' }} onClick={handleConfirmClearData}>
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SECTION: DESKTOP MODE SWITCH */}
      <div className="mobile-card" style={{ marginTop: '20px', border: '1px solid var(--border)', textAlign: 'center' }}>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Desktop Workstation
        </h4>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
          Switch to the full desktop multi-panel workstation layout.
        </p>
        <button
          type="button"
          className="mobile-btn mobile-btn-secondary"
          onClick={() => {
            localStorage.setItem('printpro_viewport_pref', 'desktop')
            navigate('/dashboard')
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Monitor size={16} /> Request Desktop Site
        </button>
      </div>
    </MobileLayout>
  )
}
