import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { Plus, Trash2, Calendar, RefreshCcw, CheckCircle, Clock, User, DollarSign } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileRecurringBills() {
  const navigate = useNavigate()
  const { customers, recurringBills, addRecurringBill, deleteRecurringBill, showToast } = useAppContext()

  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    customerId: customers[0]?.id || '',
    amount: '',
    frequency: 'monthly',
    description: '',
    dayOfMonth: '1',
    startDate: new Date().toISOString().slice(0, 10),
    active: true,
  })

  const getCustomerName = (id) => (customers || []).find((c) => String(c.id) === String(id))?.name || 'Unknown'

  // Exact next bill calculation function from desktop RecurringBills.jsx
  const getNextBillDate = (bill) => {
    const today = new Date()
    const dayOfMonth = parseInt(bill.dayOfMonth || 1, 10)

    if (bill.frequency === 'monthly') {
      let nextDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
      if (nextDate < today) {
        nextDate = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
      }
      return nextDate.toLocaleDateString()
    } else if (bill.frequency === 'weekly') {
      const daysUntilDay = (dayOfMonth - today.getDay() + 7) % 7 || 7
      const nextDate = new Date(today)
      nextDate.setDate(nextDate.getDate() + daysUntilDay)
      return nextDate.toLocaleDateString()
    }
    return 'N/A'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.amount || Number(formData.amount) <= 0) {
      showToast('Please enter a valid amount', 'error')
      return
    }

    try {
      if (addRecurringBill) {
        await addRecurringBill({
          ...formData,
          amount: Number(formData.amount),
          dayOfMonth: Number(formData.dayOfMonth),
          active: formData.active === true || formData.active === 'true',
          createdAt: new Date().toISOString(),
        })
      }
      showToast('Recurring Bill Schedule Created!', 'success')
      setShowAddModal(false)
      setFormData({
        customerId: customers[0]?.id || '',
        amount: '',
        frequency: 'monthly',
        description: '',
        dayOfMonth: '1',
        startDate: new Date().toISOString().slice(0, 10),
        active: true,
      })
    } catch (err) {
      showToast('Failed to save recurring schedule', 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      if (deleteRecurringBill) {
        await deleteRecurringBill(id)
      }
      showToast('Recurring schedule deleted', 'info')
    } catch (err) {
      showToast('Failed to delete schedule', 'error')
    }
  }

  return (
    <MobileLayout title="Recurring Schedules" onSwitchToDesktop={() => navigate('/recurring-bills')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>AUTOMATED BILLING</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>RECURRING SCHEDULES</h2>
        </div>
        <button className="mobile-btn mobile-btn-primary" onClick={() => setShowAddModal(true)} style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', minHeight: '38px' }}>
          <Plus size={16} /> + New Schedule
        </button>
      </div>

      {/* Cards List */}
      {(recurringBills || []).length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <RefreshCcw size={40} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Recurring Bills Set Up</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Create automated billing schedules for regular clients.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(recurringBills || []).map((bill) => (
            <div key={bill.id} className="mobile-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {getCustomerName(bill.customerId)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {bill.description || 'Monthly Service Retainer'}
                  </div>
                </div>
                <div className="currency-num" style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>
                  ₹{Number(bill.amount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Next Run: <strong style={{ color: 'var(--accent-secondary)' }}>{getNextBillDate(bill)}</strong> ({bill.frequency.toUpperCase()})
                </div>

                <button onClick={() => handleDelete(bill.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Recurring Bill Bottom Sheet Drawer */}
      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="New Recurring Bill Schedule">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>SELECT CLIENT</label>
            <select className="mobile-input" value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: e.target.value })} required>
              {(customers || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>AMOUNT (INR)</label>
              <input type="number" className="mobile-input currency-num" placeholder="1500" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>FREQUENCY</label>
              <select className="mobile-input" value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>DAY OF MONTH / WEEK</label>
            <input type="number" min="1" max="31" className="mobile-input currency-num" value={formData.dayOfMonth} onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })} required />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>DESCRIPTION</label>
            <input type="text" className="mobile-input" placeholder="e.g. Monthly Maintenance Print Package" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '8px' }}>
            Confirm & Save Schedule
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
