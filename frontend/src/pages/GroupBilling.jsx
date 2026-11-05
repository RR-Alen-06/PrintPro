import React, { useState, useMemo } from 'react'
import {
  Users, Plus, Trash2, CheckCircle, Wallet, X,
  ArrowLeftRight, Printer, Download, MessageCircle, FileText, Search,
  Layers, Eye, Ban, Sliders, Clock
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useAppContext } from '../context/AppContext'
import {
  getDisplayBillId, getDisplayCustomerId, getDisplayGroupId,
  getDisplayPaymentId, getDisplaySplitPurchaseId
} from '../utils/idFormatter'

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeItemRow = (inventory = []) => {
  const hasInv = inventory && inventory.length > 0
  const first = hasInv ? inventory[0] : null
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    itemId: first?.id || '',
    itemName: first?.name || '',
    printType: 'color',
    sides: 'single',
    qty: 1,
    unitPrice: first ? getItemBasePrice(inventory, first.id, 'color', 'single') : 0,
    amount: first ? getItemBasePrice(inventory, first.id, 'color', 'single') : 0,
    gstRate: 0,
    isCustom: false,
  }
}

const makeCustomRow = () => ({
  id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  itemId: '',
  itemName: '',
  printType: 'color',
  sides: 'single',
  qty: 1,
  unitPrice: 0,
  amount: 0,
  gstRate: 0,
  isCustom: true,
})

const getItemBasePrice = (inventory, itemId, printType, sides) => {
  const item = inventory.find((e) => e.id === itemId)
  if (!item) return 0
  const itemType = item.item_type || 'paper'
  if (itemType !== 'paper') {
    return Number(item.unit_price || 0)
  }
  const key = `${printType}_${sides}`
  if (item.pricing_tiers && item.pricing_tiers[key] !== undefined) {
    return Number(item.pricing_tiers[key])
  }
  return Number(item.unit_price || 0)
}

// Deterministic rounding allocator: allocates total rupees among weights/shares
// and assigns any remaining fractional paise to the first member so sum strictly matches.
function allocateWithDeterministicRounding(total, shares) {
  const cleanTotal = Number(total || 0)
  if (cleanTotal <= 0) return shares.map(() => 0)
  const sumShares = shares.reduce((s, v) => s + Math.max(0, Number(v) || 0), 0)
  const totalPaise = Math.round(cleanTotal * 100)
  const n = Math.max(shares.length, 1)

  if (sumShares <= 0) {
    const basePaise = Math.floor(totalPaise / n)
    const remPaise = totalPaise - (basePaise * n)
    return shares.map((_, i) => Number(((basePaise + (i === 0 ? remPaise : 0)) / 100).toFixed(2)))
  }

  let allocatedPaise = 0
  const resultPaise = shares.map((v) => {
    const rawRatio = Math.max(0, Number(v) || 0) / sumShares
    const p = Math.floor(rawRatio * totalPaise)
    allocatedPaise += p
    return p
  })
  const leftover = totalPaise - allocatedPaise
  if (resultPaise.length > 0 && leftover > 0) {
    resultPaise[0] += leftover
  }
  return resultPaise.map((p) => Number((p / 100).toFixed(2)))
}

// ── Quick Add Panel ──────────────────────────────────────────────────────────
const QuickAddPanel = ({ inventory, rows, setRows }) => {
  if (!inventory || inventory.length === 0) return null

  const handleQuickAdd = (itemId, itemName, printType, sides, price) => {
    setRows((cur) => {
      const existing = cur.find(
        (r) => !r.isCustom && r.itemId === itemId && r.printType === printType && r.sides === sides
      )
      if (existing) {
        return cur.map((r) =>
          r.id === existing.id
            ? { ...r, qty: r.qty + 1, amount: Number(((r.qty + 1) * r.unitPrice).toFixed(2)) }
            : r
        )
      }
      return [
        ...cur,
        {
          id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          itemId,
          itemName,
          printType,
          sides,
          qty: 1,
          unitPrice: price,
          amount: price,
          gstRate: 0,
          isCustom: false,
        },
      ]
    })
  }

  return (
    <div style={{ marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
      <div style={{ fontSize: '11px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 600 }}>
        Quick Add Common Items
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {inventory.slice(0, 8).map((item) => {
          const type = item.item_type || 'paper'
          if (type !== 'paper') {
            const price = Number(item.unit_price || 0)
            const label = `${item.name}${item.unit ? ` (${item.unit})` : ''}`
            const existing = rows?.find((r) => !r.isCustom && r.itemId === item.id)
            return (
              <button
                key={item.id}
                type="button"
                className={`btn btn-sm ${existing ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => handleQuickAdd(item.id, item.name, 'color', 'single', price)}
              >
                <span>{label}</span>
                <span style={{ opacity: 0.7, fontSize: '11px' }}>₹{price.toFixed(2)}</span>
                {existing && (
                  <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '0 5px', fontSize: '10px' }}>
                    {existing.qty}
                  </span>
                )}
              </button>
            )
          }

          const defaultCombos = [['color', 'single'], ['bw', 'single']]
          return defaultCombos.map(([printType, sides]) => {
            const price = getItemBasePrice(inventory, item.id, printType, sides)
            const label = `${item.name} ${printType === 'bw' ? 'B&W' : 'Color'} ${sides === 'single' ? 'Single' : 'Double'}`
            const existing = rows?.find(
              (r) => !r.isCustom && r.itemId === item.id && r.printType === printType && r.sides === sides
            )
            return (
              <button
                key={`${item.id}-${printType}-${sides}`}
                type="button"
                className={`btn btn-sm ${existing ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => handleQuickAdd(item.id, item.name, printType, sides, price)}
              >
                <span>{label}</span>
                <span style={{ opacity: 0.7, fontSize: '11px' }}>₹{price.toFixed(2)}</span>
                {existing && (
                  <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '0 5px', fontSize: '10px' }}>
                    {existing.qty}
                  </span>
                )}
              </button>
            )
          })
        })}
      </div>
    </div>
  )
}

// ── Item Row Editor ──────────────────────────────────────────────────────────
const ItemRowEditor = ({ rows, setRows, inventory }) => {
  const updateRow = (rowId, changes) => {
    setRows((cur) =>
      cur.map((r) => {
        if (r.id !== rowId) return r
        const unitPrice =
          changes.unitPrice !== undefined
            ? Number(changes.unitPrice)
            : changes.printType || changes.sides || changes.itemId
              ? getItemBasePrice(inventory, changes.itemId || r.itemId, changes.printType || r.printType, changes.sides || r.sides)
              : r.unitPrice
        const qty = changes.qty !== undefined ? Number(changes.qty) : r.qty
        const amount = Number((qty * unitPrice).toFixed(2))
        return { ...r, ...changes, unitPrice, amount }
      })
    )
  }

  const removeRow = (rowId) => setRows((cur) => cur.filter((r) => r.id !== rowId))

  const addRow = () => {
    let nextAvailable = null
    if (inventory && inventory.length > 0) {
      for (const item of inventory) {
        for (const [printType, sides] of [['color', 'single'], ['color', 'double'], ['bw', 'single'], ['bw', 'double']]) {
          const price = getItemBasePrice(inventory, item.id, printType, sides)
          const exists = rows.some(
            (r) => !r.isCustom && r.itemId === item.id && r.printType === printType && r.sides === sides
          )
          if (!exists) {
            nextAvailable = {
              id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              itemId: item.id,
              itemName: item.name,
              printType,
              sides,
              qty: 1,
              unitPrice: price,
              amount: price,
              gstRate: 0,
              isCustom: false,
            }
            break
          }
        }
        if (nextAvailable) break
      }
    }
    if (nextAvailable) {
      setRows((cur) => [...cur, nextAvailable])
    } else {
      setRows((cur) => [...cur, makeItemRow(inventory)])
    }
  }

  const addCustom = () => setRows((cur) => [...cur, makeCustomRow()])

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 90px 90px 65px 95px 75px 95px 32px',
              gap: '6px',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.02)',
              padding: '6px 8px',
              borderRadius: '6px',
            }}
          >
            {row.isCustom ? (
              <input
                className="form-input"
                style={{ fontSize: '13px' }}
                placeholder="Custom item name"
                value={row.itemName}
                onChange={(e) => updateRow(row.id, { itemName: e.target.value })}
              />
            ) : (
              <select
                className="form-input"
                style={{ fontSize: '13px' }}
                value={row.itemId}
                onChange={(e) => {
                  const newId = e.target.value
                  const inv = inventory.find((i) => i.id === newId)
                  updateRow(row.id, { itemId: newId, itemName: inv?.name || '' })
                }}
              >
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            )}

            <select
              className="form-input"
              style={{ fontSize: '12px' }}
              value={row.printType}
              disabled={row.isCustom}
              onChange={(e) => updateRow(row.id, { printType: e.target.value })}
            >
              <option value="color">Color</option>
              <option value="bw">B&amp;W</option>
            </select>

            <select
              className="form-input"
              style={{ fontSize: '12px' }}
              value={row.sides}
              disabled={row.isCustom}
              onChange={(e) => updateRow(row.id, { sides: e.target.value })}
            >
              <option value="single">Single</option>
              <option value="double">Double</option>
            </select>

            <input
              type="number"
              min="1"
              className="form-input"
              style={{ fontSize: '13px', textAlign: 'center' }}
              value={row.qty}
              onChange={(e) => updateRow(row.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
            />

            <input
              type="number"
              min="0"
              step="0.01"
              className="form-input"
              style={{ fontSize: '13px' }}
              value={row.unitPrice}
              onChange={(e) => updateRow(row.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
            />

            <select
              className="form-input"
              style={{ fontSize: '12px' }}
              value={row.gstRate}
              onChange={(e) => updateRow(row.id, { gstRate: Number(e.target.value) })}
            >
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>

            <div style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', paddingRight: '4px', color: '#a3e635' }}>
              ₹{Number(row.amount || 0).toFixed(2)}
            </div>

            <button
              type="button"
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex' }}
              onClick={() => removeRow(row.id)}
              title="Remove row"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '12px' }} onClick={addRow}>
          <Plus size={13} /> Add Inventory Row
        </button>
        <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '12px' }} onClick={addCustom}>
          <Plus size={13} /> Add Custom Row
        </button>
      </div>
    </div>
  )
}

// ── Unified Add New Customer Modal ───────────────────────────────────────────
const AddCustomerModal = ({ isOpen, onClose, onCustomerAdded }) => {
  const { addCustomer, showAlert, showToast } = useAppContext()
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setErrors({ name: 'Customer name is required' })
      return
    }

    setIsSubmitting(true)
    try {
      // Unified customer creation (no distinction between regular and walk-in)
      const newCust = await addCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        type: 'regular',
      })
      showToast('Customer created successfully', 'success')
      onCustomerAdded?.(newCust)
      onClose()
    } catch (err) {
      showAlert(`Failed to create customer: ${err.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '16px' }}>Add Customer</h3>
          <button className="modal-close btn-icon" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">
                Customer Name <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                className={`form-input${errors.name ? ' form-input-error' : ''}`}
                type="text"
                placeholder="Full Name"
                value={form.name}
                autoFocus
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value }))
                  if (errors.name) setErrors((errs) => ({ ...errs, name: null }))
                }}
              />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number (optional)</label>
              <input
                className="form-input"
                type="tel"
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address (optional)</label>
              <input
                className="form-input"
                type="email"
                placeholder="customer@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Settle Group / Member Payment Modal ───────────────────────────────────────
const SettleModal = ({ group, bills, onClose, onPaymentRecorded }) => {
  const { recordSpecificBillPayment, recordSplitGroupPayment } = useAppContext()
  const [payTarget, setPayTarget] = useState('full') // 'full' or billId
  const [cashAmount, setCashAmount] = useState('')
  const [upiAmount, setUpiAmount] = useState('')
  const [upiRef, setUpiRef] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const memberBills = useMemo(() => {
    if (!group) return []
    return (group.memberBillIds || [])
      .map((id) => bills.find((b) => b.id === id && !b.deleted))
      .filter(Boolean)
  }, [group, bills])

  const unpaidBills = useMemo(() => memberBills.filter((b) => (b.balance || 0) > 0.005), [memberBills])
  const totalGroupBalance = useMemo(() => unpaidBills.reduce((s, b) => s + (b.balance || 0), 0), [unpaidBills])

  const selectedBill = payTarget !== 'full' ? unpaidBills.find((b) => b.id === payTarget) : null
  const maxAllowed = selectedBill ? Number(selectedBill.balance || 0) : totalGroupBalance

  const currentPaying = (Number(cashAmount || 0) + Number(upiAmount || 0))

  const handleQuickFill = (pct) => {
    const val = Number(((maxAllowed * pct) / 100).toFixed(2))
    setCashAmount(String(val))
    setUpiAmount('0')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (currentPaying <= 0) return
    if (currentPaying > maxAllowed + 0.01) {
      alert(`Payment cannot exceed outstanding balance of ₹${maxAllowed.toFixed(2)}`)
      return
    }

    setIsSubmitting(true)
    try {
      const cash = Number(cashAmount || 0)
      const upi = Number(upiAmount || 0)

      if (payTarget === 'full' || group.type === 'split') {
        const payerBill = memberBills[0]
        recordSplitGroupPayment({
          payerBillId: payerBill?.id,
          payerCustomerId: payerBill?.customerId,
          cashAmount: cash,
          upiAmount: upi,
          groupBillId: group.id,
        })
      } else {
        recordSpecificBillPayment({
          billId: selectedBill.id,
          customerId: selectedBill.customerId,
          cashAmount: cash,
          upiAmount: upi,
          notes: notes || `Settlement payment for ${getDisplayBillId(selectedBill)}`,
        })
      }
      onPaymentRecorded?.()
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={18} className="text-accent" />
            Settle Balance — {group.type === 'split' ? getDisplaySplitPurchaseId(group) : getDisplayGroupId(group)}
          </h3>
          <button className="modal-close btn-icon" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#a1a1aa' }}>Group Total:</span>
                <strong>₹{Number(group.totalAmount || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#a1a1aa' }}>Total Outstanding:</span>
                <strong style={{ color: '#f59e0b', fontSize: '14px' }}>₹{totalGroupBalance.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#71717a' }}>
                <span>Unpaid Members:</span>
                <span>{unpaidBills.length} of {memberBills.length}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Scope</label>
              <select
                className="form-input"
                value={payTarget}
                onChange={(e) => {
                  setPayTarget(e.target.value)
                  setCashAmount('')
                  setUpiAmount('')
                }}
              >
                <option value="full">All Unpaid Bills (FIFO Allocation across Group)</option>
                {unpaidBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.customerName} ({getDisplayBillId(b)}) — Bal: ₹{Number(b.balance || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Fill Buttons */}
            <div>
              <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Quick Amount (Max ₹{maxAllowed.toFixed(2)})</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '11px' }} onClick={() => handleQuickFill(100)}>
                  Pay Full (100%)
                </button>
                <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '11px' }} onClick={() => handleQuickFill(50)}>
                  50%
                </button>
                <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '11px' }} onClick={() => handleQuickFill(25)}>
                  25%
                </button>
              </div>
            </div>

            {/* Cash & UPI Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">Cash Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">UPI Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={upiAmount}
                  onChange={(e) => setUpiAmount(e.target.value)}
                />
              </div>
            </div>

            {Number(upiAmount || 0) > 0 && (
              <div className="form-group">
                <label className="form-label">UPI Reference / UTR (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="12-digit UPI reference number"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Settlement Notes (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Payment notes / payer details"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#a1a1aa' }}>Total Paying:</span>
              <strong style={{ color: currentPaying > maxAllowed + 0.01 ? '#ef4444' : '#a3e635' }}>
                ₹{currentPaying.toFixed(2)}
              </strong>
            </div>
            {currentPaying > maxAllowed + 0.01 && (
              <div style={{ color: '#ef4444', fontSize: '12px' }}>
                Overpayment error: Payment exceeds maximum balance by ₹{(currentPaying - maxAllowed).toFixed(2)}.
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || currentPaying <= 0 || currentPaying > maxAllowed + 0.01}
            >
              {isSubmitting ? 'Recording…' : `Record ₹${currentPaying.toFixed(2)} Payment`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Traceable Cancellation Modal ─────────────────────────────────────────────
const CancelGroupModal = ({ group, onClose, onCancelled }) => {
  const { cancelGroupBill, showAlert, showToast } = useAppContext()
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCancel = async (e) => {
    e.preventDefault()
    if (!reason.trim()) {
      showAlert('Please provide a reason for cancelling this group transaction.', 'warning')
      return
    }

    setIsSubmitting(true)
    try {
      await cancelGroupBill(group.id, reason.trim())
      showToast('Group transaction cancelled and reversals recorded.', 'success')
      onCancelled?.()
      onClose()
    } catch (err) {
      showAlert(`Failed to cancel group bill: ${err.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '16px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Ban size={18} /> Cancel Group Transaction
          </h3>
          <button className="modal-close btn-icon" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCancel}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0 }}>
              Are you sure you want to cancel{' '}
              <strong style={{ color: '#fff' }}>
                {group.type === 'split' ? getDisplaySplitPurchaseId(group) : getDisplayGroupId(group)}
              </strong>
              ?
            </p>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', color: '#fca5a5' }}>
              <strong>Notice:</strong> All child bills will be marked cancelled. Any recorded payments will be automatically reversed, customer advance used will be restored, and an audit trail will be logged.
            </div>

            <div className="form-group">
              <label className="form-label">
                Cancellation Reason <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="Reason for cancellation (e.g., customer requested refund, erroneous entry)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Go Back
            </button>
            <button type="submit" className="btn" style={{ background: '#ef4444', color: '#fff' }} disabled={isSubmitting || !reason.trim()}>
              {isSubmitting ? 'Cancelling…' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Group Details Drawer / Modal ──────────────────────────────────────────────
const GroupDetailsModal = ({ group, bills, payments, onClose, onSettle, onOpenReceipt }) => {
  const memberBills = useMemo(() => {
    if (!group) return []
    return (group.memberBillIds || [])
      .map((id) => bills.find((b) => b.id === id && !b.deleted))
      .filter(Boolean)
  }, [group, bills])

  const totalAmount = memberBills.reduce((s, b) => s + Number(b.total || 0), 0)
  const paidAmount = memberBills.reduce((s, b) => s + Number(b.amountPaid || 0), 0)
  const balanceAmount = memberBills.reduce((s, b) => s + Number(b.balance || 0), 0)

  const groupPayments = useMemo(() => {
    if (!group) return []
    return (payments || []).filter(
      (p) => (p.groupBillId === group.id || memberBills.some((b) => b.id === p.billId)) && !p.isReversed
    )
  }, [group, payments, memberBills])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} className="text-accent" />
              {group.type === 'split' ? getDisplaySplitPurchaseId(group) : getDisplayGroupId(group)}
              <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: group.type === 'split' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)', color: group.type === 'split' ? '#818cf8' : '#10b981' }}>
                {group.type === 'split' ? 'Split Purchase' : 'Shared Purchase'}
              </span>
            </h3>
            <div style={{ fontSize: '12px', color: '#71717a', marginTop: '3px' }}>
              Created: {group.date || '—'} · {group.title || group.notes || 'No description'}
            </div>
          </div>
          <button className="modal-close btn-icon" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Summary Box */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#71717a' }}>TOTAL VALUE</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#a3e635' }}>₹{totalAmount.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#71717a' }}>AMOUNT PAID</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>₹{paidAmount.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#71717a' }}>OUTSTANDING</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: balanceAmount > 0.01 ? '#f59e0b' : '#10b981' }}>₹{balanceAmount.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#71717a' }}>STATUS</div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', textTransform: 'uppercase', color: group.status === 'cancelled' ? '#ef4444' : (balanceAmount <= 0.01 ? '#10b981' : (paidAmount > 0 ? '#818cf8' : '#f59e0b')) }}>
                {group.status === 'cancelled' ? 'Cancelled' : (balanceAmount <= 0.01 ? 'Fully Paid' : (paidAmount > 0 ? 'Partially Paid' : 'Pending'))}
              </div>
            </div>
          </div>

          {/* Member Bills Table */}
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Participating Member Bills ({memberBills.length})</h4>
            <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#a1a1aa' }}>Bill ID</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#a1a1aa' }}>Customer</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#a1a1aa' }}>Total</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#a1a1aa' }}>Paid</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#a1a1aa' }}>Advance</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#a1a1aa' }}>Balance</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#a1a1aa' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {memberBills.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--accent)', fontWeight: 600 }}>{getDisplayBillId(b)}</td>
                      <td style={{ padding: '8px 10px' }}>{b.customerName}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{Number(b.total || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#10b981' }}>₹{Number(b.amountPaid || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#818cf8' }}>₹{Number(b.advanceUsed || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: Number(b.balance || 0) > 0 ? '#f59e0b' : '#10b981' }}>
                        ₹{Number(b.balance || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase', background: b.status === 'cancelled' ? 'rgba(239,68,68,0.1)' : (b.balance <= 0.01 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'), color: b.status === 'cancelled' ? '#ef4444' : (b.balance <= 0.01 ? '#10b981' : '#f59e0b') }}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Transactions Log */}
          {groupPayments.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Recorded Payments ({groupPayments.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {groupPayments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{getDisplayPaymentId(p)}</span>
                      <span style={{ color: '#71717a', marginLeft: '8px' }}>{p.date?.slice(0, 10)}</span>
                      <span style={{ color: '#a1a1aa', marginLeft: '8px' }}>{p.notes || 'Payment'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {Number(p.cashAmount || 0) > 0 && <span style={{ color: '#10b981' }}>Cash: ₹{Number(p.cashAmount).toFixed(2)}</span>}
                      {Number(p.upiAmount || 0) > 0 && <span style={{ color: '#818cf8' }}>UPI: ₹{Number(p.upiAmount).toFixed(2)}</span>}
                      <strong style={{ color: '#a3e635' }}>Total: ₹{Number(p.totalPaid || p.totalAmount || 0).toFixed(2)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                onClose()
                onOpenReceipt?.(group)
              }}
            >
              <FileText size={14} /> View Receipt
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {balanceAmount > 0.01 && group.status !== 'cancelled' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose()
                  onSettle?.(group)
                }}
              >
                <Wallet size={14} /> Settle Balance
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Group Billing Main Dashboard Component ────────────────────────────────────
const GroupBillingDashboard = ({
  groupBills,
  bills,
  customers,
  onOpenReceipt,
  onSettle,
  onCancel,
  onViewDetails,
  onNewShared,
  onNewSplit,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'shared' | 'split'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'paid' | 'partial' | 'pending' | 'cancelled'
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('date_desc') // 'date_desc' | 'date_asc' | 'amount_desc' | 'balance_desc'
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  // Pre-calculate live totals per group
  const processedGroups = useMemo(() => {
    return (groupBills || []).map((grp) => {
      const memberBills = (grp.memberBillIds || [])
        .map((id) => bills.find((b) => b.id === id && !b.deleted))
        .filter(Boolean)

      const totalAmount = memberBills.length > 0
        ? memberBills.reduce((s, b) => s + Number(b.total || 0), 0)
        : Number(grp.totalAmount || 0)
      const amountPaid = memberBills.length > 0
        ? memberBills.reduce((s, b) => s + Number(b.amountPaid || 0), 0)
        : Number(grp.amountPaid || 0)
      const balance = Math.max(0, totalAmount - amountPaid)

      let effectiveStatus = grp.status
      if (grp.status !== 'cancelled') {
        if (balance <= 0.005) effectiveStatus = 'paid'
        else if (amountPaid > 0) effectiveStatus = 'partial'
        else effectiveStatus = 'pending'
      }

      return {
        ...grp,
        memberBills,
        calculatedTotal: totalAmount,
        calculatedPaid: amountPaid,
        calculatedBalance: balance,
        effectiveStatus,
      }
    })
  }, [groupBills, bills])

  // ── 9 Summary KPI Cards Metrics ─────────────────────────────────────────────
  const summaryMetrics = useMemo(() => {
    const totalTransactions = processedGroups.length
    const totalValue = processedGroups.reduce((s, g) => s + g.calculatedTotal, 0)
    const totalAllocated = totalValue // Allocated across participating customers
    const totalCollected = processedGroups.reduce((s, g) => s + g.calculatedPaid, 0)
    const totalOutstanding = processedGroups.reduce((s, g) => s + (g.effectiveStatus !== 'cancelled' ? g.calculatedBalance : 0), 0)

    const fullyPaid = processedGroups.filter((g) => g.effectiveStatus === 'paid').length
    const partiallyPaid = processedGroups.filter((g) => g.effectiveStatus === 'partial').length
    const pending = processedGroups.filter((g) => g.effectiveStatus === 'pending').length
    const cancelled = processedGroups.filter((g) => g.effectiveStatus === 'cancelled').length

    return {
      totalTransactions,
      totalValue,
      totalAllocated,
      totalCollected,
      totalOutstanding,
      fullyPaid,
      partiallyPaid,
      pending,
      cancelled,
    }
  }, [processedGroups])

  // ── Search & Filter Logic ───────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return processedGroups.filter((grp) => {
      // Purchase Type filter
      if (typeFilter !== 'all' && grp.type !== typeFilter) return false

      // Status filter
      if (statusFilter !== 'all' && grp.effectiveStatus !== statusFilter) return false

      // Date Range filter
      if (dateFrom && grp.date && grp.date < dateFrom) return false
      if (dateTo && grp.date && grp.date > dateTo) return false

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchId = (grp.id && grp.id.toLowerCase().includes(q)) ||
          (grp.groupId && grp.groupId.toLowerCase().includes(q)) ||
          (grp.splitPurchaseId && grp.splitPurchaseId.toLowerCase().includes(q))
        const matchTitle = grp.title && grp.title.toLowerCase().includes(q)
        const matchNotes = grp.notes && grp.notes.toLowerCase().includes(q)
        const matchBills = grp.memberBills.some(
          (b) =>
            (b.id && b.id.toLowerCase().includes(q)) ||
            (b.customerName && b.customerName.toLowerCase().includes(q)) ||
            (customers.find((c) => c.id === b.customerId)?.phone || '').includes(q)
        )
        if (!matchId && !matchTitle && !matchNotes && !matchBills) return false
      }

      return true
    }).sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
      if (sortBy === 'date_asc') return new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)
      if (sortBy === 'amount_desc') return b.calculatedTotal - a.calculatedTotal
      if (sortBy === 'balance_desc') return b.calculatedBalance - a.calculatedBalance
      return 0
    })
  }, [processedGroups, typeFilter, statusFilter, dateFrom, dateTo, searchQuery, sortBy, customers])

  // ── Pagination Logic ───────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize))
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredGroups.slice(start, start + pageSize)
  }, [filteredGroups, currentPage, pageSize])

  const handleShareWhatsApp = (grp) => {
    const isSplit = grp.type === 'split'
    const title = isSplit ? `Split Purchase ${getDisplaySplitPurchaseId(grp)}` : `Shared Purchase ${getDisplayGroupId(grp)}`
    let text = `*PrintPro Group Billing Summary*\n`
    text += `*${title}*\n`
    text += `Date: ${grp.date || new Date().toISOString().slice(0, 10)}\n`
    text += `Total: ₹${grp.calculatedTotal.toFixed(2)}\n`
    text += `Paid: ₹${grp.calculatedPaid.toFixed(2)}\n`
    text += `Balance: ₹${grp.calculatedBalance.toFixed(2)}\n`
    text += `Status: ${grp.effectiveStatus.toUpperCase()}\n`
    text += `Members (${grp.memberBills.length}):\n`
    grp.memberBills.forEach((b, i) => {
      text += `${i + 1}. ${b.customerName} (${getDisplayBillId(b)}) - ₹${Number(b.total).toFixed(2)} (${b.status})\n`
    })
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── 9 Summary KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase' }}>Total Transactions</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', marginTop: '4px' }}>
            {summaryMetrics.totalTransactions}
          </div>
          <div style={{ fontSize: '11px', color: '#71717a' }}>All group orders</div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase' }}>Purchase Value</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#a3e635', marginTop: '4px' }}>
            ₹{summaryMetrics.totalValue.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: '#71717a' }}>Gross group billing</div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase' }}>Customer Allocated</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
            ₹{summaryMetrics.totalAllocated.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: '#71717a' }}>Assigned to members</div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase' }}>Amount Collected</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
            ₹{summaryMetrics.totalCollected.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: '#71717a' }}>Total cash/UPI received</div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase' }}>Outstanding Due</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: summaryMetrics.totalOutstanding > 0 ? '#f59e0b' : '#10b981', marginTop: '4px' }}>
            ₹{summaryMetrics.totalOutstanding.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: '#71717a' }}>Receivables pending</div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase' }}>Fully Paid Groups</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
            {summaryMetrics.fullyPaid}
          </div>
          <div style={{ fontSize: '11px', color: '#71717a' }}>100% settled</div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase' }}>Partially Paid</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#818cf8', marginTop: '4px' }}>
            {summaryMetrics.partiallyPaid}
          </div>
          <div style={{ fontSize: '11px', color: '#71717a' }}>Partial collections</div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase' }}>Pending Groups</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
            {summaryMetrics.pending}
          </div>
          <div style={{ fontSize: '11px', color: '#71717a' }}>Awaiting initial payment</div>
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase' }}>Cancelled Groups</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>
            {summaryMetrics.cancelled}
          </div>
          <div style={{ fontSize: '11px', color: '#71717a' }}>Reversed orders</div>
        </div>
      </div>

      {/* ── Action Buttons & Search/Filter Toolbar ── */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-primary" onClick={onNewShared}>
              <Plus size={15} /> Create Shared Purchase
            </button>
            <button type="button" className="btn btn-secondary" onClick={onNewSplit}>
              <ArrowLeftRight size={15} /> Create Split Purchase
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#a1a1aa' }}>
            <span>Showing {filteredGroups.length} group transactions</span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#71717a' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '13px' }}
              placeholder="Search Group ID, customer, bill..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          <select
            className="form-input"
            style={{ fontSize: '13px' }}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="all">All Purchase Types</option>
            <option value="shared">Shared Purchase</option>
            <option value="split">Split Purchase</option>
          </select>

          <select
            className="form-input"
            style={{ fontSize: '13px' }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="all">All Statuses</option>
            <option value="paid">Fully Paid</option>
            <option value="partial">Partially Paid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              type="date"
              className="form-input"
              style={{ fontSize: '12px' }}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setCurrentPage(1)
              }}
              title="From Date"
            />
            <span style={{ color: '#71717a', fontSize: '12px' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ fontSize: '12px' }}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setCurrentPage(1)
              }}
              title="To Date"
            />
          </div>

          <select
            className="form-input"
            style={{ fontSize: '13px' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date_desc">Date: Newest First</option>
            <option value="date_asc">Date: Oldest First</option>
            <option value="amount_desc">Total Amount: High to Low</option>
            <option value="balance_desc">Outstanding: High to Low</option>
          </select>
        </div>
      </div>

      {/* ── 10-Column Group Transaction List ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#a1a1aa', fontWeight: 600 }}>Group ID</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#a1a1aa', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#a1a1aa', fontWeight: 600 }}>Group Name</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#a1a1aa', fontWeight: 600 }}>Purchase Type</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#a1a1aa', fontWeight: 600 }}>Customers</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#a1a1aa', fontWeight: 600 }}>Total Amount</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#a1a1aa', fontWeight: 600 }}>Amount Paid</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#a1a1aa', fontWeight: 600 }}>Outstanding</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#a1a1aa', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#a1a1aa', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedGroups.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: '#71717a' }}>
                    No group transactions found matching current filters.
                  </td>
                </tr>
              ) : (
                paginatedGroups.map((grp) => {
                  const displayId = grp.type === 'split' ? getDisplaySplitPurchaseId(grp) : getDisplayGroupId(grp)
                  const isSplit = grp.type === 'split'
                  const isPaid = grp.effectiveStatus === 'paid'
                  const isPartial = grp.effectiveStatus === 'partial'
                  const isCancelled = grp.effectiveStatus === 'cancelled'

                  return (
                    <tr
                      key={grp.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* 1. Group ID */}
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--accent)' }}>
                        {displayId}
                      </td>

                      {/* 2. Date */}
                      <td style={{ padding: '10px 14px', color: '#a1a1aa', whiteSpace: 'nowrap' }}>
                        {grp.date || grp.createdAt?.slice(0, 10) || '—'}
                      </td>

                      {/* 3. Group Name */}
                      <td style={{ padding: '10px 14px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={grp.title || grp.notes || ''}>
                        {grp.title || grp.notes || '—'}
                      </td>

                      {/* 4. Purchase Type */}
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: isSplit ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.12)',
                            color: isSplit ? '#818cf8' : '#10b981',
                          }}
                        >
                          {isSplit ? 'Split Purchase' : 'Shared Purchase'}
                        </span>
                      </td>

                      {/* 5. Customers */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                          {grp.memberBills.length || grp.splitCount || 0}
                        </span>
                      </td>

                      {/* 6. Total Amount */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#a3e635' }}>
                        ₹{grp.calculatedTotal.toFixed(2)}
                      </td>

                      {/* 7. Amount Paid */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#10b981' }}>
                        ₹{grp.calculatedPaid.toFixed(2)}
                      </td>

                      {/* 8. Outstanding */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: grp.calculatedBalance > 0.01 ? '#f59e0b' : '#10b981' }}>
                        ₹{grp.calculatedBalance.toFixed(2)}
                      </td>

                      {/* 9. Status */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background: isCancelled
                              ? 'rgba(239,68,68,0.15)'
                              : isPaid
                                ? 'rgba(16,185,129,0.15)'
                                : isPartial
                                  ? 'rgba(99,102,241,0.15)'
                                  : 'rgba(245,158,11,0.15)',
                            color: isCancelled
                              ? '#ef4444'
                              : isPaid
                                ? '#10b981'
                                : isPartial
                                  ? '#818cf8'
                                  : '#f59e0b',
                          }}
                        >
                          {isCancelled ? 'Cancelled' : isPaid ? 'Paid' : isPartial ? 'Partial' : 'Pending'}
                        </span>
                      </td>

                      {/* 10. Actions */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 7px', fontSize: '11px' }}
                            onClick={() => onViewDetails(grp)}
                            title="View member details and bills"
                          >
                            <Eye size={12} />
                          </button>

                          {grp.calculatedBalance > 0.01 && !isCancelled && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => onSettle(grp)}
                              title="Settle outstanding balance"
                            >
                              Settle
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 7px', fontSize: '11px' }}
                            onClick={() => onOpenReceipt(grp)}
                            title="Print / View Receipt"
                          >
                            <FileText size={12} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 7px', fontSize: '11px', color: '#10b981' }}
                            onClick={() => handleShareWhatsApp(grp)}
                            title="Share on WhatsApp"
                          >
                            <MessageCircle size={12} />
                          </button>

                          {!isCancelled && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 7px', fontSize: '11px', color: '#ef4444' }}
                              onClick={() => onCancel(grp)}
                              title="Cancel group transaction"
                            >
                              <Ban size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#71717a' }}>
            <span>Rows per page:</span>
            <select
              className="form-input"
              style={{ width: '65px', padding: '2px 6px', fontSize: '12px' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <span>Showing {paginatedGroups.length} of {filteredGroups.length}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main GroupBilling Component ───────────────────────────────────────────────
const GroupBilling = () => {
  const {
    customers,
    inventory,
    bills = [],
    groupBills = [],
    payments = [],
    addGroupBill,
    showAlert,
    showToast,
  } = useAppContext()

  // Navigation mode: 'dashboard' | 'shared' | 'split'
  const [activeTab, setActiveTab] = useState('dashboard')

  // Inline modals
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [customerModalTarget, setCustomerModalTarget] = useState(null) // { mode: 'shared' | 'split', memberId: string }
  const [activeReceiptGroup, setActiveReceiptGroup] = useState(null)
  const [settleModalGroup, setSettleModalGroup] = useState(null)
  const [cancelModalGroup, setCancelModalGroup] = useState(null)
  const [detailsModalGroup, setDetailsModalGroup] = useState(null)

  // Common Bill Meta
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Shared Purchase State ──────────────────────────────────────────────────
  const [sharedRows, setSharedRows] = useState(() => [makeItemRow(inventory)])
  const [sharedCostMethod, setSharedCostMethod] = useState('equal') // 'equal' | 'custom_amount' | 'percentage' | 'quantity' | 'weighted' | 'item_based' | 'combination'
  const [sharedMembers, setSharedMembers] = useState([
    {
      id: `sm-${Date.now()}-1`,
      customerId: '',
      customAmount: '',
      percentage: '50',
      quantity: 1,
      weight: 1,
      assignedRowIds: [],
      hasAddons: false,
      addonRows: [],
      useAdvance: false,
      cashPaid: '',
      upiPaid: '',
      discountType: 'flat',
      discountValue: 0,
    },
    {
      id: `sm-${Date.now()}-2`,
      customerId: '',
      customAmount: '',
      percentage: '50',
      quantity: 1,
      weight: 1,
      assignedRowIds: [],
      hasAddons: false,
      addonRows: [],
      useAdvance: false,
      cashPaid: '',
      upiPaid: '',
      discountType: 'flat',
      discountValue: 0,
    },
  ])

  // ── Split Purchase State ───────────────────────────────────────────────────
  const [splitRows, setSplitRows] = useState(() => [makeItemRow(inventory)])
  const [splitMembers, setSplitMembers] = useState([
    {
      id: `spm-${Date.now()}-1`,
      customerId: '',
      useAdvance: false,
      cashPaid: '',
      upiPaid: '',
      discountType: 'flat',
      discountValue: 0,
    },
    {
      id: `spm-${Date.now()}-2`,
      customerId: '',
      useAdvance: false,
      cashPaid: '',
      upiPaid: '',
      discountType: 'flat',
      discountValue: 0,
    },
  ])
  // Granular item allocations: { [rowId]: { [memberId]: quantity } }
  const [splitItemAllocations, setSplitItemAllocations] = useState({})
  const [splitSettlementPreset, setSplitSettlementPreset] = useState('equal') // 'equal' | 'single' | 'custom'
  const [_splitSinglePayerId, setSplitSinglePayerId] = useState('')
  const [splitSinglePayerMethod] = useState('cash')

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers])

  // ── Shared Calculations ───────────────────────────────────────────────────
  const sharedItemsSubtotal = useMemo(
    () => sharedRows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [sharedRows]
  )
  const sharedItemsGst = useMemo(
    () => sharedRows.reduce((s, r) => s + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0),
    [sharedRows]
  )
  const sharedGrandTotal = Number((sharedItemsSubtotal + sharedItemsGst).toFixed(2))

  // Compute member shares dynamically across the 7 methods
  const sharedMemberCalculations = useMemo(() => {
    let baseAllocatedAmounts = []

    if (sharedCostMethod === 'equal') {
      baseAllocatedAmounts = allocateWithDeterministicRounding(sharedGrandTotal, sharedMembers.map(() => 1))
    } else if (sharedCostMethod === 'percentage') {
      baseAllocatedAmounts = allocateWithDeterministicRounding(
        sharedGrandTotal,
        sharedMembers.map((m) => Number(m.percentage || 0))
      )
    } else if (sharedCostMethod === 'quantity') {
      baseAllocatedAmounts = allocateWithDeterministicRounding(
        sharedGrandTotal,
        sharedMembers.map((m) => Math.max(1, Number(m.quantity || 1)))
      )
    } else if (sharedCostMethod === 'weighted') {
      baseAllocatedAmounts = allocateWithDeterministicRounding(
        sharedGrandTotal,
        sharedMembers.map((m) => Math.max(0.01, Number(m.weight || 1)))
      )
    } else if (sharedCostMethod === 'custom_amount') {
      baseAllocatedAmounts = sharedMembers.map((m) => Number(m.customAmount || 0))
    } else if (sharedCostMethod === 'item_based') {
      // Allocate shared items based on member assignments
      baseAllocatedAmounts = sharedMembers.map((m) => {
        let memberSub = 0
        let memberG = 0
        sharedRows.forEach((r) => {
          if ((m.assignedRowIds || []).includes(r.id)) {
            // Count how many members share this item
            const sharingMembersCount = Math.max(
              1,
              sharedMembers.filter((sm) => (sm.assignedRowIds || []).includes(r.id)).length
            )
            const amt = Number(r.amount || 0) / sharingMembersCount
            const gst = (amt * (Number(r.gstRate || 0) / 100))
            memberSub += amt
            memberG += gst
          }
        })
        return Number((memberSub + memberG).toFixed(2))
      })
    } else if (sharedCostMethod === 'combination') {
      // Equal split of shared items + addons calculated individually
      baseAllocatedAmounts = allocateWithDeterministicRounding(sharedGrandTotal, sharedMembers.map(() => 1))
    }

    return sharedMembers.map((m, idx) => {
      const cust = activeCustomers.find((c) => c.id === m.customerId)
      const advanceAvail = Number(cust?.advanceBalance || cust?.creditBalance || 0)

      const sharedBaseShare = baseAllocatedAmounts[idx] || 0

      // Individual Add-ons
      const addonSubtotal = m.hasAddons
        ? (m.addonRows || []).reduce((s, r) => s + Number(r.amount || 0), 0)
        : 0
      const addonGst = m.hasAddons
        ? (m.addonRows || []).reduce((s, r) => s + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0)
        : 0
      const addonTotal = addonSubtotal + addonGst

      const grossMemberTotal = Number((sharedBaseShare + addonTotal).toFixed(2))

      // Discount
      let discVal = Number(m.discountValue || 0)
      let discAmt = m.discountType === 'percent' ? (grossMemberTotal * discVal) / 100 : discVal
      discAmt = Math.min(discAmt, grossMemberTotal)

      const memberNetTotal = Number((grossMemberTotal - discAmt).toFixed(2))

      // Advance application: MIN(advance, memberNetTotal)
      let advUsed = 0
      if (m.useAdvance && advanceAvail > 0) {
        advUsed = Number(Math.min(advanceAvail, memberNetTotal).toFixed(2))
      }

      const balanceAfterAdv = Math.max(0, Number((memberNetTotal - advUsed).toFixed(2)))

      // Direct Payments (Cash, UPI)
      const cash = Number(m.cashPaid || 0)
      const upi = Number(m.upiPaid || 0)
      const directPaid = Math.min(cash + upi, balanceAfterAdv)
      const finalBal = Math.max(0, Number((balanceAfterAdv - directPaid).toFixed(2)))

      return {
        member: m,
        customer: cust,
        advanceAvail,
        sharedBaseShare,
        addonTotal,
        grossMemberTotal,
        discAmt,
        memberNetTotal,
        advUsed,
        balanceAfterAdv,
        directPaid,
        finalBal,
      }
    })
  }, [sharedMembers, sharedCostMethod, sharedGrandTotal, sharedRows, activeCustomers])

  const totalSharedAllocated = useMemo(() => {
    return sharedMemberCalculations.reduce((s, c) => s + c.sharedBaseShare, 0)
  }, [sharedMemberCalculations])

  const isSharedAllocationValid = useMemo(() => {
    if (sharedCostMethod === 'custom_amount') {
      return Math.abs(totalSharedAllocated - sharedGrandTotal) <= 0.01
    }
    return true
  }, [sharedCostMethod, totalSharedAllocated, sharedGrandTotal])

  // ── Split Calculations (Granular Item Matrix) ───────────────────────────────
  const splitItemsSubtotal = useMemo(
    () => splitRows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [splitRows]
  )
  const splitItemsGst = useMemo(
    () => splitRows.reduce((s, r) => s + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0),
    [splitRows]
  )
  const splitGrandTotal = Number((splitItemsSubtotal + splitItemsGst).toFixed(2))

  // Track allocation per item
  const splitRowAllocationStatus = useMemo(() => {
    return splitRows.map((r) => {
      const allocatedQty = splitMembers.reduce((sum, m) => {
        const q = Number(splitItemAllocations[r.id]?.[m.id] || 0)
        return sum + q
      }, 0)
      const remainingQty = r.qty - allocatedQty
      return {
        row: r,
        allocatedQty,
        remainingQty,
        isValid: remainingQty >= 0,
      }
    })
  }, [splitRows, splitMembers, splitItemAllocations])

  // Compute each split member's assigned items, subtotal, GST, and totals
  const splitMemberCalculations = useMemo(() => {
    return splitMembers.map((m) => {
      const cust = activeCustomers.find((c) => c.id === m.customerId)
      const advanceAvail = Number(cust?.advanceBalance || cust?.creditBalance || 0)

      let assignedItems = []
      let memberSubtotal = 0
      let memberGst = 0

      splitRows.forEach((r) => {
        const assignedQty = Number(splitItemAllocations[r.id]?.[m.id] || 0)
        if (assignedQty > 0) {
          const itemAmt = Number((assignedQty * r.unitPrice).toFixed(2))
          const itemGst = Number((itemAmt * (Number(r.gstRate || 0) / 100)).toFixed(2))
          memberSubtotal += itemAmt
          memberGst += itemGst
          assignedItems.push({
            itemId: r.itemId,
            itemName: r.itemName,
            printType: r.printType,
            sides: r.sides,
            qty: assignedQty,
            unitPrice: r.unitPrice,
            amount: itemAmt,
            gstRate: r.gstRate,
          })
        }
      })

      const grossMemberTotal = Number((memberSubtotal + memberGst).toFixed(2))

      // Discount
      let discVal = Number(m.discountValue || 0)
      let discAmt = m.discountType === 'percent' ? (grossMemberTotal * discVal) / 100 : discVal
      discAmt = Math.min(discAmt, grossMemberTotal)

      const memberNetTotal = Number((grossMemberTotal - discAmt).toFixed(2))

      // Advance application
      let advUsed = 0
      if (m.useAdvance && advanceAvail > 0) {
        advUsed = Number(Math.min(advanceAvail, memberNetTotal).toFixed(2))
      }

      const balanceAfterAdv = Math.max(0, Number((memberNetTotal - advUsed).toFixed(2)))

      // Direct payments
      const cash = Number(m.cashPaid || 0)
      const upi = Number(m.upiPaid || 0)
      const directPaid = Math.min(cash + upi, balanceAfterAdv)
      const finalBal = Math.max(0, Number((balanceAfterAdv - directPaid).toFixed(2)))

      return {
        member: m,
        customer: cust,
        advanceAvail,
        assignedItems,
        memberSubtotal,
        memberGst,
        grossMemberTotal,
        discAmt,
        memberNetTotal,
        advUsed,
        balanceAfterAdv,
        directPaid,
        finalBal,
      }
    })
  }, [splitMembers, activeCustomers, splitRows, splitItemAllocations])

  // Total allocated across split members
  const totalSplitAllocated = useMemo(() => {
    return splitMemberCalculations.reduce((s, c) => s + c.grossMemberTotal, 0)
  }, [splitMemberCalculations])

  // Handle Preset Split Payment
  const applySplitPresetEqual = () => {
    setSplitSettlementPreset('equal')
    setSplitMembers((cur) =>
      cur.map((m, idx) => {
        const comp = splitMemberCalculations[idx]
        const bal = comp?.balanceAfterAdv || 0
        return { ...m, cashPaid: String(bal), upiPaid: '0' }
      })
    )
  }

  const applySplitPresetSingle = (payerCustId) => {
    setSplitSettlementPreset('single')
    setSplitSinglePayerId(payerCustId)
    const targetIdx = splitMembers.findIndex((m) => m.customerId === payerCustId)
    const totalRemaining = splitMemberCalculations.reduce((s, c) => s + c.balanceAfterAdv, 0)

    setSplitMembers((cur) =>
      cur.map((m, idx) => {
        if (idx === targetIdx) {
          return {
            ...m,
            cashPaid: splitSinglePayerMethod === 'cash' ? String(totalRemaining) : '0',
            upiPaid: splitSinglePayerMethod === 'upi' ? String(totalRemaining) : '0',
          }
        }
        return { ...m, cashPaid: '0', upiPaid: '0' }
      })
    )
  }

  // ── Submit Handlers ────────────────────────────────────────────────────────
  const handleSharedSubmit = (e) => {
    e.preventDefault()
    if (sharedMembers.some((m) => !m.customerId)) {
      showAlert('Please select a customer for all participating members.', 'error')
      return
    }
    if (sharedRows.length === 0 || sharedGrandTotal <= 0) {
      showAlert('Please add at least one shared item with a valid price.', 'error')
      return
    }
    if (!isSharedAllocationValid) {
      showAlert(`Custom allocation mismatch. Total allocated ₹${totalSharedAllocated.toFixed(2)} must match group total ₹${sharedGrandTotal.toFixed(2)}.`, 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const groupMembers = sharedMemberCalculations.map((calc, i) => {
        const m = calc.member
        const custName = calc.customer?.name || `Member ${i + 1}`

        const allItems = [
          ...sharedRows.map((r) => {
            const ratio = sharedGrandTotal > 0 ? (calc.sharedBaseShare / sharedGrandTotal) : (1 / sharedMembers.length)
            const amt = Number((Number(r.amount || 0) * ratio).toFixed(2))
            return {
              itemId: r.itemId,
              itemName: `${r.itemName} (${(ratio * 100).toFixed(1)}% share)`,
              printType: r.printType,
              sides: r.sides,
              qty: Number(r.qty),
              unitPrice: r.unitPrice,
              amount: amt,
              gstRate: Number(r.gstRate || 0),
            }
          }),
          ...(m.hasAddons
            ? (m.addonRows || []).map((r) => ({
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

        return {
          id: m.id,
          customerId: m.customerId,
          customerName: custName,
          items: allItems,
          subtotal: calc.sharedBaseShare,
          gstAmount: 0,
          total: calc.memberNetTotal,
          discountType: m.discountType,
          discountValue: m.discountValue,
          discountAmount: calc.discAmt,
          advanceUsed: calc.advUsed,
          useAdvance: m.useAdvance,
          cashPaid: Number(m.cashPaid || 0),
          upiPaid: Number(m.upiPaid || 0),
          balance: calc.finalBal,
          groupRole: 'shared',
        }
      })

      const grpId = addGroupBill({
        type: 'shared',
        costMethod: sharedCostMethod,
        title: notes || `Shared Purchase (${sharedMembers.length} members)`,
        date,
        dueDate,
        notes,
        members: groupMembers,
      })

      showToast(`Shared purchase created with Group ID ${grpId}!`, 'success')
      setActiveTab('dashboard')
    } catch (err) {
      showAlert(`Failed to create shared purchase: ${err.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSplitSubmit = (e) => {
    e.preventDefault()
    if (splitMembers.some((m) => !m.customerId)) {
      showAlert('Please select a customer for all split members.', 'error')
      return
    }
    if (splitMembers.length < 2) {
      showAlert('A split purchase requires at least two participating customers.', 'error')
      return
    }
    if (splitRows.length === 0 || splitGrandTotal <= 0) {
      showAlert('Please add items to split.', 'error')
      return
    }

    // Check for over-allocated items
    const overAllocated = splitRowAllocationStatus.find((s) => s.remainingQty < 0)
    if (overAllocated) {
      showAlert(`Item "${overAllocated.row.itemName}" is over-allocated by ${Math.abs(overAllocated.remainingQty)} units.`, 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const groupMembers = splitMemberCalculations.map((calc, idx) => {
        const m = calc.member
        const custName = calc.customer?.name || `Customer ${idx + 1}`

        return {
          id: m.id,
          customerId: m.customerId,
          customerName: custName,
          items: calc.assignedItems.length > 0 ? calc.assignedItems : [
            {
              itemId: splitRows[0]?.itemId || '',
              itemName: `${splitRows[0]?.itemName || 'Print Item'} (Split Share)`,
              printType: 'color',
              sides: 'single',
              qty: 1,
              unitPrice: calc.memberNetTotal,
              amount: calc.memberNetTotal,
              gstRate: 0,
            },
          ],
          subtotal: calc.memberSubtotal,
          gstAmount: calc.memberGst,
          total: calc.memberNetTotal,
          discountType: m.discountType,
          discountValue: m.discountValue,
          discountAmount: calc.discAmt,
          advanceUsed: calc.advUsed,
          useAdvance: m.useAdvance,
          cashPaid: Number(m.cashPaid || 0),
          upiPaid: Number(m.upiPaid || 0),
          balance: calc.finalBal,
          groupRole: 'split',
        }
      })

      const spId = addGroupBill({
        type: 'split',
        title: notes || `Split Purchase (${splitMembers.length} members)`,
        date,
        dueDate,
        notes,
        members: groupMembers,
      })

      showToast(`Split purchase created with Split Purchase ID ${spId}!`, 'success')
      setActiveTab('dashboard')
    } catch (err) {
      showAlert(`Failed to create split purchase: ${err.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1360px', margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={26} className="text-accent" />
            Group Billing &amp; Split POS
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#a1a1aa' }}>
            Comprehensive group purchasing, 7 cost-sharing methods, item-level allocation, settlement tracking &amp; receipts
          </p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', background: 'var(--surface)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => setActiveTab('dashboard')}
          >
            <Clock size={14} /> Group Dashboard ({groupBills.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'shared' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => setActiveTab('shared')}
          >
            <Plus size={14} /> Shared Purchase
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'split' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => setActiveTab('split')}
          >
            <ArrowLeftRight size={14} /> Split Purchase
          </button>
        </div>
      </div>

      {/* ── TAB 1: GROUP DASHBOARD & HISTORY ── */}
      {activeTab === 'dashboard' && (
        <GroupBillingDashboard
          groupBills={groupBills}
          bills={bills}
          customers={customers}
          payments={payments}
          onOpenReceipt={(grp) => setActiveReceiptGroup(grp)}
          onSettle={(grp) => setSettleModalGroup(grp)}
          onCancel={(grp) => setCancelModalGroup(grp)}
          onViewDetails={(grp) => setDetailsModalGroup(grp)}
          onNewShared={() => setActiveTab('shared')}
          onNewSplit={() => setActiveTab('split')}
        />
      )}

      {/* ── TAB 2: SHARED PURCHASE (7 COST-SHARING METHODS) ── */}
      {activeTab === 'shared' && (
        <form onSubmit={handleSharedSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Meta */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600 }}>Shared Order Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Order Date</label>
                <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Order Notes / Project Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Final Year Thesis Report, Conference Handouts..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Shared Items */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Shared Purchased Items</h3>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Joint print services, binding, and stationery shared across members</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#a3e635' }}>
                  Total: ₹{sharedGrandTotal.toFixed(2)}
                </div>
                <div style={{ fontSize: '11px', color: '#71717a' }}>
                  Subtotal: ₹{sharedItemsSubtotal.toFixed(2)} + GST: ₹{sharedItemsGst.toFixed(2)}
                </div>
              </div>
            </div>

            <QuickAddPanel inventory={inventory} rows={sharedRows} setRows={setSharedRows} />
            <ItemRowEditor rows={sharedRows} setRows={setSharedRows} inventory={inventory} />
          </div>

          {/* 7 Cost-Sharing Methods Selector */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sliders size={16} className="text-accent" /> Cost-Sharing Method (7 Allocation Modes)
                </h3>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Deterministic rounding guarantees exact cent-level allocation</div>
              </div>

              {sharedCostMethod === 'custom_amount' && (
                <div style={{ fontSize: '12px', color: isSharedAllocationValid ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  Allocated: ₹{totalSharedAllocated.toFixed(2)} / ₹{sharedGrandTotal.toFixed(2)}
                  {!isSharedAllocationValid && ` (Diff: ₹${Math.abs(totalSharedAllocated - sharedGrandTotal).toFixed(2)})`}
                </div>
              )}
            </div>

            {/* Method Pill Selector */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {[
                { id: 'equal', label: '1. Equal Split', desc: 'Even division with deterministic remainder' },
                { id: 'custom_amount', label: '2. Custom Amount', desc: 'Manual rupee shares' },
                { id: 'percentage', label: '3. Percentage Split', desc: 'Percentages summing to 100%' },
                { id: 'quantity', label: '4. Quantity-Based', desc: 'Proportional to page/unit counts' },
                { id: 'weighted', label: '5. Weighted Ratio', desc: 'Arbitrary ratio weights (e.g. 2:1:1)' },
                { id: 'item_based', label: '6. Item-Based Share', desc: 'Assign specific items to members' },
                { id: 'combination', label: '7. Custom Combination', desc: 'Shared split + individual add-ons' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`btn btn-sm ${sharedCostMethod === m.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={() => setSharedCostMethod(m.id)}
                  title={m.desc}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Participating Members Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sharedMemberCalculations.map((calc, idx) => {
                const m = calc.member

                return (
                  <div
                    key={m.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                          {idx + 1}
                        </div>
                        <select
                          className="form-input"
                          style={{ minWidth: '200px', fontSize: '13px' }}
                          value={m.customerId}
                          onChange={(e) => {
                            const newCustId = e.target.value
                            setSharedMembers((cur) =>
                              cur.map((sm) => (sm.id === m.id ? { ...sm, customerId: newCustId } : sm))
                            )
                          }}
                        >
                          <option value="">— Select Customer —</option>
                          {activeCustomers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({getDisplayCustomerId(c)})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          onClick={() => {
                            setCustomerModalTarget({ mode: 'shared', memberId: m.id })
                            setShowAddCustomerModal(true)
                          }}
                          title="Add New Unified Customer"
                        >
                          <Plus size={13} /> New
                        </button>

                        {calc.advanceAvail > 0 && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#10b981', cursor: 'pointer', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: '4px' }}>
                            <input
                              type="checkbox"
                              checked={m.useAdvance}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setSharedMembers((cur) =>
                                  cur.map((sm) => (sm.id === m.id ? { ...sm, useAdvance: checked } : sm))
                                )
                              }}
                            />
                            Apply Advance (Avail: ₹{calc.advanceAvail.toFixed(2)})
                          </label>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: '#71717a' }}>Net Share: </span>
                          <strong style={{ fontSize: '15px', color: '#a3e635' }}>₹{calc.memberNetTotal.toFixed(2)}</strong>
                          {calc.advUsed > 0 && (
                            <span style={{ fontSize: '11px', color: '#10b981', marginLeft: '6px' }}>
                              (-₹{calc.advUsed.toFixed(2)} adv)
                            </span>
                          )}
                        </div>
                        {sharedMembers.length > 1 && (
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                            onClick={() => setSharedMembers((cur) => cur.filter((sm) => sm.id !== m.id))}
                            title="Remove member"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Method Specific Input Fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {sharedCostMethod === 'custom_amount' && (
                        <div>
                          <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Custom Share (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            value={m.customAmount}
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = e.target.value
                              setSharedMembers((cur) =>
                                cur.map((sm) => (sm.id === m.id ? { ...sm, customAmount: val } : sm))
                              )
                            }}
                          />
                        </div>
                      )}

                      {sharedCostMethod === 'percentage' && (
                        <div>
                          <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Percentage (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            className="form-input"
                            value={m.percentage}
                            onChange={(e) => {
                              const val = e.target.value
                              setSharedMembers((cur) =>
                                cur.map((sm) => (sm.id === m.id ? { ...sm, percentage: val } : sm))
                              )
                            }}
                          />
                        </div>
                      )}

                      {sharedCostMethod === 'quantity' && (
                        <div>
                          <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Unit / Copy Count</label>
                          <input
                            type="number"
                            min="1"
                            className="form-input"
                            value={m.quantity}
                            onChange={(e) => {
                              const val = e.target.value
                              setSharedMembers((cur) =>
                                cur.map((sm) => (sm.id === m.id ? { ...sm, quantity: val } : sm))
                              )
                            }}
                          />
                        </div>
                      )}

                      {sharedCostMethod === 'weighted' && (
                        <div>
                          <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Ratio Weight</label>
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            className="form-input"
                            value={m.weight}
                            onChange={(e) => {
                              const val = e.target.value
                              setSharedMembers((cur) =>
                                cur.map((sm) => (sm.id === m.id ? { ...sm, weight: val } : sm))
                              )
                            }}
                          />
                        </div>
                      )}

                      {sharedCostMethod === 'item_based' && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Assigned Shared Items</label>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {sharedRows.map((r) => {
                              const isChecked = (m.assignedRowIds || []).includes(r.id)
                              return (
                                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: isChecked ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const checked = e.target.checked
                                      setSharedMembers((cur) =>
                                        cur.map((sm) => {
                                          if (sm.id !== m.id) return sm
                                          const prev = sm.assignedRowIds || []
                                          const next = checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                                          return { ...sm, assignedRowIds: next }
                                        })
                                      )
                                    }}
                                  />
                                  <span>{r.itemName || 'Item'} (₹{Number(r.amount).toFixed(2)})</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Payment inputs (Cash / UPI) */}
                      <div>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Cash Paid (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input"
                          placeholder="0.00"
                          value={m.cashPaid}
                          onChange={(e) => {
                            const val = e.target.value
                            setSharedMembers((cur) =>
                              cur.map((sm) => (sm.id === m.id ? { ...sm, cashPaid: val } : sm))
                            )
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>UPI Paid (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input"
                          placeholder="0.00"
                          value={m.upiPaid}
                          onChange={(e) => {
                            const val = e.target.value
                            setSharedMembers((cur) =>
                              cur.map((sm) => (sm.id === m.id ? { ...sm, upiPaid: val } : sm))
                            )
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Balance Remaining</label>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: calc.finalBal > 0 ? '#f59e0b' : '#10b981', paddingTop: '6px' }}>
                          ₹{calc.finalBal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Add-on toggle for Combination mode */}
                    {sharedCostMethod === 'combination' && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#818cf8' }}>
                          <input
                            type="checkbox"
                            checked={m.hasAddons}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setSharedMembers((cur) =>
                                cur.map((sm) => (sm.id === m.id ? { ...sm, hasAddons: checked } : sm))
                              )
                            }}
                          />
                          Individual Add-ons for this member
                        </label>
                        {m.hasAddons && (
                          <div style={{ marginTop: '8px' }}>
                            <ItemRowEditor
                              rows={m.addonRows || []}
                              setRows={(fn) => {
                                setSharedMembers((cur) =>
                                  cur.map((sm) => {
                                    if (sm.id !== m.id) return sm
                                    const nextRows = typeof fn === 'function' ? fn(sm.addonRows || []) : fn
                                    return { ...sm, addonRows: nextRows }
                                  })
                                )
                              }}
                              inventory={inventory}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: 'flex-start', marginTop: '6px' }}
                onClick={() => {
                  setSharedMembers((cur) => [
                    ...cur,
                    {
                      id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      customerId: '',
                      customAmount: '',
                      percentage: '0',
                      quantity: 1,
                      weight: 1,
                      assignedRowIds: [],
                      hasAddons: false,
                      addonRows: [],
                      useAdvance: false,
                      cashPaid: '',
                      upiPaid: '',
                      discountType: 'flat',
                      discountValue: 0,
                    },
                  ])
                }}
              >
                <Plus size={13} /> Add Participating Customer
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setActiveTab('dashboard')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !isSharedAllocationValid}
              style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 600 }}
            >
              <CheckCircle size={16} />
              {isSubmitting ? 'Creating Group Order…' : `Create Shared Order & Generate ${sharedMembers.length} Bills`}
            </button>
          </div>
        </form>
      )}

      {/* ── TAB 3: SPLIT PURCHASE (ITEM-LEVEL ALLOCATION MATRIX) ── */}
      {activeTab === 'split' && (
        <form onSubmit={handleSplitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Meta */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600 }}>Split Order Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Order Date</label>
                <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Project / Batch Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Department Stationery & Print Order..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Group Items to be split */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Purchased Batch Items</h3>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Items will be assigned to individual customers below</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#a3e635' }}>
                  Total: ₹{splitGrandTotal.toFixed(2)}
                </div>
                <div style={{ fontSize: '12px', color: '#38bdf8' }}>
                  Allocated: ₹{totalSplitAllocated.toFixed(2)}
                </div>
              </div>
            </div>

            <QuickAddPanel inventory={inventory} rows={splitRows} setRows={setSplitRows} />
            <ItemRowEditor rows={splitRows} setRows={setSplitRows} inventory={inventory} />
          </div>

          {/* Granular Item-to-Customer Allocation Matrix */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} className="text-accent" /> Granular Item-to-Customer Allocation Matrix
                </h3>
                <div style={{ fontSize: '12px', color: '#71717a' }}>Assign exact quantities of each item to specific participating customers</div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSplitMembers((cur) => [
                    ...cur,
                    {
                      id: `spm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      customerId: '',
                      useAdvance: false,
                      cashPaid: '',
                      upiPaid: '',
                      discountType: 'flat',
                      discountValue: 0,
                    },
                  ])
                }}
              >
                <Plus size={13} /> Add Customer to Split
              </button>
            </div>

            {/* Matrix Table */}
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa' }}>Batch Item</th>
                    <th style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa' }}>Total Qty</th>
                    {splitMembers.map((m, idx) => (
                      <th key={m.id} style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa', minWidth: '150px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                          <select
                            className="form-input"
                            style={{ width: '100%', fontSize: '12px' }}
                            value={m.customerId}
                            onChange={(e) => {
                              const newId = e.target.value
                              setSplitMembers((cur) =>
                                cur.map((sm) => (sm.id === m.id ? { ...sm, customerId: newId } : sm))
                              )
                            }}
                          >
                            <option value="">— Select Customer —</option>
                            {activeCustomers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <span style={{ fontSize: '11px', color: '#71717a' }}>Member {idx + 1}</span>
                        </div>
                      </th>
                    ))}
                    <th style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa' }}>Allocation Status</th>
                  </tr>
                </thead>
                <tbody>
                  {splitRowAllocationStatus.map(({ row, remainingQty, isValid }) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 600 }}>{row.itemName}</div>
                        <div style={{ fontSize: '11px', color: '#71717a' }}>
                          {row.printType} · {row.sides} · ₹{row.unitPrice.toFixed(2)}/unit
                        </div>
                      </td>

                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>
                        {row.qty}
                      </td>

                      {splitMembers.map((m) => {
                        const currentVal = splitItemAllocations[row.id]?.[m.id] ?? ''
                        return (
                          <td key={m.id} style={{ padding: '10px', textAlign: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              max={row.qty}
                              className="form-input"
                              style={{ width: '70px', textAlign: 'center', margin: '0 auto', fontSize: '12px' }}
                              placeholder="0"
                              value={currentVal}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value))
                                setSplitItemAllocations((cur) => ({
                                  ...cur,
                                  [row.id]: {
                                    ...(cur[row.id] || {}),
                                    [m.id]: val,
                                  },
                                }))
                              }}
                            />
                          </td>
                        )
                      })}

                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: !isValid
                              ? 'rgba(239,68,68,0.15)'
                              : remainingQty === 0
                                ? 'rgba(16,185,129,0.15)'
                                : 'rgba(245,158,11,0.15)',
                            color: !isValid
                              ? '#ef4444'
                              : remainingQty === 0
                                ? '#10b981'
                                : '#f59e0b',
                          }}
                        >
                          {!isValid
                            ? `Over by ${Math.abs(remainingQty)}`
                            : remainingQty === 0
                              ? 'Fully Allocated'
                              : `${remainingQty} unallocated`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Settlement & Payment Matrix */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wallet size={15} className="text-accent" /> Payment &amp; Settlement Preset
                </h4>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${splitSettlementPreset === 'equal' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px' }}
                    onClick={applySplitPresetEqual}
                  >
                    Everyone Pays Own Share
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${splitSettlementPreset === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px' }}
                    onClick={() => {
                      if (splitMembers[0]?.customerId) {
                        applySplitPresetSingle(splitMembers[0].customerId)
                      }
                    }}
                  >
                    Single Payer / Sponsor
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${splitSettlementPreset === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px' }}
                    onClick={() => setSplitSettlementPreset('custom')}
                  >
                    Custom Amounts
                  </button>
                </div>
              </div>

              {/* Member Settlement Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                {splitMemberCalculations.map((calc, idx) => {
                  const m = calc.member
                  return (
                    <div
                      key={m.id}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '6px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>
                          {calc.customer?.name || `Customer ${idx + 1}`}
                        </span>
                        <strong style={{ color: '#a3e635' }}>₹{calc.memberNetTotal.toFixed(2)}</strong>
                      </div>

                      {calc.advanceAvail > 0 && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#10b981', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={m.useAdvance}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setSplitMembers((cur) =>
                                cur.map((sm) => (sm.id === m.id ? { ...sm, useAdvance: checked } : sm))
                              )
                            }}
                          />
                          Use Advance (₹{calc.advanceAvail.toFixed(2)} avail)
                        </label>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: '10px', color: '#71717a' }}>Cash (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            style={{ fontSize: '12px', padding: '3px 6px' }}
                            value={m.cashPaid}
                            onChange={(e) => {
                              const val = e.target.value
                              setSplitMembers((cur) =>
                                cur.map((sm) => (sm.id === m.id ? { ...sm, cashPaid: val } : sm))
                              )
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: '#71717a' }}>UPI (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            style={{ fontSize: '12px', padding: '3px 6px' }}
                            value={m.upiPaid}
                            onChange={(e) => {
                              const val = e.target.value
                              setSplitMembers((cur) =>
                                cur.map((sm) => (sm.id === m.id ? { ...sm, upiPaid: val } : sm))
                              )
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px' }}>
                        <span style={{ color: '#71717a' }}>Remaining Balance:</span>
                        <strong style={{ color: calc.finalBal > 0 ? '#f59e0b' : '#10b981' }}>
                          ₹{calc.finalBal.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setActiveTab('dashboard')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 600 }}
            >
              <CheckCircle size={16} />
              {isSubmitting ? 'Creating Split Order…' : `Generate Split Purchase & ${splitMembers.length} Bills`}
            </button>
          </div>
        </form>
      )}

      {/* ── Add New Customer Modal ── */}
      <AddCustomerModal
        isOpen={showAddCustomerModal}
        onClose={() => {
          setShowAddCustomerModal(false)
          setCustomerModalTarget(null)
        }}
        onCustomerAdded={(newCust) => {
          if (customerModalTarget?.mode === 'shared') {
            setSharedMembers((cur) =>
              cur.map((sm) =>
                sm.id === customerModalTarget.memberId ? { ...sm, customerId: newCust.id } : sm
              )
            )
          } else if (customerModalTarget?.mode === 'split') {
            setSplitMembers((cur) =>
              cur.map((sm) =>
                sm.id === customerModalTarget.memberId ? { ...sm, customerId: newCust.id } : sm
              )
            )
          }
        }}
      />

      {/* ── Settle Balance Modal ── */}
      {settleModalGroup && (
        <SettleModal
          group={settleModalGroup}
          bills={bills}
          customers={customers}
          onClose={() => setSettleModalGroup(null)}
          onPaymentRecorded={() => {
            showToast('Settlement recorded successfully', 'success')
          }}
        />
      )}

      {/* ── Cancel Group Modal ── */}
      {cancelModalGroup && (
        <CancelGroupModal
          group={cancelModalGroup}
          onClose={() => setCancelModalGroup(null)}
          onCancelled={() => {
            showToast('Group transaction cancelled', 'success')
          }}
        />
      )}

      {/* ── Group Details Modal ── */}
      {detailsModalGroup && (
        <GroupDetailsModal
          group={detailsModalGroup}
          bills={bills}
          customers={customers}
          payments={payments}
          onClose={() => setDetailsModalGroup(null)}
          onSettle={(grp) => setSettleModalGroup(grp)}
          onOpenReceipt={(grp) => setActiveReceiptGroup(grp)}
        />
      )}

      {/* ── Receipt Modal (Master & Member Invoices, A4 & Thermal POS, PDF & WhatsApp) ── */}
      {activeReceiptGroup && (
        <SplitReceiptModal
          group={activeReceiptGroup}
          onClose={() => setActiveReceiptGroup(null)}
        />
      )}
    </div>
  )
}

// ── Split / Group Receipt Modal ───────────────────────────────────────────────
const SplitReceiptModal = ({ group, onClose }) => {
  const { bills, business } = useAppContext()
  const [viewMode, setViewMode] = useState('master') // 'master' | 'member'
  const [receiptFormat, setReceiptFormat] = useState('a4') // 'a4' | 'thermal'

  const memberBills = useMemo(() => {
    if (!group) return []
    let list = (group.memberBillIds || [])
      .map((id) => bills.find((b) => b.id === id && !b.deleted))
      .filter(Boolean)
    if (list.length === 0 && group.id) {
      list = bills.filter((b) => (b.groupBillId === group.id || b.splitPurchaseId === group.id) && !b.deleted)
    }
    return list
  }, [group, bills])

  const [selectedBillId, setSelectedBillId] = useState(() => memberBills[0]?.id || '')

  const selectedBill = useMemo(() => {
    return memberBills.find((b) => b.id === selectedBillId) || memberBills[0] || null
  }, [memberBills, selectedBillId])

  const totalAmount = memberBills.reduce((s, b) => s + Number(b.total || 0), 0)
  const paidAmount = memberBills.reduce((s, b) => s + Number(b.amountPaid || 0), 0)
  const balanceAmount = memberBills.reduce((s, b) => s + Number(b.balance || 0), 0)
  const isSettled = balanceAmount <= 0.01

  const isSplit = group?.type === 'split'
  const displayId = isSplit ? getDisplaySplitPurchaseId(group) : getDisplayGroupId(group)

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      const MARGIN = 12
      let y = 14

      // Header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(30, 41, 59)
      doc.text(business?.shopName || 'PrintPro', W / 2, y, { align: 'center' })
      y += 5

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      if (business?.address) {
        doc.text(business.address, W / 2, y, { align: 'center' })
        y += 4
      }
      const contacts = [
        business?.phone ? `Phone: ${business.phone}` : '',
        business?.gstin ? `GSTIN: ${business.gstin}` : '',
      ]
        .filter(Boolean)
        .join(' | ')
      if (contacts) {
        doc.text(contacts, W / 2, y, { align: 'center' })
        y += 4
      }

      doc.setDrawColor(203, 213, 225)
      doc.line(MARGIN, y, W - MARGIN, y)
      y += 6

      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(79, 70, 229)
      const receiptTitle = isSplit
        ? 'GROUP SPLIT PURCHASE INVOICE & SETTLEMENT'
        : 'GROUP SHARED PURCHASE INVOICE & SETTLEMENT'
      doc.text(receiptTitle, W / 2, y, { align: 'center' })
      y += 7

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(30, 41, 59)
      doc.text(`${isSplit ? 'Split Purchase ID:' : 'Group ID:'} ${displayId}`, MARGIN, y)
      doc.text(`Date: ${group.date || new Date().toISOString().slice(0, 10)}`, W - MARGIN, y, { align: 'right' })
      y += 5

      doc.text(`Participating Members: ${memberBills.length}`, MARGIN, y)
      doc.text(`Status: ${isSettled ? 'FULLY SETTLED' : 'PARTIALLY SETTLED'}`, W - MARGIN, y, { align: 'right' })
      y += 7

      // Table Header
      doc.setFillColor(241, 245, 249)
      doc.rect(MARGIN, y, W - MARGIN * 2, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      doc.text('Bill ID', MARGIN + 2, y + 4.5)
      doc.text('Customer Name', MARGIN + 30, y + 4.5)
      doc.text('Total (Rs)', W - MARGIN - 55, y + 4.5, { align: 'right' })
      doc.text('Paid (Rs)', W - MARGIN - 30, y + 4.5, { align: 'right' })
      doc.text('Balance (Rs)', W - MARGIN - 2, y + 4.5, { align: 'right' })
      y += 8

      // Table Rows
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 41, 59)
      memberBills.forEach((b) => {
        doc.text(getDisplayBillId(b), MARGIN + 2, y + 4)
        doc.text(b.customerName || '—', MARGIN + 30, y + 4)
        doc.text(Number(b.total || 0).toFixed(2), W - MARGIN - 55, y + 4, { align: 'right' })
        doc.text(Number(b.amountPaid || 0).toFixed(2), W - MARGIN - 30, y + 4, { align: 'right' })
        doc.text(Number(b.balance || 0).toFixed(2), W - MARGIN - 2, y + 4, { align: 'right' })
        y += 6
      })

      y += 4
      doc.line(MARGIN, y, W - MARGIN, y)
      y += 6

      // Totals
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Group Total Amount:', W - MARGIN - 60, y)
      doc.text(`Rs ${totalAmount.toFixed(2)}`, W - MARGIN, y, { align: 'right' })
      y += 5
      doc.text('Total Amount Paid:', W - MARGIN - 60, y)
      doc.text(`Rs ${paidAmount.toFixed(2)}`, W - MARGIN, y, { align: 'right' })
      y += 5
      doc.text('Total Outstanding Balance:', W - MARGIN - 60, y)
      doc.text(`Rs ${balanceAmount.toFixed(2)}`, W - MARGIN, y, { align: 'right' })

      doc.save(`${displayId}_Receipt.pdf`)
    } catch (err) {
      alert(`Could not generate PDF: ${err.message}`)
    }
  }

  const handleShareWhatsApp = () => {
    let text = `*${business?.shopName || 'PrintPro'}*\n`
    text += `*${isSplit ? 'Split Purchase' : 'Shared Purchase'} ${displayId}*\n`
    text += `Date: ${group.date || new Date().toISOString().slice(0, 10)}\n`
    text += `Status: ${isSettled ? 'FULLY SETTLED' : 'PARTIALLY SETTLED'}\n`
    text += `--------------------------------\n`
    text += `*Total Amount:* ₹${totalAmount.toFixed(2)}\n`
    text += `*Amount Paid:* ₹${paidAmount.toFixed(2)}\n`
    text += `*Outstanding Balance:* ₹${balanceAmount.toFixed(2)}\n`
    text += `--------------------------------\n`
    text += `*Member Breakdown:*\n`
    memberBills.forEach((b, i) => {
      text += `${i + 1}. ${b.customerName}: ₹${Number(b.total).toFixed(2)} (${b.status.toUpperCase()})\n`
    })
    text += `--------------------------------\n`
    text += `Thank you for your business!`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', width: '95%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <FileText size={18} className="text-accent" />
            <h3 style={{ margin: 0, fontSize: '16px' }}>Invoice &amp; Settlement Receipt</h3>
          </div>
          <button className="modal-close btn-icon" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {/* View & Format Toggle Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'master' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px' }}
                onClick={() => setViewMode('master')}
              >
                Master Group Receipt
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'member' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px' }}
                onClick={() => setViewMode('member')}
              >
                Individual Member Bill
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${receiptFormat === 'a4' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => setReceiptFormat('a4')}
              >
                A4 Standard
              </button>
              <button
                type="button"
                className={`btn btn-sm ${receiptFormat === 'thermal' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => setReceiptFormat('thermal')}
              >
                Thermal POS
              </button>
            </div>
          </div>

          {viewMode === 'member' && (
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Select Member:</span>
              <select
                className="form-input"
                style={{ flex: 1, fontSize: '12px' }}
                value={selectedBillId}
                onChange={(e) => setSelectedBillId(e.target.value)}
              >
                {memberBills.map((b, i) => (
                  <option key={b.id} value={b.id}>
                    {i + 1}. {b.customerName} ({getDisplayBillId(b)}) — ₹{Number(b.total).toFixed(2)} ({b.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Visual Receipt Paper Render */}
          <div
            style={{
              background: '#ffffff',
              color: '#0f172a',
              padding: receiptFormat === 'thermal' ? '16px' : '24px 28px',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontFamily: receiptFormat === 'thermal' ? '"Courier New", Courier, monospace' : 'Arial, sans-serif',
              fontSize: receiptFormat === 'thermal' ? '11px' : '12px',
              lineHeight: '1.5',
              maxWidth: receiptFormat === 'thermal' ? '320px' : '100%',
              margin: '0 auto',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', paddingBottom: '10px', borderBottom: '2px solid #334155', marginBottom: '12px' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: receiptFormat === 'thermal' ? '15px' : '18px', fontWeight: 'bold', color: '#0f172a' }}>
                {business?.shopName || 'PrintPro'}
              </h2>
              {business?.address && <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>{business.address}</p>}
              <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                {[business?.phone ? `Phone: ${business.phone}` : '', business?.gstin ? `GSTIN: ${business.gstin}` : '']
                  .filter(Boolean)
                  .join(' | ')}
              </p>
            </div>

            {viewMode === 'master' ? (
              /* MASTER RECEIPT */
              <div>
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#4f46e5' }}>
                    {isSplit ? 'GROUP SPLIT PURCHASE INVOICE & SETTLEMENT' : 'GROUP SHARED PURCHASE INVOICE'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span><strong>{isSplit ? 'Split Purchase ID:' : 'Group ID:'}</strong> {displayId}</span>
                  <span><strong>Date:</strong> {group.date || new Date().toISOString().slice(0, 10)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span><strong>Participating Members:</strong> {memberBills.length}</span>
                  <span><strong>Status:</strong> <strong style={{ color: isSettled ? '#10b981' : '#f59e0b' }}>{isSettled ? 'FULLY SETTLED' : 'PARTIALLY SETTLED'}</strong></span>
                </div>

                <hr style={{ borderColor: '#cbd5e1', margin: '8px 0' }} />

                {/* Member Breakdown Table */}
                <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '6px', color: '#334155' }}>
                  Member Settlement Breakdown
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '4px' }}>Bill ID</th>
                      <th style={{ textAlign: 'left', padding: '4px' }}>Customer</th>
                      <th style={{ textAlign: 'right', padding: '4px' }}>Total</th>
                      <th style={{ textAlign: 'right', padding: '4px' }}>Paid</th>
                      <th style={{ textAlign: 'right', padding: '4px' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberBills.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px', fontWeight: 600 }}>{getDisplayBillId(b)}</td>
                        <td style={{ padding: '4px' }}>{b.customerName}</td>
                        <td style={{ padding: '4px', textAlign: 'right' }}>₹{Number(b.total).toFixed(2)}</td>
                        <td style={{ padding: '4px', textAlign: 'right', color: '#16a34a' }}>₹{Number(b.amountPaid || 0).toFixed(2)}</td>
                        <td style={{ padding: '4px', textAlign: 'right', color: Number(b.balance) > 0 ? '#d97706' : '#16a34a' }}>₹{Number(b.balance || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ borderTop: '2px solid #334155', paddingTop: '8px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>Group Total Amount:</span>
                    <strong>₹{totalAmount.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#16a34a' }}>
                    <span>Total Amount Paid:</span>
                    <strong>₹{paidAmount.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: balanceAmount > 0.01 ? '#d97706' : '#16a34a' }}>
                    <span>Total Outstanding Balance:</span>
                    <span>₹{balanceAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : selectedBill ? (
              /* INDIVIDUAL MEMBER VIEW */
              <div>
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#4f46e5' }}>
                    CUSTOMER INVOICE
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span><strong>Bill Number:</strong> {getDisplayBillId(selectedBill)}</span>
                  <span><strong>Date:</strong> {selectedBill.date || new Date().toISOString().slice(0, 10)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span><strong>Customer:</strong> {selectedBill.customerName}</span>
                  <span><strong>Group Ref:</strong> {displayId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span><strong>Payment Status:</strong> {selectedBill.status.toUpperCase()}</span>
                  {selectedBill.dueDate && <span><strong>Due:</strong> {selectedBill.dueDate}</span>}
                </div>

                <hr style={{ borderColor: '#cbd5e1', margin: '8px 0' }} />

                {/* Items */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '4px' }}>Item</th>
                      <th style={{ textAlign: 'center', padding: '4px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '4px' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '4px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedBill.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px' }}>{it.itemName || 'Print Item'}</td>
                        <td style={{ padding: '4px', textAlign: 'center' }}>{it.qty}</td>
                        <td style={{ padding: '4px', textAlign: 'right' }}>₹{Number(it.unitPrice || 0).toFixed(2)}</td>
                        <td style={{ padding: '4px', textAlign: 'right' }}>₹{Number(it.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ borderTop: '2px solid #334155', paddingTop: '8px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>Bill Subtotal:</span>
                    <span>₹{Number(selectedBill.subtotal || selectedBill.total || 0).toFixed(2)}</span>
                  </div>
                  {Number(selectedBill.gstAmount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span>GST:</span>
                      <span>₹{Number(selectedBill.gstAmount).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(selectedBill.discountAmount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#16a34a' }}>
                      <span>Discount:</span>
                      <span>-₹{Number(selectedBill.discountAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontWeight: 'bold' }}>
                    <span>Total Amount:</span>
                    <span>₹{Number(selectedBill.total || 0).toFixed(2)}</span>
                  </div>
                  {Number(selectedBill.advanceUsed || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#4f46e5' }}>
                      <span>Advance Applied:</span>
                      <span>₹{Number(selectedBill.advanceUsed).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#16a34a' }}>
                    <span>Amount Paid:</span>
                    <span>₹{Number(selectedBill.amountPaid || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: Number(selectedBill.balance) > 0 ? '#d97706' : '#16a34a' }}>
                    <span>Remaining Balance:</span>
                    <span>₹{Number(selectedBill.balance || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : null}

            <div style={{ textAlign: 'center', marginTop: '14px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '10px', color: '#64748b' }}>
              Thank you for choosing {business?.shopName || 'PrintPro'}!
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <Printer size={14} /> Print
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadPDF}>
              <Download size={14} /> Download PDF
            </button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ color: '#10b981' }} onClick={handleShareWhatsApp}>
              <MessageCircle size={14} /> Share on WhatsApp
            </button>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupBilling
