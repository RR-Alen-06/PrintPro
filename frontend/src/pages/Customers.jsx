import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import EmptyState from '../components/common/EmptyState'
import {
  Users,
  UserPlus,
  Search,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Trash2,
  RotateCcw,
  Pencil,
  Wallet,
  FileText,
  ClipboardList,
  Award,
  History,
  Plus,
  Download,
  Copy,
  Printer,
  DollarSign,
  Phone,
  Mail,
  MessageCircle,
  Tag,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Layers
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { getCustomerLoyalty, adjustCustomerLoyalty } from '../api/loyalty'
import { exportCustomerLedgerPdf } from '../api/ledger'
import { LedgerService } from '../utils/financialServices'
import { getDisplayBillId, getDisplayCustomerId } from '../utils/idFormatter'

const EMPTY_CUSTOMER_FORM = {
  type: 'regular',
  name: '',
  phone: '',
  email: '',
  creditBalance: '',
  openingCash: '',
  openingUpi: '',
  openingBalanceMethod: 'cash',
  groupId: '',
}

const getNextRegularCustomerCode = (customers = []) => {
  let maxNum = 0
  customers.forEach(c => {
    if (c.type === 'regular') {
      const code = c.customer_code || c.customerCode || ''
      const match = code.match(/RC-?(\d+)/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNum) maxNum = num
      }
    }
  })
  return `RC-${String(maxNum + 1).padStart(4, '0')}`
}

function generateClientSideStatementPdf(customer, rows, summary) {
  const doc = new jsPDF()
  const shopName = summary.business?.shopName || 'PrintPro'
  const ownerName = summary.business?.ownerName || ''
  const phone = summary.business?.phone || ''
  const gstin = summary.business?.gstin || ''

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(shopName, 14, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  let y = 24
  if (ownerName) { doc.text(`Prop: ${ownerName}`, 14, y); y += 5 }
  if (phone) { doc.text(`Phone: ${phone}`, 14, y); y += 5 }
  if (gstin) { doc.text(`GSTIN: ${gstin}`, 14, y); y += 5 }

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('STATEMENT OF ACCOUNT', 14, y + 4)
  y += 10

  doc.setLineWidth(0.3)
  doc.line(14, y, 196, y)
  y += 6

  // Customer block
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Customer: ${customer.name}`, 14, y)
  const custCode = customer.customer_code || customer.customerCode || customer.id || ''
  doc.setFont('helvetica', 'normal')
  doc.text(`Account Code: ${custCode}`, 140, y)
  y += 5
  if (customer.phone) { doc.text(`Phone: ${customer.phone}`, 14, y); y += 5 }
  if (customer.address) { doc.text(`Address: ${customer.address}`, 14, y); y += 5 }
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 140, y - 5)

  y += 4
  doc.line(14, y, 196, y)
  y += 8

  // Financial KPI box
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.rect(14, y, 182, 16)
  doc.text(`Total Debits: Rs. ${summary.debits.toFixed(2)}`, 18, y + 6)
  doc.text(`Total Credits: Rs. ${summary.credits.toFixed(2)}`, 80, y + 6)
  doc.text(`Net Balance: Rs. ${summary.balance.toFixed(2)}`, 140, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Period: ${summary.startDate ? `${summary.startDate} to ${summary.endDate}` : 'All Time'}`, 18, y + 12)
  y += 22

  // Table header
  doc.setFillColor(245, 245, 245)
  doc.rect(14, y, 182, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Date', 16, y + 5)
  doc.text('Ref / ID', 40, y + 5)
  doc.text('Type', 80, y + 5)
  doc.text('Debit (Rs.)', 125, y + 5, { align: 'right' })
  doc.text('Credit (Rs.)', 160, y + 5, { align: 'right' })
  doc.text('Balance (Rs.)', 194, y + 5, { align: 'right' })
  y += 9

  // Table rows
  doc.setFont('helvetica', 'normal')
  rows.slice(0, 35).forEach(r => {
    if (y > 275) {
      doc.addPage()
      y = 15
    }
    doc.text(String(r.date || '').slice(0, 10), 16, y)
    doc.text(String(r.refId || r.id || '').slice(0, 18), 40, y)
    doc.text(String(r.type || '').slice(0, 22), 80, y)
    doc.text(r.debit ? Number(r.debit).toFixed(2) : '—', 125, y, { align: 'right' })
    doc.text(r.credit ? Number(r.credit).toFixed(2) : '—', 160, y, { align: 'right' })
    doc.text(Number(r.balance || 0).toFixed(2), 194, y, { align: 'right' })
    y += 6
  })

  // Footer
  y += 8
  if (y > 275) {
    doc.addPage()
    y = 20
  }
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text('This is a computer-generated statement. Thank you for your business.', 105, y, { align: 'center' })

  doc.save(`${custCode || 'Customer'}_Statement.pdf`)
}

const getCustomerGroup = (customer, customerGroups = []) => {
  if (!customer) return null
  return customerGroups.find(g =>
    (customer.groupId && g.id === customer.groupId) ||
    (Array.isArray(g.memberIds) && g.memberIds.includes(customer.id))
  ) || null
}


const LEDGER_PERIODS = [
  { key: 'all', label: 'All Time' },
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly', label: 'This Year' },
  { key: 'custom', label: 'Custom' }
]

const getLedgerPeriodRange = (period) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'daily') return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
  if (period === 'weekly') {
    const day = today.getDay()
    const mon = new Date(today)
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return { start: mon, end: sun }
  }
  if (period === 'monthly') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) }
  }
  if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3)
    return { start: new Date(now.getFullYear(), q * 3, 1), end: new Date(now.getFullYear(), q * 3 + 3, 0) }
  }
  if (period === 'yearly') {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) }
  }
  return null
}

const Customers = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    business,
    customers,
    bills,
    inventory,
    payments,
    advancePayments,
    settings,
    customerGroups = [],
    addCustomer,
    updateCustomer,
    deleteCustomer,
    restoreCustomer,
    updateCustomerFull,
    updateCustomerGroup,
    editBill,
    deleteBill,
    applyPostDiscount,
    showAlert,
    showConfirm,
    showToast
  } = useAppContext()

  // ── URL Query Params: use customer UUID in URL for reliable lookup ──
  const urlCustomerId = searchParams.get('id')
  const urlTab = searchParams.get('tab') || 'overview'

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers])
  const deletedCustomers = useMemo(() => customers.filter((c) => c.deleted), [customers])

  // Selected customer state (UUID)
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    if (urlCustomerId && customers.some(c => c.id === urlCustomerId)) {
      return urlCustomerId
    }
    return activeCustomers[0]?.id || null
  })

  // Active top tab state
  const [activeTab, setActiveTab] = useState(() => {
    return ['overview', 'bills', 'ledger'].includes(urlTab) ? urlTab : 'overview'
  })

  // Sync state with URL when search params change externally
  useEffect(() => {
    if (urlCustomerId && customers.some(c => c.id === urlCustomerId) && urlCustomerId !== selectedCustomerId) {
      setSelectedCustomerId(urlCustomerId)
    }
    if (urlTab && ['overview', 'bills', 'ledger'].includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
    }
  }, [urlCustomerId, urlTab, customers, selectedCustomerId, activeTab])

  // Helper to update selection and keep URL in sync
  const selectCustomer = (customerId, tab = activeTab) => {
    setSelectedCustomerId(customerId)
    setActiveTab(tab)
    if (customerId) {
      setSearchParams({ id: customerId, tab }, { replace: true })
    } else {
      setSearchParams({ tab }, { replace: true })
    }
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    if (selectedCustomerId) {
      setSearchParams({ id: selectedCustomerId, tab }, { replace: true })
    } else {
      setSearchParams({ tab }, { replace: true })
    }
  }

  // Active selected customer object
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  )

  // ── Filter & Search for Directory (Left Pane) ──
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all', 'regular', 'random', 'due', 'advance', 'deleted'
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all')

  // Convert Walk-in to Regular modal state
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertName, setConvertName] = useState('')
  const [convertPhone, setConvertPhone] = useState('')
  const [convertPin, setConvertPin] = useState('')
  const [convertError, setConvertError] = useState('')
  const [showConvertPin, setShowConvertPin] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  // Dual WhatsApp Share dropdown
  const [showWhatsAppDropdown, setShowWhatsAppDropdown] = useState(false)
  const whatsAppDropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (whatsAppDropdownRef.current && !whatsAppDropdownRef.current.contains(e.target)) {
        setShowWhatsAppDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Pre-calculated customer balances
  const customerDueMap = useMemo(() => {
    const map = {}
    bills.forEach(b => {
      if (!b.deleted && b.customerId) {
        map[b.customerId] = (map[b.customerId] || 0) + Number(b.balance || 0)
      }
    })
    return map
  }, [bills])

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filterType === 'deleted') return c.deleted === true
      if (c.deleted) return false

      if (selectedGroupFilter !== 'all') {
        const cGroup = getCustomerGroup(c, customerGroups)
        if (!cGroup || cGroup.id !== selectedGroupFilter) return false
      }

      const displayId = getDisplayCustomerId(c)
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        displayId.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (filterType === 'regular') return c.type === 'regular'
      if (filterType === 'random') return c.type !== 'regular'
      if (filterType === 'due') return (customerDueMap[c.id] || 0) > 0.01
      if (filterType === 'advance') return Number(c.advanceBalance || c.creditBalance || 0) > 0.01

      return true
    })
  }, [customers, filterType, selectedGroupFilter, searchQuery, customerDueMap, customerGroups])

  // Selected customer's bills (newest first)
  const customerBills = useMemo(() => {
    if (!selectedCustomerId) return []
    return bills
      .filter((b) => !b.deleted && b.customerId === selectedCustomerId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [bills, selectedCustomerId])

  // Selected customer KPI metrics
  const totalBilled = useMemo(() => customerBills.reduce((s, b) => s + Number(b.total || 0), 0), [customerBills])
  const totalDue = useMemo(() => customerBills.reduce((s, b) => s + Number(b.balance || 0), 0), [customerBills])
  const advanceBal = useMemo(() => Number(selectedCustomer?.advanceBalance || selectedCustomer?.creditBalance || 0), [selectedCustomer])
  const loyaltyBal = useMemo(() => Number(selectedCustomer?.loyaltyPoints || 0), [selectedCustomer])

  // ── Customer Add / Edit Modal State ──
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [isEditingCustomer, setIsEditingCustomer] = useState(false)
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM)
  const [customerFormErrors, setCustomerFormErrors] = useState({})

  const openAddCustomerModal = () => {
    setCustomerForm(EMPTY_CUSTOMER_FORM)
    setCustomerFormErrors({})
    setIsEditingCustomer(false)
    setShowCustomerModal(true)
  }

  const openEditCustomerModal = (c = selectedCustomer) => {
    if (!c) return
    const currentGroup = getCustomerGroup(c, customerGroups)
    setCustomerForm({
      type: c.type || 'regular',
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      groupId: currentGroup?.id || c.groupId || '',
      creditBalance: String(c.creditBalance || c.advanceBalance || 0),
      openingCash: '',
      openingUpi: '',
      openingBalanceMethod: 'cash',
    })
    setCustomerFormErrors({})
    setIsEditingCustomer(true)
    setShowCustomerModal(true)
  }

  const handleCustomerSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!customerForm.name.trim()) errs.name = 'Customer name is required'
    if (customerForm.phone && !/^\d{7,15}$/.test(customerForm.phone.trim())) {
      errs.phone = 'Enter a valid phone number (7-15 digits)'
    }
    if (customerForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerForm.email.trim())) {
      errs.email = 'Enter a valid email address'
    }

    if (Object.keys(errs).length > 0) {
      setCustomerFormErrors(errs)
      return
    }

    if (isEditingCustomer && selectedCustomer) {
      const prevGroup = getCustomerGroup(selectedCustomer, customerGroups)
      const newGroupId = customerForm.groupId || ''

      updateCustomerFull(selectedCustomer.id, {
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        email: customerForm.email.trim(),
        groupId: newGroupId,
        creditBalance: selectedCustomer.type === 'regular' ? Number(customerForm.creditBalance || 0) : 0,
      })

      // Synchronize group membership if group changed
      if (prevGroup && prevGroup.id !== newGroupId && updateCustomerGroup) {
        const nextMembers = (prevGroup.memberIds || []).filter(mId => mId !== selectedCustomer.id)
        updateCustomerGroup(prevGroup.id, { memberIds: nextMembers })
      }
      if (newGroupId && (!prevGroup || prevGroup.id !== newGroupId) && updateCustomerGroup) {
        const targetGroup = customerGroups.find(g => g.id === newGroupId)
        if (targetGroup) {
          const nextMembers = Array.from(new Set([...(targetGroup.memberIds || []), selectedCustomer.id]))
          updateCustomerGroup(targetGroup.id, { memberIds: nextMembers })
        }
      }

      showToast?.('Customer details updated successfully', 'success')
      setShowCustomerModal(false)
    } else {
      const isRegular = customerForm.type === 'regular'
      const opCash = isRegular ? Number(customerForm.openingCash || 0) : 0
      const opUpi = isRegular ? Number(customerForm.openingUpi || 0) : 0
      const newCust = addCustomer({
        type: customerForm.type,
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        email: customerForm.email.trim(),
        groupId: customerForm.groupId || '',
        creditBalance: isRegular ? Number(customerForm.creditBalance || 0) : 0,
        openingCash: opCash,
        openingUpi: opUpi,
        openingBalanceMethod: customerForm.openingBalanceMethod,
      })
      if (customerForm.groupId && newCust?.id && updateCustomerGroup) {
        const targetGroup = customerGroups.find(g => g.id === customerForm.groupId)
        if (targetGroup) {
          const nextMembers = Array.from(new Set([...(targetGroup.memberIds || []), newCust.id]))
          updateCustomerGroup(targetGroup.id, { memberIds: nextMembers })
        }
      }
      showToast?.('New customer added successfully', 'success')
      setShowCustomerModal(false)
      if (newCust?.id) {
        selectCustomer(newCust.id, 'overview')
      }
    }
  }

  // ── Convert Walk-in to Regular Customer (Master PIN Protected) ──
  const openConvertModal = () => {
    if (!selectedCustomer) return
    setConvertName(selectedCustomer.name || '')
    setConvertPhone(selectedCustomer.phone || '')
    setConvertPin('')
    setConvertError('')
    setShowConvertPin(false)
    setShowConvertModal(true)
  }

  const handleConvertCustomer = (e) => {
    e.preventDefault()
    if (!selectedCustomer) return
    if (!convertName.trim()) {
      setConvertError('Customer name is required')
      return
    }
    if (!convertPhone.trim() || !/^\d{7,15}$/.test(convertPhone.trim())) {
      setConvertError('A valid phone number (7-15 digits) is required for regular accounts')
      return
    }
    const currentPin = settings?.securityPin || '0000'
    if (convertPin.trim() !== currentPin) {
      setConvertError('Incorrect Master Security PIN')
      return
    }

    setIsConverting(true)
    try {
      const newCode = getNextRegularCustomerCode(customers)
      updateCustomerFull(selectedCustomer.id, {
        type: 'regular',
        name: convertName.trim(),
        phone: convertPhone.trim(),
        customer_code: newCode,
        customerCode: newCode
      })
      showToast?.(`Converted to Regular customer! New Account Code: ${newCode}`, 'success')
      setShowConvertModal(false)
    } catch (err) {
      console.error('Failed to convert customer:', err)
      setConvertError('Failed to convert customer. Please try again.')
    } finally {
      setIsConverting(false)
    }
  }

  // ── Loyalty Points State & Modals ──
  const [loyaltyCustomer, setLoyaltyCustomer] = useState(null)
  const [loyaltyEvents, setLoyaltyEvents] = useState([])
  const [loadingLoyalty, setLoadingLoyalty] = useState(false)
  const [showAdjustPointsModal, setShowAdjustPointsModal] = useState(false)
  const [adjustPointsVal, setAdjustPointsVal] = useState('')
  const [adjustOp, setAdjustOp] = useState('add')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const openLoyaltyHistory = async (cust) => {
    setLoyaltyCustomer(cust)
    setLoadingLoyalty(true)
    try {
      const res = await getCustomerLoyalty(cust.id)
      setLoyaltyEvents(res.data?.data?.events || [])
    } catch (err) {
      console.error('Failed to load loyalty:', err)
      setLoyaltyEvents([])
    } finally {
      setLoadingLoyalty(false)
    }
  }

  const handleSavePointsAdjustment = async (e) => {
    e.preventDefault()
    if (!selectedCustomer) return
    const pts = parseInt(adjustPointsVal, 10)
    if (isNaN(pts) || pts <= 0) {
      showAlert('Please enter a valid positive number of points', 'error')
      return
    }

    setAdjusting(true)
    try {
      const res = await adjustCustomerLoyalty(selectedCustomer.id, {
        points: pts,
        operation: adjustOp,
        notes: adjustNotes || 'Manual points adjustment by store owner'
      })
      const newBal = res.data?.data?.balance ?? 0
      updateCustomer(selectedCustomer.id, { loyaltyPoints: newBal })
      showToast?.(`Successfully ${adjustOp === 'add' ? 'added' : 'deducted'} ${pts} points`, 'success')
      setShowAdjustPointsModal(false)
      setAdjustPointsVal('')
      setAdjustNotes('')
    } catch (err) {
      console.error('Failed to adjust points:', err)
      showAlert('Failed to adjust customer loyalty points', 'error')
    } finally {
      setAdjusting(false)
    }
  }

  // ── Bills Tab: Filter, Expand & Edit Bill Modal ──
  const [billStatusFilter, setBillStatusFilter] = useState('all') // 'all', 'paid', 'due'
  const [expandedBillId, setExpandedBillId] = useState(null)

  const filteredBills = useMemo(() => {
    return customerBills.filter(b => {
      if (billStatusFilter === 'paid') return Number(b.balance || 0) <= 0.01
      if (billStatusFilter === 'due') return Number(b.balance || 0) > 0.01
      return true
    })
  }, [customerBills, billStatusFilter])

  // Edit Bill Modal State
  const [isEditBillModalOpen, setIsEditBillModalOpen] = useState(false)
  const [editingBill, setEditingBill] = useState(null)
  const [editItemRows, setEditItemRows] = useState([])
  const [editDiscountType, setEditDiscountType] = useState('flat')
  const [editDiscountValue, setEditDiscountValue] = useState(0)
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDueDate, setEditDueDate] = useState('')

  const openEditBill = (bill) => {
    setEditingBill(bill)
    setEditDate(bill.date || '')
    setEditDueDate(bill.dueDate || '')
    setEditDiscountType(bill.discountType || 'flat')
    setEditDiscountValue(bill.discountValue || 0)
    setEditNotes(bill.notes || '')
    setEditItemRows(
      (bill.items || []).map((item, idx) => ({
        id: `row-${Date.now()}-${idx}-${Math.random()}`,
        itemId: item.itemId || '',
        itemName: item.itemName || item.name || 'Custom Item',
        isCustom: !item.itemId,
        printType: item.printType || 'color',
        sides: item.sides || 'single',
        qty: item.qty || 1,
        unitPrice: item.unitPrice || 0,
        amount: item.amount || 0,
        gstRate: item.gstRate || 0,
      }))
    )
    setIsEditBillModalOpen(true)
  }

  const updateEditRow = (rowId, changes) => {
    setEditItemRows(curr => curr.map(r => {
      if (r.id !== rowId) return r
      const unitPrice = changes.unitPrice !== undefined ? Number(changes.unitPrice) : r.unitPrice
      const qty = changes.qty !== undefined ? Number(changes.qty) : r.qty
      return { ...r, ...changes, unitPrice, qty, amount: unitPrice * qty }
    }))
  }

  const addEditRow = () => {
    const firstInv = inventory && inventory.length > 0 ? inventory[0] : null
    setEditItemRows(curr => [
      ...curr,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        itemId: firstInv?.id || '',
        itemName: firstInv?.name || '',
        isCustom: !firstInv,
        printType: 'color',
        sides: 'single',
        qty: 1,
        unitPrice: firstInv ? (firstInv.colorSingle ?? 0) : 0,
        amount: firstInv ? (firstInv.colorSingle ?? 0) : 0,
        gstRate: 0
      }
    ])
  }


  const removeEditRow = (rowId) => {
    setEditItemRows(curr => curr.filter(r => r.id !== rowId))
  }

  const computedEditSubtotal = useMemo(() => {
    return editItemRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  }, [editItemRows])

  const computedEditDiscount = useMemo(() => {
    if (editDiscountType === 'percent') {
      return (computedEditSubtotal * Number(editDiscountValue || 0)) / 100
    }
    return Math.min(Number(editDiscountValue || 0), computedEditSubtotal)
  }, [computedEditSubtotal, editDiscountType, editDiscountValue])

  const computedEditTotal = useMemo(() => {
    return Math.max(0, computedEditSubtotal - computedEditDiscount)
  }, [computedEditSubtotal, computedEditDiscount])

  const handleSaveEditedBill = () => {
    if (!editingBill) return
    if (editItemRows.length === 0) {
      showAlert('Bill must have at least one line item', 'error')
      return
    }

    const payload = {
      ...editingBill,
      date: editDate,
      dueDate: editDueDate,
      subtotal: computedEditSubtotal,
      discountType: editDiscountType,
      discountValue: Number(editDiscountValue || 0),
      discountAmount: computedEditDiscount,
      total: computedEditTotal,
      notes: editNotes,
      items: editItemRows.map(r => ({
        itemId: r.itemId,
        itemName: r.itemName,
        printType: r.printType,
        sides: r.sides,
        qty: Number(r.qty),
        unitPrice: Number(r.unitPrice),
        amount: Number(r.amount),
        gstRate: Number(r.gstRate || 0)
      }))
    }

    editBill(editingBill.id, payload)
    showToast?.('Bill updated successfully', 'success')
    setIsEditBillModalOpen(false)
    setEditingBill(null)
  }

  // Post Discount Modal State
  const [showPostDiscountModal, setShowPostDiscountModal] = useState(false)
  const [postDiscountBill, setPostDiscountBill] = useState(null)
  const [postDiscountType, setPostDiscountType] = useState('flat')
  const [postDiscountVal, setPostDiscountVal] = useState('')

  const handleApplyPostDiscount = () => {
    if (!postDiscountBill) return
    const val = Number(postDiscountVal)
    if (isNaN(val) || val <= 0) {
      showAlert('Please enter a valid discount amount', 'error')
      return
    }
    applyPostDiscount(postDiscountBill.id, postDiscountType, val)
    showToast?.('Discount applied successfully', 'success')
    setShowPostDiscountModal(false)
    setPostDiscountBill(null)
    setPostDiscountVal('')
  }

  // ── Account Ledger Tab: Period Filter & PDF Export ──
  const [ledgerPeriod, setLedgerPeriod] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)

  const ledgerEntries = useMemo(() => {
    if (!selectedCustomerId) return []
    const res = LedgerService.calculateLedger({
      customerId: selectedCustomerId,
      bills,
      payments,
      advancePayments,
      period: ledgerPeriod === 'custom' ? 'all' : ledgerPeriod,
      settings
    })
    let entries = res.entries || []
    if (ledgerPeriod === 'custom') {
      if (customStartDate) {
        entries = entries.filter(e => new Date(e.date) >= new Date(customStartDate))
      }
      if (customEndDate) {
        entries = entries.filter(e => new Date(e.date) <= new Date(new Date(customEndDate).setHours(23, 59, 59, 999)))
      }
    }
    return entries
  }, [selectedCustomerId, bills, payments, advancePayments, ledgerPeriod, customStartDate, customEndDate, settings])

  const ledgerDebits = useMemo(() => ledgerEntries.reduce((s, e) => s + (e.debit || 0), 0), [ledgerEntries])
  const ledgerCredits = useMemo(() => ledgerEntries.reduce((s, e) => s + (e.credit || 0) + (e.advanceIn || 0), 0), [ledgerEntries])
  const ledgerFinalBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : 0

  const handleExportStatementPdf = async () => {
    if (!selectedCustomer) return
    setExportingPdf(true)
    showToast?.('Generating official statement PDF...', 'info')
    const dateParams = {}
    if (ledgerPeriod === 'custom') {
      if (customStartDate) dateParams.startDate = customStartDate
      if (customEndDate) dateParams.endDate = customEndDate
    } else {
      const range = getLedgerPeriodRange(ledgerPeriod)
      if (range) {
        dateParams.startDate = range.start.toISOString().slice(0, 10)
        dateParams.endDate = range.end.toISOString().slice(0, 10)
      }
    }

    try {
      const res = await exportCustomerLedgerPdf(selectedCustomer.id, dateParams)
      if (res && res.success && (res.fullUrl || res.pdfUrl)) {
        const hostedUrl = res.fullUrl || (window.location.origin + res.pdfUrl)
        showToast?.('Statement PDF generated!', 'success')
        window.open(hostedUrl, '_blank')
        return
      }
    } catch (err) {
      console.warn('Server PDF unavailable, falling back to client-side statement generator:', err)
    } finally {
      setExportingPdf(false)
    }

    // High-Fidelity Client-Side Statement PDF Fallback
    try {
      generateClientSideStatementPdf(selectedCustomer, ledgerEntries, {
        debits: ledgerDebits,
        credits: ledgerCredits,
        balance: ledgerFinalBalance,
        startDate: dateParams.startDate,
        endDate: dateParams.endDate,
        business: business || settings?.business || {}
      })
      showToast?.('Statement PDF generated locally!', 'success')
    } catch (fallbackErr) {
      console.error('Fallback PDF generation error:', fallbackErr)
      showAlert('Could not generate statement PDF', 'error')
    }
  }

  // ── Dual-Mode WhatsApp Sharing ──
  const handleShareWhatsAppQuick = () => {
    if (!selectedCustomer || !selectedCustomer.phone) {
      showAlert('Customer has no phone number on record for WhatsApp', 'warning')
      return
    }
    const cleanPhone = selectedCustomer.phone.replace(/[^0-9]/g, '')
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const shopName = business?.shopName || 'PrintPro'
    const upiId = business?.upiId || ''
    const due = totalDue

    let msg = `Dear ${selectedCustomer.name},\n`
    msg += `This is a friendly reminder from *${shopName}* regarding your pending balance.\n\n`
    msg += `*Outstanding Balance: ₹${due.toFixed(2)}*\n`
    if (advanceBal > 0.01) {
      msg += `Available Advance: ₹${advanceBal.toFixed(2)}\n`
    }
    if (upiId && due > 0) {
      const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${due.toFixed(2)}&cu=INR&tn=Payment%20Settlement`
      msg += `\nYou can clear your balance via UPI:\nUPI ID: *${upiId}*\nPayment Link: ${upiLink}\n`
    }
    msg += `\nPlease feel free to contact us if you have any questions.\nThank you for choosing ${shopName}!`

    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handleShareWhatsAppDetailed = () => {
    if (!selectedCustomer || !selectedCustomer.phone) {
      showAlert('Customer has no phone number on record for WhatsApp', 'warning')
      return
    }
    const cleanPhone = selectedCustomer.phone.replace(/[^0-9]/g, '')
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const shopName = business?.shopName || 'PrintPro'
    const upiId = business?.upiId || ''
    const displayId = getDisplayCustomerId(selectedCustomer)

    const pendingBills = customerBills.filter(b => !b.deleted && (Number(b.balance) > 0.01 || b.status !== 'paid'))

    let msg = `*ACCOUNT STATEMENT - ${shopName.toUpperCase()}*\n`
    msg += `*Customer:* ${selectedCustomer.name} (${displayId})\n`
    msg += `*Date:* ${new Date().toLocaleDateString()}\n`
    msg += `--------------------------------\n`
    msg += `*Total Invoiced:* ₹${totalBilled.toFixed(2)}\n`
    msg += `*Total Due:* ₹${totalDue.toFixed(2)}\n`
    if (advanceBal > 0.01) {
      msg += `*Advance Balance:* ₹${advanceBal.toFixed(2)}\n`
    }
    msg += `--------------------------------\n\n`

    if (pendingBills.length > 0) {
      msg += `*PENDING INVOICES (${pendingBills.length}):*\n`
      pendingBills.forEach((b, idx) => {
        const billCode = b.bill_code || b.billCode || b.id
        const bDate = b.date ? String(b.date).slice(0, 10) : ''
        msg += `${idx + 1}. *${billCode}* (${bDate})\n`
        msg += `   Total: ₹${Number(b.total || 0).toFixed(2)} | Due: *₹${Number(b.balance || 0).toFixed(2)}*\n`
      })
      msg += `--------------------------------\n`
    } else {
      msg += `No pending invoices. Account is fully settled!\n--------------------------------\n`
    }

    if (upiId && totalDue > 0) {
      const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${totalDue.toFixed(2)}&cu=INR&tn=Invoice%20Settlement`
      msg += `\n*Quick UPI Settlement:*\nUPI ID: *${upiId}*\nPay directly: ${upiLink}\n`
    }

    msg += `\nThank you for your business!\n*${shopName}*`
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="customers-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Customer 360 Workspace</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Unified directory, order histories, loyalty points, and audited account statements.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={openAddCustomerModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserPlus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* Split-View Workspace Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '360px 1fr',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* ── Left Pane: Customer Directory List ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 180px)' }}>
          {/* Search & Filter Header */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            <div className="search-input-wrapper" style={{ marginBottom: '12px', width: '100%' }}>
              <Search size={16} />
              <input
                className="form-input"
                type="text"
                placeholder="Search name, phone, or ID (CUST-0001)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '38px', width: '100%', fontSize: '0.85rem' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { key: 'all', label: `All (${activeCustomers.length})` },
                { key: 'regular', label: 'Regular' },
                { key: 'due', label: 'Due' },
                { key: 'advance', label: 'Advance' },
                { key: 'random', label: 'Walk-in' },
                { key: 'deleted', label: `Trash (${deletedCustomers.length})` }
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterType(f.key)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: filterType === f.key ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: filterType === f.key ? 'var(--accent-light)' : 'transparent',
                    color: filterType === f.key ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Customer Groups Filter Strip */}
            {customerGroups.length > 0 && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', fontSize: '0.70rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  <Layers size={11} />
                  <span>GROUP TAGS</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedGroupFilter('all')}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: selectedGroupFilter === 'all' ? '1px solid #9333ea' : '1px solid var(--border)',
                      background: selectedGroupFilter === 'all' ? 'rgba(147, 51, 234, 0.12)' : 'transparent',
                      color: selectedGroupFilter === 'all' ? '#9333ea' : 'var(--text-muted)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    All Groups
                  </button>
                  {customerGroups.map(g => {
                    const count = (g.memberIds || []).length
                    const isSelected = selectedGroupFilter === g.id
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGroupFilter(isSelected ? 'all' : g.id)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #9333ea' : '1px solid var(--border)',
                          background: isSelected ? 'rgba(147, 51, 234, 0.15)' : 'transparent',
                          color: isSelected ? '#9333ea' : 'var(--text-muted)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {g.name} {count > 0 && `(${count})`}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Customer Cards Scroll Area */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: '350px' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <EmptyState
                  Icon={Users}
                  title="No customers found"
                  description="Try modifying search keywords or switching filters."
                />
              </div>
            ) : (
              filteredCustomers.map(c => {
                const isSelected = selectedCustomerId === c.id
                const due = customerDueMap[c.id] || 0
                const adv = Number(c.advanceBalance || c.creditBalance || 0)
                const displayId = getDisplayCustomerId(c)
                const cGroup = getCustomerGroup(c, customerGroups)

                return (
                  <div
                    key={c.id}
                    onClick={() => selectCustomer(c.id, activeTab)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                          </span>
                          <span className={`badge ${c.type === 'regular' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                            {c.type === 'regular' ? 'Regular' : 'Walk-in'}
                          </span>
                          {cGroup && (
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.62rem',
                                padding: '1px 5px',
                                background: 'rgba(147, 51, 234, 0.1)',
                                color: '#9333ea',
                                border: '1px solid rgba(147, 51, 234, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Tag size={10} /> {cGroup.name}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <span style={{ fontFamily: 'monospace' }}>{displayId}</span>
                          {c.phone && <span>• {c.phone}</span>}
                        </div>
                      </div>

                      {/* Balances */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {due > 0.01 ? (
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--warning)' }}>
                            Due: ₹{due.toFixed(2)}
                          </div>
                        ) : adv > 0.01 ? (
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)' }}>
                            Adv: ₹{adv.toFixed(2)}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Settled</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Right Pane: Customer 360 Workspace ── */}
        {selectedCustomer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Identity & Quick Actions Header */}
            <div className="card" style={{ padding: '20px', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                {/* Profile Meta */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: selectedCustomer.type === 'regular' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: selectedCustomer.type === 'regular' ? 'var(--accent)' : 'var(--warning)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: 700
                  }}>
                    {selectedCustomer.name?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{selectedCustomer.name}</h2>
                      <span className={`badge ${selectedCustomer.type === 'regular' ? 'badge-info' : 'badge-warning'}`}>
                        {selectedCustomer.type === 'regular' ? 'Regular Customer' : 'Walk-in Customer'}
                      </span>
                      {(() => {
                        const selGroup = getCustomerGroup(selectedCustomer, customerGroups)
                        if (!selGroup) return null
                        return (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(147, 51, 234, 0.12)',
                              color: '#9333ea',
                              border: '1px solid rgba(147, 51, 234, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.74rem',
                              padding: '2px 8px'
                            }}
                          >
                            <Tag size={12} /> {selGroup.name}
                          </span>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {getDisplayCustomerId(selectedCustomer)}
                      </span>
                      {selectedCustomer.phone && (
                        <a href={`tel:${selectedCustomer.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                          <Phone size={13} /> {selectedCustomer.phone}
                        </a>
                      )}
                      {selectedCustomer.email && (
                        <a href={`mailto:${selectedCustomer.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                          <Mail size={13} /> {selectedCustomer.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedCustomer.type === 'random' && (
                    <button
                      className="btn btn-sm"
                      onClick={openConvertModal}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        color: 'var(--accent)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        fontWeight: 600
                      }}
                      title="Upgrade Walk-in customer to Regular account with Master PIN"
                    >
                      <ShieldCheck size={15} /> Convert to Regular
                    </button>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/payments?customerId=${selectedCustomer.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Wallet size={15} /> Receive Payment
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/billing?customerId=${selectedCustomer.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileText size={15} /> New Bill
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => openEditCustomerModal(selectedCustomer)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Pencil size={15} /> Edit Profile
                  </button>
                  {selectedCustomer.deleted ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        restoreCustomer(selectedCustomer.id)
                        showToast?.('Customer restored', 'success')
                      }}
                      style={{ color: 'var(--success)' }}
                    >
                      <RotateCcw size={15} /> Restore
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        showConfirm({
                          title: 'Delete Customer',
                          message: `Are you sure you want to delete ${selectedCustomer.name}?`,
                          onConfirm: () => {
                            deleteCustomer(selectedCustomer.id)
                            showToast?.('Customer moved to trash', 'info')
                          }
                        })
                      }}
                      style={{ color: 'var(--error)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Segmented Sub-Tab Bar */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '20px',
                borderTop: '1px solid var(--border)',
                paddingTop: '16px'
              }}>
                {[
                  { key: 'overview', label: 'Overview & Loyalty', icon: Users },
                  { key: 'bills', label: `Invoices & Bills (${customerBills.length})`, icon: FileText },
                  { key: 'ledger', label: 'Account Ledger & Statement', icon: ClipboardList }
                ].map(t => {
                  const Icon = t.icon
                  const isActive = activeTab === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => switchTab(t.key)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: 'none',
                        background: isActive ? 'var(--accent)' : 'rgba(255, 255, 255, 0.04)',
                        color: isActive ? '#fff' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Icon size={16} />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── SUB-TAB 1: OVERVIEW & LOYALTY ── */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Metric Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div className="stat-card">
                    <div className="stat-card-header">
                      <div className="stat-card-icon indigo"><DollarSign /></div>
                      <div>
                        <div className="stat-card-label">Total Invoiced</div>
                        <div className="stat-card-value">₹{totalBilled.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="stat-card-sub">{customerBills.length} orders billed</div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-header">
                      <div className="stat-card-icon warning"><AlertTriangle /></div>
                      <div>
                        <div className="stat-card-label">Pending Due</div>
                        <div className="stat-card-value" style={{ color: totalDue > 0 ? 'var(--warning)' : 'inherit' }}>
                          ₹{totalDue.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="stat-card-sub">
                      {totalDue > 0 ? (
                        <button
                          onClick={() => navigate(`/payments?customerId=${selectedCustomer.id}&amount=${totalDue}`)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          Collect Payment &rarr;
                        </button>
                      ) : 'All balances settled'}
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-header">
                      <div className="stat-card-icon success"><Wallet /></div>
                      <div>
                        <div className="stat-card-label">Advance Credit</div>
                        <div className="stat-card-value" style={{ color: advanceBal > 0 ? 'var(--success)' : 'inherit' }}>
                          ₹{advanceBal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="stat-card-sub">Usable toward future orders</div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-header">
                      <div className="stat-card-icon cyan"><Award /></div>
                      <div>
                        <div className="stat-card-label">Loyalty Balance</div>
                        <div className="stat-card-value">{loyaltyBal} pts</div>
                      </div>
                    </div>
                    <div className="stat-card-sub">
                      <button
                        onClick={() => setShowAdjustPointsModal(true)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 600 }}
                      >
                        Adjust Points &rarr;
                      </button>
                    </div>
                  </div>
                </div>

                {/* Loyalty & Rewards Desk Card */}
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Award size={18} color="var(--accent)" />
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Loyalty & Rewards Program</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openLoyaltyHistory(selectedCustomer)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                      >
                        <History size={14} /> Audit History
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowAdjustPointsModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                      >
                        <Plus size={14} /> Adjust Points
                      </button>
                    </div>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    Customers earn points automatically on completed print orders. Points can be redeemed at checkout on the POS billing screen or manually audited here.
                  </p>
                </div>

                {/* Recent Invoices Snapshot */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Recent Invoices</h3>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => switchTab('bills')}
                      style={{ fontSize: '0.8rem', color: 'var(--accent)' }}
                    >
                      View All ({customerBills.length}) &rarr;
                    </button>
                  </div>

                  {customerBills.slice(0, 3).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No bills recorded yet for this customer.
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Bill ID</th>
                            <th>Date</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerBills.slice(0, 3).map(b => (
                            <tr key={b.id}>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>#{getDisplayBillId(b)}</td>
                              <td>{b.date || '-'}</td>
                              <td>{b.items?.length || 0} line item(s)</td>
                              <td style={{ fontWeight: 600 }}>₹{Number(b.total || 0).toFixed(2)}</td>
                              <td>
                                <span className={`badge ${Number(b.balance || 0) <= 0.01 ? 'badge-success' : 'badge-warning'}`}>
                                  {Number(b.balance || 0) <= 0.01 ? 'Paid' : `Due: ₹${Number(b.balance).toFixed(2)}`}
                                </span>
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

            {/* ── SUB-TAB 2: INVOICES & BILLS ── */}
            {activeTab === 'bills' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Bills Filter Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { key: 'all', label: `All Bills (${customerBills.length})` },
                      { key: 'due', label: 'Pending Due' },
                      { key: 'paid', label: 'Fully Paid' }
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setBillStatusFilter(f.key)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: billStatusFilter === f.key ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: billStatusFilter === f.key ? 'var(--accent-light)' : 'transparent',
                          color: billStatusFilter === f.key ? 'var(--accent)' : 'var(--text-secondary)'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/billing?customerId=${selectedCustomer.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={15} /> Create New Invoice
                  </button>
                </div>

                {/* Bills List / Table */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {filteredBills.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <EmptyState
                        Icon={FileText}
                        title="No invoices found"
                        description="There are no bills matching the selected filter."
                      />
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Invoice ID</th>
                            <th>Date</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Paid</th>
                            <th>Balance</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBills.map(bill => {
                            const isExpanded = expandedBillId === bill.id
                            const balance = Number(bill.balance || 0)
                            const displayBillId = getDisplayBillId(bill)

                            return (
                              <React.Fragment key={bill.id}>
                                <tr>
                                  <td style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </td>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                    #{displayBillId}
                                  </td>
                                  <td>{bill.date || '-'}</td>
                                  <td>{bill.items?.length || 0} item(s)</td>
                                  <td style={{ fontWeight: 600 }}>₹{Number(bill.total || 0).toFixed(2)}</td>
                                  <td style={{ color: 'var(--success)' }}>₹{Number(bill.amountPaid || 0).toFixed(2)}</td>
                                  <td style={{ fontWeight: 600, color: balance > 0.01 ? 'var(--warning)' : 'var(--text-muted)' }}>
                                    ₹{balance.toFixed(2)}
                                  </td>
                                  <td>
                                    <span className={`badge ${balance <= 0.01 ? 'badge-success' : 'badge-warning'}`}>
                                      {balance <= 0.01 ? 'Paid' : 'Due'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        title="Edit Bill Items & Pricing"
                                        onClick={() => openEditBill(bill)}
                                        style={{ padding: '4px 8px' }}
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        title="Duplicate to POS"
                                        onClick={() => navigate(`/billing?duplicate=${bill.id}`)}
                                        style={{ padding: '4px 8px' }}
                                      >
                                        <Copy size={14} />
                                      </button>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        title="Print / View Receipt"
                                        onClick={() => navigate(`/receipt?billId=${bill.id}`)}
                                        style={{ padding: '4px 8px' }}
                                      >
                                        <Printer size={14} />
                                      </button>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        title="Apply Post-Discount"
                                        onClick={() => {
                                          setPostDiscountBill(bill)
                                          setPostDiscountVal('')
                                          setShowPostDiscountModal(true)
                                        }}
                                        style={{ padding: '4px 8px' }}
                                      >
                                        <Tag size={14} />
                                      </button>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        title="Delete Bill"
                                        onClick={() => {
                                          showConfirm({
                                            title: 'Delete Bill',
                                            message: `Delete invoice #${displayBillId}? This will reverse applied balances.`,
                                            onConfirm: () => {
                                              deleteBill(bill.id)
                                              showToast?.('Bill deleted', 'info')
                                            }
                                          })
                                        }}
                                        style={{ padding: '4px 8px', color: 'var(--error)' }}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* Expanded Item Breakdown */}
                                {isExpanded && (
                                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                                    <td colSpan={9} style={{ padding: '16px 24px' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                          Line Items Breakdown
                                        </div>
                                        <div className="table-container" style={{ background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                          <table className="table" style={{ margin: 0, fontSize: '0.82rem' }}>
                                            <thead>
                                              <tr>
                                                <th>Item Name</th>
                                                <th>Print Type</th>
                                                <th>Sides</th>
                                                <th>Qty</th>
                                                <th>Rate (₹)</th>
                                                <th>Amount (₹)</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(bill.items || []).map((it, idx) => (
                                                <tr key={idx}>
                                                  <td style={{ fontWeight: 600 }}>{it.itemName || it.name || 'Custom Item'}</td>
                                                  <td>{it.printType === 'bw' ? 'B&W' : it.printType === 'color' ? 'Color' : '-'}</td>
                                                  <td>{it.sides === 'double' ? 'Double Sided' : 'Single Sided'}</td>
                                                  <td>{it.qty}</td>
                                                  <td>₹{Number(it.unitPrice || 0).toFixed(2)}</td>
                                                  <td style={{ fontWeight: 600 }}>₹{Number(it.amount || 0).toFixed(2)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                        {bill.notes && (
                                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            <strong>Notes:</strong> {bill.notes}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SUB-TAB 3: ACCOUNT LEDGER & STATEMENT ── */}
            {activeTab === 'ledger' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Period Selector & Export Actions */}
                <div className="card" style={{ padding: '16px 20px', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                    {/* Period Pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {LEDGER_PERIODS.map(p => (
                        <button
                          key={p.key}
                          onClick={() => setLedgerPeriod(p.key)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: ledgerPeriod === p.key ? '1px solid var(--accent)' : '1px solid var(--border)',
                            background: ledgerPeriod === p.key ? 'var(--accent-light)' : 'transparent',
                            color: ledgerPeriod === p.key ? 'var(--accent)' : 'var(--text-secondary)'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Export / Share Actions */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ position: 'relative' }} ref={whatsAppDropdownRef}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowWhatsAppDropdown(prev => !prev)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <MessageCircle size={15} color="#25D366" />
                          <span>Share WhatsApp</span>
                          <ChevronDown size={14} />
                        </button>
                        {showWhatsAppDropdown && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: '6px',
                              background: 'var(--bg-card, #ffffff)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                              zIndex: 100,
                              minWidth: '250px',
                              padding: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{
                                width: '100%',
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                padding: '8px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                borderRadius: '6px'
                              }}
                              onClick={() => {
                                setShowWhatsAppDropdown(false)
                                handleShareWhatsAppQuick()
                              }}
                            >
                              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>⚡ Quick Due Reminder</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Brief outstanding balance + UPI link</span>
                            </button>
                            <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{
                                width: '100%',
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                padding: '8px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                borderRadius: '6px'
                              }}
                              onClick={() => {
                                setShowWhatsAppDropdown(false)
                                handleShareWhatsAppDetailed()
                              }}
                            >
                              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>📋 Detailed Account Statement</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Itemized pending bills + payment link</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleExportStatementPdf}
                        disabled={exportingPdf}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Download size={15} /> {exportingPdf ? 'Exporting...' : 'Download Statement PDF'}
                      </button>
                    </div>
                  </div>

                  {/* Custom Date Inputs if 'custom' is active */}
                  {ledgerPeriod === 'custom' && (
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>Start Date</label>
                        <input
                          type="date"
                          className="form-input"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          style={{ fontSize: '0.82rem' }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>End Date</label>
                        <input
                          type="date"
                          className="form-input"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          style={{ fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Ledger KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div className="card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Debits (Billed)</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                      ₹{ledgerDebits.toFixed(2)}
                    </div>
                  </div>
                  <div className="card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Credits (Paid)</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', color: 'var(--success)' }}>
                      ₹{ledgerCredits.toFixed(2)}
                    </div>
                  </div>
                  <div className="card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closing Net Balance</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', color: ledgerFinalBalance > 0.01 ? 'var(--warning)' : 'var(--text-primary)' }}>
                      ₹{ledgerFinalBalance.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Chronological Statement Timeline Table */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {ledgerEntries.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <EmptyState
                        Icon={ClipboardList}
                        title="No ledger entries"
                        description="No transactions found for the selected period."
                      />
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th style={{ textAlign: 'right' }}>Debit (₹)</th>
                            <th style={{ textAlign: 'right' }}>Credit (₹)</th>
                            <th style={{ textAlign: 'right' }}>Running Balance (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerEntries.map((e, idx) => {
                            const isDebit = (e.debit || 0) > 0
                            const isCredit = (e.credit || 0) > 0 || (e.advanceIn || 0) > 0
                            return (
                              <tr key={idx}>
                                <td>{e.date ? e.date.slice(0, 10) : '-'}</td>
                                <td>
                                  <span className={`badge ${
                                    e.type === 'bill' ? 'badge-info' :
                                    e.type === 'advance' ? 'badge-success' :
                                    e.type === 'refund' ? 'badge-error' : 'badge-ghost'
                                  }`}>
                                    {e.type === 'bill' ? 'Invoice' : e.type === 'advance' ? 'Advance' : e.type === 'refund' ? 'Refund' : 'Payment'}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{e.description}</div>
                                  {e.subtext && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{e.subtext}</div>}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: isDebit ? 600 : 400, color: isDebit ? 'var(--warning)' : 'inherit' }}>
                                  {isDebit ? `₹${e.debit.toFixed(2)}` : '-'}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: isCredit ? 600 : 400, color: isCredit ? 'var(--success)' : 'inherit' }}>
                                  {isCredit ? `₹${(e.credit || e.advanceIn).toFixed(2)}` : '-'}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                  ₹{e.balance.toFixed(2)}
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
          </div>
        ) : (
          /* Empty selection placeholder */
          <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <EmptyState
              Icon={Users}
              title="Select a Customer"
              description="Click any customer from the left directory to view their complete 360 profile, invoices, and statement."
            />
          </div>
        )}
      </div>

      {/* ── MODAL 1: ADD / EDIT CUSTOMER ── */}
      {showCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowCustomerModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditingCustomer ? 'Edit Customer Profile' : 'Add New Customer'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCustomerModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCustomerSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {isEditingCustomer ? (
                  <div className="form-group">
                    <label className="form-label">Customer Type</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                      <span className={`badge ${customerForm.type === 'regular' ? 'badge-info' : 'badge-warning'}`}>
                        {customerForm.type === 'regular' ? 'Regular Customer' : 'Walk-in Customer'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        (Protected. Walk-in accounts must be converted via Master PIN)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Customer Type</label>
                    <select
                      className="form-input"
                      value={customerForm.type}
                      onChange={(e) => setCustomerForm(f => ({ ...f, type: e.target.value }))}
                    >
                      <option value="regular">Regular Customer (Account & Credit)</option>
                      <option value="random">Walk-in / Cash Only</option>
                    </select>
                  </div>
                )}

                {customerGroups.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Customer Group / Tag</label>
                    <select
                      className="form-input"
                      value={customerForm.groupId || ''}
                      onChange={(e) => setCustomerForm(f => ({ ...f, groupId: e.target.value }))}
                    >
                      <option value="">No Group (General)</option>
                      {customerGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input
                    className={`form-input${customerFormErrors.name ? ' form-input-error' : ''}`}
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm(f => ({ ...f, name: e.target.value }))}
                  />
                  {customerFormErrors.name && <div className="form-error">{customerFormErrors.name}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    className={`form-input${customerFormErrors.phone ? ' form-input-error' : ''}`}
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm(f => ({ ...f, phone: e.target.value }))}
                  />
                  {customerFormErrors.phone && <div className="form-error">{customerFormErrors.phone}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    className={`form-input${customerFormErrors.email ? ' form-input-error' : ''}`}
                    type="email"
                    placeholder="customer@domain.com"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm(f => ({ ...f, email: e.target.value }))}
                  />
                  {customerFormErrors.email && <div className="form-error">{customerFormErrors.email}</div>}
                </div>

                {customerForm.type === 'regular' && isEditingCustomer && (
                  <div className="form-group">
                    <label className="form-label">Credit Balance (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={customerForm.creditBalance}
                      onChange={(e) => setCustomerForm(f => ({ ...f, creditBalance: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditingCustomer ? 'Save Changes' : 'Create Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT BILL ITEMS & PRICING ── */}
      {isEditBillModalOpen && editingBill && (
        <div className="modal-overlay" onClick={() => setIsEditBillModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>Edit Invoice #{getDisplayBillId(editingBill)}</h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customer: {selectedCustomer?.name}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditBillModalOpen(false)}><X size={16} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Invoice Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Line Items</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addEditRow} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Plus size={14} /> Add Item
                  </button>
                </div>

                <div className="table-container" style={{ border: '1px solid var(--border)', borderRadius: '6px' }}>
                  <table className="table" style={{ margin: 0, fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th style={{ width: '90px' }}>Type</th>
                        <th style={{ width: '90px' }}>Sides</th>
                        <th style={{ width: '70px' }}>Qty</th>
                        <th style={{ width: '90px' }}>Rate (₹)</th>
                        <th style={{ width: '90px' }}>Total (₹)</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItemRows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <input
                              className="form-input"
                              type="text"
                              value={r.itemName}
                              onChange={(e) => updateEditRow(r.id, { itemName: e.target.value })}
                              style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                            />
                          </td>
                          <td>
                            <select
                              className="form-input"
                              value={r.printType}
                              onChange={(e) => updateEditRow(r.id, { printType: e.target.value })}
                              style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                            >
                              <option value="color">Color</option>
                              <option value="bw">B&W</option>
                              <option value="na">N/A</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-input"
                              value={r.sides}
                              onChange={(e) => updateEditRow(r.id, { sides: e.target.value })}
                              style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                            >
                              <option value="single">Single</option>
                              <option value="double">Double</option>
                              <option value="na">N/A</option>
                            </select>
                          </td>
                          <td>
                            <input
                              className="form-input"
                              type="number"
                              min="1"
                              value={r.qty}
                              onChange={(e) => updateEditRow(r.id, { qty: e.target.value })}
                              style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                            />
                          </td>
                          <td>
                            <input
                              className="form-input"
                              type="number"
                              step="0.01"
                              value={r.unitPrice}
                              onChange={(e) => updateEditRow(r.id, { unitPrice: e.target.value })}
                              style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                            />
                          </td>
                          <td style={{ fontWeight: 600 }}>₹{(Number(r.amount) || 0).toFixed(2)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => removeEditRow(r.id)}
                              style={{ padding: '2px', color: 'var(--error)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Discount & Totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Discount</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="form-input"
                      value={editDiscountType}
                      onChange={(e) => setEditDiscountType(e.target.value)}
                      style={{ width: '100px' }}
                    >
                      <option value="flat">₹ Flat</option>
                      <option value="percent">% Percent</option>
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={editDiscountValue}
                      onChange={(e) => setEditDiscountValue(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginTop: '6px' }}>
                    <label className="form-label">Notes</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Optional bill notes..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Summary Box */}
                <div style={{ background: 'var(--bg-elevated)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Subtotal:</span>
                    <span>₹{computedEditSubtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Discount:</span>
                    <span style={{ color: 'var(--success)' }}>- ₹{computedEditDiscount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                    <span>New Total:</span>
                    <span style={{ color: 'var(--accent)' }}>₹{computedEditTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditBillModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEditedBill}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: LOYALTY ADJUST POINTS ── */}
      {showAdjustPointsModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowAdjustPointsModal(false)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adjust Loyalty Points</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdjustPointsModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSavePointsAdjustment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.08)', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customer Current Balance</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#c084fc' }}>{loyaltyBal} Points</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Adjustment Operation</label>
                  <select
                    className="form-input"
                    value={adjustOp}
                    onChange={(e) => setAdjustOp(e.target.value)}
                  >
                    <option value="add">+ Add Bonus / Reward Points</option>
                    <option value="deduct">- Deduct Points (Manual / Expired)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Points Count *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    placeholder="e.g. 50"
                    value={adjustPointsVal}
                    onChange={(e) => setAdjustPointsVal(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Reason / Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Festival bonus / Owner adjustment"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustPointsModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={adjusting}>
                  {adjusting ? 'Saving...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: POST-BILL DISCOUNT ── */}
      {showPostDiscountModal && postDiscountBill && (
        <div className="modal-overlay" onClick={() => setShowPostDiscountModal(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post-Bill Discount</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPostDiscountModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Apply an additional post-order courtesy discount to bill #{getDisplayBillId(postDiscountBill)}.
              </p>
              <div className="form-group">
                <label className="form-label">Discount Type</label>
                <select
                  className="form-input"
                  value={postDiscountType}
                  onChange={(e) => setPostDiscountType(e.target.value)}
                >
                  <option value="flat">₹ Flat Amount</option>
                  <option value="percent">% Percentage</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Discount Value</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="0.00"
                  value={postDiscountVal}
                  onChange={(e) => setPostDiscountVal(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPostDiscountModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleApplyPostDiscount}>Apply Discount</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 5: LOYALTY HISTORY DRAWER ── */}
      {loyaltyCustomer && (
        <div className="modal-overlay" onClick={() => setLoyaltyCustomer(null)}>
          <div className="modal" style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={20} color="#c084fc" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Loyalty Audit Trail</h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{loyaltyCustomer.name} ({getDisplayCustomerId(loyaltyCustomer)})</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setLoyaltyCustomer(null)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {loadingLoyalty ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading audit trail...</div>
              ) : loyaltyEvents.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No loyalty events recorded yet.</div>
              ) : (
                <div className="table-container">
                  <table className="table" style={{ margin: 0, fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Points</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loyaltyEvents.map((ev, idx) => (
                        <tr key={idx}>
                          <td>{ev.created_at ? new Date(ev.created_at).toLocaleDateString() : '-'}</td>
                          <td>
                            <span className={`badge ${ev.event_type === 'earned' ? 'badge-success' : 'badge-warning'}`}>
                              {ev.event_type}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: ev.points >= 0 ? 'var(--success)' : 'var(--warning)' }}>
                            {ev.points >= 0 ? `+${ev.points}` : ev.points}
                          </td>
                          <td>{ev.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setLoyaltyCustomer(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 5: CONVERT WALK-IN TO REGULAR WITH MASTER PIN ── */}
      {showConvertModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowConvertModal(false)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="var(--accent)" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Convert to Regular Customer</h2>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Protected Operation · Master Security PIN</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConvertModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleConvertCustomer}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)'
                }}>
                  Converting this customer will grant full credit tracking, ledger histories, and statement downloads. A permanent Regular Customer code (<strong>{getNextRegularCustomerCode(customers)}</strong>) will be assigned.
                </div>

                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={convertName}
                    onChange={(e) => setConvertName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Customer Phone * (Required for Regular)</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="10-digit mobile number"
                    value={convertPhone}
                    onChange={(e) => setConvertPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={13} />
                    <span>Enter Master Security PIN *</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConvertPin ? 'text' : 'password'}
                      className="form-input"
                      placeholder="4-6 digit owner PIN"
                      value={convertPin}
                      onChange={(e) => {
                        setConvertPin(e.target.value)
                        setConvertError('')
                      }}
                      autoComplete="new-password"
                      maxLength={6}
                      required
                      style={{ paddingRight: '40px', letterSpacing: showConvertPin ? 'normal' : '0.25em' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConvertPin(p => !p)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      tabIndex={-1}
                    >
                      {showConvertPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Configured under Settings → Security & Protected Operations
                  </span>
                </div>

                {convertError && (
                  <div className="form-error" style={{ fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: '6px' }}>
                    {convertError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConvertModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isConverting}>
                  {isConverting ? 'Converting...' : 'Verify PIN & Convert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Customers
