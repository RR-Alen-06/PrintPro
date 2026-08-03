import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { Plus, Trash2, Edit2, Clock, CheckCircle, ChevronDown, ChevronUp, AlertCircle, Info, RefreshCcw } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileRecurringBills() {
  const navigate = useNavigate()
  const { customers, recurringBills, addRecurringBill, deleteRecurringBill, showToast } = useAppContext()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [openInfoSection, setOpenInfoSection] = useState(null) // Collapsible card key

  const activeCount = (recurringBills || []).filter((b) => billIsActive(b)).length

  function billIsActive(b) {
    return b.active === true || b.active === 'true'
  }

  const [formData, setFormData] = useState({
    customerId: customers[0]?.id || '',
    amount: '',
    frequency: 'monthly',
    dayOfMonth: '1',
    startDate: new Date().toISOString().slice(0, 10),
    active: true,
    description: '',
  })

  const getCustomerName = (id) => (customers || []).find((c) => String(c.id) === String(id))?.name || 'Unknown Client'

  // Exact next bill date logic from desktop RecurringBills.jsx
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

  const openAddForm = () => {
    setEditingId(null)
    setFormData({
      customerId: customers[0]?.id || '',
      amount: '',
      frequency: 'monthly',
      dayOfMonth: '1',
      startDate: new Date().toISOString().slice(0, 10),
      active: true,
      description: '',
    })
    setShowAddModal(true)
  }

  const openEditForm = (bill) => {
    setEditingId(bill.id)
    setFormData({
      customerId: bill.customerId,
      amount: String(bill.amount || ''),
      frequency: bill.frequency || 'monthly',
      dayOfMonth: String(bill.dayOfMonth || '1'),
      startDate: bill.startDate || new Date().toISOString().slice(0, 10),
      active: billIsActive(bill),
      description: bill.description || '',
    })
    setShowAddModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.amount || Number(formData.amount) <= 0) {
      showToast('Please enter a valid amount', 'error')
      return
    }

    try {
      if (editingId && deleteRecurringBill) {
        await deleteRecurringBill(editingId)
      }

      if (addRecurringBill) {
        await addRecurringBill({
          ...formData,
          amount: Number(formData.amount),
          dayOfMonth: Number(formData.dayOfMonth),
          active: formData.active === true || formData.active === 'true',
          createdAt: new Date().toISOString(),
        })
      }

      showToast(editingId ? 'Recurring schedule updated!' : 'Recurring schedule created!', 'success')
      setShowAddModal(false)
      setEditingId(null)
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

  const toggleInfo = (key) => {
    setOpenInfoSection(openInfoSection === key ? null : key)
  }

  return (
    <MobileLayout title="Recurring Schedules" onSwitchToDesktop={() => navigate('/recurring-bills')}>
      {/* Stat Header Card */}
      <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>AUTOMATED SCHEDULES</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '2px' }}>
              {activeCount} Active Schedule(s)
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Out of {(recurringBills || []).length} total configured templates
            </div>
          </div>
          <button className="mobile-btn mobile-btn-primary" onClick={openAddForm} style={{ width: 'auto', padding: '0 14px', fontSize: '0.8rem', minHeight: '38px' }}>
            <Plus size={16} /> + New Schedule
          </button>
        </div>
      </div>

      {/* Recurring Bills List */}
      {(recurringBills || []).length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          <Clock size={44} style={{ color: 'var(--accent-primary)', opacity: 0.6, marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 800 }}>No Recurring Bills Set Up</h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem' }}>No recurring billing profiles have been configured yet.</p>
          <button className="mobile-btn mobile-btn-primary" onClick={openAddForm} style={{ width: 'auto', display: 'inline-flex' }}>
            + Set Up First Recurring Bill
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {(recurringBills || []).map((bill) => {
            const isActive = billIsActive(bill)
            return (
              <div key={bill.id} className="mobile-card" style={{ opacity: isActive ? 1 : 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {getCustomerName(bill.customerId)}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {bill.description || 'Monthly Service Package'}
                    </div>
                  </div>
                  <div className="currency-num" style={{ fontSize: '1.25rem', color: 'var(--accent-primary)', textShadow: '0 0 8px rgba(255, 47, 176, 0.3)' }}>
                    ₹{Number(bill.amount || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`mobile-badge ${isActive ? 'mobile-badge-success' : 'mobile-badge-warning'}`} style={{ fontSize: '0.68rem' }}>
                      {isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Next: <strong style={{ color: 'var(--accent-secondary)' }}>{getNextBillDate(bill)}</strong> ({bill.frequency.toUpperCase()})
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => openEditForm(bill)} style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', cursor: 'pointer' }}>
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(bill.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info Section as Collapsible Cards */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px 0', letterSpacing: '0.04em' }}>
          ABOUT RECURRING BILLS
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { key: 'weekly', title: 'Weekly Recurring', text: 'Bills repeat every week on the selected day of the week. Useful for regular weekly print production batches.' },
            { key: 'monthly', title: 'Monthly Recurring', text: 'Bills repeat every month on the selected date. Useful for regular monthly retainer contracts.' },
            { key: 'auto', title: 'Auto-Generation', text: 'Bills can be generated manually or automatically from recurring templates during your morning shift startup.' },
            { key: 'flex', title: 'Flexibility', text: 'Toggle active/inactive status at any time without deleting the underlying client retainer setup.' },
          ].map(info => {
            const isOpen = openInfoSection === info.key
            return (
              <div key={info.key} className="mobile-card" style={{ padding: '12px' }}>
                <div
                  onClick={() => toggleInfo(info.key)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{info.title}</span>
                  {isOpen ? <ChevronUp size={16} style={{ color: 'var(--accent-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                </div>
                {isOpen && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                    {info.text}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add / Edit Recurring Bill Bottom Sheet Form */}
      <BottomSheet isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingId ? 'Edit Recurring Bill' : 'Add Recurring Bill'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>CLIENT / CUSTOMER</label>
            <select className="mobile-input" value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: e.target.value })} required>
              {(customers || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>AMOUNT (INR)</label>
              <input type="number" step="0.01" className="mobile-input currency-num" placeholder="1500.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>FREQUENCY</label>
              <select className="mobile-input" value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                {formData.frequency === 'monthly' ? 'DAY OF MONTH' : 'DAY OF WEEK'}
              </label>
              {formData.frequency === 'monthly' ? (
                <input type="number" min="1" max="31" className="mobile-input currency-num" value={formData.dayOfMonth} onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })} required />
              ) : (
                <select className="mobile-input" value={formData.dayOfMonth} onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}>
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>START DATE</label>
              <input type="date" className="mobile-input" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>STATUS ACTIVE TOGGLE</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button type="button" className={`mobile-btn ${formData.active ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`} onClick={() => setFormData({ ...formData, active: true })} style={{ minHeight: '38px', fontSize: '0.82rem' }}>Active</button>
              <button type="button" className={`mobile-btn ${!formData.active ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`} onClick={() => setFormData({ ...formData, active: false })} style={{ minHeight: '38px', fontSize: '0.82rem' }}>Inactive</button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>DESCRIPTION / NOTES</label>
            <input type="text" className="mobile-input" placeholder="e.g. Monthly Retainer for Poster Prints" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '6px' }}>
            {editingId ? 'Save Changes' : 'Save Recurring Bill Schedule'}
          </button>
        </form>
      </BottomSheet>
    </MobileLayout>
  )
}
