import React, { useState, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { useInventory, useInventoryMutations } from '../hooks/useEntitiesQuery'
import { SequenceService } from '../services/sequenceService'
import EmptyState from '../components/common/EmptyState'
import { TableSkeleton } from '../components/common/Skeleton'
import { Plus, Pencil, Trash2, Check, X, AlertCircle, Inbox, Tag } from 'lucide-react'

const EMPTY_FORM = { name: '', type: 'print', colorSingle: '', colorDouble: '', bwSingle: '', bwDouble: '', sellingPrice: '', hsnCode: '' }

const priceFields = [
  { key: 'colorSingle', label: 'Color Single (₹)' },
  { key: 'colorDouble', label: 'Color Double (₹)' },
  { key: 'bwSingle', label: 'B/W Single (₹)' },
  { key: 'bwDouble', label: 'B/W Double (₹)' },
]

const Inventory = () => {
  const { settings } = useAppContext()
  const { data: serverInventory = [], isLoading: isLoadingInventory } = useInventory()
  const { createItem, updateItem, deleteItem } = useInventoryMutations()
  const inventory: any[] = serverInventory

  const previewItemCode = useMemo(() => {
    return SequenceService.peekNextSequence(
      'INVENTORY',
      inventory,
      settings?.itmPrefix || 'ITM',
      settings?.seqPadding || 6
    )
  }, [inventory, settings?.itmPrefix, settings?.seqPadding])

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})
  const [addSuccess, setAddSuccess] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<any>(null)
  const [deletedIds, setDeletedIds] = useState(new Set())

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (form: any) => {
    const errs: Record<string, string> = {}
    if (!form.name || !form.name.trim()) errs.name = 'Name is required.'
    
    if (form.type === 'product') {
      const sp = form.sellingPrice
      if (sp === '' || sp === undefined) { errs.sellingPrice = 'Required.' }
      else if (isNaN(Number(sp)) || Number(sp) < 0) { errs.sellingPrice = 'Enter a valid price.' }
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
  const handleAddChange = (field: string, value: any) => {
    setAddForm((f) => ({ ...f, [field]: value }))
    if (addErrors[field]) setAddErrors((e) => { const n = { ...e }; delete n[field]; return n })
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateForm(addForm)
    if (Object.keys(errs).length > 0) { setAddErrors(errs); return }

    try {
      await (createItem as any)({
        name: addForm.name.trim(),
        type: addForm.type || 'print',
        hsn_code: addForm.hsnCode?.trim() || null,
        selling_price: addForm.type === 'product' ? Number(addForm.sellingPrice || 0) : 0,
        color_single: addForm.type === 'product' ? 0 : Number(addForm.colorSingle || 0),
        color_double: addForm.type === 'product' ? 0 : Number(addForm.colorDouble || 0),
        bw_single: addForm.type === 'product' ? 0 : Number(addForm.bwSingle || 0),
        bw_double: addForm.type === 'product' ? 0 : Number(addForm.bwDouble || 0),
      })

      setAddForm(EMPTY_FORM)
      setAddErrors({})
      setAddSuccess(true)
      setTimeout(() => { setAddSuccess(false); setShowAddForm(false) }, 1200)
    } catch (err: any) {
      setAddErrors({ form: err.message || 'Failed to add item' })
    }
  }

  // ── Inline edit ────────────────────────────────────────────────────────────
  const startEdit = (item: any) => {
    setEditingId(item.id)
    setEditForm({
      name: item.name || '',
      type: item.type || 'print',
      colorSingle: item.colorSingle !== undefined ? item.colorSingle : (item.color_single !== undefined ? item.color_single : 0),
      colorDouble: item.colorDouble !== undefined ? item.colorDouble : (item.color_double !== undefined ? item.color_double : 0),
      bwSingle: item.bwSingle !== undefined ? item.bwSingle : (item.bw_single !== undefined ? item.bw_single : 0),
      bwDouble: item.bwDouble !== undefined ? item.bwDouble : (item.bw_double !== undefined ? item.bw_double : 0),
      sellingPrice: item.sellingPrice !== undefined ? item.sellingPrice : (item.selling_price !== undefined ? item.selling_price : 0),
      hsnCode: item.hsnCode || item.hsn_code || ''
    })
    setEditErrors({})
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditErrors({})
  }

  const handleEditChange = (field: string, value: any) => {
    setEditForm((f: any) => ({ ...f, [field]: value }))
    if (editErrors[field]) setEditErrors((e: any) => { const n = { ...e }; delete n[field]; return n })
  }

  const saveEdit = async (id: any) => {
    const errs = validateForm(editForm)
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return }

    try {
      const sp = editForm.type === 'product' ? Number(editForm.sellingPrice || 0) : 0
      const cs = editForm.type === 'product' ? 0 : Number(editForm.colorSingle || 0)
      const cd = editForm.type === 'product' ? 0 : Number(editForm.colorDouble || 0)
      const bs = editForm.type === 'product' ? 0 : Number(editForm.bwSingle || 0)
      const bd = editForm.type === 'product' ? 0 : Number(editForm.bwDouble || 0)
      const hsn = editForm.hsnCode?.trim() || null

      await (updateItem as any)({
        id,
        data: {
          name: editForm.name.trim(),
          type: editForm.type || 'print',
          hsn_code: hsn,
          hsnCode: hsn || '',
          selling_price: sp,
          sellingPrice: sp,
          color_single: cs,
          colorSingle: cs,
          color_double: cd,
          colorDouble: cd,
          bw_single: bs,
          bwSingle: bs,
          bw_double: bd,
          bwDouble: bd,
        }
      })
      setEditingId(null)
    } catch (err: any) {
      setEditErrors({ form: err.message || 'Failed to update item' })
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = (id: any) => setDeleteConfirmId(id)
  const cancelDelete = () => setDeleteConfirmId(null)
  const executeDelete = async (id: any) => {
    try {
      await deleteItem(id)
      setDeleteConfirmId(null)
      if (editingId === id) setEditingId(null)
    } catch (err) {
      console.error('Delete item failed:', err)
    }
  }

  const visibleInventory = inventory
    .filter((item) => !deletedIds.has(item.id))
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, { numeric: true }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inventory &amp; Pricing</h1>
          <p>Manage print paper configurations and standard products or services with 0ms POS sync.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowAddForm((v) => !v); setAddErrors({}); setAddSuccess(false) }}>
          <Plus size={16} /> {showAddForm ? 'Cancel' : 'Add Item'}
        </button>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>New Pricing / Catalog Item</h3>
            <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '0.78rem', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
              Auto-Assigned Code: {previewItemCode}
            </span>
          </div>
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
                  <option value="product">Standard Product / Service</option>
                </select>
              </div>

              {/* Name */}
              <div className="form-group" style={{ flex: '2 1 200px' }}>
                <label className="form-label">Item Name <span style={{ color: 'var(--error)' }}>*</span></label>
                <input
                  className={`form-input${addErrors.name ? ' form-input-error' : ''}`}
                  type="text"
                  placeholder="e.g. A4 Paper, Lamination, Spiral Binding"
                  value={addForm.name}
                  onChange={(e) => handleAddChange('name', e.target.value)}
                />
                {addErrors.name && <div className="form-error"><AlertCircle size={12} style={{ display: 'inline', marginRight: 3 }} />{addErrors.name}</div>}
              </div>

              {/* HSN Code */}
              <div className="form-group" style={{ flex: '1 1 120px' }}>
                <label className="form-label">HSN Code</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. 4901"
                  value={addForm.hsnCode || ''}
                  onChange={(e) => handleAddChange('hsnCode', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row" style={{ flexWrap: 'wrap', gap: '16px', marginTop: '12px' }}>
              {/* Product specific fields */}
              {addForm.type === 'product' ? (
                <div className="form-group" style={{ flex: '1 1 180px' }}>
                  <label className="form-label">Selling Price (₹) <span style={{ color: 'var(--error)' }}>*</span></label>
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

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
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
            <p className="text-muted" style={{ marginTop: '2px' }}>Set per-page rates for paper types and standard rates for products/services.</p>
          </div>
        </div>

        <div className="table-container">
          {isLoadingInventory && visibleInventory.length === 0 ? (
            <TableSkeleton rows={5} columns={6} />
          ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name &amp; Code</th>
                <th>Type</th>
                <th>Color Single (₹)</th>
                <th>Color Double (₹)</th>
                <th>B/W Single / Selling Price (₹)</th>
                <th>B/W Double (₹)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleInventory.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '0' }}>
                    <EmptyState
                      Icon={Inbox as any}
                      title="No items in inventory"
                      description="You haven't configured any paper or product pricing yet."
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
                          style={{ minWidth: '140px', marginBottom: '4px' }}
                        />
                        {editErrors.name && <div className="form-error">{editErrors.name}</div>}
                        <input
                          className="form-input"
                          type="text"
                          placeholder="HSN Code"
                          value={editForm.hsnCode || ''}
                          onChange={(e) => handleEditChange('hsnCode', e.target.value)}
                          style={{ fontSize: '0.75rem', padding: '2px 6px', width: '100px' }}
                        />
                      </td>
                      <td>
                        <span className={`badge badge-${isProd ? 'secondary' : 'info'}`}>
                          {isProd ? 'Product' : 'Print'}
                        </span>
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
                          '—'
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
 
                const formatPrice = (val: any) => {
                  if (val === null || val === undefined || val === '') return '0.00'
                  const num = Number(val)
                  return isNaN(num) ? '0.00' : num.toFixed(2)
                }

                const colorSinglePrice = formatPrice(item.colorSingle !== undefined ? item.colorSingle : item.color_single)
                const colorDoublePrice = formatPrice(item.colorDouble !== undefined ? item.colorDouble : item.color_double)
                const bwSinglePrice = formatPrice(item.bwSingle !== undefined ? item.bwSingle : item.bw_single)
                const bwDoublePrice = formatPrice(item.bwDouble !== undefined ? item.bwDouble : item.bw_double)
                const sellingPriceFormatted = formatPrice(item.sellingPrice !== undefined ? item.sellingPrice : item.selling_price)
                const isProduct = item.type === 'product'

                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{item.name}</span>
                        <span className="badge badge-outline" style={{ fontSize: '0.68rem', fontFamily: 'monospace' }}>
                          {item.itemCode || item.item_code || (typeof item.id === 'string' && item.id.length > 8 ? `ITM-${item.id.slice(-6).toUpperCase()}` : `ITM-${String(item.id).padStart(6, '0')}`)}
                        </span>
                      </div>
                      {(item.hsnCode || item.hsn_code) && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 400 }}>
                          HSN: {item.hsnCode || item.hsn_code}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${isProduct ? 'secondary' : 'info'}`} style={{ fontSize: '0.7rem' }}>
                        {isProduct ? 'Product' : 'Print'}
                      </span>
                    </td>
                    <td>{isProduct ? '—' : `₹${colorSinglePrice}`}</td>
                    <td>{isProduct ? '—' : `₹${colorDoublePrice}`}</td>
                    <td style={{ fontWeight: isProduct ? 700 : 400, color: isProduct ? 'var(--success)' : 'inherit' }}>
                      {isProduct ? `₹${sellingPriceFormatted}` : `₹${bwSinglePrice}`}
                    </td>
                    <td>
                      {isProduct ? '—' : `₹${bwDoublePrice}`}
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
          )}
        </div>
      </div>
    </div>
  )
}

export default Inventory

