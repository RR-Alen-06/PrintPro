import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { useProfile, useProfileMutations } from '../hooks/useProfileQuery'
import { useSettings, useSettingsMutations } from '../hooks/useSettingsQuery'
import { usePromoCodes, usePromoCodeMutations } from '../hooks/usePromoCodesQuery'
import { SequenceService } from '../services/sequenceService'

import {
  Building2,
  BarChart3,
  Hash,
  MessageSquare,
  Gift,
  Tag,
  Palette,
  Sliders,
  Database,
  FileSpreadsheet,
  Trash2,
  Search,
} from 'lucide-react'

import { BusinessProfileTab, BusinessProfileData } from '../components/settings/BusinessProfileTab'
import { AccountingTab, AccountingData } from '../components/settings/AccountingTab'
import { SequencesTab, SequenceConfigData } from '../components/settings/SequencesTab'
import { WhatsAppTab, WhatsAppTemplateData } from '../components/settings/WhatsAppTab'
import { LoyaltyTab, LoyaltyData } from '../components/settings/LoyaltyTab'
import { PromoCodesTab, NewPromoState } from '../components/settings/PromoCodesTab'
import { BrandingTab, BrandingData } from '../components/settings/BrandingTab'
import { MaintenanceTab } from '../components/settings/MaintenanceTab'
import { BackupSnapshotTab } from '../components/settings/BackupSnapshotTab'
import { DataImportExportTab } from '../components/settings/DataImportExportTab'
import { RecycleBinTab } from '../components/settings/RecycleBinTab'

interface TabDefinition {
  id: string
  label: string
  sublabel: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color: string
}

const TABS: TabDefinition[] = [
  {
    id: 'profile',
    label: 'Business Profile',
    sublabel: 'Shop name, contact & UPI',
    icon: Building2,
    color: 'var(--accent)',
  },
  {
    id: 'branding',
    label: 'Invoice Branding',
    sublabel: 'Colors, logo, seal & print',
    icon: Palette,
    color: '#ec4899',
  },
  {
    id: 'accounting',
    label: 'Accounting & GST',
    sublabel: 'GST rate & reporting mode',
    icon: BarChart3,
    color: 'var(--warning)',
  },
  {
    id: 'sequences',
    label: 'Sequences & IDs',
    sublabel: 'Prefixes & zero-padding',
    icon: Hash,
    color: '#3b82f6',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp & Reminders',
    sublabel: 'Templates & live preview',
    icon: MessageSquare,
    color: '#25D366',
  },
  {
    id: 'loyalty',
    label: 'Loyalty Program',
    sublabel: 'Points, tiers & redemption',
    icon: Gift,
    color: '#a855f7',
  },
  {
    id: 'promos',
    label: 'Coupons & Promo Codes',
    sublabel: 'Discount rules & validity',
    icon: Tag,
    color: '#06b6d4',
  },
  {
    id: 'backup',
    label: 'Cloud & Local Backup',
    sublabel: 'Snapshots & storage gauge',
    icon: Database,
    color: '#00f0ff',
  },
  {
    id: 'import-export',
    label: 'Import & Export Hub',
    sublabel: '7-entity CSV & bulk uploads',
    icon: FileSpreadsheet,
    color: '#10b981',
  },
  {
    id: 'recycle-bin',
    label: 'Recycle Bin',
    sublabel: 'Recover or purge deleted bills',
    icon: Trash2,
    color: '#ef4444',
  },
  {
    id: 'maintenance',
    label: 'System Maintenance',
    sublabel: 'Storage & factory reset',
    icon: Sliders,
    color: 'var(--error)',
  },
]

const Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tabSearch, setTabSearch] = useState('')
  const currentTabParam = searchParams.get('tab') || 'profile'
  const activeTab = TABS.some((t) => t.id === currentTabParam) ? currentTabParam : 'profile'

  const filteredTabs = TABS.filter(
    (t) =>
      t.label.toLowerCase().includes(tabSearch.toLowerCase()) ||
      t.sublabel.toLowerCase().includes(tabSearch.toLowerCase()) ||
      t.id.toLowerCase().includes(tabSearch.toLowerCase())
  )

  const handleSelectTab = (tabId: string) => {
    setSearchParams({ tab: tabId })
  }

  const { business, showToast } = useAppContext()
  const { data: serverProfile = {} } = useProfile()
  const { updateProfile } = useProfileMutations()

  const { settings = {} } = useSettings()
  const { updateSettings } = useSettingsMutations()
  const { promoCodes = [] } = usePromoCodes()
  const { createPromoCode, updatePromoCode, deletePromoCode } = usePromoCodeMutations()

  // 1. Business profile local state
  const [biz, setBiz] = useState<BusinessProfileData>({
    shopName: business.shopName || '',
    ownerName: business.ownerName || '',
    phone: business.phone || '',
    address: business.address || '',
    gstin: business.gstin || '',
    upiId: business.upiId || '',
  })
  const [bizSaved, setBizSaved] = useState(false)

  // Sync serverProfile with local form state
  useEffect(() => {
    if (serverProfile && Object.keys(serverProfile).length > 0) {
      setBiz((prev) => ({
        shopName: prev.shopName || (serverProfile as any).shop_name || '',
        ownerName: prev.ownerName || (serverProfile as any).owner_name || '',
        phone: prev.phone || (serverProfile as any).phone || '',
        address: prev.address || (serverProfile as any).address || '',
        gstin: prev.gstin || (serverProfile as any).gstin || '',
        upiId: prev.upiId || (serverProfile as any).upi_id || '',
      }))
    }
  }, [serverProfile])

  // 2. Accounting settings local state
  const [acct, setAcct] = useState<AccountingData>({
    gstRate: settings.gstRate ?? 0,
    viewMode: settings.viewMode || 'monthly',
    refundsEnabled: settings.refundsEnabled !== false,
    fyInvoicePrefixing: settings.fyInvoicePrefixing === true,
  })
  const [acctSaved, setAcctSaved] = useState(false)

  // 3. Sequence configuration local state
  const [seqConfigs, setSeqConfigs] = useState<SequenceConfigData>({
    invPrefix: settings.invPrefix || 'INV',
    cusPrefix: settings.cusPrefix || 'CUS',
    itmPrefix: settings.itmPrefix || 'ITM',
    payPrefix: settings.payPrefix || 'PAY',
    expPrefix: settings.expPrefix || 'EXP',
    grpPrefix: settings.grpPrefix || 'GRP',
    cnPrefix: settings.cnPrefix || 'CN',
    seqPadding: settings.seqPadding || 6,
  })
  const [seqSaved, setSeqSaved] = useState(false)

  // 4. WhatsApp Notification Templates local state
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplateData>({
    whatsappGreeting: settings.whatsappGreeting || 'Dear *{customer_name}*,',
    whatsappFooter:
      settings.whatsappFooter ||
      'Thank you for choosing *{shop_name}*! For any queries, contact us at {phone}.',
    includeUpiInWhatsApp: settings.includeUpiInWhatsApp !== false,
  })
  const [waSaved, setWaSaved] = useState(false)
  const [waPreviewTab, setWaPreviewTab] = useState<'invoice' | 'reminder'>('invoice')

  // 5. Loyalty local state
  const [loyalty, setLoyalty] = useState<LoyaltyData>({
    loyaltyEnabled: settings.loyaltyEnabled !== false,
    loyaltyForRandomCustomers: settings.loyaltyForRandomCustomers === true,
    loyaltyRedeemEnabled: settings.loyaltyRedeemEnabled !== false,
    loyaltyRedeemRatioPoints: settings.loyaltyRedeemRatioPoints ?? 150,
    loyaltyRedeemRatioRupees: settings.loyaltyRedeemRatioRupees ?? 5,
    loyaltyTiers: settings.loyaltyTiers?.length
      ? settings.loyaltyTiers.map((t: any) => ({ ...t }))
      : [
          { from: 1, to: 40, points: 1 },
          { from: 41, to: 100, points: 2 },
        ],
    loyaltyRedeemOptions: settings.loyaltyRedeemOptions?.length
      ? settings.loyaltyRedeemOptions.map((o: any) => ({ ...o }))
      : [
          { points: 100, rupees: 2.5 },
          { points: 120, rupees: 3 },
          { points: 150, rupees: 5 },
        ],
  })
  const [loyaltySaved, setLoyaltySaved] = useState(false)

  // 6. Promo local state
  const [newPromo, setNewPromo] = useState<NewPromoState>({
    code: '',
    type: 'percent',
    value: '',
    minAmount: '',
    startDate: '',
    endDate: '',
    enabled: true,
  })

  // 7. Branding local state
  const [branding, setBranding] = useState<BrandingData>({
    primaryColor: settings.primaryColor || '#0f172a',
    logoUrl: settings.logoUrl || '',
    headerNotes: settings.headerNotes || '',
    footerNotes: settings.footerNotes || '',
    showGstBreakdown: settings.showGstBreakdown !== false,
    showUpiQrCode: settings.showUpiQrCode !== false,
    silentThermalPrint: settings.silentThermalPrint === true,
    printPaperSize: settings.printPaperSize || '80mm',
    autoPrintOnSave: settings.autoPrintOnSave === true,
    shopSealUrl: settings.shopSealUrl || '',
    signatorySignatureUrl: settings.signatorySignatureUrl || '',
    pdfShowType: settings.pdfShowType !== false,
    pdfShowSides: settings.pdfShowSides !== false,
    pdfShowUnitPrice: settings.pdfShowUnitPrice !== false,
    pdfShowGstRate: settings.pdfShowGstRate !== false,
    pdfColorTheme: settings.pdfColorTheme || 'dark',
    pdfLegalFooter: settings.pdfLegalFooter || '',
  })
  const [brandingSaved, setBrandingSaved] = useState(false)

  // Sync server settings with local form state
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      setSeqConfigs((prev) => ({
        invPrefix: settings.invPrefix || prev.invPrefix,
        cusPrefix: settings.cusPrefix || prev.cusPrefix,
        itmPrefix: settings.itmPrefix || prev.itmPrefix,
        payPrefix: settings.payPrefix || prev.payPrefix,
        expPrefix: settings.expPrefix || prev.expPrefix,
        grpPrefix: settings.grpPrefix || prev.grpPrefix,
        cnPrefix: settings.cnPrefix || prev.cnPrefix,
        seqPadding: settings.seqPadding || prev.seqPadding,
      }))
      setWaTemplates((prev) => ({
        whatsappGreeting: settings.whatsappGreeting || prev.whatsappGreeting,
        whatsappFooter: settings.whatsappFooter || prev.whatsappFooter,
        includeUpiInWhatsApp:
          settings.includeUpiInWhatsApp !== undefined
            ? settings.includeUpiInWhatsApp
            : prev.includeUpiInWhatsApp,
      }))
      setAcct((prev) => ({
        gstRate: settings.gstRate !== undefined ? settings.gstRate : prev.gstRate,
        viewMode: settings.viewMode || prev.viewMode,
        refundsEnabled:
          settings.refundsEnabled !== undefined ? settings.refundsEnabled : prev.refundsEnabled,
        fyInvoicePrefixing:
          settings.fyInvoicePrefixing !== undefined
            ? settings.fyInvoicePrefixing
            : prev.fyInvoicePrefixing,
      }))
      setLoyalty((prev) => ({
        loyaltyEnabled:
          settings.loyaltyEnabled !== undefined ? settings.loyaltyEnabled : prev.loyaltyEnabled,
        loyaltyForRandomCustomers:
          settings.loyaltyForRandomCustomers !== undefined
            ? settings.loyaltyForRandomCustomers
            : prev.loyaltyForRandomCustomers,
        loyaltyRedeemEnabled:
          settings.loyaltyRedeemEnabled !== undefined
            ? settings.loyaltyRedeemEnabled
            : prev.loyaltyRedeemEnabled,
        loyaltyRedeemRatioPoints:
          settings.loyaltyRedeemRatioPoints ?? prev.loyaltyRedeemRatioPoints,
        loyaltyRedeemRatioRupees:
          settings.loyaltyRedeemRatioRupees ?? prev.loyaltyRedeemRatioRupees,
        loyaltyTiers:
          Array.isArray(settings.loyaltyTiers) && settings.loyaltyTiers.length
            ? settings.loyaltyTiers
            : prev.loyaltyTiers,
        loyaltyRedeemOptions:
          Array.isArray(settings.loyaltyRedeemOptions) && settings.loyaltyRedeemOptions.length
            ? settings.loyaltyRedeemOptions
            : prev.loyaltyRedeemOptions,
      }))
      setBranding((prev) => ({
        primaryColor: settings.primaryColor || prev.primaryColor,
        logoUrl: settings.logoUrl || prev.logoUrl,
        headerNotes: settings.headerNotes || prev.headerNotes,
        footerNotes: settings.footerNotes || prev.footerNotes,
        showGstBreakdown:
          settings.showGstBreakdown !== undefined
            ? settings.showGstBreakdown
            : prev.showGstBreakdown,
        showUpiQrCode:
          settings.showUpiQrCode !== undefined ? settings.showUpiQrCode : prev.showUpiQrCode,
        silentThermalPrint:
          settings.silentThermalPrint !== undefined
            ? settings.silentThermalPrint
            : prev.silentThermalPrint,
        printPaperSize: settings.printPaperSize || prev.printPaperSize,
        autoPrintOnSave:
          settings.autoPrintOnSave !== undefined ? settings.autoPrintOnSave : prev.autoPrintOnSave,
        shopSealUrl: settings.shopSealUrl || prev.shopSealUrl,
        signatorySignatureUrl: settings.signatorySignatureUrl || prev.signatorySignatureUrl,
        pdfShowType: settings.pdfShowType !== undefined ? settings.pdfShowType : prev.pdfShowType,
        pdfShowSides:
          settings.pdfShowSides !== undefined ? settings.pdfShowSides : prev.pdfShowSides,
        pdfShowUnitPrice:
          settings.pdfShowUnitPrice !== undefined
            ? settings.pdfShowUnitPrice
            : prev.pdfShowUnitPrice,
        pdfShowGstRate:
          settings.pdfShowGstRate !== undefined ? settings.pdfShowGstRate : prev.pdfShowGstRate,
        pdfColorTheme: settings.pdfColorTheme || prev.pdfColorTheme,
        pdfLegalFooter: settings.pdfLegalFooter || prev.pdfLegalFooter,
      }))
    }
  }, [settings])

  // Profile save
  const handleSaveBiz = async (e: any) => {
    e.preventDefault()
    try {
      await updateProfile({
        shop_name: biz.shopName,
        owner_name: biz.ownerName,
        phone: biz.phone,
        address: biz.address,
        gstin: biz.gstin,
        upi_id: biz.upiId,
      } as any)
      setBizSaved(true)
      setTimeout(() => setBizSaved(false), 3000)
      showToast?.('Business profile saved to cloud!', 'success')
    } catch (err) {
      console.error('Failed to save profile via query mutation:', err)
      showToast?.('Failed to save profile', 'error')
    }
  }

  // Accounting save
  const handleAcctSave = async (e: any) => {
    e.preventDefault()
    try {
      await updateSettings({
        gstRate: Number(acct.gstRate),
        viewMode: acct.viewMode,
        refundsEnabled: acct.refundsEnabled,
        fyInvoicePrefixing: acct.fyInvoicePrefixing,
      })
      setAcctSaved(true)
      setTimeout(() => setAcctSaved(false), 3000)
      showToast?.('Accounting settings saved to cloud!', 'success')
    } catch (err: any) {
      showToast?.(err?.message || 'Failed to save accounting settings', 'error')
    }
  }

  // Sequence save
  const handleSeqSave = async (e: any) => {
    e.preventDefault()
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
    try {
      await updateSettings(updated)
      await SequenceService.updateSequenceConfig('BILL', updated.invPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('CUSTOMER', updated.cusPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('INVENTORY', updated.itmPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('PAYMENT', updated.payPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('EXPENSE', updated.expPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('GROUP', updated.grpPrefix, cleanPadding)
      await SequenceService.updateSequenceConfig('CREDITNOTE', updated.cnPrefix, cleanPadding)
      setSeqSaved(true)
      setTimeout(() => setSeqSaved(false), 3000)
      showToast?.('Sequence and ID format settings saved!', 'success')
    } catch (err: any) {
      console.warn('Sync sequence config to server failed:', err)
      showToast?.(err?.message || 'Failed to save sequence settings', 'error')
    }
  }

  // WhatsApp save
  const handleWaSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateSettings({
        whatsappGreeting: waTemplates.whatsappGreeting.trim(),
        whatsappFooter: waTemplates.whatsappFooter.trim(),
        includeUpiInWhatsApp: waTemplates.includeUpiInWhatsApp,
      })
      setWaSaved(true)
      setTimeout(() => setWaSaved(false), 3000)
      showToast?.('WhatsApp notification templates saved!', 'success')
    } catch (err: any) {
      showToast?.(err?.message || 'Failed to save WhatsApp notification templates', 'error')
    }
  }

  // Loyalty save
  const handleLoyaltySave = async (e: any) => {
    e.preventDefault()
    try {
      await updateSettings({
        loyaltyEnabled: loyalty.loyaltyEnabled,
        loyaltyForRandomCustomers: loyalty.loyaltyForRandomCustomers,
        loyaltyRedeemEnabled: loyalty.loyaltyRedeemEnabled,
        loyaltyRedeemRatioPoints: Number(loyalty.loyaltyRedeemRatioPoints),
        loyaltyRedeemRatioRupees: Number(loyalty.loyaltyRedeemRatioRupees),
        loyaltyTiers: loyalty.loyaltyTiers
          .map((t) => ({
            from: Number(t.from),
            to: Number(t.to),
            points: Number(t.points),
          }))
          .filter((t) => t.from >= 0 && t.to >= t.from && t.points > 0),
        loyaltyRedeemOptions: loyalty.loyaltyRedeemOptions
          .map((o) => ({
            points: Number(o.points),
            rupees: Number(o.rupees),
          }))
          .filter((o) => o.points > 0 && o.rupees > 0)
          .sort((a, b) => a.points - b.points),
      })
      setLoyaltySaved(true)
      setTimeout(() => setLoyaltySaved(false), 3000)
      showToast?.('Loyalty program settings saved to cloud!', 'success')
    } catch (err: any) {
      showToast?.(err?.message || 'Failed to save loyalty settings', 'error')
    }
  }

  // Promo code handlers
  const handleAddPromo = async (e: any) => {
    e.preventDefault()
    const codeUpper = newPromo.code.trim().toUpperCase()
    if (!codeUpper) {
      alert('Please enter a coupon code.')
      return
    }
    const val = Number(newPromo.value)
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid discount value.')
      return
    }
    if (newPromo.type === 'percent' && val > 100) {
      alert('Percentage discount cannot exceed 100%.')
      return
    }
    const minAmt = Number(newPromo.minAmount || 0)

    if (promoCodes?.some((p) => p.code === codeUpper)) {
      alert('A coupon with this code already exists.')
      return
    }

    try {
      await createPromoCode({
        code: codeUpper,
        type: newPromo.type,
        value: val,
        minAmount: minAmt,
        startDate: newPromo.startDate || null,
        endDate: newPromo.endDate || null,
        enabled: newPromo.enabled,
      })
      setNewPromo({
        code: '',
        type: 'percent',
        value: '',
        minAmount: '',
        startDate: '',
        endDate: '',
        enabled: true,
      })
      showToast?.(`Promo code ${codeUpper} created successfully!`, 'success')
    } catch (err: any) {
      showToast?.(err?.message || 'Failed to create promo code', 'error')
    }
  }

  const handleDeletePromo = async (codeToDelete: string) => {
    const target = (promoCodes || []).find((p) => p.code === codeToDelete || p.id === codeToDelete)
    if (!target) return
    try {
      await deletePromoCode(target.id || target.code)
      showToast?.(`Promo code ${target.code} deleted`, 'info')
    } catch (err: any) {
      showToast?.(err?.message || 'Failed to delete promo code', 'error')
    }
  }

  const handleTogglePromoEnabled = async (codeToToggle: string) => {
    const target = (promoCodes || []).find((p) => p.code === codeToToggle || p.id === codeToToggle)
    if (!target) return
    const newEnabled = target.enabled === false
    try {
      await updatePromoCode({
        id: target.id || target.code,
        data: { enabled: newEnabled },
      })
      showToast?.(`Promo code ${target.code} ${newEnabled ? 'enabled' : 'disabled'}`, 'info')
    } catch (err: any) {
      showToast?.(err?.message || 'Failed to update promo code', 'error')
    }
  }

  // Branding handlers
  const handleBrandingSave = async (e: any) => {
    e.preventDefault()
    try {
      await updateSettings(branding)
      setBrandingSaved(true)
      setTimeout(() => setBrandingSaved(false), 3000)
      showToast?.('Branding settings saved to cloud!', 'success')
    } catch (err: any) {
      showToast?.(err?.message || 'Failed to save branding settings', 'error')
    }
  }

  const handleLogoUpload = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200000) {
      alert('Logo size should be under 200KB to fit browser storage.')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setBranding((prev) => ({ ...prev, logoUrl: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const handleClearLogo = () => {
    setBranding((prev) => ({ ...prev, logoUrl: '' }))
  }

  const handleSealUpload = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200000) {
      alert('Seal image should be under 200KB.')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setBranding((prev) => ({ ...prev, shopSealUrl: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const handleSignatureUpload = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200000) {
      alert('Signature image should be under 200KB.')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setBranding((prev) => ({ ...prev, signatorySignatureUrl: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>Settings & System Hub</span>
        </h1>
        <p>Enterprise configuration, data backups, CSV migrations & audit management.</p>
      </div>

      <div
        className="settings-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(250px, 300px) 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Sidebar Navigation */}
        <aside
          className="settings-sidebar"
          style={{
            background: 'var(--bg-card, #1e293b)',
            borderRadius: 'var(--radius-lg, 12px)',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {/* Tab Search Filter */}
          <div style={{ position: 'relative', marginBottom: '4px' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search settings..."
              value={tabSearch}
              onChange={(e) => setTabSearch(e.target.value)}
              className="aurora-input"
              style={{
                width: '100%',
                paddingLeft: '32px',
                height: '34px',
                fontSize: '0.8rem',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.25)',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {filteredTabs.map((tab) => {
              const Icon = tab.icon
              const isSelected = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: isSelected
                    ? '1px solid rgba(59, 130, 246, 0.4)'
                    : '1px solid transparent',
                  background: isSelected
                    ? 'rgba(59, 130, 246, 0.12)'
                    : 'transparent',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary, #94a3b8)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                    e.currentTarget.style.color = '#ffffff'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-secondary, #94a3b8)'
                  }
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSelected ? '#60a5fa' : tab.color,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: isSelected ? 700 : 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {tab.label}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: isSelected ? '#93c5fd' : 'var(--text-muted, #64748b)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '1px',
                    }}
                  >
                    {tab.sublabel}
                  </div>
                </div>
              </button>
            )
          })}
          </div>
        </aside>

        {/* Right Active Tab Content */}
        <main className="settings-content" style={{ minWidth: 0 }}>
          {activeTab === 'profile' && (
            <BusinessProfileTab
              biz={biz}
              setBiz={setBiz}
              handleSaveBiz={handleSaveBiz}
              bizSaved={bizSaved}
            />
          )}

          {activeTab === 'accounting' && (
            <AccountingTab
              acct={acct}
              setAcct={setAcct}
              handleAcctSave={handleAcctSave}
              acctSaved={acctSaved}
            />
          )}

          {activeTab === 'sequences' && (
            <SequencesTab
              seqConfigs={seqConfigs}
              setSeqConfigs={setSeqConfigs}
              handleSeqSave={handleSeqSave}
              seqSaved={seqSaved}
            />
          )}

          {activeTab === 'whatsapp' && (
            <WhatsAppTab
              waTemplates={waTemplates}
              setWaTemplates={setWaTemplates}
              handleWaSave={handleWaSave}
              waSaved={waSaved}
              waPreviewTab={waPreviewTab}
              setWaPreviewTab={setWaPreviewTab}
              invPrefix={seqConfigs.invPrefix}
              business={business}
            />
          )}

          {activeTab === 'loyalty' && (
            <LoyaltyTab
              loyalty={loyalty}
              setLoyalty={setLoyalty}
              handleLoyaltySave={handleLoyaltySave}
              loyaltySaved={loyaltySaved}
            />
          )}

          {activeTab === 'promos' && (
            <PromoCodesTab
              promoCodes={promoCodes}
              newPromo={newPromo}
              setNewPromo={setNewPromo}
              handleAddPromo={handleAddPromo}
              handleDeletePromo={handleDeletePromo}
              handleTogglePromoEnabled={handleTogglePromoEnabled}
            />
          )}

          {activeTab === 'branding' && (
            <BrandingTab
              branding={branding}
              setBranding={setBranding}
              handleBrandingSave={handleBrandingSave}
              brandingSaved={brandingSaved}
              handleLogoUpload={handleLogoUpload}
              handleClearLogo={handleClearLogo}
              handleSealUpload={handleSealUpload}
              handleSignatureUpload={handleSignatureUpload}
            />
          )}

          {activeTab === 'backup' && <BackupSnapshotTab />}
          {activeTab === 'import-export' && <DataImportExportTab />}
          {activeTab === 'recycle-bin' && <RecycleBinTab />}
          {activeTab === 'maintenance' && <MaintenanceTab />}
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .settings-layout {
            grid-template-columns: 1fr !important;
          }
          .settings-sidebar {
            flex-direction: row !important;
            overflow-x: auto !important;
            padding: 8px !important;
            gap: 8px !important;
          }
          .settings-sidebar button {
            flex: 0 0 auto !important;
            width: auto !important;
            padding: 8px 12px !important;
          }
        }
      `}</style>
    </div>
  )
}

export default Settings
