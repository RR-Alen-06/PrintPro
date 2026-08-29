import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../../hooks/useCustomersQuery'
import { useInventory, usePaymentMutations } from '../../hooks/useEntitiesQuery'
import { SequenceService } from '../../services/sequenceService'
import { LoyaltyService } from '../../services/loyaltyService'
import { CreditService } from '../../services/creditService'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  UserCheck, Plus, Trash2, ChevronRight, ChevronLeft, Check, Search,
  Tag, Percent, Wallet, FileText, UserPlus, AlertCircle, Printer, Calendar,
  Gift, Award, Clock, Sparkles, Loader2
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileCreateBill() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editBillId = searchParams.get('edit')

  const { promoCodes, settings, showToast, addBill, editBill, addCustomer } = useAppContext()

  // TanStack Queries & Mutations
  const { data: serverCustomers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: serverInventory = [], isLoading: isLoadingInventory } = useInventory()
  const { data: serverBills = [], isLoading: isLoadingBills } = useBills()
  const { createBill: createBillMutation, updateBill: updateBillMutation, isCreatingBill, isUpdatingBill } = useBillMutations()
  const { createCustomer: createCustomerMutation, isCreatingCustomer } = useCustomerMutations()
  const { createPayment } = usePaymentMutations()

  // Wizard Step State (1: Customer -> 2: Items -> 3: Payment)
  const [step, setStep] = useState(1)

  // Portal Orders state
  const [portalOrders, setPortalOrders] = useState([])
  const [showPortalOrdersModal, setShowPortalOrdersModal] = useState(false)

  // Step 1: Customer Selection
  const [customerType, setCustomerType] = useState('regular')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')

  // Dates & Estimates
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => {
    const next = new Date()
    next.setDate(next.getDate() + 7)
    return next.toISOString().slice(0, 10)
  })
  const [estimatedCompletion, setEstimatedCompletion] = useState('')

  // Step 2: Print Items List
  const [itemRows, setItemRows] = useState([])
  const [showAddItemSheet, setShowAddItemSheet] = useState(false)

  // Add Item Sheet State
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [customItemName, setCustomItemName] = useState('')
  const [isCustomItem, setIsCustomItem] = useState(false)
  const [itemPrintType, setItemPrintType] = useState('color') // 'color' | 'bw'
  const [itemSides, setItemSides] = useState('single') // 'single' | 'double'
  const [itemQty, setItemQty] = useState(1)
  const [itemPages, setItemPages] = useState(1)
  const [itemUnitPrice, setItemUnitPrice] = useState('')
  const [itemGstRate, setItemGstRate] = useState(0)

  // Step 3: Payment & Summary
  const [discountType, setDiscountType] = useState('flat') // 'flat' | 'percent'
  const [discountValue, setDiscountValue] = useState(0)
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState(null)
  
  // Loyalty redemption state
  const [shouldRedeemLoyalty, setShouldRedeemLoyalty] = useState(false)
  const [loyaltyPointsRedeemed, setLoyaltyPointsRedeemed] = useState('')

  // Advance balance credit usage
  const [useAdvanceCredit, setUseAdvanceCredit] = useState(false)

  const [paymentMode, setPaymentMode] = useState('full_cash') // 'full_cash' | 'full_upi' | 'split' | 'credit'
  const [cashAmount, setCashAmount] = useState(0)
  const [upiAmount, setUpiAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync selectedInventoryId when serverInventory loads
  useEffect(() => {
    if (!selectedInventoryId && serverInventory.length > 0) {
      setSelectedInventoryId(serverInventory[0].id)
    }
  }, [serverInventory, selectedInventoryId])

  // Load Portal Orders from localStorage
  useEffect(() => {
    const orders = JSON.parse(localStorage.getItem('portal_orders') || '[]')
    setPortalOrders(orders.filter(o => o.status !== 'completed'))
  }, [])

  // If in Edit Mode, populate existing bill data
  useEffect(() => {
    if (editBillId && serverBills.length > 0) {
      const existing = serverBills.find(b => String(b.id) === String(editBillId))
      if (existing) {
        setSelectedCustomerId(existing.customerId || existing.customer_id)
        setItemRows(existing.items || [])
        setDiscountValue(existing.discountValue || existing.discount_value || existing.discount || 0)
        setNotes(existing.notes || '')
        setBillDate(existing.date || new Date().toISOString().slice(0, 10))
        setDueDate(existing.dueDate || existing.due_date || new Date().toISOString().slice(0, 10))
        showToast(`Editing Bill #${existing.invoiceNumber || existing.invoice_number || existing.id}`, 'info')
      }
    }
  }, [editBillId, serverBills])

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return (serverCustomers || []).filter(c => {
      if (c.deleted) return false
      if (customerType === 'regular' && c.type !== 'regular') return false
      if (customerType === 'random' && c.type !== 'random') return false
      if (customerSearch.trim()) {
        const q = customerSearch.toLowerCase().trim()
        return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
      }
      return true
    })
  }, [serverCustomers, customerType, customerSearch])

  // Current selected customer object
  const selectedCustomerObj = useMemo(() => {
    return (serverCustomers || []).find(c => String(c.id) === String(selectedCustomerId))
  }, [serverCustomers, selectedCustomerId])

  // Calculation helpers for Step 2 unit price
  const activeInventoryObj = useMemo(() => {
    return (serverInventory || []).find(i => String(i.id) === String(selectedInventoryId))
  }, [serverInventory, selectedInventoryId])

  const calculatedUnitPrice = useMemo(() => {
    if (isCustomItem) return Number(itemUnitPrice || 0)
    if (!activeInventoryObj) return 10.0
    if (itemPrintType === 'color' && itemSides === 'single') return activeInventoryObj.colorSingle ?? 10.0
    if (itemPrintType === 'color' && itemSides === 'double') return activeInventoryObj.colorDouble ?? 18.0
    if (itemPrintType === 'bw' && itemSides === 'single') return activeInventoryObj.bwSingle ?? 3.0
    if (itemPrintType === 'bw' && itemSides === 'double') return activeInventoryObj.bwDouble ?? 5.0
    return 10.0
  }, [activeInventoryObj, itemPrintType, itemSides, isCustomItem, itemUnitPrice])

  // Add Item to Bill List
  const handleAddItemToBill = (e) => {
    e.preventDefault()
    const rate = Number(itemUnitPrice || calculatedUnitPrice)
    const name = isCustomItem ? (customItemName || 'Custom Print') : (activeInventoryObj?.name || 'A4 Paper')
    const qtyNum = Number(itemQty) || 1
    const pagesNum = Number(itemPages) || 1
    const totalAmount = rate * qtyNum * pagesNum

    const newRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      itemId: isCustomItem ? '' : selectedInventoryId,
      itemName: name,
      name: name,
      isCustom: isCustomItem,
      printType: itemPrintType,
      sides: itemSides,
      qty: qtyNum,
      pages: pagesNum,
      unitPrice: rate,
      unit_price: rate,
      gstRate: Number(itemGstRate || 0),
      amount: totalAmount
    }

    setItemRows(prev => [...prev, newRow])
    setShowAddItemSheet(false)
    setCustomItemName('')
    setIsCustomItem(false)
    setItemQty(1)
    setItemPages(1)
    setItemUnitPrice('')
    setItemGstRate(0)
    showToast(`Added '${name}' to order`, 'success')
  }

  // Remove Item
  const handleRemoveItem = (rowId) => {
    setItemRows(prev => prev.filter(r => r.id !== rowId))
  }

  // Quick Customer Creation
  const handleAddNewCustomerSubmit = async (e) => {
    e.preventDefault()
    if (!newCustName.trim()) {
      showToast('Customer name is required', 'error')
      return
    }

    try {
      const created = await createCustomerMutation({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || '',
        type: 'regular',
        total_spent: 0,
        balance_due: 0
      })

      if (addCustomer) {
        addCustomer({
          id: created?.id || `cust-${Date.now()}`,
          name: newCustName.trim(),
          phone: newCustPhone.trim() || '',
          type: 'regular',
          totalSpent: 0,
          balanceDue: 0
        })
      }

      if (created?.id) {
        setSelectedCustomerId(created.id)
      }
      setShowAddCustomerModal(false)
      setNewCustName('')
      setNewCustPhone('')
      showToast('New client registered successfully!', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to create customer', 'error')
    }
  }

  // Load Portal Order into Wizard
  const handleLoadPortalOrder = (order) => {
    setCustomerType('random')
    setNewCustName(order.customerName)
    setNewCustPhone(order.customerPhone || '')

    const newRows = (order.files || []).map((file, index) => {
      const unitPrice = file.config?.printType === 'color'
        ? (file.config?.sides === 'double' ? 15 : 10)
        : (file.config?.sides === 'double' ? 3 : 2)

      return {
        id: `portal-row-${Date.now()}-${index}`,
        itemId: '',
        itemName: `${file.name}`,
        name: `${file.name}`,
        isCustom: true,
        printType: file.config?.printType || 'color',
        sides: file.config?.sides || 'single',
        qty: file.config?.copies || 1,
        pages: 1,
        unitPrice,
        unit_price: unitPrice,
        gstRate: 0,
        amount: unitPrice * (file.config?.copies || 1)
      }
    })

    setItemRows(newRows)
    setShowPortalOrdersModal(false)
    showToast(`Loaded online order from ${order.customerName}`, 'success')
  }

  // Subtotal & Financial Totals
  const subtotal = useMemo(() => {
    return itemRows.reduce((sum, r) => sum + Number(r.amount || 0), 0)
  }, [itemRows])

  // Loyalty Discount Calculation via Headless LoyaltyService
  const loyaltyDiscount = useMemo(() => {
    if (!shouldRedeemLoyalty || !selectedCustomerObj) return 0
    const points = Number(loyaltyPointsRedeemed || 0)
    const available = Number(selectedCustomerObj.loyalty_points || selectedCustomerObj.loyaltyPoints || 0)
    return LoyaltyService.calculateRedemptionDiscount(points, available, subtotal, settings)
  }, [shouldRedeemLoyalty, selectedCustomerObj, loyaltyPointsRedeemed, settings, subtotal])

  const calculatedDiscount = useMemo(() => {
    let disc = 0
    if (discountType === 'flat') {
      disc = Number(discountValue || 0)
    } else {
      disc = (subtotal * Number(discountValue || 0)) / 100
    }
    if (appliedPromo) {
      if (appliedPromo.type === 'percent') {
        disc += (subtotal * Number(appliedPromo.value || 0)) / 100
      } else {
        disc += Number(appliedPromo.value || 0)
      }
    }
    disc += loyaltyDiscount
    return Math.min(disc, subtotal)
  }, [subtotal, discountType, discountValue, appliedPromo, loyaltyDiscount])

  // Advance Credit Deduction via Headless CreditService
  const netBeforeAdvance = Math.max(0, subtotal - calculatedDiscount)
  const advanceDeduction = useMemo(() => {
    if (!useAdvanceCredit || !selectedCustomerObj) return 0
    const credit = Number(selectedCustomerObj.creditBalance || selectedCustomerObj.credit_balance || 0)
    return CreditService.calculateAdvanceDrawdown(credit, netBeforeAdvance).advanceUsed
  }, [useAdvanceCredit, selectedCustomerObj, netBeforeAdvance])

  const grandTotal = useMemo(() => {
    return Math.max(0, netBeforeAdvance - advanceDeduction)
  }, [netBeforeAdvance, advanceDeduction])

  // Apply Promo Code
  const handleApplyPromo = () => {
    if (!promoCodeInput.trim()) return
    const codeUpper = promoCodeInput.trim().toUpperCase()
    const found = (promoCodes || []).find(p => p.code === codeUpper && p.enabled !== false)
    if (!found) {
      showToast(`Invalid or expired promo code '${codeUpper}'`, 'error')
      return
    }
    if (found.minAmount && subtotal < found.minAmount) {
      showToast(`Promo code '${codeUpper}' requires min order of ₹${found.minAmount}`, 'error')
      return
    }
    setAppliedPromo(found)
    showToast(`Applied Promo '${codeUpper}'!`, 'success')
  }

  // Submit Final Bill
  const handleFinalizeBillSubmit = async () => {
    if (!selectedCustomerId) {
      showToast('Please select a customer in Step 1', 'error')
      setStep(1)
      return
    }

    if (itemRows.length === 0) {
      showToast('Please add at least one print item in Step 2', 'error')
      setStep(2)
      return
    }

    setIsSubmitting(true)
    try {
      let finalCash = 0
      let finalUpi = 0
      let finalStatus = 'unpaid'

      if (paymentMode === 'full_cash') {
        finalCash = grandTotal
        finalStatus = 'paid'
      } else if (paymentMode === 'full_upi') {
        finalUpi = grandTotal
        finalStatus = 'paid'
      } else if (paymentMode === 'split') {
        finalCash = Number(cashAmount || 0)
        finalUpi = Number(upiAmount || 0)
        const totalPaid = finalCash + finalUpi
        if (totalPaid >= grandTotal - 0.01) {
          finalStatus = 'paid'
        } else if (totalPaid > 0) {
          finalStatus = 'partial'
        }
      }

      const existingBill = editBillId ? serverBills.find(b => String(b.id) === String(editBillId)) : null
      const generatedInvoiceNo = editBillId
        ? (existingBill?.invoiceNumber || existingBill?.invoice_number || `BILL-${editBillId}`)
        : await SequenceService.getNextSequence('BILL')

      const billPayload = {
        id: editBillId || `BILL-${Date.now()}`,
        invoice_number: generatedInvoiceNo,
        invoiceNumber: generatedInvoiceNo,
        date: billDate,
        due_date: dueDate,
        dueDate: dueDate,
        estimated_completion: estimatedCompletion,
        estimatedCompletion,
        customer_id: selectedCustomerId,
        customerId: selectedCustomerId,
        customer_name: selectedCustomerObj?.name || 'Walk-in Customer',
        customerName: selectedCustomerObj?.name || 'Walk-in Customer',
        customer_phone: selectedCustomerObj?.phone || '',
        customerPhone: selectedCustomerObj?.phone || '',
        items: itemRows.map(r => ({
          item_name: r.itemName || r.name || 'Print Item',
          name: r.itemName || r.name || 'Print Item',
          print_type: r.printType || 'color',
          printType: r.printType || 'color',
          sides: r.sides || 'single',
          qty: Number(r.qty || 1),
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
        total: grandTotal,
        amount_paid: finalCash + finalUpi,
        amountPaid: finalCash + finalUpi,
        balance: Math.max(0, grandTotal - (finalCash + finalUpi)),
        status: finalStatus,
        notes,
        created_at: new Date().toISOString()
      }

      let savedResultId = billPayload.id

      if (editBillId) {
        await updateBillMutation({ id: editBillId, data: billPayload })
        if (editBill) editBill(billPayload)
        showToast(`Bill #${billPayload.invoiceNumber} updated successfully!`, 'success')
      } else {
        const created = await createBillMutation(billPayload)
        if (created?.id) savedResultId = created.id
        if (addBill) addBill(billPayload)
        showToast(`Bill #${billPayload.invoiceNumber} created successfully!`, 'success')

        // If upfront payment was made, record payment
        if (finalCash + finalUpi > 0) {
          try {
            await createPayment({
              bill_id: savedResultId,
              customer_id: selectedCustomerId,
              date: billDate,
              cash_amount: finalCash,
              upi_amount: finalUpi,
              total_paid: finalCash + finalUpi,
              payment_type: finalStatus === 'paid' ? 'full' : 'partial',
              notes: 'Initial bill payment at POS checkout'
            })
          } catch (payErr) {
            console.error('Upfront payment recording notice:', payErr)
          }
        }
      }

      navigate(`/mobile/bill/${savedResultId}`)
    } catch (e) {
      showToast(e.message || 'Failed to save bill', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <MobileLayout
      title={editBillId ? 'Edit Print Bill' : 'Create Print Bill'}
      onSwitchToDesktop={() => navigate('/billing')}
    >
      {/* 3-Step Glowing Progress Indicator */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {[
          { num: 1, title: 'CUSTOMER' },
          { num: 2, title: 'PRINT ITEMS' },
          { num: 3, title: 'PAYMENT' },
        ].map(s => {
          const isActive = step === s.num
          const isDone = step > s.num
          return (
            <div
              key={s.num}
              onClick={() => { if (s.num < step) setStep(s.num) }}
              style={{
                background: isActive ? 'rgba(255, 47, 176, 0.15)' : isDone ? 'rgba(0, 255, 171, 0.15)' : 'var(--bg-card)',
                border: isActive ? '1px solid var(--accent-primary)' : isDone ? '1px solid var(--success)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 4px',
                textAlign: 'center',
                boxShadow: isActive ? '0 0 10px rgba(255, 47, 176, 0.3)' : 'none',
                cursor: s.num < step ? 'pointer' : 'default',
                transition: 'var(--transition)'
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 900, color: isActive ? 'var(--accent-primary)' : isDone ? 'var(--success)' : 'var(--text-muted)' }}>
                STEP 0{s.num}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {s.title}
              </div>
            </div>
          )
        })}
      </div>

      {/* Online Customer Portal Orders Quick Loader Banner */}
      {portalOrders.length > 0 && (
        <div
          className="mobile-card"
          onClick={() => setShowPortalOrdersModal(true)}
          style={{ cursor: 'pointer', borderColor: 'var(--accent-secondary)', background: 'rgba(0, 240, 255, 0.1)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-secondary)' }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {portalOrders.length} Online Portal Order(s) Pending!
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tap to import customer files directly into POS</div>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--accent-secondary)' }} />
        </div>
      )}

      {/* STEP 1: CUSTOMER SELECTION */}
      {step === 1 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              SELECT CLIENT / CUSTOMER
            </h3>
            <button
              className="mobile-btn mobile-btn-secondary"
              onClick={() => setShowAddCustomerModal(true)}
              style={{ minHeight: '36px', padding: '0 12px', fontSize: '0.78rem', color: 'var(--accent-secondary)', borderColor: 'var(--accent-secondary)' }}
            >
              + New Client
            </button>
          </div>

          {/* Customer Type Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            <button
              type="button"
              className={`mobile-btn ${customerType === 'regular' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
              onClick={() => setCustomerType('regular')}
              style={{ minHeight: '40px', fontSize: '0.85rem' }}
            >
              Regular Clients
            </button>
            <button
              type="button"
              className={`mobile-btn ${customerType === 'random' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
              onClick={() => setCustomerType('random')}
              style={{ minHeight: '40px', fontSize: '0.85rem' }}
            >
              Walk-in Clients
            </button>
          </div>

          {/* Customer Search */}
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
            <input
              type="text"
              className="mobile-input"
              style={{ paddingLeft: '42px' }}
              placeholder="Search customer name, phone..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
          </div>

          {/* Customer Selection Stack */}
          {isLoadingCustomers ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '24px' }}>
              <Loader2 size={24} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading customers...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '16px' }}>
              {filteredCustomers.length === 0 ? (
                <div className="mobile-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No {customerType} customers found. Tap "+ New Client" to create one.
                </div>
              ) : (
                filteredCustomers.map(c => {
                  const isSelected = String(c.id) === String(selectedCustomerId)
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      style={{
                        padding: '12px',
                        background: isSelected ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
                        border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 10px rgba(255, 47, 176, 0.3)' : 'none'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {c.phone || 'No phone'} • Balance: ₹{Number(c.balanceDue || c.balance_due || 0).toFixed(2)}
                        </div>
                      </div>
                      {isSelected && <Check size={20} style={{ color: 'var(--accent-primary)' }} />}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Dates & Estimates Card */}
          <div className="mobile-card" style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-secondary)', margin: '0 0 12px 0' }}>
              ORDER DATES & SCHEDULE
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  INVOICE DATE
                </label>
                <input
                  type="date"
                  className="mobile-input"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  DUE DATE
                </label>
                <input
                  type="date"
                  className="mobile-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            className="mobile-btn mobile-btn-primary"
            onClick={() => {
              if (!selectedCustomerId) {
                showToast('Please select a customer first', 'error')
                return
              }
              setStep(2)
            }}
          >
            Continue to Print Items <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 2: PRINT LINE ITEMS */}
      {step === 2 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              PRINT ITEMS ({itemRows.length})
            </h3>
            <button
              className="mobile-btn mobile-btn-primary"
              onClick={() => setShowAddItemSheet(true)}
              style={{ minHeight: '36px', padding: '0 12px', fontSize: '0.78rem', width: 'auto' }}
            >
              <Plus size={16} /> + Add Item
            </button>
          </div>

          {/* Items Stack */}
          {itemRows.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <Printer size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '10px' }} />
              <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Items in Bill</h4>
              <p style={{ fontSize: '0.82rem', margin: 0 }}>Tap "+ Add Item" to specify paper type, sides, and copies.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {itemRows.map((item, idx) => (
                <div key={item.id || idx} className="mobile-card" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {item.itemName || item.name}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <span className="mobile-badge mobile-badge-info" style={{ fontSize: '0.65rem' }}>
                          {(item.printType || 'Color').toUpperCase()}
                        </span>
                        <span className="mobile-badge mobile-badge-warning" style={{ fontSize: '0.65rem' }}>
                          {(item.sides || 'Single').toUpperCase()}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Qty: {item.qty} × ₹{Number(item.unitPrice || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="currency-num" style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                        ₹{Number(item.amount || 0).toFixed(2)}
                      </div>
                      <button
                        className="mobile-icon-btn"
                        onClick={() => handleRemoveItem(item.id)}
                        style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', color: 'var(--error)', borderColor: 'var(--error-bg)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subtotal Banner */}
          <div className="mobile-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'var(--bg-input)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>ORDER SUBTOTAL</span>
            <span className="currency-num" style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>
              ₹{subtotal.toFixed(2)}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <button className="mobile-btn mobile-btn-secondary" onClick={() => setStep(1)}>
              <ChevronLeft size={18} /> Back
            </button>
            <button
              className="mobile-btn mobile-btn-primary"
              onClick={() => {
                if (itemRows.length === 0) {
                  showToast('Please add at least one item', 'error')
                  return
                }
                setStep(3)
              }}
            >
              Continue to Payment <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PAYMENT & SUMMARY */}
      {step === 3 && (
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 14px 0', color: 'var(--text-primary)' }}>
            BILL SUMMARY & PAYMENT
          </h3>

          {/* Discount & Promo Accordion */}
          <div className="mobile-card" style={{ marginBottom: '14px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-secondary)', margin: '0 0 10px 0' }}>
              DISCOUNTS & PROMOTIONS
            </h4>

            {/* Discount Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <select
                className="mobile-input"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
              >
                <option value="flat">Flat Amount (₹)</option>
                <option value="percent">Percentage (%)</option>
              </select>
              <input
                type="number"
                step="0.01"
                className="mobile-input currency-num"
                placeholder="0.00"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>

            {/* Promo Code Input */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="mobile-input"
                placeholder="Enter Promo Code..."
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
              />
              <button
                type="button"
                className="mobile-btn mobile-btn-secondary"
                onClick={handleApplyPromo}
                style={{ width: 'auto', padding: '0 12px', minHeight: '44px', fontSize: '0.8rem' }}
              >
                Apply
              </button>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="mobile-card" style={{ marginBottom: '14px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
              SELECT PAYMENT METHOD
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <button
                type="button"
                className={`mobile-btn ${paymentMode === 'full_cash' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setPaymentMode('full_cash')}
                style={{ minHeight: '40px', fontSize: '0.82rem' }}
              >
                Full Cash
              </button>
              <button
                type="button"
                className={`mobile-btn ${paymentMode === 'full_upi' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setPaymentMode('full_upi')}
                style={{ minHeight: '40px', fontSize: '0.82rem' }}
              >
                Full UPI
              </button>
              <button
                type="button"
                className={`mobile-btn ${paymentMode === 'split' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setPaymentMode('split')}
                style={{ minHeight: '40px', fontSize: '0.82rem' }}
              >
                Split Pay
              </button>
              <button
                type="button"
                className={`mobile-btn ${paymentMode === 'credit' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setPaymentMode('credit')}
                style={{ minHeight: '40px', fontSize: '0.82rem' }}
              >
                On Credit (Unpaid)
              </button>
            </div>

            {/* Split Mode Inputs */}
            {paymentMode === 'split' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CASH AMOUNT</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mobile-input currency-num"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>UPI AMOUNT</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mobile-input currency-num"
                    value={upiAmount}
                    onChange={(e) => setUpiAmount(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mobile-card" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              INTERNAL ORDER NOTES
            </label>
            <input
              type="text"
              className="mobile-input"
              placeholder="e.g. Urgent banner print for festival"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Grand Total Final Card */}
          <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', marginBottom: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span>Subtotal</span>
              <span className="currency-num">₹{subtotal.toFixed(2)}</span>
            </div>
            {calculatedDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--accent-primary)', marginBottom: '6px' }}>
                <span>Total Discount</span>
                <span className="currency-num">-₹{calculatedDiscount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <span>FINAL GRAND TOTAL</span>
              <span className="currency-num" style={{ color: 'var(--accent-primary)', textShadow: '0 0 10px rgba(255, 47, 176, 0.4)' }}>
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <button className="mobile-btn mobile-btn-secondary" onClick={() => setStep(2)}>
              <ChevronLeft size={18} /> Back
            </button>
            <button
              className="mobile-btn mobile-btn-primary"
              onClick={handleFinalizeBillSubmit}
              disabled={isSubmitting || isCreatingBill || isUpdatingBill}
            >
              {isSubmitting || isCreatingBill || isUpdatingBill ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <Loader2 size={18} className="spin" /> SAVING...
                </span>
              ) : (
                editBillId ? 'Update Invoice' : 'Finalize & Print Invoice'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="bottom-sheet-overlay" onClick={() => setShowAddCustomerModal(false)}>
          <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-drag-handle" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
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
              />
              <input
                type="tel"
                className="mobile-input"
                placeholder="Phone Number"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
              />
              <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isCreatingCustomer}>
                {isCreatingCustomer ? 'Creating Client...' : 'Save & Select Client'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Portal Orders Modal */}
      <BottomSheet
        isOpen={showPortalOrdersModal}
        onClose={() => setShowPortalOrdersModal(false)}
        title="Pending Online Portal Orders"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {portalOrders.map(order => (
            <div key={order.id} className="mobile-card" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>{order.customerName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Files: {order.files?.length || 0} • Status: {order.status}</div>
                </div>
                <button
                  className="mobile-btn mobile-btn-primary"
                  onClick={() => handleLoadPortalOrder(order)}
                  style={{ minHeight: '34px', padding: '0 12px', fontSize: '0.78rem' }}
                >
                  Import Order
                </button>
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* Add Item Bottom Sheet Drawer */}
      <BottomSheet
        isOpen={showAddItemSheet}
        onClose={() => setShowAddItemSheet(false)}
        title="Add Print Specification Item"
      >
        <form onSubmit={handleAddItemToBill} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Custom vs Inventory Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className={`mobile-btn ${!isCustomItem ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
              onClick={() => setIsCustomItem(false)}
              style={{ minHeight: '38px', fontSize: '0.82rem' }}
            >
              From Inventory
            </button>
            <button
              type="button"
              className={`mobile-btn ${isCustomItem ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
              onClick={() => setIsCustomItem(true)}
              style={{ minHeight: '38px', fontSize: '0.82rem' }}
            >
              Custom Item
            </button>
          </div>

          {!isCustomItem ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                SELECT ITEM
              </label>
              <select
                className="mobile-input"
                value={selectedInventoryId}
                onChange={(e) => setSelectedInventoryId(e.target.value)}
              >
                {(serverInventory || []).map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                CUSTOM ITEM NAME
              </label>
              <input
                type="text"
                className="mobile-input"
                placeholder="e.g. Vinyl Banner 3x2"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                required
              />
            </div>
          )}

          {/* Color vs B&W */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              PRINT TYPE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`mobile-btn ${itemPrintType === 'color' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setItemPrintType('color')}
                style={{ minHeight: '40px', fontSize: '0.82rem' }}
              >
                Full Color
              </button>
              <button
                type="button"
                className={`mobile-btn ${itemPrintType === 'bw' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setItemPrintType('bw')}
                style={{ minHeight: '40px', fontSize: '0.82rem' }}
              >
                Black & White
              </button>
            </div>
          </div>

          {/* Single vs Double Sided */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              SIDES
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`mobile-btn ${itemSides === 'single' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setItemSides('single')}
                style={{ minHeight: '40px', fontSize: '0.82rem' }}
              >
                Single-Sided
              </button>
              <button
                type="button"
                className={`mobile-btn ${itemSides === 'double' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setItemSides('double')}
                style={{ minHeight: '40px', fontSize: '0.82rem' }}
              >
                Double-Sided
              </button>
            </div>
          </div>

          {/* Quantity & Unit Price & GST */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                QTY
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
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                UNIT (₹)
              </label>
              <input
                type="number"
                step="0.01"
                className="mobile-input currency-num"
                placeholder={calculatedUnitPrice.toFixed(2)}
                value={itemUnitPrice}
                onChange={(e) => setItemUnitPrice(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                GST %
              </label>
              <input
                type="number"
                className="mobile-input currency-num"
                placeholder="0%"
                value={itemGstRate}
                onChange={(e) => setItemGstRate(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '6px' }}>
            Add Item to Order
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
