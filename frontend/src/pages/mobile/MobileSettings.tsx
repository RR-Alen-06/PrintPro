import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useProfile, useProfileMutations } from '../../hooks/useProfileQuery'
import { useSettings, useSettingsMutations } from '../../hooks/useSettingsQuery'
import { usePromoCodes, usePromoCodeMutations } from '../../hooks/usePromoCodesQuery'
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
  exportGroupsToCSV,
} from '../../utils/dataExport'
import {
  importFromJSON,
  importFromCSV,
  importCustomersFromCSV,
  importInventoryFromCSV,
  validateBackupFile,
  restoreFromBackup,
} from '../../utils/dataImport'
import {
  Building2, Palette, BarChart3, Hash, MessageSquare, Gift, Tag,
  Database, FileSpreadsheet, Trash2, Sliders, HardDrive, Download,
  Upload, RefreshCw, RotateCcw, Check, Save, AlertTriangle, Eye,
  ShieldAlert, ShieldCheck, CheckSquare, Square, X, Plus, Sparkles
} from 'lucide-react'
import '../../styles/mobile.css'

const MODULE_TABS = [
  { id: 'profile', label: 'Profile', icon: Building2, color: 'var(--accent-primary)' },
  { id: 'branding', label: 'Branding', icon: Palette, color: '#ec4899' },
  { id: 'accounting', label: 'GST & Tax', icon: BarChart3, color: 'var(--warning)' },
  { id: 'sequences', label: 'Prefixes', icon: Hash, color: '#3b82f6' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: '#25D366' },
  { id: 'loyalty', label: 'Loyalty', icon: Gift, color: '#a855f7' },
  { id: 'promos', label: 'Coupons', icon: Tag, color: '#06b6d4' },
  { id: 'backup', label: 'Backup', icon: Database, color: '#00f0ff' },
  { id: 'import-export', label: 'CSV Hub', icon: FileSpreadsheet, color: '#10b981' },
  { id: 'recycle-bin', label: 'Trash', icon: Trash2, color: '#ef4444' },
  { id: 'maintenance', label: 'System', icon: Sliders, color: 'var(--error)' },
]

export default function MobileSettings() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'profile'
  const setActiveTab = (tab) => setSearchParams({ tab })

  const queryClient = useQueryClient()
  const {
    business,
    currentUser,
    logout,
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
  const { promoCodes = [] } = usePromoCodes()
  const { createPromoCode, updatePromoCode, deletePromoCode } = usePromoCodeMutations()

  // Queries for Data & Trash
  const { data: serverBills = [] } = useBills()
  const { data: serverDeletedBills = [], refetch: refetchDeleted } = useDeletedBills()
  const {
    restoreBill: restoreBillMutation,
    permanentDeleteBill: permanentDeleteBillMutation,
    purgeAllDeletedBills: purgeAllDeletedBillsMutation,
  } = useBillMutations()
  const { data: serverCustomers = [] } = useCustomers()
  const { data: serverInventory = [] } = useInventory()
  const { data: serverPayments = [] } = usePayments()
  const { data: serverExpenses = [] } = useExpenses()
  const { data: serverAdvances = [] } = useAdvancePayments()
  const { groupBills: serverGroups = [] } = useGroupBills()

  const { createCustomer } = useCustomerMutations()
  const { createInventory } = useInventoryMutations()

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

  // Accounting & Tax state
  const [gstRate, setGstRate] = useState(settings.gstRate ?? 0)

  // Branding state
  const [branding, setBranding] = useState({
    logoUrl: settings.logoUrl || '',
    shopSealUrl: settings.shopSealUrl || '',
    headerNotes: settings.headerNotes || '',
    footerNotes: settings.footerNotes || '',
    showUpiQrCode: settings.showUpiQrCode !== false,
  })

  // Loyalty state
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(settings.loyaltyEnabled !== false)
  const [loyaltyEarningRate, setLoyaltyEarningRate] = useState(settings.loyaltyEarningRate ?? 30)
  const [loyaltyRedeemRatioPoints, setLoyaltyRedeemRatioPoints] = useState(settings.loyaltyRedeemRatioPoints ?? 150)
  const [loyaltyRedeemRatioRupees, setLoyaltyRedeemRatioRupees] = useState(settings.loyaltyRedeemRatioRupees ?? 5)

  // Promo modal state
  const [showAddPromo, setShowAddPromo] = useState(false)
  const [newPromoCode, setNewPromoCode] = useState('')
  const [newPromoType, setNewPromoType] = useState('percent')
  const [newPromoValue, setNewPromoValue] = useState('')
  const [newPromoMinAmount, setNewPromoMinAmount] = useState('')

  // Storage & Backup state
  const [isExporting, setIsExporting] = useState(false)
  const [storageUsedKb, setStorageUsedKb] = useState(0)

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
  const [inspectingBill, setInspectingBill] = useState(null)
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
        gstRate: Number(gstRate),
        loyaltyEnabled,
        loyaltyEarningRate: Number(loyaltyEarningRate),
        loyaltyRedeemRatioPoints: Number(loyaltyRedeemRatioPoints),
        loyaltyRedeemRatioRupees: Number(loyaltyRedeemRatioRupees),
      })
      showToast?.('Configuration saved', 'success')
    } catch (err) {
      showToast?.(`Save failed: ${err.message || err}`, 'error')
    }
  }

  const handle1ClickSnapshot = () => {
    try {
      setIsExporting(true)
      const full = createFullBackup({
        currentUser,
        business,
        customers: serverCustomers.length > 0 ? serverCustomers : ctxCustomers,
        customerGroups: serverGroups.length > 0 ? serverGroups : ctxGroups,
        inventory: serverInventory.length > 0 ? serverInventory : ctxInventory,
        bills: allBills,
        payments: serverPayments.length > 0 ? serverPayments : ctxPayments,
        expenses: serverExpenses.length > 0 ? serverExpenses : ctxExpenses,
        advancePayments: serverAdvances.length > 0 ? serverAdvances : ctxAdvances,
        counters,
        sequences,
        settings,
      })
      const dateStr = new Date().toISOString().split('T')[0]
      exportToJSON(full, `PrintPro_Snapshot_${dateStr}.json`)
      showToast?.('JSON Snapshot downloaded', 'success')
    } catch (err) {
      showToast?.(`Snapshot failed: ${err.message || err}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleRestoreOneTrash = async (id) => {
    try {
      setIsProcessingTrash(true)
      await restoreBillMutation(id)
      setSelectedTrashIds((prev) => prev.filter((i) => i !== id))
      showToast?.('Bill restored to active list', 'success')
      refetchDeleted()
    } catch (err) {
      showToast?.(`Restore failed: ${err.message || err}`, 'error')
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
    } catch (err) {
      showToast?.(`Bulk restore error: ${err.message || err}`, 'error')
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

      {/* TAB: GST & TAX */}
      {activeTab === 'accounting' && (
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <BarChart3 size={18} style={{ color: 'var(--warning)' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              GST & Tax Preferences
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '3px' }}>
                Default GST Rate (%)
              </label>
              <input
                type="number"
                className="mobile-input"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
              />
            </div>
            <button onClick={handleSaveSettings} className="mobile-btn mobile-btn-primary">
              <Save size={16} /> Save GST Configuration
            </button>
          </div>
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
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Gift size={18} style={{ color: '#a855f7' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Customer Loyalty Program
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>Enable Loyalty Points</span>
              <input
                type="checkbox"
                checked={loyaltyEnabled}
                onChange={(e) => setLoyaltyEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
            </div>
            <button onClick={handleSaveSettings} className="mobile-btn mobile-btn-primary">
              <Save size={16} /> Save Loyalty Program
            </button>
          </div>
        </div>
      )}

      {/* TAB: PROMOS */}
      {activeTab === 'promos' && (
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={18} style={{ color: '#06b6d4' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                Coupons & Discounts
              </h3>
            </div>
            <button
              onClick={() => setShowAddPromo(true)}
              className="mobile-btn mobile-btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              <Plus size={14} /> Add
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {promoCodes.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>
                No active promo codes.
              </div>
            ) : (
              promoCodes.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#06b6d4' }}>
                      {p.code}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '8px' }}>
                      {p.type === 'percent' ? `${p.value}% OFF` : `₹${p.value} OFF`}
                    </span>
                  </div>
                  <button
                    onClick={() => deletePromoCode(p.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: BACKUP & STORAGE GAUGE */}
      {activeTab === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="mobile-card mobile-card-glow" style={{ borderColor: '#00f0ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Database size={18} style={{ color: '#00f0ff' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                Cloud & Local Backup Center
              </h3>
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Export an all-in-one JSON snapshot or restore system registers.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handle1ClickSnapshot}
                disabled={isExporting}
                className="mobile-btn mobile-btn-primary"
                style={{ background: 'linear-gradient(135deg, #00f0ff 0%, #7000ff 100%)' }}
              >
                <Download size={16} /> {isExporting ? 'Generating...' : 'Download JSON Snapshot'}
              </button>

              <label className="mobile-btn mobile-btn-secondary" style={{ cursor: 'pointer' }}>
                <Upload size={16} />
                <span>Restore JSON Backup</span>
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
                    } catch (err) {
                      showToast?.(`Restore failed: ${err.message || err}`, 'error')
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="mobile-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <HardDrive size={16} style={{ color: '#00f0ff' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                Local Storage Footprint
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Estimated ~{storageUsedKb} KB cached in offline storage.
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
                        if (it.name && it.name !== 'Unnamed Item') await createInventory(it)
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
