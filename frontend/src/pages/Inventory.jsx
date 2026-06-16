import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { Plus, Pencil, Trash2, Check, X, AlertCircle } from 'lucide-react'

const EMPTY_FORM = { name: '', colorSingle: '', colorDouble: '', bwSingle: '', bwDouble: '' }

const priceFields = [
  { key: 'colorSingle', label: 'Color Single (₹)' },
  { key: 'colorDouble', label: 'Color Double (₹)' },
  { key: 'bwSingle', label: 'B/W Single (₹)' },
  { key: 'bwDouble', label: 'B/W Double (₹)' },
]

const Inventory = () => {
  const { inventory, addInventoryItem, updateInventoryItem } = useAppContext()

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
    priceFields.forEach(({ key }) => {
      const val = form[key]
      if (val === '' || val === undefined) { errs[key] = 'Required.' }
      else if (isNaN(Number(val)) || Number(val) < 0) { errs[key] = 'Enter a valid price.' }
    })
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
      colorSingle: Number(addForm.colorSingle),
      colorDouble: Number(addForm.colorDouble),
      bwSingle: Number(addForm.bwSingle),
      bwDouble: Number(addForm.bwDouble),
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
      colorSingle: item.colorSingle,
      colorDouble: item.colorDouble,
      bwSingle: item.bwSingle,
      bwDouble: item.bwDouble,
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
      colorSingle: Number(editForm.colorSingle),
      colorDouble: Number(editForm.colorDouble),
      bwSingle: Number(editForm.bwSingle),
      bwDouble: Number(editForm.bwDouble),
    })
    setEditingId(null)
  }

  // ── Delete (soft — mark in local set, keeps state compat) ─────────────────
  const confirmDelete = (id) => setDeleteConfirmId(id)
  const cancelDelete = () => setDeleteConfirmId(null)
  const executeDelete = (id) => {
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
          <p>Manage paper types and their per-page print prices. Stock tracking is not relevant here.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowAddForm((v) => !v); setAddErrors({}); setAddSuccess(false) }}>
          <Plus size={16} /> {showAddForm ? 'Cancel' : 'Add Item'}
        </button>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>New Pricing Item</h3>
          {addSuccess && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '14px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
            }}>
              <Check size={16} /> Item added successfully!
            </div>
          )}
          <form onSubmit={handleAddSubmit}>
            <div className="form-row" style={{ flexWrap: 'wrap', gap: '16px' }}>
              {/* Name */}
              <div className="form-group" style={{ flex: '2 1 200px' }}>
                <label className="form-label">Paper / Item Name <span style={{ color: 'var(--error)' }}>*</span></label>
                <input
                  className={`form-input${addErrors.name ? ' form-input-error' : ''}`}
                  type="text"
                  placeholder="e.g. A4 Paper, Legal Paper"
                  value={addForm.name}
                  onChange={(e) => handleAddChange('name', e.target.value)}
                />
                {addErrors.name && <div className="form-error"><AlertCircle size={12} style={{ display: 'inline', marginRight: 3 }} />{addErrors.name}</div>}
              </div>

              {/* Price fields */}
              {priceFields.map(({ key, label }) => (
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
              ))}
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
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No items yet. Click "Add Item" to create one.
                  </td>
                </tr>
              )}
              {visibleInventory.map((item) => {
                const isEditing = editingId === item.id
                const isDeleteConfirm = deleteConfirmId === item.id

                if (isEditing) {
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
                      {priceFields.map(({ key }) => (
                        <td key={key}>
                          <input
                            className={`form-input${editErrors[key] ? ' form-input-error' : ''}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm[key]}
                            onChange={(e) => handleEditChange(key, e.target.value)}
                            style={{ width: '90px' }}
                          />
                          {editErrors[key] && <div className="form-error">{editErrors[key]}</div>}
                        </td>
                      ))}
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
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</td>
                    <td>₹{Number(item.colorSingle).toFixed(2)}</td>
                    <td>₹{Number(item.colorDouble).toFixed(2)}</td>
                    <td>₹{Number(item.bwSingle).toFixed(2)}</td>
                    <td>₹{Number(item.bwDouble).toFixed(2)}</td>
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
