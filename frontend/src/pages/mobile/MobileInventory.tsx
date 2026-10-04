import React, { useState, useMemo, useCallback } from 'react'
import { useAppContext } from '../../context/AppContext'
import { useInventory, useInventoryMutations } from '../../hooks/useEntitiesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import VirtualList from '../../components/mobile/VirtualList'
import SkeletonInventoryRow from '../../components/mobile/SkeletonInventoryRow'
import { Inbox, Plus, Pencil, Trash2, Search, Loader2, AlertCircle } from 'lucide-react'
import { SequenceService } from '../../services/sequenceService'
import '../../styles/mobile.css'

const InventoryRow = React.memo(({ item, index, currencySymbol = '₹', onEdit, onDelete }: any) => {
  const isProduct = item.type === 'product'
  const hasCleanCode = item.itemCode && typeof item.itemCode === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(item.itemCode);
  const hasCleanDbCode = item.item_code && typeof item.item_code === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(item.item_code);
  const itemCodeDisplay = (hasCleanCode ? item.itemCode : (hasCleanDbCode ? item.item_code : `ITM-${String(typeof index === 'number' ? index + 1 : 1).padStart(4, '0')}`))

  return (
    <div className="mobile-card" style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.name}</span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                background: isProduct ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: isProduct ? '#a855f7' : '#3b82f6'
              }}
            >
              {isProduct ? 'Product' : 'Print'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Code: {itemCodeDisplay} • HSN: {item.hsnCode || item.hsn_code || 'N/A'}
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

      {isProduct ? (
        <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Selling Price:</span>
          <strong className="currency-num" style={{ fontSize: '1rem', color: 'var(--success)' }}>
            {currencySymbol}{Number(item.unitPrice !== undefined ? item.unitPrice : (item.sellingPrice !== undefined ? item.sellingPrice : (item.selling_price || item.unit_price || 0))).toFixed(2)}
          </strong>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Color 1S: <strong className="currency-num" style={{ color: 'var(--accent-primary)' }}>{currencySymbol}{Number(item.colorSingle !== undefined ? item.colorSingle : (item.color_single || 0)).toFixed(2)}</strong> | 2S: <strong className="currency-num" style={{ color: 'var(--accent-primary)' }}>{currencySymbol}{Number(item.colorDouble !== undefined ? item.colorDouble : (item.color_double || 0)).toFixed(2)}</strong>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            B/W 1S: <strong className="currency-num" style={{ color: '#ffffff' }}>{currencySymbol}{Number(item.bwSingle !== undefined ? item.bwSingle : (item.bw_single || 0)).toFixed(2)}</strong> | 2S: <strong className="currency-num" style={{ color: '#ffffff' }}>{currencySymbol}{Number(item.bwDouble !== undefined ? item.bwDouble : (item.bw_double || 0)).toFixed(2)}</strong>
          </div>
        </div>
      )}
    </div>
  )
})

InventoryRow.displayName = 'InventoryRow'

export default function MobileInventory() {
  const { showToast, settings } = useAppContext()
  const currencySymbol = settings?.currency || '₹'

  // TanStack Query & Mutations
  const { data: serverInventory = [], isLoading: isLoadingInventory, isError, error } = useInventory()
  const { createItem, updateItem, deleteItem, isCreatingItem, isUpdatingItem } = useInventoryMutations()

  const previewItemCode = useMemo(() => {
    return SequenceService.peekNextSequence(
      'INVENTORY',
      serverInventory,
      settings?.itmPrefix || 'ITM',
      settings?.seqPadding || 6
    )
  }, [serverInventory, settings?.itmPrefix, settings?.seqPadding])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | category name
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  const availableCategories: string[] = useMemo(() => {
    const fromSettings = settings?.customCategories || ['Standard Print', 'Document Services', 'Binding & Lamination', 'Merchandise', 'Design & Scanning']
    return ['all', ...fromSettings]
  }, [settings?.customCategories])

  const availableUnits: string[] = useMemo(() => {
    return settings?.customUnits || ['pages', 'pcs', 'copies', 'sets', 'sq ft', 'books', 'meters', 'hrs']
  }, [settings?.customUnits])

  // Form State
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('product') // 'print' | 'product'
  const [formCategory, setFormCategory] = useState('')
  const [formUnit, setFormUnit] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [colorSingle, setColorSingle] = useState('')
  const [colorDouble, setColorDouble] = useState('')
  const [bwSingle, setBwSingle] = useState('')
  const [bwDouble, setBwDouble] = useState('')
  const [hsnCode, setHsnCode] = useState('')

  const openAddModal = useCallback(() => {
    setEditingItem(null)
    setFormName('')
    setFormType('product')
    setFormCategory(availableCategories[1] || 'Standard Print')
    setFormUnit(availableUnits[0] || 'pcs')
    setSellingPrice('')
    setColorSingle('')
    setColorDouble('')
    setBwSingle('')
    setBwDouble('')
    setHsnCode('')
    setShowAddModal(true)
  }, [availableCategories, availableUnits])

  const openEditModal = useCallback((item: any) => {
    setEditingItem(item)
    setFormName(item.name || '')
    setFormType(item.type || 'product')
    setFormCategory(item.category || item.category_name || '')
    setFormUnit(item.unit || item.measurement_unit || '')
    setSellingPrice(item.unitPrice !== undefined ? String(item.unitPrice) : (item.sellingPrice !== undefined ? String(item.sellingPrice) : (item.selling_price !== undefined ? String(item.selling_price) : '')))
    setColorSingle(item.colorSingle !== undefined ? String(item.colorSingle) : (item.color_single !== undefined ? String(item.color_single) : ''))
    setColorDouble(item.colorDouble !== undefined ? String(item.colorDouble) : (item.color_double !== undefined ? String(item.color_double) : ''))
    setBwSingle(item.bwSingle !== undefined ? String(item.bwSingle) : (item.bw_single !== undefined ? String(item.bw_single) : ''))
    setBwDouble(item.bwDouble !== undefined ? String(item.bwDouble) : (item.bw_double !== undefined ? String(item.bw_double) : ''))
    setHsnCode(item.hsnCode || item.hsn_code || '')
    setShowAddModal(true)
  }, [])

  const filteredItems = useMemo(() => {
    return (Array.isArray(serverInventory) ? serverInventory : []).filter(item => {
      if (!item || item.deleted || item.deleted_at) return false
      if (filterType !== 'all') {
        const itemCat = item.category || (item.type === 'print' ? 'Standard Print' : 'Product')
        if (itemCat !== filterType && item.type !== filterType) return false
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        return (item.name || '').toLowerCase().includes(q) || (item.hsnCode || item.hsn_code || '').toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q)
      }
      return true
    }).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, { numeric: true }))
  }, [serverInventory, searchTerm, filterType])

  const handleDelete = useCallback(async (item, e) => {
    e.stopPropagation()
    if (window.confirm(`Remove '${item.name}' from catalog?`)) {
      try {
        await deleteItem(item.id)
        showToast(`Catalog item '${item.name}' removed`, 'info')
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

    const isProd = formType === 'product'
    const sp = isProd ? Number(sellingPrice || 0) : 0
    const cs = isProd ? 0 : Number(colorSingle || 0)
    const cd = isProd ? 0 : Number(colorDouble || 0)
    const bs = isProd ? 0 : Number(bwSingle || 0)
    const bd = isProd ? 0 : Number(bwDouble || 0)
    const hsn = hsnCode.trim() || null

    const generatedItemCode = editingItem
      ? (editingItem.itemCode || editingItem.item_code || SequenceService.formatDisplayCode('inventory', editingItem.id, 'ITM', 4))
      : await SequenceService.getNextSequenceSafe('INVENTORY', serverInventory || [], 'ITM', 4);

    const payload = {
      name: formName.trim(),
      item_code: generatedItemCode,
      itemCode: generatedItemCode,
      type: formType,
      category: formCategory,
      unit: formUnit,
      hsn_code: hsn,
      hsnCode: hsn || '',
      selling_price: sp,
      sellingPrice: sp,
      unit_price: sp,
      unitPrice: sp,
      color_single: cs,
      colorSingle: cs,
      color_double: cd,
      colorDouble: cd,
      bw_single: bs,
      bwSingle: bs,
      bw_double: bd,
      bwDouble: bd,
    }

    try {
      if (editingItem) {
        await updateItem({ id: editingItem.id, data: payload })
        showToast(`Item '${formName.trim()}' updated successfully`, 'success')
      } else {
        await createItem(payload)
        showToast(`Item '${formName.trim()}' added to catalog (${generatedItemCode})`, 'success')
      }
      setShowAddModal(false)
    } catch (err) {
      showToast(err.message || 'Failed to save catalog item', 'error')
    }
  }, [
    formName, formType, formCategory, formUnit, sellingPrice, hsnCode, colorSingle, colorDouble, bwSingle, bwDouble,
    editingItem, serverInventory, createItem, updateItem, showToast
  ])

  return (
    <MobileLayout title="Inventory & Rates">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>CATALOG & PRICING</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>ITEMS & RATES</h2>
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
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' }}>
        {availableCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterType(cat)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              border: filterType === cat ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: filterType === cat ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
              color: filterType === cat ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            {cat === 'all' ? 'All Catalog' : cat}
          </button>
        ))}
      </div>

      {/* Items List Stack */}
      {isLoadingInventory ? (
        <SkeletonInventoryRow count={6} />
      ) : isError ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '24px 16px', borderColor: 'var(--error)' }}>
          <AlertCircle size={32} style={{ color: 'var(--error)', marginBottom: '8px' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--error)' }}>Failed to load catalog</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{error?.message || 'Network error'}</div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Inbox size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Catalog Items Found</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>No catalog items match filter criteria.</p>
        </div>
      ) : (
        <VirtualList
          items={filteredItems}
          estimateSize={95}
          renderItem={(item, index) => (
            <InventoryRow
              key={item.id || index}
              item={item}
              index={index}
              currencySymbol={currencySymbol}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          )}
        />
      )}

      {/* Add / Edit Item Bottom Sheet */}
      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingItem ? 'Edit Pricing Specification' : 'New Pricing Item'}>
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!editingItem && (
            <div style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-Assigned Code:</span>
              <strong style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#3b82f6' }}>{previewItemCode}</strong>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>ITEM TYPE</label>
              <select
                className="mobile-input"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
              >
                <option value="product">Standard Product / Service</option>
                <option value="print">Print Specification</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>CATEGORY</label>
              <select
                className="mobile-input"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {availableCategories.filter(c => c !== 'all').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>ITEM NAME</label>
              <input type="text" className="mobile-input" placeholder="e.g. Document Print, Spiral Binding" value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>UNIT</label>
              <select
                className="mobile-input"
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
              >
                {availableUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>HSN CODE (OPTIONAL)</label>
            <input type="text" className="mobile-input" placeholder="e.g. 4911" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
          </div>

          {formType === 'product' ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>SELLING PRICE ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="mobile-input currency-num"
                placeholder="0.00"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                required
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>COLOR SINGLE ({currencySymbol})</label>
                <input type="number" step="0.01" className="mobile-input currency-num" value={colorSingle} onChange={(e) => setColorSingle(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>COLOR DOUBLE ({currencySymbol})</label>
                <input type="number" step="0.01" className="mobile-input currency-num" value={colorDouble} onChange={(e) => setColorDouble(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>B/W SINGLE ({currencySymbol})</label>
                <input type="number" step="0.01" className="mobile-input currency-num" value={bwSingle} onChange={(e) => setBwSingle(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>B/W DOUBLE ({currencySymbol})</label>
                <input type="number" step="0.01" className="mobile-input currency-num" value={bwDouble} onChange={(e) => setBwDouble(e.target.value)} required />
              </div>
            </div>
          )}

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
              'Save Item to Catalog'
            )}
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}

