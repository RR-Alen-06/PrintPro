import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { Wallet, Plus, Trash2, Search, User, CheckCircle } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileAdvancePayments() {
  const navigate = useNavigate()
  const { advancePayments, customers, addAdvancePayment, deleteAdvancePayment, showToast } = useAppContext()

  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '')
  const [cashAmount, setCashAmount] = useState('')
  const [upiAmount, setUpiAmount] = useState('')
  const [notes, setNotes] = useState('')

  const getCustomerName = (id) => (customers || []).find(c => String(c.id) === String(id))?.name || 'Unknown'

  const filteredAdvances = useMemo(() => {
    return (advancePayments || []).filter(ap => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const custName = getCustomerName(ap.customerId).toLowerCase()
        return custName.includes(q) || (ap.notes || '').toLowerCase().includes(q)
      }
      return true
    }).sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [advancePayments, customers, searchTerm])

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    const cash = Number(cashAmount || 0)
    const upi = Number(upiAmount || 0)
    const total = cash + upi

    if (total <= 0) {
      showToast('Please enter cash or UPI amount', 'error')
      return
    }

    try {
      const payload = {
        id: `adv-${Date.now()}`,
        customerId: selectedCustomerId,
        customerName: getCustomerName(selectedCustomerId),
        date: new Date().toISOString().slice(0, 10),
        cashAmount: cash,
        upiAmount: upi,
        amount: total,
        notes: notes || 'Advance Deposit'
      }

      if (addAdvancePayment) {
        await addAdvancePayment(payload)
      }

      showToast(`Recorded ₹${total.toFixed(2)} advance deposit!`, 'success')
      setCashAmount('')
      setUpiAmount('')
      setNotes('')
      setShowAddModal(false)
    } catch (err) {
      showToast('Failed to record advance deposit', 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      if (deleteAdvancePayment) {
        await deleteAdvancePayment(id)
      }
      showToast('Advance deposit record deleted', 'info')
    } catch (err) {
      showToast('Failed to delete advance deposit', 'error')
    }
  }

  return (
    <MobileLayout title="Advance Deposits" onSwitchToDesktop={() => navigate('/advance-payments')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>PRE-PAYMENT DEPOSITS</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>ADVANCE DEPOSITS</h2>
        </div>
        <button className="mobile-btn mobile-btn-primary" onClick={() => setShowAddModal(true)} style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', minHeight: '38px' }}>
          <Plus size={16} /> + Deposit
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
        <input
          type="text"
          className="mobile-input"
          style={{ paddingLeft: '42px' }}
          placeholder="Search customer, deposit notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Advance Payments Cards Stack */}
      {filteredAdvances.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Wallet size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Advance Deposits Found</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>No pre-payment deposits match filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredAdvances.map(ap => (
            <div key={ap.id} className="mobile-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {getCustomerName(ap.customerId)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Date: {ap.date} • {ap.notes || 'Advance Deposit'}
                  </div>
                </div>
                <div className="currency-num" style={{ fontSize: '1.15rem', color: 'var(--success)' }}>
                  +₹{Number(ap.amount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Cash: ₹{Number(ap.cashAmount || 0).toFixed(2)} | UPI: ₹{Number(ap.upiAmount || 0).toFixed(2)}
                </div>
                <button onClick={() => handleDelete(ap.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Advance Deposit Bottom Sheet */}
      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Record Advance Deposit">
        <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>SELECT CLIENT</label>
            <select className="mobile-input" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} required>
              {(customers || []).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>CASH DEPOSIT (₹)</label>
              <input type="number" step="0.01" className="mobile-input currency-num" placeholder="0.00" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>UPI DEPOSIT (₹)</label>
              <input type="number" step="0.01" className="mobile-input currency-num" placeholder="0.00" value={upiAmount} onChange={(e) => setUpiAmount(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>DEPOSIT NOTES</label>
            <input type="text" className="mobile-input" placeholder="e.g. Advance for bulk poster order" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '8px' }}>
            Record Deposit & Update Credit
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
