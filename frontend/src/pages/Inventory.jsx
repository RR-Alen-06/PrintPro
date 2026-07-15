import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import EmptyState from '../components/common/EmptyState'
import { Plus, Pencil, Trash2, Check, X, AlertCircle, Inbox } from 'lucide-react'

const EMPTY_FORM = { name: '', type: 'print', colorSingle: '', colorDouble: '', bwSingle: '', bwDouble: '', sellingPrice: '', stock: '', lowStockAlert: '' }

const priceFields = [
  { key: 'colorSingle', label: 'Color Single (₹)' },
  { key: 'colorDouble', label: 'Color Double (₹)' },
  { key: 'bwSingle', label: 'B/W Single (₹)' },
  { key: 'bwDouble', label: 'B/W Double (₹)' },
]

const Inventory = () => {
  const { inventory, addInventoryItem, updateInventoryItem, removeInventoryItem } = useAppContext()

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addErrors, setAddErrors] = useState({})
  const [addSuccess, setAddSuccess] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editErrors, setEditErrors] = useState({})

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deletedIds, setDeletedIds] = useState(new Set())

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (form) => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required.'
    
    if (form.type === 'product') {
      const sp = form.sellingPrice
      if (sp === '' || sp === undefined) { errs.sellingPrice = 'Required.' }
      else if (isNaN(Number(sp)) || Number(sp) < 0) { errs.sellingPrice = 'Enter a valid price.' }

      const st = form.stock
      if (st === '' || st === undefined) { errs.stock = 'Required.' }
      else if (isNaN(Number(st)) || Number(st) < 0) { errs.stock = 'Enter a valid stock qty.' }
    } else {
      priceFields.forEach(({ key }) => {
        const val = form[key]
        if (val === '' || val === undefined) { errs[key] = 'Required.' }
        else if (isNaN(Number(val)) || Number(val) < 0) { errs[key] = 'Enter a valid price.' }
      })
    }
    return errs
  }

  // ── Add item ───────────────────────────────────────────────────────────────
  const handleAddChange = (field, value) => {
    setAddForm((f) => ({ ...f, [field]: value }))
    if (addErrors[field]) setAddErrors((e) => { const n = { ...e }; delete n[field]; return n })
  }

  const handleAddSubmit = (e) => {
    e.preventDefault()
    const errs = validateForm(addForm)
    if (Object.keys(errs).length > 0) { setAddErrors(errs); return }

    addInventoryItem({
      name: addForm.name.trim(),
      type: addForm.type || 'print',
      colorSingle: addForm.type === 'product' ? 0 : Number(addForm.colorSingle),
      colorDouble: addForm.type === 'product' ? 0 : Number(addForm.colorDouble),
      bwSingle: addForm.type === 'product' ? 0 : Number(addForm.bwSingle),
      bwDouble: addForm.type === 'product' ? 0 : Number(addForm.bwDouble),
      sellingPrice: addForm.type === 'product' ? Number(addForm.sellingPrice) : 0,
      stock: addForm.type === 'product' ? Number(addForm.stock) : 0,
      lowStockAlert: Number(addForm.lowStockAlert || 5)
    })

    setAddForm(EMPTY_FORM)
    setAddErrors({})
    setAddSuccess(true)
    setTimeout(() => { setAddSuccess(false); setShowAddForm(false) }, 1600)
  }

  // ── Inline edit ────────────────────────────────────────────────────────────
  const startEdit = (item) => {
    setEditingId(item.id)
    setEditForm({
      name: item.name,
      type: item.type || 'print',
      colorSingle: item.colorSingle || 0,
      colorDouble: item.colorDouble || 0,
      bwSingle: item.bwSingle || 0,
      bwDouble: item.bwDouble || 0,
      sellingPrice: item.sellingPrice || 0,
      stock: item.stock || 0,
      lowStockAlert: item.lowStockAlert || 5
    })
    setEditErrors({})
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditErrors({})
  }

  const handleEditChange = (field, value) => {
    setEditForm((f) => ({ ...f, [field]: value }))
    if (editErrors[field]) setEditErrors((e) => { const n = { ...e }; delete n[field]; return n })
  }

  const saveEdit = (id) => {
    const errs = validateForm(editForm)
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return }

    updateInventoryItem(id, {
      name: editForm.name.trim(),
      type: editForm.type || 'print',
      colorSingle: editForm.type === 'product' ? 0 : Number(editForm.colorSingle),
      colorDouble: editForm.type === 'product' ? 0 : Number(editForm.colorDouble),
      bwSingle: editForm.type === 'product' ? 0 : Number(editForm.bwSingle),
      bwDouble: editForm.type === 'product' ? 0 : Number(editForm.bwDouble),
      sellingPrice: editForm.type === 'product' ? Number(editForm.sellingPrice) : 0,
      stock: editForm.type === 'product' ? Number(editForm.stock) : 0,
      lowStockAlert: Number(editForm.lowStockAlert || 5)
    })
    setEditingId(null)
  }

  // ── Delete (soft — mark in local set, keeps state compat) ─────────────────
  const confirmDelete = (id) => setDeleteConfirmId(id)
  const cancelDelete = () => setDeleteConfirmId(null)
  const executeDelete = (id) => {
    removeInventoryItem(id)
    setDeletedIds((prev) => new Set([...prev, id]))
    setDeleteConfirmId(null)
    if (editingId === id) setEditingId(null)
  }

  const visibleInventory = inventory.filter((item) => !deletedIds.has(item.id))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inventory &amp; Pricing</h1>
          <p>Manage paper types and standard physical items (like books/pens) with pricing and stock levels.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowAddForm((v) => !v); setAddErrors({}); setAddSuccess(false) }}>
          <Plus size={16} /> {showAddForm ? 'Cancel' : 'Add Item'}
        </button>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>New Pricing / Inventory Item</h3>
          {addSuccess && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '14px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
            }}>
              <Check size={16} /> Item added successfully!
            </div>
          )}
          <form onSubmit={handleAddSubmit} autoComplete="off">
            <div className="form-row" style={{ flexWrap: 'wrap', gap: '16px' }}>
              {/* Type */}
              <div className="form-group" style={{ flex: '1 1 150px' }}>
                <label className="form-label">Item Type</label>
                <select
                  className="form-select"
                  value={addForm.type}
                  onChange={(e) => handleAddChange('type', e.target.value)}
                >
                  <option value="print">Print Paper Size</option>
                  <option value="product">Standard Product (Pen, Book, etc.)</option>
                </select>
              </div>

              {/* Name */}
              <div className="form-group" style={{ flex: '2 1 200px' }}>
                <label className="form-label">Item Name <span style={{ color: 'var(--error)' }}>*</span></label>
                <input
                  className={`form-input${addErrors.name ? ' form-input-error' : ''}`}
                  type="text"
                  placeholder="e.g. A4 Paper, Blue Ballpoint Pen"
                  value={addForm.name}
                  onChange={(e) => handleAddChange('name', e.target.value)}
                />
                {addErrors.name && <div className="form-error"><AlertCircle size={12} style={{ display: 'inline', marginRight: 3 }} />{addErrors.name}</div>}
              </div>
            </div>

            <div className="form-row" style={{ flexWrap: 'wrap', gap: '16px', marginTop: '12px' }}>
              {/* Product specific fields */}
              {addForm.type === 'product' ? (
                <>
                  <div className="form-group" style={{ flex: '1 1 120px' }}>
                    <label className="form-label">Selling Price (₹)</label>
                    <input
                      className={`form-input${addErrors.sellingPrice ? ' form-input-error' : ''}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={addForm.sellingPrice}
                      onChange={(e) => handleAddChange('sellingPrice', e.target.value)}
                    />
                    {addErrors.sellingPrice && <div className="form-error">{addErrors.sellingPrice}</div>}
                  </div>
                  <div className="form-group" style={{ flex: '1 1 120px' }}>
                    <label className="form-label">Stock Qty</label>
                    <input
                      className={`form-input${addErrors.stock ? ' form-input-error' : ''}`}
                      type="number"
                      min="0"
                      placeholder="0"
                      value={addForm.stock}
                      onChange={(e) => handleAddChange('stock', e.target.value)}
                    />
                    {addErrors.stock && <div className="form-error">{addErrors.stock}</div>}
                  </div>
                  <div className="form-group" style={{ flex: '1 1 120px' }}>
                    <label className="form-label">Low Stock Warning At</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      placeholder="5"
                      value={addForm.lowStockAlert}
                      onChange={(e) => handleAddChange('lowStockAlert', e.target.value)}
                    />
                  </div>
                </>
              ) : (
                /* Print specific fields */
                priceFields.map(({ key, label }) => (
                  <div className="form-group" key={key} style={{ flex: '1 1 120px' }}>
                    <label className="form-label">{label}</label>
                    <input
                      className={`form-input${addErrors[key] ? ' form-input-error' : ''}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={addForm[key]}
                      onChange={(e) => handleAddChange(key, e.target.value)}
                    />
                    {addErrors[key] && <div className="form-error">{addErrors[key]}</div>}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Add Item
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pricing Table */}
      <div className="card">
        <div className="bill-view-header" style={{ marginBottom: '16px' }}>
          <div>
            <h2>Price Management</h2>
            <p className="text-muted" style={{ marginTop: '2px' }}>Set per-page prices for each paper type and print configuration.</p>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Color Single (₹)</th>
                <th>Color Double (₹)</th>
                <th>B/W Single (₹)</th>
                <th>B/W Double (₹)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleInventory.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '0' }}>
                    <EmptyState
                      Icon={Inbox}
                      title="No items in inventory"
                      description="You haven't configured any paper or pricing configurations yet."
                      actionText="Create Pricing Profile"
                      onAction={() => {
                        setShowAddForm(true)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    />
                  </td>
                </tr>
              )}
              {visibleInventory.map((item) => {
                const isEditing = editingId === item.id
                const isDeleteConfirm = deleteConfirmId === item.id
 
                if (isEditing) {
                  const isProd = editForm.type === 'product'
                  return (
                    <tr key={item.id} style={{ background: 'var(--accent-light)' }}>
                      <td>
                        <input
                          className={`form-input form-input${editErrors.name ? '-error' : ''}`}
                          type="text"
                          value={editForm.name}
                          onChange={(e) => handleEditChange('name', e.target.value)}
                          style={{ minWidth: '140px' }}
                        />
                        {editErrors.name && <div className="form-error">{editErrors.name}</div>}
                      </td>
                      <td>{isProd ? '—' : <input className="form-input" style={{ width: '80px' }} type="number" min="0" step="0.01" value={editForm.colorSingle} onChange={(e) => handleEditChange('colorSingle', e.target.value)} />}</td>
                      <td>{isProd ? '—' : <input className="form-input" style={{ width: '80px' }} type="number" min="0" step="0.01" value={editForm.colorDouble} onChange={(e) => handleEditChange('colorDouble', e.target.value)} />}</td>
                      <td>
                        {isProd ? (
                          <>
                            <input
                              className={`form-input${editErrors.sellingPrice ? ' form-input-error' : ''}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editForm.sellingPrice}
                              onChange={(e) => handleEditChange('sellingPrice', e.target.value)}
                              style={{ width: '90px' }}
                            />
                            {editErrors.sellingPrice && <div className="form-error">{editErrors.sellingPrice}</div>}
                          </>
                        ) : (
                          <>
                            <input
                              className={`form-input${editErrors.bwSingle ? ' form-input-error' : ''}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editForm.bwSingle}
                              onChange={(e) => handleEditChange('bwSingle', e.target.value)}
                              style={{ width: '90px' }}
                            />
                            {editErrors.bwSingle && <div className="form-error">{editErrors.bwSingle}</div>}
                          </>
                        )}
                      </td>
                      <td>
                        {isProd ? (
                          <>
                            <input
                              className={`form-input${editErrors.stock ? ' form-input-error' : ''}`}
                              type="number"
                              min="0"
                              value={editForm.stock}
                              onChange={(e) => handleEditChange('stock', e.target.value)}
                              style={{ width: '90px' }}
                            />
                            {editErrors.stock && <div className="form-error">{editErrors.stock}</div>}
                          </>
                        ) : (
                          <>
                            <input
                              className={`form-input${editErrors.bwDouble ? ' form-input-error' : ''}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editForm.bwDouble}
                              onChange={(e) => handleEditChange('bwDouble', e.target.value)}
                              style={{ width: '90px' }}
                            />
                            {editErrors.bwDouble && <div className="form-error">{editErrors.bwDouble}</div>}
                          </>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button title="Save" onClick={() => saveEdit(item.id)} style={{ color: 'var(--success)' }}>
                            <Check size={15} />
                          </button>
                          <button title="Cancel" onClick={cancelEdit}>
                            <X size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }
 
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.name}
                      {item.type === 'product' && <span className="badge badge-secondary" style={{ marginLeft: '8px', fontSize: '0.7rem' }}>Product</span>}
                      {item.type === 'product' && Number(item.stock || 0) <= Number(item.lowStockAlert || 5) && (
                        <span className="badge badge-danger" style={{ marginLeft: '6px', fontSize: '0.7rem', background: 'var(--error-bg)', color: 'var(--error)' }}>Low Stock</span>
                      )}
                    </td>
                    <td>{item.type === 'product' ? '—' : `₹${Number(item.colorSingle).toFixed(2)}`}</td>
                    <td>{item.type === 'product' ? '—' : `₹${Number(item.colorDouble).toFixed(2)}`}</td>
                    <td style={{ fontWeight: item.type === 'product' ? 700 : 400, color: item.type === 'product' ? 'var(--success)' : 'inherit' }}>
                      {item.type === 'product' ? `₹${Number(item.sellingPrice || 0).toFixed(2)}` : `₹${Number(item.bwSingle).toFixed(2)}`}
                    </td>
                    <td style={{ fontWeight: item.type === 'product' ? 700 : 400, color: item.type === 'product' ? (Number(item.stock || 0) <= Number(item.lowStockAlert || 5) ? 'var(--error)' : 'var(--text-muted)') : 'inherit' }}>
                      {item.type === 'product' ? `${item.stock || 0} left` : `₹${Number(item.bwDouble).toFixed(2)}`}
                    </td>
                    <td>
                      {isDeleteConfirm ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--error)' }}>Delete?</span>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => executeDelete(item.id)}
                          >
                            Yes
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={cancelDelete}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="table-actions">
                          <button title="Edit prices" onClick={() => startEdit(item)}>
                            <Pencil size={15} />
                          </button>
                          <button title="Delete item" className="danger" onClick={() => confirmDelete(item.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Inventory
