import React, { useState, useMemo } from 'react'
import { Users, Plus, Trash2, CheckCircle, AlertTriangle, Wallet, X, ChevronDown, Tag, ArrowLeftRight, Printer, Download, MessageCircle, FileText } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useAppContext } from '../context/AppContext'
import { validatePromoCode } from '../api/promoCodes'
import { formatWhatsAppReceipt } from '../utils/receiptFormatter'
import { getDisplayBillId, getDisplayCustomerId, getDisplayGroupId, getDisplayPaymentId } from '../utils/idFormatter'

const makeItemRow = (inventory = []) => {
  const hasInv = inventory && inventory.length > 0
  const first = hasInv ? inventory[0] : null
  return {
    id: `row-${Date.now()}-${Math.random()}`,
    itemId: first?.id || '',
    itemName: first?.name || '',
    isCustom: !hasInv,
    printType: 'color',
    sides: 'single',
    qty: 1,
    unitPrice: first?.colorSingle ?? 0,
    amount: first?.colorSingle ?? 0,
    gstRate: 0,
  }
}


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
  if (item.item_type === 'service' || item.item_type === 'product' || item.item_type === 'stationery') {
    return Number(item.unit_price || 0)
  }
  if (printType === 'color' && sides === 'single') return item.colorSingle
  if (printType === 'color' && sides === 'double') return item.colorDouble
  if (printType === 'bw' && sides === 'single') return item.bwSingle
  if (printType === 'bw' && sides === 'double') return item.bwDouble
  return Number(item.unit_price || 0)
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
      {inventory.flatMap((item) => {
        const type = item.item_type || 'paper'
        if (type === 'service' || type === 'product' || type === 'stationery') {
          const price = Number(item.unit_price || 0)
          if (!price) return []
          const label = `${item.name}${item.unit ? ` (${item.unit})` : ''}`
          const existing = rows?.find((r) => !r.isCustom && r.itemId === item.id)
          return [(
            <button
              key={`${item.id}-service`}
              type="button"
              onClick={() => handleQuickAdd(item.id, item.name, 'na', 'na', price)}
              style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '16px', whiteSpace: 'nowrap', cursor: 'pointer',
                border: existing ? '1px solid #f59e0b' : '1px solid rgba(245,158,11,0.3)',
                background: existing ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.06)',
                color: existing ? '#f59e0b' : '#a1a1aa',
              }}
            >
              {label}{existing ? ` ×${existing.qty}` : ''}
            </button>
          )]
        }
        return [['color', 'single'], ['color', 'double'], ['bw', 'single'], ['bw', 'double']].map(([printType, sides]) => {
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
      })}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <select
                className="form-input"
                style={{ fontSize: '11px', padding: '2px 4px', height: '22px' }}
                value={row.category || 'other'}
                onChange={(e) => updateRow(row.id, { category: e.target.value })}
              >
                <option value="paper">📄 Paper &amp; Print</option>
                <option value="product">📦 Stationery / Product</option>
                <option value="service">✂️ Service</option>
                <option value="other">🏷️ Other</option>
              </select>
              <input
                className="form-input" style={{ fontSize: '13px', padding: '5px 8px' }}
                placeholder="Item name"
                value={row.itemName}
                onChange={(e) => updateRow(row.id, { itemName: e.target.value })}
              />
            </div>
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
const MemberCard = ({ member, idx, members, customers, inventory, onChange, onRemove, settings, _promoCodes, _date, memberTotals, sharedRows, onAddNewCustomerClick, sharedDiscountMode, sharedGroupDiscount, sharedCostDistribution = 'split' }) => {
  const customer = customers.find((c) => c.id === member.customerId)
  const advance = Number(customer?.advanceBalance || customer?.creditBalance || 0)
  const loyaltyEnabled = settings?.loyaltyEnabled !== false
  const loyaltyRedeemEnabled = settings?.loyaltyRedeemEnabled !== false
  const hasLoyalty = customer && customer.type === 'regular' && loyaltyEnabled && loyaltyRedeemEnabled

  const memberCount = Math.max(members.length, 1)
  const isSplitCost = sharedCostDistribution === 'split'
  const sharedGst = (sharedRows || []).reduce((sum, r) => sum + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0)
  const memberSharedGst = isSplitCost && memberCount > 1 ? (sharedGst / memberCount) : sharedGst
  const addonGst = member.hasAddons ? (member.addonRows || []).reduce((sum, r) => sum + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0) : 0
  const autoGst = memberSharedGst + addonGst

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'var(--accent)', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff' }}>{idx + 1}</div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <select className="form-input" style={{ minWidth: '180px', fontSize: '13px' }} value={member.customerId}
              onChange={(e) => onChange(member.id, { customerId: e.target.value })}>
              <option value="">— Select Customer —</option>
              {customers.filter((c) => !c.deleted && !members.some(m => m.id !== member.id && m.customerId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name} ({getDisplayCustomerId(c)})</option>)}
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
                onClick={async () => {
                  const code = (member.promoCodeInput || '').trim().toUpperCase()
                  if (!code) return
                  const mSubtotal = memberTotals[idx]?.subtotal || 0
                  try {
                    const res = await validatePromoCode({
                      code,
                      customer_id: member.customerId || null,
                      bill_amount: mSubtotal,
                    })
                    if (res.data?.success && res.data?.valid) {
                      const promoData = res.data.data
                      onChange(member.id, {
                        appliedPromo: {
                          id: promoData.promo_id,
                          code: promoData.code,
                          type: promoData.discount_type,
                          value: promoData.discount_value,
                          discountAmount: promoData.discount_amount,
                          remainingUses: promoData.remaining_uses,
                        },
                        promoError: '',
                        promoCodeInput: ''
                      })
                    } else {
                      onChange(member.id, { promoError: res.data?.error || 'Invalid promo code' })
                    }
                  } catch (err) {
                    onChange(member.id, { promoError: err.response?.data?.error || 'Invalid or expired promo code' })
                  }
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
  const { customers, inventory, addGroupBill, showAlert, showToast, settings, promoCodes, addCustomer } = useAppContext()

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
  const [activeReceiptGroup, setActiveReceiptGroup] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Shared/Addon mode state ─────────────────────────────────────────────────
  const [sharedRows, setSharedRows] = useState(() => [makeItemRow(inventory)])
  const [members, setMembers] = useState([
    { id: `m-${Date.now()}`, customerId: '', hasAddons: false, addonRows: [], discountType: 'flat', discountValue: 0, useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0 },
  ])
  const [sharedDiscountMode, setSharedDiscountMode] = useState('individual') // 'individual' | 'group'
  const [sharedGroupDiscount, setSharedGroupDiscount] = useState({ type: 'flat', value: 0 })
  const [sharedCostDistribution, setSharedCostDistribution] = useState('split') // 'split' | 'full'

  // ── Split mode state ────────────────────────────────────────────────────────
  const [splitRows, setSplitRows] = useState(() => [makeItemRow(inventory)])
  const [splitMembers, setSplitMembers] = useState([
    { id: `sm-${Date.now()}`, customerId: '', useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, discountType: 'flat', discountValue: 0, cashPaid: '', upiPaid: '' },
    { id: `sm-${Date.now()}-2`, customerId: '', useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, discountType: 'flat', discountValue: 0, cashPaid: '', upiPaid: '' },
  ])
  const [roundingMode, setRoundingMode] = useState('up') // 'up' | 'down'
  const [splitDiscountMode, setSplitDiscountMode] = useState('individual') // 'individual' | 'group'
  const [splitGroupDiscount, setSplitGroupDiscount] = useState({ type: 'flat', value: 0 })

  // ── Split Settlement Preset state ───────────────────────────────────────────
  const [settlementPreset, setSettlementPreset] = useState('equal') // 'equal' | 'single' | 'custom'
  const [singlePayerCustId, setSinglePayerCustId] = useState('')
  const [singlePayerMethod, setSinglePayerMethod] = useState('cash') // 'cash' | 'upi'

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers])

  // ── Shared mode calculations ─────────────────────────────────────────────────
  const sharedSubtotal = useMemo(() => sharedRows.reduce((s, r) => s + Number(r.amount || 0), 0), [sharedRows])

  const memberTotals = useMemo(() => {
    const memberCount = Math.max(members.length, 1)
    const isSplitCost = sharedCostDistribution === 'split'
    const memberSharedShare = isSplitCost ? (sharedSubtotal / memberCount) : sharedSubtotal
    const sharedGst = sharedRows.reduce((sum, r) => sum + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0)
    const memberSharedGst = isSplitCost ? (sharedGst / memberCount) : sharedGst

    return members.map((m) => {
      const addonSubtotal = m.hasAddons ? m.addonRows.reduce((s, r) => s + Number(r.amount || 0), 0) : 0
      const baseTotal = memberSharedShare + addonSubtotal
      const addonGst = m.hasAddons ? m.addonRows.reduce((sum, r) => sum + (Number(r.amount || 0) * (Number(r.gstRate || 0) / 100)), 0) : 0
      const autoGst = memberSharedGst + addonGst
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
    })
  },
  [members, sharedSubtotal, sharedRows, settings, sharedDiscountMode, sharedGroupDiscount, sharedCostDistribution]
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

  // ── Split Settlement & Allocation Logic ─────────────────────────────────────
  const splitSettlementData = useMemo(() => {
    const memberShares = splitMembers.map((m, idx) => {
      const cust = activeCustomers.find(c => c.id === m.customerId)
      const adv = Number(cust?.advanceBalance || cust?.creditBalance || 0)
      const { total } = splitMemberTotals[idx] || { total: 0 }
      const advUsed = m.useAdvance ? Math.min(adv, total) : 0
      const netShare = Math.max(0, total - advUsed)
      const cash = Number(m.cashPaid || 0)
      const upi = Number(m.upiPaid || 0)
      const directPaid = cash + upi

      return {
        member: m,
        customer: cust,
        customerName: cust?.name || `Member ${idx + 1}`,
        total,
        advUsed,
        netShare,
        cash,
        upi,
        directPaid
      }
    })

    const totalGroupBill = memberShares.reduce((s, m) => s + m.total, 0)
    const totalAdvUsed = memberShares.reduce((s, m) => s + m.advUsed, 0)
    const totalNetShare = memberShares.reduce((s, m) => s + m.netShare, 0)
    const totalDirectPaid = memberShares.reduce((s, m) => s + m.directPaid, 0)
    const totalCash = memberShares.reduce((s, m) => s + m.cash, 0)
    const totalUpi = memberShares.reduce((s, m) => s + m.upi, 0)

    // Build deficits and excess
    const deficits = memberShares.map((m, idx) => ({
      idx,
      customerId: m.member.customerId,
      customerName: m.customerName,
      amountNeeded: Math.max(0, m.netShare - m.directPaid),
      sponsoredFrom: []
    }))

    const sponsors = memberShares.map((m, idx) => ({
      idx,
      customerId: m.member.customerId,
      customerName: m.customerName,
      availableExcess: Math.max(0, m.directPaid - m.netShare),
      sponsoring: []
    }))

    // Match excess with deficits (cross-member sponsoring)
    for (const sp of sponsors) {
      if (sp.availableExcess <= 0) continue
      for (const def of deficits) {
        if (sp.availableExcess <= 0) break
        if (def.idx === sp.idx) continue
        if (def.amountNeeded <= 0) continue

        const alloc = Math.min(sp.availableExcess, def.amountNeeded)
        sp.availableExcess = Number((sp.availableExcess - alloc).toFixed(2))
        def.amountNeeded = Number((def.amountNeeded - alloc).toFixed(2))

        sp.sponsoring.push({
          toMemberIdx: def.idx,
          toCustomerId: def.customerId,
          toCustomerName: def.customerName,
          amount: Number(alloc.toFixed(2))
        })

        def.sponsoredFrom.push({
          fromMemberIdx: sp.idx,
          fromCustomerId: sp.customerId,
          fromCustomerName: sp.customerName,
          amount: Number(alloc.toFixed(2))
        })
      }
    }

    const computedMembers = memberShares.map((m, idx) => {
      const def = deficits[idx]
      const sp = sponsors[idx]
      const sponsoredReceived = def.sponsoredFrom.reduce((s, x) => s + x.amount, 0)
      const remainingDeficit = def.amountNeeded
      const unusedExcess = sp.availableExcess
      const finalBal = Math.max(0, m.total - (m.advUsed + m.directPaid + sponsoredReceived))
      const status = finalBal <= 0 ? 'paid' : ((m.advUsed + m.directPaid + sponsoredReceived) > 0 ? 'partial' : 'unpaid')

      return {
        ...m,
        sponsoring: sp.sponsoring,
        sponsoredFrom: def.sponsoredFrom,
        sponsoredReceived,
        unusedExcess,
        remainingDeficit,
        finalBal,
        status
      }
    })

    const groupRemainingDue = Math.max(0, totalNetShare - totalDirectPaid)

    return {
      computedMembers,
      totalGroupBill,
      totalAdvUsed,
      totalNetShare,
      totalDirectPaid,
      totalCash,
      totalUpi,
      groupRemainingDue
    }
  }, [splitMembers, splitMemberTotals, activeCustomers])

  const applyPresetEqual = () => {
    setSettlementPreset('equal')
    setSplitMembers((cur) =>
      cur.map((m, idx) => {
        const cust = activeCustomers.find((c) => c.id === m.customerId)
        const adv = Number(cust?.advanceBalance || cust?.creditBalance || 0)
        const { total } = splitMemberTotals[idx] || { total: 0 }
        const advUsed = m.useAdvance ? Math.min(adv, total) : 0
        const needed = Math.max(0, total - advUsed)
        return {
          ...m,
          cashPaid: needed > 0 ? String(needed) : '',
          upiPaid: ''
        }
      })
    )
  }

  const applyPresetSinglePayer = (payerCustId, method = singlePayerMethod) => {
    setSettlementPreset('single')
    const totalNeeded = splitSettlementData.totalNetShare
    setSplitMembers((cur) =>
      cur.map((m) => {
        if (m.customerId === payerCustId) {
          return {
            ...m,
            cashPaid: method === 'cash' ? String(totalNeeded) : '',
            upiPaid: method === 'upi' ? String(totalNeeded) : ''
          }
        }
        return { ...m, cashPaid: '', upiPaid: '' }
      })
    )
  }

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
    setSplitMembers((cur) => [
      ...cur,
      { id: `sm-${Date.now()}`, customerId: '', useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, customGst: '', discountType: 'flat', discountValue: 0, cashPaid: '', upiPaid: '' }
    ])

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
      { id: `sm-${Date.now()}`, customerId: '', useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, customGst: '', discountType: 'flat', discountValue: 0, cashPaid: '', upiPaid: '' },
      { id: `sm-${Date.now()}-2`, customerId: '', useAdvance: false, shouldRedeemPoints: false, loyaltyPointsRedeemed: 0, customGst: '', discountType: 'flat', discountValue: 0, cashPaid: '', upiPaid: '' },
    ])
    setNotes('')
    setRoundingMode('up')
    setSettlementPreset('equal')
    setSinglePayerCustId('')
    setSinglePayerMethod('cash')
    setSharedDiscountMode('individual')
    setSharedGroupDiscount({ type: 'flat', value: 0 })
    setSharedCostDistribution('split')
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
    const memberCount = Math.max(members.length, 1)
    const isSplitCost = sharedCostDistribution === 'split'
    const groupMembers = members.map((m, i) => {
      const { subtotal, gstAmount, cgst, sgst, discountAmount, loyaltyDiscount, total } = memberTotals[i]
      const allItems = [
        ...sharedRows.map((r) => {
          const qty = Number(r.qty)
          const baseUnitPrice = Number(r.unitPrice)
          const baseAmount = Number(r.amount)
          const unitPrice = isSplitCost && memberCount > 1 ? Number((baseUnitPrice / memberCount).toFixed(2)) : baseUnitPrice
          const amount = isSplitCost && memberCount > 1 ? Number((baseAmount / memberCount).toFixed(2)) : baseAmount
          const itemName = isSplitCost && memberCount > 1 ? `${r.itemName} (1/${memberCount} share)` : r.itemName
          return {
            itemId: r.itemId,
            itemName,
            printType: r.printType,
            sides: r.sides,
            qty,
            unitPrice,
            amount,
            gstRate: Number(r.gstRate || 0),
          }
        }),
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

      const computed = splitSettlementData.computedMembers[idx]

      return {
        customerId: m.customerId,
        items: splitRows.map((r) => {
          const qty = Number(r.qty)
          const baseUnitPrice = Number(r.unitPrice)
          const baseAmount = Number(r.amount)
          const unitPrice = splitCount > 1 ? Number((baseUnitPrice / splitCount).toFixed(2)) : baseUnitPrice
          const amount = splitCount > 1 ? Number((baseAmount / splitCount).toFixed(2)) : baseAmount
          const itemName = `${r.itemName} (Shared 1/${splitCount} Split)`
          return {
            itemId: r.itemId,
            itemName,
            printType: r.printType,
            sides: r.sides,
            qty,
            unitPrice,
            amount,
            gstRate: Number(r.gstRate || 0),
          }
        }),
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
        cashPaid: computed.cash,
        upiPaid: computed.upi,
        sponsoredAmount: computed.sponsoredReceived,
        sponsoring: computed.sponsoring,
        settledByGroupPayment: computed.sponsoredReceived > 0 && computed.directPaid < total,
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

      // Open Split Receipt Modal for this group bill
      setActiveReceiptGroup({
        id: grpId,
        type: 'split',
        date,
        dueDate,
        notes,
        splitCount,
        roundingMode,
        createdAt: new Date().toISOString()
      })

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
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Shared Items <span style={{ color: '#71717a', fontSize: '12px', fontWeight: 400 }}>({sharedCostDistribution === 'split' ? 'divided equally among members' : 'same for all members'})</span></h3>
              <div style={{ fontSize: '14px', color: '#a3e635', fontWeight: 700 }}>
                Subtotal: ₹{sharedSubtotal.toFixed(2)}
                {members.length > 1 && sharedCostDistribution === 'split' && (
                  <span style={{ fontSize: '12px', color: '#71717a', fontWeight: 400, marginLeft: '6px' }}>
                    (₹{(sharedSubtotal / members.length).toFixed(2)} / member)
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '10px', display: 'grid', gridTemplateColumns: '1.4fr 90px 90px 60px 90px 80px 1fr 32px', gap: '6px' }}>
              <span>Item</span><span>Type</span><span>Sides</span><span>Qty</span><span>Unit Price</span><span>GST Rate</span><span style={{ textAlign: 'right' }}>Amount</span><span></span>
            </div>
            <QuickAddPanel inventory={inventory} rows={sharedRows} setRows={setSharedRows} />
            <ItemRowEditor rows={sharedRows} setRows={setSharedRows} inventory={inventory} />
          </div>

          {/* Discount & Distribution Settings */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600 }}>Billing & Discount Settings</h3>
            <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Cost Distribution</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${sharedCostDistribution === 'split' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={() => setSharedCostDistribution('split')}
                  >
                    Divide Equally (₹{(sharedSubtotal / Math.max(members.length, 1)).toFixed(2)} / member)
                  </button>
                  <button
                    type="button"
                    className={`btn ${sharedCostDistribution === 'full' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={() => setSharedCostDistribution('full')}
                  >
                    Full Amount per Member (₹{sharedSubtotal.toFixed(2)} each)
                  </button>
                </div>
              </div>

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
                sharedCostDistribution={sharedCostDistribution}
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
                      const { gstAmount, discountAmount, loyaltyDiscount, total } = memberTotals[i]
                      const adv = Number(cust?.advanceBalance || 0)
                      const advUsed = m.useAdvance ? Math.min(adv, total) : 0
                      const remaining = Math.max(total - advUsed, 0)
                      const status = advUsed >= total ? 'paid' : advUsed > 0 ? 'partial' : 'unpaid'
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 10px', color: '#71717a' }}>{i + 1}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{cust?.name || <span style={{ color: '#ef4444' }}>Not selected</span>}</td>
                          <td style={{ padding: '8px 10px' }}>
                            ₹{(sharedCostDistribution === 'split' ? sharedSubtotal / Math.max(members.length, 1) : sharedSubtotal).toFixed(2)}
                            {sharedCostDistribution === 'split' && members.length > 1 && (
                              <span style={{ fontSize: '10px', color: '#71717a', display: 'block' }}>
                                (1/{members.length} share)
                              </span>
                            )}
                          </td>
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
              const status = advUsed >= memberTotal ? 'paid' : advUsed > 0 ? 'partial' : 'unpaid'

              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', background: 'var(--surface)', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ background: 'var(--accent)', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1 }}>
                      <select className="form-input" style={{ flex: 1, fontSize: '13px' }} value={m.customerId}
                        onChange={(e) => updateSplitMember(m.id, { customerId: e.target.value })}>
                        <option value="">— Select Customer —</option>
                        {activeCustomers.filter((c) => !splitMembers.some(sm => sm.id !== m.id && sm.customerId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name} ({getDisplayCustomerId(c)})</option>)}
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
                                onClick={async () => {
                                  const code = (m.promoCodeInput || '').trim().toUpperCase()
                                  if (!code) return
                                  try {
                                    const res = await validatePromoCode({
                                      code,
                                      customer_id: m.customerId || null,
                                      bill_amount: splitAmount,
                                    })
                                    if (res.data?.success && res.data?.valid) {
                                      const promoData = res.data.data
                                      updateSplitMember(m.id, {
                                        appliedPromo: {
                                          id: promoData.promo_id,
                                          code: promoData.code,
                                          type: promoData.discount_type,
                                          value: promoData.discount_value,
                                          discountAmount: promoData.discount_amount,
                                          remainingUses: promoData.remaining_uses,
                                        },
                                        promoError: '',
                                        promoCodeInput: ''
                                      })
                                    } else {
                                      updateSplitMember(m.id, { promoError: res.data?.error || 'Invalid promo code' })
                                    }
                                  } catch (err) {
                                    updateSplitMember(m.id, { promoError: err.response?.data?.error || 'Invalid or expired promo code' })
                                  }
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

          {/* ── Settlement & Payment Matrix ── */}
          <div className="card" style={{ marginBottom: '24px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={16} className="text-accent" /> Payment & Settlement Allocation Matrix
                </h3>
                <span style={{ fontSize: '12px', color: '#71717a' }}>
                  Choose a preset or enter flexible Cash/UPI payments. Overpayments automatically sponsor remaining members.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${settlementPreset === 'equal' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={applyPresetEqual}
                >
                  Equal Shares
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${settlementPreset === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => {
                    const firstCustId = splitMembers.find(m => m.customerId)?.customerId || ''
                    setSinglePayerCustId(firstCustId)
                    applyPresetSinglePayer(firstCustId, singlePayerMethod)
                  }}
                >
                  Pay Full by 1 Member
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${settlementPreset === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => setSettlementPreset('custom')}
                >
                  Custom / Sponsor
                </button>
              </div>
            </div>

            {/* If Single Payer Preset Active */}
            {settlementPreset === 'single' && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', border: '1px dashed rgba(99,102,241,0.3)', marginBottom: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#818cf8' }}>Select Payer:</span>
                <select
                  className="form-input"
                  style={{ fontSize: '12px', padding: '4px 8px', maxWidth: '220px' }}
                  value={singlePayerCustId}
                  onChange={(e) => {
                    setSinglePayerCustId(e.target.value)
                    applyPresetSinglePayer(e.target.value, singlePayerMethod)
                  }}
                >
                  <option value="">— Select Customer —</option>
                  {splitMembers.map((sm, i) => {
                    const c = activeCustomers.find(x => x.id === sm.customerId)
                    return (
                      <option key={sm.id} value={sm.customerId}>
                        {c?.name || `Member ${i + 1}`}
                      </option>
                    )
                  })}
                </select>
                <span style={{ fontSize: '12px', color: '#a1a1aa' }}>via</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${singlePayerMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => {
                      setSinglePayerMethod('cash')
                      applyPresetSinglePayer(singlePayerCustId, 'cash')
                    }}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${singlePayerMethod === 'upi' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => {
                      setSinglePayerMethod('upi')
                      applyPresetSinglePayer(singlePayerCustId, 'upi')
                    }}
                  >
                    UPI
                  </button>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#a3e635', fontWeight: 600 }}>
                  Pays Full Group: ₹{splitSettlementData.totalNetShare.toFixed(2)}
                </span>
              </div>
            )}

            {/* Matrix Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#71717a' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px' }}>Member</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Share</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Advance</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', width: '100px' }}>Cash (₹)</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', width: '100px' }}>UPI (₹)</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>Sponsorship / Cross-Payment</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Balance Due</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {splitSettlementData.computedMembers.map((cm) => (
                    <tr key={cm.member.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>
                        <div>{cm.customerName}</div>
                        {cm.customer?.phone && (
                          <div style={{ fontSize: '11px', color: '#71717a' }}>{cm.customer.phone}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', color: '#a3e635', fontWeight: 600 }}>
                        ₹{cm.total.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', color: cm.advUsed > 0 ? '#10b981' : '#71717a' }}>
                        {cm.advUsed > 0 ? `₹${cm.advUsed.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input"
                          style={{ width: '90px', fontSize: '12px', padding: '4px 6px', textAlign: 'right' }}
                          placeholder="0.00"
                          value={cm.member.cashPaid ?? ''}
                          onChange={(e) => {
                            setSettlementPreset('custom')
                            updateSplitMember(cm.member.id, { cashPaid: e.target.value })
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input"
                          style={{ width: '90px', fontSize: '12px', padding: '4px 6px', textAlign: 'right' }}
                          placeholder="0.00"
                          value={cm.member.upiPaid ?? ''}
                          onChange={(e) => {
                            setSettlementPreset('custom')
                            updateSplitMember(cm.member.id, { upiPaid: e.target.value })
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '12px' }}>
                        {cm.sponsoring && cm.sponsoring.length > 0 ? (
                          <div style={{ color: '#818cf8', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {cm.sponsoring.map((s, si) => (
                              <span key={si}>+ Sponsoring ₹{s.amount.toFixed(2)} for {s.toCustomerName}</span>
                            ))}
                          </div>
                        ) : cm.sponsoredFrom && cm.sponsoredFrom.length > 0 ? (
                          <div style={{ color: '#10b981', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {cm.sponsoredFrom.map((s, si) => (
                              <span key={si}>✓ Covered ₹{s.amount.toFixed(2)} by {s.fromCustomerName}</span>
                            ))}
                          </div>
                        ) : cm.directPaid >= cm.netShare && cm.netShare > 0 ? (
                          <span style={{ color: '#71717a' }}>Own share settled</span>
                        ) : (
                          <span style={{ color: '#71717a' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700, color: cm.finalBal > 0 ? '#f59e0b' : '#10b981' }}>
                        ₹{cm.finalBal.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                          background: cm.status === 'paid' ? 'rgba(16,185,129,0.15)' : cm.status === 'partial' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                          color: cm.status === 'paid' ? '#10b981' : cm.status === 'partial' ? '#f59e0b' : '#ef4444',
                        }}>
                          {cm.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: '18px', fontSize: '13px', flexWrap: 'wrap' }}>
                <div><span style={{ color: '#71717a' }}>Group Total:</span> <strong style={{ color: '#fff' }}>₹{splitSettlementData.totalGroupBill.toFixed(2)}</strong></div>
                <div><span style={{ color: '#71717a' }}>Cash Inflow:</span> <strong style={{ color: '#10b981' }}>₹{splitSettlementData.totalCash.toFixed(2)}</strong></div>
                <div><span style={{ color: '#71717a' }}>UPI Inflow:</span> <strong style={{ color: '#3b82f6' }}>₹{splitSettlementData.totalUpi.toFixed(2)}</strong></div>
                {splitSettlementData.totalAdvUsed > 0 && (
                  <div><span style={{ color: '#71717a' }}>Advance Used:</span> <strong style={{ color: '#10b981' }}>₹{splitSettlementData.totalAdvUsed.toFixed(2)}</strong></div>
                )}
                <div><span style={{ color: '#71717a' }}>Balance Due:</span> <strong style={{ color: splitSettlementData.groupRemainingDue > 0 ? '#f59e0b' : '#10b981' }}>₹{splitSettlementData.groupRemainingDue.toFixed(2)}</strong></div>
              </div>
              <div>
                {splitSettlementData.groupRemainingDue <= 0.01 ? (
                  <span style={{ padding: '4px 12px', borderRadius: '16px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
                    ✓ All member shares fully settled
                  </span>
                ) : (
                  <span style={{ padding: '4px 12px', borderRadius: '16px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>
                    ₹{splitSettlementData.groupRemainingDue.toFixed(2)} balance remaining on bill creation
                  </span>
                )}
              </div>
            </div>
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
        <GroupBillsHistory onOpenReceipt={(grp) => setActiveReceiptGroup(grp)} />
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

      {/* Split Receipt Modal */}
      {activeReceiptGroup && (
        <SplitReceiptModal
          group={activeReceiptGroup}
          onClose={() => setActiveReceiptGroup(null)}
        />
      )}
    </div>
  )
}

// ── Group Bills History List ───────────────────────────────────────────────────
const GroupBillsHistory = ({ onOpenReceipt }) => {
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
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>{getDisplayGroupId(grp)}</span>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: grp.type === 'split' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.12)', color: grp.type === 'split' ? '#818cf8' : '#10b981', fontWeight: 600 }}>
                  {grp.type === 'split' ? 'Split' : 'Shared'}
                </span>
                <span style={{ fontSize: '13px', color: '#a1a1aa' }}>{memberBills.length} members · {grp.date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#a3e635' }}>₹{totalAmount.toFixed(2)}</span>
                <span style={{ fontSize: '12px', color: '#10b981' }}>Paid: ₹{paidAmount.toFixed(2)}</span>
                <span style={{ fontSize: '12px', color: balanceAmount > 0 ? '#f59e0b' : '#10b981' }}>Bal: ₹{balanceAmount.toFixed(2)}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '12px' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenReceipt?.(grp)
                  }}
                  title="View / Print Group Split Receipt"
                >
                  <FileText size={13} /> Receipt
                </button>
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
                          <td style={{ padding: '7px 10px', color: 'var(--accent)', fontWeight: 600 }}>{getDisplayBillId(b)}</td>
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
                                    recordSpecificBillPayment({ billId: b.id, customerId: b.customerId, cashAmount: b.balance > 0 ? b.balance : b.total, upiAmount: 0, notes: `Payment for group member bill ${getDisplayBillId(b)}` })
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '10px', fontSize: '12px' }}>
                      <div><span style={{ color: '#a1a1aa' }}>Group ID:</span> <strong>{getDisplayGroupId(grp)}</strong></div>
                      <div><span style={{ color: '#a1a1aa' }}>Total:</span> <strong>₹{totalAmount.toFixed(2)}</strong></div>
                      <div><span style={{ color: '#a1a1aa' }}>Actual Payer:</span> <strong>{customers.find(c => c.id === groupPayment.customerId)?.name || 'Unknown'}</strong></div>
                      <div><span style={{ color: '#a1a1aa' }}>Ref:</span> <strong style={{ fontFamily: 'monospace' }}>{getDisplayPaymentId(groupPayment)}</strong></div>
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
                        <span>✓ {bill.customerName} ({getDisplayBillId(bill)})</span>
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

// ── Split Receipt Modal (Master & Individual Member Views) ─────────────────────
const SplitReceiptModal = ({ group, onClose }) => {
  const { bills, customers, business, settings } = useAppContext()
  const [viewMode, setViewMode] = useState('master') // 'master' | 'member'

  const memberBills = useMemo(() => {
    if (!group) return []
    let list = (group.memberBillIds || [])
      .map((id) => bills.find((b) => b.id === id && !b.deleted))
      .filter(Boolean)
    if (list.length === 0 && group.id) {
      list = bills.filter((b) => b.groupBillId === group.id && !b.deleted)
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

  const sharedItems = memberBills[0]?.items || []

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
      const contacts = [business?.phone ? `Phone: ${business.phone}` : '', business?.gstin ? `GSTIN: ${business.gstin}` : ''].filter(Boolean).join(' | ')
      if (contacts) {
        doc.text(contacts, W / 2, y, { align: 'center' })
        y += 4
      }

      doc.setDrawColor(203, 213, 225)
      doc.setLineWidth(0.4)
      doc.line(MARGIN, y, W - MARGIN, y)
      y += 6

      if (viewMode === 'master') {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(79, 70, 229)
        doc.text('GROUP SPLIT PURCHASE INVOICE & SETTLEMENT', W / 2, y, { align: 'center' })
        y += 7

        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 41, 59)
        doc.text(`Group ID: ${getDisplayGroupId(group)}`, MARGIN, y)
        doc.text(`Date: ${group.date || new Date().toISOString().slice(0, 10)}`, W - MARGIN, y, { align: 'right' })
        y += 5
        doc.text(`Split Members: ${memberBills.length}`, MARGIN, y)
        doc.text(`Status: ${isSettled ? 'FULLY SETTLED' : 'PARTIALLY SETTLED'}`, W - MARGIN, y, { align: 'right' })
        y += 7

        // Items Table
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text('Purchased Items (Shared)', MARGIN, y)
        y += 3

        doc.setFillColor(241, 245, 249)
        doc.rect(MARGIN, y, W - 2 * MARGIN, 6, 'F')
        doc.setTextColor(71, 85, 105)
        doc.text('Item', MARGIN + 2, y + 4.2)
        doc.text('Type', 85, y + 4.2)
        doc.text('Sides', 110, y + 4.2)
        doc.text('Qty', 135, y + 4.2)
        doc.text('Amount (₹)', W - MARGIN - 2, y + 4.2, { align: 'right' })
        y += 7

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 41, 59)
        sharedItems.forEach((item) => {
          const rawName = item.itemName || item.name || 'Item'
          const itemName = rawName.replace(/ \(Shared 1\/\d+ Split\)/g, '')
          doc.text(itemName.length > 36 ? itemName.slice(0, 34) + '…' : itemName, MARGIN + 2, y + 4)
          doc.text(item.printType ? (item.printType === 'bw' ? 'B&W' : 'Color') : '—', 85, y + 4)
          doc.text(item.sides ? (item.sides === 'double' ? '2-Sided' : '1-Sided') : '—', 110, y + 4)
          doc.text(String(item.qty || 1), 135, y + 4)
          const mult = group.splitCount || memberBills.length || 1
          const amt = Number(item.amount || 0) * mult
          doc.text(`₹${amt.toFixed(2)}`, W - MARGIN - 2, y + 4, { align: 'right' })
          y += 6
        })

        y += 4
        // Member Settlements
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text('Member Settlements & Sponsorship Breakdown', MARGIN, y)
        y += 3

        doc.setFillColor(241, 245, 249)
        doc.rect(MARGIN, y, W - 2 * MARGIN, 6, 'F')
        doc.setTextColor(71, 85, 105)
        doc.text('Member', MARGIN + 2, y + 4.2)
        doc.text('Share (₹)', 80, y + 4.2)
        doc.text('Paid (₹)', 110, y + 4.2)
        doc.text('Balance (₹)', 140, y + 4.2)
        doc.text('Status', W - MARGIN - 2, y + 4.2, { align: 'right' })
        y += 7

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 41, 59)
        memberBills.forEach((b) => {
          doc.text(b.customerName || 'Customer', MARGIN + 2, y + 4)
          doc.text(`₹${Number(b.total).toFixed(2)}`, 80, y + 4)
          doc.text(`₹${Number(b.amountPaid || 0).toFixed(2)}`, 110, y + 4)
          doc.text(`₹${Number(b.balance || 0).toFixed(2)}`, 140, y + 4)
          const stat = b.settledByGroupPayment ? 'SETTLED' : (b.status || 'unpaid').toUpperCase()
          doc.text(stat, W - MARGIN - 2, y + 4, { align: 'right' })
          y += 6
        })

        y += 4
        doc.setDrawColor(203, 213, 225)
        doc.line(MARGIN, y, W - MARGIN, y)
        y += 5

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.text(`Group Total: ₹${totalAmount.toFixed(2)}`, MARGIN, y)
        doc.text(`Total Paid: ₹${paidAmount.toFixed(2)}`, 95, y)
        doc.text(`Balance Due: ₹${balanceAmount.toFixed(2)}`, W - MARGIN, y, { align: 'right' })

      } else if (selectedBill) {
        // Individual Member PDF
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(79, 70, 229)
        doc.text('TAX INVOICE (SPLIT MEMBER SHARE)', W / 2, y, { align: 'center' })
        y += 7

        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 41, 59)
        doc.text(`Bill ID: ${getDisplayBillId(selectedBill)}`, MARGIN, y)
        doc.text(`Date: ${selectedBill.date}`, W - MARGIN, y, { align: 'right' })
        y += 5
        doc.text(`Customer: ${selectedBill.customerName}`, MARGIN, y)
        doc.text(`Group Ref: ${getDisplayGroupId(group)}`, W - MARGIN, y, { align: 'right' })
        y += 5
        doc.text(`Status: ${selectedBill.settledByGroupPayment ? 'SETTLED (GROUP PAYMENT)' : selectedBill.status.toUpperCase()}`, MARGIN, y)
        y += 7

        doc.setFillColor(241, 245, 249)
        doc.rect(MARGIN, y, W - 2 * MARGIN, 6, 'F')
        doc.setTextColor(71, 85, 105)
        doc.setFont('helvetica', 'bold')
        doc.text('Item (Split Share)', MARGIN + 2, y + 4.2)
        doc.text('Type', 90, y + 4.2)
        doc.text('Sides', 115, y + 4.2)
        doc.text('Qty', 135, y + 4.2)
        doc.text('Share (₹)', W - MARGIN - 2, y + 4.2, { align: 'right' })
        y += 7

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 41, 59)
        selectedBill.items.forEach((item) => {
          const rawName = item.itemName || item.name || 'Item'
          const nameWithBadge = rawName.includes('Split') ? rawName : `${rawName} (Shared 1/${group.splitCount || memberBills.length || 'N'} Split)`
          doc.text(nameWithBadge.length > 36 ? nameWithBadge.slice(0, 34) + '…' : nameWithBadge, MARGIN + 2, y + 4)
          doc.text(item.printType ? (item.printType === 'bw' ? 'B&W' : 'Color') : '—', 90, y + 4)
          doc.text(item.sides ? (item.sides === 'double' ? '2-Sided' : '1-Sided') : '—', 115, y + 4)
          doc.text(String(item.qty || 1), 135, y + 4)
          doc.text(`₹${Number(item.amount || 0).toFixed(2)}`, W - MARGIN - 2, y + 4, { align: 'right' })
          y += 6
        })

        y += 4
        doc.setDrawColor(203, 213, 225)
        doc.line(MARGIN, y, W - MARGIN, y)
        y += 5

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.text(`Share Total: ₹${Number(selectedBill.total).toFixed(2)}`, MARGIN, y)
        doc.text(`Paid: ₹${Number(selectedBill.amountPaid || 0).toFixed(2)}`, 95, y)
        doc.text(`Balance Due: ₹${Number(selectedBill.balance || 0).toFixed(2)}`, W - MARGIN, y, { align: 'right' })
      }

      doc.save(`SplitReceipt_${group.id}_${viewMode}.pdf`)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
    }
  }

  const handleWhatsApp = () => {
    if (viewMode === 'master') {
      let text = `🧾 *${(business?.shopName || 'PRINTPRO').toUpperCase()} - GROUP SPLIT RECEIPT*\n`
      text += `📄 Group ID: ${getDisplayGroupId(group)}\n`
      text += `📅 Date: ${group.date || new Date().toISOString().slice(0, 10)}\n`
      text += `💰 Total: ₹${totalAmount.toFixed(2)} | Paid: ₹${paidAmount.toFixed(2)} | Due: ₹${balanceAmount.toFixed(2)}\n`
      text += `━━━━━━━━━━━━━━━━━━━━━━━\n`
      text += `👥 *MEMBER BREAKDOWN:*\n`
      memberBills.forEach((b, i) => {
        text += `${i + 1}. *${b.customerName}*: Share ₹${Number(b.total).toFixed(2)} | Paid ₹${Number(b.amountPaid || 0).toFixed(2)} | Bal: ₹${Number(b.balance || 0).toFixed(2)} (${b.settledByGroupPayment ? 'SETTLED' : b.status.toUpperCase()})\n`
      })
      text += `━━━━━━━━━━━━━━━━━━━━━━━\nThank you for choosing ${business?.shopName || 'PrintPro'}!`
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
    } else if (selectedBill) {
      const cust = customers.find((c) => c.id === selectedBill.customerId)
      const phone = cust?.phone ? cust.phone.replace(/[^0-9]/g, '') : ''
      const text = formatWhatsAppReceipt(selectedBill, settings, business)
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} className="text-accent" /> Split Purchase Receipt — {getDisplayGroupId(group)}
            </h3>
            <span style={{ fontSize: '12px', color: '#71717a' }}>
              {memberBills.length} members · {group.date || new Date().toISOString().slice(0, 10)} · {isSettled ? 'Fully Settled' : 'Partially Paid'}
            </span>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>&times;</button>
        </div>

        {/* View Switcher & Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'master' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', padding: '4px 12px' }}
              onClick={() => setViewMode('master')}
            >
              Master Group Receipt
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'member' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', padding: '4px 12px' }}
              onClick={() => setViewMode('member')}
            >
              Individual Member Receipts
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint} title="Print Receipt">
              <Printer size={14} /> Print
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadPDF} title="Download PDF">
              <Download size={14} /> PDF
            </button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }} onClick={handleWhatsApp} title="Share WhatsApp">
              <MessageCircle size={14} /> WhatsApp
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Area */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '20px' }}>
          {viewMode === 'member' && (
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa' }}>Select Member:</span>
              <select
                className="form-input"
                style={{ fontSize: '12px', padding: '4px 10px', flex: 1 }}
                value={selectedBillId}
                onChange={(e) => setSelectedBillId(e.target.value)}
              >
                {memberBills.map((b, i) => (
                  <option key={b.id} value={b.id}>
                    {i + 1}. {b.customerName} ({getDisplayBillId(b)}) — Share: ₹{Number(b.total).toFixed(2)} ({b.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Render Visual Receipt Paper */}
          <div style={{
            background: '#ffffff',
            color: '#0f172a',
            padding: '24px 28px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            lineHeight: '1.6'
          }}>
            {/* Business Header */}
            <div style={{ textAlign: 'center', paddingBottom: '12px', borderBottom: '2px solid #334155', marginBottom: '14px' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>
                {business?.shopName || 'PrintPro'}
              </h2>
              {business?.address && <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{business.address}</p>}
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                {[business?.phone ? `Phone: ${business.phone}` : '', business?.gstin ? `GSTIN: ${business.gstin}` : ''].filter(Boolean).join(' | ')}
              </p>
            </div>

            {viewMode === 'master' ? (
              /* MASTER RECEIPT VIEW */
              <div>
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.5px', color: '#4f46e5' }}>
                    GROUP SPLIT PURCHASE INVOICE & SETTLEMENT
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                  <span><strong>Group ID:</strong> {getDisplayGroupId(group)}</span>
                  <span><strong>Date:</strong> {group.date || new Date().toISOString().slice(0, 10)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                  <span><strong>Split Members:</strong> {memberBills.length}</span>
                  <span><strong>Status:</strong> <strong style={{ color: isSettled ? '#10b981' : '#f59e0b' }}>{isSettled ? 'FULLY SETTLED' : 'PARTIALLY SETTLED'}</strong></span>
                </div>

                <hr style={{ borderColor: '#cbd5e1', margin: '8px 0 12px' }} />

                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '6px', color: '#334155' }}>Purchased Items (Shared)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #94a3b8', color: '#475569' }}>
                      <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                      <th style={{ textAlign: 'center', padding: '4px 4px' }}>Type</th>
                      <th style={{ textAlign: 'center', padding: '4px 4px' }}>Sides</th>
                      <th style={{ textAlign: 'center', padding: '4px 4px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '4px 0' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sharedItems.map((item, idx) => {
                      const rawName = item.itemName || item.name || 'Item'
                      const cleanName = rawName.replace(/ \(Shared 1\/\d+ Split\)/g, '')
                      const mult = group.splitCount || memberBills.length || 1
                      const fullAmt = Number(item.amount || 0) * mult
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '4px 0' }}>{cleanName}</td>
                          <td style={{ textAlign: 'center', padding: '4px 4px' }}>{item.printType === 'bw' ? 'B&W' : 'Color'}</td>
                          <td style={{ textAlign: 'center', padding: '4px 4px' }}>{item.sides === 'double' ? '2-Sided' : '1-Sided'}</td>
                          <td style={{ textAlign: 'center', padding: '4px 4px' }}>{item.qty}</td>
                          <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{fullAmt.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <hr style={{ borderColor: '#cbd5e1', margin: '8px 0 12px' }} />

                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '6px', color: '#334155' }}>Member Settlement Breakdown</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #94a3b8', color: '#475569' }}>
                      <th style={{ textAlign: 'left', padding: '4px 0' }}>Member</th>
                      <th style={{ textAlign: 'right', padding: '4px 4px' }}>Share</th>
                      <th style={{ textAlign: 'right', padding: '4px 4px' }}>Paid</th>
                      <th style={{ textAlign: 'right', padding: '4px 4px' }}>Balance</th>
                      <th style={{ textAlign: 'right', padding: '4px 0' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberBills.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px 0' }}>
                          <strong>{b.customerName}</strong>
                          {b.settledByGroupPayment && (
                            <span style={{ fontSize: '10px', color: '#4f46e5', display: 'block' }}>
                              Covered via Group Payment
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 4px' }}>₹{Number(b.total).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 4px', color: '#10b981' }}>₹{Number(b.amountPaid || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 4px', color: Number(b.balance) > 0 ? '#f59e0b' : '#10b981' }}>
                          ₹{Number(b.balance || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 0' }}>
                          <span style={{
                            padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                            background: b.settledByGroupPayment ? 'rgba(99,102,241,0.1)' : b.status === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: b.settledByGroupPayment ? '#4f46e5' : b.status === 'paid' ? '#059669' : '#dc2626'
                          }}>
                            {b.settledByGroupPayment ? 'SETTLED' : b.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', fontSize: '12px', marginTop: '10px', borderTop: '2px solid #334155', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <span>Total Group Amount:</span><strong>₹{totalAmount.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', color: '#059669' }}>
                    <span>Total Collected:</span><strong>₹{paidAmount.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', color: balanceAmount > 0 ? '#d97706' : '#059669' }}>
                    <span>Total Balance Due:</span><strong>₹{balanceAmount.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            ) : selectedBill ? (
              /* INDIVIDUAL MEMBER VIEW */
              <div>
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.5px', color: '#4f46e5' }}>
                    TAX INVOICE (SPLIT MEMBER SHARE)
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                  <span><strong>Bill ID:</strong> {getDisplayBillId(selectedBill)}</span>
                  <span><strong>Date:</strong> {selectedBill.date}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                  <span><strong>Customer:</strong> {selectedBill.customerName}</span>
                  <span><strong>Group Ref:</strong> {getDisplayGroupId(group)}</span>
                </div>
                <div style={{ marginBottom: '8px', fontSize: '12px' }}>
                  <strong>Status:</strong>{' '}
                  <span style={{
                    padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                    background: selectedBill.settledByGroupPayment ? 'rgba(99,102,241,0.1)' : selectedBill.status === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: selectedBill.settledByGroupPayment ? '#4f46e5' : selectedBill.status === 'paid' ? '#059669' : '#dc2626'
                  }}>
                    {selectedBill.settledByGroupPayment ? 'SETTLED VIA GROUP PAYMENT' : selectedBill.status.toUpperCase()}
                  </span>
                </div>

                <hr style={{ borderColor: '#cbd5e1', margin: '8px 0 12px' }} />

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #94a3b8', color: '#475569' }}>
                      <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                      <th style={{ textAlign: 'center', padding: '4px 4px' }}>Type</th>
                      <th style={{ textAlign: 'center', padding: '4px 4px' }}>Sides</th>
                      <th style={{ textAlign: 'center', padding: '4px 4px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '4px 4px' }}>Unit</th>
                      <th style={{ textAlign: 'right', padding: '4px 0' }}>Share (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px 0' }}>
                          <div>{item.itemName || item.name}</div>
                          <span style={{
                            display: 'inline-block',
                            fontSize: '9.5px',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#4f46e5',
                            marginTop: '2px'
                          }}>
                            (Shared 1/{group.splitCount || memberBills.length || 'N'} Split)
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '4px 4px' }}>{item.printType === 'bw' ? 'B&W' : 'Color'}</td>
                        <td style={{ textAlign: 'center', padding: '4px 4px' }}>{item.sides === 'double' ? '2-Sided' : '1-Sided'}</td>
                        <td style={{ textAlign: 'center', padding: '4px 4px' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right', padding: '4px 4px' }}>₹{Number(item.unitPrice).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{Number(item.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Member Totals */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', fontSize: '12px', marginTop: '10px', borderTop: '2px solid #334155', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <span>Share Subtotal:</span><strong>₹{Number(selectedBill.subtotal || 0).toFixed(2)}</strong>
                  </div>
                  {selectedBill.gstAmount > 0 && (
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <span>GST:</span><span>₹{Number(selectedBill.gstAmount).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(selectedBill.discountAmount || 0) > 0 && (
                    <div style={{ display: 'flex', gap: '24px', color: '#059669' }}>
                      <span>Discount:</span><span>-₹{Number(selectedBill.discountAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '24px', fontWeight: 'bold' }}>
                    <span>Member Total:</span><strong>₹{Number(selectedBill.total).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', color: '#059669' }}>
                    <span>Amount Paid:</span><strong>₹{Number(selectedBill.amountPaid || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', color: Number(selectedBill.balance) > 0 ? '#d97706' : '#059669' }}>
                    <span>Balance Due:</span><strong>₹{Number(selectedBill.balance || 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', fontSize: '10px', color: '#64748b' }}>
              Thank you for choosing {business?.shopName || 'PrintPro'}!
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

export default GroupBilling
