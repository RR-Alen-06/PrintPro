import React, { useState, useMemo } from 'react'
import { Users, Plus, Trash2, CheckCircle, AlertTriangle, Wallet, X, ChevronDown, Tag, Percent, ArrowLeftRight } from 'lucide-react'
import { useAppContext } from '../context/AppContext'

const makeItemRow = (inventory) => ({
  id: `row-${Date.now()}-${Math.random()}`,
  itemId: inventory[0]?.id || '',
  itemName: inventory[0]?.name || 'Custom Item',
  isCustom: false,
  printType: 'color',
  sides: 'single',
  qty: 1,
  unitPrice: inventory[0]?.colorSingle ?? 10,
  amount: inventory[0]?.colorSingle ?? 10,
  gstRate: 0,
})

const makeCustomRow = () => ({
  id: `row-${Date.now()}-${Math.random()}`,
  itemId: '',
  itemName: '',
  isCustom: true,
  printType: 'color',
  sides: 'single',
  qty: 1,
  unitPrice: 0,
  amount: 0,
  gstRate: 0,
})

const getItemBasePrice = (inventory, itemId, printType, sides) => {
  const item = inventory.find((e) => e.id === itemId)
  if (!item) return 0
  if (printType === 'color' && sides === 'single') return item.colorSingle
  if (printType === 'color' && sides === 'double') return item.colorDouble
  if (printType === 'bw' && sides === 'single') return item.bwSingle
  if (printType === 'bw' && sides === 'double') return item.bwDouble
  return 0
}

// ── QuickAddPanel: inventory-based job template quick-add buttons ──────────────
// Uses rows+setRows so it can increment qty instead of adding duplicates
const QuickAddPanel = ({ inventory, rows, setRows }) => {
  if (!inventory || inventory.length === 0) return null

  const handleQuickAdd = (itemId, itemName, printType, sides, price) => {
    setRows((cur) => {
      const existing = cur.find(
        (r) => !r.isCustom && r.itemId === itemId && r.printType === printType && r.sides === sides
      )
      if (existing) {
        // Increment qty of existing row
        return cur.map((r) =>
          r.id === existing.id
            ? { ...r, qty: Number(r.qty) + 1, amount: r.unitPrice * (Number(r.qty) + 1) }
            : r
        )
      }
      // Add new row
      return [
        ...cur,
        {
          id: `row-${Date.now()}-${Math.random()}`,
          itemId,
          itemName,
          isCustom: false,
          printType,
          sides,
          qty: 1,
          unitPrice: price,
          amount: price,
          gstRate: 0,
        },
      ]
    })
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.08)' }}>
      <span style={{ fontSize: '11px', color: '#71717a', alignSelf: 'center', marginRight: '4px', fontWeight: 600 }}>Quick Add:</span>
      {inventory.flatMap((item) =>
        [['color', 'single'], ['color', 'double'], ['bw', 'single'], ['bw', 'double']].map(([printType, sides]) => {
          const price = getItemBasePrice(inventory, item.id, printType, sides)
          if (!price) return null
          const label = `${item.name} ${printType === 'bw' ? 'B&W' : 'Color'} ${sides === 'single' ? 'Single' : 'Double'}`
          const existing = rows?.find(
            (r) => !r.isCustom && r.itemId === item.id && r.printType === printType && r.sides === sides
          )
          return (
            <button
              key={`${item.id}-${printType}-${sides}`}
              type="button"
              onClick={() => handleQuickAdd(item.id, item.name, printType, sides, price)}
              style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '16px', whiteSpace: 'nowrap', cursor: 'pointer',
                border: existing ? '1px solid #f59e0b' : '1px solid rgba(245,158,11,0.3)',
                background: existing ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.06)',
                color: existing ? '#f59e0b' : '#a1a1aa',
              }}
            >
              {label}{existing ? ` ×${existing.qty}` : ''}
            </button>
          )
        }).filter(Boolean)
      )}
    </div>
  )
}

// ── Shared-items row editor ───────────────────────────────────────────────────
const ItemRowEditor = ({ rows, setRows, inventory }) => {
  const updateRow = (rowId, changes) => {
    setRows((cur) =>
      cur.map((r) => {
        if (r.id !== rowId) return r
        const unitPrice =
          changes.unitPrice !== undefined
            ? Number(changes.unitPrice)
            : changes.itemId || changes.printType || changes.sides
              ? getItemBasePrice(inventory, changes.itemId ?? r.itemId, changes.printType ?? r.printType, changes.sides ?? r.sides)
              : r.unitPrice
        const qty = changes.qty !== undefined ? Number(changes.qty) : r.qty
        return { ...r, ...changes, unitPrice, qty, amount: unitPrice * qty }
      })
    )
  }

  const removeRow = (rowId) => setRows((cur) => cur.filter((r) => r.id !== rowId))

  const addRow = () => {
    setRows((cur) => {
      // Find first unused config in inventory
      for (const item of inventory) {
        for (const [printType, sides] of [['color', 'single'], ['color', 'double'], ['bw', 'single'], ['bw', 'double']]) {
          const price = getItemBasePrice(inventory, item.id, printType, sides)
          if (price <= 0) continue

          const exists = cur.some(
            (r) => !r.isCustom && r.itemId === item.id && r.printType === printType && r.sides === sides
          )
          if (!exists) {
            return [
              ...cur,
              {
                id: `row-${Date.now()}-${Math.random()}`,
                itemId: item.id,
                itemName: item.name,
                isCustom: false,
                printType,
                sides,
                qty: 1,
                unitPrice: price,
                amount: price,
                gstRate: 0,
              },
            ]
          }
        }
      }
      alert("All available product configurations are already added.")
      return cur
    })
  }

  const addCustom = () => setRows((cur) => [...cur, makeCustomRow()])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {rows.map((row) => (
        <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 90px 60px 90px 80px 1fr 32px', gap: '6px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px' }}>
          {row.isCustom ? (
            <input
              className="form-input" style={{ fontSize: '13px', padding: '5px 8px' }}
              placeholder="Item name"
              value={row.itemName}
              onChange={(e) => updateRow(row.id, { itemName: e.target.value })}
            />
          ) : (
            <select className="form-input" style={{ fontSize: '13px', padding: '5px 8px' }}
              value={row.itemId}
              onChange={(e) => {
                const newId = e.target.value
                const isDup = rows.some((r) => r.id !== row.id && !r.isCustom && r.itemId === newId && r.printType === row.printType && r.sides === row.sides)
                if (isDup) {
                  alert("This product configuration is already added.")
                  return
                }
                const inv = inventory.find((i) => i.id === newId)
                updateRow(row.id, { itemId: newId, itemName: inv?.name || '' })
              }}
            >
              {inventory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          )}
          <select className="form-input" style={{ fontSize: '12px', padding: '5px 6px' }} value={row.printType}
            onChange={(e) => {
              const newPrintType = e.target.value
              const isDup = rows.some((r) => r.id !== row.id && !r.isCustom && r.itemId === row.itemId && r.printType === newPrintType && r.sides === row.sides)
              if (isDup) {
                alert("This product configuration is already added.")
                return
              }
              updateRow(row.id, { printType: newPrintType })
            }}
            disabled={row.isCustom}
          >
            <option value="color">Color</option>
            <option value="bw">B/W</option>
          </select>
          <select className="form-input" style={{ fontSize: '12px', padding: '5px 6px' }} value={row.sides}
            onChange={(e) => {
              const newSides = e.target.value
              const isDup = rows.some((r) => r.id !== row.id && !r.isCustom && r.itemId === row.itemId && r.printType === row.printType && r.sides === newSides)
              if (isDup) {
                alert("This product configuration is already added.")
                return
              }
              updateRow(row.id, { sides: newSides })
            }}
            disabled={row.isCustom}
          >
            <option value="single">Single</option>
            <option value="double">Double</option>
          </select>
          <input className="form-input" style={{ fontSize: '13px', padding: '5px 6px', textAlign: 'center' }} type="number" min="1" value={row.qty} onChange={(e) => updateRow(row.id, { qty: e.target.value })} />
          <input className="form-input" style={{ fontSize: '13px', padding: '5px 6px' }} type="number" min="0" step="0.01" value={row.unitPrice} onChange={(e) => updateRow(row.id, { unitPrice: e.target.value })} />
          <select className="form-input" style={{ fontSize: '12px', padding: '5px 6px' }} value={row.gstRate || 0}
            onChange={(e) => updateRow(row.id, { gstRate: Number(e.target.value) })}
          >
            <option value={0}>0%</option>
            <option value={5}>5%</option>
            <option value={12}>12%</option>
            <option value={18}>18%</option>
          </select>
          <div style={{ fontSize: '13px', color: '#a3e635', fontWeight: 600, textAlign: 'right' }}>₹{Number(row.amount || 0).toFixed(2)}</div>
          <button type="button" onClick={() => removeRow(row.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><Trash2 size={14} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button type="button" className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={addRow}><Plus size={13} /> Add Item</button>
        <button type="button" className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={addCustom}><Plus size={13} /> Custom Item</button>
      </div>
    </div>
  )
}

// ── Member card (Case 1 & 2) ──────────────────────────────────────────────────
const MemberCard = ({ member, idx, members, customers, inventory, onChange, onRemove, settings, promoCodes, date, memberTotals, sharedRows, onAddNewCustomerClick, sharedDiscountMode, sharedGroupDiscount }) => {
  const customer = customers.find((c) => c.id === member.customerId)
  const advance = Number(customer?.advanceBalance || customer?.creditBalance || 0)
  const loyaltyEnabled = settings?.loyaltyEnabled !== false
  const loyaltyRedeemEnabled = settings?.loyaltyRedeemEnabled !== false
  const hasLoyalty = customer && customer.type === 'regular' && loyaltyEnabled && loyaltyRedeemEnabled

  const sharedGst = (sharedRows || []).reduce((sum, r) => sum + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0)
  const addonGst = member.hasAddons ? (member.addonRows || []).reduce((sum, r) => sum + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0) : 0
  const autoGst = sharedGst + addonGst

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'var(--accent)', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff' }}>{idx + 1}</div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <select className="form-input" style={{ minWidth: '180px', fontSize: '13px' }} value={member.customerId}
              onChange={(e) => onChange(member.id, { customerId: e.target.value })}>
              <option value="">— Select Customer —</option>
              {customers.filter((c) => !c.deleted && !members.some(m => m.id !== member.id && m.customerId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 8px', height: '38px', minHeight: 'unset' }}
              onClick={() => onAddNewCustomerClick(member.id)}
              title="Add New Customer"
            >
              <Plus size={14} />
            </button>
          </div>
          {advance > 0 && (
            <span style={{ fontSize: '12px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
              <Wallet size={11} style={{ marginRight: '3px' }} />Advance ₹{advance.toFixed(2)}
            </span>
          )}
        </div>
        <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={16} /></button>
      </div>

      {/* Addon items toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <label style={{ fontSize: '13px', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={member.hasAddons} onChange={(e) => onChange(member.id, { hasAddons: e.target.checked })} />
          Individual add-on items for this customer
        </label>
      </div>

      {member.hasAddons && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '12px', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '8px' }}>Add-on items (only for this customer):</div>
          <QuickAddPanel
            inventory={inventory}
            rows={member.addonRows || []}
            setRows={(fn) => onChange(member.id, { addonRows: typeof fn === 'function' ? fn(member.addonRows || []) : fn })}
          />
          <ItemRowEditor rows={member.addonRows} setRows={(fn) => onChange(member.id, { addonRows: typeof fn === 'function' ? fn(member.addonRows) : fn })} inventory={inventory} />
        </div>
      )}

      {/* Discount & GST */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
        {sharedDiscountMode === 'group' && (
          <div style={{ fontSize: '12px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            Group Discount: {sharedGroupDiscount.type === 'percent' ? `${sharedGroupDiscount.value}% Off` : `₹${Number(sharedGroupDiscount.value || 0).toFixed(2)} Flat`} (Applied)
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#71717a' }}>{sharedDiscountMode === 'group' ? 'Indiv. Discount:' : 'Discount:'}</span>
          <select className="form-input" style={{ width: '90px', fontSize: '12px', padding: '4px 6px' }} value={member.discountType}
            onChange={(e) => onChange(member.id, { discountType: e.target.value })}>
            <option value="flat">₹ Flat</option>
            <option value="percent">% Off</option>
          </select>
          <input className="form-input" style={{ width: '80px', fontSize: '12px', padding: '4px 6px' }} type="number" min="0" step="0.01"
            value={member.discountValue} onChange={(e) => onChange(member.id, { discountValue: Number(e.target.value) })} />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#71717a' }}>Edit GST:</span>
          <input
            className="form-input"
            style={{ width: '100px', fontSize: '12px', padding: '4px 6px' }}
            type="number"
            step="0.01"
            min="0"
            placeholder={`Auto: ₹${autoGst.toFixed(2)}`}
            value={member.customGst || ''}
            onChange={(e) => onChange(member.id, { customGst: e.target.value })}
          />
        </div>
      </div>

      {/* Promo Code */}
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!member.usePromoCode}
            onChange={(e) => {
              onChange(member.id, {
                usePromoCode: e.target.checked,
                appliedPromo: e.target.checked ? member.appliedPromo : null,
                promoCodeInput: e.target.checked ? member.promoCodeInput || '' : ''
              })
            }}
          />
          <span>Apply Promo Code for this customer</span>
        </label>
        {member.usePromoCode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                className="form-input"
                style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
                placeholder="PROMO CODE"
                value={member.promoCodeInput || ''}
                onChange={(e) => onChange(member.id, { promoCodeInput: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '4px 12px' }}
                onClick={() => {
                  const code = (member.promoCodeInput || '').trim().toUpperCase()
                  if (!code) return
                  const promo = promoCodes?.find(p => p.code === code)
                  if (!promo) {
                    onChange(member.id, { promoError: 'Invalid promo code' })
                    return
                  }
                  if (promo.enabled === false) {
                    onChange(member.id, { promoError: 'This coupon is disabled.' })
                    return
                  }

                  // Date validity check
                  const billDate = date || new Date().toISOString().slice(0, 10)
                  if (promo.startDate && billDate < promo.startDate) {
                    onChange(member.id, { promoError: `Valid from ${promo.startDate}` })
                    return
                  }
                  if (promo.endDate && billDate > promo.endDate) {
                    onChange(member.id, { promoError: `Expired on ${promo.endDate}` })
                    return
                  }

                  const mSubtotal = memberTotals[idx]?.subtotal || 0
                  if (mSubtotal < promo.minAmount) {
                    onChange(member.id, { promoError: `Min amount ₹${promo.minAmount}` })
                    return
                  }
                  onChange(member.id, { appliedPromo: promo, promoError: '', promoCodeInput: '' })
                }}
              >
                Apply
              </button>
            </div>
            {member.promoError && <p style={{ color: 'var(--error)', fontSize: '0.75rem', margin: 0 }}>{member.promoError}</p>}
            {member.appliedPromo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>
                <Tag size={10} /> Applied: {member.appliedPromo.code} ({member.appliedPromo.type === 'percent' ? `${member.appliedPromo.value}% off` : `₹${member.appliedPromo.value} off`})
                <button
                  type="button"
                  className="btn btn-link btn-sm"
                  style={{ color: 'var(--error)', padding: 0, fontSize: '0.75rem' }}
                  onClick={() => onChange(member.id, { appliedPromo: null })}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loyalty Points */}
      {hasLoyalty && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px' }}>
          <div style={{ fontSize: '12px', color: '#a1a1aa' }}>
            Loyalty Balance: <strong style={{ color: 'var(--accent)' }}>{customer.loyaltyPoints || 0}</strong> pts
            {customer.loyaltyPoints > 0 && (
              <span> (value: ₹{((customer.loyaltyPoints * (settings.loyaltyRedeemRatioRupees || 5)) / (settings.loyaltyRedeemRatioPoints || 150)).toFixed(2)})</span>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={!!member.shouldRedeemPoints}
              onChange={(e) => {
                onChange(member.id, {
                  shouldRedeemPoints: e.target.checked,
                  loyaltyPointsRedeemed: e.target.checked ? member.loyaltyPointsRedeemed || 0 : 0
                })
              }}
            />
            <span>Redeem points for this customer</span>
          </label>

          {member.shouldRedeemPoints && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: '#71717a' }}>Redeem:</span>
              <select
                className="form-select"
                style={{ fontSize: '12px', padding: '4px 6px', width: '220px' }}
                value={member.loyaltyPointsRedeemed || ''}
                onChange={(e) => {
                  onChange(member.id, { loyaltyPointsRedeemed: Number(e.target.value) })
                }}
              >
                <option value="">-- Select Option --</option>
                {(settings.loyaltyRedeemOptions || [
                  { points: 100, rupees: 2.5 },
                  { points: 120, rupees: 3 },
                  { points: 150, rupees: 5 },
                ]).map((opt) => {
                  const maxPts = customer.loyaltyPoints || 0
                  const isDisabled = opt.points > maxPts
                  return (
                    <option key={opt.points} value={opt.points} disabled={isDisabled}>
                      {opt.points} pts = ₹{opt.rupees} {isDisabled ? '(Insufficient)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Advance usage */}
      {advance > 0 && (
        <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(16,185,129,0.07)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={member.useAdvance}
              onChange={(e) => onChange(member.id, { useAdvance: e.target.checked })} />
            Use advance balance (₹{advance.toFixed(2)}) to cover this bill
          </label>
        </div>
      )}
    </div>
  )
}

// ── Main GroupBilling Component ───────────────────────────────────────────────
const GroupBilling = () => {
  const { customers, inventory, bills, addGroupBill, showAlert, showToast, settings, promoCodes, addCustomer } = useAppContext()

  // ── Inline Add Customer modal state ─────────────────────────────────────────
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [modalTriggerInfo, setModalTriggerInfo] = useState({ memberId: null, mode: 'shared' })
  const [newCustomerForm, setNewCustomerForm] = useState({
    type: 'regular',
    name: '',
    phone: '',
    email: '',
    openingBalanceMethod: 'none',
    openingCash: '',
    openingUpi: ''
  })
  const [newCustomerErrors, setNewCustomerErrors] = useState({})
  const [newCustomerSuccess, setNewCustomerSuccess] = useState('')

  const [mode, setMode] = useState('shared') // 'shared' | 'split'
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10)
  })
  const [notes, setNotes] = useState('')
  const [lastGroupId, setLastGroupId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Shared/Addon mode state ─────────────────────────────────────────────────
  const [sharedRows, setSharedRows] = useState(() => [makeItemRow(inventory)])
  const [members, setMembers] = useState([
    { id: `m-${Date.now()}`, customerId: '', hasAddons: false, addonRows: [], discountType: 'flat', discountValue: 0, useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0 },
  ])
  const [sharedDiscountMode, setSharedDiscountMode] = useState('individual') // 'individual' | 'group'
  const [sharedGroupDiscount, setSharedGroupDiscount] = useState({ type: 'flat', value: 0 })

  // ── Split mode state ────────────────────────────────────────────────────────
  const [splitRows, setSplitRows] = useState(() => [makeItemRow(inventory)])
  const [splitMembers, setSplitMembers] = useState([
    { id: `sm-${Date.now()}`, customerId: '', useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, discountType: 'flat', discountValue: 0 },
    { id: `sm-${Date.now()}-2`, customerId: '', useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, discountType: 'flat', discountValue: 0 },
  ])
  const [roundingMode, setRoundingMode] = useState('up') // 'up' | 'down'
  const [splitDiscountMode, setSplitDiscountMode] = useState('individual') // 'individual' | 'group'
  const [splitGroupDiscount, setSplitGroupDiscount] = useState({ type: 'flat', value: 0 })

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers])

  // ── Shared mode calculations ─────────────────────────────────────────────────
  const sharedSubtotal = useMemo(() => sharedRows.reduce((s, r) => s + Number(r.amount || 0), 0), [sharedRows])

  const memberTotals = useMemo(() =>
    members.map((m) => {
      const addonSubtotal = m.hasAddons ? m.addonRows.reduce((s, r) => s + Number(r.amount || 0), 0) : 0
      const baseTotal = sharedSubtotal + addonSubtotal
      const sharedGst = sharedRows.reduce((sum, r) => sum + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0)
      const addonGst = m.hasAddons ? m.addonRows.reduce((sum, r) => sum + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0) : 0
      const autoGst = sharedGst + addonGst
      const gstAmount = m.customGst !== undefined && m.customGst !== '' ? Number(m.customGst) : autoGst
      const cgst = gstAmount / 2
      const sgst = gstAmount / 2

      const groupDisc = sharedDiscountMode === 'group'
        ? (sharedGroupDiscount.type === 'percent'
          ? (baseTotal * Number(sharedGroupDiscount.value || 0)) / 100
          : Number(sharedGroupDiscount.value || 0))
        : 0;
      const individualDisc = m.discountType === 'percent'
        ? (baseTotal * Number(m.discountValue || 0)) / 100
        : Number(m.discountValue || 0);
      const manualDisc = groupDisc + individualDisc;

      let promoDisc = 0
      if (m.appliedPromo) {
        promoDisc = m.appliedPromo.type === 'percent'
          ? (baseTotal * Number(m.appliedPromo.value || 0)) / 100
          : Number(m.appliedPromo.value || 0)
      }

      const disc = manualDisc + promoDisc
      const ptsRedeemed = Number(m.loyaltyPointsRedeemed || 0)
      const redeemOptions = settings?.loyaltyRedeemOptions || [
        { points: 100, rupees: 2.5 },
        { points: 120, rupees: 3 },
        { points: 150, rupees: 5 },
      ]
      const selectedRedeemOpt = redeemOptions.find(o => Number(o.points) === ptsRedeemed)
      const loyaltyDisc = selectedRedeemOpt ? Number(selectedRedeemOpt.rupees) : 0

      return {
        subtotal: baseTotal,
        gstAmount,
        cgst,
        sgst,
        discountAmount: disc,
        loyaltyDiscount: loyaltyDisc,
        total: Math.max(baseTotal + gstAmount - disc - loyaltyDisc, 0)
      }
    }),
    [members, sharedSubtotal, sharedRows, settings, sharedDiscountMode, sharedGroupDiscount]
  )

  // ── Split mode calculations ──────────────────────────────────────────────────
  const splitSubtotal = useMemo(() => splitRows.reduce((s, r) => s + Number(r.amount || 0), 0), [splitRows])
  const splitTotalGst = useMemo(() => splitRows.reduce((sum, r) => sum + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0), [splitRows])
  const splitCount = splitMembers.length
  const rawSplitAmount = splitCount > 0 ? (splitSubtotal + splitTotalGst) / splitCount : 0
  const splitAmount = roundingMode === 'up' ? Math.ceil(rawSplitAmount) : Math.floor(rawSplitAmount)
  const ownerDiff = (splitSubtotal + splitTotalGst) - splitAmount * splitCount // positive = owner earns, negative = owner absorbs

  const splitMemberTotals = useMemo(() =>
    splitMembers.map((m) => {
      const autoGstShare = splitTotalGst / splitCount
      const memberGstShare = m.customGst !== undefined && m.customGst !== '' ? Number(m.customGst) : autoGstShare
      const memberSubtotalShare = splitAmount - autoGstShare

      const groupDisc = splitDiscountMode === 'group'
        ? (splitGroupDiscount.type === 'percent'
          ? (splitAmount * Number(splitGroupDiscount.value || 0)) / 100
          : Number(splitGroupDiscount.value || 0))
        : 0;
      const individualDisc = m.discountType === 'percent'
        ? (splitAmount * Number(m.discountValue || 0)) / 100
        : Number(m.discountValue || 0);
      const manualDisc = groupDisc + individualDisc;

      let promoDisc = 0
      if (m.appliedPromo) {
        promoDisc = m.appliedPromo.type === 'percent'
          ? (splitAmount * Number(m.appliedPromo.value || 0)) / 100
          : Number(m.appliedPromo.value || 0)
      }

      const disc = manualDisc + promoDisc
      const ptsRedeemed = Number(m.loyaltyPointsRedeemed || 0)
      const redeemOptions = settings?.loyaltyRedeemOptions || [
        { points: 100, rupees: 2.5 },
        { points: 120, rupees: 3 },
        { points: 150, rupees: 5 },
      ]
      const selectedRedeemOpt = redeemOptions.find(o => Number(o.points) === ptsRedeemed)
      const loyaltyDisc = selectedRedeemOpt ? Number(selectedRedeemOpt.rupees) : 0

      return {
        subtotal: memberSubtotalShare,
        gstAmount: memberGstShare,
        cgst: memberGstShare / 2,
        sgst: memberGstShare / 2,
        discountAmount: disc,
        loyaltyDiscount: loyaltyDisc,
        total: Math.max(splitAmount - disc - loyaltyDisc, 0),
        manualDiscount: manualDisc,
        promoDiscount: promoDisc,
      }
    }),
    [splitMembers, splitAmount, splitTotalGst, splitCount, splitDiscountMode, splitGroupDiscount, settings]
  )

  // ── Member helpers (shared mode) ─────────────────────────────────────────────
  const addMember = () =>
    setMembers((cur) => [
      ...cur,
      { id: `m-${Date.now()}`, customerId: '', hasAddons: false, addonRows: [], discountType: 'flat', discountValue: 0, useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, customGst: '' },
    ])

  const removeMember = (id) => setMembers((cur) => cur.filter((m) => m.id !== id))

  const updateMember = (id, changes) =>
    setMembers((cur) =>
      cur.map((m) => {
        if (m.id !== id) return m
        const updated = { ...m, ...changes }
        if (changes.customerId !== undefined) {
          const cust = activeCustomers.find((c) => c.id === changes.customerId)
          const adv = Number(cust?.advanceBalance || cust?.creditBalance || 0)
          updated.useAdvance = adv > 0
        }
        return updated
      })
    )

  // ── Member helpers (split mode) ───────────────────────────────────────────────
  const addSplitMember = () =>
    setSplitMembers((cur) => [...cur, { id: `sm-${Date.now()}`, customerId: '', useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, customGst: '', discountType: 'flat', discountValue: 0 }])

  const removeSplitMember = (id) => setSplitMembers((cur) => cur.filter((m) => m.id !== id))

  const updateSplitMember = (id, changes) =>
    setSplitMembers((cur) =>
      cur.map((m) => {
        if (m.id !== id) return m
        const updated = { ...m, ...changes }
        if (changes.customerId !== undefined) {
          const cust = activeCustomers.find((c) => c.id === changes.customerId)
          const adv = Number(cust?.advanceBalance || cust?.creditBalance || 0)
          updated.useAdvance = adv > 0
        }
        return updated
      })
    )

  const handleNewCustomerSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!newCustomerForm.name.trim()) errs.name = 'Name is required'

    if (Object.keys(errs).length > 0) {
      setNewCustomerErrors(errs)
      return
    }

    try {
      const newCustId = addCustomer({
        type: newCustomerForm.type,
        name: newCustomerForm.name.trim(),
        phone: newCustomerForm.phone.trim(),
        email: newCustomerForm.email.trim(),
        creditBalance: 0,
        openingCash: 0,
        openingUpi: 0,
        status: 'active'
      })

      setNewCustomerSuccess(`Customer "${newCustomerForm.name.trim()}" added successfully!`)

      // Auto select this customer for the member slot
      if (modalTriggerInfo.mode === 'shared') {
        updateMember(modalTriggerInfo.memberId, { customerId: newCustId })
      } else {
        updateSplitMember(modalTriggerInfo.memberId, { customerId: newCustId })
      }

      setTimeout(() => {
        setShowAddCustomerModal(false)
        setNewCustomerSuccess('')
        setNewCustomerForm({
          type: 'regular',
          name: '',
          phone: '',
          email: '',
          openingBalanceMethod: 'none',
          openingCash: '',
          openingUpi: ''
        })
        setNewCustomerErrors({})
      }, 1500)

    } catch (err) {
      showAlert(`Failed to add customer: ${err.message}`, 'error')
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────
  const resetAll = () => {
    setSharedRows([makeItemRow(inventory)])
    setMembers([{ id: `m-${Date.now()}`, customerId: '', hasAddons: false, addonRows: [], discountType: 'flat', discountValue: 0, useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, customGst: '' }])
    setSplitRows([makeItemRow(inventory)])
    setSplitMembers([
      { id: `sm-${Date.now()}`, customerId: '', useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, customGst: '', discountType: 'flat', discountValue: 0 },
      { id: `sm-${Date.now()}-2`, customerId: '', useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, customGst: '', discountType: 'flat', discountValue: 0 },
    ])
    setNotes('')
    setRoundingMode('up')
    setSharedDiscountMode('individual')
    setSharedGroupDiscount({ type: 'flat', value: 0 })
    setSplitDiscountMode('individual')
    setSplitGroupDiscount({ type: 'flat', value: 0 })
  }

  // ── Submit shared/addon ────────────────────────────────────────────────────
  const handleSharedSubmit = (e) => {
    e.preventDefault()
    if (members.some((m) => !m.customerId)) {
      showAlert('Please select a customer for all members.', 'error'); return
    }
    if (members.length < 1) {
      showAlert('Add at least one member.', 'error'); return
    }
    if (sharedRows.length === 0) {
      showAlert('Add at least one shared item.', 'error'); return
    }

    setIsSubmitting(true)
    const groupMembers = members.map((m, i) => {
      const { subtotal, gstAmount, cgst, sgst, discountAmount, loyaltyDiscount, total } = memberTotals[i]
      const allItems = [
        ...sharedRows.map((r) => ({
          itemId: r.itemId,
          itemName: r.itemName,
          printType: r.printType,
          sides: r.sides,
          qty: Number(r.qty),
          unitPrice: Number(r.unitPrice),
          amount: Number(r.amount),
          gstRate: Number(r.gstRate || 0),
        })),
        ...(m.hasAddons
          ? m.addonRows.map((r) => ({
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
      const hasBoth = m.appliedPromo && Number(m.discountValue) > 0
      const finalDiscType = hasBoth ? 'flat' : (m.appliedPromo ? m.appliedPromo.type : m.discountType)
      const finalDiscVal = hasBoth ? discountAmount : (m.appliedPromo ? m.appliedPromo.value : m.discountValue)

      let promoDisc = 0
      if (m.appliedPromo) {
        promoDisc = m.appliedPromo.type === 'percent'
          ? (subtotal * Number(m.appliedPromo.value || 0)) / 100
          : Number(m.appliedPromo.value || 0)
      }

      return {
        customerId: m.customerId,
        items: allItems,
        subtotal,
        discountType: finalDiscType,
        discountValue: finalDiscVal,
        discountAmount,
        gstAmount,
        cgst,
        sgst,
        promoCode: m.appliedPromo?.code || null,
        promoDiscount: promoDisc,
        loyaltyDiscount: loyaltyDiscount,
        loyaltyPointsRedeemed: Number(m.loyaltyPointsRedeemed || 0),
        total,
        useAdvance: m.useAdvance,
        groupRole: m.hasAddons ? 'shared-addon' : 'shared',
        rounding: 0,
      }
    })

    try {
      const grpId = addGroupBill({
        type: 'shared',
        members: groupMembers,
        date, dueDate, notes,
      })
      setLastGroupId(grpId)
      showToast(`Group bill ${grpId} created with ${members.length} member(s)!`, 'success')
      resetAll()
    } catch (err) {
      showAlert(`Failed to create group bill: ${err.message}`, 'error')
    }
    setIsSubmitting(false)
  }

  // ── Submit split ───────────────────────────────────────────────────────────
  const handleSplitSubmit = (e) => {
    e.preventDefault()
    if (splitMembers.some((m) => !m.customerId)) {
      showAlert('Please select a customer for all split members.', 'error'); return
    }
    if (splitMembers.length < 2) {
      showAlert('Add at least 2 members for a split purchase.', 'error'); return
    }
    if (splitRows.length === 0 || splitSubtotal <= 0) {
      showAlert('Add items with a valid total amount.', 'error'); return
    }

    setIsSubmitting(true)
    const splitGroupMembers = splitMembers.map((m, idx) => {
      const ptsRedeemed = Number(m.loyaltyPointsRedeemed || 0)
      const { subtotal, gstAmount, cgst, sgst, discountAmount, loyaltyDiscount, total, promoDiscount } = splitMemberTotals[idx]

      const hasBoth = m.appliedPromo && (splitDiscountMode === 'group' ? Number(splitGroupDiscount.value) > 0 : Number(m.discountValue) > 0)
      const finalDiscType = hasBoth ? 'flat' : (m.appliedPromo ? m.appliedPromo.type : (splitDiscountMode === 'group' ? splitGroupDiscount.type : m.discountType))
      const finalDiscVal = hasBoth ? discountAmount : (m.appliedPromo ? m.appliedPromo.value : (splitDiscountMode === 'group' ? splitGroupDiscount.value : m.discountValue))

      return {
        customerId: m.customerId,
        items: splitRows.map((r) => ({
          itemId: r.itemId,
          itemName: r.itemName,
          printType: r.printType,
          sides: r.sides,
          qty: Number(r.qty),
          unitPrice: Number(r.unitPrice),
          amount: Number(r.amount),
          gstRate: Number(r.gstRate || 0),
        })),
        subtotal,
        gstAmount,
        cgst,
        sgst,
        discountType: finalDiscType,
        discountValue: finalDiscVal,
        discountAmount,
        promoCode: m.appliedPromo?.code || null,
        promoDiscount,
        loyaltyDiscount,
        loyaltyPointsRedeemed: ptsRedeemed,
        total,
        rounding: 0,
        useAdvance: m.useAdvance,
        groupRole: 'split',
      }
    })

    try {
      const grpId = addGroupBill({
        type: 'split',
        members: splitGroupMembers,
        date, dueDate, notes,
        splitTotal: splitSubtotal,
        splitCount,
        roundingMode,
      })
      setLastGroupId(grpId)
      showToast(`Split group bill ${grpId} created — ₹${splitAmount} × ${splitCount} members!`, 'success')
      resetAll()
    } catch (err) {
      showAlert(`Failed to create split bill: ${err.message}`, 'error')
    }
    setIsSubmitting(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Users size={24} /> Group Billing</h1>
          <p>Create bills for multiple customers sharing products, or split a joint purchase equally.</p>
        </div>
        {lastGroupId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.12)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)' }}>
            <CheckCircle size={16} color="#10b981" />
            <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 600 }}>Last Group: {lastGroupId}</span>
          </div>
        )}
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', padding: '4px', borderRadius: '10px', marginBottom: '24px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          { key: 'shared', label: 'Shared Purchase', icon: <Users size={14} /> },
          { key: 'split', label: 'Split Purchase', icon: <ArrowLeftRight size={14} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMode(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 18px', borderRadius: '7px',
              border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
              background: mode === tab.key ? 'var(--accent)' : 'transparent',
              color: mode === tab.key ? '#fff' : '#71717a',
            }}
          >{tab.icon}{tab.label}</button>
        ))}
      </div>

      {/* Common date/due/notes row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '16px', marginBottom: '24px' }}>
        <div className="form-group">
          <label className="form-label">Bill Date</label>
          <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Due Date</label>
          <input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <input className="form-input" type="text" value={notes} placeholder="Internal note for this group bill" onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {/* ── SHARED MODE ─────────────────────────────────────────────────────── */}
      {mode === 'shared' && (
        <form onSubmit={handleSharedSubmit}>
          {/* Shared items section */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Shared Items <span style={{ color: '#71717a', fontSize: '12px', fontWeight: 400 }}>(same for all members)</span></h3>
              <div style={{ fontSize: '14px', color: '#a3e635', fontWeight: 700 }}>Subtotal: ₹{sharedSubtotal.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '10px', display: 'grid', gridTemplateColumns: '1.4fr 90px 90px 60px 90px 80px 1fr 32px', gap: '6px' }}>
              <span>Item</span><span>Type</span><span>Sides</span><span>Qty</span><span>Unit Price</span><span>GST Rate</span><span style={{ textAlign: 'right' }}>Amount</span><span></span>
            </div>
            <QuickAddPanel inventory={inventory} rows={sharedRows} setRows={setSharedRows} />
            <ItemRowEditor rows={sharedRows} setRows={setSharedRows} inventory={inventory} />
          </div>

          {/* Discount Settings */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600 }}>Discount Settings</h3>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Discount Mode</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${sharedDiscountMode === 'individual' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={() => setSharedDiscountMode('individual')}
                  >
                    Individual Discounts
                  </button>
                  <button
                    type="button"
                    className={`btn ${sharedDiscountMode === 'group' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={() => setSharedDiscountMode('group')}
                  >
                    Equal Group Discount
                  </button>
                </div>
              </div>

              {sharedDiscountMode === 'group' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Group Discount Type</div>
                    <select
                      className="form-input"
                      style={{ fontSize: '12px', padding: '6px 10px', height: '34px' }}
                      value={sharedGroupDiscount.type}
                      onChange={(e) => setSharedGroupDiscount(d => ({ ...d, type: e.target.value }))}
                    >
                      <option value="flat">₹ Flat</option>
                      <option value="percent">% Off</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Value</div>
                    <input
                      className="form-input"
                      style={{ width: '100px', fontSize: '12px', padding: '6px 10px', height: '34px' }}
                      type="number"
                      min="0"
                      step="0.01"
                      value={sharedGroupDiscount.value || ''}
                      onChange={(e) => setSharedGroupDiscount(d => ({ ...d, value: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Members */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Members <span style={{ color: '#71717a', fontSize: '12px', fontWeight: 400 }}>({members.length})</span></h3>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 14px' }} onClick={addMember}><Plus size={13} /> Add Member</button>
            </div>

            {members.map((m, i) => (
              <MemberCard
                key={m.id}
                member={m}
                idx={i}
                members={members}
                customers={activeCustomers}
                inventory={inventory}
                onChange={updateMember}
                onRemove={() => removeMember(m.id)}
                settings={settings}
                promoCodes={promoCodes}
                date={date}
                memberTotals={memberTotals}
                sharedRows={sharedRows}
                onAddNewCustomerClick={(memberId) => {
                  setModalTriggerInfo({ memberId, mode: 'shared' })
                  setShowAddCustomerModal(true)
                }}
                sharedDiscountMode={sharedDiscountMode}
                sharedGroupDiscount={sharedGroupDiscount}
              />
            ))}
          </div>

          {/* Summary table */}
          {members.some((m) => m.customerId) && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>Summary per Member</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {['#', 'Customer', 'Shared', 'Add-ons', 'GST', 'Discount', 'Loyalty Disc', 'Total', 'Advance', 'Bill Status'].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#71717a', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => {
                      const cust = activeCustomers.find((c) => c.id === m.customerId)
                      const { subtotal, gstAmount, discountAmount, loyaltyDiscount, total } = memberTotals[i]
                      const adv = Number(cust?.advanceBalance || 0)
                      const advUsed = m.useAdvance ? Math.min(adv, total) : 0
                      const remaining = Math.max(total - advUsed, 0)
                      const status = advUsed >= total ? 'paid' : advUsed > 0 ? 'partial' : 'unpaid'
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 10px', color: '#71717a' }}>{i + 1}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{cust?.name || <span style={{ color: '#ef4444' }}>Not selected</span>}</td>
                          <td style={{ padding: '8px 10px' }}>₹{sharedSubtotal.toFixed(2)}</td>
                          <td style={{ padding: '8px 10px' }}>₹{(m.hasAddons ? m.addonRows.reduce((s, r) => s + Number(r.amount || 0), 0) : 0).toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', color: '#818cf8' }}>₹{gstAmount.toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', color: '#f59e0b' }}>-₹{discountAmount.toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', color: '#f59e0b' }}>-₹{loyaltyDiscount.toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#a3e635' }}>₹{total.toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', color: '#10b981' }}>{m.useAdvance ? `-₹${advUsed.toFixed(2)}` : '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                              background: status === 'paid' ? 'rgba(16,185,129,0.15)' : status === 'partial' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                              color: status === 'paid' ? '#10b981' : status === 'partial' ? '#f59e0b' : '#ef4444',
                            }}>{status.toUpperCase()}</span>
                            {remaining > 0 && <span style={{ fontSize: '11px', color: '#71717a', marginLeft: '6px' }}>Bal: ₹{remaining.toFixed(2)}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ padding: '10px 28px', fontSize: '14px', fontWeight: 600 }}
          >
            <CheckCircle size={15} /> {isSubmitting ? 'Creating…' : `Create ${members.length} Group Bill(s)`}
          </button>
        </form>
      )}

      {/* ── SPLIT MODE ──────────────────────────────────────────────────────── */}
      {mode === 'split' && (
        <form onSubmit={handleSplitSubmit}>
          {/* Joint items */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Joint Items <span style={{ color: '#71717a', fontSize: '12px', fontWeight: 400 }}>(total cost to be split)</span></h3>
              <div style={{ fontSize: '16px', color: '#a3e635', fontWeight: 700 }}>Total: ₹{(splitSubtotal + splitTotalGst).toFixed(2)}</div>
            </div>
            <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '10px', display: 'grid', gridTemplateColumns: '1.4fr 90px 90px 60px 90px 80px 1fr 32px', gap: '6px' }}>
              <span>Item</span><span>Type</span><span>Sides</span><span>Qty</span><span>Unit Price</span><span>GST Rate</span><span style={{ textAlign: 'right' }}>Amount</span><span></span>
            </div>
            <QuickAddPanel inventory={inventory} rows={splitRows} setRows={setSplitRows} />
            <ItemRowEditor rows={splitRows} setRows={setSplitRows} inventory={inventory} />
          </div>

          {/* Rounding choice */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 600 }}>Split Settings</h3>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Rounding Mode</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { key: 'up', label: '▲ Round Up', desc: 'No loss to owner' },
                    { key: 'down', label: '▼ Round Down', desc: 'No fractions charged' },
                  ].map((opt) => (
                    <button
                      key={opt.key} type="button"
                      onClick={() => setRoundingMode(opt.key)}
                      style={{
                        padding: '8px 16px', borderRadius: '7px', border: `2px solid ${roundingMode === opt.key ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                        background: roundingMode === opt.key ? 'rgba(var(--accent-rgb),0.1)' : 'transparent',
                        color: roundingMode === opt.key ? 'var(--accent)' : '#a1a1aa',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                      }}
                    >
                      <div>{opt.label}</div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {(splitSubtotal + splitTotalGst) > 0 && splitCount > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px 18px' }}>
                  <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '4px' }}>₹{(splitSubtotal + splitTotalGst).toFixed(2)} (incl. GST) ÷ {splitCount} members</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#a3e635' }}>₹{splitAmount} / person</div>
                  <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px' }}>
                    {rawSplitAmount % 1 !== 0 && (
                      <span style={{ color: ownerDiff >= 0 ? '#10b981' : '#f59e0b' }}>
                        {ownerDiff >= 0 ? `Owner gains ₹${ownerDiff.toFixed(2)}` : `Owner absorbs ₹${Math.abs(ownerDiff).toFixed(2)}`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Discount Settings */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600 }}>Discount Settings</h3>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Discount Mode</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${splitDiscountMode === 'individual' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={() => setSplitDiscountMode('individual')}
                  >
                    Individual Discounts
                  </button>
                  <button
                    type="button"
                    className={`btn ${splitDiscountMode === 'group' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={() => setSplitDiscountMode('group')}
                  >
                    Equal Group Discount
                  </button>
                </div>
              </div>

              {splitDiscountMode === 'group' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Group Discount Type</div>
                    <select
                      className="form-input"
                      style={{ fontSize: '12px', padding: '6px 10px', height: '34px' }}
                      value={splitGroupDiscount.type}
                      onChange={(e) => setSplitGroupDiscount(d => ({ ...d, type: e.target.value }))}
                    >
                      <option value="flat">₹ Flat</option>
                      <option value="percent">% Off</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Value</div>
                    <input
                      className="form-input"
                      style={{ width: '100px', fontSize: '12px', padding: '6px 10px', height: '34px' }}
                      type="number"
                      min="0"
                      step="0.01"
                      value={splitGroupDiscount.value || ''}
                      onChange={(e) => setSplitGroupDiscount(d => ({ ...d, value: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Split members */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Split Members <span style={{ color: '#71717a', fontSize: '12px', fontWeight: 400 }}>({splitCount})</span></h3>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 14px' }} onClick={addSplitMember}><Plus size={13} /> Add Member</button>
            </div>

            {splitMembers.map((m, i) => {
              const cust = activeCustomers.find((c) => c.id === m.customerId)
              const { total: memberTotal } = splitMemberTotals[i]
              const adv = Number(cust?.advanceBalance || 0)
              const advUsed = m.useAdvance ? Math.min(adv, memberTotal) : 0
              const remaining = Math.max(memberTotal - advUsed, 0)
              const status = advUsed >= memberTotal ? 'paid' : advUsed > 0 ? 'partial' : 'unpaid'

              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', background: 'var(--surface)', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ background: 'var(--accent)', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1 }}>
                      <select className="form-input" style={{ flex: 1, fontSize: '13px' }} value={m.customerId}
                        onChange={(e) => updateSplitMember(m.id, { customerId: e.target.value })}>
                        <option value="">— Select Customer —</option>
                        {activeCustomers.filter((c) => !splitMembers.some(sm => sm.id !== m.id && sm.customerId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                      </select>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px 8px', height: '38px', minHeight: 'unset' }}
                        onClick={() => {
                          setModalTriggerInfo({ memberId: m.id, mode: 'split' })
                          setShowAddCustomerModal(true)
                        }}
                        title="Add New Customer"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {adv > 0 && (
                      <label style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', flexShrink: 0 }}>
                        <input type="checkbox" checked={m.useAdvance} onChange={(e) => updateSplitMember(m.id, { useAdvance: e.target.checked })} />
                        Use Advance (₹{adv.toFixed(2)})
                      </label>
                    )}
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#a3e635', flexShrink: 0 }}>₹{memberTotal.toFixed(2)}</div>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, flexShrink: 0,
                      background: status === 'paid' ? 'rgba(16,185,129,0.15)' : status === 'partial' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                      color: status === 'paid' ? '#10b981' : status === 'partial' ? '#f59e0b' : '#ef4444',
                    }}>{status.toUpperCase()}</span>
                    {splitCount > 2 && (
                      <button type="button" onClick={() => removeSplitMember(m.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', flexShrink: 0 }}><X size={15} /></button>
                    )}
                  </div>

                  {cust && (
                    <div style={{ marginLeft: '36px', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      {/* GST Override */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.01)', padding: '6px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          <span style={{ color: '#a1a1aa' }}>Edit GST:</span>
                          <input
                            className="form-input"
                            style={{ width: '100px', fontSize: '11px', padding: '2px 6px' }}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={`Auto: ₹${(splitTotalGst / splitCount).toFixed(2)}`}
                            value={m.customGst || ''}
                            onChange={(e) => updateSplitMember(m.id, { customGst: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Discount override */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.01)', padding: '6px', borderRadius: '6px' }}>
                        {splitDiscountMode === 'group' && (
                          <div style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                            Group Discount: {splitGroupDiscount.type === 'percent' ? `${splitGroupDiscount.value}% Off` : `₹${Number(splitGroupDiscount.value || 0).toFixed(2)} Flat`} (Applied)
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          <span style={{ color: '#a1a1aa' }}>{splitDiscountMode === 'group' ? 'Indiv. Discount:' : 'Discount:'}</span>
                          <select
                            className="form-input"
                            style={{ width: '80px', fontSize: '11px', padding: '2px 4px', height: '24px' }}
                            value={m.discountType}
                            onChange={(e) => updateSplitMember(m.id, { discountType: e.target.value })}
                          >
                            <option value="flat">₹ Flat</option>
                            <option value="percent">% Off</option>
                          </select>
                          <input
                            className="form-input"
                            style={{ width: '80px', fontSize: '11px', padding: '2px 4px', height: '24px' }}
                            type="number"
                            min="0"
                            step="0.01"
                            value={m.discountValue || ''}
                            onChange={(e) => updateSplitMember(m.id, { discountValue: Number(e.target.value) })}
                          />
                        </div>
                      </div>

                      {/* Promo Code selection */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.01)', padding: '6px', borderRadius: '6px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#a1a1aa' }}>
                          <input
                            type="checkbox"
                            checked={!!m.usePromoCode}
                            onChange={(e) => {
                              updateSplitMember(m.id, {
                                usePromoCode: e.target.checked,
                                appliedPromo: e.target.checked ? m.appliedPromo : null,
                                promoCodeInput: e.target.checked ? m.promoCodeInput || '' : ''
                              })
                            }}
                          />
                          <span>Apply Promo Code for this customer</span>
                        </label>
                        {m.usePromoCode && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input
                                className="form-input"
                                style={{ width: '120px', fontSize: '11px', padding: '2px 6px' }}
                                placeholder="PROMO CODE"
                                value={m.promoCodeInput || ''}
                                onChange={(e) => updateSplitMember(m.id, { promoCodeInput: e.target.value })}
                              />
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: '11px', padding: '2px 8px' }}
                                onClick={() => {
                                  const code = (m.promoCodeInput || '').trim().toUpperCase()
                                  if (!code) return
                                  const promo = promoCodes?.find(p => p.code === code)
                                  if (!promo) {
                                    updateSplitMember(m.id, { promoError: 'Invalid promo code' })
                                    return
                                  }
                                  if (promo.enabled === false) {
                                    updateSplitMember(m.id, { promoError: 'This coupon is disabled.' })
                                    return
                                  }

                                  // Date validity check
                                  const billDate = date || new Date().toISOString().slice(0, 10)
                                  if (promo.startDate && billDate < promo.startDate) {
                                    updateSplitMember(m.id, { promoError: `Valid from ${promo.startDate}` })
                                    return
                                  }
                                  if (promo.endDate && billDate > promo.endDate) {
                                    updateSplitMember(m.id, { promoError: `Expired on ${promo.endDate}` })
                                    return
                                  }

                                  if (splitAmount < promo.minAmount) {
                                    updateSplitMember(m.id, { promoError: `Min amount ₹${promo.minAmount}` })
                                    return
                                  }
                                  updateSplitMember(m.id, { appliedPromo: promo, promoError: '', promoCodeInput: '' })
                                }}
                              >
                                Apply
                              </button>
                            </div>
                            {m.promoError && <p style={{ color: 'var(--error)', fontSize: '0.7rem', margin: 0 }}>{m.promoError}</p>}
                            {m.appliedPromo && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '0.7rem', fontWeight: 600 }}>
                                <Tag size={10} /> Applied: {m.appliedPromo.code} ({m.appliedPromo.type === 'percent' ? `${m.appliedPromo.value}% off` : `₹${m.appliedPromo.value} off`})
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm"
                                  style={{ color: 'var(--error)', padding: 0, fontSize: '0.7rem' }}
                                  onClick={() => updateSplitMember(m.id, { appliedPromo: null })}
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Loyalty Points option */}
                      {cust.type === 'regular' && settings?.loyaltyEnabled !== false && settings?.loyaltyRedeemEnabled !== false && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.01)', padding: '6px', borderRadius: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#a1a1aa' }}>
                            <input
                              type="checkbox"
                              checked={!!m.shouldRedeemPoints}
                              onChange={(e) => {
                                updateSplitMember(m.id, {
                                  shouldRedeemPoints: e.target.checked,
                                  loyaltyPointsRedeemed: e.target.checked ? m.loyaltyPointsRedeemed || 0 : 0
                                })
                              }}
                            />
                            <span>Redeem points for this customer</span>
                          </label>
                          {m.shouldRedeemPoints && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span>Redeem:</span>
                              <select
                                className="form-select"
                                style={{ fontSize: '12px', padding: '2px 6px', width: '180px' }}
                                value={m.loyaltyPointsRedeemed || ''}
                                onChange={(e) => {
                                  updateSplitMember(m.id, { loyaltyPointsRedeemed: Number(e.target.value) })
                                }}
                              >
                                <option value="">-- Select Option --</option>
                                {(settings.loyaltyRedeemOptions || [
                                  { points: 100, rupees: 2.5 },
                                  { points: 120, rupees: 3 },
                                  { points: 150, rupees: 5 },
                                ]).map((opt) => {
                                  const maxPts = cust.loyaltyPoints || 0
                                  const isDisabled = opt.points > maxPts
                                  return (
                                    <option key={opt.points} value={opt.points} disabled={isDisabled}>
                                      {opt.points} pts = ₹{opt.rupees} {isDisabled ? '(Insufficient)' : ''}
                                    </option>
                                  )
                                })}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ padding: '10px 28px', fontSize: '14px', fontWeight: 600 }}
          >
            <CheckCircle size={15} /> {isSubmitting ? 'Creating…' : `Split & Create ${splitCount} Bills`}
          </button>
        </form>
      )}

      {/* Group Bills history */}
      <div style={{ marginTop: '40px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Recent Group Bills</h3>
        <GroupBillsHistory />
      </div>

      {/* Add New Customer Modal */}
      {showAddCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowAddCustomerModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Customer</h3>
              <button className="modal-close btn-icon" onClick={() => setShowAddCustomerModal(false)} type="button">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleNewCustomerSubmit}>
              <div className="modal-body">
                {newCustomerSuccess && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', marginBottom: '16px',
                    background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
                  }}>
                    <CheckCircle size={16} /> {newCustomerSuccess}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Customer Type</label>
                  <div className="radio-group">
                    <label className={`radio-option ${newCustomerForm.type === 'regular' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="modalCustType"
                        value="regular"
                        checked={newCustomerForm.type === 'regular'}
                        onChange={(e) => setNewCustomerForm(f => ({ ...f, type: e.target.value }))}
                      />
                      Regular
                    </label>
                    <label className={`radio-option ${newCustomerForm.type === 'random' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="modalCustType"
                        value="random"
                        checked={newCustomerForm.type === 'random'}
                        onChange={(e) => setNewCustomerForm(f => ({ ...f, type: e.target.value }))}
                      />
                      Walk-in / Random
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Name <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input
                    className={`form-input${newCustomerErrors.name ? ' form-input-error' : ''}`}
                    type="text"
                    placeholder="Customer Name"
                    value={newCustomerForm.name}
                    onChange={(e) => {
                      setNewCustomerForm(f => ({ ...f, name: e.target.value }))
                      if (newCustomerErrors.name) setNewCustomerErrors(errs => { const n = { ...errs }; delete n.name; return n })
                    }}
                  />
                  {newCustomerErrors.name && (
                    <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} /> {newCustomerErrors.name}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Phone Number (optional)"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="Email Address (optional)"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddCustomerModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Group Bills History List ───────────────────────────────────────────────────
const GroupBillsHistory = () => {
  const { groupBills = [], bills, customers, recordSpecificBillPayment, recordSplitGroupPayment, payments = [] } = useAppContext()
  const [expanded, setExpanded] = useState(null)
  const [payModalBill, setPayModalBill] = useState(null)
  const [payModalGroup, setPayModalGroup] = useState(null)
  const [payCash, setPayCash] = useState('')
  const [payUpi, setPayUpi] = useState('')
  const [payMode, setPayMode] = useState('share')
  const [showConfirmScreen, setShowConfirmScreen] = useState(false)

  if (!groupBills.length) {
    return <div style={{ color: '#52525b', fontSize: '14px', padding: '24px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>No group bills created yet.</div>
  }

  const getGroupBal = (grp) =>
    (grp.memberBillIds || [])
      .map(id => bills.find(b => b.id === id && !b.deleted))
      .filter(Boolean)
      .reduce((s, b) => s + (b.balance || 0), 0)

  const openPayModal = (bill, grp) => {
    setPayModalBill(bill)
    setPayModalGroup(grp)
    setPayMode('share')
    setPayCash(String(bill.balance || 0))
    setPayUpi('0')
    setShowConfirmScreen(false)
  }

  const closeModal = () => { setPayModalBill(null); setPayModalGroup(null); setShowConfirmScreen(false) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {[...groupBills].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20).map((grp) => {
        // Always look up bills by stored memberBillIds — never filter by groupBillId to avoid including parent bills
        const memberBills = (grp.memberBillIds || [])
          .map((id) => bills.find((b) => b.id === id && !b.deleted))
          .filter(Boolean)
        // Totals computed live from actual child bill data
        const totalAmount = memberBills.reduce((s, b) => s + b.total, 0)
        const paidAmount = memberBills.reduce((s, b) => s + (b.amountPaid || 0), 0)
        const balanceAmount = memberBills.reduce((s, b) => s + (b.balance || 0), 0)
        const isExpanded = expanded === grp.id
        const groupPayment = payments.find(p => p.groupBillId === grp.id && p.isGroupPayment)

        return (
          <div key={grp.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: 'var(--surface)' }}
              onClick={() => setExpanded(isExpanded ? null : grp.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>{grp.id}</span>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: grp.type === 'split' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.12)', color: grp.type === 'split' ? '#818cf8' : '#10b981', fontWeight: 600 }}>
                  {grp.type === 'split' ? 'Split' : 'Shared'}
                </span>
                <span style={{ fontSize: '13px', color: '#a1a1aa' }}>{memberBills.length} members · {grp.date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#a3e635' }}>₹{totalAmount.toFixed(2)}</span>
                <span style={{ fontSize: '12px', color: '#10b981' }}>Paid: ₹{paidAmount.toFixed(2)}</span>
                <span style={{ fontSize: '12px', color: balanceAmount > 0 ? '#f59e0b' : '#10b981' }}>Bal: ₹{balanceAmount.toFixed(2)}</span>
                <ChevronDown size={16} style={{ color: '#71717a', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['Bill ID', 'Customer', 'Total', 'Paid', 'Balance', 'Status', 'Action'].map((h) => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#71717a', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {memberBills.map((b) => (
                        <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '7px 10px', color: 'var(--accent)', fontWeight: 600 }}>{b.id}</td>
                          <td style={{ padding: '7px 10px' }}>{b.customerName}</td>
                          <td style={{ padding: '7px 10px' }}>₹{Number(b.total).toFixed(2)}</td>
                          <td style={{ padding: '7px 10px', color: '#10b981' }}>₹{Number(b.amountPaid).toFixed(2)}</td>
                          <td style={{ padding: '7px 10px', color: '#f59e0b' }}>₹{Number(b.balance).toFixed(2)}</td>
                          <td style={{ padding: '7px 10px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                              background: b.settledByGroupPayment ? 'rgba(99,102,241,0.15)' : (b.status === 'paid' ? 'rgba(16,185,129,0.15)' : b.status === 'partial' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'),
                              color: b.settledByGroupPayment ? '#818cf8' : (b.status === 'paid' ? '#10b981' : b.status === 'partial' ? '#f59e0b' : '#ef4444'),
                            }}>{b.settledByGroupPayment ? 'SETTLED' : b.status.toUpperCase()}</span>
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            {b.status === 'paid' || b.settledByGroupPayment ? (
                              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: b.settledByGroupPayment ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)', color: b.settledByGroupPayment ? '#818cf8' : '#10b981' }}>
                                {b.settledByGroupPayment ? 'SETTLED' : 'PAID'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  if (grp.type === 'split') {
                                    openPayModal(b, grp)
                                  } else {
                                    recordSpecificBillPayment({ billId: b.id, customerId: b.customerId, cashAmount: b.balance > 0 ? b.balance : b.total, upiAmount: 0, notes: `Payment for group member bill ${b.id}` })
                                  }
                                }}
                              >Pay</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {grp.type === 'split' && groupPayment && (
                  <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,0.06)', borderRadius: '8px', border: '1px dashed rgba(99,102,241,0.2)' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={14} /> Split Settlement View
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', fontSize: '12px' }}>
                      <div><span style={{ color: '#a1a1aa' }}>Group ID:</span> <strong>{grp.id}</strong></div>
                      <div><span style={{ color: '#a1a1aa' }}>Total:</span> <strong>₹{totalAmount.toFixed(2)}</strong></div>
                      <div><span style={{ color: '#a1a1aa' }}>Actual Payer:</span> <strong>{customers.find(c => c.id === groupPayment.customerId)?.name || 'Unknown'}</strong></div>
                      <div><span style={{ color: '#a1a1aa' }}>Ref:</span> <strong style={{ fontFamily: 'monospace' }}>{groupPayment.id}</strong></div>
                    </div>
                    <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '4px' }}>Members Settled:</div>
                      {memberBills.map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: b.customerId === groupPayment.customerId ? '#fff' : '#a1a1aa' }}>
                          <span>{b.customerName} {b.customerId === groupPayment.customerId ? '(Payer)' : '(Settled)'}</span>
                          <span>₹{Number(b.total).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Split Payment Modal */}
      {payModalBill && payModalGroup && (() => {
        const groupBal = getGroupBal(payModalGroup)
        const allUnpaidBills = (payModalGroup.memberBillIds || [])
          .map(id => bills.find(b => b.id === id && !b.deleted))
          .filter(Boolean)
          .filter(b => b.balance > 0)
          .sort((a, b) => a.id.localeCompare(b.id))
        const totalPaying = Number(payCash || 0) + Number(payUpi || 0)
        const remaining = Math.max(0, groupBal - totalPaying)

        const previewSettlements = (() => {
          let rem = totalPaying
          return allUnpaidBills.map(b => {
            const apply = Math.min(rem, b.balance)
            rem -= apply
            return { bill: b, apply }
          })
        })()

        return (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3>{showConfirmScreen ? 'Confirm Full Group Payment' : 'Record Split Payment'}</h3>
                <button type="button" className="btn-close" onClick={closeModal}>&times;</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '11px', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payer</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent)', marginTop: '2px' }}>{payModalBill.customerName}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#71717a', textTransform: 'uppercase' }}>My Share Balance</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>₹{Number(payModalBill.balance || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#71717a', textTransform: 'uppercase' }}>Group Balance</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#a3e635', marginTop: '2px' }}>₹{groupBal.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {!showConfirmScreen ? (
                  <>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" className={`btn btn-sm ${payMode === 'share' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setPayMode('share'); setPayCash(String(payModalBill.balance || 0)); setPayUpi('0') }}>
                        Pay My Share (₹{Number(payModalBill.balance || 0).toFixed(2)})
                      </button>
                      <button type="button" className={`btn btn-sm ${payMode === 'full' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setPayMode('full'); setPayCash(String(groupBal)); setPayUpi('0') }}>
                        Pay Full Group (₹{groupBal.toFixed(2)})
                      </button>
                      <button type="button" className={`btn btn-sm ${payMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setPayMode('custom')}>
                        Custom
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '4px', display: 'block' }}>Cash (₹)</label>
                        <input type="number" className="form-input" style={{ width: '100%' }} value={payCash}
                          onChange={(e) => { setPayCash(e.target.value); setPayMode('custom') }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '4px', display: 'block' }}>UPI (₹)</label>
                        <input type="number" className="form-input" style={{ width: '100%' }} value={payUpi}
                          onChange={(e) => { setPayUpi(e.target.value); setPayMode('custom') }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                      <span style={{ color: '#a1a1aa' }}>Paying: <strong>₹{totalPaying.toFixed(2)}</strong></span>
                      <span style={{ color: '#a1a1aa' }}>Remaining: <strong style={{ color: remaining > 0 ? '#f59e0b' : '#10b981' }}>₹{remaining.toFixed(2)}</strong></span>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '12px', background: 'rgba(99,102,241,0.07)', borderRadius: '8px', border: '1px dashed rgba(99,102,241,0.2)', fontSize: '13px' }}>
                    <strong style={{ color: '#818cf8' }}>{payModalBill.customerName}</strong> is paying <strong>₹{totalPaying.toFixed(2)}</strong>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#a1a1aa' }}>This will automatically settle:</div>
                    {previewSettlements.map(({ bill, apply }) => (
                      <div key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                        <span>✓ {bill.customerName} ({bill.id})</span>
                        <strong style={{ color: '#10b981' }}>₹{apply.toFixed(2)}</strong>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                      <span style={{ color: '#a1a1aa' }}>Group Balance after:</span>
                      <strong style={{ color: remaining > 0 ? '#f59e0b' : '#10b981' }}>₹{remaining.toFixed(2)}</strong>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={showConfirmScreen ? () => setShowConfirmScreen(false) : closeModal}>
                  {showConfirmScreen ? 'Back' : 'Cancel'}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => {
                  const cash = Number(payCash || 0)
                  const upi = Number(payUpi || 0)
                  const total = cash + upi
                  if (total <= 0) return
                  if (total > groupBal + 0.01) { alert(`Cannot exceed group balance of ₹${groupBal.toFixed(2)}`); return }
                  if (!showConfirmScreen && total > (payModalBill.balance || 0) + 0.01) {
                    setShowConfirmScreen(true); return
                  }
                  recordSplitGroupPayment({ payerBillId: payModalBill.id, payerCustomerId: payModalBill.customerId, cashAmount: cash, upiAmount: upi, groupBillId: payModalGroup.id })
                  closeModal()
                }}>
                  {showConfirmScreen ? 'Confirm & Settle' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default GroupBilling
