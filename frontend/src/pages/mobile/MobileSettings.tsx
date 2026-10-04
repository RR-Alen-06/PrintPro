import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useProfile, useProfileMutations } from '../../hooks/useProfileQuery'
import { useSettings, useSettingsMutations } from '../../hooks/useSettingsQuery'
import { useBills, useBillMutations, useDeletedBills } from '../../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import { useInventory, useInventoryMutations, usePayments, useAdvancePayments } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'
import { useGroupBills } from '../../hooks/useGroupBillsQuery'
import { clearAllCloudData, clearTransactionRecords } from '../../lib/syncService'
import { useQueryClient } from '@tanstack/react-query'
import { SequenceService } from '../../services/sequenceService'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  createFullBackup,
  exportToJSON,
  exportBillsToCSV,
  exportCustomersToCSV,
  exportInventoryToCSV,
  exportPaymentsToCSV,
  exportExpensesToCSV,
  exportAdvancesToCSV,
} from '../../utils/dataExport'
import {
  importFromJSON,
  importFromCSV,
  importCustomersFromCSV,
  importInventoryFromCSV,
  restoreFromBackup,
} from '../../utils/dataImport'
import {
  Building2, Palette, Hash, MessageSquare, Gift, Globe,
  Database, FileSpreadsheet, Trash2, Sliders, HardDrive, Download,
  Upload, RefreshCw, RotateCcw, Save, AlertTriangle, Tag, Plus
} from 'lucide-react'
import '../../styles/mobile.css'

const MODULE_TABS = [
  { id: 'profile', label: 'Profile', icon: Building2, color: 'var(--accent-primary)' },
  { id: 'branding', label: 'Branding', icon: Palette, color: '#ec4899' },
  { id: 'accounting', label: 'Regional & Tax', icon: Globe, color: 'var(--warning)' },
  { id: 'categories', label: 'Categories & Units', icon: Tag, color: '#f59e0b' },
  { id: 'sequences', label: 'Prefixes', icon: Hash, color: '#3b82f6' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: '#25D366' },
  { id: 'loyalty', label: 'Loyalty', icon: Gift, color: '#a855f7' },
  { id: 'backup', label: 'Backup', icon: Database, color: '#00f0ff' },
  { id: 'import-export', label: 'CSV Hub', icon: FileSpreadsheet, color: '#10b981' },
  { id: 'recycle-bin', label: 'Trash', icon: Trash2, color: '#ef4444' },
  { id: 'maintenance', label: 'System', icon: Sliders, color: 'var(--error)' },
]

export default function MobileSettings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'profile'
  const setActiveTab = (tab: string) => setSearchParams({ tab })

  const queryClient = useQueryClient()
  const {
    business,
    showToast,
    syncFromCloud,
    bills: ctxBills = [],
    customers: ctxCustomers = [],
    inventory: ctxInventory = [],
    payments: ctxPayments = [],
    expenses: ctxExpenses = [],
    advancePayments: ctxAdvances = [],
    customerGroups: ctxGroups = [],
    counters = {},
    sequences = {},
  } = useAppContext()

  const { data: serverProfile } = useProfile()
  const { updateProfile } = useProfileMutations()
  const { settings = {} } = useSettings()
  const { updateSettings } = useSettingsMutations()

  // Queries for Data & Trash
  const { data: serverBills = [] } = useBills()
  const { data: serverDeletedBills = [], refetch: refetchDeleted } = useDeletedBills()
  const {
    restoreBill: restoreBillMutation,
    purgeAllDeletedBills: purgeAllDeletedBillsMutation,
  } = useBillMutations()
  const { data: serverCustomers = [] } = useCustomers()
  const { data: serverInventory = [] } = useInventory()
  const { data: serverPayments = [] } = usePayments()
  const { data: serverExpenses = [] } = useExpenses()
  const { data: serverAdvances = [] } = useAdvancePayments()
  const { groupBills: serverGroups = [] } = useGroupBills()

  const { createCustomer } = useCustomerMutations()
  const { createItem } = useInventoryMutations()

  const allBills = serverBills.length > 0 ? serverBills : ctxBills
  const activeBills = allBills.filter((b) => !b.deleted && !b.deleted_at)
  const deletedBills = serverDeletedBills.length > 0
    ? serverDeletedBills
    : allBills.filter((b) => b && (b.deleted || b.deleted_at))

  // Business state
  const [biz, setBiz] = useState({
    shopName: business.shopName || '',
    ownerName: business.ownerName || '',
    phone: business.phone || '',
    address: business.address || '',
    gstin: business.gstin || '',
    upiId: business.upiId || '',
  })

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

  // Sequence state
  const [seqConfigs, setSeqConfigs] = useState({
    invPrefix: settings.invPrefix || 'INV',
    cusPrefix: settings.cusPrefix || 'CUS',
    itmPrefix: settings.itmPrefix || 'ITM',
    payPrefix: settings.payPrefix || 'PAY',
    expPrefix: settings.expPrefix || 'EXP',
    grpPrefix: settings.grpPrefix || 'GRP',
    seqPadding: settings.seqPadding || 6,
  })

  // WhatsApp state
  const [waTemplates, setWaTemplates] = useState({
    whatsappGreeting: settings.whatsappGreeting || 'Dear *{customer_name}*,',
    whatsappFooter: settings.whatsappFooter || 'Thank you for choosing *{shop_name}*! Contact: {phone}.',
    includeUpiInWhatsApp: settings.includeUpiInWhatsApp !== false,
  })

  // Regional, Currency & Tax preferences state
  const [currencySymbol, setCurrencySymbol] = useState(settings.currency || '₹')
  const [currencyCode, setCurrencyCode] = useState(settings.currencyCode || 'INR')
  const [taxLabel, setTaxLabel] = useState(settings.taxLabel || 'GST')
  const [gstRate, setGstRate] = useState(settings.gstRate ?? 0)
  const [enableUpi, setEnableUpi] = useState(settings.enableUpi !== false)

  // Branding state
  const [branding, setBranding] = useState({
    logoUrl: settings.logoUrl || '',
    shopSealUrl: settings.shopSealUrl || '',
    headerNotes: settings.headerNotes || '',
    footerNotes: settings.footerNotes || '',
    showUpiQrCode: settings.showUpiQrCode !== false,
  })

  // Custom Business Categories & Units State
  const [customCategories, setCustomCategories] = useState<string[]>(
    settings.customCategories || ['Standard Print', 'Document Services', 'Binding & Lamination', 'Merchandise', 'Design & Scanning']
  )
  const [newCatInput, setNewCatInput] = useState('')

  const [customUnits, setCustomUnits] = useState<string[]>(
    settings.customUnits || ['pages', 'pcs', 'copies', 'sets', 'sq ft', 'books', 'meters', 'hrs']
  )
  const [newUnitInput, setNewUnitInput] = useState('')

  // Loyalty program configuration state
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(settings.loyaltyEnabled !== false)
  const [loyaltyForRandomCustomers, setLoyaltyForRandomCustomers] = useState(settings.loyaltyForRandomCustomers ?? true)
  const [loyaltyEarningRate, setLoyaltyEarningRate] = useState(settings.loyaltyEarningRate ?? 100) // Spend ₹X per 1 pt
  const [loyaltyRedeemRatioPoints, setLoyaltyRedeemRatioPoints] = useState(settings.loyaltyRedeemRatioPoints ?? 100)
  const [loyaltyRedeemRatioRupees, setLoyaltyRedeemRatioRupees] = useState(settings.loyaltyRedeemRatioRupees ?? 10)
  const [loyaltyMinRedemptionPoints, setLoyaltyMinRedemptionPoints] = useState(settings.loyaltyMinRedemptionPoints ?? 20)

  // Storage & Backup state
  const [isExporting, setIsExporting] = useState(false)
  const [isSyncingCloud, setIsSyncingCloud] = useState(false)
  const [storageUsedKb, setStorageUsedKb] = useState(0)

  const handle1ClickSnapshot = async () => {
    setIsExporting(true)
    try {
      const backupData = createFullBackup({
        business,
        settings,
        bills: activeBills,
        customers: serverCustomers.length ? serverCustomers : ctxCustomers,
        inventory: serverInventory.length ? serverInventory : ctxInventory,
        payments: serverPayments.length ? serverPayments : ctxPayments,
        expenses: serverExpenses.length ? serverExpenses : ctxExpenses,
        advancePayments: serverAdvances.length ? serverAdvances : ctxAdvances,
        customerGroups: serverGroups.length ? serverGroups : ctxGroups,
        promoCodes: [],
        counters,
        sequences,
      })
      exportToJSON(backupData, `printpro_backup_${new Date().toISOString().slice(0, 10)}.json`)
      showToast?.('Database snapshot exported successfully!', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast?.(`Export failed: ${msg}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleForceCloudSync = async () => {
    setIsSyncingCloud(true)
    try {
      await syncFromCloud?.()
      await queryClient.invalidateQueries()
      showToast?.('Cloud database synchronized seamlessly!', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast?.(`Sync warning: ${msg}`, 'error')
    } finally {
      setIsSyncingCloud(false)
    }
  }

  useEffect(() => {
    let bytes = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('printpro') || key.startsWith('offline_queue'))) {
        const val = localStorage.getItem(key) || ''
        bytes += (key.length + val.length) * 2
      }
    }
    setStorageUsedKb(Math.round(bytes / 1024))
  }, [allBills])

  // Recycle Bin Search & Selection
  const [trashSearch, setTrashSearch] = useState('')
  const [selectedTrashIds, setSelectedTrashIds] = useState([])
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)
  const [isProcessingTrash, setIsProcessingTrash] = useState(false)

  const filteredTrashBills = useMemo(() => {
    return deletedBills.filter((b) => {
      if (!b) return false
      if (!trashSearch.trim()) return true
      const q = trashSearch.toLowerCase().trim()
      const inv = String(b.invoiceNumber || b.invoice_number || b.id || '').toLowerCase()
      const cust = String(b.customerName || b.customer_name || '').toLowerCase()
      return inv.includes(q) || cust.includes(q)
    })
  }, [deletedBills, trashSearch])

  // Reset Modals
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetText, setResetText] = useState('')
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false)
  const [factoryText, setFactoryText] = useState('')

  // Handlers
  const handleSaveBusiness = async (e) => {
    e.preventDefault()
    try {
      await updateProfile({
        shop_name: biz.shopName,
        owner_name: biz.ownerName,
        phone: biz.phone,
        address: biz.address,
        gstin: biz.gstin,
        upi_id: biz.upiId,
      })
      showToast?.('Business profile saved', 'success')
    } catch (err) {
      showToast?.(`Save failed: ${err.message || err}`, 'error')
    }
  }

  const handleSaveSettings = async () => {
    try {
      await updateSettings({
        ...settings,
        ...seqConfigs,
        ...waTemplates,
        ...branding,
        currency: currencySymbol,
        currencyCode: currencyCode,
        taxLabel: taxLabel,
        gstRate: Number(gstRate),
        enableUpi: enableUpi,
        showUpiQrCode: enableUpi,
        customCategories,
        customUnits,
        loyaltyEnabled,
        loyaltyForRandomCustomers,
        loyaltyEarningRate: Number(loyaltyEarningRate),
        loyaltyRedeemRatioPoints: Number(loyaltyRedeemRatioPoints),
        loyaltyRedeemRatioRupees: Number(loyaltyRedeemRatioRupees),
        loyaltyMinRedemptionPoints: Number(loyaltyMinRedemptionPoints),
      })
      showToast?.('Configuration saved', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast?.(`Save failed: ${msg}`, 'error')
    }
  }

  const handleRestoreOneTrash = async (id: string) => {
    try {
      setIsProcessingTrash(true)
      await restoreBillMutation(id)
      setSelectedTrashIds((prev) => prev.filter((i) => i !== id))
      showToast?.('Bill restored to active list', 'success')
      refetchDeleted()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast?.(`Restore failed: ${msg}`, 'error')
    } finally {
      setIsProcessingTrash(false)
    }
  }

  const handleBulkRestoreTrash = async () => {
    if (selectedTrashIds.length === 0) return
    try {
      setIsProcessingTrash(true)
      for (const id of selectedTrashIds) {
        await restoreBillMutation(id)
      }
      showToast?.(`Restored ${selectedTrashIds.length} bills`, 'success')
      setSelectedTrashIds([])
      refetchDeleted()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast?.(`Bulk restore error: ${msg}`, 'error')
    } finally {
      setIsProcessingTrash(false)
    }
  }

  const handleEmptyTrash = async () => {
    try {
      setIsProcessingTrash(true)
      await purgeAllDeletedBillsMutation()
      showToast?.('Recycle bin emptied', 'success')
      setConfirmEmptyTrash(false)
      setSelectedTrashIds([])
      refetchDeleted()
    } catch (err) {
      showToast?.(`Purge failed: ${err.message || err}`, 'error')
    } finally {
      setIsProcessingTrash(false)
    }
  }

  return (
    <MobileLayout title="Settings & System Hub">
      {/* 1. TOP QUICK ACTION HERO CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <div
          onClick={handle1ClickSnapshot}
          className="mobile-card"
          style={{
            padding: '10px 8px',
            textAlign: 'center',
            cursor: 'pointer',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            background: 'linear-gradient(180deg, rgba(0, 240, 255, 0.1) 0%, rgba(10, 5, 20, 0.6) 100%)',
          }}
        >
          <Database size={18} style={{ color: '#00f0ff', margin: '0 auto 4px auto' }} />
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f8fafc' }}>Snapshot</div>
          <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>1-Click JSON</div>
        </div>

        <div
          onClick={async () => {
            showToast?.('Syncing with Supabase cloud...', 'info')
            await syncFromCloud?.()
            await queryClient.invalidateQueries()
            showToast?.('Cloud sync complete', 'success')
          }}
          className="mobile-card"
          style={{
            padding: '10px 8px',
            textAlign: 'center',
            cursor: 'pointer',
            border: '1px solid rgba(0, 255, 171, 0.3)',
            background: 'linear-gradient(180deg, rgba(0, 255, 171, 0.1) 0%, rgba(10, 5, 20, 0.6) 100%)',
          }}
        >
          <RefreshCw size={18} style={{ color: '#00ffab', margin: '0 auto 4px auto' }} />
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f8fafc' }}>Cloud Sync</div>
          <div style={{ fontSize: '0.62rem', color: '#00ffab' }}>Online</div>
        </div>

        <div
          onClick={() => setActiveTab('recycle-bin')}
          className="mobile-card"
          style={{
            padding: '10px 8px',
            textAlign: 'center',
            cursor: 'pointer',
            border: `1px solid ${deletedBills.length > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.1) 0%, rgba(10, 5, 20, 0.6) 100%)',
          }}
        >
          <Trash2 size={18} style={{ color: deletedBills.length > 0 ? '#ef4444' : '#94a3b8', margin: '0 auto 4px auto' }} />
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f8fafc' }}>Trash Bin</div>
          <div style={{ fontSize: '0.62rem', color: deletedBills.length > 0 ? '#ef4444' : '#94a3b8', fontWeight: 700 }}>
            {deletedBills.length} Bills
          </div>
        </div>
      </div>

      {/* 2. HORIZONTAL SWIPEABLE TAB PILLS */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '14px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {MODULE_TABS.map((tab) => {
          const Icon = tab.icon
          const isSelected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '999px',
                border: isSelected ? `1px solid ${tab.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                background: isSelected ? `${tab.color}26` : 'rgba(255, 255, 255, 0.04)',
                color: isSelected ? '#ffffff' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: isSelected ? 700 : 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <Icon size={14} style={{ color: isSelected ? tab.color : 'inherit' }} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* 3. ACTIVE TAB CONTENT VIEW */}

      {/* TAB: PROFILE */}
      {activeTab === 'profile' && (
        <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Building2 size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Business Profile
            </h3>
          </div>
          <form onSubmit={handleSaveBusiness} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                Store Name
              </label>
              <input
                type="text"
                className="mobile-input"
                value={biz.shopName}
                onChange={(e) => setBiz({ ...biz, shopName: e.target.value })}
                placeholder="PrintPro Station"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                Owner Name
              </label>
              <input
                type="text"
                className="mobile-input"
                value={biz.ownerName}
                onChange={(e) => setBiz({ ...biz, ownerName: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                Phone / WhatsApp
              </label>
              <input
                type="text"
                className="mobile-input"
                value={biz.phone}
                onChange={(e) => setBiz({ ...biz, phone: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                UPI ID (VPA)
              </label>
              <input
                type="text"
                className="mobile-input"
                value={biz.upiId}
                onChange={(e) => setBiz({ ...biz, upiId: e.target.value })}
                placeholder="shop@upi"
              />
            </div>
            <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '6px' }}>
              <Save size={16} /> Save Business Profile
            </button>
          </form>
        </div>
      )}

      {/* TAB: BRANDING */}
      {activeTab === 'branding' && (
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Palette size={18} style={{ color: '#ec4899' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Invoice Branding & Print Style
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                Header Note
              </label>
              <input
                type="text"
                className="mobile-input"
                value={branding.headerNotes}
                onChange={(e) => setBranding({ ...branding, headerNotes: e.target.value })}
                placeholder="Tax Invoice / Cash Memo"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                Footer Terms
              </label>
              <textarea
                className="mobile-input"
                rows={2}
                value={branding.footerNotes}
                onChange={(e) => setBranding({ ...branding, footerNotes: e.target.value })}
                placeholder="Goods once sold will not be taken back."
              />
            </div>
            <button onClick={handleSaveSettings} className="mobile-btn mobile-btn-primary">
              <Save size={16} /> Save Branding
            </button>
          </div>
        </div>
      )}

      {/* TAB: REGIONAL, CURRENCY & TAX */}
      {activeTab === 'accounting' && (
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Globe size={18} style={{ color: 'var(--warning)' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Regional, Currency & Tax Preferences
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                  Currency Symbol
                </label>
                <input
                  type="text"
                  className="mobile-input"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="₹, $, €, £"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                  Currency Code
                </label>
                <input
                  type="text"
                  className="mobile-input"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                  placeholder="INR, USD, EUR"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                  Tax Label
                </label>
                <input
                  type="text"
                  className="mobile-input"
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  placeholder="GST, VAT, Sales Tax"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                  Default Tax Rate (%)
                </label>
                <input
                  type="number"
                  className="mobile-input"
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f8fafc' }}>UPI Payment Links & QR Codes</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Include UPI settlement links and printable QR on receipts</div>
              </div>
              <input
                type="checkbox"
                checked={enableUpi}
                onChange={(e) => setEnableUpi(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-secondary)' }}
              />
            </div>

            <button onClick={handleSaveSettings} className="mobile-btn mobile-btn-primary" style={{ marginTop: '4px' }}>
              <Save size={16} /> Save Regional Configuration
            </button>
          </div>
        </div>
      )}

      {/* TAB: CATEGORIES & MEASUREMENT UNITS */}
      {activeTab === 'categories' && (
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Tag size={18} style={{ color: '#f59e0b' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Custom Categories & Units
            </h3>
          </div>

          {/* Service & Product Categories */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>
              BUSINESS SERVICE CATEGORIES
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {customCategories.map((cat, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  {cat}
                  <button
                    type="button"
                    onClick={() => setCustomCategories(customCategories.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}
                    title="Remove Category"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="mobile-input"
                placeholder="e.g. 3D Printing, Vinyl/Flex, Photography..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCatInput.trim()) {
                    e.preventDefault()
                    if (!customCategories.includes(newCatInput.trim())) {
                      setCustomCategories([...customCategories, newCatInput.trim()])
                    }
                    setNewCatInput('')
                  }
                }}
              />
              <button
                type="button"
                className="mobile-btn"
                style={{ width: 'auto', padding: '0 14px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}
                onClick={() => {
                  if (newCatInput.trim() && !customCategories.includes(newCatInput.trim())) {
                    setCustomCategories([...customCategories, newCatInput.trim()])
                    setNewCatInput('')
                  }
                }}
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          {/* Measurement Units */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>
              MEASUREMENT UNITS & QUANTITY TYPES
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {customUnits.map((unit, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  {unit}
                  <button
                    type="button"
                    onClick={() => setCustomUnits(customUnits.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}
                    title="Remove Unit"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="mobile-input"
                placeholder="e.g. sq ft, pages, pcs, copies, sets, books, hrs..."
                value={newUnitInput}
                onChange={(e) => setNewUnitInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newUnitInput.trim()) {
                    e.preventDefault()
                    if (!customUnits.includes(newUnitInput.trim())) {
                      setCustomUnits([...customUnits, newUnitInput.trim()])
                    }
                    setNewUnitInput('')
                  }
                }}
              />
              <button
                type="button"
                className="mobile-btn"
                style={{ width: 'auto', padding: '0 14px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' }}
                onClick={() => {
                  if (newUnitInput.trim() && !customUnits.includes(newUnitInput.trim())) {
                    setCustomUnits([...customUnits, newUnitInput.trim()])
                    setNewUnitInput('')
                  }
                }}
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          <button onClick={handleSaveSettings} className="mobile-btn mobile-btn-primary">
            <Save size={16} /> Save Categories & Units
          </button>
        </div>
      )}

      {/* TAB: SEQUENCES */}
      {activeTab === 'sequences' && (
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Hash size={18} style={{ color: '#3b82f6' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Sequences & Display Codes
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '2px' }}>Invoice Prefix</label>
              <input
                type="text"
                className="mobile-input"
                value={seqConfigs.invPrefix}
                onChange={(e) => setSeqConfigs({ ...seqConfigs, invPrefix: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '2px' }}>Customer Prefix</label>
              <input
                type="text"
                className="mobile-input"
                value={seqConfigs.cusPrefix}
                onChange={(e) => setSeqConfigs({ ...seqConfigs, cusPrefix: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
          <button onClick={handleSaveSettings} className="mobile-btn mobile-btn-primary">
            <Save size={16} /> Save Prefixes
          </button>
        </div>
      )}

      {/* TAB: WHATSAPP */}
      {activeTab === 'whatsapp' && (
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <MessageSquare size={18} style={{ color: '#25D366' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              WhatsApp Messaging Template
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '2px' }}>Greeting</label>
              <input
                type="text"
                className="mobile-input"
                value={waTemplates.whatsappGreeting}
                onChange={(e) => setWaTemplates({ ...waTemplates, whatsappGreeting: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '2px' }}>Footer Note</label>
              <textarea
                className="mobile-input"
                rows={2}
                value={waTemplates.whatsappFooter}
                onChange={(e) => setWaTemplates({ ...waTemplates, whatsappFooter: e.target.value })}
              />
            </div>
            <button onClick={handleSaveSettings} className="mobile-btn mobile-btn-primary">
              <Save size={16} /> Save WhatsApp Template
            </button>
          </div>
        </div>
      )}

      {/* TAB: LOYALTY */}
      {activeTab === 'loyalty' && (
        <div className="mobile-card mobile-card-glow" style={{ borderColor: '#a855f7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Gift size={18} style={{ color: '#a855f7' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Customer Loyalty & Rewards Program
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(168, 85, 247, 0.08)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>Enable Loyalty System</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Reward clients with points on every order</div>
              </div>
              <input
                type="checkbox"
                checked={loyaltyEnabled}
                onChange={(e) => setLoyaltyEnabled(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#a855f7' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>Allow Walk-in / Cash Clients</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Include unregistered walk-ins in loyalty points</div>
              </div>
              <input
                type="checkbox"
                checked={loyaltyForRandomCustomers}
                onChange={(e) => setLoyaltyForRandomCustomers(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#a855f7' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                Earning Rate (₹ Spend to Earn 1 Point)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  className="mobile-input"
                  value={loyaltyEarningRate}
                  onChange={(e) => setLoyaltyEarningRate(Number(e.target.value))}
                  placeholder="100"
                />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                  ₹ per 1 pt
                </span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                Redemption Value Ratio (Points to Cash Value)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="mobile-input"
                    value={loyaltyRedeemRatioPoints}
                    onChange={(e) => setLoyaltyRedeemRatioPoints(Number(e.target.value))}
                    placeholder="100"
                  />
                  <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', color: '#94a3b8' }}>
                    pts
                  </span>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#a855f7' }}>=</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="mobile-input"
                    value={loyaltyRedeemRatioRupees}
                    onChange={(e) => setLoyaltyRedeemRatioRupees(Number(e.target.value))}
                    placeholder="10"
                  />
                  <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', color: '#94a3b8' }}>
                    ₹
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                Minimum Points Threshold to Redeem
              </label>
              <input
                type="number"
                className="mobile-input"
                value={loyaltyMinRedemptionPoints}
                onChange={(e) => setLoyaltyMinRedemptionPoints(Number(e.target.value))}
                placeholder="20"
              />
            </div>

            <button onClick={handleSaveSettings} className="mobile-btn mobile-btn-primary" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', marginTop: '6px' }}>
              <Save size={16} /> Save Loyalty Program
            </button>
          </div>
        </div>
      )}

      {/* TAB: DATABASE MANAGEMENT & BACKUP */}
      {activeTab === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 1. Database Health & Live Table Metrics */}
          <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--aurora-cyan, #00f0ff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} style={{ color: 'var(--aurora-cyan, #00f0ff)' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Cloud PostgreSQL Database
                </h3>
              </div>
              <span className="mobile-badge mobile-badge-success" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                ONLINE & SYNCED
              </span>
            </div>

            {/* Live Table Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
              {[
                { label: 'BILLS', count: activeBills.length, color: '#00f0ff' },
                { label: 'CLIENTS', count: serverCustomers.length || ctxCustomers.length, color: '#ec4899' },
                { label: 'ITEMS', count: serverInventory.length || ctxInventory.length, color: '#3b82f6' },
                { label: 'PAYMENTS', count: serverPayments.length || ctxPayments.length, color: '#10b981' },
                { label: 'EXPENSES', count: serverExpenses.length || ctxExpenses.length, color: '#f59e0b' },
                { label: 'ADVANCES', count: serverAdvances.length || ctxAdvances.length, color: '#a855f7' },
                { label: 'TRASH', count: deletedBills.length, color: '#ef4444' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '8px 4px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 800 }}>{stat.label}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 900, color: stat.color, marginTop: '2px' }}>
                    {stat.count}
                  </div>
                </div>
              ))}
            </div>

            {/* Force Sync Action */}
            <button
              onClick={handleForceCloudSync}
              disabled={isSyncingCloud}
              className="mobile-btn mobile-btn-secondary"
              style={{ width: '100%', fontSize: '0.78rem', minHeight: '34px' }}
            >
              <RefreshCw size={14} className={isSyncingCloud ? 'spin-animation' : ''} />
              {isSyncingCloud ? 'Syncing Cloud Database...' : 'Force Cloud Database Sync'}
            </button>
          </div>

          {/* 2. Automated Multi-Table JSON Snapshot */}
          <div className="mobile-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <HardDrive size={16} style={{ color: '#00f0ff' }} />
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Multi-Table JSON Backup & Restore
              </h4>
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Creates an encrypted, self-contained snapshot of all registers (Bills, Customers, Inventory, Payments, Expenses, and Settings).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={handle1ClickSnapshot}
                disabled={isExporting}
                className="mobile-btn mobile-btn-primary"
                style={{ fontSize: '0.78rem', minHeight: '36px' }}
              >
                <Download size={15} /> {isExporting ? 'Exporting...' : 'Export Snapshot'}
              </button>

              <label className="mobile-btn mobile-btn-secondary" style={{ cursor: 'pointer', fontSize: '0.78rem', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Upload size={15} />
                <span>Restore JSON</span>
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      const data = await importFromJSON(f)
                      await restoreFromBackup(data)
                      await queryClient.invalidateQueries()
                      showToast?.('System restored! Reloading...', 'success')
                      setTimeout(() => window.location.reload(), 1000)
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : String(err)
                      showToast?.(`Restore failed: ${msg}`, 'error')
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* 3. Local Cache Storage Footprint */}
          <div className="mobile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Local Storage Cache
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  ~{storageUsedKb} KB cached for instant zero-latency offline loading.
                </div>
              </div>
              <button
                onClick={() => {
                  queryClient.clear()
                  showToast?.('Client query cache flushed!', 'success')
                }}
                className="mobile-btn mobile-btn-secondary"
                style={{ width: 'auto', padding: '4px 10px', fontSize: '0.72rem', minHeight: '28px' }}
              >
                Flush Cache
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CSV HUB */}
      {activeTab === 'import-export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="mobile-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <FileSpreadsheet size={18} style={{ color: '#10b981' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                CSV Data Export
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button onClick={() => exportBillsToCSV(activeBills)} className="mobile-btn mobile-btn-secondary" style={{ fontSize: '0.75rem' }}>
                <Download size={14} /> Bills CSV
              </button>
              <button onClick={() => exportCustomersToCSV(serverCustomers.length ? serverCustomers : ctxCustomers)} className="mobile-btn mobile-btn-secondary" style={{ fontSize: '0.75rem' }}>
                <Download size={14} /> Customers CSV
              </button>
              <button onClick={() => exportInventoryToCSV(serverInventory.length ? serverInventory : ctxInventory)} className="mobile-btn mobile-btn-secondary" style={{ fontSize: '0.75rem' }}>
                <Download size={14} /> Inventory CSV
              </button>
              <button onClick={() => exportPaymentsToCSV(serverPayments.length ? serverPayments : ctxPayments)} className="mobile-btn mobile-btn-secondary" style={{ fontSize: '0.75rem' }}>
                <Download size={14} /> Payments CSV
              </button>
              <button onClick={() => exportExpensesToCSV(serverExpenses.length ? serverExpenses : ctxExpenses)} className="mobile-btn mobile-btn-secondary" style={{ fontSize: '0.75rem' }}>
                <Download size={14} /> Expenses CSV
              </button>
              <button onClick={() => exportAdvancesToCSV(serverAdvances.length ? serverAdvances : ctxAdvances)} className="mobile-btn mobile-btn-secondary" style={{ fontSize: '0.75rem' }}>
                <Download size={14} /> Advances CSV
              </button>
            </div>
          </div>

          <div className="mobile-card">
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 10px 0', color: '#f8fafc' }}>
              Bulk Ingestion
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="mobile-btn mobile-btn-secondary" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                <span>Import Customers CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      const rows = await importFromCSV(f)
                      const list = importCustomersFromCSV(rows)
                      for (const c of list) {
                        if (c.name && c.name !== 'Unnamed') await createCustomer(c)
                      }
                      await queryClient.invalidateQueries({ queryKey: ['customers'] })
                      showToast?.(`Imported ${list.length} customers`, 'success')
                    } catch (err) {
                      showToast?.(`Import error: ${err.message || err}`, 'error')
                    }
                  }}
                />
              </label>

              <label className="mobile-btn mobile-btn-secondary" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                <span>Import Inventory CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      const rows = await importFromCSV(f)
                      const list = importInventoryFromCSV(rows)
                      for (const it of list) {
                        if (it.name && it.name !== 'Unnamed Item') await createItem(it)
                      }
                      await queryClient.invalidateQueries({ queryKey: ['inventory'] })
                      showToast?.(`Imported ${list.length} items`, 'success')
                    } catch (err) {
                      showToast?.(`Import error: ${err.message || err}`, 'error')
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB: RECYCLE BIN */}
      {activeTab === 'recycle-bin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="mobile-card mobile-card-glow" style={{ borderColor: '#ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={18} style={{ color: '#ef4444' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  Recycle Bin ({deletedBills.length})
                </h3>
              </div>
              {deletedBills.length > 0 && (
                <button
                  onClick={() => setConfirmEmptyTrash(true)}
                  className="mobile-btn mobile-btn-danger"
                  style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                >
                  Empty Trash
                </button>
              )}
            </div>

            <input
              type="text"
              placeholder="Search deleted invoices..."
              value={trashSearch}
              onChange={(e) => setTrashSearch(e.target.value)}
              className="mobile-input"
              style={{ marginBottom: '10px', fontSize: '0.8rem' }}
            />

            {selectedTrashIds.length > 0 && (
              <button
                onClick={handleBulkRestoreTrash}
                disabled={isProcessingTrash}
                className="mobile-btn mobile-btn-primary"
                style={{ marginBottom: '10px' }}
              >
                <RotateCcw size={14} /> Restore {selectedTrashIds.length} Selected Bills
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTrashBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                  Trash bin is empty.
                </div>
              ) : (
                filteredTrashBills.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#00f0ff', fontSize: '0.82rem' }}>
                        {b.invoiceNumber || SequenceService.formatDisplayCode('bill', b.id, 'INV')}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#f8fafc' }}>
                        {b.customerName || 'Walk-in'} • ₹{Number(b.total || 0).toFixed(2)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleRestoreOneTrash(b.id)}
                        disabled={isProcessingTrash}
                        className="mobile-btn mobile-btn-secondary"
                        style={{ padding: '6px 10px', color: '#00ffab', borderColor: 'rgba(0, 255, 171, 0.3)' }}
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: SYSTEM & DANGER ZONE */}
      {activeTab === 'maintenance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--error)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--error)' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                System Danger Zone
              </h3>
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Permanent operations for clearing transactions or returning terminal to factory state.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => setShowResetModal(true)}
                className="mobile-btn mobile-btn-danger"
              >
                Clear Transaction Records
              </button>

              <button
                onClick={() => setShowFactoryResetModal(true)}
                className="mobile-btn mobile-btn-danger"
                style={{ background: '#7f1d1d' }}
              >
                Full Factory Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {confirmEmptyTrash && (
        <BottomSheet isOpen={confirmEmptyTrash} onClose={() => setConfirmEmptyTrash(false)} title="Empty Recycle Bin">
          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#fca5a5' }}>
              Are you sure you want to permanently erase all deleted bills? This action cannot be reversed.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmEmptyTrash(false)} className="mobile-btn mobile-btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleEmptyTrash} className="mobile-btn mobile-btn-danger" style={{ flex: 1 }}>
                Purge All
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {showResetModal && (
        <BottomSheet isOpen={showResetModal} onClose={() => setShowResetModal(false)} title="Clear Transactions">
          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#fca5a5' }}>
              Type <strong>RESET</strong> in capital letters to confirm deleting all bills, payments, and expenses.
            </p>
            <input
              type="text"
              className="mobile-input"
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              placeholder="RESET"
            />
            <button
              onClick={async () => {
                if (resetText.trim() !== 'RESET') {
                  showToast?.('Type RESET to confirm', 'error')
                  return
                }
                await clearTransactionRecords()
                queryClient.clear()
                showToast?.('Transactions wiped! Reloading...', 'success')
                setTimeout(() => window.location.reload(), 1000)
              }}
              className="mobile-btn mobile-btn-danger"
            >
              Confirm Wipe
            </button>
          </div>
        </BottomSheet>
      )}

      {showFactoryResetModal && (
        <BottomSheet isOpen={showFactoryResetModal} onClose={() => setShowFactoryResetModal(false)} title="Factory Reset">
          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#fca5a5' }}>
              Type <strong>FACTORY RESET</strong> to wipe all data and return to blank state.
            </p>
            <input
              type="text"
              className="mobile-input"
              value={factoryText}
              onChange={(e) => setFactoryText(e.target.value)}
              placeholder="FACTORY RESET"
            />
            <button
              onClick={async () => {
                if (factoryText.trim() !== 'FACTORY RESET') {
                  showToast?.('Type FACTORY RESET to confirm', 'error')
                  return
                }
                await clearAllCloudData()
                queryClient.clear()
                showToast?.('Factory reset complete! Reloading...', 'success')
                setTimeout(() => window.location.reload(), 1000)
              }}
              className="mobile-btn mobile-btn-danger"
            >
              Execute Factory Reset
            </button>
          </div>
        </BottomSheet>
      )}

    </MobileLayout>
  )
}
