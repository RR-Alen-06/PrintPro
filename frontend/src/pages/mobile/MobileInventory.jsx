import React, { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useInventory, useInventoryMutations } from '../../hooks/useEntitiesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import VirtualList from '../../components/mobile/VirtualList'
import SkeletonInventoryRow from '../../components/mobile/SkeletonInventoryRow'
import { Inbox, Plus, Pencil, Trash2, Search, Loader2, AlertCircle } from 'lucide-react'
import '../../styles/mobile.css'

const InventoryRow = React.memo(({ item, onEdit, onDelete }) => {
  return (
    <div className="mobile-card" style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            HSN: {item.hsnCode || item.hsn_code || 'N/A'} • Type: PRINT PAPER
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => onEdit(item)}
            style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', cursor: 'pointer', padding: '4px' }}
            title="Edit Item"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => onDelete(item, e)}
            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
            title="Delete Item"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Color 1S: <strong className="currency-num" style={{ color: 'var(--accent-primary)' }}>₹{item.colorSingle ?? item.color_single ?? 0}</strong> | 2S: <strong className="currency-num" style={{ color: 'var(--accent-primary)' }}>₹{item.colorDouble ?? item.color_double ?? 0}</strong>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          B/W 1S: <strong className="currency-num" style={{ color: '#ffffff' }}>₹{item.bwSingle ?? item.bw_single ?? 0}</strong> | 2S: <strong className="currency-num" style={{ color: '#ffffff' }}>₹{item.bwDouble ?? item.bw_double ?? 0}</strong>
        </div>
      </div>
    </div>
  )
})

InventoryRow.displayName = 'InventoryRow'

export default function MobileInventory() {
  const navigate = useNavigate()
  const { showToast } = useAppContext()

  // TanStack Query & Mutations (reusing desktop hooks)
  const { data: serverInventory = [], isLoading: isLoadingInventory, isError, error } = useInventory()
  const { createItem, updateItem, deleteItem, isCreatingItem, isUpdatingItem } = useInventoryMutations()

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | 'print'
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  // Form State - purely print paper rates
  const [formName, setFormName] = useState('')
  const [colorSingle, setColorSingle] = useState('')
  const [colorDouble, setColorDouble] = useState('')
  const [bwSingle, setBwSingle] = useState('')
  const [bwDouble, setBwDouble] = useState('')
  const [hsnCode, setHsnCode] = useState('')

  const openAddModal = useCallback(() => {
    setEditingItem(null)
    setFormName('')
    setColorSingle('10')
    setColorDouble('18')
    setBwSingle('3')
    setBwDouble('5')
    setHsnCode('')
    setShowAddModal(true)
  }, [])

  const openEditModal = useCallback((item) => {
    setEditingItem(item)
    setFormName(item.name || '')
    setColorSingle(item.colorSingle !== undefined ? String(item.colorSingle) : (item.color_single !== undefined ? String(item.color_single) : ''))
    setColorDouble(item.colorDouble !== undefined ? String(item.colorDouble) : (item.color_double !== undefined ? String(item.color_double) : ''))
    setBwSingle(item.bwSingle !== undefined ? String(item.bwSingle) : (item.bw_single !== undefined ? String(item.bw_single) : ''))
    setBwDouble(item.bwDouble !== undefined ? String(item.bwDouble) : (item.bw_double !== undefined ? String(item.bw_double) : ''))
    setHsnCode(item.hsnCode || item.hsn_code || '')
    setShowAddModal(true)
  }, [])

  const filteredItems = useMemo(() => {
    return (serverInventory || []).filter(item => {
      if (item.deleted) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        return (item.name || '').toLowerCase().includes(q) || (item.hsnCode || item.hsn_code || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [serverInventory, searchTerm])

  const handleDelete = useCallback(async (item, e) => {
    e.stopPropagation()
    if (window.confirm(`Remove '${item.name}' from inventory catalog?`)) {
      try {
        await deleteItem(item.id)
        showToast(`Inventory item '${item.name}' removed`, 'info')
      } catch (err) {
        showToast(err.message || 'Failed to delete item', 'error')
      }
    }
  }, [deleteItem, showToast])

  const handleFormSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!formName.trim()) {
      showToast('Item name is required', 'error')
      return
    }

    const payload = {
      name: formName.trim(),
      type: 'print',
      hsn_code: hsnCode.trim() || null,
      color_single: Number(colorSingle || 0),
      color_double: Number(colorDouble || 0),
      bw_single: Number(bwSingle || 0),
      bw_double: Number(bwDouble || 0),
      low_stock_alert: 50
    }

    try {
      if (editingItem) {
        await updateItem({ id: editingItem.id, data: payload })
        showToast(`Item '${formName.trim()}' updated successfully`, 'success')
      } else {
        await createItem(payload)
        showToast(`Item '${formName.trim()}' added to inventory`, 'success')
      }
      setShowAddModal(false)
    } catch (err) {
      showToast(err.message || 'Failed to save inventory item', 'error')
    }
  }, [
    formName, hsnCode, colorSingle, colorDouble, bwSingle, bwDouble,
    editingItem, createItem, updateItem, showToast
  ])

  return (
    <MobileLayout title="Inventory & Rates">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>CATALOG & PRICING</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>PRINT PAPER RATES</h2>
        </div>
        <button
          className="mobile-btn mobile-btn-primary"
          onClick={openAddModal}
          disabled={isCreatingItem}
          style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', minHeight: '38px' }}
        >
          <Plus size={16} /> + New Item
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
        <input
          type="text"
          className="mobile-input"
          style={{ paddingLeft: '42px' }}
          placeholder="Search items, paper type, HSN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'all', label: 'All Catalog' },
          { id: 'print', label: 'Print Papers' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setFilterType(t.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: filterType === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: filterType === t.id ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
              color: filterType === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Items List Stack */}
      {isLoadingInventory ? (
        <SkeletonInventoryRow count={6} />
      ) : isError ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '24px 16px', borderColor: 'var(--error)' }}>
          <AlertCircle size={32} style={{ color: 'var(--error)', marginBottom: '8px' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--error)' }}>Failed to load inventory</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{error?.message || 'Network error'}</div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Inbox size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Inventory Items Found</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>No catalog items match filter criteria.</p>
        </div>
      ) : (
        <VirtualList
          items={filteredItems}
          estimateSize={95}
          renderItem={(item) => (
            <InventoryRow
              item={item}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          )}
        />
      )}

      {/* Add / Edit Item Bottom Sheet */}
      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingItem ? 'Edit Paper Rate' : 'New Paper Specification'}>
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>ITEM / PAPER NAME</label>
            <input type="text" className="mobile-input" placeholder="e.g. Glossy Photo Paper 250GSM" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>HSN CODE (OPTIONAL)</label>
            <input type="text" className="mobile-input" placeholder="e.g. 4911" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>COLOR SINGLE (₹)</label>
              <input type="number" step="0.1" className="mobile-input currency-num" value={colorSingle} onChange={(e) => setColorSingle(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>COLOR DOUBLE (₹)</label>
              <input type="number" step="0.1" className="mobile-input currency-num" value={colorDouble} onChange={(e) => setColorDouble(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>B/W SINGLE (₹)</label>
              <input type="number" step="0.1" className="mobile-input currency-num" value={bwSingle} onChange={(e) => setBwSingle(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>B/W DOUBLE (₹)</label>
              <input type="number" step="0.1" className="mobile-input currency-num" value={bwDouble} onChange={(e) => setBwDouble(e.target.value)} required />
            </div>
          </div>

          <button
            type="submit"
            className="mobile-btn mobile-btn-primary"
            disabled={isCreatingItem || isUpdatingItem}
            style={{ marginTop: '8px' }}
          >
            {isCreatingItem || isUpdatingItem ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <Loader2 size={16} className="spin" /> Saving...
              </span>
            ) : editingItem ? (
              'Save Changes'
            ) : (
              'Save Paper Rate to Catalog'
            )}
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
