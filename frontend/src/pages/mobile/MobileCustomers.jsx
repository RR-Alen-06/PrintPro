import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { Users, Search, Plus, Phone, Mail, FileText, ChevronRight, UserCheck } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileCustomers() {
  const navigate = useNavigate()
  const { customers, addCustomer, showToast } = useAppContext()

  const [searchTerm, setSearchTerm] = useState('')
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all') // 'all' | 'regular' | 'random'
  const [showAddModal, setShowAddModal] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState('regular')

  const filteredCustomers = useMemo(() => {
    return (customers || []).filter(c => {
      if (c.deleted) return false
      if (customerTypeFilter !== 'all' && c.type !== customerTypeFilter) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [customers, customerTypeFilter, searchTerm])

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      showToast('Please enter customer name', 'error')
      return
    }

    try {
      const payload = {
        id: `cust-${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        type,
        creditBalance: 0,
        createdAt: new Date().toISOString()
      }

      if (addCustomer) {
        await addCustomer(payload)
      }

      showToast(`Customer '${payload.name}' added successfully!`, 'success')
      setName('')
      setPhone('')
      setEmail('')
      setShowAddModal(false)
    } catch (err) {
      showToast('Failed to add customer', 'error')
    }
  }

  return (
    <MobileLayout title="Customer Directory" onSwitchToDesktop={() => navigate('/customers')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>CLIENT DIRECTORY</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>CUSTOMERS</h2>
        </div>
        <button className="mobile-btn mobile-btn-primary" onClick={() => setShowAddModal(true)} style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', minHeight: '38px' }}>
          <Plus size={16} /> + New Client
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
        <input
          type="text"
          className="mobile-input"
          style={{ paddingLeft: '42px' }}
          placeholder="Search name, phone, email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Type Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'all', label: 'All Clients' },
          { id: 'regular', label: 'Regular Clients' },
          { id: 'random', label: 'Walk-in Clients' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setCustomerTypeFilter(t.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: customerTypeFilter === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              background: customerTypeFilter === t.id ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
              color: customerTypeFilter === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Customer Cards List */}
      {filteredCustomers.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Users size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Customers Match Filter</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Try clearing your search term or type filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredCustomers.map(c => (
            <div key={c.id} className="mobile-card" onClick={() => navigate(`/mobile/customer-ledger?customerId=${c.id}`)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Phone: {c.phone || 'N/A'} {c.email ? `• ${c.email}` : ''}
                  </div>
                </div>
                <span className={`mobile-badge ${c.type === 'regular' ? 'mobile-badge-info' : 'mobile-badge-warning'}`}>
                  {c.type.toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Credit Balance: <strong className="currency-num" style={{ color: Number(c.creditBalance || 0) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>₹{Number(c.creditBalance || 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--accent-secondary)', fontWeight: 700 }}>
                  Ledger <ChevronRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Customer Bottom Sheet */}
      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Customer">
        <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>CLIENT TYPE</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button type="button" className={`mobile-btn ${type === 'regular' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`} onClick={() => setType('regular')} style={{ minHeight: '38px', fontSize: '0.82rem' }}>Regular Client</button>
              <button type="button" className={`mobile-btn ${type === 'random' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`} onClick={() => setType('random')} style={{ minHeight: '38px', fontSize: '0.82rem' }}>Walk-in Client</button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>FULL NAME</label>
            <input type="text" className="mobile-input" placeholder="e.g. Neo Akira Media" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>PHONE NUMBER</label>
            <input type="tel" className="mobile-input" placeholder="+91 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>EMAIL ADDRESS</label>
            <input type="email" className="mobile-input" placeholder="client@neoakira.io" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '8px' }}>
            Save Customer Record
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
