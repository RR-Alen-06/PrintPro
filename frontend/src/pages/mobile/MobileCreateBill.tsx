import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import { useInventory, useInventoryMutations } from '../../hooks/useEntitiesQuery'
import { useSettings } from '../../hooks/useSettingsQuery'
import { usePromoCodes } from '../../hooks/usePromoCodesQuery'
import { SequenceService } from '../../services/sequenceService'
import { LoyaltyService } from '../../services/loyaltyService'
import { CreditService } from '../../services/creditService'
import { GroupBillingService } from '../../services/groupBillingService'
import { useUnifiedFinancialHub } from '../../hooks/useUnifiedFinancialHub'
import LoyaltyEnginePanel from '../../components/common/LoyaltyEnginePanel'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  UserCheck, Plus, Trash2, Search, Minus,
  Tag, UserPlus, Printer, Calendar,
  Loader2, X, ChevronDown, ChevronUp, Layers, SlidersHorizontal,
  Package, BookOpen, Sparkles
} from 'lucide-react'
import '../../styles/mobile.css'

interface ItemRow {
  itemId?: string;
  id?: string;
  itemName?: string;
  name?: string;
  itemType?: 'product' | 'print';
  printType?: string;
  print_type?: string;
  sides?: string;
  qty?: number | string;
  quantity?: number | string;
  pages?: number | string;
  unitPrice?: number | string;
  unit_price?: number | string;
  gstRate?: number | string;
  amount?: number | string;
  isCustom?: boolean;
  [key: string]: unknown;
}

interface PromoCodeItem {
  id?: string;
  code: string;
  type: 'flat' | 'percent';
  value: number;
  min_order_amount?: number;
  minOrderAmount?: number;
  [key: string]: unknown;
}

export default function MobileCreateBill() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editBillId = searchParams.get('edit')

  const { showToast, editBill } = useAppContext()
  const { settings = {} } = useSettings()
  const { promoCodes = [] } = usePromoCodes()
  const { getCustomerFinancials, createBillAndSync, updateBillAndSync } = useUnifiedFinancialHub()

  // TanStack Queries & Mutations
  const { data: serverCustomers = [] } = useCustomers()
  const { data: serverInventory = [] } = useInventory()
  const { data: serverBills = [] } = useBills()
  const { isCreatingBill, isUpdatingBill } = useBillMutations()
  const { createCustomer: createCustomerMutation, isCreating: isCreatingCustomer } = useCustomerMutations()
  const { adjustStock } = useInventoryMutations()

  // Customer Selection State (Default: Walk-in)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false)
  const [customerFilterTab, setCustomerFilterTab] = useState<'all' | 'regular' | 'random'>('all')
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')

  // Dates & Details
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => {
    const next = new Date()
    next.setDate(next.getDate() + 7)
    return next.toISOString().slice(0, 10)
  })
  const [showScheduleNotes, setShowScheduleNotes] = useState(false)
  const [notes, setNotes] = useState('')

  // Items State
  const [itemRows, setItemRows] = useState<ItemRow[]>([])

  // Quick-Add Bar State
  const [quickInventoryId, setQuickInventoryId] = useState('')
  const [quickQty, setQuickQty] = useState(1)

  // Advanced / Custom Item Bottom Sheet State
  const [showAddItemSheet, setShowAddItemSheet] = useState(false)
  const [modalTab, setModalTab] = useState<'product' | 'print'>('product')
  
  // General Product Form State (Book, Pen, Stationery, etc.)
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState<number | string>('')
  const [productQty, setProductQty] = useState<number | string>(1)
  const [productGstRate, setProductGstRate] = useState<number>(0)

  // Print Specs Form State
  const [isCustomPrint, setIsCustomPrint] = useState(false)
  const [customPrintName, setCustomPrintName] = useState('')
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [itemPrintType, setItemPrintType] = useState('color')
  const [itemSides, setItemSides] = useState('single')
  const [itemQty, setItemQty] = useState(1)
  const [itemPages, setItemPages] = useState(1)
  const [itemUnitPrice, setItemUnitPrice] = useState('')
  const [itemGstRate, setItemGstRate] = useState(0)

  // Discounts, Promos, Loyalty & Round Off
  const [showDiscountsSection, setShowDiscountsSection] = useState(false)
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat')
  const [discountValue, setDiscountValue] = useState<number | string>('')
  const [roundOffMode, setRoundOffMode] = useState<'none' | 'nearest' | 'up' | 'down'>('nearest')
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeItem | null>(null)
  const [showBrowsePromos, setShowBrowsePromos] = useState(false)
  
  // Loyalty redemption state
  const [shouldRedeemLoyalty, setShouldRedeemLoyalty] = useState(false)
  const [loyaltyPointsRedeemed, setLoyaltyPointsRedeemed] = useState('')

  // Advance balance credit usage
  const [useAdvanceCredit, setUseAdvanceCredit] = useState(false)

  // Payment Selection State (Defaults to Full Cash)
  const [paymentMode, setPaymentMode] = useState<'full_cash' | 'full_upi' | 'split' | 'credit'>('full_cash')
  const [cashAmount, setCashAmount] = useState<number | string>('')
  const [upiAmount, setUpiAmount] = useState<number | string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync inventory selection defaults
  useEffect(() => {
    if (serverInventory.length > 0) {
      if (!quickInventoryId) setQuickInventoryId(serverInventory[0].id)
      if (!selectedInventoryId) setSelectedInventoryId(serverInventory[0].id)
    }
  }, [serverInventory, quickInventoryId, selectedInventoryId])

  // If in Edit Mode, populate existing bill data
  useEffect(() => {
    if (editBillId && serverBills.length > 0) {
      const existing = serverBills.find(b => String(b.id) === String(editBillId))
      if (existing) {
        setSelectedCustomerId(existing.customerId || existing.customer_id || '')
        setItemRows(existing.items || [])
        setDiscountValue(existing.discountValue || existing.discount_value || existing.discount || 0)
        setDiscountType(existing.discountType || existing.discount_type || 'flat')
        setNotes(existing.notes || '')
        setBillDate(existing.date || new Date().toISOString().slice(0, 10))
        setDueDate(existing.dueDate || existing.due_date || new Date().toISOString().slice(0, 10))
        showToast(`Editing Bill #${existing.invoiceNumber || existing.invoice_number || existing.id}`, 'info')
      }
    }
  }, [editBillId, serverBills, showToast])

  // Current selected customer object
  const selectedCustomerObj = useMemo(() => {
    if (!selectedCustomerId || selectedCustomerId === 'walk-in') return null
    return (serverCustomers || []).find(c =>
      String(c.id) === String(selectedCustomerId) ||
      (c.customerCode && String(c.customerCode) === String(selectedCustomerId))
    )
  }, [serverCustomers, selectedCustomerId])

  // Filtered customer list for search modal
  const filteredCustomers = useMemo(() => {
    return (serverCustomers || []).filter(c => {
      if (c.deleted) return false
      if (customerFilterTab !== 'all' && c.type !== customerFilterTab) return false
      if (customerSearch.trim()) {
        const q = customerSearch.toLowerCase().trim()
        return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
      }
      return true
    })
  }, [serverCustomers, customerFilterTab, customerSearch])

  // Calculation helper for custom modal unit price
  const activeInventoryObj = useMemo(() => {
    return (serverInventory || []).find(i => String(i.id) === String(selectedInventoryId))
  }, [serverInventory, selectedInventoryId])

  const calculatedUnitPrice = useMemo(() => {
    if (isCustomPrint) return Number(itemUnitPrice || 0)
    if (!activeInventoryObj) return 10.0
    if (itemPrintType === 'color' && itemSides === 'single') return Number(activeInventoryObj.colorSingle ?? activeInventoryObj.color_single ?? 10.0) || 10.0
    if (itemPrintType === 'color' && itemSides === 'double') return Number(activeInventoryObj.colorDouble ?? activeInventoryObj.color_double ?? 18.0) || 18.0
    if (itemPrintType === 'bw' && itemSides === 'single') return Number(activeInventoryObj.bwSingle ?? activeInventoryObj.bw_single ?? 3.0) || 3.0
    if (itemPrintType === 'bw' && itemSides === 'double') return Number(activeInventoryObj.bwDouble ?? activeInventoryObj.bw_double ?? 5.0) || 5.0
    return Number(activeInventoryObj.price ?? activeInventoryObj.unit_price ?? 10.0) || 10.0
  }, [activeInventoryObj, itemPrintType, itemSides, isCustomPrint, itemUnitPrice])

  // Quick-Add active inventory object
  const quickActiveInventoryObj = useMemo(() => {
    return (serverInventory || []).find(i => String(i.id) === String(quickInventoryId))
  }, [serverInventory, quickInventoryId])

  // Quick Add Item to Bill
  const handleQuickAddItem = () => {
    if (!quickActiveInventoryObj) return
    const rate = Number(quickActiveInventoryObj.price ?? quickActiveInventoryObj.unit_price ?? quickActiveInventoryObj.colorSingle ?? 10.0) || 10.0
    const qty = Math.max(1, Number(quickQty) || 1)
    const name = quickActiveInventoryObj.name || 'Print Item'
    const isPrint = Boolean(quickActiveInventoryObj.colorSingle || quickActiveInventoryObj.colorDouble || quickActiveInventoryObj.bwSingle || quickActiveInventoryObj.bwDouble)

    const newRow: ItemRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      itemId: quickActiveInventoryObj.id,
      itemName: name,
      name: name,
      itemType: isPrint ? 'print' : 'product',
      isCustom: false,
      printType: isPrint ? 'color' : undefined,
      sides: isPrint ? 'single' : undefined,
      qty: qty,
      pages: 1,
      unitPrice: rate,
      unit_price: rate,
      gstRate: Number(quickActiveInventoryObj.gstRate ?? quickActiveInventoryObj.gst_rate ?? 0),
      amount: rate * qty
    }

    const { items: updatedItems, merged } = GroupBillingService.mergeLineItem(itemRows, newRow)
    setItemRows(updatedItems)
    if (merged) {
      showToast(`Updated '${name}' quantity (+${qty})`, 'success')
    } else {
      showToast(`Added '${name}' × ${qty}`, 'success')
    }
    setQuickQty(1)
  }

  // Add Item via Bottom Sheet Modal
  const handleAddModalItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (modalTab === 'product') {
      const name = productName.trim() || 'General Item'
      const rate = Math.max(0, Number(productPrice) || 0)
      const qtyNum = Math.max(1, Number(productQty) || 1)
      const totalAmount = Number((rate * qtyNum).toFixed(2))

      const newRow: ItemRow = {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        itemId: '',
        itemName: name,
        name: name,
        itemType: 'product',
        isCustom: true,
        qty: qtyNum,
        pages: 1,
        unitPrice: rate,
        unit_price: rate,
        gstRate: Number(productGstRate || 0),
        amount: totalAmount
      }

      const { items: updatedItems, merged } = GroupBillingService.mergeLineItem(itemRows, newRow)
      setItemRows(updatedItems)
      setShowAddItemSheet(false)
      setProductName('')
      setProductPrice('')
      setProductQty(1)
      setProductGstRate(0)
      if (merged) {
        showToast(`Updated '${name}' quantity (+${qtyNum})`, 'success')
      } else {
        showToast(`Added '${name}' × ${qtyNum}`, 'success')
      }
    } else {
      const rate = Number(itemUnitPrice || calculatedUnitPrice)
      const name = isCustomPrint ? (customPrintName.trim() || 'Custom Print') : (activeInventoryObj?.name || 'A4 Print')
      const qtyNum = Math.max(1, Number(itemQty) || 1)
      const pagesNum = Math.max(1, Number(itemPages) || 1)
      const totalAmount = Number((rate * qtyNum * pagesNum).toFixed(2))

      const newRow: ItemRow = {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        itemId: isCustomPrint ? '' : selectedInventoryId,
        itemName: name,
        name: name,
        itemType: 'print',
        isCustom: isCustomPrint,
        printType: itemPrintType,
        sides: itemSides,
        qty: qtyNum,
        pages: pagesNum,
        unitPrice: rate,
        unit_price: rate,
        gstRate: Number(itemGstRate || 0),
        amount: totalAmount
      }

      const { items: updatedItems, merged } = GroupBillingService.mergeLineItem(itemRows, newRow)
      setItemRows(updatedItems)
      setShowAddItemSheet(false)
      setCustomPrintName('')
      setIsCustomPrint(false)
      setItemQty(1)
      setItemPages(1)
      setItemUnitPrice('')
      setItemGstRate(0)
      if (merged) {
        showToast(`Updated '${name}' quantity (+${qtyNum})`, 'success')
      } else {
        showToast(`Added '${name}' to order`, 'success')
      }
    }
  }

  // Update Item Quantity inline with stepper
  const handleUpdateItemQty = (rowId: string, delta: number) => {
    setItemRows(prev => prev.map(r => {
      if (r.id === rowId) {
        const newQty = Math.max(1, Number(r.qty || 1) + delta)
        const pages = Number(r.pages || 1)
        const rate = Number(r.unitPrice || r.unit_price || 0)
        return {
          ...r,
          qty: newQty,
          amount: Number((rate * newQty * pages).toFixed(2))
        }
      }
      return r
    }))
  }

  // Set Item Quantity directly
  const handleSetItemQty = (rowId: string, val: number | string) => {
    const newQty = Math.max(1, Number(val) || 1)
    setItemRows(prev => prev.map(r => {
      if (r.id === rowId) {
        const pages = Number(r.pages || 1)
        const rate = Number(r.unitPrice || r.unit_price || 0)
        return {
          ...r,
          qty: val,
          amount: Number((rate * newQty * pages).toFixed(2))
        }
      }
      return r
    }))
  }

  // Update Item Unit Price inline
  const handleUpdateItemPrice = (rowId: string, newRate: number | string) => {
    const rateNum = Math.max(0, Number(newRate) || 0)
    setItemRows(prev => prev.map(r => {
      if (r.id === rowId) {
        const qty = Number(r.qty || 1)
        const pages = Number(r.pages || 1)
        return {
          ...r,
          unitPrice: newRate,
          unit_price: newRate,
          amount: Number((rateNum * qty * pages).toFixed(2))
        }
      }
      return r
    }))
  }

  // Update Item Name inline
  const handleUpdateItemName = (rowId: string, newName: string) => {
    setItemRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          itemName: newName,
          name: newName
        }
      }
      return r
    }))
  }

  // Remove Item
  const handleRemoveItem = (rowId: string) => {
    setItemRows(prev => prev.filter(r => r.id !== rowId))
  }

  // Quick Customer Creation
  const handleAddNewCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = newCustName.trim()
    if (!trimmedName) {
      showToast('Customer name is required', 'error')
      return
    }

    const tempId = `temp-${Date.now()}`
    const newCustPayload = {
      id: tempId,
      name: trimmedName,
      phone: newCustPhone.trim() || '',
      type: 'regular',
      total_spent: 0,
      balance_due: 0
    }

    setSelectedCustomerId(tempId)
    setShowAddCustomerModal(false)
    setIsCustomerPickerOpen(false)
    setNewCustName('')
    setNewCustPhone('')
    showToast(`Client '${trimmedName}' added & selected!`, 'success')

    try {
      createCustomerMutation(newCustPayload)
        .then((created) => {
          if (created?.id) {
            setSelectedCustomerId((curr) => (curr === tempId ? created.id : curr))
          }
        })
        .catch((err) => {
          showToast(err?.message || 'Failed to save customer', 'error')
        })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create customer'
      showToast(message, 'error')
    }
  }

  // Subtotal & Financial Totals
  const subtotal = useMemo(() => {
    return Number(itemRows.reduce((sum, r) => sum + Number(r.amount || 0), 0).toFixed(2))
  }, [itemRows])

  // Loyalty Discount Calculation via LoyaltyService
  const loyaltyDiscount = useMemo(() => {
    if (!shouldRedeemLoyalty || !selectedCustomerObj) return 0
    const points = Number(loyaltyPointsRedeemed || 0)
    const available = Number(selectedCustomerObj.loyalty_points || selectedCustomerObj.loyaltyPoints || 0)
    const redemption = LoyaltyService.calculateRedemptionDiscount(points, available, subtotal, settings)
    return typeof redemption === 'number' ? redemption : Number(redemption?.discountAmount || 0)
  }, [shouldRedeemLoyalty, selectedCustomerObj, loyaltyPointsRedeemed, settings, subtotal])

  const calculatedDiscount = useMemo(() => {
    let disc = 0
    const val = Number(discountValue || 0)
    if (discountType === 'flat') {
      disc = val
    } else {
      disc = (subtotal * val) / 100
    }
    if (appliedPromo) {
      if (appliedPromo.type === 'percent') {
        let promoDisc = (subtotal * Number(appliedPromo.value || 0)) / 100
        const maxCap = Number(appliedPromo.maxDiscount || appliedPromo.max_discount || 0)
        if (maxCap > 0 && promoDisc > maxCap) {
          promoDisc = maxCap
        }
        disc += promoDisc
      } else {
        disc += Number(appliedPromo.value || 0)
      }
    }
    disc += loyaltyDiscount
    return Number(Math.min(disc, subtotal).toFixed(2))
  }, [subtotal, discountType, discountValue, appliedPromo, loyaltyDiscount])

  // Customer Advance credit
  const customerFinancials = selectedCustomerId ? getCustomerFinancials(selectedCustomerId) : null
  const liveCustomerAdvance = customerFinancials?.advanceBalance ?? Number(selectedCustomerObj?.creditBalance || selectedCustomerObj?.credit_balance || selectedCustomerObj?.advanceBalance || 0)

  const netBeforeAdvance = Math.max(0, Number((subtotal - calculatedDiscount).toFixed(2)))
  const advanceDeduction = useMemo(() => {
    if (!useAdvanceCredit || liveCustomerAdvance <= 0) return 0
    return Number(CreditService.calculateAdvanceDrawdown(liveCustomerAdvance, netBeforeAdvance).advanceUsed.toFixed(2))
  }, [useAdvanceCredit, liveCustomerAdvance, netBeforeAdvance])

  const netBeforeRound = Math.max(0, Number((netBeforeAdvance - advanceDeduction).toFixed(2)))

  // Smart Round-Off Calculation (Nearest, Up, Down, None)
  const { roundedTotal, roundOffAmount } = useMemo(() => {
    if (netBeforeRound <= 0) {
      return { roundedTotal: 0, roundOffAmount: 0 }
    }
    if (roundOffMode === 'up') {
      const r = Math.ceil(netBeforeRound)
      return { roundedTotal: r, roundOffAmount: Number((r - netBeforeRound).toFixed(2)) }
    } else if (roundOffMode === 'down') {
      const r = Math.floor(netBeforeRound)
      return { roundedTotal: r, roundOffAmount: Number((r - netBeforeRound).toFixed(2)) }
    } else if (roundOffMode === 'nearest') {
      const r = Math.round(netBeforeRound)
      return { roundedTotal: r, roundOffAmount: Number((r - netBeforeRound).toFixed(2)) }
    } else {
      return { roundedTotal: Number(netBeforeRound.toFixed(2)), roundOffAmount: 0 }
    }
  }, [netBeforeRound, roundOffMode])

  const grandTotal = roundedTotal

  // Apply Promo Code (via input code or direct selection)
  const handleApplyPromo = (promoObj?: any) => {
    let target = promoObj
    if (!target) {
      if (!promoCodeInput.trim()) return
      const codeUpper = promoCodeInput.trim().toUpperCase()
      target = (promoCodes || []).find((p: any) => p.code?.toUpperCase() === codeUpper)
      if (!target) {
        showToast(`Invalid promo code '${codeUpper}'`, 'error')
        return
      }
    }

    if (target.enabled === false) {
      showToast(`Coupon '${target.code}' is currently disabled`, 'error')
      return
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const startDate = target.startDate || target.start_date
    const endDate = target.endDate || target.end_date

    if (startDate && todayStr < startDate) {
      showToast(`Coupon '${target.code}' starts on ${startDate}`, 'error')
      return
    }

    if (endDate && todayStr > endDate) {
      showToast(`Coupon '${target.code}' expired on ${endDate}`, 'error')
      return
    }

    const minSpend = Number(target.minAmount || target.min_amount || target.minOrderAmount || target.min_order_amount || 0)
    if (minSpend > 0 && subtotal < minSpend) {
      showToast(`Coupon '${target.code}' requires min spend of ₹${minSpend}`, 'error')
      return
    }

    setAppliedPromo(target)
    setPromoCodeInput('')
    setShowBrowsePromos(false)
    showToast(`Applied Coupon '${target.code}'!`, 'success')
  }

  // Submit Final Bill
  const handleFinalizeBillSubmit = async () => {
    if (itemRows.length === 0) {
      showToast('Please add at least one item to generate bill', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      let finalCash = 0
      let finalUpi = 0

      if (cashAmount !== '' || upiAmount !== '') {
        finalCash = Number(cashAmount || 0)
        finalUpi = Number(upiAmount || 0)
      } else if (paymentMode === 'full_cash') {
        finalCash = grandTotal
      } else if (paymentMode === 'full_upi') {
        finalUpi = grandTotal
      } else if (paymentMode === 'credit') {
        finalCash = 0
        finalUpi = 0
      }

      const totalDirectPaid = Number((finalCash + finalUpi).toFixed(2))
      let finalStatus = 'unpaid'
      if (totalDirectPaid >= grandTotal - 0.01) {
        finalStatus = 'paid'
      } else if (totalDirectPaid > 0) {
        finalStatus = 'partial'
      } else {
        finalStatus = 'unpaid'
      }

      const existingBill = editBillId ? serverBills.find(b => String(b.id) === String(editBillId)) : null
      const generatedInvoiceNo = editBillId
        ? (existingBill?.invoiceNumber || existingBill?.invoice_number || `INV-${editBillId}`)
        : await SequenceService.getNextSequenceSafe('BILL', serverBills, settings?.invPrefix || 'INV', settings?.seqPadding || 6)

      // Resolve customer
      let resolvedCustomerId = selectedCustomerObj?.id || selectedCustomerId
      let resolvedCustomerName = selectedCustomerObj?.name
      let resolvedCustomerPhone = selectedCustomerObj?.phone || ''

      if (!resolvedCustomerId || resolvedCustomerId === 'walk-in') {
        const defaultWalkIn = (serverCustomers || []).find((c) => !c.deleted && (c.type === 'random' || c.name?.toLowerCase().includes('walk-in')))
        if (defaultWalkIn) {
          resolvedCustomerId = defaultWalkIn.id
          resolvedCustomerName = defaultWalkIn.name
          resolvedCustomerPhone = defaultWalkIn.phone || ''
        } else {
          resolvedCustomerId = 'walk-in'
          resolvedCustomerName = 'Walk-in Customer'
        }
      }

      const billPayload = {
        id: editBillId || `BILL-${Date.now()}`,
        invoice_number: generatedInvoiceNo,
        invoiceNumber: generatedInvoiceNo,
        date: billDate,
        due_date: dueDate,
        dueDate: dueDate,
        customer_id: resolvedCustomerId,
        customerId: resolvedCustomerId,
        customer_name: resolvedCustomerName,
        customerName: resolvedCustomerName,
        customer_phone: resolvedCustomerPhone,
        customerPhone: resolvedCustomerPhone,
        items: itemRows.map(r => ({
          itemId: r.itemId || '',
          item_name: r.itemName || r.name || 'Print Item',
          name: r.itemName || r.name || 'Print Item',
          print_type: r.printType || 'color',
          printType: r.printType || 'color',
          sides: r.sides || 'single',
          qty: Number(r.qty || 1),
          pages: Number(r.pages || 1),
          unit_price: Number(r.unitPrice || r.unit_price || 0),
          unitPrice: Number(r.unitPrice || r.unit_price || 0),
          amount: Number(r.amount || 0)
        })),
        subtotal,
        discount_value: calculatedDiscount,
        discount: calculatedDiscount,
        discount_type: discountType,
        advance_deducted: advanceDeduction,
        advanceDeducted: advanceDeduction,
        advance_used: advanceDeduction,
        advanceUsed: advanceDeduction,
        round_off: roundOffAmount,
        roundOff: roundOffAmount,
        round_off_mode: roundOffMode,
        total: grandTotal,
        amount_paid: totalDirectPaid + advanceDeduction,
        amountPaid: totalDirectPaid + advanceDeduction,
        cash_amount: finalCash,
        cashAmount: finalCash,
        upi_amount: finalUpi,
        upiAmount: finalUpi,
        balance: Math.max(0, Number((grandTotal - totalDirectPaid).toFixed(2))),
        status: finalStatus,
        payment_mode: paymentMode,
        notes,
        created_at: new Date().toISOString()
      }

      if (editBillId) {
        await updateBillAndSync({ id: editBillId, data: billPayload })
        if (editBill) editBill(billPayload)
        showToast(`Bill #${billPayload.invoiceNumber} updated successfully!`, 'success')
        navigate(`/bill/${editBillId}`)
      } else {
        const mutationPromise = createBillAndSync(billPayload)

        navigate(`/bill/${billPayload.id}?share=true`)
        showToast(`Bill #${billPayload.invoiceNumber} created!`, 'success')

        mutationPromise
          .then(async (created) => {
            if (created?.id && created.id !== billPayload.id) {
              navigate(`/bill/${created.id}?share=true`, { replace: true })
            }

            // Deduct stock for product-type items
            const deductions = new Map<string, number>()
            const billItemsList = billPayload.items || []
            for (const item of billItemsList) {
              const invItem = (serverInventory || []).find(
                (i) => String(i.id) === String(item.itemId) || i.name === item.name
              )
              if (invItem && invItem.type === 'product') {
                const qty = Number(item.qty || 0)
                if (qty > 0) {
                  deductions.set(invItem.id, (deductions.get(invItem.id) || 0) + qty)
                }
              }
            }

            if (deductions.size > 0) {
              try {
                await Promise.all(
                  Array.from(deductions.entries()).map(([itemId, qty]) => adjustStock(itemId, -qty))
                )
              } catch (stockErr: unknown) {
                console.error('Failed to deduct stock:', stockErr)
                showToast('Invoice saved, but inventory stock deduction failed for some items', 'warning')
              }
            }
          })
          .catch((err) => {
            console.error('Bill sync notice:', err)
          })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save bill'
      showToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const previewInvoiceNumber = useMemo(() => {
    return SequenceService.peekNextSequence(
      'BILL',
      serverBills,
      settings?.invPrefix || 'INV',
      settings?.seqPadding || 6
    )
  }, [serverBills, settings?.invPrefix, settings?.seqPadding])

  return (
    <MobileLayout
      title={editBillId ? 'Edit POS Bill' : 'One-Step POS Billing'}
    >
      {/* Top Header Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="mobile-badge mobile-badge-primary" style={{ fontSize: '0.72rem', letterSpacing: '0.05em', fontWeight: 800 }}>
            ⚡ FAST POS
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {editBillId ? `EDITING #${editBillId}` : 'DIRECT CHECKOUT'}
          </span>
        </div>
        {!editBillId && (
          <span className="mobile-badge mobile-badge-info" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            #{previewInvoiceNumber}
          </span>
        )}
      </div>

      {/* SECTION 1: COMPACT CUSTOMER HEADER */}
      <div className="mobile-card" style={{ marginBottom: '14px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: selectedCustomerObj ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 47, 176, 0.15)',
                border: `1px solid ${selectedCustomerObj ? 'var(--accent-secondary)' : 'var(--accent-primary)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: selectedCustomerObj ? 'var(--accent-secondary)' : 'var(--accent-primary)'
              }}
            >
              {selectedCustomerObj ? <UserCheck size={18} /> : <UserPlus size={18} />}
            </div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {selectedCustomerObj ? selectedCustomerObj.name : 'Walk-in Customer'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                {selectedCustomerObj ? (
                  <>
                    <span>{selectedCustomerObj.phone || 'No phone'}</span>
                    {Number(selectedCustomerObj.balanceDue || selectedCustomerObj.balance_due || 0) > 0 && (
                      <span style={{ color: 'var(--error)' }}>
                        Due: ₹{Number(selectedCustomerObj.balanceDue || selectedCustomerObj.balance_due).toFixed(2)}
                      </span>
                    )}
                  </>
                ) : (
                  <span>Direct retail sale</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="mobile-btn mobile-btn-secondary"
              onClick={() => setIsCustomerPickerOpen(!isCustomerPickerOpen)}
              style={{ minHeight: '34px', padding: '0 10px', fontSize: '0.74rem' }}
            >
              <Search size={13} /> {selectedCustomerObj ? 'Change' : 'Find Client'}
            </button>
            <button
              type="button"
              className="mobile-btn mobile-btn-secondary"
              onClick={() => setShowAddCustomerModal(true)}
              style={{ minHeight: '34px', padding: '0 8px', fontSize: '0.74rem', color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Expandable Customer Search Dropdown */}
        {isCustomerPickerOpen && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="mobile-input"
                  style={{ paddingLeft: '32px', height: '38px', fontSize: '0.82rem' }}
                  placeholder="Search name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="mobile-btn mobile-btn-secondary"
                onClick={() => {
                  setSelectedCustomerId('')
                  setIsCustomerPickerOpen(false)
                }}
                style={{ minHeight: '38px', padding: '0 10px', fontSize: '0.74rem' }}
              >
                Walk-in
              </button>
            </div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
              {(['all', 'regular', 'random'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCustomerFilterTab(tab)}
                  style={{
                    flex: 1,
                    minHeight: '26px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    border: customerFilterTab === tab ? '1px solid var(--accent-secondary)' : '1px solid var(--border)',
                    background: customerFilterTab === tab ? 'rgba(0, 240, 255, 0.15)' : 'var(--bg-card)',
                    color: customerFilterTab === tab ? 'var(--accent-secondary)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {tab === 'all' ? 'All Clients' : tab === 'regular' ? 'Regular' : 'Walk-in'}
                </button>
              ))}
            </div>

            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredCustomers.slice(0, 10).map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomerId(c.id)
                    setIsCustomerPickerOpen(false)
                  }}
                  style={{
                    padding: '8px 10px',
                    background: String(c.id) === String(selectedCustomerId) ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-input)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '0.82rem'
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{c.name}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.74rem' }}>{c.phone}</span>
                  </div>
                  {Number(c.balanceDue || c.balance_due || 0) > 0 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--error)' }}>
                      ₹{Number(c.balanceDue || c.balance_due).toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible Dates & Order Notes Toggle */}
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowScheduleNotes(!showScheduleNotes)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--text-muted)',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <Calendar size={13} />
            <span>Date: {billDate} {notes ? '• Has Notes' : ''}</span>
            {showScheduleNotes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {selectedCustomerObj && (
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-secondary)' }}>
              Points: {Number(selectedCustomerObj.loyalty_points || selectedCustomerObj.loyaltyPoints || 0)}
            </span>
          )}
        </div>

        {showScheduleNotes && (
          <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Invoice Date</label>
              <input
                type="date"
                className="mobile-input"
                style={{ height: '36px', fontSize: '0.78rem' }}
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Due Date</label>
              <input
                type="date"
                className="mobile-input"
                style={{ height: '36px', fontSize: '0.78rem' }}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <input
                type="text"
                className="mobile-input"
                style={{ height: '36px', fontSize: '0.78rem' }}
                placeholder="Internal order remarks / notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: ITEMS CART & QUICK-ADD */}
      <div className="mobile-card mobile-card-glow" style={{ marginBottom: '14px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: '0.94rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              BILL ITEMS ({itemRows.length})
            </h3>
          </div>
          <button
            type="button"
            className="mobile-btn mobile-btn-secondary"
            onClick={() => setShowAddItemSheet(true)}
            style={{ minHeight: '32px', padding: '0 10px', fontSize: '0.74rem', color: 'var(--accent-secondary)', borderColor: 'var(--accent-secondary)' }}
          >
            <SlidersHorizontal size={13} /> + Custom Item / Specs
          </button>
        </div>

        {/* Dynamic Quick Items Tap Chips */}
        {serverInventory.length > 0 ? (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              ⚡ Quick Tap Add
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {(serverInventory || []).slice(0, 8).map((inv: any) => {
                const p = Number(inv.price ?? inv.unit_price ?? inv.colorSingle ?? inv.bwSingle ?? 10)
                const isPrint = Boolean(inv.colorSingle || inv.colorDouble || inv.bwSingle || inv.bwDouble)
                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => {
                      const newRow: ItemRow = {
                        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                        itemId: inv.id,
                        itemName: inv.name || 'Item',
                        name: inv.name || 'Item',
                        itemType: isPrint ? 'print' : 'product',
                        isCustom: false,
                        printType: isPrint ? 'color' : undefined,
                        sides: isPrint ? 'single' : undefined,
                        qty: 1,
                        pages: 1,
                        unitPrice: p,
                        unit_price: p,
                        gstRate: Number(inv.gstRate ?? inv.gst_rate ?? 0),
                        amount: p
                      }
                      const { items: updatedItems, merged } = GroupBillingService.mergeLineItem(itemRows, newRow)
                      setItemRows(updatedItems)
                      showToast(merged ? `+1 ${inv.name}` : `Added ${inv.name}`, 'success')
                    }}
                    style={{
                      flex: '0 0 auto',
                      padding: '5px 9px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-full)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      transition: 'var(--transition)'
                    }}
                  >
                    {isPrint ? <Printer size={11} style={{ color: 'var(--accent-primary)' }} /> : <Package size={11} style={{ color: 'var(--accent-secondary)' }} />}
                    <span>{inv.name}</span>
                    <span className="currency-num" style={{ color: 'var(--accent-secondary)' }}>₹{p.toFixed(0)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '10px' }}>
            <button
              type="button"
              className="mobile-btn mobile-btn-secondary"
              onClick={() => {
                setModalTab('product')
                setShowAddItemSheet(true)
              }}
              style={{ width: '100%', minHeight: '36px', fontSize: '0.78rem', justifyContent: 'center', borderStyle: 'dashed' }}
            >
              <Plus size={14} /> + Add Custom Retail / Stationery Item
            </button>
          </div>
        )}

        {/* Full Inventory Dropdown Selector (if inventory exists) */}
        {serverInventory.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', background: 'var(--bg-input)', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <select
              className="mobile-input"
              style={{ flex: 1, height: '38px', fontSize: '0.8rem', padding: '0 8px' }}
              value={quickInventoryId}
              onChange={(e) => setQuickInventoryId(e.target.value)}
            >
              {(serverInventory || []).map((i: any) => (
                <option key={i.id} value={i.id}>
                  {i.name} (₹{Number(i.price ?? i.unit_price ?? i.colorSingle ?? 10).toFixed(2)})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setQuickQty(Math.max(1, quickQty - 1))}
                style={{ width: '28px', height: '36px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Minus size={13} />
              </button>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, minWidth: '22px', textAlign: 'center' }}>
                {quickQty}
              </span>
              <button
                type="button"
                onClick={() => setQuickQty(quickQty + 1)}
                style={{ width: '28px', height: '36px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={13} />
              </button>
            </div>

            <button
              type="button"
              className="mobile-btn mobile-btn-primary"
              onClick={handleQuickAddItem}
              style={{ width: 'auto', minHeight: '38px', padding: '0 12px', fontSize: '0.78rem' }}
            >
              Add
            </button>
          </div>
        )}

        {/* Added Items List with Inline Rate & Qty Editing */}
        {itemRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
            <Layers size={28} style={{ color: 'var(--accent-primary)', opacity: 0.5, marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Bill is empty</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Tap a quick chip above or click "+ Custom Item / Specs"
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {itemRows.map((item, idx) => {
              const isPrint = item.itemType === 'print' || Boolean(item.printType && item.sides && item.printType !== 'none')
              const pagesCount = Number(item.pages || 1)

              return (
                <div
                  key={item.id || idx}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {/* Header: Type Icon + Name + Spec Badges + Remove */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, marginRight: '8px' }}>
                      {isPrint ? (
                        <Printer size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      ) : (
                        <Package size={15} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.itemName || item.name}
                      </span>
                      {isPrint && (
                        <>
                          <span className="mobile-badge mobile-badge-info" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                            {(item.printType || 'Color').toUpperCase()}
                          </span>
                          <span className="mobile-badge mobile-badge-warning" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                            {(item.sides || 'Single').toUpperCase()}
                          </span>
                          {pagesCount > 1 && (
                            <span className="mobile-badge mobile-badge-secondary" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                              {pagesCount} pgs
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      className="mobile-icon-btn"
                      onClick={() => handleRemoveItem(item.id as string)}
                      style={{ width: '26px', height: '26px', minWidth: '26px', minHeight: '26px', color: 'var(--error)', borderColor: 'var(--error-bg)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Bottom Row: Editable Rate + Stepper Qty + Total Amount */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    {/* Inline Editable Unit Price */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rate ₹</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="currency-num"
                        style={{
                          width: '58px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-secondary)',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          outline: 'none',
                          padding: '1px 0'
                        }}
                        value={item.unitPrice !== undefined ? item.unitPrice : (item.unit_price || 0)}
                        onChange={(e) => handleUpdateItemPrice(item.id as string, e.target.value)}
                      />
                    </div>

                    {/* Quantity Stepper & Input */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(item.id as string, -1)}
                        style={{ width: '26px', height: '28px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleSetItemQty(item.id as string, e.target.value)}
                        style={{
                          width: '30px',
                          height: '28px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          textAlign: 'center',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQty(item.id as string, 1)}
                        style={{ width: '26px', height: '28px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Line Total Amount */}
                    <div className="currency-num" style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--accent-primary)', minWidth: '60px', textAlign: 'right' }}>
                      ₹{Number(item.amount || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: DISCOUNTS, OFFERS & ROUND-OFF (COMPACT ACCORDION) */}
      <div className="mobile-card" style={{ marginBottom: '14px', padding: '12px' }}>
        <div
          onClick={() => setShowDiscountsSection(!showDiscountsSection)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Tag size={15} style={{ color: 'var(--accent-secondary)' }} />
            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              DISCOUNTS & ROUND-OFF
            </span>
            {(calculatedDiscount > 0 || advanceDeduction > 0 || roundOffAmount !== 0) && (
              <span className="mobile-badge mobile-badge-success" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                {calculatedDiscount > 0 ? `-₹${calculatedDiscount.toFixed(2)} Disc` : ''}
                {roundOffAmount !== 0 ? ` ${roundOffAmount > 0 ? `+₹${roundOffAmount.toFixed(2)}` : `-₹${Math.abs(roundOffAmount).toFixed(2)}`} Round` : ''}
              </span>
            )}
          </div>
          {showDiscountsSection ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>

        {showDiscountsSection && (
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Quick Discount Presets Chips */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Quick Discount Presets
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { label: '₹5 Off', type: 'flat' as const, val: 5 },
                  { label: '₹10 Off', type: 'flat' as const, val: 10 },
                  { label: '₹20 Off', type: 'flat' as const, val: 20 },
                  { label: '5% Off', type: 'percent' as const, val: 5 },
                  { label: '10% Off', type: 'percent' as const, val: 10 },
                  { label: '15% Off', type: 'percent' as const, val: 15 },
                ].map((preset, pIdx) => {
                  const isActive = discountType === preset.type && Number(discountValue) === preset.val
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => {
                        setDiscountType(preset.type)
                        setDiscountValue(preset.val)
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                        background: isActive ? 'rgba(255, 47, 176, 0.2)' : 'var(--bg-input)',
                        color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  )
                })}
                {Number(discountValue) > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiscountValue('')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      border: '1px solid var(--error-bg)',
                      background: 'rgba(255, 56, 96, 0.1)',
                      color: 'var(--error)',
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>

            {/* Manual Discount Inputs (Flat vs %) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '6px' }}>
              <select
                className="mobile-input"
                style={{ height: '36px', fontSize: '0.8rem' }}
                value={discountType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDiscountType(e.target.value as 'flat' | 'percent')}
              >
                <option value="flat">Flat Discount (₹)</option>
                <option value="percent">Percentage (%)</option>
              </select>
              <input
                type="number"
                step="any"
                min="0"
                className="mobile-input currency-num"
                style={{ height: '36px', fontSize: '0.84rem' }}
                placeholder="Enter discount value..."
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>

            {/* Promo Code Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Promo / Coupon Code
                </span>
                <button
                  type="button"
                  onClick={() => setShowBrowsePromos(true)}
                  style={{ background: 'none', border: 'none', color: '#06b6d4', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                >
                  <Tag size={12} /> Browse Coupons ({promoCodes.length})
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  className="mobile-input"
                  style={{ height: '36px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                  placeholder="Promo code (e.g. FESTIVE20)"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  className="mobile-btn mobile-btn-secondary"
                  onClick={() => handleApplyPromo()}
                  style={{ width: 'auto', minHeight: '36px', padding: '0 12px', fontSize: '0.76rem' }}
                >
                  Apply
                </button>
              </div>
            </div>

            {appliedPromo && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 240, 255, 0.1)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-secondary)' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--accent-secondary)', fontWeight: 700 }}>
                  ✓ Promo '{appliedPromo.code}' Applied ({appliedPromo.type === 'percent' ? `${appliedPromo.value}%` : `₹${appliedPromo.value}`})
                </span>
                <button
                  type="button"
                  onClick={() => setAppliedPromo(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Smart Round Off Selector (Exact, Up, Down, Nearest) */}
            <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Bill Round-Off Mode
                </span>
                {roundOffAmount !== 0 && (
                  <span className="currency-num" style={{ fontSize: '0.72rem', color: roundOffAmount > 0 ? 'var(--accent-secondary)' : 'var(--warning)', fontWeight: 800 }}>
                    {roundOffAmount > 0 ? `+₹${roundOffAmount.toFixed(2)}` : `-₹${Math.abs(roundOffAmount).toFixed(2)}`}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { id: 'nearest', label: '≈ Auto', val: Math.round(netBeforeRound) },
                  { id: 'up', label: '▲ Up', val: Math.ceil(netBeforeRound) },
                  { id: 'down', label: '▼ Down', val: Math.floor(netBeforeRound) },
                  { id: 'none', label: 'Exact', val: netBeforeRound }
                ].map(r => {
                  const isSel = roundOffMode === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoundOffMode(r.id as any)}
                      style={{
                        padding: '6px 4px',
                        borderRadius: 'var(--radius-sm)',
                        border: isSel ? '1px solid var(--accent-secondary)' : '1px solid var(--border)',
                        background: isSel ? 'rgba(0, 240, 255, 0.15)' : 'var(--bg-input)',
                        color: isSel ? 'var(--accent-secondary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'var(--transition)'
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', fontWeight: 800 }}>{r.label}</span>
                      <span className="currency-num" style={{ fontSize: '0.76rem', fontWeight: 900, color: isSel ? '#ffffff' : 'var(--text-secondary)' }}>
                        ₹{r.val.toFixed(2)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Advance Credit Usage */}
            {liveCustomerAdvance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 240, 255, 0.05)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-secondary)' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>Customer Advance Available</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>₹{liveCustomerAdvance.toFixed(2)}</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={useAdvanceCredit}
                    onChange={(e) => setUseAdvanceCredit(e.target.checked)}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--accent-secondary)' }}
                  />
                  <span>Use Advance</span>
                </label>
              </div>
            )}

            {/* Loyalty Engine */}
            {selectedCustomerObj && (
              <LoyaltyEnginePanel
                customer={selectedCustomerObj}
                subtotal={subtotal}
                settings={settings}
                shouldRedeem={shouldRedeemLoyalty}
                onToggleRedeem={setShouldRedeemLoyalty}
                pointsToRedeem={loyaltyPointsRedeemed}
                onPointsChange={setLoyaltyPointsRedeemed}
                loyaltyDiscount={loyaltyDiscount}
              />
            )}
          </div>
        )}
      </div>

      {/* SECTION 4: LIVE FINANCIAL BREAKDOWN SUMMARY */}
      <div className="mobile-card" style={{ marginBottom: '14px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          <span>Subtotal ({itemRows.reduce((sum, r) => sum + Number(r.qty || 1), 0)} items)</span>
          <span className="currency-num">₹{subtotal.toFixed(2)}</span>
        </div>

        {calculatedDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '4px' }}>
            <span>Total Discount</span>
            <span className="currency-num">-₹{calculatedDiscount.toFixed(2)}</span>
          </div>
        )}

        {advanceDeduction > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--accent-secondary)', marginBottom: '4px' }}>
            <span>⚡ Advance Used</span>
            <span className="currency-num" style={{ fontWeight: 800 }}>-₹{advanceDeduction.toFixed(2)}</span>
          </div>
        )}

        {roundOffAmount !== 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: roundOffAmount > 0 ? 'var(--accent-secondary)' : 'var(--warning)', marginBottom: '4px' }}>
            <span>Round Off Adjustment ({roundOffMode.toUpperCase()})</span>
            <span className="currency-num">
              {roundOffAmount > 0 ? `+₹${roundOffAmount.toFixed(2)}` : `-₹${Math.abs(roundOffAmount).toFixed(2)}`}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', paddingTop: '8px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
          <span>NET PAYABLE</span>
          <span className="currency-num" style={{ color: 'var(--accent-primary)', textShadow: '0 0 14px rgba(255, 47, 176, 0.5)' }}>
            ₹{grandTotal.toFixed(2)}
          </span>
        </div>

        {/* Live Customer Balance Indicator */}
        {selectedCustomerObj && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Advance Balance: <strong style={{ color: liveCustomerAdvance > 0 ? 'var(--accent-secondary)' : 'var(--text-secondary)' }}>₹{liveCustomerAdvance.toFixed(2)}</strong>
              {advanceDeduction > 0 && ` (₹${(liveCustomerAdvance - advanceDeduction).toFixed(2)} remaining)`}
            </span>
            {Number(selectedCustomerObj.balanceDue || selectedCustomerObj.balance_due || 0) > 0 && (
              <span style={{ color: 'var(--error)' }}>
                Total Due: <strong>₹{Number(selectedCustomerObj.balanceDue || selectedCustomerObj.balance_due).toFixed(2)}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* SECTION 5: STICKY POS PAYMENT & SUBMISSION BAR */}
      <div
        style={{
          position: 'sticky',
          bottom: 'calc(var(--bottom-nav-height) + 8px)',
          background: 'rgba(12, 6, 24, 0.95)',
          backdropFilter: 'blur(16px)',
          padding: '12px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.9)',
          zIndex: 30,
          marginBottom: '16px'
        }}
      >
        {/* Preset Quick Fill Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setPaymentMode('full_cash')
              setCashAmount(grandTotal)
              setUpiAmount(0)
            }}
            style={{
              minHeight: '32px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              fontWeight: 800,
              border: paymentMode === 'full_cash' ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: paymentMode === 'full_cash' ? 'rgba(255, 47, 176, 0.2)' : 'var(--bg-card)',
              color: paymentMode === 'full_cash' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            💵 Full Cash
          </button>
          <button
            type="button"
            onClick={() => {
              setPaymentMode('full_upi')
              setCashAmount(0)
              setUpiAmount(grandTotal)
            }}
            style={{
              minHeight: '32px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              fontWeight: 800,
              border: paymentMode === 'full_upi' ? '1px solid var(--accent-secondary)' : '1px solid var(--border)',
              background: paymentMode === 'full_upi' ? 'rgba(0, 240, 255, 0.2)' : 'var(--bg-card)',
              color: paymentMode === 'full_upi' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            📱 Full UPI
          </button>
          <button
            type="button"
            onClick={() => {
              setPaymentMode('split')
              const half = Number((grandTotal / 2).toFixed(2))
              setCashAmount(half)
              setUpiAmount(Number((grandTotal - half).toFixed(2)))
            }}
            style={{
              minHeight: '32px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              fontWeight: 800,
              border: paymentMode === 'split' ? '1px solid #a855f7' : '1px solid var(--border)',
              background: paymentMode === 'split' ? 'rgba(168, 85, 247, 0.2)' : 'var(--bg-card)',
              color: paymentMode === 'split' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            ⚡ 50/50 Split
          </button>
          <button
            type="button"
            onClick={() => {
              setPaymentMode('credit')
              setCashAmount(0)
              setUpiAmount(0)
            }}
            style={{
              minHeight: '32px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              fontWeight: 800,
              border: paymentMode === 'credit' ? '1px solid var(--warning)' : '1px solid var(--border)',
              background: paymentMode === 'credit' ? 'rgba(234, 179, 8, 0.2)' : 'var(--bg-card)',
              color: paymentMode === 'credit' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            📋 Credit (₹0)
          </button>
        </div>

        {/* Direct Cash & UPI Amount Input Fields */}
        <div style={{ marginBottom: '10px', background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>💵 CASH (₹)</span>
                <button
                  type="button"
                  onClick={() => {
                    const currentUpi = Number(upiAmount || 0)
                    const fill = Math.max(0, Number((grandTotal - currentUpi).toFixed(2)))
                    setCashAmount(fill)
                    setPaymentMode('split')
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}
                >
                  Auto-Fill
                </button>
              </div>
              <input
                type="number"
                step="any"
                min="0"
                className="mobile-input currency-num"
                style={{ height: '36px', fontSize: '0.85rem', fontWeight: 800 }}
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => {
                  setCashAmount(e.target.value)
                  setPaymentMode('split')
                }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>📱 UPI (₹)</span>
                <button
                  type="button"
                  onClick={() => {
                    const currentCash = Number(cashAmount || 0)
                    const fill = Math.max(0, Number((grandTotal - currentCash).toFixed(2)))
                    setUpiAmount(fill)
                    setPaymentMode('split')
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}
                >
                  Auto-Fill
                </button>
              </div>
              <input
                type="number"
                step="any"
                min="0"
                className="mobile-input currency-num"
                style={{ height: '36px', fontSize: '0.85rem', fontWeight: 800 }}
                placeholder="0.00"
                value={upiAmount}
                onChange={(e) => {
                  setUpiAmount(e.target.value)
                  setPaymentMode('split')
                }}
              />
            </div>
          </div>

          {/* Real-time Payment & Balance Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.08)', fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Paying Now: <strong style={{ color: 'var(--success)' }}>₹{(Number(cashAmount || (paymentMode === 'full_cash' ? grandTotal : 0)) + Number(upiAmount || (paymentMode === 'full_upi' ? grandTotal : 0))).toFixed(2)}</strong>
            </span>
            <span style={{ color: Math.max(0, Number((grandTotal - (Number(cashAmount || (paymentMode === 'full_cash' ? grandTotal : 0)) + Number(upiAmount || (paymentMode === 'full_upi' ? grandTotal : 0)))).toFixed(2))) > 0 ? 'var(--error)' : 'var(--success)' }}>
              Bill Due: <strong>₹{Math.max(0, Number((grandTotal - (Number(cashAmount || (paymentMode === 'full_cash' ? grandTotal : 0)) + Number(upiAmount || (paymentMode === 'full_upi' ? grandTotal : 0)))).toFixed(2))).toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* Primary Checkout Button */}
        <button
          type="button"
          className="mobile-btn mobile-btn-primary"
          onClick={handleFinalizeBillSubmit}
          disabled={isSubmitting || isCreatingBill || isUpdatingBill || itemRows.length === 0}
          style={{ minHeight: '46px', fontSize: '0.92rem', fontWeight: 900, letterSpacing: '0.03em' }}
        >
          {isSubmitting || isCreatingBill || isUpdatingBill ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <Loader2 size={18} className="spin" /> GENERATING INVOICE...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <span>{editBillId ? 'UPDATE INVOICE' : '⚡ COMPLETE & GENERATE BILL'}</span>
              <span className="currency-num" style={{ background: 'rgba(0,0,0,0.25)', padding: '2px 8px', borderRadius: '6px' }}>
                ₹{grandTotal.toFixed(2)}
              </span>
            </span>
          )}
        </button>
      </div>

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="bottom-sheet-overlay" onClick={() => setShowAddCustomerModal(false)}>
          <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-drag-handle" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
              Register New Client
            </h3>
            <form onSubmit={handleAddNewCustomerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                className="mobile-input"
                placeholder="Full Customer Name *"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                required
                autoFocus
              />
              <input
                type="tel"
                className="mobile-input"
                placeholder="Phone Number (e.g. 9876543210)"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
              />
              <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isCreatingCustomer}>
                {isCreatingCustomer ? 'Registering...' : 'Save & Select Client'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Advanced Print & Custom Product Bottom Sheet Drawer */}
      <BottomSheet
        isOpen={showAddItemSheet}
        onClose={() => setShowAddItemSheet(false)}
        title="Add Item to Bill"
      >
        <form onSubmit={handleAddModalItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Segment Selector: General Product vs Print Specs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            <button
              type="button"
              className={`mobile-btn ${modalTab === 'product' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
              onClick={() => setModalTab('product')}
              style={{ minHeight: '38px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Package size={15} /> Product / Stationery
            </button>
            <button
              type="button"
              className={`mobile-btn ${modalTab === 'print' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
              onClick={() => setModalTab('print')}
              style={{ minHeight: '38px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Printer size={15} /> Print Specifications
            </button>
          </div>

          {/* TAB 1: GENERAL PRODUCT / STATIONERY (Book, Pen, Notebook, etc.) */}
          {modalTab === 'product' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  ITEM / PRODUCT NAME *
                </label>
                <input
                  type="text"
                  className="mobile-input"
                  placeholder="e.g. Spiral Notebook, Ball Pen, Stamp, Binding"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    QTY *
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="mobile-input currency-num"
                    value={productQty}
                    onChange={(e) => setProductQty(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    UNIT PRICE (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="mobile-input currency-num"
                    placeholder="0.00"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    GST %
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="mobile-input currency-num"
                    placeholder="0%"
                    value={productGstRate}
                    onChange={(e) => setProductGstRate(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Item Line Total:</span>
                <span className="currency-num" style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--accent-secondary)' }}>
                  ₹{(Math.max(0, Number(productPrice) || 0) * Math.max(1, Number(productQty) || 1)).toFixed(2)}
                </span>
              </div>

              <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '6px' }}>
                <Plus size={16} /> Add Product to Cart
              </button>
            </div>
          )}

          {/* TAB 2: CUSTOM PRINT SPECS */}
          {modalTab === 'print' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Paper source toggle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className={`mobile-btn ${!isCustomPrint ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                  onClick={() => setIsCustomPrint(false)}
                  style={{ minHeight: '34px', fontSize: '0.78rem' }}
                >
                  From Paper Inventory
                </button>
                <button
                  type="button"
                  className={`mobile-btn ${isCustomPrint ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                  onClick={() => setIsCustomPrint(true)}
                  style={{ minHeight: '34px', fontSize: '0.78rem' }}
                >
                  Custom Print Title
                </button>
              </div>

              {!isCustomPrint ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    SELECT PAPER / MATERIAL
                  </label>
                  <select
                    className="mobile-input"
                    value={selectedInventoryId}
                    onChange={(e) => setSelectedInventoryId(e.target.value)}
                  >
                    {(serverInventory || []).map((i: any) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    CUSTOM PRINT TITLE *
                  </label>
                  <input
                    type="text"
                    className="mobile-input"
                    placeholder="e.g. Vinyl Banner 3x2, Thesis Binding"
                    value={customPrintName}
                    onChange={(e) => setCustomPrintName(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Color vs B&W */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  PRINT COLOR
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className={`mobile-btn ${itemPrintType === 'color' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                    onClick={() => setItemPrintType('color')}
                    style={{ minHeight: '36px', fontSize: '0.78rem' }}
                  >
                    Full Color
                  </button>
                  <button
                    type="button"
                    className={`mobile-btn ${itemPrintType === 'bw' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                    onClick={() => setItemPrintType('bw')}
                    style={{ minHeight: '36px', fontSize: '0.78rem' }}
                  >
                    Black & White
                  </button>
                </div>
              </div>

              {/* Single vs Double Sided */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  SIDES CONFIGURATION
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className={`mobile-btn ${itemSides === 'single' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                    onClick={() => setItemSides('single')}
                    style={{ minHeight: '36px', fontSize: '0.78rem' }}
                  >
                    Single-Sided
                  </button>
                  <button
                    type="button"
                    className={`mobile-btn ${itemSides === 'double' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                    onClick={() => setItemSides('double')}
                    style={{ minHeight: '36px', fontSize: '0.78rem' }}
                  >
                    Double-Sided
                  </button>
                </div>
              </div>

              {/* Copies, Pages, Unit Price & GST */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    COPIES
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="mobile-input currency-num"
                    value={itemQty}
                    onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    PAGES
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="mobile-input currency-num"
                    value={itemPages}
                    onChange={(e) => setItemPages(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    RATE (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="mobile-input currency-num"
                    placeholder={calculatedUnitPrice.toFixed(2)}
                    value={itemUnitPrice}
                    onChange={(e) => setItemUnitPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    GST %
                  </label>
                  <input
                    type="number"
                    className="mobile-input currency-num"
                    placeholder="0%"
                    value={itemGstRate}
                    onChange={(e) => setItemGstRate(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Print Line Total:</span>
                <span className="currency-num" style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--accent-primary)' }}>
                  ₹{(Number(itemUnitPrice || calculatedUnitPrice) * Math.max(1, Number(itemQty) || 1) * Math.max(1, Number(itemPages) || 1)).toFixed(2)}
                </span>
              </div>

              <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '6px' }}>
                <Plus size={16} /> Add Print Job to Cart
              </button>
            </div>
          )}
        </form>
      </BottomSheet>

      {showBrowsePromos && (
        <BottomSheet
          isOpen={showBrowsePromos}
          onClose={() => setShowBrowsePromos(false)}
          title="Available Coupons & Promos"
        >
          <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {promoCodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <Tag size={28} style={{ opacity: 0.5, margin: '0 auto 8px auto', display: 'block', color: '#06b6d4' }} />
                No active promo coupons found.<br />
                You can create coupons in <strong>Settings → Coupons</strong>.
              </div>
            ) : (
              promoCodes.map((p: any) => {
                const todayStr = new Date().toISOString().slice(0, 10)
                const startDate = p.startDate || p.start_date
                const endDate = p.endDate || p.end_date
                const isExpired = endDate ? todayStr > endDate : false
                const isFuture = startDate ? todayStr < startDate : false
                const isOff = p.enabled === false
                const minSpend = Number(p.minAmount || p.min_amount || p.minOrderAmount || p.min_order_amount || 0)
                const isMinSpendUnmet = minSpend > 0 && subtotal < minSpend

                const isApplied = appliedPromo?.id === p.id || appliedPromo?.code?.toUpperCase() === p.code?.toUpperCase()
                const canApply = !isOff && !isExpired && !isFuture && !isMinSpendUnmet

                return (
                  <div
                    key={p.id || p.code}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      background: isApplied ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: isApplied ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.92rem', color: '#06b6d4', letterSpacing: '0.5px' }}>
                          {p.code}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                          {p.type === 'percent' ? `${p.value}% OFF` : `₹${p.value} OFF`}
                        </span>
                      </div>

                      {isApplied ? (
                        <button
                          type="button"
                          onClick={() => setAppliedPromo(null)}
                          className="mobile-btn mobile-btn-secondary"
                          style={{ width: 'auto', minHeight: '28px', padding: '2px 10px', fontSize: '0.72rem', color: 'var(--error)' }}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canApply}
                          onClick={() => handleApplyPromo(p)}
                          className="mobile-btn mobile-btn-primary"
                          style={{
                            width: 'auto',
                            minHeight: '28px',
                            padding: '2px 12px',
                            fontSize: '0.74rem',
                            background: canApply ? '#06b6d4' : 'rgba(255,255,255,0.1)',
                            opacity: canApply ? 1 : 0.5
                          }}
                        >
                          Apply
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {minSpend > 0 && (
                        <span style={{ color: isMinSpendUnmet ? 'var(--warning)' : 'inherit', fontWeight: isMinSpendUnmet ? 700 : 'normal' }}>
                          Min Order: ₹{minSpend} {isMinSpendUnmet ? `(Need ₹${(minSpend - subtotal).toFixed(2)} more)` : '✓'}
                        </span>
                      )}
                      {(p.maxDiscount || p.max_discount) && (
                        <span>• Max Disc: ₹{p.maxDiscount || p.max_discount}</span>
                      )}
                      {(startDate || endDate) && (
                        <span>• Valid: {startDate || 'Start'} to {endDate || 'No Expiry'}</span>
                      )}
                    </div>

                    {isExpired && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--error)', fontWeight: 700 }}>
                        ⚠️ Expired on {endDate}
                      </span>
                    )}
                    {isFuture && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--warning)', fontWeight: 700 }}>
                        ⏳ Starts on {startDate}
                      </span>
                    )}
                    {isOff && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        🚫 Currently Disabled
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </BottomSheet>
      )}
    </MobileLayout>
  )
}
