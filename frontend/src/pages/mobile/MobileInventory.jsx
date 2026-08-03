import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { Inbox, Plus, Pencil, Trash2, Search, Check, AlertTriangle, Package } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileInventory() {
  const navigate = useNavigate()
  const { inventory, addInventoryItem, updateInventoryItem, removeInventoryItem, showToast } = useAppContext()

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | 'print' | 'product'
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  // Form State
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('print')
  const [colorSingle, setColorSingle] = useState('')
  const [colorDouble, setColorDouble] = useState('')
  const [bwSingle, setBwSingle] = useState('')
  const [bwDouble, setBwDouble] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [stockQty, setStockQty] = useState('')
  const [hsnCode, setHsnCode] = useState('')

  const filteredItems = useMemo(() => {
    return (inventory || []).filter(item => {
      if (filterType !== 'all' && (item.type || 'print') !== filterType) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        return (item.name || '').toLowerCase().includes(q) || (item.hsnCode || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [inventory, filterType, searchTerm])

  const openAddModal = () => {
    setEditingItem(null)
    setFormName('')
    setFormType('print')
    setColorSingle('10')
    setColorDouble('18')
    setBwSingle('3')
    setBwDouble('5')
    setSellingPrice('')
    setStockQty('')
    setHsnCode('')
    setShowAddModal(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setFormName(item.name || '')
    setFormType(item.type || 'print')
    setColorSingle(item.colorSingle || '')
    setColorDouble(item.colorDouble || '')
    setBwSingle(item.bwSingle || '')
    setBwDouble(item.bwDouble || '')
    setSellingPrice(item.sellingPrice || '')
    setStockQty(item.stock || '')
    setHsnCode(item.hsnCode || '')
    setShowAddModal(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!formName.trim()) {
      showToast('Please enter item name', 'error')
      return
    }

    try {
      const payload = {
        name: formName.trim(),
        type: formType,
        colorSingle: formType === 'product' ? 0 : Number(colorSingle || 0),
        colorDouble: formType === 'product' ? 0 : Number(colorDouble || 0),
        bwSingle: formType === 'product' ? 0 : Number(bwSingle || 0),
        bwDouble: formType === 'product' ? 0 : Number(bwDouble || 0),
        sellingPrice: formType === 'product' ? Number(sellingPrice || 0) : 0,
        stock: formType === 'product' ? Number(stockQty || 0) : 0,
        hsnCode: hsnCode.trim()
      }

      if (editingItem) {
        if (updateInventoryItem) {
          await updateInventoryItem(editingItem.id, payload)
        }
        showToast(`Item '${payload.name}' updated!`, 'success')
      } else {
        if (addInventoryItem) {
          await addInventoryItem(payload)
        }
        showToast(`Item '${payload.name}' added to inventory!`, 'success')
      }

      setShowAddModal(false)
    } catch (err) {
      showToast('Failed to save item', 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      if (removeInventoryItem) {
        await removeInventoryItem(id)
      }
      showToast('Inventory item removed', 'info')
    } catch (err) {
      showToast('Failed to delete item', 'error')
    }
  }

  return (
    <MobileLayout title="Inventory & Rates" onSwitchToDesktop={() => navigate('/inventory')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>CATALOG & PRICING</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>INVENTORY RATES</h2>
        </div>
        <button className="mobile-btn mobile-btn-primary" onClick={openAddModal} style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', minHeight: '38px' }}>
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
          { id: 'product', label: 'Retail Products' },
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
      {filteredItems.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Inbox size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Inventory Items Found</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>No catalog items match filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredItems.map(item => {
            const isProduct = item.type === 'product'
            return (
              <div key={item.id} className="mobile-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      HSN: {item.hsnCode || 'N/A'} • Type: {(item.type || 'print').toUpperCase()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEditModal(item)} style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', cursor: 'pointer' }}>
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {!isProduct ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Color 1S: <strong className="currency-num" style={{ color: 'var(--accent-primary)' }}>₹{item.colorSingle}</strong> | 2S: <strong className="currency-num" style={{ color: 'var(--accent-primary)' }}>₹{item.colorDouble}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      B/W 1S: <strong className="currency-num" style={{ color: '#ffffff' }}>₹{item.bwSingle}</strong> | 2S: <strong className="currency-num" style={{ color: '#ffffff' }}>₹{item.bwDouble}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Stock: <strong className="currency-num">{item.stock} Qty</strong></span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)' }}>Price: <strong className="currency-num">₹{item.sellingPrice}</strong></span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Item Bottom Sheet */}
      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingItem ? 'Edit Inventory Item' : 'New Inventory Item'}>
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>ITEM TYPE</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button type="button" className={`mobile-btn ${formType === 'print' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`} onClick={() => setFormType('print')} style={{ minHeight: '38px', fontSize: '0.82rem' }}>Print Paper Service</button>
              <button type="button" className={`mobile-btn ${formType === 'product' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`} onClick={() => setFormType('product')} style={{ minHeight: '38px', fontSize: '0.82rem' }}>Retail Product</button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>ITEM NAME</label>
            <input type="text" className="mobile-input" placeholder="e.g. Glossy Photo Paper 250GSM" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          </div>

          {formType === 'print' ? (
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
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>SELLING PRICE (₹)</label>
                <input type="number" step="0.1" className="mobile-input currency-num" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>STOCK QUANTITY</label>
                <input type="number" className="mobile-input currency-num" value={stockQty} onChange={(e) => setStockQty(e.target.value)} required />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>HSN / SAC CODE</label>
            <input type="text" className="mobile-input currency-num" placeholder="998912" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '8px' }}>
            Save Item to Inventory
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
