import React, { useState, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import EmptyState from '../components/common/EmptyState'
import { Plus, Pencil, Trash2, Check, X, AlertCircle, Inbox, Layers, Scissors, Package, Search, AlertTriangle } from 'lucide-react'

const EMPTY_PAPER_FORM = {
  item_type: 'paper',
  name: '',
  colorSingle: '',
  colorDouble: '',
  bwSingle: '',
  bwDouble: '',
  stock: '',
  low_stock_alert: '50'
}

const EMPTY_SERVICE_FORM = {
  item_type: 'service',
  name: '',
  unit_price: '',
  unit: 'job',
  notes: ''
}

const EMPTY_PRODUCT_FORM = {
  item_type: 'product',
  name: '',
  unit_price: '',
  unit: 'pcs',
  stock: '0',
  low_stock_alert: '10'
}

const paperPriceFields = [
  { key: 'colorSingle', label: 'Color Single (₹)' },
  { key: 'colorDouble', label: 'Color Double (₹)' },
  { key: 'bwSingle', label: 'B/W Single (₹)' },
  { key: 'bwDouble', label: 'B/W Double (₹)' },
]

const SERVICE_UNIT_PRESETS = ['job', 'book', 'sheet', 'page', 'hr', 'copy', 'sq.ft']
const PRODUCT_UNIT_PRESETS = ['pcs', 'box', 'pkt', 'ream', 'roll', 'set']

const Inventory = () => {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useAppContext()

  // Tab & Filter state
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'paper' | 'service' | 'product'
  const [searchQuery, setSearchQuery] = useState('')

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [itemType, setItemType] = useState('paper') // 'paper' | 'service' | 'product'
  const [addForm, setAddForm] = useState(EMPTY_PAPER_FORM)
  const [addErrors, setAddErrors] = useState({})
  const [addSuccess, setAddSuccess] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editErrors, setEditErrors] = useState({})

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // ── Stats calculation ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = inventory.length
    const paperCount = inventory.filter((i) => !i.item_type || i.item_type === 'paper').length
    const serviceCount = inventory.filter((i) => i.item_type === 'service').length
    const productCount = inventory.filter((i) => i.item_type === 'product' || i.item_type === 'stationery').length
    const lowStockCount = inventory.filter((i) => {
      const stock = Number(i.stock || 0)
      const alert = Number(i.lowStockAlert || i.low_stock_alert || 0)
      return (i.item_type === 'product' || i.item_type === 'stationery') && alert > 0 && stock <= alert
    }).length
    return { total, paperCount, serviceCount, productCount, lowStockCount }
  }, [inventory])

  // ── Filtered items ─────────────────────────────────────────────────────────
  const visibleInventory = useMemo(() => {
    return inventory.filter((item) => {
      const type = item.item_type || 'paper'
      const matchesTab =
        activeTab === 'all'
          ? true
          : activeTab === 'paper'
          ? type === 'paper'
          : activeTab === 'service'
          ? type === 'service'
          : type === 'product' || type === 'stationery'

      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())

      return matchesTab && matchesSearch
    })
  }, [inventory, activeTab, searchQuery])

  // ── Type switch in add form ────────────────────────────────────────────────
  const handleTypeChange = (newType) => {
    setItemType(newType)
    setAddErrors({})
    if (newType === 'paper') setAddForm(EMPTY_PAPER_FORM)
    else if (newType === 'service') setAddForm(EMPTY_SERVICE_FORM)
    else setAddForm(EMPTY_PRODUCT_FORM)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (form, type) => {
    const errs = {}
    if (!form.name || !form.name.trim()) errs.name = 'Name is required.'

    if (type === 'paper') {
      paperPriceFields.forEach(({ key }) => {
        const val = form[key]
        if (val === '' || val === undefined) {
          errs[key] = 'Required.'
        } else if (isNaN(Number(val)) || Number(val) < 0) {
          errs[key] = 'Enter valid price.'
        }
      })
    } else {
      // Service or Product
      const price = form.unit_price !== undefined ? form.unit_price : form.unitPrice
      if (price === '' || price === undefined) {
        errs.unit_price = 'Price is required.'
      } else if (isNaN(Number(price)) || Number(price) < 0) {
        errs.unit_price = 'Enter a valid price.'
      }
      if (!form.unit || !form.unit.trim()) {
        errs.unit = 'Unit is required.'
      }
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
    const errs = validateForm(addForm, itemType)
    if (Object.keys(errs).length > 0) {
      setAddErrors(errs)
      return
    }

    if (itemType === 'paper') {
      addInventoryItem({
        name: addForm.name.trim(),
        item_type: 'paper',
        unit_price: 0,
        unit: 'sheet',
        colorSingle: Number(addForm.colorSingle),
        colorDouble: Number(addForm.colorDouble),
        bwSingle: Number(addForm.bwSingle),
        bwDouble: Number(addForm.bwDouble),
        stock: Number(addForm.stock || 0),
        lowStockAlert: Number(addForm.low_stock_alert || 50),
      })
    } else if (itemType === 'service') {
      addInventoryItem({
        name: addForm.name.trim(),
        item_type: 'service',
        unit_price: Number(addForm.unit_price),
        unit: (addForm.unit || 'job').trim().toLowerCase(),
        colorSingle: 0,
        colorDouble: 0,
        bwSingle: 0,
        bwDouble: 0,
        stock: 0,
        lowStockAlert: 0,
      })
    } else {
      // Product / Stationery
      addInventoryItem({
        name: addForm.name.trim(),
        item_type: 'product',
        unit_price: Number(addForm.unit_price),
        unit: (addForm.unit || 'pcs').trim().toLowerCase(),
        colorSingle: 0,
        colorDouble: 0,
        bwSingle: 0,
        bwDouble: 0,
        stock: Number(addForm.stock || 0),
        lowStockAlert: Number(addForm.low_stock_alert || 10),
      })
    }

    if (itemType === 'paper') setAddForm(EMPTY_PAPER_FORM)
    else if (itemType === 'service') setAddForm(EMPTY_SERVICE_FORM)
    else setAddForm(EMPTY_PRODUCT_FORM)

    setAddErrors({})
    setAddSuccess(true)
    setTimeout(() => {
      setAddSuccess(false)
      setShowAddForm(false)
    }, 1200)
  }

  // ── Inline edit ────────────────────────────────────────────────────────────
  const startEdit = (item) => {
    const type = item.item_type || 'paper'
    setEditingId(item.id)
    setEditForm({
      id: item.id,
      name: item.name,
      item_type: type,
      unit_price: item.unit_price !== undefined ? item.unit_price : (item.unitPrice || 0),
      unit: item.unit || (type === 'paper' ? 'sheet' : type === 'service' ? 'job' : 'pcs'),
      colorSingle: item.colorSingle || 0,
      colorDouble: item.colorDouble || 0,
      bwSingle: item.bwSingle || 0,
      bwDouble: item.bwDouble || 0,
      stock: item.stock || 0,
      lowStockAlert: item.lowStockAlert || item.low_stock_alert || 50,
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
    const type = editForm.item_type || 'paper'
    const errs = validateForm(editForm, type)
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs)
      return
    }

    if (type === 'paper') {
      updateInventoryItem(id, {
        name: editForm.name.trim(),
        item_type: 'paper',
        colorSingle: Number(editForm.colorSingle),
        colorDouble: Number(editForm.colorDouble),
        bwSingle: Number(editForm.bwSingle),
        bwDouble: Number(editForm.bwDouble),
        stock: Number(editForm.stock || 0),
        lowStockAlert: Number(editForm.lowStockAlert || 50),
      })
    } else {
      updateInventoryItem(id, {
        name: editForm.name.trim(),
        item_type: type,
        unit_price: Number(editForm.unit_price),
        unit: (editForm.unit || '').trim().toLowerCase(),
        stock: Number(editForm.stock || 0),
        lowStockAlert: Number(editForm.lowStockAlert || 0),
      })
    }
    setEditingId(null)
  }

  // ── Delete Execution ───────────────────────────────────────────────────────
  const confirmDelete = (id) => setDeleteConfirmId(id)
  const cancelDelete = () => setDeleteConfirmId(null)
  const executeDelete = (id) => {
    if (deleteInventoryItem) {
      deleteInventoryItem(id)
    }
    setDeleteConfirmId(null)
    if (editingId === id) setEditingId(null)
  }

  const getTypeBadge = (type) => {
    if (type === 'service') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem', fontWeight: 600,
          background: 'rgba(124, 58, 237, 0.12)', color: 'var(--violet)',
          border: '1px solid rgba(124, 58, 237, 0.25)'
        }}>
          <Scissors size={12} /> Service
        </span>
      )
    }
    if (type === 'product' || type === 'stationery') {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem', fontWeight: 600,
          background: 'rgba(2, 132, 199, 0.12)', color: 'var(--cyan)',
          border: '1px solid rgba(2, 132, 199, 0.25)'
        }}>
          <Package size={12} /> Stationery
        </span>
      )
    }
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px', borderRadius: 'var(--radius-full)',
        fontSize: '0.75rem', fontWeight: 600,
        background: 'var(--accent-light)', color: 'var(--accent)',
        border: '1px solid var(--border-accent)'
      }}>
        <Layers size={12} /> Print &amp; Paper
      </span>
    )
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Inventory &amp; Pricing Catalog</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Configure paper print rates, binding/lamination services, and stationery retail items.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowAddForm((v) => !v)
            setAddErrors({})
            setAddSuccess(false)
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} /> {showAddForm ? 'Close Form' : 'Add Catalog Item'}
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--accent-light)', color: 'var(--accent)' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Paper Profiles</div>
            <div className="font-mono tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{stats.paperCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'rgba(124, 58, 237, 0.12)', color: 'var(--violet)' }}>
            <Scissors size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Services &amp; Jobs</div>
            <div className="font-mono tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{stats.serviceCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'rgba(2, 132, 199, 0.12)', color: 'var(--cyan)' }}>
            <Package size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Stationery Items</div>
            <div className="font-mono tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{stats.productCount}</div>
          </div>
        </div>

        {stats.lowStockCount > 0 && (
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid var(--warning)' }}>
            <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--warning-text)', fontWeight: 600, textTransform: 'uppercase' }}>Low Stock Alert</div>
              <div className="font-mono tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--warning-text)' }}>{stats.lowStockCount}</div>
            </div>
          </div>
        )}
      </div>

      {/* Add Item Form Card */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--border-accent)', background: 'var(--bg-canvas)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Create New Item</h3>
            {/* Item Type Switcher */}
            <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
              <button
                type="button"
                className={`btn btn-sm ${itemType === 'paper' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleTypeChange('paper')}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
              >
                <Layers size={13} style={{ marginRight: 4 }} /> Paper &amp; Print
              </button>
              <button
                type="button"
                className={`btn btn-sm ${itemType === 'service' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleTypeChange('service')}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
              >
                <Scissors size={13} style={{ marginRight: 4 }} /> Service / Binding
              </button>
              <button
                type="button"
                className={`btn btn-sm ${itemType === 'product' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleTypeChange('product')}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
              >
                <Package size={13} style={{ marginRight: 4 }} /> Stationery / Goods
              </button>
            </div>
          </div>

          {addSuccess && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '16px',
              background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
            }}>
              <Check size={16} /> Item added to catalog successfully!
            </div>
          )}

          <form onSubmit={handleAddSubmit}>
            {/* Paper & Print Form */}
            {itemType === 'paper' && (
              <div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Paper Type / Name <span style={{ color: 'var(--error)' }}>*</span></label>
                    <input
                      className={`form-input${addErrors.name ? ' form-input-error' : ''}`}
                      type="text"
                      placeholder="e.g. A4 75 GSM, Legal Paper, Glossy Photo Paper"
                      value={addForm.name}
                      onChange={(e) => handleAddChange('name', e.target.value)}
                    />
                    {addErrors.name && <div className="form-error"><AlertCircle size={12} style={{ display: 'inline', marginRight: 3 }} />{addErrors.name}</div>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  {paperPriceFields.map(({ key, label }) => (
                    <div className="form-group" key={key}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>{label}</label>
                      <input
                        className={`form-input font-mono${addErrors[key] ? ' form-input-error' : ''}`}
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
              </div>
            )}

            {/* Service & Binding Form */}
            {itemType === 'service' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Service Name <span style={{ color: 'var(--error)' }}>*</span></label>
                    <input
                      className={`form-input${addErrors.name ? ' form-input-error' : ''}`}
                      type="text"
                      placeholder="e.g. Spiral Binding, Lamination A4, Document Scanning, Hard Book Binding"
                      value={addForm.name}
                      onChange={(e) => handleAddChange('name', e.target.value)}
                    />
                    {addErrors.name && <div className="form-error"><AlertCircle size={12} style={{ display: 'inline', marginRight: 3 }} />{addErrors.name}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Service Rate (₹) <span style={{ color: 'var(--error)' }}>*</span></label>
                    <input
                      className={`form-input font-mono${addErrors.unit_price ? ' form-input-error' : ''}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 30.00"
                      value={addForm.unit_price}
                      onChange={(e) => handleAddChange('unit_price', e.target.value)}
                    />
                    {addErrors.unit_price && <div className="form-error">{addErrors.unit_price}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Charging Unit <span style={{ color: 'var(--error)' }}>*</span></label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        className={`form-input${addErrors.unit ? ' form-input-error' : ''}`}
                        type="text"
                        placeholder="e.g. book, sheet, job, page"
                        value={addForm.unit}
                        onChange={(e) => handleAddChange('unit', e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {SERVICE_UNIT_PRESETS.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => handleAddChange('unit', u)}
                          style={{
                            fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-xs)',
                            background: addForm.unit === u ? 'var(--accent-light)' : 'var(--bg-elevated)',
                            color: addForm.unit === u ? 'var(--accent)' : 'var(--text-secondary)',
                            border: '1px solid var(--border)', cursor: 'pointer'
                          }}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stationery & Product Form */}
            {itemType === 'product' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Item / Product Name <span style={{ color: 'var(--error)' }}>*</span></label>
                    <input
                      className={`form-input${addErrors.name ? ' form-input-error' : ''}`}
                      type="text"
                      placeholder="e.g. Gel Pen Blue, A4 Document Folder, Brown Envelope 10x12"
                      value={addForm.name}
                      onChange={(e) => handleAddChange('name', e.target.value)}
                    />
                    {addErrors.name && <div className="form-error"><AlertCircle size={12} style={{ display: 'inline', marginRight: 3 }} />{addErrors.name}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Price Per Unit (₹) <span style={{ color: 'var(--error)' }}>*</span></label>
                    <input
                      className={`form-input font-mono${addErrors.unit_price ? ' form-input-error' : ''}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 15.00"
                      value={addForm.unit_price}
                      onChange={(e) => handleAddChange('unit_price', e.target.value)}
                    />
                    {addErrors.unit_price && <div className="form-error">{addErrors.unit_price}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Stock Unit</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. pcs, box, pkt"
                      value={addForm.unit}
                      onChange={(e) => handleAddChange('unit', e.target.value)}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {PRODUCT_UNIT_PRESETS.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => handleAddChange('unit', u)}
                          style={{
                            fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-xs)',
                            background: addForm.unit === u ? 'var(--accent-light)' : 'var(--bg-elevated)',
                            color: addForm.unit === u ? 'var(--accent)' : 'var(--text-secondary)',
                            border: '1px solid var(--border)', cursor: 'pointer'
                          }}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Stock Qty</label>
                    <input
                      className="form-input font-mono"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={addForm.stock}
                      onChange={(e) => handleAddChange('stock', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Low Stock Alert Level</label>
                    <input
                      className="form-input font-mono"
                      type="number"
                      min="0"
                      placeholder="10"
                      value={addForm.low_stock_alert}
                      onChange={(e) => handleAddChange('low_stock_alert', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Save Item
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Catalog Table Container */}
      <div className="card">
        {/* Table Filter Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
            {[
              { id: 'all', label: 'All Catalog', count: stats.total },
              { id: 'paper', label: 'Paper & Print', count: stats.paperCount },
              { id: 'service', label: 'Services & Finishing', count: stats.serviceCount },
              { id: 'product', label: 'Stationery & Goods', count: stats.productCount },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600,
                  borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: activeTab === tab.id ? 'var(--shadow-xs)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
                <span style={{
                  fontSize: '0.72rem', padding: '1px 6px', borderRadius: 'var(--radius-full)',
                  background: activeTab === tab.id ? 'var(--accent-light)' : 'rgba(0,0,0,0.06)',
                  color: activeTab === tab.id ? 'var(--accent)' : 'inherit'
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 220px', maxWidth: '320px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              type="text"
              placeholder="Search catalog items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', height: '36px', fontSize: '0.85rem' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Table Component */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Item Details</th>
                <th>Category</th>
                <th>Pricing &amp; Rates</th>
                <th>Unit / Qty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleInventory.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '0' }}>
                    <EmptyState
                      Icon={Inbox}
                      title="No items found"
                      description={
                        searchQuery
                          ? `No catalog items matched "${searchQuery}".`
                          : "You haven't configured any items in this category yet."
                      }
                      actionText="Create New Item"
                      onAction={() => {
                        setShowAddForm(true)
                        if (activeTab !== 'all') handleTypeChange(activeTab)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    />
                  </td>
                </tr>
              )}

              {visibleInventory.map((item) => {
                const isEditing = editingId === item.id
                const isDeleteConfirm = deleteConfirmId === item.id
                const itemType = item.item_type || 'paper'

                if (isEditing) {
                  return (
                    <tr key={item.id} style={{ background: 'var(--accent-light)' }}>
                      <td>
                        <input
                          className={`form-input${editErrors.name ? ' form-input-error' : ''}`}
                          type="text"
                          value={editForm.name}
                          onChange={(e) => handleEditChange('name', e.target.value)}
                          style={{ minWidth: '160px' }}
                        />
                        {editErrors.name && <div className="form-error">{editErrors.name}</div>}
                      </td>
                      <td>{getTypeBadge(editForm.item_type)}</td>
                      <td>
                        {itemType === 'paper' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', minWidth: '220px' }}>
                            {paperPriceFields.map(({ key, label }) => (
                              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '45px' }}>{label.slice(0, 7)}:</span>
                                <input
                                  className="form-input font-mono"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editForm[key]}
                                  onChange={(e) => handleEditChange(key, e.target.value)}
                                  style={{ width: '70px', padding: '4px 6px', height: '28px' }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>₹</span>
                            <input
                              className="form-input font-mono"
                              type="number"
                              min="0"
                              step="0.01"
                              value={editForm.unit_price}
                              onChange={(e) => handleEditChange('unit_price', e.target.value)}
                              style={{ width: '90px' }}
                            />
                            {editErrors.unit_price && <div className="form-error">{editErrors.unit_price}</div>}
                          </div>
                        )}
                      </td>
                      <td>
                        {itemType === 'paper' ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>per page</span>
                        ) : (
                          <input
                            className="form-input"
                            type="text"
                            value={editForm.unit}
                            onChange={(e) => handleEditChange('unit', e.target.value)}
                            style={{ width: '80px' }}
                          />
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button title="Save" onClick={() => saveEdit(item.id)} style={{ color: 'var(--success)' }}>
                            <Check size={16} />
                          </button>
                          <button title="Cancel" onClick={cancelEdit}>
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{item.name}</div>
                      {itemType === 'product' && Number(item.stock || 0) <= Number(item.lowStockAlert || item.low_stock_alert || 0) && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--warning-text)', fontWeight: 600 }}>Low stock warning</span>
                      )}
                    </td>
                    <td>{getTypeBadge(itemType)}</td>
                    <td>
                      {itemType === 'paper' ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.82rem' }}>
                          <span className="font-mono tabular-nums" style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}>
                            Color S: <strong>₹{Number(item.colorSingle || 0).toFixed(2)}</strong>
                          </span>
                          <span className="font-mono tabular-nums" style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}>
                            Color D: <strong>₹{Number(item.colorDouble || 0).toFixed(2)}</strong>
                          </span>
                          <span className="font-mono tabular-nums" style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}>
                            B/W S: <strong>₹{Number(item.bwSingle || 0).toFixed(2)}</strong>
                          </span>
                          <span className="font-mono tabular-nums" style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}>
                            B/W D: <strong>₹{Number(item.bwDouble || 0).toFixed(2)}</strong>
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="font-mono tabular-nums" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            ₹{Number(item.unit_price || 0).toFixed(2)}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ {item.unit || (itemType === 'service' ? 'job' : 'pcs')}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {itemType === 'paper' ? (
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>per page</span>
                      ) : itemType === 'service' ? (
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>per {item.unit || 'job'}</span>
                      ) : (
                        <div style={{ fontSize: '0.82rem' }}>
                          <strong className="font-mono tabular-nums">{item.stock || 0}</strong> {item.unit || 'pcs'} in stock
                        </div>
                      )}
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
                          <button title="Edit item" onClick={() => startEdit(item)}>
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
