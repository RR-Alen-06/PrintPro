import React, { useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { useAppContext } from '../context/AppContext'
import { Copy, FilePlus, Link2, Plus, Trash2, ClipboardList, FileText, X, CheckCircle, AlertTriangle, Wallet, UserPlus } from 'lucide-react'

const makeInitialRow = (inventory) => ({
  id: `row-${Date.now()}`,
  itemId: inventory[0]?.id || '',
  itemName: inventory[0]?.name || 'A4 Paper',
  isCustom: false,
  printType: 'color',
  sides: 'single',
  qty: 1,
  unitPrice: inventory[0]?.colorSingle ?? 10.0,
  amount: inventory[0]?.colorSingle ?? 10.0,
})

const Billing = () => {
  const { business, customers, inventory, bills, payments, addBill, addCustomer, deleteBill, recordPayment, updateBill } = useAppContext()

  const [customerType, setCustomerType] = useState('regular')
  // For regular: select from dropdown
  const [customerId, setCustomerId] = useState(customers.find((c) => c.type === 'regular' && !c.deleted)?.id || '')
  // For random: 'existing' = pick from walk-in list, 'new' = create new
  const [randomMode, setRandomMode] = useState('existing')
  const [randomCustomerId, setRandomCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  // Advance balance usage
  const [advanceUsed, setAdvanceUsed] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => {
    const next = new Date()
    next.setDate(next.getDate() + 7)
    return next.toISOString().slice(0, 10)
  })
  const [itemRows, setItemRows] = useState(() => [makeInitialRow(inventory)])
  const [discountType, setDiscountType] = useState('flat')
  const [discountValue, setDiscountValue] = useState(0)
  const [cashAmount, setCashAmount] = useState(0)
  const [upiAmount, setUpiAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [paymentMode, setPaymentMode] = useState('partial')
  const [upiCheckoutAmount, setUpiCheckoutAmount] = useState(0)
  const [followUpCash, setFollowUpCash] = useState(0)
  const [followUpUpi, setFollowUpUpi] = useState(0)
  const [selectedBill, setSelectedBill] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState('')
  const [lastBillId, setLastBillId] = useState(null)

  // Post-bill discount state (inside modal)
  const [discountModalType, setDiscountModalType] = useState('flat')
  const [discountModalValue, setDiscountModalValue] = useState(0)
  const [discountApplyMsg, setDiscountApplyMsg] = useState('')

  // Decimal rounding state
  const [showRoundingModal, setShowRoundingModal] = useState(false)
  const [pendingBillPayload, setPendingBillPayload] = useState(null)

  const billRef = useRef(null)

  // ── Derived from live bills state so modal always reflects latest ──────────
  const liveBill = useMemo(() => {
    if (!selectedBill) return null
    return bills.find((b) => b.id === selectedBill.id) || selectedBill
  }, [bills, selectedBill])

  const billPayments = useMemo(() => {
    if (!liveBill) return []
    return payments.filter((p) => p.billId === liveBill.id)
  }, [payments, liveBill])

  const selectedCustomer = useMemo(() => {
    if (customerType === 'regular') return customers.find((c) => c.id === customerId)
    if (customerType === 'random' && randomMode === 'existing') return customers.find((c) => c.id === randomCustomerId)
    return null
  }, [customers, customerId, customerType, randomMode, randomCustomerId])

  const activeRegular = useMemo(() => customers.filter((c) => c.type === 'regular' && !c.deleted), [customers])
  const activeRandom = useMemo(() => customers.filter((c) => c.type === 'random' && !c.deleted), [customers])

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openBillModal = (bill) => {
    setSelectedBill(bill)
    setFollowUpCash(0)
    setFollowUpUpi(0)
    setPaymentSuccess(false)
    setDiscountModalType(bill.discountType || 'flat')
    setDiscountModalValue(bill.discountValue || 0)
    setDiscountApplyMsg('')
    setIsModalOpen(true)
  }

  const closeBillModal = () => {
    setSelectedBill(null)
    setIsModalOpen(false)
    setPaymentSuccess(false)
  }

  // ── UPI helpers ────────────────────────────────────────────────────────────
  const getUpiLink = (amount) => {
    if (!business?.upiId || amount <= 0) return ''
    const params = new URLSearchParams({
      pa: business.upiId,
      pn: business.shopName || 'PrintPro',
      am: amount.toFixed(2),
      cu: 'INR',
      tn: 'Print billing payment',
    })
    return `upi://pay?${params.toString()}`
  }

  const handleGenerateUpiLink = () => {
    setUpiCheckoutAmount(Math.max(netBalance, 0))
  }

  const copyUpiLink = (link) => {
    if (!link) return
    navigator.clipboard.writeText(link)
  }

  // ── Follow-up payment ──────────────────────────────────────────────────────
  const handleRecordFollowUpPayment = () => {
    if (!liveBill) return
    const cash = Number(followUpCash || 0)
    const upi = Number(followUpUpi || 0)
    if (cash + upi <= 0) return

    recordPayment({
      billId: liveBill.id,
      customerId: liveBill.customerId,
      cashAmount: cash,
      upiAmount: upi,
      notes: `Follow-up payment for ${liveBill.id}`,
    })

    setFollowUpCash(0)
    setFollowUpUpi(0)
    setPaymentSuccess(true)
    // Sync selectedBill so the derived liveBill picks up the change next render
    setTimeout(() => setPaymentSuccess(false), 3500)
  }

  // ── Inventory price lookup ─────────────────────────────────────────────────
  const getItemBasePrice = (itemId, printType, sides) => {
    const item = inventory.find((e) => e.id === itemId)
    if (!item) return 0
    if (printType === 'color' && sides === 'single') return item.colorSingle
    if (printType === 'color' && sides === 'double') return item.colorDouble
    if (printType === 'bw' && sides === 'single') return item.bwSingle
    if (printType === 'bw' && sides === 'double') return item.bwDouble
    return 0
  }

  // ── Duplicate-combo detection (Bug 6b) ────────────────────────────────────
  const findDuplicateRow = (rows, itemId, printType, sides, excludeRowId = null) => {
    return rows.find(
      (r) =>
        r.id !== excludeRowId &&
        !r.isCustom &&
        r.itemId === itemId &&
        r.printType === printType &&
        r.sides === sides
    )
  }

  // ── Row update helpers ─────────────────────────────────────────────────────
  const updateRow = (rowId, changes) => {
    setItemRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        const unitPrice = changes.unitPrice !== undefined ? Number(changes.unitPrice) : row.unitPrice
        const qty = changes.qty !== undefined ? Number(changes.qty) : row.qty
        return { ...row, ...changes, unitPrice, qty, amount: unitPrice * qty }
      })
    )
  }

  const updateRowItem = (rowId, updates) => {
    setItemRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        const unitPrice = updates.unitPrice ?? row.unitPrice
        const qty = updates.qty ?? row.qty
        return { ...row, ...updates, unitPrice, qty, amount: unitPrice * qty }
      })
    )
  }

  // When a combo-select changes, check for duplicates and merge if needed
  const handleComboChange = (rowId, changes) => {
    setDuplicateWarning('')
    setItemRows((current) => {
      const targetRow = current.find((r) => r.id === rowId)
      if (!targetRow || targetRow.isCustom) {
        // Just update normally
        return current.map((r) => {
          if (r.id !== rowId) return r
          const unitPrice = changes.unitPrice ?? r.unitPrice
          const qty = r.qty
          return { ...r, ...changes, unitPrice, amount: unitPrice * qty }
        })
      }

      const newItemId = changes.itemId ?? targetRow.itemId
      const newPrintType = changes.printType ?? targetRow.printType
      const newSides = changes.sides ?? targetRow.sides
      const dupRow = current.find(
        (r) =>
          r.id !== rowId &&
          !r.isCustom &&
          r.itemId === newItemId &&
          r.printType === newPrintType &&
          r.sides === newSides
      )

      if (dupRow) {
        // Merge: increment qty on duplicate, remove current row
        setTimeout(() => {
          setDuplicateWarning('Quantity updated for duplicate item.')
          setTimeout(() => setDuplicateWarning(''), 3000)
        }, 0)
        return current
          .filter((r) => r.id !== rowId)
          .map((r) => {
            if (r.id !== dupRow.id) return r
            const qty = r.qty + targetRow.qty
            return { ...r, qty, amount: r.unitPrice * qty }
          })
      }

      // No duplicate — normal update
      const unitPrice =
        changes.unitPrice !== undefined
          ? Number(changes.unitPrice)
          : changes.itemId || changes.printType || changes.sides
          ? getItemBasePrice(newItemId, newPrintType, newSides)
          : targetRow.unitPrice
      const qty = targetRow.qty
      return current.map((r) => {
        if (r.id !== rowId) return r
        return { ...r, ...changes, unitPrice, amount: unitPrice * qty }
      })
    })
  }

  const addRow = () => {
    setDuplicateWarning('')
    // Always add a fresh empty row — user chooses item/type/sides themselves
    // Only merge on explicit combo-change, not on "Add Item" click
    const unitPrice = inventory[0]?.colorSingle || 0
    setItemRows((current) => [
      ...current,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        itemId: inventory[0]?.id || '',
        itemName: inventory[0]?.name || 'Custom Item',
        isCustom: false,
        printType: 'color',
        sides: 'single',
        qty: 1,
        unitPrice,
        amount: unitPrice,
      },
    ])
  }

  const addCustomRow = () => {
    setItemRows((current) => [
      ...current,
      {
        id: `row-${Date.now()}`,
        itemId: '',
        itemName: '',
        isCustom: true,
        printType: 'color',
        sides: 'single',
        qty: 1,
        unitPrice: 0,
        amount: 0,
      },
    ])
  }

  const removeRow = (rowId) => {
    setItemRows((current) => current.filter((r) => r.id !== rowId))
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subtotal = itemRows.reduce((sum, r) => sum + Number(r.amount || 0), 0)
  const discountAmount =
    discountType === 'percent'
      ? (subtotal * Number(discountValue || 0)) / 100
      : Number(discountValue || 0)
  const total = Math.max(subtotal - discountAmount, 0)
  const amountPaid = Number(cashAmount || 0) + Number(upiAmount || 0)
  const customerCredit = Number(selectedCustomer?.creditBalance || 0)
  const customerAdvance = Number(selectedCustomer?.advanceBalance || 0)
  const appliedAdvance = Math.min(Number(advanceUsed || 0), customerAdvance, total)
  const netBalance = Math.max(total - customerCredit - appliedAdvance - amountPaid, 0)
  const finalStatus =
    amountPaid + appliedAdvance + customerCredit >= total ? 'paid'
    : amountPaid + appliedAdvance + customerCredit > 0 ? 'partial'
    : 'unpaid'

  // ── Customer type change ───────────────────────────────────────────────────
  const handleCustomerTypeChange = (type) => {
    setCustomerType(type)
    setAdvanceUsed(0)
    if (type === 'regular') {
      const first = customers.find((c) => c.type === 'regular' && !c.deleted)
      setCustomerId(first?.id || '')
      setRandomCustomerId('')
      setRandomMode('existing')
    } else {
      setCustomerId('')
      setRandomCustomerId(customers.find((c) => c.type === 'random' && !c.deleted)?.id || '')
      setRandomMode('existing')
    }
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (event) => {
    event.preventDefault()
    let customerIdToUse = ''
    let customerNameToUse = ''

    if (customerType === 'regular') {
      if (!customerId) { alert('Please select a regular customer.'); return }
      customerIdToUse = customerId
      customerNameToUse = selectedCustomer?.name || ''
    } else {
      if (randomMode === 'existing') {
        // Use selected existing walk-in customer
        if (!randomCustomerId) { alert('Please select a walk-in customer or choose "New Customer".'); return }
        customerIdToUse = randomCustomerId
        const c = customers.find((x) => x.id === randomCustomerId)
        customerNameToUse = c?.name || 'Walk-in Customer'
      } else {
        // Create brand-new walk-in customer
        if (!customerName.trim()) { alert('Please enter the customer name.'); return }
        customerNameToUse = customerName.trim()
        customerIdToUse = addCustomer({
          type: 'random',
          name: customerNameToUse,
          phone: customerPhone.trim(),
          email: customerEmail.trim(),
          creditBalance: 0,
        })
      }
    }

    const billPayload = {
      customerId: customerIdToUse,
      customerType,
      customerName: customerNameToUse,
      date,
      dueDate,
      subtotal,
      discountType,
      discountValue: Number(discountValue || 0),
      total,
      cashAmount: Number(cashAmount || 0),
      upiAmount: Number(upiAmount || 0),
      amountPaid,
      advanceUsed: appliedAdvance,
      notes,
      paymentMode,
      items: itemRows.map((row) => ({
        itemId: row.itemId,
        itemName: row.itemName,
        printType: row.printType,
        sides: row.sides,
        qty: Number(row.qty),
        unitPrice: Number(row.unitPrice),
        amount: Number(row.amount),
      })),
    }

    // Check for decimal in total — offer rounding
    const decimalPart = total - Math.floor(total)
    if (decimalPart > 0 && decimalPart < 1) {
      setPendingBillPayload(billPayload)
      setShowRoundingModal(true)
      return
    }

    const newBillId = addBill(billPayload)
    setLastBillId(newBillId)
    resetForm()
  }

  const resetForm = () => {
    setCustomerType('regular')
    setCustomerId(customers.find((c) => c.type === 'regular' && !c.deleted)?.id || '')
    setRandomCustomerId('')
    setRandomMode('existing')
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setAdvanceUsed(0)
    setItemRows([makeInitialRow(inventory)])
    setDiscountType('flat')
    setDiscountValue(0)
    setCashAmount(0)
    setUpiAmount(0)
    setNotes('')
    setPaymentMode('partial')
    setDuplicateWarning('')
  }

  const handleRoundingChoice = (roundedTotal) => {
    if (!pendingBillPayload) return
    const diff = pendingBillPayload.total - roundedTotal
    // diff > 0 = rounded down, add as flat discount; diff < 0 = rounded up, ignored (no extra charge)
    const finalPayload = {
      ...pendingBillPayload,
      total: roundedTotal,
      discountValue: Number(pendingBillPayload.discountValue || 0) + Math.max(diff, 0),
      roundingNote: `Rounded ${diff >= 0 ? 'down' : 'up'} from ₹${pendingBillPayload.total.toFixed(2)} to ₹${roundedTotal.toFixed(2)}`,
    }
    setShowRoundingModal(false)
    setPendingBillPayload(null)
    const newBillId = addBill(finalPayload)
    setLastBillId(newBillId)
    resetForm()
  }

  // ── Post-bill discount ────────────────────────────────────────────────────
  const handleApplyPostDiscount = () => {
    if (!liveBill) return
    const dVal = Number(discountModalValue || 0)
    const subtotal = Number(liveBill.subtotal)
    const discountAmt = discountModalType === 'percent' ? (subtotal * dVal) / 100 : dVal
    const newTotal = Math.max(subtotal - discountAmt, 0)
    const newBalance = Math.max(newTotal - Number(liveBill.amountPaid || 0), 0)
    const newStatus = Number(liveBill.amountPaid || 0) >= newTotal ? 'paid' : Number(liveBill.amountPaid || 0) > 0 ? 'partial' : 'unpaid'

    updateBill(liveBill.id, {
      discountType: discountModalType,
      discountValue: dVal,
      total: newTotal,
      balance: newBalance,
      status: newStatus,
    })

    setDiscountApplyMsg('Discount applied successfully!')
    setTimeout(() => setDiscountApplyMsg(''), 3000)
  }

  // ── PDF download (programmatic jsPDF, no html2canvas) ─────────────────────
  const downloadBillPDF = () => {
    if (!liveBill) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    let y = 15

    const line = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2)
    const text = (str, x, yPos, opts) => doc.text(str, x, yPos, opts)

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    text(business?.shopName || 'PrintPro', W / 2, y, { align: 'center' })
    y += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    if (business?.address) { text(business.address, W / 2, y, { align: 'center' }); y += 5 }
    if (business?.gstin) { text(`GSTIN: ${business.gstin}`, W / 2, y, { align: 'center' }); y += 5 }
    if (business?.phone) { text(`Ph: ${business.phone}`, W / 2, y, { align: 'center' }); y += 5 }
    y += 2
    doc.setLineWidth(0.5)
    line(10, y, W - 10, y)
    y += 6

    // Bill info
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    text('TAX INVOICE', W / 2, y, { align: 'center' })
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    text(`Bill ID: ${liveBill.id}`, 10, y)
    text(`Date: ${liveBill.date}`, W - 10, y, { align: 'right' })
    y += 5
    text(`Customer: ${liveBill.customerName}`, 10, y)
    text(`Due: ${liveBill.dueDate}`, W - 10, y, { align: 'right' })
    y += 5
    text(`Status: ${liveBill.status.toUpperCase()}`, 10, y)
    y += 3
    doc.setLineWidth(0.3)
    line(10, y, W - 10, y)
    y += 6

    // Items table header
    const cols = { item: 10, type: 75, sides: 95, qty: 115, unit: 135, amt: 165 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    text('Item', cols.item, y)
    text('Type', cols.type, y)
    text('Sides', cols.sides, y)
    text('Qty', cols.qty, y)
    text('Unit Price', cols.unit, y)
    text('Amount', cols.amt, y)
    y += 2
    line(10, y, W - 10, y)
    y += 5

    // Items
    doc.setFont('helvetica', 'normal')
    liveBill.items.forEach((item) => {
      text(item.itemName || item.name || '-', cols.item, y)
      text(item.printType === 'color' ? 'Color' : 'B/W', cols.type, y)
      text(item.sides === 'single' ? 'Single' : 'Double', cols.sides, y)
      text(String(item.qty), cols.qty, y)
      text(`Rs.${Number(item.unitPrice).toFixed(2)}`, cols.unit, y)
      text(`Rs.${Number(item.amount).toFixed(2)}`, cols.amt, y)
      y += 6
    })
    y += 2
    line(10, y, W - 10, y)
    y += 6

    // Totals
    const right = W - 10
    const labelX = W - 70
    doc.setFontSize(9)
    text('Subtotal:', labelX, y); text(`Rs.${liveBill.subtotal.toFixed(2)}`, right, y, { align: 'right' }); y += 5
    if (liveBill.discountValue > 0) {
      text('Discount:', labelX, y); text(`-Rs.${liveBill.discountValue.toFixed(2)}`, right, y, { align: 'right' }); y += 5
    }
    doc.setFont('helvetica', 'bold')
    text('Total:', labelX, y); text(`Rs.${liveBill.total.toFixed(2)}`, right, y, { align: 'right' }); y += 5
    doc.setFont('helvetica', 'normal')
    text('Amount Paid:', labelX, y); text(`Rs.${liveBill.amountPaid.toFixed(2)}`, right, y, { align: 'right' }); y += 5
    if (liveBill.balance > 0) {
      text('Balance Due:', labelX, y); text(`Rs.${liveBill.balance.toFixed(2)}`, right, y, { align: 'right' }); y += 5
    }
    y += 3
    line(10, y, W - 10, y)
    y += 6

    // Payment breakdown
    doc.setFontSize(8)
    text('Payment Method:', 10, y); y += 5
    text(`  Cash: Rs.${(liveBill.paymentMethod?.cash || 0).toFixed(2)}`, 10, y)
    text(`  UPI: Rs.${(liveBill.paymentMethod?.upi || 0).toFixed(2)}`, 70, y)
    y += 8

    // Footer
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    text('Thank you for your business!', W / 2, y, { align: 'center' })
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    text(`Page 1 of 1`, W / 2, y, { align: 'center' })

    doc.save(`${liveBill.id || 'invoice'}.pdf`)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Billing</h1>
        <p>Create orders with full split payment, discount and credit handling.</p>
      </div>

      {lastBillId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px', marginBottom: '16px',
          background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
        }}>
          <CheckCircle size={16} />
          Bill created successfully! Bill ID: <strong style={{ fontFamily: 'monospace' }}>{lastBillId}</strong>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setLastBillId(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      <form className="card" onSubmit={handleSubmit}>
        <div className="bill-view-header">
          <div>
            <h2>New Print Bill</h2>
            <p className="text-muted">Build the bill, add items, and handle cash/UPI payments.</p>
          </div>
        </div>

        {duplicateWarning && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', marginBottom: '12px',
            background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 'var(--radius-md)', color: 'var(--warning)', fontSize: '0.875rem'
          }}>
            <AlertTriangle size={16} /> {duplicateWarning}
          </div>
        )}

        <div className="grid-2" style={{ gap: '20px' }}>
          {/* Customer Type toggle */}
          <div className="form-group">
            <label className="form-label">Customer Type</label>
            <div className="radio-group">
              <label className={`radio-option ${customerType === 'regular' ? 'selected' : ''}`}>
                <input type="radio" name="customerType" value="regular" checked={customerType === 'regular'} onChange={() => handleCustomerTypeChange('regular')} />
                Regular
              </label>
              <label className={`radio-option ${customerType === 'random' ? 'selected' : ''}`}>
                <input type="radio" name="customerType" value="random" checked={customerType === 'random'} onChange={() => handleCustomerTypeChange('random')} />
                Walk-in / Random
              </label>
            </div>
          </div>

          {/* Customer selector */}
          <div className="form-group">
            <label className="form-label">Customer</label>

            {customerType === 'regular' ? (
              /* ── Regular: grouped dropdown of all regular customers ── */
              <select
                className="form-select"
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); setAdvanceUsed(0) }}
              >
                <option value="">-- Select regular customer --</option>
                {activeRegular.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id}){Number(c.advanceBalance || 0) > 0 ? ` · Adv ₹${Number(c.advanceBalance).toFixed(2)}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              /* ── Random: pick existing walk-in OR create new ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="radio-group">
                  <label className={`radio-option ${randomMode === 'existing' ? 'selected' : ''}`}>
                    <input type="radio" checked={randomMode === 'existing'} onChange={() => { setRandomMode('existing'); setCustomerName(''); setCustomerPhone(''); setCustomerEmail('') }} />
                    Existing Walk-in
                  </label>
                  <label className={`radio-option ${randomMode === 'new' ? 'selected' : ''}`}>
                    <input type="radio" checked={randomMode === 'new'} onChange={() => { setRandomMode('new'); setRandomCustomerId('') }} />
                    <UserPlus size={13} /> New Customer
                  </label>
                </div>

                {randomMode === 'existing' ? (
                  <select
                    className="form-select"
                    value={randomCustomerId}
                    onChange={(e) => { setRandomCustomerId(e.target.value); setAdvanceUsed(0) }}
                  >
                    <option value="">-- Select walk-in customer --</option>
                    {activeRandom.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id}){c.phone ? ` · ${c.phone}` : ''}{Number(c.advanceBalance || 0) > 0 ? ` · Adv ₹${Number(c.advanceBalance).toFixed(2)}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Customer name *"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="tel"
                      placeholder="Phone number (optional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="email"
                      placeholder="Email (optional)"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                      Will be saved as a new walk-in customer with a unique ID.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Advance balance info for selected customer */}
            {selectedCustomer && Number(selectedCustomer.advanceBalance || 0) > 0 && (
              <div style={{
                marginTop: '10px', padding: '10px 14px',
                background: 'var(--info-bg)', border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--info)' }}>
                  <Wallet size={14} /> Advance Balance: <strong>₹{Number(selectedCustomer.advanceBalance).toFixed(2)}</strong>
                </div>
                <label className="form-label" style={{ marginBottom: '4px' }}>Apply Advance (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max={Math.min(Number(selectedCustomer.advanceBalance), total)}
                  step="0.01"
                  value={advanceUsed}
                  onChange={(e) => setAdvanceUsed(Math.min(Number(e.target.value), Number(selectedCustomer.advanceBalance), total))}
                  placeholder="0.00"
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdvanceUsed(Math.min(Number(selectedCustomer.advanceBalance), total))}>
                    Use Full Advance
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdvanceUsed(0)}>
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Bill Date</label>
            <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {/* Items table */}
        <div style={{ marginTop: '24px' }}>
          <div className="bill-view-header">
            <h3>Print Items</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Print Type</th>
                  <th>Sides</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.isCustom ? (
                        <input
                          className="form-input"
                          type="text"
                          placeholder="Item name"
                          value={row.itemName}
                          onChange={(e) => updateRow(row.id, { itemName: e.target.value })}
                        />
                      ) : (
                        <select
                          className="form-select"
                          value={row.itemId}
                          onChange={(e) => {
                            const itemId = e.target.value
                            const selected = inventory.find((item) => item.id === itemId)
                            handleComboChange(row.id, {
                              itemId,
                              itemName: selected?.name || row.itemName,
                              unitPrice: getItemBasePrice(itemId, row.printType, row.sides),
                            })
                          }}
                        >
                          {inventory.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={row.printType}
                        onChange={(e) => {
                          const printType = e.target.value
                          if (row.isCustom) {
                            updateRow(row.id, { printType })
                          } else {
                            handleComboChange(row.id, {
                              printType,
                              unitPrice: getItemBasePrice(row.itemId, printType, row.sides),
                            })
                          }
                        }}
                      >
                        <option value="color">Color</option>
                        <option value="bw">B/W</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={row.sides}
                        onChange={(e) => {
                          const sides = e.target.value
                          if (row.isCustom) {
                            updateRow(row.id, { sides })
                          } else {
                            handleComboChange(row.id, {
                              sides,
                              unitPrice: getItemBasePrice(row.itemId, row.printType, sides),
                            })
                          }
                        }}
                      >
                        <option value="single">Single</option>
                        <option value="double">Double</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unitPrice}
                        onChange={(e) => updateRow(row.id, { unitPrice: e.target.value })}
                      />
                    </td>
                    <td>₹{Number(row.amount).toFixed(2)}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(row.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Add item buttons — below the table */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={addRow}>
              <Plus size={14} /> Add Item
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomRow}>
              <Plus size={14} /> Custom Item
            </button>
          </div>
        </div>

        {/* Discount & Notes */}
        <div className="grid-2" style={{ marginTop: '24px', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Discount</label>
            <div className="form-inline">
              <select className="form-select" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="flat">Flat (₹)</option>
                <option value="percent">Percent (%)</option>
              </select>
              <input className="form-input" type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Job notes or print remarks" />
          </div>
        </div>

        {/* Payment & Summary */}
        <div className="grid-2" style={{ marginTop: '24px', gap: '20px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <h3>Payment</h3>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <div className="radio-group">
                <label className={`radio-option ${paymentMode === 'partial' ? 'selected' : ''}`}>
                  <input type="radio" value="partial" checked={paymentMode === 'partial'} onChange={() => setPaymentMode('partial')} />
                  Partial
                </label>
                <label className={`radio-option ${paymentMode === 'full' ? 'selected' : ''}`}>
                  <input type="radio" value="full" checked={paymentMode === 'full'} onChange={() => setPaymentMode('full')} />
                  Full
                </label>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Cash Amount</label>
              <input className="form-input" type="number" min="0" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">UPI Amount</label>
              <input className="form-input" type="number" min="0" value={upiAmount} onChange={(e) => setUpiAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">UPI Checkout</label>
              <div className="form-inline" style={{ gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleGenerateUpiLink}>
                  <Link2 size={14} /> Generate UPI link
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!upiCheckoutAmount || !business?.upiId}
                  onClick={() => copyUpiLink(getUpiLink(upiCheckoutAmount))}
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
              {business?.upiId ? (
                <p className="text-muted" style={{ marginTop: '6px' }}>UPI ID: {business.upiId} · Amount: ₹{upiCheckoutAmount.toFixed(2)}</p>
              ) : (
                <p className="text-muted" style={{ marginTop: '6px' }}>Set your UPI ID in Settings.</p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Credit Balance Available</label>
              <div className="stat-card-value">₹{customerCredit.toFixed(2)}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <h3>Summary</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Subtotal</label>
                <div className="stat-card-value">₹{subtotal.toFixed(2)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Discount</label>
                <div className="stat-card-value">₹{discountAmount.toFixed(2)}</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Total</label>
                <div className="stat-card-value">₹{total.toFixed(2)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Cash + UPI Paid</label>
                <div className="stat-card-value">₹{amountPaid.toFixed(2)}</div>
              </div>
            </div>
            {appliedAdvance > 0 && (
              <div className="form-group">
                <label className="form-label">Advance Used</label>
                <div className="stat-card-value" style={{ color: 'var(--info)' }}>₹{appliedAdvance.toFixed(2)}</div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Balance Remaining</label>
              <div className="stat-card-value" style={{ color: netBalance > 0 ? 'var(--error)' : 'var(--success)' }}>₹{netBalance.toFixed(2)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <span className={`badge badge-${finalStatus === 'paid' ? 'paid' : finalStatus === 'partial' ? 'partial' : 'unpaid'}`}>
                {finalStatus}
              </span>
            </div>
            {amountPaid > total && (
              <p className="form-error">Overpayment will be stored as advance credit.</p>
            )}
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '24px' }}>
          <FilePlus size={16} /> Generate Bill
        </button>
      </form>

      {/* Recent Bills Table */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="bill-view-header">
          <h2>Recent Billing Activity</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.filter((b) => !b.deleted).map((bill) => (
                <tr key={bill.id}>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem' }}>{bill.id}</div>
                    <span className={`badge ${bill.customerType === 'regular' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.6rem', marginTop: '2px' }}>
                      {bill.customerType === 'regular' ? 'Regular' : 'Walk-in'}
                    </span>
                  </td>
                  <td>{bill.customerName}</td>
                  <td>₹{bill.total.toFixed(2)}</td>
                  <td>₹{bill.amountPaid.toFixed(2)}</td>
                  <td style={{ color: bill.balance > 0 ? 'var(--warning)' : 'inherit' }}>₹{bill.balance.toFixed(2)}</td>
                  <td>
                    <span className={`badge badge-${bill.status === 'paid' ? 'paid' : bill.status === 'partial' ? 'partial' : 'unpaid'}`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => openBillModal(bill)}>
                      <ClipboardList size={14} /> View
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        if (window.confirm(`Delete bill ${bill.id}? It will be moved to Deleted Bills.`)) {
                          deleteBill(bill.id)
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Detail Modal */}
      {isModalOpen && liveBill && (
        <div className="modal-overlay" onClick={closeBillModal}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div>
                <h3>Bill Details</h3>
                <p className="text-muted">{liveBill.id} — {liveBill.customerName}</p>
              </div>
              <button className="modal-close btn-icon" type="button" onClick={closeBillModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" ref={billRef}>
              {/* Bill header */}
              <div className="bill-view-header" style={{ marginBottom: '16px' }}>
                <div>
                  <div className="bill-view-id" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {liveBill.customerType === 'regular' ? liveBill.customerId : 'Random Customer'}
                  </div>
                  <h4>{liveBill.customerName}</h4>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                  <p>Date: {liveBill.date}</p>
                  <p>Due: {liveBill.dueDate}</p>
                  <p>Status: <span className={`badge badge-${liveBill.status === 'paid' ? 'paid' : liveBill.status === 'partial' ? 'partial' : 'unpaid'}`}>{liveBill.status}</span></p>
                </div>
              </div>

              {/* Items */}
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Sides</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveBill.items.map((item, idx) => (
                      <tr key={`${liveBill.id}-${idx}`}>
                        <td>{item.itemName || item.name}</td>
                        <td>{item.printType === 'color' ? 'Color' : 'B/W'}</td>
                        <td>{item.sides === 'single' ? 'Single' : 'Double'}</td>
                        <td>{item.qty}</td>
                        <td>₹{Number(item.unitPrice).toFixed(2)}</td>
                        <td>₹{Number(item.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary + Payments */}
              <div className="grid-2" style={{ gap: '20px', marginTop: '20px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <h4>Summary</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Subtotal</label>
                      <div className="stat-card-value">₹{liveBill.subtotal.toFixed(2)}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Discount</label>
                      <div className="stat-card-value">₹{Number(liveBill.discountValue).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Total</label>
                      <div className="stat-card-value">₹{liveBill.total.toFixed(2)}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount Paid</label>
                      <div className="stat-card-value">₹{liveBill.amountPaid.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Balance</label>
                    <div className="stat-card-value" style={{ color: liveBill.balance > 0 ? 'var(--error)' : 'var(--success)' }}>
                      ₹{liveBill.balance.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <h4>Payment Methods</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Cash</label>
                      <div className="stat-card-value">₹{(liveBill.paymentMethod?.cash || 0).toFixed(2)}</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">UPI</label>
                      <div className="stat-card-value">₹{(liveBill.paymentMethod?.upi || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Used</label>
                    <div className="stat-card-value">₹{(liveBill.creditUsed || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div className="card" style={{ marginTop: '20px', padding: '20px' }}>
                <h4>Payment History</h4>
                {billPayments.length > 0 ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Cash</th>
                        <th>UPI</th>
                        <th>Total</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{new Date(payment.date).toLocaleDateString()}</td>
                          <td>₹{Number(payment.cashAmount || 0).toFixed(2)}</td>
                          <td>₹{Number(payment.upiAmount || 0).toFixed(2)}</td>
                          <td>₹{Number(payment.totalPaid || 0).toFixed(2)}</td>
                          <td>{payment.paymentType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted">No payment history yet.</p>
                )}
              </div>

              {/* Apply Post-bill Discount */}
              <div className="card" style={{ marginTop: '20px', padding: '20px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag size={16} /> Apply Discount
                </h4>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
                  Update discount on this bill after creation. Total, balance, and status will be recalculated.
                </p>
                {discountApplyMsg && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', marginBottom: '12px',
                    background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
                  }}>
                    <CheckCircle size={16} /> {discountApplyMsg}
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Discount Type</label>
                    <select
                      className="form-select"
                      value={discountModalType}
                      onChange={(e) => setDiscountModalType(e.target.value)}
                    >
                      <option value="flat">Flat (₹)</option>
                      <option value="percent">Percent (%)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount Value</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountModalValue}
                      onChange={(e) => setDiscountModalValue(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Subtotal: ₹{liveBill.subtotal.toFixed(2)} → New Total: ₹{Math.max(
                    liveBill.subtotal - (discountModalType === 'percent'
                      ? (liveBill.subtotal * Number(discountModalValue || 0)) / 100
                      : Number(discountModalValue || 0)), 0
                  ).toFixed(2)}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleApplyPostDiscount}
                >
                  <Percent size={16} /> Apply Discount
                </button>
              </div>

              {/* Follow-up Payment */}
              <div className="card" style={{ marginTop: '20px', padding: '20px' }}>
                <h4>Record Follow-up Payment</h4>

                {/* Balance summary */}
                <div style={{
                  display: 'flex', gap: '20px', flexWrap: 'wrap',
                  padding: '12px 16px', marginBottom: '16px',
                  background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)'
                }}>
                  <div>
                    <div className="form-label" style={{ marginBottom: '2px' }}>Current Balance</div>
                    <div style={{ fontWeight: 700, color: liveBill.balance > 0 ? 'var(--error)' : 'var(--success)', fontSize: '1.1rem' }}>
                      ₹{liveBill.balance.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="form-label" style={{ marginBottom: '2px' }}>Paying Now</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                      ₹{(Number(followUpCash || 0) + Number(followUpUpi || 0)).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="form-label" style={{ marginBottom: '2px' }}>Balance After</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>
                      ₹{Math.max(liveBill.balance - (Number(followUpCash || 0) + Number(followUpUpi || 0)), 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {paymentSuccess && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', marginBottom: '12px',
                    background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
                  }}>
                    <CheckCircle size={16} /> Payment recorded successfully!
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Follow-up Cash (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={followUpCash}
                      onChange={(e) => setFollowUpCash(e.target.value)}
                      disabled={liveBill.balance <= 0}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-up UPI (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={followUpUpi}
                      onChange={(e) => setFollowUpUpi(e.target.value)}
                      disabled={liveBill.balance <= 0}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRecordFollowUpPayment}
                  disabled={
                    liveBill.balance <= 0 ||
                    Number(followUpCash || 0) + Number(followUpUpi || 0) <= 0
                  }
                >
                  <CheckCircle size={16} />
                  {liveBill.balance <= 0 ? 'Balance is Settled' : 'Record Payment'}
                </button>

                {liveBill.balance <= 0 && (
                  <p className="text-muted" style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                    This bill is fully paid.
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={downloadBillPDF}>
                <FileText size={16} /> Download PDF
              </button>
              <button type="button" className="btn btn-ghost" onClick={closeBillModal}>
                <X size={16} /> Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Decimal Rounding Modal ─────────────────────────────────────── */}
      {showRoundingModal && pendingBillPayload && (
        <div className="modal-overlay" onClick={() => { setShowRoundingModal(false); setPendingBillPayload(null) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Round Bill Total?</h3>
              <button className="modal-close btn-icon" type="button"
                onClick={() => { setShowRoundingModal(false); setPendingBillPayload(null) }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                The bill total is <strong style={{ color: 'var(--accent)' }}>
                  ₹{pendingBillPayload.total.toFixed(2)}
                </strong>. Would you like to round it?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flexDirection: 'column', height: '72px', gap: '4px' }}
                  onClick={() => handleRoundingChoice(Math.floor(pendingBillPayload.total))}
                >
                  <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    ₹{Math.floor(pendingBillPayload.total)}
                  </span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Round Down</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flexDirection: 'column', height: '72px', gap: '4px' }}
                  onClick={() => handleRoundingChoice(Math.ceil(pendingBillPayload.total))}
                >
                  <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    ₹{Math.ceil(pendingBillPayload.total)}
                  </span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Round Up</span>
                </button>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: '0.82rem' }}
                onClick={() => handleRoundingChoice(pendingBillPayload.total)}
              >
                Keep exact amount ₹{pendingBillPayload.total.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Billing
