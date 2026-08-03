import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  UserCheck, Plus, Trash2, ChevronRight, ChevronLeft, Check, Search,
  Tag, Percent, Wallet, FileText, UserPlus, AlertCircle, Printer, Calendar,
  Gift, Award, Clock, Sparkles
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileCreateBill() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editBillId = searchParams.get('edit')

  const {
    customers, inventory, bills, addBill, editBill, addCustomer, promoCodes, settings, showToast
  } = useAppContext()

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
  const [selectedInventoryId, setSelectedInventoryId] = useState(inventory[0]?.id || '')
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

  // Load Portal Orders from localStorage
  useEffect(() => {
    const orders = JSON.parse(localStorage.getItem('portal_orders') || '[]')
    setPortalOrders(orders.filter(o => o.status !== 'completed'))
  }, [])

  // If in Edit Mode, populate existing bill data
  useEffect(() => {
    if (editBillId) {
      const existing = (bills || []).find(b => String(b.id) === String(editBillId))
      if (existing) {
        setSelectedCustomerId(existing.customerId)
        setItemRows(existing.items || [])
        setDiscountValue(existing.discount || 0)
        setNotes(existing.notes || '')
        setBillDate(existing.date || new Date().toISOString().slice(0, 10))
        setDueDate(existing.dueDate || new Date().toISOString().slice(0, 10))
        showToast(`Editing Bill #${existing.invoiceNumber || existing.id}`, 'info')
      }
    }
  }, [editBillId, bills])

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return (customers || []).filter(c => {
      if (c.deleted) return false
      if (customerType === 'regular' && c.type !== 'regular') return false
      if (customerType === 'random' && c.type !== 'random') return false
      if (customerSearch.trim()) {
        const q = customerSearch.toLowerCase().trim()
        return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
      }
      return true
    })
  }, [customers, customerType, customerSearch])

  // Current selected customer object
  const selectedCustomerObj = useMemo(() => {
    return (customers || []).find(c => String(c.id) === String(selectedCustomerId))
  }, [customers, selectedCustomerId])

  // Calculation helpers for Step 2 unit price
  const activeInventoryObj = useMemo(() => {
    return (inventory || []).find(i => String(i.id) === String(selectedInventoryId))
  }, [inventory, selectedInventoryId])

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
      isCustom: isCustomItem,
      printType: itemPrintType,
      sides: itemSides,
      qty: qtyNum,
      pages: pagesNum,
      unitPrice: rate,
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

  // Load Portal Order into Wizard
  const handleLoadPortalOrder = (order) => {
    setCustomerType('random')
    setNewCustName(order.customerName)
    setNewCustPhone(order.customerPhone || '')

    const newRows = (order.files || []).map((file, index) => {
      const unitPrice = file.config.printType === 'color'
        ? (file.config.sides === 'double' ? 15 : 10)
        : (file.config.sides === 'double' ? 3 : 2)

      return {
        id: `portal-row-${Date.now()}-${index}`,
        itemId: '',
        itemName: `${file.name}`,
        isCustom: true,
        printType: file.config.printType || 'color',
        sides: file.config.sides || 'single',
        qty: file.config.copies || 1,
        pages: 1,
        unitPrice,
        gstRate: 0,
        amount: unitPrice * (file.config.copies || 1)
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

  // Loyalty Discount Calculation
  const loyaltyDiscount = useMemo(() => {
    if (!shouldRedeemLoyalty || !selectedCustomerObj) return 0
    const points = Number(loyaltyPointsRedeemed || 0)
    const ratioPoints = settings.loyaltyRedeemRatioPoints || 150
    const ratioRupees = settings.loyaltyRedeemRatioRupees || 5
    if (points <= 0 || ratioPoints <= 0) return 0
    return Math.min((points / ratioPoints) * ratioRupees, subtotal)
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

  // Advance Credit Deduction
  const advanceDeduction = useMemo(() => {
    if (!useAdvanceCredit || !selectedCustomerObj) return 0
    const credit = Number(selectedCustomerObj.creditBalance || 0)
    return Math.min(credit, Math.max(0, subtotal - calculatedDiscount))
  }, [useAdvanceCredit, selectedCustomerObj, subtotal, calculatedDiscount])

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - calculatedDiscount - advanceDeduction)
  }, [subtotal, calculatedDiscount, advanceDeduction])

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

      const billPayload = {
        id: editBillId || `BILL-${Date.now()}`,
        invoiceNumber: editBillId ? ((bills.find(b => String(b.id) === String(editBillId)))?.invoiceNumber) : `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        date: billDate,
        dueDate: dueDate,
        estimatedCompletion,
        customerId: selectedCustomerId,
        customerName: selectedCustomerObj?.name || 'Walk-in Customer',
        customerPhone: selectedCustomerObj?.phone || '',
        items: itemRows,
        subtotal,
        discount: calculatedDiscount,
        advanceDeducted: advanceDeduction,
        total: grandTotal,
        cashAmount: finalCash,
        upiAmount: finalUpi,
        totalPaid: finalCash + finalUpi,
        balance: Math.max(0, grandTotal - (finalCash + finalUpi)),
        status: finalStatus,
        notes,
        createdAt: new Date().toISOString()
      }

      if (editBillId && editBill) {
        await editBill(billPayload)
        showToast(`Bill #${billPayload.invoiceNumber} updated successfully!`, 'success')
      } else if (addBill) {
        await addBill(billPayload)
        showToast(`Bill #${billPayload.invoiceNumber} created successfully!`, 'success')
      }

      navigate(`/mobile/bill/${billPayload.id}`)
    } catch (e) {
      showToast('Failed to save bill', 'error')
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

          {/* Dates Config Card */}
          <div className="mobile-card" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>INVOICE DATE</label>
                <input
                  type="date"
                  className="mobile-input"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>DUE DATE</label>
                <input
                  type="date"
                  className="mobile-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Customer List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '42vh', overflowY: 'auto', marginBottom: '20px' }}>
            {filteredCustomers.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No customers found matching filter.
              </div>
            ) : (
              filteredCustomers.map(c => {
                const isSelected = String(c.id) === String(selectedCustomerId)
                return (
                  <div
                    key={c.id}
                    className="mobile-card"
                    onClick={() => setSelectedCustomerId(c.id)}
                    style={{
                      cursor: 'pointer',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-light)',
                      background: isSelected ? 'rgba(255, 47, 176, 0.12)' : 'var(--bg-card)',
                      boxShadow: isSelected ? '0 0 10px rgba(255, 47, 176, 0.3)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Phone: {c.phone || 'N/A'} • Credit Balance: <strong className="currency-num" style={{ color: 'var(--success)' }}>₹{Number(c.creditBalance || 0).toFixed(2)}</strong>
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{ padding: '6px', background: 'var(--accent-primary)', borderRadius: '50%', color: '#fff' }}>
                          <Check size={16} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <button
            className="mobile-btn mobile-btn-primary"
            disabled={!selectedCustomerId}
            onClick={() => setStep(2)}
          >
            NEXT: ADD PRINT ITEMS <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 2: PRINT ITEM SELECTION */}
      {step === 2 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                ORDER PRINT ITEMS
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--accent-secondary)' }}>
                Client: {selectedCustomerObj?.name || 'Selected Customer'}
              </div>
            </div>
            <button
              className="mobile-btn mobile-btn-primary"
              onClick={() => setShowAddItemSheet(true)}
              style={{ minHeight: '38px', padding: '0 14px', fontSize: '0.8rem', width: 'auto' }}
            >
              + Add Item
            </button>
          </div>

          {/* Added Items List */}
          {itemRows.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              <Printer size={36} style={{ marginBottom: '8px', color: 'var(--accent-primary)', opacity: 0.6 }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No print items added to this order yet.</p>
              <button
                className="mobile-btn mobile-btn-secondary"
                onClick={() => setShowAddItemSheet(true)}
                style={{ marginTop: '12px', width: 'auto', display: 'inline-flex' }}
              >
                + Add First Print Item
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {itemRows.map((r) => (
                <div key={r.id} className="mobile-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {r.itemName}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span className="mobile-badge mobile-badge-info" style={{ fontSize: '0.65rem' }}>
                          {r.printType.toUpperCase()}
                        </span>
                        <span className="mobile-badge mobile-badge-warning" style={{ fontSize: '0.65rem' }}>
                          {r.sides.toUpperCase()}
                        </span>
                        {Number(r.gstRate || 0) > 0 && (
                          <span className="mobile-badge" style={{ fontSize: '0.65rem', background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-tertiary)' }}>
                            GST {r.gstRate}%
                          </span>
                        )}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                          {r.qty} Qty × ₹{r.unitPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="currency-num" style={{ fontSize: '1.05rem', color: 'var(--accent-primary)' }}>
                        ₹{r.amount.toFixed(2)}
                      </div>
                      <button
                        onClick={() => handleRemoveItem(r.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', marginTop: '6px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subtotal Display */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: '20px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>SUBTOTAL ({itemRows.length} items)</span>
            <span className="currency-num" style={{ fontSize: '1.25rem', color: '#ffffff' }}>₹{subtotal.toFixed(2)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button className="mobile-btn mobile-btn-secondary" onClick={() => setStep(1)}>
              <ChevronLeft size={18} /> Back
            </button>
            <button
              className="mobile-btn mobile-btn-primary"
              disabled={itemRows.length === 0}
              onClick={() => setStep(3)}
            >
              NEXT: PAYMENT <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PAYMENT & CONFIRMATION */}
      {step === 3 && (
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 14px 0', color: 'var(--text-primary)' }}>
            PAYMENT SUMMARY & SAVE
          </h3>

          {/* Customer Advance Credit Usage */}
          {Number(selectedCustomerObj?.creditBalance || 0) > 0 && (
            <div className="mobile-card" style={{ borderColor: 'var(--success)', marginBottom: '14px', background: 'rgba(0, 255, 171, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--success)' }}>
                    Customer Advance Credit Available
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Available Credit: <strong className="currency-num">₹{Number(selectedCustomerObj.creditBalance).toFixed(2)}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUseAdvanceCredit(!useAdvanceCredit)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: useAdvanceCredit ? 'var(--success)' : 'var(--bg-input)',
                    color: useAdvanceCredit ? '#000' : 'var(--text-primary)',
                    border: '1px solid var(--success)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  {useAdvanceCredit ? '✓ Credit Applied' : '+ Use Credit'}
                </button>
              </div>
            </div>
          )}

          {/* Loyalty Points Redemption */}
          {settings.loyaltyEnabled !== false && (
            <div className="mobile-card" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={18} style={{ color: 'var(--accent-secondary)' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Customer Loyalty Points</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShouldRedeemLoyalty(!shouldRedeemLoyalty)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {shouldRedeemLoyalty ? 'Cancel Redemption' : '+ Redeem Points'}
                </button>
              </div>

              {shouldRedeemLoyalty && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input
                    type="number"
                    className="mobile-input currency-num"
                    placeholder="Enter Points (e.g. 150)"
                    value={loyaltyPointsRedeemed}
                    onChange={(e) => setLoyaltyPointsRedeemed(e.target.value)}
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center' }} className="currency-num">
                    = ₹{loyaltyDiscount.toFixed(2)} OFF
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Promo Code Card */}
          <div className="mobile-card" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-secondary)', marginBottom: '6px' }}>
              APPLY PROMO CODE / COUPON
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="mobile-input"
                placeholder="STUDENT10, BULK50..."
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
              />
              <button
                type="button"
                className="mobile-btn mobile-btn-secondary"
                onClick={handleApplyPromo}
                style={{ width: 'auto', padding: '0 16px', fontSize: '0.82rem' }}
              >
                Apply
              </button>
            </div>
            {appliedPromo && (
              <div style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: '6px' }}>
                ✓ Coupon '{appliedPromo.code}' Applied ({appliedPromo.type === 'percent' ? `${appliedPromo.value}% OFF` : `₹${appliedPromo.value} OFF`})
              </div>
            )}
          </div>

          {/* Payment Mode Selector */}
          <div className="mobile-card" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              PAYMENT METHOD
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                className={`mobile-btn ${paymentMode === 'full_cash' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setPaymentMode('full_cash')}
                style={{ minHeight: '42px', fontSize: '0.82rem' }}
              >
                Full Cash
              </button>
              <button
                type="button"
                className={`mobile-btn ${paymentMode === 'full_upi' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setPaymentMode('full_upi')}
                style={{ minHeight: '42px', fontSize: '0.82rem' }}
              >
                Full UPI
              </button>
              <button
                type="button"
                className={`mobile-btn ${paymentMode === 'split' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setPaymentMode('split')}
                style={{ minHeight: '42px', fontSize: '0.82rem' }}
              >
                Split (Cash+UPI)
              </button>
              <button
                type="button"
                className={`mobile-btn ${paymentMode === 'credit' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setPaymentMode('credit')}
                style={{ minHeight: '42px', fontSize: '0.82rem' }}
              >
                Full Credit / Due
              </button>
            </div>

            {paymentMode === 'split' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>CASH (INR)</label>
                  <input
                    type="number"
                    className="mobile-input currency-num"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>UPI (INR)</label>
                  <input
                    type="number"
                    className="mobile-input currency-num"
                    value={upiAmount}
                    onChange={(e) => setUpiAmount(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Final Financial Totals Summary Card */}
          <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span>Subtotal</span>
              <span className="currency-num">₹{subtotal.toFixed(2)}</span>
            </div>
            {calculatedDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--accent-primary)', marginBottom: '6px' }}>
                <span>Total Discount</span>
                <span className="currency-num">-₹{calculatedDiscount.toFixed(2)}</span>
              </div>
            )}
            {advanceDeduction > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--success)', marginBottom: '6px' }}>
                <span>Advance Credit Applied</span>
                <span className="currency-num">-₹{advanceDeduction.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
              <span>FINAL TOTAL</span>
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
              disabled={isSubmitting}
              onClick={handleFinalizeBillSubmit}
            >
              {editBillId ? 'SAVE UPDATED BILL' : 'CONFIRM & SAVE BILL'}
            </button>
          </div>
        </div>
      )}

      {/* Online Customer Portal Orders Modal Drawer */}
      <BottomSheet
        isOpen={showPortalOrdersModal}
        onClose={() => setShowPortalOrdersModal(false)}
        title="Import Customer Portal Orders"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {portalOrders.map(order => (
            <div key={order.id} className="mobile-card" style={{ background: 'var(--bg-input)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{order.customerName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{order.customerPhone || 'Online Upload'} • {order.files?.length || 0} File(s)</div>
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
                {(inventory || []).map(i => (
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
