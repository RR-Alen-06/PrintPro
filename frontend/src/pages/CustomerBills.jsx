import React, { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { ClipboardList, Trash2, Pencil, X, Plus, Tag, CheckCircle, AlertTriangle } from 'lucide-react'

const CustomerBills = () => {
  const { customers, bills, inventory, editBill, deleteBill, showAlert, showConfirm } = useAppContext()

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers])
  const [selectedCustomerId, setSelectedCustomerId] = useState(activeCustomers[0]?.id || '')

  const selectedCustomer = useMemo(
    () => activeCustomers.find((c) => c.id === selectedCustomerId),
    [activeCustomers, selectedCustomerId]
  )

  const customerBills = useMemo(() => {
    if (!selectedCustomerId) return []
    return bills
      .filter((b) => !b.deleted && b.customerId === selectedCustomerId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [bills, selectedCustomerId])

  // ── Edit modal states ──
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingBill, setEditingBill] = useState(null)
  
  const [itemRows, setItemRows] = useState([])
  const [discountType, setDiscountType] = useState('flat')
  const [discountValue, setDiscountValue] = useState(0)
  const [cashAmount, setCashAmount] = useState(0)
  const [upiAmount, setUpiAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  
  const [duplicateWarning, setDuplicateWarning] = useState('')

  // ── Open / Close edit modal ──
  const openEditModal = (bill) => {
    setEditingBill(bill)
    setDate(bill.date || '')
    setDueDate(bill.dueDate || '')
    setDiscountType(bill.discountType || 'flat')
    setDiscountValue(bill.discountValue || 0)
    setCashAmount(bill.paymentMethod?.cash || 0)
    setUpiAmount(bill.paymentMethod?.upi || 0)
    setNotes(bill.notes || '')
    
    // Map items
    setItemRows(
      bill.items.map((item, idx) => ({
        id: `row-${Date.now()}-${idx}-${Math.random()}`,
        itemId: item.itemId || '',
        itemName: item.itemName || item.name || 'Custom Item',
        isCustom: !item.itemId,
        printType: item.printType || 'color',
        sides: item.sides || 'single',
        qty: item.qty || 1,
        unitPrice: item.unitPrice || 0,
        amount: item.amount || 0,
      }))
    )
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setEditingBill(null)
    setItemRows([])
    setDuplicateWarning('')
  }

  // ── Pricing helpers ──
  const getItemBasePrice = (itemId, printType, sides) => {
    const item = inventory.find((e) => e.id === itemId)
    if (!item) return 0
    if (printType === 'color' && sides === 'single') return item.colorSingle
    if (printType === 'color' && sides === 'double') return item.colorDouble
    if (printType === 'bw' && sides === 'single') return item.bwSingle
    if (printType === 'bw' && sides === 'double') return item.bwDouble
    return 0
  }

  // ── Items row management ──
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

  const handleComboChange = (rowId, changes) => {
    setDuplicateWarning('')
    setItemRows((current) => {
      const targetRow = current.find((r) => r.id === rowId)
      if (!targetRow || targetRow.isCustom) {
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
        setTimeout(() => {
          setDuplicateWarning('Merged quantity with duplicate item.')
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
    let defaultItemId = inventory[0]?.id || ''
    let defaultPrintType = 'color'
    let defaultSides = 'single'
    let defaultItemName = inventory[0]?.name || 'Custom Item'

    let foundUnused = false
    const combos = [
      { printType: 'color', sides: 'single' },
      { printType: 'color', sides: 'double' },
      { printType: 'bw', sides: 'single' },
      { printType: 'bw', sides: 'double' }
    ]

    for (const item of inventory) {
      for (const combo of combos) {
        const exists = itemRows.some(
          (r) => !r.isCustom && r.itemId === item.id && r.printType === combo.printType && r.sides === combo.sides
        )
        if (!exists) {
          defaultItemId = item.id
          defaultPrintType = combo.printType
          defaultSides = combo.sides
          defaultItemName = item.name
          foundUnused = true
          break
        }
      }
      if (foundUnused) break
    }

    const unitPrice = getItemBasePrice(defaultItemId, defaultPrintType, defaultSides)
    setItemRows((current) => [
      ...current,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        itemId: defaultItemId,
        itemName: defaultItemName,
        isCustom: false,
        printType: defaultPrintType,
        sides: defaultSides,
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

  // ── Totals Math ──
  const subtotal = itemRows.reduce((sum, r) => sum + Number(r.amount || 0), 0)
  const discountAmount =
    discountType === 'percent'
      ? (subtotal * Number(discountValue || 0)) / 100
      : Number(discountValue || 0)
  const total = Math.max(subtotal - discountAmount, 0)
  const amountPaid = Number(cashAmount || 0) + Number(upiAmount || 0)
  
  const customerAdvance = Number(selectedCustomer?.advanceBalance || 0)
  const currentBillAdvanceUsed = editingBill ? Number(editingBill.advanceUsed || 0) : 0
  const totalAvailableAdvance = customerAdvance + currentBillAdvanceUsed
  const appliedAdvance = Math.min(totalAvailableAdvance, total)
  
  const netBalance = Math.max(total - appliedAdvance - amountPaid, 0)
  const excessPaid = Math.max(amountPaid - Math.max(total - appliedAdvance, 0), 0)

  // ── Handle Save ──
  const handleSaveChanges = (e) => {
    e.preventDefault()
    if (!editingBill) return
    if (itemRows.length === 0) {
      showAlert('Please add at least one item.', 'error')
      return
    }

    const mergedItemRows = []
    itemRows.forEach((row) => {
      const existing = mergedItemRows.find(
        (item) =>
          !row.isCustom &&
          !item.isCustom &&
          item.itemId === row.itemId &&
          item.printType === row.printType &&
          item.sides === row.sides
      )
      if (existing) {
        existing.qty += Number(row.qty)
        existing.amount = existing.qty * existing.unitPrice
      } else {
        mergedItemRows.push({ ...row, qty: Number(row.qty) })
      }
    })

    const payload = {
      customerId: editingBill.customerId,
      customerType: editingBill.customerType,
      customerName: editingBill.customerName,
      date,
      dueDate,
      subtotal,
      discountType,
      discountValue: Number(discountValue || 0),
      discountAmount,
      total,
      rounding: editingBill.rounding || 0,
      cashAmount: Number(cashAmount || 0),
      upiAmount: Number(upiAmount || 0),
      amountPaid,
      advanceUsed: appliedAdvance,
      notes,
      paymentMode: amountPaid >= total - appliedAdvance ? 'full' : 'partial',
      items: mergedItemRows.map((row) => ({
        itemId: row.itemId,
        itemName: row.itemName,
        printType: row.printType,
        sides: row.sides,
        qty: Number(row.qty),
        unitPrice: Number(row.unitPrice),
        amount: Number(row.amount),
      })),
    }

    editBill(editingBill.id, payload)
    closeEditModal()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Customer Bills Manager</h1>
        <p>A separate space to view, delete, and fully edit line items and discounts for any customer's bills.</p>
      </div>

      <div className="grid-2" style={{ gap: '24px', alignItems: 'flex-start' }}>
        {/* Selection & Info */}
        <div className="card" style={{ width: '100%' }}>
          <h2 style={{ marginBottom: '16px' }}>Select Customer</h2>
          <select
            className="form-select"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <optgroup label="Regular Customers">
              {activeCustomers.filter((c) => c.type === 'regular').map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </optgroup>
            <optgroup label="Walk-in Customers">
              {activeCustomers.filter((c) => c.type === 'random').map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </optgroup>
          </select>

          {selectedCustomer && (
            <div style={{ marginTop: '16px', padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.875rem' }}>
              <div style={{ display: 'grid', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Customer Name</span>
                  <strong>{selectedCustomer.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Account Credit / Advance</span>
                  <span style={{ fontWeight: 600, color: 'var(--info)' }}>₹{Number(selectedCustomer.advanceBalance || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Outstanding Balance</span>
                  <span style={{ fontWeight: 600, color: 'var(--warning)' }}>
                    ₹{customerBills.reduce((s, b) => s + Number(b.balance || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bills list */}
        <div className="card" style={{ flex: 1 }}>
          <div className="bill-view-header" style={{ marginBottom: '16px' }}>
            <h2>Billing History ({customerBills.length})</h2>
          </div>

          {customerBills.length === 0 ? (
            <div className="empty-state">
              <ClipboardList />
              <h4>No bills found</h4>
              <p>This customer does not have any active bills recorded.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Bill ID</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ textAlign: 'right' }}>Paid (₹)</th>
                    <th style={{ textAlign: 'right' }}>Balance (₹)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customerBills.map((bill) => (
                    <tr key={bill.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{bill.id}</td>
                      <td>{bill.date}</td>
                      <td style={{ textAlign: 'right' }}>{Number(bill.total || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{Number(bill.amountPaid || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: bill.balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                        {Number(bill.balance || 0).toFixed(2)}
                      </td>
                      <td>
                        <span className={`badge badge-${bill.status}`}>
                          {bill.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                            onClick={() => openEditModal(bill)}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                            onClick={() => {
                              showConfirm(
                                'Delete Bill',
                                `Are you sure you want to delete bill ${bill.id}? This will restore customer credits.`,
                                () => deleteBill(bill.id)
                              )
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Bill Modal ── */}
      {isEditModalOpen && editingBill && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <div>
                <h3>Edit Bill - {editingBill.id}</h3>
                <p className="text-muted">Modify print items, quantities, pricing, and discount details.</p>
              </div>
              <button className="modal-close btn-icon" onClick={closeEditModal} type="button">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveChanges}>
              <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                {duplicateWarning && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', marginBottom: '16px',
                    background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 'var(--radius-md)', color: 'var(--warning)', fontSize: '0.875rem'
                  }}>
                    <AlertTriangle size={16} /> {duplicateWarning}
                  </div>
                )}

                <div className="grid-3" style={{ gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Bill Date</label>
                    <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer Name</label>
                    <div className="stat-card-value" style={{ fontSize: '1.1rem', marginTop: '6px' }}>{editingBill.customerName}</div>
                  </div>
                </div>

                {/* Print Items Table */}
                <h4 style={{ marginBottom: '10px' }}>Print Items</h4>
                <div className="table-container" style={{ marginBottom: '14px' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Print Type</th>
                        <th>Sides</th>
                        <th style={{ width: '80px' }}>Qty</th>
                        <th style={{ width: '100px' }}>Unit (₹)</th>
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
                                placeholder="Custom item name"
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
                          <td>₹{Number(row.amount || 0).toFixed(2)}</td>
                          <td>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(row.id)}>
                              <Trash2 size={14} style={{ color: 'var(--error)' }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
                    <Plus size={14} /> Add Item
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomRow}>
                    <Plus size={14} /> Custom Item
                  </button>
                </div>

                {/* Discount & Notes */}
                <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
                  <div className="form-group">
                    <label className="form-label">Discount</label>
                    <div className="form-inline" style={{ gap: '8px' }}>
                      <select className="form-select" value={discountType} onChange={(e) => setDiscountType(e.target.value)} style={{ width: '120px' }}>
                        <option value="flat">Flat (₹)</option>
                        <option value="percent">Percent (%)</option>
                      </select>
                      <input className="form-input" type="number" min="0" step="any" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes or remarks" style={{ minHeight: '60px' }} />
                  </div>
                </div>

                {/* Payment & Summary */}
                <div className="grid-2" style={{ gap: '20px' }}>
                  <div className="card" style={{ padding: '16px' }}>
                    <h4 style={{ marginBottom: '12px' }}>Payment Collected</h4>
                    <div className="form-group">
                      <label className="form-label">Cash Amount (₹)</label>
                      <input className="form-input" type="number" min="0" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">UPI Amount (₹)</label>
                      <input className="form-input" type="number" min="0" value={upiAmount} onChange={(e) => setUpiAmount(e.target.value)} />
                    </div>
                  </div>

                  <div className="card" style={{ padding: '16px' }}>
                    <h4 style={{ marginBottom: '12px' }}>Summary Statement</h4>
                    <div style={{ display: 'grid', gap: '6px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-muted">Subtotal</span>
                        <span>₹{subtotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-muted">Discount</span>
                        <span>₹{discountAmount.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '1px solid var(--border)', pt: '4px' }}>
                        <span>Total Bill Amount</span>
                        <span>₹{total.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-muted">Applied Advance</span>
                        <span style={{ color: 'var(--info)' }}>₹{appliedAdvance.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-muted">Cash + UPI Paid</span>
                        <span>₹{amountPaid.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border)', pt: '4px', fontSize: '0.9rem' }}>
                        <span>Remaining Balance</span>
                        <span style={{ color: netBalance > 0 ? 'var(--error)' : 'var(--success)' }}>₹{netBalance.toFixed(2)}</span>
                      </div>
                    </div>

                    {excessPaid > 0 && (
                      <p style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        marginTop: '12px',
                        background: 'var(--success-bg)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--success)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        margin: '10px 0 0'
                      }}>
                        ₹{excessPaid.toFixed(2)} paying now as advance amount
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeEditModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerBills
