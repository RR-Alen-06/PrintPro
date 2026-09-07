import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import { useInventory, usePaymentMutations } from '../../hooks/useEntitiesQuery'
import { useGroupBills, useGroupBillMutations } from '../../hooks/useGroupBillsQuery'
import { LoyaltyService } from '../../services/loyaltyService'
import { SequenceService } from '../../services/sequenceService'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  Users, Layers, Plus, Trash2, ChevronRight, User, Loader2, CheckCircle,
  AlertCircle, Tag, Percent, Wallet, DollarSign, Gift, Sparkles, PlusCircle,
  FileText, Calendar, RotateCcw, ArrowLeftRight, Check, X
} from 'lucide-react'
import '../../styles/mobile.css'

const getItemBasePrice = (inventory, itemId, printType, sides) => {
  const item = (inventory || []).find((e) => String(e.id) === String(itemId))
  if (!item) return 0
  if (item.type === 'product' || item.itemType === 'product') return item.sellingPrice || item.colorSingle || 0
  if (printType === 'color' && sides === 'single') return item.colorSingle || 0
  if (printType === 'color' && sides === 'double') return item.colorDouble || 0
  if (printType === 'bw' && sides === 'single') return item.bwSingle || 0
  if (printType === 'bw' && sides === 'double') return item.bwDouble || 0
  return 0
}

export default function MobileGroupBilling() {
  const navigate = useNavigate()
  const { showToast, settings, promoCodes } = useAppContext()

  // Queries & Mutations
  const { data: serverBills = [], isLoading: isLoadingBills } = useBills()
  const { data: serverCustomers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: serverInventory = [], isLoading: isLoadingInventory } = useInventory()
  const { groupBills = [], isLoading: isLoadingGroupBills } = useGroupBills()
  const { createBill: createBillMutation, isCreatingBill } = useBillMutations()
  const { createCustomer: createCustomerMutation, isCreating: isCreatingCustomer } = useCustomerMutations()
  const { createGroupBill: serverCreateGroupBill } = useGroupBillMutations()

  // Top Tab State: 'create' | 'masters'
  const [activeTab, setActiveTab] = useState('create')

  // Group Mode: 'shared' | 'split'
  const [groupMode, setGroupMode] = useState('shared')

  // Common Header State
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => {
    const next = new Date()
    next.setDate(next.getDate() + 7)
    return next.toISOString().slice(0, 10)
  })
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Shared Items List State ──────────────────────────────────────────────────
  const [sharedItems, setSharedItems] = useState([])
  const [showItemSheet, setShowItemSheet] = useState(false)
  const [itemSheetTarget, setItemSheetTarget] = useState('shared') // 'shared' | memberId for addons

  // Add Item Sheet Input State
  const [itemTypeTab, setItemTypeTab] = useState('inventory') // 'inventory' | 'custom'
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [customItemName, setCustomItemName] = useState('')
  const [printType, setPrintType] = useState('color')
  const [sides, setSides] = useState('single')
  const [itemQty, setItemQty] = useState(1)
  const [itemUnitPrice, setItemUnitPrice] = useState(10)
  const [itemGstRate, setItemGstRate] = useState(0)

  // ── Members State ────────────────────────────────────────────────────────────
  const [members, setMembers] = useState([
    {
      id: `m-${Date.now()}-1`,
      customerId: '',
      hasAddons: false,
      addonItems: [],
      discountType: 'flat',
      discountValue: 0,
      usePromoCode: false,
      promoCodeInput: '',
      appliedPromo: null,
      promoError: '',
      shouldRedeemLoyalty: false,
      loyaltyPointsRedeemed: '',
      useAdvance: false,
      cashPaid: '',
      upiPaid: '',
    },
    {
      id: `m-${Date.now()}-2`,
      customerId: '',
      hasAddons: false,
      addonItems: [],
      discountType: 'flat',
      discountValue: 0,
      usePromoCode: false,
      promoCodeInput: '',
      appliedPromo: null,
      promoError: '',
      shouldRedeemLoyalty: false,
      loyaltyPointsRedeemed: '',
      useAdvance: false,
      cashPaid: '',
      upiPaid: '',
    }
  ])

  // Split Mode State
  const [roundingMode, setRoundingMode] = useState('up') // 'up' | 'down'

  // Inline Quick Add Customer State
  const [showNewCustModal, setShowNewCustModal] = useState(false)
  const [newCustMemberId, setNewCustMemberId] = useState(null)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')

  // ── Consolidation Tab State ──────────────────────────────────────────────────
  const [selectedConsolidateCustomerId, setSelectedConsolidateCustomerId] = useState('')
  const [selectedBillIds, setSelectedBillIds] = useState([])
  const [showConsolidateModal, setShowConsolidateModal] = useState(false)

  // Auto-fill initial inventory item when inventory loads
  useEffect(() => {
    if (serverInventory.length > 0 && !selectedInventoryId) {
      const first = serverInventory[0]
      setSelectedInventoryId(first.id)
      setItemUnitPrice(getItemBasePrice(serverInventory, first.id, 'color', 'single'))
    }
  }, [serverInventory, selectedInventoryId])

  // Recalculate unit price when inventory/printType/sides change in sheet
  useEffect(() => {
    if (selectedInventoryId && serverInventory.length > 0) {
      const price = getItemBasePrice(serverInventory, selectedInventoryId, printType, sides)
      setItemUnitPrice(price)
    }
  }, [selectedInventoryId, printType, sides, serverInventory])

  // ── Member Update Helpers ────────────────────────────────────────────────────
  const updateMember = useCallback((memberId, changes) => {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...changes } : m)))
  }, [])

  const addMember = useCallback(() => {
    const newMember = {
      id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customerId: '',
      hasAddons: false,
      addonItems: [],
      discountType: 'flat',
      discountValue: 0,
      usePromoCode: false,
      promoCodeInput: '',
      appliedPromo: null,
      promoError: '',
      shouldRedeemLoyalty: false,
      loyaltyPointsRedeemed: '',
      useAdvance: false,
      cashPaid: '',
      upiPaid: '',
    }
    setMembers((prev) => [...prev, newMember])
  }, [])

  const removeMember = useCallback((memberId) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }, [])

  // ── Shared Subtotals & Computations ──────────────────────────────────────────
  const sharedSubtotal = useMemo(() => {
    return sharedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  }, [sharedItems])

  const sharedGstTotal = useMemo(() => {
    return sharedItems.reduce(
      (sum, item) => sum + Number(item.amount || 0) * (Number(item.gstRate || 0) / 100),
      0
    )
  }, [sharedItems])

  // Split Calculations
  const memberCount = Math.max(1, members.length)
  const rawSplitSubtotal = sharedSubtotal / memberCount
  const rawSplitGst = sharedGstTotal / memberCount
  const rawSplitAmount = (sharedSubtotal + sharedGstTotal) / memberCount
  const splitAmount = roundingMode === 'up' ? Math.ceil(rawSplitAmount) : Math.floor(rawSplitAmount)
  const ownerDiff = sharedSubtotal + sharedGstTotal - splitAmount * memberCount

  // Member-by-Member Financial Breakdown
  const memberTotals = useMemo(() => {
    return members.map((m) => {
      const cust = serverCustomers.find((c) => String(c.id) === String(m.customerId))
      const isRegular = (cust?.type || 'regular') === 'regular'
      const custAdvance = Number(cust?.advanceBalance || cust?.credit_balance || 0)
      const custPoints = Number(cust?.loyaltyPoints || cust?.loyalty_points || 0)

      let baseSubtotal = 0
      let baseGst = 0

      if (groupMode === 'shared') {
        const addonSub = m.hasAddons ? (m.addonItems || []).reduce((s, r) => s + Number(r.amount || 0), 0) : 0
        const addonGst = m.hasAddons
          ? (m.addonItems || []).reduce((s, r) => s + Number(r.amount || 0) * (Number(r.gstRate || 0) / 100), 0)
          : 0
        baseSubtotal = sharedSubtotal + addonSub
        baseGst = sharedGstTotal + addonGst
      } else {
        baseSubtotal = splitAmount - rawSplitGst
        baseGst = rawSplitGst
      }

      // Manual Discount
      const manualDiscount =
        m.discountType === 'percent'
          ? (baseSubtotal * Number(m.discountValue || 0)) / 100
          : Number(m.discountValue || 0)

      // Promo Discount
      let promoDiscount = 0
      if (m.appliedPromo) {
        promoDiscount =
          m.appliedPromo.type === 'percent'
            ? (baseSubtotal * Number(m.appliedPromo.value || 0)) / 100
            : Number(m.appliedPromo.value || 0)
      }

      // Loyalty Discount
      let loyaltyDiscount = 0
      if (m.shouldRedeemLoyalty && custPoints > 0) {
        const currentBillWithoutLoyalty = Math.max(0, baseSubtotal + baseGst - manualDiscount - promoDiscount)
        const redeemResult = LoyaltyService.calculateRedemptionDiscount(
          Number(m.loyaltyPointsRedeemed || 0),
          custPoints,
          currentBillWithoutLoyalty,
          settings
        )
        loyaltyDiscount = redeemResult.discountAmount
      }

      const totalDiscounts = manualDiscount + promoDiscount + loyaltyDiscount
      const grossTotal = Math.max(0, baseSubtotal + baseGst - totalDiscounts)

      // Advance deduction
      const advanceDeducted = m.useAdvance ? Math.min(custAdvance, grossTotal) : 0
      const netTotalDue = Math.max(0, grossTotal - advanceDeducted)

      // Payment Breakdown
      const cashPaid = Number(m.cashPaid || 0)
      const upiPaid = Number(m.upiPaid || 0)
      const totalPaid = cashPaid + upiPaid
      const balanceToPay = Math.max(0, netTotalDue - totalPaid)

      return {
        customer: cust,
        subtotal: baseSubtotal,
        gstAmount: baseGst,
        manualDiscount,
        promoDiscount,
        loyaltyDiscount,
        totalDiscounts,
        grossTotal,
        advanceDeducted,
        netTotalDue,
        cashPaid,
        upiPaid,
        totalPaid,
        balanceToPay,
        isPaid: balanceToPay <= 0 && grossTotal > 0,
      }
    })
  }, [members, groupMode, sharedSubtotal, sharedGstTotal, splitAmount, rawSplitGst, serverCustomers, settings])

  // Overall Group Totals
  const overallTotals = useMemo(() => {
    return memberTotals.reduce(
      (acc, curr) => {
        acc.subtotal += curr.subtotal
        acc.gst += curr.gstAmount
        acc.discounts += curr.totalDiscounts
        acc.grossTotal += curr.grossTotal
        acc.advanceDeducted += curr.advanceDeducted
        acc.totalPaid += curr.totalPaid
        acc.balanceToPay += curr.balanceToPay
        return acc
      },
      { subtotal: 0, gst: 0, discounts: 0, grossTotal: 0, advanceDeducted: 0, totalPaid: 0, balanceToPay: 0 }
    )
  }, [memberTotals])

  // ── Add Item Sheet Handlers ──────────────────────────────────────────────────
  const openAddItemSheet = (target = 'shared') => {
    setItemSheetTarget(target)
    setItemQty(1)
    if (serverInventory.length > 0) {
      const first = serverInventory[0]
      setSelectedInventoryId(first.id)
      setPrintType('color')
      setSides('single')
      setItemUnitPrice(getItemBasePrice(serverInventory, first.id, 'color', 'single'))
    }
    setCustomItemName('')
    setItemGstRate(0)
    setShowItemSheet(true)
  }

  const handleSaveItem = () => {
    const isCustom = itemTypeTab === 'custom'
    let name = ''
    if (isCustom) {
      name = customItemName.trim()
      if (!name) {
        showToast('Please enter a custom item description', 'error')
        return
      }
    } else {
      const inv = serverInventory.find((i) => String(i.id) === String(selectedInventoryId))
      name = inv?.name || 'Print Item'
    }

    const qtyNum = Math.max(1, Number(itemQty || 1))
    const priceNum = Math.max(0, Number(itemUnitPrice || 0))
    const amountNum = qtyNum * priceNum

    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      itemId: isCustom ? '' : selectedInventoryId,
      itemName: name,
      name: name,
      isCustom,
      printType: isCustom ? 'custom' : printType,
      sides: isCustom ? 'single' : sides,
      qty: qtyNum,
      unitPrice: priceNum,
      amount: amountNum,
      gstRate: Number(itemGstRate || 0),
    }

    if (itemSheetTarget === 'shared') {
      setSharedItems((prev) => [...prev, newItem])
    } else {
      // Addon for specific member
      updateMember(itemSheetTarget, {
        addonItems: [...(members.find((m) => m.id === itemSheetTarget)?.addonItems || []), newItem],
      })
    }

    setShowItemSheet(false)
    showToast(`Added "${name}"`, 'success')
  }

  // ── Quick Add Customer Modal Handler ─────────────────────────────────────────
  const handleQuickAddCustomer = async () => {
    if (!newCustName.trim()) {
      showToast('Please enter customer name', 'error')
      return
    }

    try {
      const created = await createCustomerMutation({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || '',
        type: 'regular',
        credit_balance: 0,
        credit_limit: 0,
      })

      if (created?.id && newCustMemberId) {
        updateMember(newCustMemberId, { customerId: created.id })
      }

      showToast(`Customer "${newCustName.trim()}" created!`, 'success')
      setNewCustName('')
      setNewCustPhone('')
      setShowNewCustModal(false)
    } catch (err) {
      showToast(err.message || 'Failed to create customer', 'error')
    }
  }

  // ── Promo Code Apply Handler ─────────────────────────────────────────────────
  const handleApplyPromo = (memberId) => {
    const member = members.find((m) => m.id === memberId)
    if (!member) return

    const code = (member.promoCodeInput || '').trim().toUpperCase()
    if (!code) return

    const promo = (promoCodes || []).find((p) => p.code === code)
    if (!promo) {
      updateMember(memberId, { promoError: 'Invalid promo code' })
      return
    }
    if (promo.enabled === false) {
      updateMember(memberId, { promoError: 'This coupon is disabled.' })
      return
    }

    const billDate = date || new Date().toISOString().slice(0, 10)
    if (promo.startDate && billDate < promo.startDate) {
      updateMember(memberId, { promoError: `Valid only from ${promo.startDate}` })
      return
    }
    if (promo.endDate && billDate > promo.endDate) {
      updateMember(memberId, { promoError: `Expired on ${promo.endDate}` })
      return
    }

    const mTotal = memberTotals.find((_, i) => members[i]?.id === memberId)
    if ((mTotal?.subtotal || 0) < Number(promo.minAmount || 0)) {
      updateMember(memberId, { promoError: `Min order ₹${promo.minAmount} required` })
      return
    }

    updateMember(memberId, { appliedPromo: promo, promoError: '', promoCodeInput: '' })
    showToast(`Promo "${promo.code}" applied!`, 'success')
  }

  // ── Group Submit Handler ─────────────────────────────────────────────────────
  const handleCreateGroupBill = async (e) => {
    e?.preventDefault()

    if (members.some((m) => !m.customerId)) {
      showToast('Please select a customer for every member', 'error')
      return
    }

    const selectedCustIds = members.map((m) => m.customerId)
    if (new Set(selectedCustIds).size !== selectedCustIds.length) {
      showToast('Each group member must be a distinct customer', 'error')
      return
    }

    if (sharedItems.length === 0) {
      showToast('Please add at least one shared item to the group', 'error')
      return
    }

    setIsSubmitting(true)

    try {
      const createdChildBillIds = []

      // Create individual child bill for each member
      for (let i = 0; i < members.length; i++) {
        const m = members[i]
        const mTotal = memberTotals[i]
        const cust = mTotal.customer

        const memberItems = [
          ...sharedItems.map((r) => ({
            itemId: r.itemId,
            itemName: r.itemName,
            printType: r.printType,
            sides: r.sides,
            qty: Number(r.qty),
            unitPrice: Number(r.unitPrice),
            amount: Number(r.amount),
            gstRate: Number(r.gstRate || 0),
          })),
          ...(m.hasAddons && m.addonItems
            ? m.addonItems.map((r) => ({
                itemId: r.itemId,
                itemName: r.itemName,
                printType: r.printType,
                sides: r.sides,
                qty: Number(r.qty),
                unitPrice: Number(r.unitPrice),
                amount: Number(r.amount),
                isAddon: true,
                gstRate: Number(r.gstRate || 0),
              }))
            : []),
        ]

        const nextInvNum = await SequenceService.getNextSequence('BILL')
        const childBillPayload = {
          invoice_number: nextInvNum,
          invoiceNumber: nextInvNum,
          customerId: m.customerId,
          customer_id: m.customerId,
          customerName: cust?.name || 'Group Member',
          customer_name: cust?.name || 'Group Member',
          customerPhone: cust?.phone || '',
          date,
          dueDate,
          due_date: dueDate,
          items: memberItems,
          subtotal: mTotal.subtotal,
          gstAmount: mTotal.gstAmount,
          gst_amount: mTotal.gstAmount,
          discountType: m.discountType,
          discountValue: m.discountValue,
          discountAmount: mTotal.manualDiscount,
          promoCode: m.appliedPromo?.code || null,
          promoDiscount: mTotal.promoDiscount,
          loyaltyDiscount: mTotal.loyaltyDiscount,
          loyaltyPointsRedeemed: Number(m.loyaltyPointsRedeemed || 0),
          advanceDeducted: mTotal.advanceDeducted,
          advance_deducted: mTotal.advanceDeducted,
          total: mTotal.grossTotal,
          amountPaid: mTotal.totalPaid,
          amount_paid: mTotal.totalPaid,
          balance: mTotal.balanceToPay,
          status: mTotal.balanceToPay <= 0 ? 'paid' : mTotal.totalPaid > 0 ? 'partial' : 'unpaid',
          notes: notes ? `${notes} (Group Bill Member ${i + 1})` : `Group Bill Member ${i + 1}`,
          paymentMethod: {
            cash: mTotal.cashPaid,
            upi: mTotal.upiPaid,
          },
        }

        const createdChild = await createBillMutation(childBillPayload)
        const childId = createdChild?.id || createdChild?.invoice_number || createdChild?.bill_number
        if (childId) createdChildBillIds.push(childId)
      }

      // Create Group Master Record
      await serverCreateGroupBill({
        type: groupMode,
        members: members.map((m, idx) => ({
          customerId: m.customerId,
          total: memberTotals[idx]?.grossTotal,
          paid: memberTotals[idx]?.totalPaid,
          balance: memberTotals[idx]?.balanceToPay,
          role: groupMode,
        })),
        date,
        due_date: dueDate,
        notes,
        member_bill_ids: createdChildBillIds,
        memberBillIds: createdChildBillIds,
      })

      showToast(`Group bill with ${members.length} members created successfully!`, 'success')

      // Reset form
      setSharedItems([])
      setNotes('')
      setActiveTab('masters')
    } catch (err) {
      showToast(err.message || 'Failed to create group bills', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Consolidation Flow Handlers ──────────────────────────────────────────────
  const unpaidCustomerBills = useMemo(() => {
    return (serverBills || []).filter(
      (b) =>
        !b.deleted &&
        !b.isGroupParent &&
        String(b.customerId || b.customer_id) === String(selectedConsolidateCustomerId) &&
        Number(b.balance || 0) > 0
    )
  }, [serverBills, selectedConsolidateCustomerId])

  const toggleSelectBill = (id) => {
    if (selectedBillIds.includes(id)) {
      setSelectedBillIds(selectedBillIds.filter((i) => i !== id))
    } else {
      setSelectedBillIds([...selectedBillIds, id])
    }
  }

  const handleConsolidateExistingBills = async () => {
    if (selectedBillIds.length < 2) {
      showToast('Select at least 2 unpaid bills to consolidate', 'error')
      return
    }

    try {
      const selectedObjList = serverBills.filter((b) => selectedBillIds.includes(b.id))
      const totalGroupAmount = selectedObjList.reduce((s, b) => s + Number(b.total || 0), 0)
      const totalGroupBalance = selectedObjList.reduce((s, b) => s + Number(b.balance || 0), 0)
      const cust = serverCustomers.find((c) => String(c.id) === String(selectedConsolidateCustomerId))

      const groupInvoiceNumber = await SequenceService.getNextSequence('BILL')
      const groupPayload = {
        invoice_number: groupInvoiceNumber,
        invoiceNumber: groupInvoiceNumber,
        is_group_parent: true,
        isGroupParent: true,
        child_bill_ids: selectedBillIds,
        childBillIds: selectedBillIds,
        customer_id: selectedConsolidateCustomerId,
        customerId: selectedConsolidateCustomerId,
        customer_name: cust?.name || 'Client',
        customerName: cust?.name || 'Client',
        date: new Date().toISOString().slice(0, 10),
        total: totalGroupAmount,
        balance: totalGroupBalance,
        status: totalGroupBalance <= 0 ? 'paid' : 'unpaid',
        notes: `Consolidated Master for ${selectedBillIds.length} bills`,
      }

      await createBillMutation(groupPayload)
      showToast(`Group Master created for ${selectedBillIds.length} bills!`, 'success')
      setSelectedBillIds([])
      setShowConsolidateModal(false)
    } catch (e) {
      showToast(e.message || 'Failed to consolidate bills', 'error')
    }
  }

  const groupMasterBills = useMemo(() => {
    return (serverBills || []).filter((b) => (b.isGroupParent || b.is_group_parent) && !b.deleted)
  }, [serverBills])

  return (
    <MobileLayout title="Group Billing Terminal">
      {/* Top Navigation Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '16px',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '4px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
        }}
      >
        <button
          className="mobile-btn"
          onClick={() => setActiveTab('create')}
          style={{
            minHeight: '38px',
            fontSize: '0.82rem',
            background: activeTab === 'create' ? 'var(--gradient-primary)' : 'transparent',
            color: activeTab === 'create' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'create' ? 'var(--shadow-glow-cyan)' : 'none',
          }}
        >
          <PlusCircle size={15} /> Create Group Bill
        </button>
        <button
          className="mobile-btn"
          onClick={() => setActiveTab('masters')}
          style={{
            minHeight: '38px',
            fontSize: '0.82rem',
            background: activeTab === 'masters' ? 'var(--gradient-primary)' : 'transparent',
            color: activeTab === 'masters' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'masters' ? 'var(--shadow-glow-cyan)' : 'none',
          }}
        >
          <Layers size={15} /> Group Masters ({groupMasterBills.length})
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: CREATE GROUP BILL                                                   */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateGroupBill} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Group Mode Selector Card */}
          <div className="mobile-card">
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-secondary)', letterSpacing: '0.05em' }}>
              GROUP BILLING MODE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="mobile-btn"
                onClick={() => setGroupMode('shared')}
                style={{
                  minHeight: '40px',
                  fontSize: '0.82rem',
                  background: groupMode === 'shared' ? 'rgba(0, 240, 255, 0.15)' : 'var(--bg-input)',
                  borderColor: groupMode === 'shared' ? 'var(--accent-secondary)' : 'var(--border)',
                  color: groupMode === 'shared' ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                }}
              >
                <Layers size={15} /> Shared Items
              </button>
              <button
                type="button"
                className="mobile-btn"
                onClick={() => setGroupMode('split')}
                style={{
                  minHeight: '40px',
                  fontSize: '0.82rem',
                  background: groupMode === 'split' ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-input)',
                  borderColor: groupMode === 'split' ? 'var(--accent-primary)' : 'var(--border)',
                  color: groupMode === 'split' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                <ArrowLeftRight size={15} /> Split Equally
              </button>
            </div>

            {/* Split Mode Rounding Controls */}
            {groupMode === 'split' && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px',
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Split Amount / Person</div>
                  <div className="currency-num" style={{ fontSize: '1.15rem', color: 'var(--accent-primary)', fontWeight: 800 }}>
                    ₹{splitAmount.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: ownerDiff >= 0 ? 'var(--success)' : 'var(--warning)' }}>
                    ₹{Math.abs(ownerDiff).toFixed(2)} {ownerDiff >= 0 ? 'surplus' : 'absorbed by shop'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className="mobile-btn"
                    onClick={() => setRoundingMode('up')}
                    style={{
                      minHeight: '32px',
                      padding: '0 8px',
                      fontSize: '0.72rem',
                      background: roundingMode === 'up' ? 'var(--accent-primary)' : 'transparent',
                      color: roundingMode === 'up' ? '#000' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Round Up
                  </button>
                  <button
                    type="button"
                    className="mobile-btn"
                    onClick={() => setRoundingMode('down')}
                    style={{
                      minHeight: '32px',
                      padding: '0 8px',
                      fontSize: '0.72rem',
                      background: roundingMode === 'down' ? 'var(--accent-primary)' : 'transparent',
                      color: roundingMode === 'down' ? '#000' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Round Down
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Shared Items Section Card */}
          <div className="mobile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                  {groupMode === 'shared' ? 'SHARED GROUP ITEMS' : 'ITEMS TO SPLIT'}
                </span>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                  Items ({sharedItems.length})
                </h3>
              </div>
              <button
                type="button"
                className="mobile-btn mobile-btn-secondary"
                onClick={() => openAddItemSheet('shared')}
                style={{ width: 'auto', minHeight: '34px', padding: '0 12px', fontSize: '0.75rem' }}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            {/* Items List */}
            {sharedItems.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                }}
              >
                No items added yet. Tap "+ Add Item" to specify shared prints or products.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sharedItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.itemName}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '2px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>Qty: {item.qty} × ₹{item.unitPrice.toFixed(2)}</span>
                        {!item.isCustom && <span>• {item.printType?.toUpperCase()} ({item.sides})</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="currency-num" style={{ fontSize: '0.95rem', color: '#ffffff', fontWeight: 800 }}>
                        ₹{Number(item.amount || 0).toFixed(2)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSharedItems((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Subtotal Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed var(--border)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Shared Items Subtotal:</span>
                  <span className="currency-num" style={{ color: 'var(--accent-secondary)', fontWeight: 800 }}>
                    ₹{sharedSubtotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Group Members Section */}
          <div className="mobile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  RECIPIENTS & SETTLEMENT
                </span>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                  Group Members ({members.length})
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {members.map((member, idx) => {
                const mTotal = memberTotals[idx] || {}
                const cust = mTotal.customer
                const custAdvance = Number(cust?.advanceBalance || cust?.credit_balance || 0)
                const custPoints = Number(cust?.loyaltyPoints || cust?.loyalty_points || 0)

                return (
                  <div
                    key={member.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '12px',
                    }}
                  >
                    {/* Member Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'var(--accent-primary)',
                            color: '#000',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Member #{idx + 1}
                        </span>
                      </div>
                      {members.length > (groupMode === 'split' ? 2 : 1) && (
                        <button
                          type="button"
                          onClick={() => removeMember(member.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    {/* Customer Selection Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '10px' }}>
                      <select
                        className="mobile-input"
                        value={member.customerId}
                        onChange={(e) => updateMember(member.id, { customerId: e.target.value })}
                        style={{ fontSize: '0.82rem' }}
                      >
                        <option value="">— Select Customer —</option>
                        {serverCustomers
                          .filter((c) => !c.deleted)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.phone ? `(${c.phone})` : ''}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="mobile-btn mobile-btn-secondary"
                        onClick={() => {
                          setNewCustMemberId(member.id)
                          setShowNewCustModal(true)
                        }}
                        style={{ minHeight: '40px', padding: '0 10px', fontSize: '0.75rem' }}
                        title="New Customer"
                      >
                        <Plus size={14} /> New
                      </button>
                    </div>

                    {/* Customer Advance & Loyalty Balance Badges */}
                    {cust && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {custAdvance > 0 && (
                          <span className="mobile-badge mobile-badge-success" style={{ fontSize: '0.68rem' }}>
                            Advance: ₹{custAdvance.toFixed(2)}
                          </span>
                        )}
                        {custPoints > 0 && (
                          <span className="mobile-badge mobile-badge-info" style={{ fontSize: '0.68rem' }}>
                            Loyalty: {custPoints} pts
                          </span>
                        )}
                      </div>
                    )}

                    {/* Individual Addons (Shared Mode Only) */}
                    {groupMode === 'shared' && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={member.hasAddons}
                              onChange={(e) => updateMember(member.id, { hasAddons: e.target.checked })}
                            />
                            Extra Add-on items for this member
                          </label>
                          {member.hasAddons && (
                            <button
                              type="button"
                              onClick={() => openAddItemSheet(member.id)}
                              className="mobile-btn mobile-btn-secondary"
                              style={{ minHeight: '28px', padding: '0 8px', fontSize: '0.68rem' }}
                            >
                              <Plus size={12} /> Addon
                            </button>
                          )}
                        </div>

                        {member.hasAddons && (member.addonItems || []).length > 0 && (
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {member.addonItems.map((addon, aIdx) => (
                              <div
                                key={addon.id || aIdx}
                                style={{
                                  padding: '6px 8px',
                                  background: 'var(--bg-input)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <span>{addon.itemName} ({addon.qty}×)</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="currency-num">₹{addon.amount.toFixed(2)}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateMember(member.id, {
                                        addonItems: member.addonItems.filter((_, i) => i !== aIdx),
                                      })
                                    }
                                    style={{ background: 'none', border: 'none', color: 'var(--error)', padding: 0 }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Member Discount Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '8px', marginBottom: '8px' }}>
                      <select
                        className="mobile-input"
                        value={member.discountType}
                        onChange={(e) => updateMember(member.id, { discountType: e.target.value })}
                        style={{ fontSize: '0.75rem' }}
                      >
                        <option value="flat">₹ Flat</option>
                        <option value="percent">% Off</option>
                      </select>
                      <input
                        type="number"
                        className="mobile-input"
                        placeholder="Discount amount"
                        min="0"
                        step="0.01"
                        value={member.discountValue || ''}
                        onChange={(e) => updateMember(member.id, { discountValue: Number(e.target.value) })}
                        style={{ fontSize: '0.78rem' }}
                      />
                    </div>

                    {/* Promo Code Accordion */}
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={member.usePromoCode}
                          onChange={(e) => updateMember(member.id, { usePromoCode: e.target.checked, appliedPromo: null })}
                        />
                        Promo Coupon Code
                      </label>
                      {member.usePromoCode && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px', marginTop: '4px' }}>
                          <input
                            type="text"
                            className="mobile-input"
                            placeholder="PROMO CODE"
                            value={member.promoCodeInput || ''}
                            onChange={(e) => updateMember(member.id, { promoCodeInput: e.target.value })}
                            style={{ fontSize: '0.78rem' }}
                          />
                          <button
                            type="button"
                            className="mobile-btn mobile-btn-secondary"
                            onClick={() => handleApplyPromo(member.id)}
                            style={{ minHeight: '36px', padding: '0 10px', fontSize: '0.75rem' }}
                          >
                            Apply
                          </button>
                        </div>
                      )}
                      {member.promoError && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--error)', marginTop: '2px' }}>
                          {member.promoError}
                        </div>
                      )}
                      {member.appliedPromo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.75rem', marginTop: '4px' }}>
                          <Tag size={12} /> Applied: {member.appliedPromo.code}
                          <button
                            type="button"
                            onClick={() => updateMember(member.id, { appliedPromo: null })}
                            style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.72rem', cursor: 'pointer' }}
                          >
                            (Remove)
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Loyalty Points Redemption Toggle */}
                    {cust && custPoints > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--accent-tertiary)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={member.shouldRedeemLoyalty}
                            onChange={(e) => updateMember(member.id, { shouldRedeemLoyalty: e.target.checked })}
                          />
                          Redeem Points ({custPoints} Available)
                        </label>
                        {member.shouldRedeemLoyalty && (
                          <div style={{ marginTop: '4px' }}>
                            <input
                              type="number"
                              className="mobile-input"
                              placeholder={`Max ${custPoints} points`}
                              min="0"
                              max={custPoints}
                              value={member.loyaltyPointsRedeemed || ''}
                              onChange={(e) => updateMember(member.id, { loyaltyPointsRedeemed: e.target.value })}
                              style={{ fontSize: '0.78rem' }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Advance Usage Checkbox */}
                    {custAdvance > 0 && (
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--success)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={member.useAdvance}
                            onChange={(e) => updateMember(member.id, { useAdvance: e.target.checked })}
                          />
                          Deduct from Advance (₹{custAdvance.toFixed(2)})
                        </label>
                      </div>
                    )}

                    {/* Payment Inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Cash Paid (₹)</label>
                        <input
                          type="number"
                          className="mobile-input"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={member.cashPaid || ''}
                          onChange={(e) => updateMember(member.id, { cashPaid: e.target.value })}
                          style={{ fontSize: '0.8rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>UPI Paid (₹)</label>
                        <input
                          type="number"
                          className="mobile-input"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={member.upiPaid || ''}
                          onChange={(e) => updateMember(member.id, { upiPaid: e.target.value })}
                          style={{ fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>

                    {/* Member Summary Cardlet */}
                    <div
                      style={{
                        padding: '8px',
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Bill Amount: </span>
                        <strong>₹{mTotal.grossTotal?.toFixed(2) || '0.00'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Balance: </span>
                        <strong className="currency-num" style={{ color: (mTotal.balanceToPay || 0) > 0 ? 'var(--error)' : 'var(--success)' }}>
                          ₹{mTotal.balanceToPay?.toFixed(2) || '0.00'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              })}

              <button
                type="button"
                className="mobile-btn mobile-btn-secondary"
                onClick={addMember}
                style={{ minHeight: '40px', fontSize: '0.8rem' }}
              >
                <Plus size={15} /> + Add Another Member
              </button>
            </div>
          </div>

          {/* Dates and Remarks Card */}
          <div className="mobile-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>BILL DATE</label>
                <input
                  type="date"
                  className="mobile-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>DUE DATE</label>
                <input
                  type="date"
                  className="mobile-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>ORDER NOTES</label>
              <textarea
                className="mobile-input"
                rows={2}
                placeholder="Group billing remarks..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
          </div>

          {/* Group Grand Total Summary Card */}
          <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-secondary)' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-secondary)', margin: '0 0 10px 0', letterSpacing: '0.05em' }}>
              GROUP TOTAL SUMMARY
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Total Group Spend</span>
                <span className="currency-num">₹{overallTotals.subtotal.toFixed(2)}</span>
              </div>
              {overallTotals.discounts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-primary)' }}>
                  <span>Discounts Applied</span>
                  <span className="currency-num">-₹{overallTotals.discounts.toFixed(2)}</span>
                </div>
              )}
              {overallTotals.advanceDeducted > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                  <span>Advance Deducted</span>
                  <span className="currency-num">-₹{overallTotals.advanceDeducted.toFixed(2)}</span>
                </div>
              )}
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>
                <span>Grand Total</span>
                <span className="currency-num" style={{ color: 'var(--accent-secondary)' }}>
                  ₹{overallTotals.grossTotal.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Paid Now (Cash + UPI)</span>
                <span className="currency-num" style={{ color: 'var(--success)' }}>
                  ₹{overallTotals.totalPaid.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem' }}>
                <span style={{ color: overallTotals.balanceToPay > 0 ? 'var(--error)' : 'var(--success)' }}>
                  Balance Remaining to Pay
                </span>
                <span className="currency-num" style={{ color: overallTotals.balanceToPay > 0 ? 'var(--error)' : 'var(--success)' }}>
                  ₹{overallTotals.balanceToPay.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            className="mobile-btn mobile-btn-primary"
            disabled={isSubmitting || isCreatingBill}
            style={{ minHeight: '48px', fontSize: '0.92rem', fontWeight: 900 }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin" /> Creating Group Bills...
              </>
            ) : (
              <>
                <CheckCircle size={18} /> Generate {members.length} Group Bills
              </>
            )}
          </button>
        </form>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: GROUP MASTERS LIST & CONSOLIDATION                                  */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'masters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>CONSOLIDATED INVOICES</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>GROUP MASTERS</h2>
            </div>
            <button
              className="mobile-btn mobile-btn-primary"
              onClick={() => setShowConsolidateModal(true)}
              style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', minHeight: '38px' }}
            >
              <Plus size={16} /> Consolidate Bills
            </button>
          </div>

          {/* Loading */}
          {isLoadingBills && (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '30px 16px' }}>
              <Loader2 size={28} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading group invoices...</p>
            </div>
          )}

          {/* Group Master Bills Stack */}
          {!isLoadingBills && groupMasterBills.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <Layers size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
              <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Group Master Invoices</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Create group bills or combine existing unpaid customer invoices.</p>
            </div>
          ) : (
            !isLoadingBills && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {groupMasterBills.map((grp) => (
                  <div
                    key={grp.id}
                    className="mobile-card"
                    onClick={() => navigate(`/mobile/bill/${grp.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {grp.customerName || grp.customer_name || 'Group Master'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                          #{grp.invoiceNumber || grp.invoice_number || grp.id} • {grp.childBillIds?.length || grp.child_bill_ids?.length || 0} Member Bills
                        </div>
                      </div>
                      <span className={`mobile-badge ${grp.status === 'paid' ? 'mobile-badge-success' : 'mobile-badge-error'}`}>
                        {(grp.status || 'unpaid').toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Group Total</span>
                      <span className="currency-num" style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', fontWeight: 800 }}>
                        ₹{Number(grp.total || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODALS & BOTTOM SHEETS                                                     */}
      {/* ────────────────────────────────────────────────────────────────────────── */}

      {/* Add Item BottomSheet */}
      <BottomSheet
        isOpen={showItemSheet}
        onClose={() => setShowItemSheet(false)}
        title={itemSheetTarget === 'shared' ? 'Add Shared Item' : 'Add Member Extra Item'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Inventory vs Custom Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="mobile-btn"
              onClick={() => setItemTypeTab('inventory')}
              style={{
                minHeight: '36px',
                fontSize: '0.78rem',
                background: itemTypeTab === 'inventory' ? 'var(--accent-primary)' : 'var(--bg-input)',
                color: itemTypeTab === 'inventory' ? '#000' : 'var(--text-secondary)',
              }}
            >
              Inventory Item
            </button>
            <button
              type="button"
              className="mobile-btn"
              onClick={() => setItemTypeTab('custom')}
              style={{
                minHeight: '36px',
                fontSize: '0.78rem',
                background: itemTypeTab === 'custom' ? 'var(--accent-primary)' : 'var(--bg-input)',
                color: itemTypeTab === 'custom' ? '#000' : 'var(--text-secondary)',
              }}
            >
              Custom Item
            </button>
          </div>

          {itemTypeTab === 'inventory' ? (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  SELECT INVENTORY PRODUCT
                </label>
                <select
                  className="mobile-input"
                  value={selectedInventoryId}
                  onChange={(e) => setSelectedInventoryId(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                >
                  {serverInventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.sellingPrice ? `(₹${item.sellingPrice})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    PRINT TYPE
                  </label>
                  <select
                    className="mobile-input"
                    value={printType}
                    onChange={(e) => setPrintType(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="color">Color</option>
                    <option value="bw">B/W</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    SIDES
                  </label>
                  <select
                    className="mobile-input"
                    value={sides}
                    onChange={(e) => setSides(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="single">Single Side</option>
                    <option value="double">Double Side</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                ITEM DESCRIPTION
              </label>
              <input
                type="text"
                className="mobile-input"
                placeholder="e.g. Poster Lamination"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                style={{ fontSize: '0.82rem' }}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                QUANTITY
              </label>
              <input
                type="number"
                className="mobile-input"
                min="1"
                value={itemQty}
                onChange={(e) => setItemQty(Number(e.target.value))}
                style={{ fontSize: '0.82rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                UNIT PRICE (₹)
              </label>
              <input
                type="number"
                className="mobile-input"
                min="0"
                step="0.01"
                value={itemUnitPrice}
                onChange={(e) => setItemUnitPrice(Number(e.target.value))}
                style={{ fontSize: '0.82rem' }}
              />
            </div>
          </div>

          <button
            type="button"
            className="mobile-btn mobile-btn-primary"
            onClick={handleSaveItem}
            style={{ minHeight: '44px', marginTop: '6px' }}
          >
            Add to {itemSheetTarget === 'shared' ? 'Shared List' : 'Member Extra'}
          </button>
        </div>
      </BottomSheet>

      {/* Quick Add Customer BottomSheet */}
      <BottomSheet
        isOpen={showNewCustModal}
        onClose={() => setShowNewCustModal(false)}
        title="Quick Add Customer"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              CUSTOMER NAME *
            </label>
            <input
              type="text"
              className="mobile-input"
              placeholder="e.g. Rahul Sharma"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              style={{ fontSize: '0.82rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              PHONE NUMBER
            </label>
            <input
              type="tel"
              className="mobile-input"
              placeholder="10-digit mobile number"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              style={{ fontSize: '0.82rem' }}
            />
          </div>
          <button
            type="button"
            className="mobile-btn mobile-btn-primary"
            disabled={isCreatingCustomer}
            onClick={handleQuickAddCustomer}
            style={{ minHeight: '44px', marginTop: '6px' }}
          >
            {isCreatingCustomer ? 'Creating...' : 'Save & Assign Customer'}
          </button>
        </div>
      </BottomSheet>

      {/* Consolidate Bills BottomSheet */}
      <BottomSheet
        isOpen={showConsolidateModal}
        onClose={() => setShowConsolidateModal(false)}
        title="Consolidate Unpaid Bills"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              SELECT CLIENT
            </label>
            <select
              className="mobile-input"
              value={selectedConsolidateCustomerId}
              onChange={(e) => {
                setSelectedConsolidateCustomerId(e.target.value)
                setSelectedBillIds([])
              }}
            >
              <option value="">— Select Customer —</option>
              {serverCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Select unpaid bills to combine into a single Master invoice:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '35vh', overflowY: 'auto' }}>
            {unpaidCustomerBills.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                No unpaid bills available for this client.
              </div>
            ) : (
              unpaidCustomerBills.map((b) => {
                const isSelected = selectedBillIds.includes(b.id)
                return (
                  <div
                    key={b.id}
                    onClick={() => toggleSelectBill(b.id)}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-input)',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        #{b.invoiceNumber || b.invoice_number || b.id}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date: {b.date}</div>
                    </div>
                    <div className="currency-num" style={{ fontSize: '0.95rem', color: 'var(--accent-primary)', fontWeight: 800 }}>
                      ₹{Number(b.total || 0).toFixed(2)}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <button
            type="button"
            className="mobile-btn mobile-btn-primary"
            disabled={selectedBillIds.length < 2 || isCreatingBill}
            onClick={handleConsolidateExistingBills}
            style={{ minHeight: '44px' }}
          >
            {isCreatingBill ? 'Consolidating...' : `Consolidate ${selectedBillIds.length} Bills into Group Master`}
          </button>
        </div>
      </BottomSheet>
    </MobileLayout>
  )
}
